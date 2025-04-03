import { ChangeDetectionStrategy, Component, EventEmitter, Output } from '@angular/core';
import { SoundEffect } from 'src/app/services/sound.service';

@Component({
  selector: 'app-expand',
  templateUrl: './expand.component.html',
  styleUrls: ['./expand.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExpandComponent {
  @Output() clickExpand = new EventEmitter<MouseEvent>();

  readonly SoundEffect = SoundEffect;
}
