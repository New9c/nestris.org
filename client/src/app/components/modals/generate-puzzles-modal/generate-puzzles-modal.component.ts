import { ChangeDetectionStrategy, Component, OnDestroy } from '@angular/core';
import { GeneratePuzzlesService } from 'src/app/services/generate-puzzles.service';
import { ButtonColor } from '../../ui/solid-button/solid-button.component';
import { ModalManagerService } from 'src/app/services/modal-manager.service';

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
  ) {}

  go() {
    
  }

  hide() {
    this.modalManagerService.hideModal();
  }

  // When modal closes, stop generating puzzles, whether complete or not
  ngOnDestroy(): void {
    this.generatePuzzlesService.stopGenerating();
  }

}
