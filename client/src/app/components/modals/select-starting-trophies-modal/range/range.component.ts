import { ChangeDetectionStrategy, Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { COLOR_FIRST_COLORS_RGB, COLOR_SECOND_COLORS_RGB, RGBColor } from 'src/app/shared/tetris/tetromino-colors';

@Component({
  selector: 'app-range',
  templateUrl: './range.component.html',
  styleUrls: ['./range.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RangeComponent implements OnChanges {
  @Input() level!: number;
  public color!: RGBColor;

  ngOnChanges(): void {
    if (this.level % 10 === 9) this.color = COLOR_SECOND_COLORS_RGB[9];
    else this.color = COLOR_FIRST_COLORS_RGB[this.level % 10];
  }

}
