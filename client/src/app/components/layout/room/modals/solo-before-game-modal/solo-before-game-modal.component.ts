import { ChangeDetectionStrategy, Component, HostListener, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { map } from 'rxjs';
import { ButtonColor } from 'src/app/components/ui/solid-button/solid-button.component';
import { GamepadService } from 'src/app/services/gamepad.service';
import { PlatformInterfaceService } from 'src/app/services/platform-interface.service';
import { RoomService } from 'src/app/services/room/room.service';
import { SoloClientRoom, SoloClientState } from 'src/app/services/room/solo-client-room';
import { SoundEffect, SoundService } from 'src/app/services/sound.service';
import { MeService } from 'src/app/services/state/me.service';
import { Platform } from 'src/app/shared/models/platform';
import { SoloRoomState } from 'src/app/shared/room/solo-room-models';

@Component({
  selector: 'app-solo-before-game-modal',
  templateUrl: './solo-before-game-modal.component.html',
  styleUrls: ['./solo-before-game-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SoloBeforeGameModalComponent implements OnDestroy {

  readonly ButtonColor = ButtonColor;
  readonly Platform = Platform;

  readonly VALID_START_LEVELS = [
    [0, 6, 7, 8, 9],
    [12, 15, 18, 19, 29]
  ];

  private gamepadSubscription: any;

  constructor(
    private readonly roomService: RoomService,
    private readonly router: Router,
    public readonly platform: PlatformInterfaceService,
    private readonly meService: MeService,
    private readonly gamepadService: GamepadService,
    private readonly sound: SoundService,
  ) {
    this.gamepadSubscription = this.gamepadService.onPress().subscribe(key => this.onKeyDown(key));
  }

  ngOnDestroy() {
    this.gamepadSubscription.unsubscribe();
  }

  public soloClientRoom = this.roomService.getClient<SoloClientRoom>();
  public startLevel$ = SoloClientRoom.startLevel$;

  public lastGameSummary$ = this.soloClientRoom.getState$<SoloRoomState>().pipe(
    map(state => state.lastGameSummary)
  );

  public startGame() {
    this.soloClientRoom.startGame(3, true);
  }

  public backToSummary() {
    this.soloClientRoom.setSoloState(SoloClientState.AFTER_GAME_MODAL);
  }

  // Pressing "space" or "enter" should also trigger the next button
  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    this.onKeyDown(event.key);
  }

  private translate(dx: number, dy: number) {

    // Find existing x and y based on VALID_START_LEVELS
    let x = -1;
    let y = -1;
    for (let i = 0; i < this.VALID_START_LEVELS.length; i++) {
      for (let j = 0; j < this.VALID_START_LEVELS[i].length; j++) {
        if (this.VALID_START_LEVELS[i][j] === this.startLevel$.getValue()) {
          x = i;
          y = j;
        }
      }
    }

    // Translate
    x += dx;
    y += dy;

    // Clamp
    x = Math.max(0, Math.min(this.VALID_START_LEVELS.length - 1, x));
    y = Math.max(0, Math.min(this.VALID_START_LEVELS[x].length - 1, y));

    // Set
    this.setStartLevel(this.VALID_START_LEVELS[x][y]);
  }

  public setStartLevel(level: number) {
    this.startLevel$.next(level);
    this.sound.play(SoundEffect.CLICK);
  }


  private onKeyDown(key: string) {

    const me = this.meService.getSync();
    if (!me) return;

    if (key === me.keybind_emu_start) {
      this.sound.play(SoundEffect.CLICK);
      this.startGame();
    }

    // Left/right/up/down arrow keys to change level
    if (key === me.keybind_emu_move_left) this.translate(0, -1);
    else if (key === me.keybind_emu_move_right) this.translate(0, 1);
    else if (key === me.keybind_emu_up) this.translate(-1, 0);
    else if (key === me.keybind_emu_down) this.translate(1, 0);
  }

  exit() {
    this.router.navigate(['/']);
  }
}
