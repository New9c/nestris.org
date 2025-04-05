import { PuzzleSubmission } from "src/app/models/puzzles/puzzle";
import { EngineMove, NextButton, PuzzleSolution, PuzzleStrategy, UnsolvedPuzzle } from "./puzzle-strategy";
import { PuzzleStrategyType } from "./puzzle-strategy-type";
import { DBPuzzle } from "src/app/shared/puzzles/db-puzzle";
import { FetchService, Method } from "src/app/services/fetch.service";
import { WebsocketService } from "src/app/services/websocket.service";
import { RatedPuzzleResult, RatedPuzzleSubmission, UnsolvedRatedPuzzle } from "src/app/shared/puzzles/rated-puzzle";
import MoveableTetromino from "src/app/shared/tetris/moveable-tetromino";
import { decodePuzzleSolution } from "./decode-puzzle-solution";
import { xpOnPuzzleSolve } from "src/app/shared/nestris-org/xp-system";
import { AnalyticsService } from "src/app/services/analytics.service";
import { PuzzleRating } from "src/app/shared/puzzles/puzzle-rating";
import { PuzzleTheme } from "src/app/shared/puzzles/puzzle-theme";

export class RatedPuzzleStrategy extends PuzzleStrategy {
  public readonly type = PuzzleStrategyType.RATED;
  public readonly isTimed = true;

  private fetchService = this.injector.get(FetchService);
  private websocketService = this.injector.get(WebsocketService);
  private analyticsService = this.injector.get(AnalyticsService);

  private currentPuzzle?: DBPuzzle;
  private startTime = Date.now();

  private eloHistory: number[] = [];

  public override getNextButton(): NextButton {
    return {hasNext: true, text: "Next Puzzle"};
  }

  public override getDisplayName(): string {
    return "Rated Puzzle";
  }

  public override async fetchNextPuzzle(): Promise<UnsolvedPuzzle> {

    // Fetch the next puzzle from the server
    const sessionID = this.websocketService.getSessionID();
    const puzzle = await this.fetchService.fetch<UnsolvedRatedPuzzle>(Method.POST, `/api/v2/rated-puzzle/request/${sessionID}`);

    // If elo history is empty, set initial value
    if (this.eloHistory.length === 0) {
      this.eloHistory.push(puzzle.startElo);
    }

    this.startTime = Date.now();

    return {
      puzzleID: puzzle.id,
      level: 18, // Rated puzzles always start at level 18
      eloChange: {
        startElo: puzzle.startElo,
        eloGain: puzzle.eloGain,
        eloLoss: puzzle.eloLoss,
      }
    };
  }

  // Submit the user's solution to the server and return the engine's recommendations
  public override async submitPuzzle(puzzleID: string, submission: PuzzleSubmission): Promise<{
    solution: PuzzleSolution,
    xpGained?: number
  }> {

    const ratedPuzzleSubmission: RatedPuzzleSubmission = {
      puzzleID: puzzleID,
      seconds: (Date.now() - this.startTime) / 1000,
      current: submission.firstPiece?.getInt2(),
      next: submission.secondPiece?.getInt2()
    };

    // Submit the user's solution to the server
    const { puzzle: dbPuzzle, newElo, xpGained, isCorrect } = await this.fetchService.fetch<RatedPuzzleResult>(Method.POST, `/api/v2/rated-puzzle/submit`, ratedPuzzleSubmission);
    this.currentPuzzle = dbPuzzle;

    // update the user's elo history
    this.eloHistory.push(newElo);

    this.analyticsService.sendEvent("play-puzzle", { correct : isCorrect });

    // Convert dbPuzzle to puzzle solution
    return {
      solution: decodePuzzleSolution(dbPuzzle),
      xpGained,
    };
  }

  public getRatedPuzzle(): DBPuzzle {
    return this.currentPuzzle!;
  }

  public getEloHistory(): number[] {
    return this.eloHistory;
  }

  public override getPuzzleRating(): PuzzleRating | null { return this.currentPuzzle!.rating; }
    public override getSuccessRate(): number | null {
      const puzzle = this.currentPuzzle!;
      return puzzle.num_attempts === 0 ? null : puzzle.num_solves / puzzle.num_attempts;
    }
    public override getNumAttempts(): number | null { return this.currentPuzzle!.num_attempts; }
    public override getTheme(): PuzzleTheme | null { return this.currentPuzzle!.theme; }
}