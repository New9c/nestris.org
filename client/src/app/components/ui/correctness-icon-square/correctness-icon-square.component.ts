import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

export enum Correctness {
  NONE = 'none',
  CORRECT = 'correct',
  INCORRECT = 'incorrect'
}

@Component({
  selector: 'app-correctness-icon-square',
  templateUrl: './correctness-icon-square.component.html',
  styleUrls: ['./correctness-icon-square.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CorrectnessIconSquareComponent {
  @Input() correctness: Correctness = Correctness.NONE;
  @Input() width: string = 'auto';

  getSrc() {
    return `./assets/img/correctness-icons/${this.correctness}.svg`;
  }
}
