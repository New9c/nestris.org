import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { INITIAL_BATTLES_ELO } from 'src/app/shared/nestris-org/elo-system';

@Component({
  selector: 'app-battle-elo',
  templateUrl: './battle-elo.component.html',
  styleUrls: ['./battle-elo.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BattleEloComponent {
  @Input() elo!: number;
  @Input() size: number = 16;
  @Input() color: string = "#BA4CFF"; // If color is not specified, default to purple
  @Input() diff: boolean = false; // if diff, show +/-. if not diff, -1 means INITIAL_BATTLE_ELO

  label() {
    if (this.diff) {
      return this.elo > 0 ? `+${this.elo}` : this.elo;
    }
    return this.elo === -1 ? `${INITIAL_BATTLES_ELO}?` : this.elo;
  }

}
