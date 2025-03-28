import { randomInt } from "crypto";
import { Keybind } from "../../shared/emulator/keybinds";
import { InputSpeed } from "../../shared/models/input-speed";
import MoveableTetromino from "../../shared/tetris/moveable-tetromino";
import { TetrisBoard } from "../../shared/tetris/tetris-board";
import { TetrominoType } from "../../shared/tetris/tetromino-type";
import { TETROMINO_CHAR } from "../../shared/tetris/tetrominos";
import { getGravity } from "../../shared/tetris/gravity";

export interface Placement {
    inputFrameTimeline: string; // i.e X..X., the timeline of inputs to make that is passed into SR, and should be used to determine inputs
    shiftMap: ShiftMap | null; // a map of frame index to the keybinds to press at that frame
    computed: boolean; // whether the placement was already computed, or still awaiting engine response
}

export interface AIPlacement {
    placement: MoveableTetromino | null,
    bestEval: number,
    playerEval: number,
}

export interface AIConfig {
    inputSpeed: InputSpeed;
    inaccuracy: number; // inaccuracy chance per placement
    mistake: number; // mistake chance per placement
    misdrop: number; // misdrop chance per placement
}

export interface ShiftMap {
    map: Map<number, Keybind[]>,
    startPushdownFrame?: number
}

export const DEFAULT_SHIFT_MAP: ShiftMap = {
    map: new Map()
}


/**
 * Handles generating the placements for each position in the game, and the move sequence for each placement.
 */
export abstract class PlacementAI {

    // A map of placement index to the placement data
    readonly placements = new Map<number, Placement>();

    readonly spawnDelay = randomInt(0, 150);

    constructor(
        protected readonly config: AIConfig,
        private onPlacementComputed: (placement: AIPlacement) => void = () => { }
    ) {}

    // Generates a series of X and . characters to represent the input frame timeline. Can be random or deterministic.
    protected abstract generateInputFrameTimeline(): string;

    public abstract computePlacement(
        board: TetrisBoard,
        current: TetrominoType,
        next: TetrominoType | null,
        level: number,
        lines: number,
        inputFrameTimeline: string,
        isInaccuracy: boolean,
        isMistake: boolean,
        isFirst: boolean,
    ): Promise<AIPlacement>;

    /**
     * Compute the shift map for a given input frame timeline and the lock placement
     * @param inputFrameTimeline The input frame timeline to compute the shift map for
     * @param move The lock placement to compute the shift map for
     */
    protected abstract computeShiftMap(inputFrameTimeline: string, lockPlacement: MoveableTetromino, isMisdrop: boolean): ShiftMap;

    public randomError(level: number): { isMisdrop: boolean, isMistake: boolean, isInaccuracy: boolean } {

        let multiplier: number = 0.75;
        let gravity = getGravity(level);
        if (gravity === 3) multiplier = 1;
        else if (gravity === 2) multiplier = 2;
        else if (gravity === 1) multiplier = 2.5;

        const isMisdrop = Math.random() < this.config.misdrop * multiplier;
        const isMistake = !isMisdrop && Math.random() < this.config.mistake * multiplier;
        const isInaccuracy = !isMisdrop && !isMistake && Math.random() < this.config.inaccuracy * multiplier;
        return { isMisdrop, isMistake, isInaccuracy };
    }

    /**
     * Register the board state and current and next pieces for a given placement index, to initiate
     * the process of computing the move sequence for that placement.
     */
    public registerPlacementPosition(index: number, board: TetrisBoard, current: TetrominoType, next: TetrominoType | null, level: number, lines: number) {
        
        // Generate the input frame timeline for this placement
        const inputFrameTimeline = this.generateInputFrameTimeline();

        // Assert timeline is only X and . characters
        if (!inputFrameTimeline.match(/^[X.]+$/)) {
            throw new Error(`Invalid input frame timeline: ${inputFrameTimeline}`);
        }

        console.log(`Registering placement at index ${index} with pieces ${TETROMINO_CHAR[current]} ${next === null ? 'nnb' : TETROMINO_CHAR[next]} timeline ${inputFrameTimeline}`);

        // Create the initial placement result with default of no shifts
        this.placements.set(index, { inputFrameTimeline, shiftMap: null, computed: false });

        const { isMisdrop, isInaccuracy, isMistake } = this.randomError(level);

        // Compute the placement for this position
        this.computePlacement(board, current, next, level, lines, inputFrameTimeline, isInaccuracy, isMistake, index === 0).then(move => {

            // Update the placement with the computed shifts
            const placement = this.placements.get(index);
            if (!placement) throw new Error(`Placement at index ${index} not found`);
            placement.shiftMap = move.placement === null ? DEFAULT_SHIFT_MAP : this.computeShiftMap(inputFrameTimeline, move.placement, isMisdrop);
            //console.log(`Computed shift map for placement at index ${index}: ${Array.from(placement.shiftMap.entries()).map(([frame, keybinds]) => `${frame}: ${keybinds.map(keybind => keybind).join(' ')}`).join(', ')}`);

            if (isMisdrop) move.playerEval = move.bestEval - 20;

            // Call the callback
            this.onPlacementComputed(move);
        });
    }

    /**
     * Get what keybind to press for a given placement index and frame index.
     * @param placementIndex The index of the placement to get the input for.
     * @param frameIndex The index of the frame to get the input for.
     * @returns The keybind to press for the given placement and frame, or null for no input.
     */
    public getInputForPlacementAndFrame(placementIndex: number, frameIndex: number): Keybind[] {

        // On first placement, delay moving the first piece by a human-random amount
        if (placementIndex === 0) frameIndex -= this.spawnDelay;

        // Return the keybinds to press for the given frame index
        const shiftMap = this.placements.get(placementIndex)?.shiftMap;
        const keybinds = shiftMap?.map.get(frameIndex) ?? [];

        // Push down keybind
        if (shiftMap?.startPushdownFrame && frameIndex > shiftMap.startPushdownFrame) keybinds.push(Keybind.PUSHDOWN);
        return keybinds
    }

}