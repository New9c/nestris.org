import { NextButton, PuzzleSolution, PuzzleStrategy, UnsolvedPuzzle } from "./puzzle-strategy";
import { PuzzleStrategyType } from "./puzzle-strategy-type";
import { PuzzleSubmission } from "src/app/models/puzzles/puzzle";
import { computeEngineMoves } from "./compute-engine-moves";
import { StackrabbitService } from "src/app/services/stackrabbit/stackrabbit.service";
import { AnalyticsService } from "src/app/services/analytics.service";
import { GeneratePuzzlesService, LocalPuzzle } from "src/app/services/generate-puzzles.service";
import { PuzzleError } from "../play-puzzle-page.component";
import { PuzzleRating } from "src/app/shared/puzzles/puzzle-rating";
import { PuzzleTheme } from "src/app/shared/puzzles/puzzle-theme";

export class GeneratedPuzzleStrategy extends PuzzleStrategy {
  public readonly type = PuzzleStrategyType.GENERATED;
  public readonly isTimed = false;
  private generationService = this.injector.get(GeneratePuzzlesService);
  private stackrabbitService = this.injector.get(StackrabbitService);
  private analyticsService = this.injector.get(AnalyticsService);

  private puzzles!: LocalPuzzle[];
  private puzzleIndex: number = -1;

  public override async init(): Promise<void> {
    this.analyticsService.sendEvent("generated-puzzles");
    this.puzzles = this.generationService.getPuzzles();
    if (this.puzzles.length === 0) throw new PuzzleError("There was an error displaying the generated puzzles!");
  }

  public override getNextButton(): NextButton {
    if (this.puzzleIndex >= this.puzzles.length - 1)return { hasNext: false, text: "Back to analysis" };
    return { hasNext: true, text: "Next Puzzle"};
  }

  public override getDisplayName(): string {
    const puzzle = this.puzzles[this.puzzleIndex];
    return `(${this.puzzleIndex+1}/${this.puzzles.length}) Level ${puzzle.level} at ${puzzle.lines} lines`;
  }

  public override getPuzzleRating(): PuzzleRating | null { return this.puzzles[this.puzzleIndex].rating; }
  public override getTheme(): PuzzleTheme | null { return this.puzzles[this.puzzleIndex].theme; }
  

  public async fetchNextPuzzle(): Promise<UnsolvedPuzzle> {

    // Go to next puzzle
    this.puzzleIndex++;
    const puzzle = this.puzzles[this.puzzleIndex];

    return puzzle;
  }

  // Calculate engine moves client-side and return them
  public async submitPuzzle(puzzleID: string, submission: PuzzleSubmission): Promise<{
    solution: PuzzleSolution,
    xpGained?: number
  }> {

    const puzzle = this.puzzles.find(p => p.puzzleID === puzzleID);
    if (!puzzle) throw new PuzzleError("Puzzle not found!");
    
    return { solution : {
      rating: puzzle.rating,
      moves: await computeEngineMoves(this.stackrabbitService, puzzleID, puzzle.level),
    }} 
  }
}