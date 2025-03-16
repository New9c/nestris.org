import { ChangeDetectionStrategy, Component } from '@angular/core';
import { op } from '@tensorflow/tfjs';
import { BehaviorSubject } from 'rxjs';
import { MeService } from 'src/app/services/state/me.service';
import { getStartLevelForElo } from 'src/app/shared/nestris-org/elo-system';
import { numberWithCommas } from 'src/app/util/misc';
import { ButtonColor } from '../../ui/solid-button/solid-button.component';
import { ModalManagerService } from 'src/app/services/modal-manager.service';

interface Option {
  label: string;
  trophies: number;
  unlockScore: number | null;
}

@Component({
  selector: 'app-select-starting-trophies-modal',
  templateUrl: './select-starting-trophies-modal.component.html',
  styleUrls: ['./select-starting-trophies-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SelectStartingTrophiesModalComponent {

  readonly getStartLevelForElo = getStartLevelForElo;
  readonly numberWithCommas = numberWithCommas;
  readonly ButtonColor = ButtonColor;

  public readonly options: Option[] = [
    { label: 'Beginner', trophies: 400, unlockScore: null },
    { label: 'Intermediate', trophies: 1200, unlockScore: 200000 },
    { label: 'Advanced', trophies: 2000, unlockScore: 500000 },
  ];

  public selectedOption$ = new BehaviorSubject<Option | null>(null);

  constructor(
    private readonly meService: MeService,
    private readonly modalManagerService: ModalManagerService,
  ) {}

  onClickOption(option: Option) {
    if (!this.isUnlocked(option)) return;
    this.selectedOption$.next(option);
  }

  getUnlockDescription(option: Option) {
    const score = this.meService.getSync()!.highest_score;
    if (option.unlockScore === null || score >= option.unlockScore) return 'Unlocked!';
    return `Unlocks at ${numberWithCommas(option.unlockScore)} score!`;
  }

  isUnlocked(option: Option) {
    const score = this.meService.getSync()!.highest_score;
    return option.unlockScore === null || score >= option.unlockScore;
  }

  async play() {
    const option = this.selectedOption$.getValue();
    if (!option) return;
    
  }

  close() {
    this.modalManagerService.hideModal();
  }

}
