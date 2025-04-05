import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MeService } from 'src/app/services/state/me.service';
import { DBUser } from 'src/app/shared/models/db-user';
import { Mode } from '../../ui/mode-icon/mode-icon.component';
import { PlayService } from 'src/app/services/play.service';
import { ModalManagerService } from 'src/app/services/modal-manager.service';

enum PuzzleMode {
  NORMAL = 'normal',
  RUSH = 'rush',
  BATTLE = 'battle',
}


@Component({
  selector: 'app-puzzle-mode-modal',
  templateUrl: './puzzle-mode-modal.component.html',
  styleUrls: ['./puzzle-mode-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PuzzleModeModalComponent {

  public readonly modes = Object.values(PuzzleMode);
  readonly PuzzleMode = PuzzleMode;
  readonly Mode = Mode;

  public readonly PUZZLE_RUSH_UNLOCK_ELO = 1000;
  public readonly PUZZLE_BATTLE_UNLOCK_RUSH = 20;

  public readonly imagePath = (mode: PuzzleMode) => `./assets/img/puzzle-mode/${mode}.svg`;

  public readonly modeLabels = {
    [PuzzleMode.NORMAL]: 'Puzzles',
    [PuzzleMode.RUSH]: 'Puzzle Blitz',
    [PuzzleMode.BATTLE]: 'Puzzle Wars',
  };

  public readonly modeDescriptions = {
    [PuzzleMode.NORMAL]: 'Solve rated puzzles',
    [PuzzleMode.RUSH]: 'Solve as many puzzles as you can in 2 minutes',
    [PuzzleMode.BATTLE]: 'Puzzle blitz against other players!',
  };

  constructor(
    public readonly meService: MeService,
    public readonly modalManager: ModalManagerService,
    private readonly playService: PlayService,
  ) {}

  public canPlay(me: DBUser, mode: PuzzleMode) {
    switch (mode) {
      case PuzzleMode.NORMAL: return true;
      case PuzzleMode.RUSH: return me.highest_puzzle_elo >= this.PUZZLE_RUSH_UNLOCK_ELO;
      case PuzzleMode.BATTLE: return me.puzzle_rush_best >= this.PUZZLE_BATTLE_UNLOCK_RUSH;
    }
  }

  public onClick(me: DBUser, mode: PuzzleMode, event: MouseEvent) {
    
    event.stopPropagation();
    event.preventDefault();

    if (!this.canPlay(me, mode)) return;

    this.modalManager.hideModal();
    switch (mode) {
      case PuzzleMode.NORMAL: this.playService.playPuzzles();
    }
  }
}
