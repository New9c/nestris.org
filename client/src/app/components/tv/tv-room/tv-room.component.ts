import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MultiplayerComponent } from '../../layout/room/multiplayer-room/multiplayer-component';
import { RoomService } from 'src/app/services/room/room.service';
import { bothPlayerIndicies, MultiplayerRoomState, MultiplayerRoomStatus, PlayerIndex } from 'src/app/shared/room/multiplayer-room-models';

@Component({
  selector: 'app-tv-room',
  templateUrl: './tv-room.component.html',
  styleUrls: ['./tv-room.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TvRoomComponent extends MultiplayerComponent {

  readonly bothPlayerIndicies = bothPlayerIndicies;
  readonly MultiplayerRoomStatus = MultiplayerRoomStatus;
  
  constructor(roomService: RoomService) {
    super(roomService);
  }

  showBoardText(state: MultiplayerRoomState, index: PlayerIndex.PLAYER_1 | PlayerIndex.PLAYER_2): string | undefined {
    if (state.players[index].leftRoom && state.status === MultiplayerRoomStatus.IN_GAME) return "LEFT ROOM";
    if (state.status === MultiplayerRoomStatus.BEFORE_GAME) {
      if (state.ready[index]) return 'READY';
      if (state.lastGameWinner === null) return 'NOT READY';
    }
    return undefined;
  }

}
