import { ChangeDetectionStrategy, Component, OnDestroy } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { FetchService, Method } from 'src/app/services/fetch.service';

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

  constructor(
    private readonly fetchService: FetchService
  ) {

    this.numUsersInterval = setInterval(async () => {
      this.numUsers$.next(await this.numUsersPromise());
    }, 2000);
    this.numUsersPromise().then((numUsers) => this.numUsers$.next(numUsers));
  }

  get showChat$() {
    return MainChatComponent.showChat;
  }

  ngOnDestroy(): void {
    clearInterval(this.numUsersInterval);
  }
}
