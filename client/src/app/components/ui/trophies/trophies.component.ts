import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'app-trophies',
  templateUrl: './trophies.component.html',
  styleUrls: ['./trophies.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TrophiesComponent {
  @Input() trophies: number | string = 0;
  @Input() size: number = 16;
  @Input() color?: string; // If color is not specified, default to gold gradient
  @Input() reverse: boolean = false; // If reverse is true, text will be left of the trophy icon
  @Input() scaleIcon: number = 1; // Scale the trophy icon
  @Input() scaleGap: number = 1; // Gap between icon and text
  @Input() textWidth: number | string = 'auto'; // Width of the text container
  @Input() nonnegative: boolean = true;


  // if trophies is negative, return 0
  formattedTrophies(): number | string {
    if (typeof this.trophies === 'number' && this.nonnegative) {
      return Math.max(0, this.trophies);
    }
    
    return this.trophies; // Keep it as a string if it's a string
  }

}
