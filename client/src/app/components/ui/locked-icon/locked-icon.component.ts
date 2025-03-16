import { ChangeDetectionStrategy, Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { getModeColor, Mode } from '../mode-icon/mode-icon.component';

@Component({
  selector: 'app-locked-icon',
  templateUrl: './locked-icon.component.html',
  styleUrls: ['./locked-icon.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LockedIconComponent implements OnChanges {
  @Input() mode?: Mode;
  @Input() locked: boolean = true;
  color!: string;

  ngOnChanges(changes: SimpleChanges): void {
    this.color = this.mode ? getModeColor(this.mode) : 'white';
  }
}
