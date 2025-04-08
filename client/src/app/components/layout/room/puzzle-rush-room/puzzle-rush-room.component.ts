import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { BehaviorSubject, combineLatestWith, delay, distinctUntilChanged, filter, map, mapTo, merge, Observable, of, shareReplay, startWith, Subject, switchMap, tap, timer } from 'rxjs';
import { ButtonColor } from 'src/app/components/ui/solid-button/solid-button.component';
import { PuzzleRushClientRoom } from 'src/app/services/room/puzzle-rush-client-room';
import { RoomService } from 'src/app/services/room/room.service';
import { decodePuzzle } from 'src/app/shared/puzzles/encode-puzzle';
import { puzzleRushIncorrect, PuzzleRushRoomState, puzzleRushScore, PuzzleRushStatus } from 'src/app/shared/room/puzzle-rush-models';
import { PuzzleData } from '../../play-puzzle/play-puzzle-page/play-puzzle-page.component';
import { GameOverMode } from 'src/app/components/nes-layout/nes-board/nes-board.component';
import { SoundEffect, SoundService } from 'src/app/services/sound.service';
import { Correctness } from 'src/app/components/ui/correctness-icon-square/correctness-icon-square.component';
import MoveableTetromino from 'src/app/shared/tetris/moveable-tetromino';
import { Router } from '@angular/router';
import { PlayService } from 'src/app/services/play.service';
import { MeService } from 'src/app/services/state/me.service';
import { T200LeaderboardType } from 'src/app/shared/models/leaderboard';
import { ServerRestartWarningService } from 'src/app/services/server-restart-warning.service';
import { NotificationService } from 'src/app/services/notification.service';
import { NotificationType } from 'src/app/shared/models/notifications';

export enum PuzzleCorrect {
  WAITING = 'waiting',
  CORRECT = 'correct',
  INCORRECT = 'incorrect',
}

export enum PuzzleRushResult {
  NONE = 'none',
  VICTORY = 'victory',
  TIE = 'tie',
  DEFEAT = 'defeat',
  SOLO = 'SOLO'
}

export enum ViewMode {
  SOLUTION = 'solution',
  ATTEMPT = 'attempt'
}

@Component({
  selector: 'app-puzzle-rush-room',
  templateUrl: './puzzle-rush-room.component.html',
  styleUrls: ['./puzzle-rush-room.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PuzzleRushRoomComponent {

  public puzzleRushRoom = this.roomService.getClient<PuzzleRushClientRoom>();
  public state$ = this.puzzleRushRoom.getState$<PuzzleRushRoomState>();
  public rushTimer$ = this.puzzleRushRoom.rushTimer.time$;
  public countdownTimer$ = this.puzzleRushRoom.countdownTimer.time$;

  // Emits when the user clicks the undo button
  public clickUndo$ = new Subject<void>();

  // Set by puzzle component to indicate whether the user is allowed to undo
  public canUndo$ = new BehaviorSubject<boolean>(false);

  // Decode the puzzle id into board and current and next
  public currentPuzzle$: Observable<PuzzleData> = this.state$.pipe(
    map(state => state.players[this.puzzleRushRoom.getMyIndex()].currentPuzzleID),
    distinctUntilChanged(),
    map(puzzleID => ({ puzzleID, decoded: decodePuzzle(puzzleID) })),
    map( ({ puzzleID, decoded }) => ({
      puzzleID,
      board: decoded.board,
      current: decoded.current,
      next: decoded.next,
      level: 18
    })),
    shareReplay(1)
  );

  // Whether the previous submission was correct
  public isCorrect$: Observable<PuzzleCorrect> = this.state$.pipe(
    map(state => state.players[this.puzzleRushRoom.getMyIndex()].progress),
    filter(progress => progress.length > 0),
    distinctUntilChanged(),
    map(progress => progress[progress.length - 1] ? PuzzleCorrect.CORRECT : PuzzleCorrect.INCORRECT),
    tap(isCorrect => this.soundService.play(isCorrect === PuzzleCorrect.CORRECT ? SoundEffect.NOTES_UP_HIGH : SoundEffect.INCORRECT)),
    startWith(PuzzleCorrect.WAITING),
    shareReplay(1)
  );

  // Briefly set to true on incorrect submission, then returns back to false. Useful for CSS animation
  public incorrectShake$ = this.isCorrect$.pipe(
    filter(isCorrect => isCorrect === PuzzleCorrect.INCORRECT),
    switchMap(() =>
      merge(
        of(true),             // emit true immediately
        timer(300).pipe(map(() => false)) // emit false after 100ms
      )
    ),
    shareReplay(1)
  );

  // Number of incorrect attempts
  public incorrectCount$ = this.state$.pipe(
    map(state => puzzleRushIncorrect(state.players[this.puzzleRushRoom.getMyIndex()])),
    startWith(0),
    shareReplay(1)
  );

  // 2D array where progress is grouped into columns of 10
  public progressMatrix$ = this.state$.pipe(
    map(state => state.players[this.puzzleRushRoom.getMyIndex()].progress),
    startWith([]),
    map(progress => progress.map(isCorrect => isCorrect ? Correctness.CORRECT : Correctness.INCORRECT)),
    map(progress => {

      // Show only the last 5 columns if in multiplayer to save space
      const removeCount = Math.floor((progress.length - 40) / 10) * 10;
      progress = (progress.length < 40 || this.puzzleRushRoom.isSinglePlayer()) ? progress : progress.slice(removeCount);

      const lengthToExtend = Math.ceil((progress.length + 1) / 10) * 10;
      return [...progress, ...Array(lengthToExtend - progress.length).fill(Correctness.NONE)] as Correctness[];
    })
  )

  // Match end result
  public result$ = this.state$.pipe(
    map(state => {

      if (state.status !== PuzzleRushStatus.AFTER_GAME) return PuzzleRushResult.NONE;
      if (state.players.length === 1) return PuzzleRushResult.SOLO;

      const myIndex = this.puzzleRushRoom.getMyIndex();
      const opponentIndex = (myIndex + 1) % 2;

      const myScore = puzzleRushScore(state.players[myIndex]);
      const opponentScore = puzzleRushScore(state.players[opponentIndex]);
      
      if (myScore > opponentScore) return PuzzleRushResult.VICTORY;
      if (myScore === opponentScore) return PuzzleRushResult.TIE;
      return PuzzleRushResult.DEFEAT;
    }),
    shareReplay(1)
  );

  public viewMode$ = new BehaviorSubject<ViewMode>(ViewMode.SOLUTION);

  public selectedPuzzle$ = this.puzzleRushRoom.selectedIndex$.pipe(

    // Get the current puzzle, attempt, and solution based on the selected index
    filter(selectedIndex => selectedIndex !== null),
    combineLatestWith(this.state$.pipe(
      filter(state => state.puzzleSet !== undefined && state.attempts !== undefined)
    )),
    map(([selectedIndex, state]) => ({
      attempt: state.attempts![this.puzzleRushRoom.getMyIndex()][selectedIndex!],
      solution: state.puzzleSet![selectedIndex! % state.puzzleSet!.length],
    })),
    map(({ attempt, solution }) => ({ attempt, solution, puzzle: decodePuzzle(solution.id) }) ),
    shareReplay(1),

    // Get either the attempt or solution current/next placements, based on viewMode$
    combineLatestWith(this.viewMode$),
    map(([ { attempt, solution, puzzle }, viewMode ]) => ({
      board: puzzle.board,
      currentPlacement: (
        viewMode === ViewMode.SOLUTION ?
        MoveableTetromino.fromInt2(solution.current) :
        (attempt.current === undefined ? undefined : MoveableTetromino.fromInt2(attempt.current))
      ),
      nextPlacement: (
        viewMode === ViewMode.SOLUTION ?
        MoveableTetromino.fromInt2(solution.next) :
        (attempt.next === undefined ? undefined : MoveableTetromino.fromInt2(attempt.next))
      ),
    })),
    shareReplay(1)
  );

  readonly ButtonColor = ButtonColor;
  readonly PuzzleRushStatus = PuzzleRushStatus;
  readonly GameOverMode = GameOverMode;
  readonly PuzzleCorrect = PuzzleCorrect;
  readonly Correctness = Correctness;
  readonly PuzzleRushResult = PuzzleRushResult;
  readonly ViewMode = ViewMode;
  readonly puzzleRushScore = puzzleRushScore;
  readonly puzzleRushIncorrect = puzzleRushIncorrect;

  constructor(
    private readonly roomService: RoomService,
    private readonly soundService: SoundService,
    private readonly meService: MeService,
    private readonly restartWarningService: ServerRestartWarningService,
    private readonly notificationService: NotificationService,
    public readonly router: Router,
  ) {
    this.incorrectShake$.subscribe(shake => console.log("shake", shake));
  }

  timerText(seconds: number | null) {
    if (seconds === null) return "";
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min.toString().padStart(1, '0')}:${sec.toString().padStart(2, '0')}`;
  }

  timerRed(seconds: number | null) {
    if (seconds !== null && seconds <= 10) return true;
    return false;
  }

  selectPuzzleIndex(state: PuzzleRushRoomState, puzzleIndex: number) {
    if (state.status !== PuzzleRushStatus.AFTER_GAME) return;

    const numAttempts = this.puzzleRushRoom.getState<PuzzleRushRoomState>().attempts![this.puzzleRushRoom.getMyIndex()].length;
    if (puzzleIndex >= numAttempts) return;

    this.puzzleRushRoom.selectedIndex$.next(puzzleIndex);
    this.viewMode$.next(ViewMode.SOLUTION);
    this.soundService.play(SoundEffect.CLICK);
  }

  ordinal(index: number | null): string {
    if (index === null) return "";

    index++;
    const suffixes = ["th", "st", "nd", "rd"];
    const v = index % 100;
  
    const suffix =
      suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0];
  
    return `${index}${suffix}`;
  }
  
  toggleViewMode() {
    if (this.viewMode$.getValue() === ViewMode.ATTEMPT) this.viewMode$.next(ViewMode.SOLUTION);
    else this.viewMode$.next(ViewMode.ATTEMPT);
    console.log("toggle");
  } 

  playAgainText() {
    if (this.puzzleRushRoom.isSinglePlayer()) return "Play Again";
    return (this.puzzleRushRoom.getState<PuzzleRushRoomState>().rated) ? "New match" : "Rematch";
  }

  playAgain() {

    if (this.restartWarningService.isWarning()) {
      this.notificationService.notify(NotificationType.ERROR, "Server is about to restart! Please wait.");
      return;
    }

    this.viewMode$.next(ViewMode.SOLUTION);
    if (this.puzzleRushRoom.isSinglePlayer()) {
      this.puzzleRushRoom.sendRematchEvent();
    }
  }

  goLeaderboard() {
    this.router.navigate(['/leaderboard'], { queryParams: { type: T200LeaderboardType.PUZZLE_RUSH } });
  }

}
