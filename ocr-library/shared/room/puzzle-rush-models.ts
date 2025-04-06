import { RoomState, RoomType } from "./room-models";

// Client-to-server: send ready, send submit, send game end (with pps)

export interface PuzzleRushPlayer {
    userid: string;
    username: string;
    highestTrophies: number;
    puzzleElo: number;
    progress: boolean[]; // for each puzzle attempted, add true/false based on whether it was solved
    currentPuzzleID: string; // current ongoing puzzle for the player
}

export enum PuzzleRushStatus {
    BEFORE_GAME = 'BEFORE_GAME',
    DURING_GAME = 'DURING_GAME',
    AFTER_GAME = 'AFTER_GAME'
}

export interface PuzzleRushRoomState extends RoomState {
    type: RoomType.PUZZLE_RUSH | RoomType.PUZZLE_BATTLES,

    status: PuzzleRushStatus;
    players: PuzzleRushPlayer[];
}

// number of correct puzzles (number of true elements in progress array)
export function puzzleRushScore(player: PuzzleRushPlayer) {
    return player.progress.filter(attempt => attempt).length;
}