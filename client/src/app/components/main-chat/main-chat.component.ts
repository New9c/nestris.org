import { ThisReceiver } from '@angular/compiler';
import { ChangeDetectionStrategy, Component, ElementRef, HostListener, OnDestroy, ViewChild } from '@angular/core';
import { BehaviorSubject, map, Subscription } from 'rxjs';
import { FetchService, Method } from 'src/app/services/fetch.service';
import { GlobalChatService } from 'src/app/services/state/global-chat.service';
import { MeService } from 'src/app/services/state/me.service';
import { WebsocketService } from 'src/app/services/websocket.service';
import { LoginMethod } from 'src/app/shared/models/db-user';
import { OnGlobalChatMessage } from 'src/app/shared/network/json-message';

const MAX_MESSAGES = 20;

@Component({
  selector: 'app-main-chat',
  templateUrl: './main-chat.component.html',
  styleUrls: ['./main-chat.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MainChatComponent implements OnDestroy {
  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;

  static showChat = new BehaviorSubject<boolean>(false);

  numUsers$ = new BehaviorSubject<number>(0);
  numUsersPromise = () => this.fetchService.fetch<any[]>(Method.GET, "api/v2/online-users").then(users => users.length);
  numUsersInterval: any;

  disabledMessage$ = this.meService.get$().pipe(
    map(me => me.login_method === LoginMethod.GUEST ? 'Login to send messages!' : undefined)
  );

  hasUnread$ = this.globalChatService.hasUnread$;
  chatImage$ = this.hasUnread$.pipe(map(hasUnread => `./assets/img/button-icons/${hasUnread ? 'chat-unread' : 'chat'}.svg`));

  messages$ = this.globalChatService.get$();
  messagesSubscription: Subscription;

  constructor(
    private readonly fetchService: FetchService,
    private readonly websocketService: WebsocketService,
    private readonly meService: MeService,
    private readonly globalChatService: GlobalChatService,
  ) {

    // Scroll to bottom if just logged in user just sent a message
    this.messagesSubscription = this.messages$.subscribe((messages) => {
      const scrollElement = this.scrollContainer.nativeElement;
      const atChatBottom = scrollElement.scrollHeight - scrollElement.scrollTop < 500;
      console.log(scrollElement.scrollHeight - scrollElement.scrollTop);
      const containsMyMessage = messages[messages.length-1].userid === this.meService.getSync()!.userid;
      if (atChatBottom || containsMyMessage) setTimeout(() => this.scrollToBottom(), 50);
    });

  }

  @HostListener('window:resize', ['$event'])
  onResize(event: Event) {
    setTimeout(() => this.scrollToBottom(), 50);
  }

  get showChat$() {
    return MainChatComponent.showChat;
  }

  makeChatVisible() {
    this.numUsersInterval = setInterval(async () => {
      this.numUsers$.next(await this.numUsersPromise());
    }, 2000);
    this.numUsersPromise().then((numUsers) => this.numUsers$.next(numUsers));
    this.showChat$.next(true);

    setTimeout(() => this.scrollToBottom(), 50);
  }

  makeChatInvisible() {
    this.globalChatService.hasUnread$.next(false);
    clearInterval(this.numUsersInterval);
    this.showChat$.next(false);
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

  private scrollToBottom(): void {
    try {
      this.scrollContainer.nativeElement.scrollTop = this.scrollContainer.nativeElement.scrollHeight;
    } catch (err) {}
  }

  ngOnDestroy(): void {
    this.makeChatInvisible();
    this.messagesSubscription.unsubscribe();
  }
}
