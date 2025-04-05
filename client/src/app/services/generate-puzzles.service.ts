import { Injectable } from '@angular/core';
import { AnalysisPlacement } from '../components/layout/game-analysis/game-interpreter';
import { BehaviorSubject, Observable } from 'rxjs';
import { StackrabbitService, TopMovesHybridResponse } from './stackrabbit/stackrabbit.service';
import { BufferTranscoder } from '../shared/network/tetris-board-transcoding/buffer-transcoder';
import { InputSpeed } from '../shared/models/input-speed';
import MoveableTetromino from '../shared/tetris/moveable-tetromino';
import { ColorType, TetrisBoard } from '../shared/tetris/tetris-board';
import { PuzzleRating, PuzzleRatingDetails } from '../shared/puzzles/puzzle-rating';
import { batchArray } from '../shared/scripts/math';
import { encodePuzzle } from '../shared/puzzles/encode-puzzle';
import { bothPlayerIndicies } from '../shared/room/multiplayer-room-models';
import { cos } from '@tensorflow/tfjs';
import { PuzzleTheme } from '../shared/puzzles/puzzle-theme';

// A local puzzle encapsulates all data for the puzzle without needing any server fetches
export interface LocalPuzzle {
  puzzleID: string; // the board, current, and next encoded into the unique puzzle id
  level: number; // level of puzzle
  lines: number;
  rating: PuzzleRating; // puzzle difficulty
  theme: PuzzleTheme;
}

// Represents the changing state as puzzles are generated for a game
interface State {
  gameID: string; // id of game to generate puzzles for
  totalPlacements: number; // Total number of placements in the game
  placementsProcessed: number; // How many of those game placements were processed for puzzles
  puzzles: LocalPuzzle[];
}


@Injectable({
  providedIn: 'root'
})
export class GeneratePuzzlesService {

  private readonly state$ = new BehaviorSubject<State | null>(null);
  private allowGenerating: boolean = true;

  constructor(
    private readonly stackrabbit: StackrabbitService,
  ) { }

  public getState$(): Observable<State | null> {
    return this.state$.asObservable();
  }

  public getPuzzles(): LocalPuzzle[] {
    const state = this.state$.getValue();
    if (!state) return [];
    return state.puzzles;
  }

  public async generatePuzzles(gameID: string, placements: AnalysisPlacement[]) {
    
    // If already generated puzzles for this game, do not regenerate but just reuse
    if (this.state$.getValue()?.gameID === gameID) {
      console.log("already generating puzzles for this game, not generating again");
      return;
    }

    this.allowGenerating = true;
    console.log("started generating puzzles");

    // Only look at placements before 29
    placements = placements.filter(placement => placement.level < 29);

    // Parse through all placements
    this.state$.next({
      gameID, totalPlacements: placements.length, placementsProcessed: 0, puzzles: []
    });

    const batchedPlacements = batchArray(placements, 9);
    for (let batch of batchedPlacements) {

      // First, evaluate all the placements in the batch
      const maybePuzzles = await Promise.all(batch.map(async placement => {
        try { return await this.evaluatePlacement(placement); }
        catch { return "something went wrong"; }
      }));

      // Filter out puzzles that don't exist
      const puzzles = maybePuzzles.filter(puzzle => typeof puzzle !== "string") as LocalPuzzle[];

      // Check if stopGenerating() interrupts this loop, if so terminate
      if (!this.allowGenerating) return;

      // Increment placements processed, and append any found puzzles
      const oldState = this.state$.getValue()!;
      this.state$.next(Object.assign({}, oldState, {
        placementsProcessed: oldState.placementsProcessed + batch.length,
        puzzles: [...oldState.puzzles, ...puzzles]
      }));
      console.log("generated placement", oldState.placementsProcessed + batch.length, "of", oldState.totalPlacements);
    }

    console.log("finished generating puzzles", this.state$.getValue());
    
  }

  public stopGenerating() {
    this.allowGenerating = false;
    console.log("stopped generating puzzles");

    // If incomplete generation, reset
    const state = this.state$.getValue();
    if (state && state.placementsProcessed < state.totalPlacements) {
      this.state$.next(null);
      console.log("cleared puzzle generation");
    }
  }

  private async getTopMovesHybrid(placement: AnalysisPlacement, board: TetrisBoard, inputSpeed: InputSpeed, depth: number = 3): Promise<TopMovesHybridResponse> {
    return await this.stackrabbit.getTopMovesHybrid({
      board,
      currentPiece: placement.current,
      nextPiece: placement.next,
      level: placement.level,
      lines: placement.lines,
      inputSpeed,
      playoutDepth: depth
    });
  }

  private async evaluatePlacement(placement: AnalysisPlacement): Promise<LocalPuzzle | string> {
    // ADAPTED from puzzle-generator/rate-puzzle.ts. Absolutely not good coding practice, but copied for the interest of time.

    const board = BufferTranscoder.decode(placement.encodedIsolatedBoard);

    // Check that board is valid
    for (let { x,y } of board.iterateMinos()) {
      if (!Object.values(ColorType).includes(board.getAt(x, y))) throw "invalid board";
    }

    const stackrabbit = await this.getTopMovesHybrid(placement, board, InputSpeed.HZ_30);
    if (stackrabbit.nextBox === null) return "no next box";

    if (stackrabbit.nextBox.length < 5) return "Less than 5 moves";
    if (stackrabbit.noNextBox.length < 5) return "Less than 5 no-next-box moves";

    // It's a good puzzle, but player already solved it
    if (stackrabbit.nextBox[0].firstPlacement.equals(MoveableTetromino.fromMTPose(placement.current, placement.placement))) {
      return "player made best move";
    }
    
    // get the board after the first move
    const boardAfterFirst = board.copy();
    stackrabbit.nextBox[0].firstPlacement.blitToBoard(boardAfterFirst);
    boardAfterFirst.processLineClears();

    const hasAnyBurn = hasBurn(board, stackrabbit.nextBox[0].firstPlacement) || hasBurn(boardAfterFirst, stackrabbit.nextBox[0].secondPlacement);
    const hasAnyTuckOrSpin = hasTuckOrSpin(board, stackrabbit.nextBox[0].firstPlacement) || hasTuckOrSpin(boardAfterFirst, stackrabbit.nextBox[0].secondPlacement);

    const bestNB = stackrabbit.nextBox[0].score;
    const bestNNB = stackrabbit.noNextBox[0].score;

    // adjustment: the best placement for the first piece, when rated as NNB move, is at least 10 points worse than best NNB
    // also, if best placement for first piece is not even considered in NNB moves, then definitely an adjustment
    const bestMoveNNBIndex = stackrabbit.noNextBox.findIndex(move => move.firstPlacement.equals(stackrabbit.nextBox![0].firstPlacement));
    const isAdjustment = bestMoveNNBIndex === -1 || (bestNNB - stackrabbit.noNextBox[bestMoveNNBIndex].score) >= 4;

    // get the diff between the top two moves. If there are less than two moves, return BAD_PUZZLE
    const diff = stackrabbit.nextBox[0].score - stackrabbit.nextBox[1].score;
    const diffNNB = stackrabbit.noNextBox[0].score - stackrabbit.noNextBox[1].score;

    // get the diff between the top and third/fourth moves. Can be used to determine how many close moves there are
    const diff3 = stackrabbit.nextBox[0].score - stackrabbit.nextBox[2].score;

    // if diff is too small, zero, or negative, return BAD_PUZZLE
    if (diff <= 3) return "Diff too small";

    // if bestNB is too low, return BAD_PUZZLE
    if (bestNB < -10) return "BestNB too low";

    // eliminate puzzles where the first placement is I-0
    if (stackrabbit.nextBox[0].firstPlacement.getTetrisNotation() === "I-0") {
      return "First placement is I-0";
    }

    // eliminate puzzles where the second placement is I-0
    if (stackrabbit.nextBox[0].secondPlacement.getTetrisNotation() === "I-0") {
      return "Second placement is I-0";
    }

    // Eliminate puzzles where 12hz SR disagrees with 30hz SR
    const stackrabbit20hz = await this.getTopMovesHybrid(placement, board, InputSpeed.HZ_12);
    if (stackrabbit.nextBox === null) throw new Error(`nextbox null`);
    if (!stackrabbit20hz.nextBox || stackrabbit20hz.nextBox.length === 0) return "12hz SR has no moves";
    if (!(
      stackrabbit.nextBox[0].firstPlacement.equals(stackrabbit20hz.nextBox[0].firstPlacement) &&
      stackrabbit.nextBox[0].secondPlacement.equals(stackrabbit20hz.nextBox[0].secondPlacement)
    )) return "12hz SR disagrees with 30hz SR";

    // if 12hz diff is less than 2.5, return BAD_PUZZLE
    const diff12hz = stackrabbit20hz.nextBox[0].score - stackrabbit20hz.nextBox[1].score;
    if (diff12hz <= 3) return "12hz diff too small";

    let rating: PuzzleRating;
    if (diff >= 30 && !isAdjustment && !hasAnyBurn && !hasAnyTuckOrSpin && diffNNB >= 10) rating = PuzzleRating.ONE_STAR;
    else if (diff >= 15 && !hasAnyTuckOrSpin && !isAdjustment) rating = PuzzleRating.TWO_STAR;
    else if (diff >= 7) rating = PuzzleRating.THREE_STAR;
    else {
      // at this point, the puzzle is 3-5 star. Use a nerfed version of SR to categorize
      // use a nerfed version of SR to determine if the puzzle is 4 or 5 star
      
      try {
        const babyrabbit = await this.getTopMovesHybrid(placement, board, InputSpeed.HZ_20, 1);
        if (babyrabbit.nextBox === null) return "no next box";

        // find the index of the best move in the babyrabbit response
        const babyRabbitIndex = babyrabbit.nextBox.findIndex(move => (
          move.firstPlacement.equals(stackrabbit.nextBox![0].firstPlacement)
          && move.secondPlacement.equals(stackrabbit.nextBox![0].secondPlacement)
        ));

        // if the best move is not in the baby rabbit response, or babyrabbit thinks the best move is worse by at least 1.5, then the puzzle is hard
        const hard = (babyRabbitIndex === -1) || (babyrabbit.nextBox[0].score - babyrabbit.nextBox[babyRabbitIndex].score >= 1.5);

        // If hard flag is set, bump the rating difficulty
        if (diff >= 5) rating = hard ? PuzzleRating.FOUR_STAR : PuzzleRating.THREE_STAR;
        else rating = hard ? PuzzleRating.FIVE_STAR : (diff >= 4 ? PuzzleRating.THREE_STAR : PuzzleRating.FOUR_STAR);

        // if third move is much worse than first move, bump the rating down
        if (rating === PuzzleRating.FIVE_STAR && diff3 > 6) rating = PuzzleRating.FOUR_STAR;
        else if (rating === PuzzleRating.FOUR_STAR && diff3 > 9) rating = PuzzleRating.THREE_STAR;

      } catch {
        return "Error in babyrabbit";
      }
    }

    if (rating <= PuzzleRating.TWO_STAR && bestNB < 10) return "BestNB too low for 1-2 star puzzles";

    // If the any move within some elo of best move is opposite burn/no-burn status as best move, return BAD_PUZZLE due to burn/no-burn deciding factor
    const BURN_ELO_DIFF = (rating <= PuzzleRating.THREE_STAR) ? 15 : 5;
    for (let i = 1; i < stackrabbit.nextBox.length; i++) {

      // If diff is greater than 5, then we can stop checking
      if (bestNB - stackrabbit.nextBox[i].score > BURN_ELO_DIFF) break;

      // Get the board after first move
      const boardAfter = board.copy();
      stackrabbit.nextBox[i].firstPlacement.blitToBoard(boardAfter);
      boardAfter.processLineClears();

      // Get the burn status of the moves
      const hasBurnMove = hasBurn(board, stackrabbit.nextBox[i].firstPlacement) || hasBurn(boardAfter, stackrabbit.nextBox[i].secondPlacement);

      // If the burn status is different, return BAD_PUZZLE
      if (hasAnyBurn !== hasBurnMove) {
        return "Burn/no-burn deciding factor";
      }
    }

    const details: PuzzleRatingDetails = {
      bestNB, diff, isAdjustment,
      hasBurn: hasAnyBurn,
      hasTuckOrSpin: hasAnyTuckOrSpin
   };

    const theme = classifyPuzzleTheme(board, details);

    // Return found puzzle
    return {
      puzzleID: encodePuzzle(board, placement.current, placement.next),
      level: placement.level,
      lines: placement.lines,
      rating,
      theme
    }
  }
}


// checks if placing the piece would clear lines and result in a burn, or if there is a delayed burn
function hasBurn(board: TetrisBoard, placement: MoveableTetromino): boolean {

  // Place the first piece
  const rightWellOpenBefore = board.isRightWellOpen();
  const boardCopy = board.copy();
  placement.blitToBoard(boardCopy);

  // If any lines were cleared, it is a burn
  const lineClears = boardCopy.processLineClears();
  if (lineClears > 0) return true;

  // check if delayed burn
  const rightWellOpenAfter = boardCopy.isRightWellOpen();
  return rightWellOpenBefore && !rightWellOpenAfter;
}

// checks if moving the piece up one row would intersect with the board, which means it's a tuck or spin
function hasTuckOrSpin(board: TetrisBoard, placement: MoveableTetromino): boolean {
  const oneHigherPlacement = new MoveableTetromino(placement.tetrominoType, placement.getRotation(), placement.getTranslateX(), placement.getTranslateY() - 1);
  if (oneHigherPlacement.intersectsBoard(board)) return true;

  // Check if any of the blocks for the placement does not have a block below it. This means it's a tuck or spin
  for (const block of placement.getCurrentBlockSet().blocks) {
    const x = block.x + placement.getTranslateX();
    const y = block.y + placement.getTranslateY();
    if (y < 20 && board.getAt(x, y + 1) === ColorType.EMPTY) return true;
  }

  return false;
}

export function classifyPuzzleTheme(
  board: TetrisBoard,
  details: PuzzleRatingDetails
): PuzzleTheme {

  if (isDig(board)) return PuzzleTheme.DIG;
  if (isSpire(board)) return PuzzleTheme.SPIRE;
  if (details.hasBurn) return PuzzleTheme.BURN;
  if (details.hasTuckOrSpin) return PuzzleTheme.OVERHANG;
  return PuzzleTheme.CLEAN;
}


function isDig(board: TetrisBoard): boolean {

  // if there is at least two minos on the right column, it is a dig
  let rightCount = 0;
  for (let i = 0; i < 20; i++) {
    if (board.getAt(9, i)) {
      rightCount++;
    }
  }
  return rightCount >= 2;
}

function getColumnHeight(board: TetrisBoard, column: number): number {
  for (let i = 0; i < 20; i++) {
    if (board.getAt(column, i)) {
      return 20 - i;
    }
  }
  return 0;
}

function isSpire(board: TetrisBoard): boolean {

  // when the average height of two adjacent columns is at least 4 greater than the columns on both sides, it is a spire
  for (let i = 0; i < 7; i++) {
    const leftHeight = getColumnHeight(board, i);
    const rightHeight = getColumnHeight(board, i + 3);
    const middleHeight = (getColumnHeight(board, i + 1) + getColumnHeight(board, i + 2)) / 2;
    if (middleHeight >= leftHeight + 4 && middleHeight >= rightHeight + 4) {
      return true;
    }
  }
  return false;
}
