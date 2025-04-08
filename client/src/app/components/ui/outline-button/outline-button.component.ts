import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-outline-button',
  templateUrl: './outline-button.component.html',
  styleUrls: ['./outline-button.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OutlineButtonComponent {
  @Input() label!: string;
  @Output() click = new EventEmitter<MouseEvent>();
}
