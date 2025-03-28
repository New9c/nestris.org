import { InputSpeed } from "../../shared/models/input-speed";
import { average, median, standardDeviation } from "../../shared/scripts/math";
import GameStatus from "../../shared/tetris/game-status";
import MoveableTetromino from "../../shared/tetris/moveable-tetromino";
import { SmartGameStatus } from "../../shared/tetris/smart-game-status";
import { TetrisBoard } from "../../shared/tetris/tetris-board";
import { getRandomTetrominoType } from "../../shared/tetris/tetromino-type";
import { AIConfig } from "./placement-ai";
import { SRPlacementAI } from "./sr-placement-ai";

export async function simulateBot(startLevel: number, config: AIConfig) {
    const bot = new SRPlacementAI(config);

    const board = new TetrisBoard();
    const status = new SmartGameStatus(startLevel);
    let current = getRandomTetrominoType();
    let next = getRandomTetrominoType();

    while (true) {

        // Check for topout
        let spawnPlacement = MoveableTetromino.fromSpawnPose(current);
        if (spawnPlacement.intersectsBoard(board)) break;

        // Check for linecap
        if (status.level >= 39) break;

        // Make placement
        const { isMisdrop, isInaccuracy, isMistake } = bot.randomError(status.level);
        const placement = await bot.computePlacement(board, current, next, status.level, status.lines, bot.generateInputFrameTimeline(), isInaccuracy, isMistake, false);
        
        let finalPlacement: MoveableTetromino;
        if (!placement.placement || isMisdrop) {
            if (placement.placement && isMisdrop) {
                const originalPlacement = placement.placement.copy();
                spawnPlacement.updatePose(originalPlacement.getRotation(), originalPlacement.getTranslateX(), spawnPlacement.getTranslateY());
                
                if (Math.random() < 0.5) {
                    if (Math.random() < 0.5) spawnPlacement.moveBy(1, 0, 0);
                    else spawnPlacement.moveBy(-1, 0, 0);
                } else {
                    if (Math.random() < 0.5) spawnPlacement.moveBy(0, 1, 0);
                    else spawnPlacement.moveBy(0, -1, 0);
                }

                // If the misdrop causes piece to go out of bounds, revert misdrop
                if (!spawnPlacement.isInBoundsIgnoreTop()) spawnPlacement = MoveableTetromino.fromSpawnPose(current);

            }
            while (!spawnPlacement.isValidPlacement(board)) spawnPlacement.moveBy(0, 0, 1);
            finalPlacement = spawnPlacement;
        }
        else {
            finalPlacement = placement.placement;
        }

        // Update game state
        finalPlacement.blitToBoard(board);
        status.onLineClear(board.processLineClears());

        current = next;
        next = getRandomTetrominoType();
    }

    return status;
}

export async function simulateBotAveraged(startLevel: number, config: AIConfig, count: number) {
    const games: GameStatus[] = [];
    for (let i = 0; i < count; i++) {
        games.push(await simulateBot(startLevel, config));
    }

    return {
        average: new GameStatus(
            median(games.map(game => game.level)),
            median(games.map(game => game.lines)),
            median(games.map(game => game.score))
        ),
        variance: new GameStatus(
            standardDeviation(games.map(game => game.level)),
            standardDeviation(games.map(game => game.lines)),
            standardDeviation(games.map(game => game.score))
        )
    }
    
}

type Hyperparameters = {
    inputSpeeds: InputSpeed[];
    inaccuracies: number[];
    mistakes: number[],
    misdrops: number[];
    levels: number[];

    simulationsPerConfig: number;
};

const defaultHyperparams: Hyperparameters = {
    inputSpeeds: [InputSpeed.HZ_6, InputSpeed.HZ_8, InputSpeed.HZ_10, InputSpeed.HZ_12, InputSpeed.HZ_14, InputSpeed.HZ_17, InputSpeed.HZ_20],
    inaccuracies: [0.5, 0.3, 0.1],
    mistakes: [0.3, 0.2, 0.1, 0.05],
    misdrops: [0.05, 0.03, 0.01, 0.005, 0.001],
    levels: [18],
    simulationsPerConfig: 3,
};

// input_speeds = [6, 8, 10, 12, 14, 17, 20]
// inaccuracies = [0.5, 0.3, 0.1]
// mistakes = [0.3, 0.2, 0.1, 0.05]
// misdrops = [0.05, 0.03, 0.01, 0.005, 0.001]

const defaultHyperparams2: Hyperparameters = {
    inputSpeeds: [InputSpeed.HZ_15, 20],
    inaccuracies: [0.01],
    mistakes: [0.2],
    misdrops: [0.001, 0.0005],
    levels: [18],
    simulationsPerConfig: 3,
};


export async function testBotHyperparameters(hyperparams: Hyperparameters = defaultHyperparams) {
    const results = [];

    for (const inputSpeed of hyperparams.inputSpeeds) {
        for (const inaccuracy of hyperparams.inaccuracies) {
            for (const mistake of hyperparams.mistakes) {
                for (const misdrop of hyperparams.misdrops) {
                    for (const level of hyperparams.levels) {


                        // Don't allow slow bots that don't misdrop much, because this results in boring lineout bots
                        if (inputSpeed <= InputSpeed.HZ_8 && misdrop <= 0.01) continue;

                        // don't allow fast bots that misdrop a lot, not realistic
                        if (inputSpeed >= InputSpeed.HZ_14 && misdrop > 0.01) continue;

                        const config: AIConfig = { inputSpeed, inaccuracy, mistake, misdrop };
                        const stats = await simulateBotAveraged(level, config, hyperparams.simulationsPerConfig);
                        
                        results.push({ config: Object.assign({}, config, {startLevel: level}), stats });
                        console.log(`Config:`, config, `Results:`, stats);
                    }
                }
            }
        }
    }

    return results;
}