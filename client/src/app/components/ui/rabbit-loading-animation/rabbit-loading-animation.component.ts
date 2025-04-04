import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'app-rabbit-loading-animation',
  templateUrl: './rabbit-loading-animation.component.html',
  styleUrls: ['./rabbit-loading-animation.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RabbitLoadingAnimationComponent {
  @Input() width: string = "auto";
}
