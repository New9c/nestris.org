import { MemoryGameStatus, StatusSnapshot } from "../shared/tetris/memory-game-status";


const GREAT_GAME = [
    "That was a masterclass in stacking!",
    "Impressive moves - you made it look easy!",
    "Perfection from start to finish.",
    "Flawless - pure perfection.",
    "A truly impressive performance!",
    "You played like a champion!",
]

const GOOD_GAME = [
    "A solid performance with flashes of brilliance.",
    "A clean and well-executed game.",
    "A balanced game with some great moves.",
    "A well-played game with strong fundamentals!",
    "Consistent, controlled, and fun to watch!",
]

const DECENT_GAME = [
    "A respectable performance - keep stacking!",
    "A solid game from start to finish.",
    "Solid stacking! You're getting better.",
    "Good job! You've got the basics down.",
    "That was a smooth game - keep it up!",
    "Well done! A steady and solid game.",
]


const ROLLERCOASTER = [
    "What a rollercoaster of a game!",
    "A nail-biter from start to finish!",
    "A chaotic game, but you made it work!",
    "You had us all on the edge of our seats!",
    "Unpredictable, exciting, and full of surprises!",
    "Total chaos, but somehow, you made it work!",
]

const BAD_TO_GOOD = [
    "It started rough, but you clutched it in the end!",
    "A shaky start, but what a comeback!",
    "You clawed your way back!",
    "That comeback was nothing short of legendary!",
    "A rough beginning, but you finished strong!",
    "Talk about a redemption arc!",
]
  
const BAD_ENDING = [
    "It was all going so well until disaster struck.",
    "An incredible game with a bittersweet ending.",
    "Great game, tragic ending.",
    "A tough break at the end, but an impressive game!",
    "You were on fire... right up until the last moment.",
]

const BAD_GAME = [
    "Sometimes the blocks just don't cooperate.",
    "Hey, even the best players have off days!",
    "Chin up! Next game will be better.",
    "It happens! Just shake it off and try again.",
    "That was a tough one, but you've got this!",
    "Even the pros get bad RNG sometimes.",
    "Don't worry, you'll get 'em next time!",
];

const REALLY_BAD_GAME = [
    "That one was rough - but everyone starts somewhere!",
    "Hey, at least you're having fun… right?",
    "We all have games we'd rather forget!",
    "Think of it as a practice round!",
    "A tough game just means a great comeback is coming!",
    "Shake it off and show 'em what you can really do!",
];

  
const EARLY_TOPOUT = [
    "Well, that escalated quickly.",
    "Sometimes the blocks have other plans!",
    "Oops. Let's try that again!",
    "We'll call that a practice round!",
    "That was the fastest game ever - maybe too fast!",
]

const ONE_LINE_29 = [
    "One line down, many more to go!",
    "It's better than club zero, I guess.",
    "Slow and steady... maybe too slow?",
]

const BAD_29 = [
    "You managed to hang on for a moment.",
    "A fair attempt at such a brutal speed.",
    "Not quite a long run, but still a decent effort!",
    "You held on for a bit!",
]

const MID_29 = [
    "Not bad! You held on longer than most.",
    "You did well to survive that long.",
    "You’re getting the hang of this!",  
]

const GOOD_29 = [
    "You’re a natural at this!",
    "You made it look easy!",
]

const GREAT_29 = [
    "Are you an auto-clicker?",
    "Perfection from start to finish.",
    "Flawless execution at lightning speed!",
    "Your hands are moving at light speed!",
    "That was pure muscle memory in action!",
]


// Helper function to get a random element from an array
const random = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

/**
 * Get feedback based on how the player performed in the game
 * @param score Final score of the game
 * @param previousBest Previous best score of the player
 * @param history History of the game status across the game
 */
export function getFeedback(status: MemoryGameStatus, previousBestScore: number, previousBestLines: number): string {

    previousBestLines = Math.min(previousBestLines, 250);

    // level 29 start is a special case
    if (status.startLevel >= 29) {

        if (status.lines === 1 && Math.random() < 0.5) return random(ONE_LINE_29);
        if (status.lines < 3) return random(EARLY_TOPOUT);
        if (status.lines < 5) return random(BAD_29);
        if (status.lines < 10) return random(MID_29);
        if (status.lines < 30) return random(GOOD_29);
        return random(GREAT_29);
    }

    const history = status.getHistory();

    const getTetrisRateWithCondition = (condition: (snapshot: StatusSnapshot) => boolean) => {
        const snapshots = [];
        for (let i = 0; i < history.length(); i++) {
            const snapshot = history.getSnapshot(i);
            if (condition(snapshot)) snapshots.push(snapshot);
        }
        if (snapshots.length === 0) return 0;

        // Get average tetris rate of snapshots
        const tetrisRates = snapshots.map(snapshot => snapshot.tetrisRate);
        return tetrisRates.reduce((a, b) => a + b) / tetrisRates.length;
    }

    const allTetrisRates = [];
    for (let i = 0; i < history.length(); i++) {
        const snapshot = history.getSnapshot(i);
        allTetrisRates.push(snapshot.tetrisRate);
    }
    console.log("all TRT", allTetrisRates);
    console.log("highest lines", previousBestLines);
    console.log("trt", status.getTetrisRate());

    // If lines is too low, it's an early topout
    if (status.lines < Math.max(Math.min(previousBestLines, 200) / 3, 20)) return random(EARLY_TOPOUT);

    // Games are guaranteed to have at least 30 lines

    // If score is close to previous best lines and good TRT, it's a great game
    if (status.lines >= Math.max(previousBestLines, 50) * 0.8) {
        if (status.getTetrisRate() >= 0.75) return random(GREAT_GAME);
        if (status.getTetrisRate() >= 0.5) return random(GOOD_GAME);
    }

    if (status.score >= previousBestScore * 0.9) return random(GREAT_GAME);
    if (status.score >= previousBestScore * 0.7) return random(GOOD_GAME);


    const fullTetrisRate = status.getTetrisRate();
    if (fullTetrisRate < 0.2) return random(REALLY_BAD_GAME);
    if (fullTetrisRate < 0.35 || status.lines < previousBestLines / 2) return random(BAD_GAME);

    
    if (status.lines > 50) {

        // Calculate early and late tetris rate by averaging early snapshots
        const earlyTetrisRate = getTetrisRateWithCondition(snapshot => snapshot.lines < Math.min(status.lines / 4, 30));
        const midTetrisRate = getTetrisRateWithCondition(snapshot => snapshot.lines > status.lines / 3 && snapshot.lines < status.lines * 2 / 3);
        const lateTetrisRate = getTetrisRateWithCondition(snapshot => snapshot.lines > Math.max(status.lines * 3 / 4, status.lines - 30));
        console.log("Early, mid, late TRT", earlyTetrisRate, midTetrisRate, lateTetrisRate);

        if (earlyTetrisRate < 0.25 && midTetrisRate > 0.4 && lateTetrisRate > 0.5) return random(BAD_TO_GOOD);
        if (earlyTetrisRate > 0.4 && midTetrisRate > 0.4 && lateTetrisRate < 0.25) return random(BAD_ENDING);
    }

    // Check if tetris rates bounce between high and low many times, iterating over allTetrisRates
    let bounceCount = 0;
    let low = false;
    let high = false;
    for (let i = 0; i < allTetrisRates.length; i++) {
        if (allTetrisRates[i] < 0.3) {
            if (high) {
                bounceCount++;
                high = false;
            }
            low = true;
        } else if (allTetrisRates[i] > 0.75) {
            if (low) {
                bounceCount++;
                low = false;
            }
            high = true;
        }
    }
    console.log("Bounce count", bounceCount);
    if (bounceCount >= 5) return random(ROLLERCOASTER);

    if (fullTetrisRate > 0.5 && status.lines > previousBestLines * 2/3) return random(GOOD_GAME);
    return random(DECENT_GAME);
}

