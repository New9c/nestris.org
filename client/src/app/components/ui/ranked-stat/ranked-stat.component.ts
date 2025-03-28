import { ChangeDetectionStrategy, Component, Input, OnChanges } from '@angular/core';
import { numberWithCommas } from 'src/app/util/misc';

@Component({
  selector: 'app-ranked-stat',
  templateUrl: './ranked-stat.component.html',
  styleUrls: ['./ranked-stat.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RankedStatComponent {
  @Input() label!: string;
  @Input() myValue!: number;
  @Input() opponentValue!: number;
  @Input() isPercent: boolean = false;

  getValueString(value: number) {
    if (this.isPercent) return `${value}%`;
    else return numberWithCommas(value);
  }

}
