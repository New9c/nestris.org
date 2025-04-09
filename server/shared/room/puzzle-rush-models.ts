import { ClientRoomEvent, RoomState, RoomType } from "./room-models";
import { RushPuzzle } from "../puzzles/db-puzzle";
import { TrophyDelta } from "./multiplayer-room-models";

// Client-to-server: send ready, send submit, send game end (with pps)

export enum PuzzleRushPlayerStatus {
    NOT_READY = "NOT_READY",
    READY = "READY",
    ENDED = "ENDED",
    REMATCH = "REMATCH",
}

export interface PuzzleRushPlayer {
    userid: string;
    username: string;
    highestTrophies: number;
    battleElo: number;
    progress: boolean[]; // for each puzzle attempted, add true/false based on whether it was solved
    currentPuzzleID: string; // current ongoing puzzle for the player
    status: PuzzleRushPlayerStatus;
}


export enum PuzzleRushStatus {
    BEFORE_GAME = 'BEFORE_GAME',
    DURING_GAME = 'DURING_GAME',
    AFTER_GAME = 'AFTER_GAME',
    ABORTED = 'ABORTED'
}

export interface PuzzleRushAttempt {
    current?: number;
    next?: number;
}

export interface PuzzleRushRoomState extends RoomState {
    type: RoomType.PUZZLE_RUSH | RoomType.PUZZLE_BATTLES,

    status: PuzzleRushStatus;
    players: PuzzleRushPlayer[];
    trophyDeltas: TrophyDelta[] | null, // null if not rated

    duration: number; // in seconds
    strikes: number; // how many incorrect puzzles = death

    stats?: { label: string, value: string[] }[]; // post-match display-ready stats for each player
    puzzleSet?: RushPuzzle[]; // answer key
    attempts?: PuzzleRushAttempt[][]; // player attempts
}

// number of correct puzzles (number of true elements in progress array)
export function puzzleRushScore(player: PuzzleRushPlayer) {
    return player.progress.filter(attempt => attempt).length;
}

// number of incorrect puzzles (number of false elements in progress array)
export function puzzleRushIncorrect(player: PuzzleRushPlayer) {
    return player.progress.filter(attempt => !attempt).length;
}

export enum PuzzleRushEventType {
    READY = 'READY',
    ATTEMPT = 'ATTEMPT',
    TIMEOUT = 'TIMEOUT',
    REMATCH = 'REMATCH',
}

export interface PuzzleRushAttemptEvent extends ClientRoomEvent {
    type: PuzzleRushEventType.ATTEMPT;
    current?: number; // first placement int2, if submitted
    next?: number; // second placement int2, if submitted
}