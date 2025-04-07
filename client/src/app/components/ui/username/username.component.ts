import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { ModalManagerService, ModalType } from 'src/app/services/modal-manager.service';
import { ProfileModalConfig } from '../../modals/profile-modal/profile-modal.component';

export const GM_REQUIREMENT = 3600;
export const IM_REQUIREMENT = 3200;

export function getTitle(highestTrophies: number) {
  if (highestTrophies >= GM_REQUIREMENT) return "GM";
  if (highestTrophies >= IM_REQUIREMENT) return "IM";
  return null;
}

@Component({
  selector: 'app-username',
  templateUrl: './username.component.html',
  styleUrls: ['./username.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UsernameComponent {
  @Input() username!: string;
  @Input() userid?: string; // userid, clicking opens modal
  @Input() fontSize: number = 12;
  @Input() fontWeight: number = 700;
  @Input() highestTrophies: number = 0;
  @Input() premium: boolean = false;

  constructor(
    private readonly modalManagerService: ModalManagerService
  ) {}

  readonly getTitle = getTitle;

  openProfile(event: MouseEvent) {
      event.stopPropagation();
      if (this.userid) {
        const config: ProfileModalConfig = { userid: this.userid };
        this.modalManagerService.showModal(ModalType.PROFILE, config);
      }
    }

}
