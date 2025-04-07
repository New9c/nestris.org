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
    // https://www.desmos.com/calculator/fcwni9mptv
    return Math.ceil(Math.pow(puzzleElo / 1000, 1.7));
}

export function xpOnPuzzleRush(score: number) {
    // https://www.desmos.com/calculator/tanutygwyj
    // Grows slower than solving puzzles early on, but on high scores grows faster
    return Math.ceil(2 * Math.pow(score / 5, 2));
}