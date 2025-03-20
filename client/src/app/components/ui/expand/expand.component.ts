import { ChangeDetectionStrategy, Component, EventEmitter, Output } from '@angular/core';

@Component({
  selector: 'app-expand',
  templateUrl: './expand.component.html',
  styleUrls: ['./expand.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExpandComponent {
  @Output() clickExpand = new EventEmitter<MouseEvent>();
}
