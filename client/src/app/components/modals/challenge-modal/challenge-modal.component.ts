import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { ButtonColor } from '../../ui/solid-button/solid-button.component';
import { ModalManagerService } from 'src/app/services/modal-manager.service';
import { WebsocketService } from 'src/app/services/websocket.service';
import { MeService } from 'src/app/services/state/me.service';
import { InvitationsService } from 'src/app/services/state/invitations.service';
import { InvitationMode } from 'src/app/shared/network/json-message';
import { InvitationType, MatchInvitation } from 'src/app/shared/models/invitation';
import { v4 as uuid } from 'uuid';

export interface ChallengeModalConfig {
  opponentid: string;
  opponentUsername: string;
}

export enum SettingID {
  WINNING_SCORE,
  START_LEVEL,
  LINECAP,
}

export interface Setting {
  id: SettingID,
  label: string;
  currentValue: any;
  allValues: any[];
  valueStrings?: {[key in any]: string};
}

const NO_CAP = 'None';

@Component({
  selector: 'app-challenge-modal',
  templateUrl: './challenge-modal.component.html',
  styleUrls: ['./challenge-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChallengeModalComponent {
  @Input() config!: ChallengeModalConfig;

  readonly error$ = new BehaviorSubject<string | null>(null);

  readonly ButtonColor = ButtonColor;

  readonly settings: Setting[] = [

    {
      id: SettingID.WINNING_SCORE,
      label: "Match duration",
      currentValue: 2,
      allValues: [0.5, 2, 3],
      valueStrings: {
        0.5: 'One game',
        2: 'First to 2',
        3: 'First to 3'
      }
    },

    {
      id: SettingID.START_LEVEL,
      label: "Start level",
      currentValue: 18,
      allValues: [6, 9, 12, 15, 18, 19, 29],
    },

    {
      id: SettingID.LINECAP,
      label: "Level cap",
      currentValue: NO_CAP,
      allValues: [NO_CAP, 29, 39, 49],
    },

  ];

  constructor(
    private invitationService: InvitationsService,
    private websocketService: WebsocketService,
    private modalService: ModalManagerService,
    private meService: MeService,
  ) {}

  async challenge() {

    const userID = await this.meService.getUserID();
    const username = await this.meService.getUsername();
    const sessionID = this.websocketService.getSessionID();
    if (!userID || !username || !sessionID) return; // if not logged in, do nothing

    let levelCap = this.getSettingValue(SettingID.LINECAP);
    if (levelCap === NO_CAP) levelCap = undefined;

    // set challenge parameters
    const invitation: MatchInvitation = {
      type: InvitationType.MATCH_REQUEST,
      invitationID: uuid(),
      senderID: userID,
      senderUsername: username,
      senderSessionID: sessionID,
      receiverID: this.config.opponentid,
      receiverUsername: this.config.opponentUsername,
      startLevel: this.getSettingValue(SettingID.START_LEVEL),
      winningScore: this.getSettingValue(SettingID.WINNING_SCORE),
      levelCap: levelCap
    }

    console.log("match invitation", invitation);

    this.invitationService.createInvitation(invitation);
    this.modalService.hideModal();
  }

  private getSettingValue(id: SettingID) {
    const setting = this.settings.find(setting => setting.id === id);
    if (setting === undefined) throw new Error("Setting not found");
    return setting.currentValue;
  }

}
