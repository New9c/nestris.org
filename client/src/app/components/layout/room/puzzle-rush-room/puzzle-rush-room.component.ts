import { ChangeDetectionStrategy, Component } from '@angular/core';
import { distinctUntilChanged, map, Observable, tap } from 'rxjs';
import { ButtonColor } from 'src/app/components/ui/solid-button/solid-button.component';
import { PuzzleRushClientRoom } from 'src/app/services/room/puzzle-rush-client-room';
import { RoomService } from 'src/app/services/room/room.service';
import { decodePuzzle } from 'src/app/shared/puzzles/encode-puzzle';
import { PuzzleRushRoomState, PuzzleRushStatus } from 'src/app/shared/room/puzzle-rush-models';
import { PuzzleData } from '../../play-puzzle/play-puzzle-page/play-puzzle-page.component';
import { GameOverMode } from 'src/app/components/nes-layout/nes-board/nes-board.component';

@Component({
  selector: 'app-puzzle-rush-room',
  templateUrl: './puzzle-rush-room.component.html',
  styleUrls: ['./puzzle-rush-room.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PuzzleRushRoomComponent {

  public puzzleRushRoom = this.roomService.getClient<PuzzleRushClientRoom>();
  public state$ = this.puzzleRushRoom.getState$<PuzzleRushRoomState>();

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
    tap(puzzle => console.log("calculated", puzzle))
  );

  readonly ButtonColor = ButtonColor;
  readonly PuzzleRushStatus = PuzzleRushStatus;
  readonly GameOverMode = GameOverMode;

  constructor(
    private readonly roomService: RoomService,
  ) {}

}
