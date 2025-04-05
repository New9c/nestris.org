import { ParamMap } from "@angular/router";
import MoveableTetromino from "src/app/shared/tetris/moveable-tetromino";
import { PuzzleStrategyType } from "./puzzle-strategy-type";
import { PuzzleSubmission } from "src/app/models/puzzles/puzzle";
import { StackrabbitService } from "src/app/services/stackrabbit/stackrabbit.service";
import { PuzzleRating } from "src/app/shared/puzzles/puzzle-rating";
import { Injector } from "@angular/core";
import { PuzzleTheme } from "src/app/shared/puzzles/puzzle-theme";

// Rated puzzles result in an elo change
export interface EloChange {
  startElo: number;
  eloGain: number;
  eloLoss: number;
}

// An unsolved puzzle is defined by its board, pieces, level, and possible elo change
export interface UnsolvedPuzzle {
  puzzleID: string; // encoded board and pieces
  level: number; // defaults to 18
  eloChange?: EloChange;
}

// One of the five recommendations by the engine
export interface EngineMove {
  firstPlacement: MoveableTetromino;
  secondPlacement: MoveableTetromino;
  score: number;
  guesses?: number;
}

export interface PuzzleSolution {
  moves: EngineMove[];
  rating: PuzzleRating;
}

export interface NextButton {
  hasNext: boolean;
  text: string;
  
}

export abstract class PuzzleStrategy {
  public abstract readonly type: PuzzleStrategyType;

  // Whether the puzzle is timed (30 seconds)
  public abstract readonly isTimed: boolean;

   constructor(
    protected readonly injector: Injector,
    protected readonly paramMap: ParamMap, // The parameters of the current route
   ) {}

  public async init(): Promise<void> {}

  public getPuzzleRating(): PuzzleRating | null { return null; }
  public getSuccessRate(): number | null { return null; }
  public getNumAttempts(): number | null { return null; }
  public getTheme(): PuzzleTheme | null { return null; }

  // What should be displayed on the button to go to the next puzzle, or undefined if button should redirect home
  public abstract getNextButton(): NextButton;

   // The name of the puzzle, e.g. "Shared Puzzle"
  public abstract getDisplayName(): string;

  // Gets the next (or first) puzzle
  public abstract fetchNextPuzzle(): Promise<UnsolvedPuzzle>;

  // Submits the user's solution to the puzzle, returning the engine's recommendations
  public abstract submitPuzzle(puzzleID: string, submission: PuzzleSubmission): Promise<{
    solution: PuzzleSolution,
    xpGained?: number
  }>;
}