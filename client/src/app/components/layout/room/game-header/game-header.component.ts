import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { ProfileModalConfig } from 'src/app/components/modals/profile-modal/profile-modal.component';
import { ModalManagerService, ModalType } from 'src/app/services/modal-manager.service';

@Component({
  selector: 'app-game-header',
  templateUrl: './game-header.component.html',
  styleUrls: ['./game-header.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GameHeaderComponent {
  @Input() trophies: number = 0;
  @Input() highestTrophies: number = 0;
  @Input() premium: boolean = false;
  @Input() highscore?: number;
  @Input() username: string = '';
  @Input() userid?: string;
  @Input() score: number = 0;
  @Input() color: 'red' | 'blue' = 'red';
  @Input() rated: boolean = false;

  constructor(
    private readonly modalManagerService: ModalManagerService 
  ) {}

}
