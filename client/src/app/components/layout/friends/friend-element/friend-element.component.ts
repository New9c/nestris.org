import { ChangeDetectionStrategy, Component, Input, OnInit } from '@angular/core';
import { ChallengeModalConfig } from 'src/app/components/modals/challenge-modal/challenge-modal.component';
import { ButtonColor } from 'src/app/components/ui/solid-button/solid-button.component';
import { FriendsService } from 'src/app/services/state/friends.service';
import { ModalManagerService, ModalType } from 'src/app/services/modal-manager.service';
import { FriendInfo, FriendStatus } from 'src/app/shared/models/friends';
import { ProfileModalConfig } from 'src/app/components/modals/profile-modal/profile-modal.component';
import { OnlineUserActivityType } from 'src/app/shared/models/online-activity';
import { FetchService, Method } from 'src/app/services/fetch.service';
import { RoomState } from 'src/app/shared/room/room-models';
import { WebsocketService } from 'src/app/services/websocket.service';
import { NotificationService } from 'src/app/services/notification.service';
import { NotificationType } from 'src/app/shared/models/notifications';
import { ServerStatsService } from 'src/app/services/server-stats.service';
import { map } from 'rxjs';
import { DeploymentEnvironment } from 'src/app/shared/models/server-stats';

interface SpectateActivity {
  tooltip: string;
  canSpectate: boolean;
}

@Component({
  selector: 'app-friend-element',
  templateUrl: './friend-element.component.html',
  styleUrls: ['./friend-element.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FriendElementComponent implements OnInit {
  @Input() friendInfo!: FriendInfo;

  readonly FriendStatus = FriendStatus;
  readonly ButtonColor = ButtonColor;
  readonly DeploymentEnvironment = DeploymentEnvironment;

  spectateActivities!: {[key in OnlineUserActivityType] : SpectateActivity };
  noActivityTooltip!: string;
  notOnlineTooltip!: string;

  busyActivities!: {[key in OnlineUserActivityType] : string };

  environment$ = this.serverStatsService.getServerStats$().pipe(
    map(stats => stats.environment)
  );

  constructor(
    private readonly modalService: ModalManagerService,
    private readonly friendsService: FriendsService,
    private readonly modalManagerService: ModalManagerService,
    private readonly fetchService: FetchService,
    private readonly websocketService: WebsocketService,
    private readonly notificationService: NotificationService,
    private readonly serverStatsService: ServerStatsService,
  ) {}

  ngOnInit(): void {
    this.spectateActivities = {
      [OnlineUserActivityType.SOLO] : { canSpectate: true, tooltip: `Watch ${this.friendInfo.username}'s solo game!` },
      [OnlineUserActivityType.MULTIPLAYER] : { canSpectate: true, tooltip: `Watch ${this.friendInfo.username}'s ranked match!` },
      [OnlineUserActivityType.QUEUEING] : { canSpectate: false, tooltip: `${this.friendInfo.username} is currently queuing` },
      [OnlineUserActivityType.PUZZLES] : { canSpectate: false, tooltip: `${this.friendInfo.username} is solving a puzzle` },
      [OnlineUserActivityType.PUZZLE_RUSH] : { canSpectate: false, tooltip: `${this.friendInfo.username} is in Puzzle Blitz!` },
      [OnlineUserActivityType.PUZZLE_BATTLES] : { canSpectate: false, tooltip: `${this.friendInfo.username} is playing Puzzle Wars!` },
    };

    this.busyActivities = {
      [OnlineUserActivityType.SOLO] : `${this.friendInfo.username} is busy playing a solo game!`,
      [OnlineUserActivityType.MULTIPLAYER] : `${this.friendInfo.username} is busy playing a match!`,
      [OnlineUserActivityType.QUEUEING] : `${this.friendInfo.username} is busy queuing for a ranked match!`,
      [OnlineUserActivityType.PUZZLES] : `${this.friendInfo.username} is busy solving a puzzle!`,
      [OnlineUserActivityType.PUZZLE_RUSH] : `${this.friendInfo.username} is busy playing Puzzle Blitz!`,
      [OnlineUserActivityType.PUZZLE_BATTLES] : `${this.friendInfo.username} is busy playing Puzzle Wars!`
    };

    this.noActivityTooltip = `${this.friendInfo.username} is currently idle`;
    this.notOnlineTooltip = `${this.friendInfo.username} is not online`;
  }


  // send a message to server to end friendship between logged-in user and friend
  async endFriendship() {
    this.friendsService.removeFriend(this.friendInfo.userid);
  }

  async sendChallenge() {
    const config: ChallengeModalConfig = {
      opponentid: this.friendInfo.userid,
      opponentUsername: this.friendInfo.username
    };
    this.modalService.showModal(ModalType.CHALLENGE_PLAYER, config);
  }

  // Get the current room the friend is in and spectate it
  async spectate() {

    let roomState: RoomState | null = null;
    try {
      roomState = (await this.fetchService.fetch<{roomState: RoomState | null}>(Method.POST,
        `/api/v2/spectate-room-of-user/${this.friendInfo.userid}/${this.websocketService.getSessionID()}`
      )).roomState;
    } catch {}

    if (!roomState) this.notificationService.notify(NotificationType.ERROR, "Something went wrong");
  }

  viewProfile() {
    const config: ProfileModalConfig = { userid: this.friendInfo.userid };
    this.modalManagerService.showModal(ModalType.PROFILE, config);
  }
}
