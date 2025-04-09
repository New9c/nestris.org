import { ChangeDetectionStrategy, Component, HostListener, OnDestroy } from '@angular/core';
import { RoomService } from 'src/app/services/room/room.service';
import { calculateScoreForPlayer, MultiplayerRoomState, MultiplayerRoomStatus, PlayerIndex, pointWinner } from 'src/app/shared/room/multiplayer-room-models';
import { MultiplayerComponent } from '../../multiplayer-room/multiplayer-component';
import { ButtonColor } from 'src/app/components/ui/solid-button/solid-button.component';
import { Router } from '@angular/router';
import { RankedQueueService } from 'src/app/services/room/ranked-queue.service';
import { GamepadService } from 'src/app/services/gamepad.service';
import { MeService } from 'src/app/services/state/me.service';

@Component({
  selector: 'app-multiplayer-after-match-modal',
  templateUrl: './multiplayer-after-match-modal.component.html',
  styleUrls: ['./multiplayer-after-match-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MultiplayerAfterMatchModalComponent extends MultiplayerComponent implements OnDestroy {

  private gamepadSubscription: any;
  constructor(
    roomService: RoomService,
    private readonly queueService: RankedQueueService,
    private readonly meService: MeService,
    private readonly gamepadService: GamepadService,
    private readonly router: Router,
  ) {
    super(roomService);
    this.gamepadSubscription = this.gamepadService.onPress().subscribe(key => this.onKeyDown(key));
  }

  readonly calculateScoreForPlayer = calculateScoreForPlayer;
  readonly pointWinner = pointWinner;
  readonly ButtonColor = ButtonColor;
  readonly MultiplayerRoomStatus = MultiplayerRoomStatus;


  ngOnDestroy() {
    this.gamepadSubscription.unsubscribe();
  }

  getPointText(index: PlayerIndex): string {
    if (index === PlayerIndex.DRAW) return 'Draw';
    if (this.getIndexColor(index) === 'blue') return 'Win';
    return 'Loss';
  }

  getMatchText(state: MultiplayerRoomState): string {
    if (state.matchWinner === null) {
      const abortedUsername = state.players[state.aborter!].username;
      return `Aborted by ${abortedUsername}`
    }
    if (state.matchWinner === PlayerIndex.DRAW) return 'Draw';
    if (state.matchWinner === this.getColorIndex("blue")) return 'Victory';
    return 'Defeat';
  }

  async playNewMatch(state: MultiplayerRoomState) {

    if (state.ranked) {
      // Leave the room
      await this.roomService.leaveRoom();

      // Join the queue
      await this.queueService.joinQueue();

    } else {
      // Send rematch offer
      this.multiplayerClientRoom.sendReadyEvent();
    }


  }

  async exit() {
    await this.roomService.leaveRoom();
    this.router.navigate(['/']);
  }

  // Pressing "space" or "enter" should also trigger the next button
  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    this.onKeyDown(event.key);
  }

  private onKeyDown(key: string) {
    const me = this.meService.getSync();
    if (!me) return;

    if (key === me.keybind_emu_start) {
      this.playNewMatch(this.multiplayerClientRoom.getState<MultiplayerRoomState>());
    }
  }

  disableNextMatch(state: MultiplayerRoomState): boolean {
    if (state.ranked) return false; // if ranked, always can go to next match
    const opponentIndex = this.multiplayerClientRoom.getOpponentIndex();
    if (opponentIndex === null) return true;
    return state.players[opponentIndex].leftRoom; // if not left room, can rematch
  }

  amReady(state: MultiplayerRoomState): boolean {
    return state.ready[this.multiplayerClientRoom.getMyIndex()!];
  }


}
