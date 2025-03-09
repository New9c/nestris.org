import { ThisReceiver } from '@angular/compiler';
import { ChangeDetectionStrategy, Component, OnDestroy } from '@angular/core';
import { BehaviorSubject, map, Subscription } from 'rxjs';
import { FetchService, Method } from 'src/app/services/fetch.service';
import { MeService } from 'src/app/services/state/me.service';
import { WebsocketService } from 'src/app/services/websocket.service';
import { LoginMethod } from 'src/app/shared/models/db-user';
import { GlobalChatConnectMessage, GlobalChatMessage, JsonMessageType } from 'src/app/shared/network/json-message';

const MAX_MESSAGES = 20;

@Component({
  selector: 'app-main-chat',
  templateUrl: './main-chat.component.html',
  styleUrls: ['./main-chat.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MainChatComponent implements OnDestroy {

  static showChat = new BehaviorSubject<boolean>(false);

  numUsers$ = new BehaviorSubject<number>(0);
  numUsersPromise = () => this.fetchService.fetch<any[]>(Method.GET, "api/v2/online-users").then(users => users.length);
  numUsersInterval: any;
  globalChatSubscription?: Subscription;

  messages$ = new BehaviorSubject<GlobalChatMessage[]>([]);

  disabledMessage$ = this.meService.get$().pipe(
    map(me => me.login_method === LoginMethod.GUEST ? 'Login to send messages!' : undefined)
  );

  constructor(
    private readonly fetchService: FetchService,
    private readonly websocketService: WebsocketService,
    private readonly meService: MeService,
  ) {

    this.globalChatSubscription = this.websocketService.onEvent<GlobalChatMessage>(
      JsonMessageType.GLOBAL_CHAT_MESSAGE
    ).subscribe(message => {
      const messages = [ ...this.messages$.getValue(), message ];
      if (messages.length > MAX_MESSAGES) messages.shift();
      this.messages$.next(messages);
    })

  }

  get showChat$() {
    return MainChatComponent.showChat;
  }

  makeChatVisible() {

    this.websocketService.sendJsonMessage(new GlobalChatConnectMessage(true));

    this.numUsersInterval = setInterval(async () => {
      this.numUsers$.next(await this.numUsersPromise());
    }, 2000);
    this.numUsersPromise().then((numUsers) => this.numUsers$.next(numUsers));
    this.showChat$.next(true);
  }

  makeChatInvisible() {
    this.websocketService.sendJsonMessage(new GlobalChatConnectMessage(false));
    clearInterval(this.numUsersInterval);
    this.showChat$.next(false);
    this.messages$.next([]);
  }

  sendMessage(message: string) {
    const me = this.meService.getSync()!;
    this.websocketService.sendJsonMessage(new GlobalChatMessage(
      me.userid,
      me.username,
      me.league,
      Date.now(),
      message
    ));
  }

  numUsersMessage(numUsers: number | null): string {
    if (numUsers === null) numUsers = 0;
    return `${numUsers} ${numUsers === 1 ? 'player' : 'players'} online!`;
  }

  ngOnDestroy(): void {
    this.makeChatInvisible();
    this.globalChatSubscription?.unsubscribe();
  }
}
