import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

export enum Mode {
  SOLO = 'solo',
  RANKED = 'ranked',
  PUZZLES = 'puzzles',
}

export function getModeColor(mode: Mode) {
  switch (mode) {
    case Mode.SOLO: return '#4C7EFF';
    case Mode.RANKED: return '#FFA520';
    case Mode.PUZZLES: return '#BA4CFF';
    default: return 'white';
  }
}

@Component({
  selector: 'app-mode-icon',
  templateUrl: './mode-icon.component.html',
  styleUrls: ['./mode-icon.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ModeIconComponent {
  @Input() mode!: Mode;
  @Input() width!: number;
}
