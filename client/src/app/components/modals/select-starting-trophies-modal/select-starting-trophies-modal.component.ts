import { ChangeDetectionStrategy, Component } from '@angular/core';
import { op } from '@tensorflow/tfjs';
import { BehaviorSubject } from 'rxjs';
import { MeService } from 'src/app/services/state/me.service';
import { getStartLevelForElo, RANKED_UNLOCK_SCORE, START_TROPHIES_OPTIONS, StartTrophiesOption } from 'src/app/shared/nestris-org/elo-system';
import { numberWithCommas } from 'src/app/util/misc';
import { ButtonColor } from '../../ui/solid-button/solid-button.component';
import { ModalManagerService } from 'src/app/services/modal-manager.service';
import { FetchService, Method } from 'src/app/services/fetch.service';
import { NotificationService } from 'src/app/services/notification.service';
import { NotificationType } from 'src/app/shared/models/notifications';
import { PlayService } from 'src/app/services/play.service';

@Component({
  selector: 'app-select-starting-trophies-modal',
  templateUrl: './select-starting-trophies-modal.component.html',
  styleUrls: ['./select-starting-trophies-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SelectStartingTrophiesModalComponent {

  readonly START_TROPHIES_OPTIONS = START_TROPHIES_OPTIONS;
  readonly RANKED_UNLOCK_SCORE = RANKED_UNLOCK_SCORE;

  readonly getStartLevelForElo = getStartLevelForElo;
  readonly numberWithCommas = numberWithCommas;
  readonly ButtonColor = ButtonColor;


  public selectedOption$ = new BehaviorSubject<StartTrophiesOption | null>(null);

  constructor(
    private readonly meService: MeService,
    private readonly modalManagerService: ModalManagerService,
    private readonly fetchService: FetchService,
    private readonly notificationService: NotificationService,
    private readonly playService: PlayService,
  ) {}

  onClickOption(option: StartTrophiesOption) {
    if (!this.isUnlocked(option)) return;
    this.selectedOption$.next(option);
  }

  getUnlockDescription(option: StartTrophiesOption) {
    const score = this.meService.getSync()!.highest_score;
    if (option.unlockScore === null || score >= option.unlockScore) return 'Unlocked!';
    return `Unlocks at ${numberWithCommas(option.unlockScore)} score!`;
  }

  isUnlocked(option: StartTrophiesOption) {
    const score = this.meService.getSync()!.highest_score;
    return option.unlockScore === null || score >= option.unlockScore;
  }

  async play() {
    const option = this.selectedOption$.getValue();
    if (!option) return;

    try {
      // Set starting trophies
      await this.fetchService.fetch(Method.POST, `/api/v2/set-starting-trophies/${option.trophies}`);
      this.modalManagerService.hideModal();
      this.playService.playRanked();
    } catch (e) {
      this.notificationService.notify(NotificationType.ERROR, `Failed to set starting trophies: ${e}`);
      return;
    }
  }

  close() {
    this.modalManagerService.hideModal();
  }

}
