import { InputSpeed } from "../../shared/models/input-speed";
import { average, standardDeviation } from "../../shared/scripts/math";
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

        // Make placement
        const placement = await bot.computePlacement(board, current, next, status.level, status.lines, bot.generateInputFrameTimeline());
        const isMisdrop = Math.random() < config.misdrop;
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
            average(games.map(game => game.level)),
            average(games.map(game => game.lines)),
            average(games.map(game => game.score))
        ),
        variance: new GameStatus(
            standardDeviation(games.map(game => game.level)),
            standardDeviation(games.map(game => game.lines)),
            standardDeviation(games.map(game => game.score))
        )
    }
    
}

export async function runBotSimulations() {
    const config: AIConfig = { inputSpeed: InputSpeed.HZ_10, inaccuracy: 0.3, misdrop: 0.01 };
  const stats = await simulateBotAveraged(18, config, 3);
  console.log(config, stats);
}

type Hyperparameters = {
    inputSpeeds: InputSpeed[];
    inaccuracies: number[];
    misdrops: number[];
    simulationsPerConfig: number;
};

const defaultHyperparams: Hyperparameters = {
    inputSpeeds: [InputSpeed.HZ_6, InputSpeed.HZ_8, InputSpeed.HZ_10, InputSpeed.HZ_12, InputSpeed.HZ_14],
    inaccuracies: [0.05, 0.1, 0.2, 0.3],
    misdrops: [0.005, 0.01, 0.03],
    simulationsPerConfig: 3
};

const defaultHyperparams2: Hyperparameters = {
    inputSpeeds: [InputSpeed.HZ_10],
    inaccuracies: [0.1, 0.2],
    misdrops: [0.02],
    simulationsPerConfig: 3
};


export async function testBotHyperparameters(hyperparams: Hyperparameters = defaultHyperparams) {
    const results = [];

    for (const inputSpeed of hyperparams.inputSpeeds) {
        for (const inaccuracy of hyperparams.inaccuracies) {
            for (const misdrop of hyperparams.misdrops) {
                const config: AIConfig = { inputSpeed, inaccuracy, misdrop };
                const stats = await simulateBotAveraged(18, config, hyperparams.simulationsPerConfig);
                
                results.push({ config, stats });
                console.log(`Config:`, config, `Results:`, stats);
            }
        }
    }

    return results;
}