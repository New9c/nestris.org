import { ChangeDetectionStrategy, Component, HostListener } from '@angular/core';
import { GameOverMode } from 'src/app/components/nes-layout/nes-board/nes-board.component';
import { EmulatorService } from 'src/app/services/emulator/emulator.service';
import { PlatformInterfaceService } from 'src/app/services/platform-interface.service';
import { RoomService } from 'src/app/services/room/room.service';
import { calculateScoreForPlayer, MultiplayerRoomState, MultiplayerRoomStatus, PlayerIndex } from 'src/app/shared/room/multiplayer-room-models';
import { MultiplayerComponent } from './multiplayer-component';
import { Platform } from 'src/app/shared/models/platform';
import { OCRStatus } from 'src/app/services/room/multiplayer-client-room';
import { of, switchMap } from 'rxjs';
import { COUNTDOWN_LINECAP_REACHED } from 'src/app/shared/network/stream-packets/packet';

@Component({
  selector: 'app-multiplayer-room',
  templateUrl: './multiplayer-room.component.html',
  styleUrls: ['./multiplayer-room.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MultiplayerRoomComponent extends MultiplayerComponent {

  readonly MultiplayerRoomStatus = MultiplayerRoomStatus;
  readonly Platform = Platform;
  readonly OCRStatus = OCRStatus;
  readonly COUNTDOWN_LINECAP_REACHED = COUNTDOWN_LINECAP_REACHED;

  public ocrStatus$ = this.multiplayerClientRoom.getOCRStatus$();
  public readyTimer = this.multiplayerClientRoom.readyTimer$.pipe(
    switchMap(timer => timer ? timer.timeVisibleAt$(20) : of(null))
  );
  public ocrTimer = this.multiplayerClientRoom.ocrTimer$.pipe(
    switchMap(timer => timer ? timer.timeVisibleAt$(5) : of(null))
  );

  constructor(
    public readonly platform: PlatformInterfaceService,
    public readonly emulator: EmulatorService,
    roomService: RoomService,
  ) {
    super(roomService);
  }

  @HostListener('window:keydown', ['$event'])
  handleKeydown(event: KeyboardEvent) {
    this.emulator.handleKeydown(event);
  }

  @HostListener('window:keyup', ['$event'])
  handleKeyup(event: KeyboardEvent) {
    this.emulator.handleKeyup(event);
  }

  getScore(state: MultiplayerRoomState, index: PlayerIndex.PLAYER_1 | PlayerIndex.PLAYER_2) {
    return calculateScoreForPlayer(state.points, index);
  }

  showBoardText(state: MultiplayerRoomState, index: PlayerIndex.PLAYER_1 | PlayerIndex.PLAYER_2, ocrStatus: OCRStatus | null = null): string | undefined {
    if (state.players[index].leftRoom && state.status === MultiplayerRoomStatus.IN_GAME) return "LEFT ROOM";
    if (state.status === MultiplayerRoomStatus.BEFORE_GAME) {
      if (state.ready[index]) return 'READY';
      if (!this.isMyIndex(index) && state.lastGameWinner === null) return 'NOT READY';
    }

    if (state.status === MultiplayerRoomStatus.IN_GAME && ocrStatus === OCRStatus.OCR_BEFORE_GAME) return "Detecting game...";
    
    return undefined;
  }

  clickNext(state: MultiplayerRoomState) {
    if (state.status === MultiplayerRoomStatus.BEFORE_GAME) {
      console.log('Ready for next game');
      this.multiplayerClientRoom.sendReadyEvent();
    } else if (state.status === MultiplayerRoomStatus.AFTER_MATCH) {
      this.multiplayerClientRoom.showAfterMatchModal();
    }
  }
  
  winningScoreLabel(score: number) {
    if (score === 0.5) return 'One game';
    return `First to ${score}`;
  }

}
