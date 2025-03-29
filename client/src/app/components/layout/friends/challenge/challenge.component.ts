import { ChangeDetectionStrategy, Component, Input, OnChanges, OnInit } from '@angular/core';
import { ButtonColor } from 'src/app/components/ui/solid-button/solid-button.component';
import { FetchService } from 'src/app/services/fetch.service';
import { InvitationsService } from 'src/app/services/state/invitations.service';
import { MeService } from 'src/app/services/state/me.service';
import { WebsocketService } from 'src/app/services/websocket.service';
import { MatchInvitation } from 'src/app/shared/models/invitation';
import { InvitationMode } from 'src/app/shared/network/json-message';


@Component({
  selector: 'app-challenge',
  templateUrl: './challenge.component.html',
  styleUrls: ['./challenge.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChallengeComponent implements OnChanges {
  @Input() invitation!: MatchInvitation;
  @Input() myID!: string;

  isSender: boolean = false;

  readonly ButtonColor = ButtonColor;
  
  constructor(
    private invitationsService: InvitationsService,
  ) {}

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
