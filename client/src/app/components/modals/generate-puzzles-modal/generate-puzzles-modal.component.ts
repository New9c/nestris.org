import { ChangeDetectionStrategy, Component, OnDestroy } from '@angular/core';
import { GeneratePuzzlesService } from 'src/app/services/generate-puzzles.service';
import { ButtonColor } from '../../ui/solid-button/solid-button.component';
import { ModalManagerService } from 'src/app/services/modal-manager.service';
import { Router } from '@angular/router';
import { PuzzleStrategyType } from '../../layout/play-puzzle/play-puzzle-page/puzzle-states/puzzle-strategy-type';

@Component({
  selector: 'app-generate-puzzles-modal',
  templateUrl: './generate-puzzles-modal.component.html',
  styleUrls: ['./generate-puzzles-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GeneratePuzzlesModalComponent implements OnDestroy {

  readonly ButtonColor = ButtonColor;

  readonly state$ = this.generatePuzzlesService.getState$();

  constructor(
    private readonly generatePuzzlesService: GeneratePuzzlesService,
    private readonly modalManagerService: ModalManagerService,
    private readonly router: Router,
  ) {}

  go() {
    this.router.navigate(['/online/puzzle'], {
      queryParams: { mode: PuzzleStrategyType.GENERATED, exit: encodeURIComponent(this.router.url) },
    });
  }

  hide() {
    this.modalManagerService.hideModal();
  }

  // When modal closes, stop generating puzzles, whether complete or not
  ngOnDestroy(): void {
    this.generatePuzzlesService.stopGenerating();
  }

}
