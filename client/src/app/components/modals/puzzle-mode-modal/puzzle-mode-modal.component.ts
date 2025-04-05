import { ChangeDetectionStrategy, Component } from '@angular/core';

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

  public modes = Object.values(PuzzleMode);

}
