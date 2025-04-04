import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'app-username',
  templateUrl: './username.component.html',
  styleUrls: ['./username.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UsernameComponent {
  @Input() username!: string;
  @Input() fontSize: number = 12;
  @Input() fontWeight: number = 700;
  @Input() highestTrophies: number = 0;
  @Input() premium: boolean = false;


  getTitle() {
    if (this.highestTrophies >= 3200) return "GM";
    if (this.highestTrophies >= 2800) return "IM";
    return null;
  }

}
