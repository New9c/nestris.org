import { ChangeDetectionStrategy, Component } from '@angular/core';
import { BehaviorSubject, delay, distinctUntilChanged, filter, map, mapTo, merge, Observable, of, shareReplay, startWith, Subject, switchMap, tap, timer } from 'rxjs';
import { ButtonColor } from 'src/app/components/ui/solid-button/solid-button.component';
import { PuzzleRushClientRoom } from 'src/app/services/room/puzzle-rush-client-room';
import { RoomService } from 'src/app/services/room/room.service';
import { decodePuzzle } from 'src/app/shared/puzzles/encode-puzzle';
import { puzzleRushIncorrect, PuzzleRushRoomState, puzzleRushScore, PuzzleRushStatus } from 'src/app/shared/room/puzzle-rush-models';
import { PuzzleData } from '../../play-puzzle/play-puzzle-page/play-puzzle-page.component';
import { GameOverMode } from 'src/app/components/nes-layout/nes-board/nes-board.component';
import { SoundEffect, SoundService } from 'src/app/services/sound.service';
import { Correctness } from 'src/app/components/ui/correctness-icon-square/correctness-icon-square.component';

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
    )
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

  readonly ButtonColor = ButtonColor;
  readonly PuzzleRushStatus = PuzzleRushStatus;
  readonly GameOverMode = GameOverMode;
  readonly PuzzleCorrect = PuzzleCorrect;
  readonly Correctness = Correctness;
  readonly PuzzleRushResult = PuzzleRushResult;
  readonly puzzleRushScore = puzzleRushScore;
  readonly puzzleRushIncorrect = puzzleRushIncorrect;

  constructor(
    private readonly roomService: RoomService,
    private readonly soundService: SoundService,
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

  getCurrentBoard(state: PuzzleRushRoomState) {
    return decodePuzzle(state.players[this.puzzleRushRoom.getMyIndex()].currentPuzzleID).board;
  }

}
