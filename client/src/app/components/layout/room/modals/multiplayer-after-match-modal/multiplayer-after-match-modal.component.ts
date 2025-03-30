import { ChangeDetectionStrategy, Component, HostListener } from '@angular/core';
import { RoomService } from 'src/app/services/room/room.service';
import { calculateScoreForPlayer, MultiplayerRoomState, MultiplayerRoomStatus, PlayerIndex, pointWinner } from 'src/app/shared/room/multiplayer-room-models';
import { MultiplayerComponent } from '../../multiplayer-room/multiplayer-component';
import { ButtonColor } from 'src/app/components/ui/solid-button/solid-button.component';
import { Router } from '@angular/router';
import { RankedQueueService } from 'src/app/services/room/ranked-queue.service';
import { MeService } from 'src/app/services/state/me.service';

@Component({
  selector: 'app-multiplayer-after-match-modal',
  templateUrl: './multiplayer-after-match-modal.component.html',
  styleUrls: ['./multiplayer-after-match-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MultiplayerAfterMatchModalComponent extends MultiplayerComponent {

  constructor(
    roomService: RoomService,
    private readonly queueService: RankedQueueService,
    private readonly meService: MeService,
    private readonly router: Router,
  ) {
    super(roomService);
  }

  readonly calculateScoreForPlayer = calculateScoreForPlayer;
  readonly pointWinner = pointWinner;
  readonly ButtonColor = ButtonColor;


  getPointText(index: PlayerIndex): string {
    if (index === PlayerIndex.DRAW) return 'Draw';
    if (this.getIndexColor(index) === 'blue') return 'Win';
    return 'Loss';
  }

  getMatchText(state: MultiplayerRoomState): string {
    if (state.matchWinner === null) {
      const abortedUsername = state.players[PlayerIndex.PLAYER_1].leftRoom ? state.players[PlayerIndex.PLAYER_1].username : state.players[PlayerIndex.PLAYER_2].username;
      return `Aborted by ${abortedUsername}`
    }
    if (state.matchWinner === PlayerIndex.DRAW) return 'Draw';
    if (state.matchWinner === this.getColorIndex("blue")) return 'Victory';
    return 'Defeat';
  }

  async playNewMatch() {

    // Leave the room
    await this.roomService.leaveRoom();

    // Join the queue
    await this.queueService.joinQueue();
  }

  async exit() {
    await this.roomService.leaveRoom();
    this.router.navigate(['/']);
  }

  // Pressing "space" or "enter" should also trigger the next button
  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    const me = this.meService.getSync();
    if (!me) return;

    if (event.key === me.keybind_emu_start) {
      this.playNewMatch();
    }
  }

  disableNextMatch(state: MultiplayerRoomState): boolean {
    if (state.ranked) return false; // if ranked, always can go to next match
    if (state.status === MultiplayerRoomStatus.ABORTED) return true;
    const opponentIndex = this.multiplayerClientRoom.getOpponentIndex();
    if (opponentIndex === null) return true;
    return state.players[opponentIndex].leftRoom; // if not left room, can rematch
  }


}
