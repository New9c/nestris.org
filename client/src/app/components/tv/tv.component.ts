import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Subscription } from 'rxjs';
import { FetchService, Method } from 'src/app/services/fetch.service';
import { RoomService } from 'src/app/services/room/room.service';
import { SoundEffect } from 'src/app/services/sound.service';
import { WebsocketService } from 'src/app/services/websocket.service';


@Component({
  selector: 'app-tv',
  templateUrl: './tv.component.html',
  styleUrls: ['./tv.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TvComponent implements OnInit, OnDestroy {
  static expanded$ = new BehaviorSubject<boolean>(false);

  readonly roomInfo$ = this.roomService.getRoomInfo$();
  readonly SoundEffect = SoundEffect;

  private loadTVInterval: any;
  private matchEndSubscription?: Subscription;

  constructor(
    private readonly roomService: RoomService,
    private readonly fetchService: FetchService,
    private readonly websocketService: WebsocketService,
    private readonly router: Router,
  ) {
    this.loadTVInterval = setInterval(() => this.loadTvRoom(), 2000);
  }

  ngOnInit(): void {
    this.matchEndSubscription = this.roomService.onMatchEnd$.subscribe(() => {

      // When a match ends, start spectating the next match in a little bit
      const roomID = this.roomService.getRoomInfo()?.id;
      if (roomID) setTimeout(() => {
        if (this.roomService.getRoomInfo()?.id === roomID) this.roomService.leaveRoom();
      }, 3000);
    });
  }

  get expanded$() {
    return TvComponent.expanded$;
  }
  
  get expanded() {
    return this.expanded$.getValue();
  }

  onClick() {
    if (this.expanded) {
      this.onClickExpand();
    } else {
      this.expanded$.next(true);
      this.loadTvRoom();
    }
  }

  async loadTvRoom() {

    // If not showing, or room already loaded, don't request
    if (!this.expanded || this.roomService.getRoomInfo()) return;

    try {
      await this.fetchService.fetch<{id: string}>(Method.POST, `/api/v2/spectate-room/tv/${this.websocketService.getSessionID()}`);
    } catch {
      console.log("No tv room found right now");
    }
    
  }

  onClickX(event: MouseEvent) {
    this.expanded$.next(false);
    event.stopPropagation();
    
    if (this.roomService.getRoomInfo()) this.roomService.leaveRoom();
  }

  onClickExpand(event?: MouseEvent) {
    event?.stopPropagation();

    const roomInfo = this.roomService.getRoomInfo();
    if (roomInfo) {
      this.router.navigate(['/online/room'], { queryParams: {id: roomInfo.id }});
    }
  }

  ngOnDestroy() {
    clearInterval(this.loadTVInterval);
    this.matchEndSubscription?.unsubscribe();
  }
}
