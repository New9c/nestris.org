// Strategy for calculating XP gained for some score
export interface XPStrategy {
    (score: number): number;
}

/**
 * Strategy for calculating XP gained for a solo game
 * @param score 
 * @returns 
 */
export const soloXPStrategy: XPStrategy = (score: number) => {
    // https://www.desmos.com/calculator/g5tyne6y40
    return Math.round(Math.pow(score / 20000, 1.6));
};

export function xpOnPuzzleSolve(puzzleElo: number) {
    return Math.floor(puzzleElo / 1000) + 1;
}