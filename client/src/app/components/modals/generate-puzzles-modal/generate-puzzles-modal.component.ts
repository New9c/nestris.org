import { ChangeDetectionStrategy, Component, OnDestroy } from '@angular/core';
import { GeneratePuzzlesService } from 'src/app/services/generate-puzzles.service';

@Component({
  selector: 'app-generate-puzzles-modal',
  templateUrl: './generate-puzzles-modal.component.html',
  styleUrls: ['./generate-puzzles-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GeneratePuzzlesModalComponent implements OnDestroy {

  constructor(
    private readonly generatePuzzlesService: GeneratePuzzlesService
  ) {}

  // When modal closes, stop generating puzzles, whether complete or not
  ngOnDestroy(): void {
    this.generatePuzzlesService.stopGenerating();
  }

}
