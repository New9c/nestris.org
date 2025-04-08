import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { ButtonColor } from '../../ui/solid-button/solid-button.component';
import { ModalManagerService } from 'src/app/services/modal-manager.service';
import { WebsocketService } from 'src/app/services/websocket.service';
import { MeService } from 'src/app/services/state/me.service';
import { InvitationsService } from 'src/app/services/state/invitations.service';
import { InvitationType, MatchInvitation, PuzzleBattleInvitation } from 'src/app/shared/models/invitation';
import { v4 as uuid } from 'uuid';

export interface ChallengeModalConfig {
  opponentid: string;
  opponentUsername: string;
}

export enum SettingID {
  MODE,
  WINNING_SCORE,
  START_LEVEL,
  LINECAP,
  PUZZLE_BATTLE_DURATION,
  PUZZLE_BATTLE_STRIKES,
}

export interface Setting {
  id: SettingID,
  label: string;
  currentValue: any;
  allValues: any[];
  valueStrings?: {[key in any]: string};
  icons?: {[key in any]: string};
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

  public modeSetting: Setting = {
    id: SettingID.MODE,
    label: "Select mode",
    currentValue: InvitationType.MATCH_REQUEST,
    allValues: [InvitationType.MATCH_REQUEST, InvitationType.PUZZLE_BATTLE_REQUEST],
    valueStrings: {
      [InvitationType.MATCH_REQUEST] : 'Normal',
      [InvitationType.PUZZLE_BATTLE_REQUEST] : 'Puzzle Wars'
    },
    icons: {
      [InvitationType.MATCH_REQUEST] : './assets/img/activity-icons/pb.svg',
      [InvitationType.PUZZLE_BATTLE_REQUEST] : './assets/img/puzzle-mode/rush.svg',
    }
  };

  // Static so that settings can be saved through session
  static readonly settings: Setting[] = [

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
      allValues: [0, 6, 9, 12, 15, 18, 19, 29],
    },

    {
      id: SettingID.LINECAP,
      label: "Level cap",
      currentValue: NO_CAP,
      allValues: [NO_CAP, 19, 29, 39, 49],
    },

    {
      id: SettingID.PUZZLE_BATTLE_DURATION,
      label: "Duration",
      currentValue: 180,
      allValues: [30, 60, 180],
      valueStrings: {
        30: '30 seconds',
        60: '2 minutes',
        180: '3 minutes'
      }
    },
    {
      id: SettingID.PUZZLE_BATTLE_STRIKES,
      label: "Strikes",
      currentValue: 3,
      allValues: [1, 2, 3],
    },

  ];

  private modes: {[mode in InvitationType]? : SettingID[]} = {
    [InvitationType.MATCH_REQUEST] : [ SettingID.WINNING_SCORE, SettingID.START_LEVEL, SettingID.LINECAP ],
    [InvitationType.PUZZLE_BATTLE_REQUEST] : [ SettingID.PUZZLE_BATTLE_DURATION, SettingID.PUZZLE_BATTLE_STRIKES ],
  };

  constructor(
    private invitationService: InvitationsService,
    private websocketService: WebsocketService,
    private modalService: ModalManagerService,
    private meService: MeService,
  ) {}

  get settings() {
    return ChallengeModalComponent.settings;
  }

  get visibleSettings() {
    const visible = this.modes[this.modeSetting.currentValue as InvitationType] ?? [];
    return this.settings.filter(setting => visible.includes(setting.id));
  }

  async challenge() {

    const userID = await this.meService.getUserID();
    const username = await this.meService.getUsername();
    const sessionID = this.websocketService.getSessionID();
    if (!userID || !username || !sessionID) return; // if not logged in, do nothing

    let levelCap = this.getSettingValue(SettingID.LINECAP);
    if (levelCap === NO_CAP) levelCap = undefined;

    // set challenge parameters
    const baseInvitation = {
      invitationID: uuid(),
      senderID: userID,
      senderUsername: username,
      senderSessionID: sessionID,
      receiverID: this.config.opponentid,
      receiverUsername: this.config.opponentUsername,
    };
    
    let invitation: MatchInvitation | PuzzleBattleInvitation;
    
    if (this.modeSetting.currentValue === InvitationType.MATCH_REQUEST) {
      invitation = {
        ...baseInvitation,
        type: InvitationType.MATCH_REQUEST,
        startLevel: this.getSettingValue(SettingID.START_LEVEL),
        winningScore: this.getSettingValue(SettingID.WINNING_SCORE),
        levelCap: levelCap,
      };
    } else {
      invitation = {
        ...baseInvitation,
        type: InvitationType.PUZZLE_BATTLE_REQUEST,
        duration: this.getSettingValue(SettingID.PUZZLE_BATTLE_DURATION),
        strikes: this.getSettingValue(SettingID.PUZZLE_BATTLE_STRIKES),
      };
    }

    this.invitationService.createInvitation(invitation);
    this.modalService.hideModal();
  }

  private getSettingValue(id: SettingID) {
    const setting = this.settings.find(setting => setting.id === id);
    if (setting === undefined) throw new Error("Setting not found");
    return setting.currentValue;
  }

  allowSwitchToValue(setting: Setting, value: any) {

    let linecap = this.getSettingValue(SettingID.LINECAP);
    if (setting.id === SettingID.LINECAP) linecap = value;

    let startLevel = this.getSettingValue(SettingID.START_LEVEL);
    if (setting.id === SettingID.START_LEVEL) startLevel = value;

    return linecap === NO_CAP || startLevel < linecap;
  }

}
