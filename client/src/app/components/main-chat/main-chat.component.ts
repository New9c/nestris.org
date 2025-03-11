import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { BehaviorSubject, map, Subscription } from 'rxjs';
import { FetchService, Method } from 'src/app/services/fetch.service';
import { GlobalChatService } from 'src/app/services/state/global-chat.service';
import { MeService } from 'src/app/services/state/me.service';
import { WebsocketService } from 'src/app/services/websocket.service';
import { LoginMethod } from 'src/app/shared/models/db-user';
import { OnGlobalChatMessage } from 'src/app/shared/network/json-message';
import { ProfileModalConfig } from '../modals/profile-modal/profile-modal.component';
import { ModalManagerService, ModalType } from 'src/app/services/modal-manager.service';
import { timeAgo } from 'src/app/util/misc';

@Component({
  selector: 'app-main-chat',
  templateUrl: './main-chat.component.html',
  styleUrls: ['./main-chat.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MainChatComponent implements AfterViewInit, OnDestroy {
  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;

  static showChat = new BehaviorSubject<boolean>(false);
  static lastScrollTop: number | null = null;

  disabledMessage$ = this.meService.get$().pipe(
    map(me => me.login_method === LoginMethod.GUEST ? 'Login to send messages!' : undefined)
  );

  numUsers$ = this.globalChatService.numUsers$;
  hasUnread$ = this.globalChatService.hasUnread$;
  chatImage$ = this.hasUnread$.pipe(map(hasUnread => `./assets/img/button-icons/${hasUnread ? 'chat-unread' : 'chat'}.svg`));

  messages$ = this.globalChatService.get$();
  messagesSubscription?: Subscription;

  constructor(
    private readonly websocketService: WebsocketService,
    private readonly meService: MeService,
    private readonly globalChatService: GlobalChatService,
    private readonly modalManagerService: ModalManagerService,
  ) {

  }
  
  ngAfterViewInit(): void {
    if (this.showChat$.getValue()) {
      if (MainChatComponent.lastScrollTop !== null) {
        this.scrollContainer.nativeElement.scrollTop = MainChatComponent.lastScrollTop;
      }

      this.messagesSubscription = this.messages$.subscribe((messages) => {
        if (messages.length === 0) return;
        const scrollElement = this.scrollContainer.nativeElement;
        const atChatBottom = scrollElement.scrollHeight - scrollElement.scrollTop < 500;
        const containsMyMessage = messages[messages.length-1].userid === this.meService.getSync()!.userid;
        if (atChatBottom || containsMyMessage) setTimeout(() => this.scrollToBottom(), 50);
      });
    }
  }

  @HostListener('window:resize', ['$event'])
  onResize(event: Event) {
    setTimeout(() => this.scrollToBottom(), 50);
  }

  get showChat$() {
    return MainChatComponent.showChat;
  }

  makeChatVisible() {
    this.showChat$.next(true);

    setTimeout(() => {
      // Scroll to bottom if just logged in user just sent a message
      this.messagesSubscription = this.messages$.subscribe((messages) => {
        if (messages.length === 0) return;
        const scrollElement = this.scrollContainer.nativeElement;
        const atChatBottom = scrollElement.scrollHeight - scrollElement.scrollTop < 500;
        const containsMyMessage = messages[messages.length-1].userid === this.meService.getSync()!.userid;
        if (atChatBottom || containsMyMessage) setTimeout(() => this.scrollToBottom(), 50);
      });
    }), 50;

    setTimeout(() => this.scrollToBottom(), 50);
  }

  makeChatInvisible() {
    this.globalChatService.hasUnread$.next(false);
    this.showChat$.next(false);
    this.messagesSubscription?.unsubscribe();
  }

  sendMessage(message: string) {
    const me = this.meService.getSync()!;
    this.websocketService.sendJsonMessage(new OnGlobalChatMessage([{
      userid: me.userid,
      username: me.username,
      league: me.league,
      timeMs: Date.now(),
      message
    }]));
  }

  numUsersMessage(numUsers: number | null): string {
    if (numUsers === null) numUsers = 0;
    return `${numUsers} ${numUsers === 1 ? 'player' : 'players'} online!`;
  }

  getPlayerTooltip(username: string): string {
    return `View ${username}'s profile`;
  }

  viewProfile(userid: string) {
    const config: ProfileModalConfig = { userid };
    this.modalManagerService.showModal(ModalType.PROFILE, config);
  }

  timeAgo(timeMs: number): string {
    const date = new Date(timeMs);
    return timeAgo(date, false, true);
  }

  private scrollToBottom(): void {
    try {
      this.scrollContainer.nativeElement.scrollTop = this.scrollContainer.nativeElement.scrollHeight;
    } catch (err) {}
  }

  ngOnDestroy(): void {
    this.messagesSubscription?.unsubscribe();
    MainChatComponent.lastScrollTop = this.showChat$.getValue() ? this.scrollContainer.nativeElement.scrollTop : null;
  }
}
