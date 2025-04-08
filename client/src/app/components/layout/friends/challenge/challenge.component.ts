import { ChangeDetectionStrategy, Component, Input, OnChanges, OnInit } from '@angular/core';
import { ButtonColor } from 'src/app/components/ui/solid-button/solid-button.component';
import { FetchService } from 'src/app/services/fetch.service';
import { PlatformInterfaceService } from 'src/app/services/platform-interface.service';
import { InvitationsService } from 'src/app/services/state/invitations.service';
import { MeService } from 'src/app/services/state/me.service';
import { WebsocketService } from 'src/app/services/websocket.service';
import { InvitationType, MatchInvitation, PuzzleBattleInvitation } from 'src/app/shared/models/invitation';
import { InvitationMode } from 'src/app/shared/network/json-message';
import { pluralize } from 'src/app/util/misc';


@Component({
  selector: 'app-challenge',
  templateUrl: './challenge.component.html',
  styleUrls: ['./challenge.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChallengeComponent implements OnChanges {
  @Input() invitation!: MatchInvitation | PuzzleBattleInvitation;
  @Input() myID!: string;

  isSender: boolean = false;

  readonly ButtonColor = ButtonColor;
  
  constructor(
    private invitationsService: InvitationsService,
    private platformService: PlatformInterfaceService,
  ) {}

  matchLabel() {
    return this.invitation.type === InvitationType.MATCH_REQUEST ? 'a match' : 'Puzzle Wars';
  }

  asMatchInvitation() {
    return this.invitation.type === InvitationType.MATCH_REQUEST ? this.invitation as MatchInvitation : null;
  }

  asPuzzleBattleInvitation() {
    return this.invitation.type === InvitationType.PUZZLE_BATTLE_REQUEST ? this.invitation as PuzzleBattleInvitation : null;
  }

  labelStrike(strikes: number) {
    if (strikes === 1) return "Single strike";
    return `${strikes} strikes`;
  }

  labelDuration(duration: number) {
    return (duration % 60 === 0) ? pluralize('minute', duration/60) : pluralize('second', duration);
  }

  ngOnChanges() {
    this.isSender = this.myID === this.invitation.senderID;
  }

  acceptChallenge() {
    this.invitationsService.sendInvitationMessage(InvitationMode.ACCEPT, this.invitation);
  }

  rejectChallenge() {
    this.invitationsService.sendInvitationMessage(InvitationMode.CANCEL, this.invitation);
  }


}
