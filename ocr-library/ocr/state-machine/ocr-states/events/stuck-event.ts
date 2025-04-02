import { StateEvent } from "../../ocr-state";
import { PieceDroppingState } from "../states/during-game-state";
import { TimedPersistenceStrategy } from "../../persistence-strategy";
import { OCRFrame } from "../../ocr-frame";
import { OCRStateID } from "../ocr-state-id";
import { TetrisBoard } from "src/app/shared/tetris/tetris-board";

/**
 * When the board is the exact the same for a while, trigger immediate game end
 */
export class StuckEvent extends StateEvent {
    public override readonly name = "StuckEvent";
    public override readonly persistence = new TimedPersistenceStrategy(3000);

    private previousBoard = new TetrisBoard();

    /**
     * If the active piece found in an earlier frame does not show up again for a long time, or if the
     * active piece doesn't show up at all for a long time since the piece started dropping, then it is confused.
     */
    protected override async precondition(ocrFrame: OCRFrame): Promise<boolean> {

        const currentBoard = ocrFrame.getBinaryBoard()!;
        const isSame = this.previousBoard.equals(currentBoard);
        this.previousBoard = currentBoard;

        return isSame;
    };

    /**
     * On confusion, go to limbo
     */
    override async triggerEvent(ocrFrame: OCRFrame): Promise<OCRStateID | undefined> {
        return OCRStateID.GAME_END;
    }

}