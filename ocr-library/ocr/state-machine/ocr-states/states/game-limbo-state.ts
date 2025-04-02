import { GlobalState } from "../../global-state";
import { OCRFrame } from "../../ocr-frame";
import { OCRState, StateEvent } from "../../ocr-state";
import { ConsecutivePersistenceStrategy, SingleFramePersistenceStrategy, TimedPersistenceStrategy } from "../../persistence-strategy";
import { NOISE_THRESHOLD } from "./before-game-state";
import { OCRStateID } from "../ocr-state-id";
import { RestartGameEvent } from "../events/restart-game-event";
import { TetrominoType } from "src/app/shared/tetris/tetromino-type";
import { Counter } from "src/app/shared/scripts/counter";
import { RecoveryEvent } from "../events/recovery-event";
import { SmartGameStatus } from "src/app/shared/tetris/smart-game-status";
import { OCRConfig } from "../../ocr-state-machine";
import { TopoutEvent } from "../events/topout-event";
import { StuckEvent } from "../events/stuck-event";

export class GameLimboState extends OCRState {
    public override readonly id = OCRStateID.GAME_LIMBO;

    private ocrCounter = new Counter(10);
    private next: TetrominoType = this.globalState.game!.getNextType();
    public predictedLevel = this.globalState.game!.getStatus().level;
    public predictedLines = this.globalState.game!.getStatus().lines;
    public predictedScore = this.globalState.game!.getStatus().score;

    public override init() {

        this.registerEvent(new RestartGameEvent(this.config, this.globalState, this.textLogger));
        this.registerEvent(new LinecapEvent(this.config, this.globalState));
        this.registerEvent(new RecoveryEvent(this.globalState, this));
        this.registerEvent(new ExitEvent());
        this.registerEvent(new StuckEvent());

        // If piece appears on top of screen for too long, it is topout
        this.registerEvent(new TopoutEvent());

        // NO TIMEOUTS, TOO MANY FALSE POSITIVES
        //this.registerEvent(new TimeoutEvent(this.globalState));
    }

    /**
     * Runs the logic for the BeforeGameState each frame.
     * @param gameData 
     * @param ocrFrame 
     */
    protected override async onAdvanceFrame(ocrFrame: OCRFrame) {

        // Poll for next, level, lines, and score every few frames to avoid too much computation
        if (this.ocrCounter.next()) {
            const next = ocrFrame.getNextType()!;
            if (next !== TetrominoType.ERROR_TYPE) this.next = next;

            // Only attempt calc if not capped
            if (this.globalState.game!.profile.isMaxoutCapped !== true) {
                await this.updateCounters(ocrFrame);                
            }
        }

        // As we have no guarantees about what is going on, just keep sending the raw OCR board each frame
        this.globalState.game!.setFullState(
            ocrFrame.getColorBoard(this.predictedLevel, this.globalState.ocrColor)!,
            this.next,
            this.predictedLevel,
            this.predictedLines,
            this.predictedScore,
        );
    }

    /**
     * Try to derive score, level and lines. Because each of these rollover/cap, try to derive if needed
     */
    public async updateCounters(ocrFrame: OCRFrame) {

        const previousLevel = this.predictedLevel;
        const previousLines = this.predictedLines;

        //console.log("updating counters");

        // Derive new lines
        if (this.predictedLines < 992) {
            // If before lines rollover, read all 3 digits. Can only skip up to 8 lines, or OCR will break
            let ocrLines = (await ocrFrame.getLines(false))!
            //console.log("ocrLines", ocrLines, "predicted", this.predictedLines);
            if (ocrLines !== -1 && ocrLines > this.predictedLines && ocrLines <= this.predictedLines + 8) {
                this.predictedLines = ocrLines;
                console.log("new lines", this.predictedLines, "full read");
            }
        } else {
            // Already at lines rollover. Read only the last two digits
            let ocrLines = (await ocrFrame.getLines(true))!
            if (ocrLines !== -1) {
                ocrLines += (Math.floor(this.predictedLines / 100) * 100);

                // This happens when wraparound i.e. 1199 => 1200, because 0 < 99
                if (ocrLines < this.predictedLines) ocrLines += 100;

                // Can only advance a maximum of 4 lines, or OCR will break
                if (ocrLines > this.predictedLines && ocrLines - this.predictedLines <= 4) {
                    this.predictedLines = ocrLines;
                    console.log("new lines", this.predictedLines, "mod read, rollover");
                }
            }
        }

        // New level if lines overflow in ones digit
        const transitionLines = this.globalState.game!.getMemoryStatus().transitionLines;
        if (this.predictedLines >= transitionLines && this.predictedLines % 10 < previousLines % 10) {
            this.predictedLevel++;
        }

        const scoreFromLineClears = (linesCleared: number) => {
            const status = new SmartGameStatus(this.globalState.game!.startLevel, previousLines, this.predictedScore, previousLevel);
            status.onLineClear(linesCleared);
            return status.score;
        }

        // Derive new score
        if (this.predictedScore < 960000) {
            // If before maxout, read all 6 digits. Can only skip up to 100,000 points, or OCR will break
            let ocrScore = (await ocrFrame.getScore(false))!;
            if (ocrScore !== -1 && ocrScore > this.predictedScore && ocrScore < this.predictedScore + 100000) {
                this.predictedScore = ocrScore;
                console.log("new score", this.predictedScore, "full read");
            }
        } else if (scoreFromLineClears(4) % 1600000 < 1000000 && this.globalState.game!.profile.isMaxoutCapped !== true) {
            // Can read full 6 digits, plus rollover
            let rolloverScore = (await ocrFrame.getScore(false))!;
            if (rolloverScore !== -1) {
                let ocrScore = rolloverScore + 1600000 * this.globalState.game!.profile.numRollovers;
                if (ocrScore > this.predictedScore  && ocrScore < this.predictedScore + 100000) {
                    this.predictedScore = ocrScore;
                    console.log("new score", this.predictedScore, "full read with rollover");
                }
            }
        } else if (this.predictedLevel < 80 && this.globalState.game!.profile.isMaxoutCapped !== true) {
            // Use mod calculations to figure out new score from the last 5 digits of score ocr
            let modScore = (await ocrFrame.getScore(true))!;
            if (modScore !== -1) {
                let ocrScore = Math.floor(this.predictedScore / 100000) * 100000 + modScore;
                if (ocrScore < this.predictedScore) ocrScore += 100000; // for wraparounds like 1,390,000 -> 1,410,000
                this.predictedScore = ocrScore;
                console.log("new score", this.predictedScore, "last five digits", modScore);
            }
        } else if (this.predictedLines > previousLines && this.predictedLines <= previousLines + 4) {
            // Calculate score purely from lines increase
            const linesCleared = this.predictedLines - previousLines;
            this.predictedScore = scoreFromLineClears(linesCleared);
            console.log("new score", this.predictedScore, "from line clears", linesCleared);
        }

        // Calculate rollovers
        this.globalState.game!.profile.calculateRolloverOnScore(this.predictedScore);
    }
}

/**
 * If OCR does not detect a tetris board at all, end game.
 */
export class ExitEvent extends StateEvent {
    public override readonly name = "ExitEvent";
    public override readonly persistence = new ConsecutivePersistenceStrategy(10);

    /**
     * If noisy levels are high, that the board is showing is unlikely
     */
    protected override async precondition(ocrFrame: OCRFrame): Promise<boolean> {
        const noise = ocrFrame.getBoardNoise()!;
        //console.log("board noise", noise);
        return noise > NOISE_THRESHOLD;
    };

    /**
     * On reaching unrecoverable state, end game
     */
    override async triggerEvent(ocrFrame: OCRFrame): Promise<OCRStateID | undefined> {
        return OCRStateID.GAME_END;
    }

}

/**
 * If been in limbo state for too long, game is unrecoverable. End game.
 */
const COLORS_LEVEL = 138;
export class TimeoutEvent extends StateEvent {
    public override readonly name = "TimeoutEvent";
    public override readonly persistence = new TimedPersistenceStrategy(10000);

    constructor(
        private readonly globalState: GlobalState
    ) { super() }

    /**
     * No preconditions besides the persistence threshold of the limbo state reached
     * EXCEPT in colors, indefinitely in limbo
     */
    protected override async precondition(ocrFrame: OCRFrame): Promise<boolean> {
        return this.globalState.game!.getStatus().level < COLORS_LEVEL;
    };

    /**
     * On reaching unrecoverable state, end game
     */
    override async triggerEvent(ocrFrame: OCRFrame): Promise<OCRStateID | undefined> {
        return OCRStateID.GAME_END;
    }
}


/**
 * Immediately onto transition into the config's level cap, transition into GAME_END
 */
export class LinecapEvent extends StateEvent {
    public override readonly name = "LinecapEvent";
    public override readonly persistence = new SingleFramePersistenceStrategy()

    constructor(
        private readonly config: OCRConfig,
        private readonly globalState: GlobalState
    ) { super(); }


    protected override async precondition(ocrFrame: OCRFrame): Promise<boolean> {

        // If no level cap is set, this event will not trigger
        if (!this.config.levelCap) return false;

        // Return whether the level has met or exceeded the cap
        return (this.globalState.game?.getStatus().level ?? 0) >= this.config.levelCap;
    }

    // Level cap reached means game over
    override async triggerEvent(ocrFrame: OCRFrame): Promise<OCRStateID | undefined> {
        this.globalState.game!.linecapReached();
        return OCRStateID.GAME_END;
    }
}