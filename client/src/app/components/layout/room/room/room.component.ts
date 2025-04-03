import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { RoomService } from 'src/app/services/room/room.service';
import { BehaviorSubject, Subscription } from 'rxjs';
import { RoomState, RoomType, SPECTATOR_ONLY_CHAT_TYPES } from 'src/app/shared/room/room-models';
import { ActivatedRoute, Router } from '@angular/router';
import { PlatformInterfaceService } from 'src/app/services/platform-interface.service';
import { QuestService } from 'src/app/services/quest.service';
import { WebsocketService } from 'src/app/services/websocket.service';
import { FetchService, Method } from 'src/app/services/fetch.service';
import { NotificationService } from 'src/app/services/notification.service';
import { NotificationType } from 'src/app/shared/models/notifications';
import { SoundEffect, SoundService } from 'src/app/services/sound.service';
import { MultiplayerRoomState } from 'src/app/shared/room/multiplayer-room-models';
import { InRoomStatus } from 'src/app/shared/network/json-message';

export enum RoomModal {
  SOLO_BEFORE_GAME = 'SOLO_BEFORE_GAME',
  SOLO_AFTER_GAME = 'SOLO_AFTER_GAME',
  MULTIPLAYER_AFTER_MATCH = 'MULTIPLAYER_AFTER_MATCH',
}

@Component({
  selector: 'app-room',
  templateUrl: './room.component.html',
  styleUrls: ['./room.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RoomComponent implements OnInit, OnDestroy {
  readonly RoomModal = RoomModal;
  readonly RoomType = RoomType;

  private gameDataSubscription?: Subscription;
  public roomType$ = new BehaviorSubject<RoomType | null>(null);

  public spectating$ = new BehaviorSubject<boolean>(false);

  public roomChatTypes: RoomType[] = [
    RoomType.MULTIPLAYER,
    RoomType.SOLO
  ];

  public globalChatTypes: RoomType[] = [
    //RoomType.SOLO
  ];

  readonly SPECTATOR_ONLY_CHAT_TYPES = SPECTATOR_ONLY_CHAT_TYPES;

  constructor(
    public readonly roomService: RoomService,
    private readonly platform: PlatformInterfaceService,
    private readonly activeQuestService: QuestService,
    private readonly websocketService: WebsocketService,
    private readonly fetchService: FetchService,
    private readonly router: Router,
    private readonly activatedRoute: ActivatedRoute,
    private readonly cdr: ChangeDetectorRef,
    private readonly sound: SoundService,
  ) {}

  

  async ngOnInit() {

    this.gameDataSubscription = this.platform.getGameData$().subscribe(() => this.cdr.detectChanges());

    const roomType = this.roomService.getRoomType();
    this.roomType$.next(roomType);

    console.log('Room type:', roomType);

    // If not in room, redirect to home
    if (!roomType) {

      // If roomid in query params, send spectate request
      const roomID = this.activatedRoute.snapshot.queryParamMap.get('id');
      if (roomID) {
        await this.websocketService.waitForSignIn();
        const sessionID = this.websocketService.getSessionID();
        const { roomState } = await this.fetchService.fetch<{roomState: RoomState}>(Method.POST, `/api/v2/spectate-room/${roomID}/${sessionID}`);
        
        if (roomState) {

          // TERRIBLE. Setting timeout to avoid race condition and let InRoomStatus message receive
          setTimeout(() => {
            this.roomType$.next(roomState.type);
            this.spectating$.next(true);
          }, 100);
          
        } else {
          this.router.navigate(['/']);
        }

      } else {
        // Otherwise, user probably accidentally navigated to empty room url. go back home
        this.router.navigate(['/']);
      }      
    } else {
      if (this.roomService.getClient().status === InRoomStatus.SPECTATOR) this.spectating$.next(true);
    }
  }

  public async sendChatMessage(message: string) {
    await this.roomService.sendChatMessage(message);
  }


  // Leave the room when the component is destroyed
  async ngOnDestroy() {
    await this.roomService.leaveRoom();
    this.gameDataSubscription?.unsubscribe();

    // Reset any active quest
    this.activeQuestService.activeQuestID$.next(null);
  }

}
