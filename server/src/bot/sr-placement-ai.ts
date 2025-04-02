import { Keybind } from "../../shared/emulator/keybinds";
import MoveableTetromino from "../../shared/tetris/moveable-tetromino";
import { TetrisBoard } from "../../shared/tetris/tetris-board";
import { TetrominoType } from "../../shared/tetris/tetromino-type";
import { getTopMovesHybrid } from "../scripts/stackrabbit";
import { AIPlacement, PlacementAI, ShiftMap } from "./placement-ai";
import { TopMovesHybridResponse } from "../../shared/scripts/stackrabbit-decoder";
import { randomChoice, randomInt, weightedRandomChoice } from "../../shared/scripts/math";
import { INPUT_SPEED_TO_TIMELINE, InputSpeed } from "../../shared/models/input-speed";
import { calculatePlacementScore, rescaleStackrabbitEval } from "../../shared/evaluation/evaluation";


export class SRPlacementAI extends PlacementAI {

    public override generateInputFrameTimeline(): string {
        return INPUT_SPEED_TO_TIMELINE[this.config.inputSpeed];

    }

    public override async computePlacement(
        board: TetrisBoard,
        current: TetrominoType,
        next: TetrominoType | null,
        level: number,
        lines: number,
        inputFrameTimeline: string,
        isInaccuracy: boolean,
        isMistake: boolean,
        isFirst: boolean,
    ): Promise<AIPlacement> {

        if (next === null) throw new Error("Next piece must be provided for SRPlacementAI");

        const noPlacement: AIPlacement = {
            placement: null,
            bestEval: 10,
            playerEval: 0,
        }
        
        // Try to get the top move from stackrabbit
        let stackrabbit: TopMovesHybridResponse;
        try {
            // Disable tucks: tucks not supported with shift map yet
            stackrabbit = await getTopMovesHybrid(board, current, next, Math.max(level, 18), lines, inputFrameTimeline, 1, true);
        } catch (e) {
            // No placement found
            return noPlacement;
        }

        if (stackrabbit.nextBox.length === 0) return noPlacement;

        
        const bestEval = stackrabbit.nextBox[0].score;

        if (isFirst) {
            const index = randomInt(0, stackrabbit.nextBox.length - 1);
            return {
                placement: stackrabbit.nextBox[index].firstPlacement,
                bestEval: bestEval,
                playerEval: stackrabbit.nextBox[index].score
            }
        }

        // If inaccuracy or mistake, pick move closest to some random amount lower than bestEval
        if (isInaccuracy || isMistake) {
            const diff = isMistake ? randomInt(10, 20) : randomInt(4, 8);
            const normTarget = rescaleStackrabbitEval(bestEval) - (rescaleStackrabbitEval(diff) - rescaleStackrabbitEval(0));
            const distance = (placementScore: number) => Math.abs(rescaleStackrabbitEval(placementScore) - normTarget);

            let closestPlacement = stackrabbit.nextBox[0];
            for (let placement of stackrabbit.nextBox) {
                if (distance(placement.score) < distance(closestPlacement.score)) {
                    closestPlacement = placement;
                }
            }

            return {
                placement: closestPlacement.firstPlacement,
                bestEval: bestEval,
                playerEval: closestPlacement.score
            }

        }

        // Get best move
        const playerEval = bestEval - randomInt(0, 300) / 100;
        return {
            placement: stackrabbit.nextBox[0].firstPlacement,
            bestEval: bestEval,
            playerEval: playerEval,
        }

        // Get a weighted random move from top moves based on score. The better the move, the more likely it is to be chosen.
        //const lowestEval = stackrabbit.nextBox[stackrabbit.nextBox.length - 1].score;
        //return weightedRandomChoice(stackrabbit.nextBox, stackrabbit.nextBox.map(move => Math.pow(move.score - lowestEval, 2))).firstPlacement;   
        
    }

    protected override computeShiftMap(inputFrameTimeline: string, lockPlacement: MoveableTetromino, isMisdrop: boolean): ShiftMap {
        
        // Calculate the number of frames to shift, where sign indicates direction
        const spawnPiece = MoveableTetromino.fromSpawnPose(lockPlacement.tetrominoType);
        const numShifts = Math.abs(lockPlacement.getTranslateX() - spawnPiece.getTranslateX());
        const shiftDirection = lockPlacement.getTranslateX() > spawnPiece.getTranslateX() ? Keybind.SHIFT_RIGHT : Keybind.SHIFT_LEFT;

        // Calculate rotation
        const spawnRotation = spawnPiece.getRotation();
        const lockRotation = lockPlacement.getRotation();
        let numRotations = (lockRotation - spawnRotation + 4) % 4;
        let rotationDirection = Keybind.ROTATE_RIGHT;
        if (numRotations > 2) {
            numRotations = 4 - numRotations;
            rotationDirection = Keybind.ROTATE_LEFT;
        }

        const shiftMap = new Map<number, Keybind[]>();
        const addInputAtFrame = (frame: number, keybind: Keybind) => {
            if (!shiftMap.has(frame)) shiftMap.set(frame, []);
            shiftMap.get(frame)!.push(keybind);
        }

        let frameIndex = 0;
        let timelineIndex = 0;
        let currentShifts = 0;
        let currentRotations = 0;

        while (currentShifts < numShifts || currentRotations < numRotations) {

            // Able to input at this frame
            if (inputFrameTimeline[timelineIndex] === 'X') {

                // Rotate if needed
                if (currentRotations < numRotations) {
                    addInputAtFrame(frameIndex, rotationDirection);
                    currentRotations++;
                }

                // Shift
                if (currentShifts < numShifts) {
                    addInputAtFrame(frameIndex, shiftDirection);
                    currentShifts++;
                }
            }

            // Increment timeline index mod length
            timelineIndex = (timelineIndex + 1) % inputFrameTimeline.length;

            // Go to next frame
            frameIndex++;
        }

        // If dice roll results in misdrop, add an extra shift or rotation somewhere within the inputs
        if (isMisdrop) {
            const misdropIndex = randomInt(0, frameIndex + randomInt(0, 50));

            const keybind: Keybind = (
                Math.random() < 0.5 ? 
                (Math.random() < 0.5 ? Keybind.SHIFT_LEFT : Keybind.SHIFT_RIGHT) :
                (Math.random() < 0.5) ? Keybind.ROTATE_LEFT : Keybind.ROTATE_RIGHT
            );
            const existingKeybinds = shiftMap.get(misdropIndex) ?? [];
            existingKeybinds.push(keybind);
            shiftMap.set(misdropIndex, existingKeybinds);
        }

        return {
            map: shiftMap,
            startPushdownFrame: frameIndex + randomInt(40, 200)
        }

    }

}