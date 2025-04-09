import { Injectable } from '@angular/core';
import { WebsocketService } from './websocket.service';
import { Router } from '@angular/router';
import { JsonMessageType, QuestCompleteMessage, RedirectMessage, TrophyChangeMessage } from '../shared/network/json-message';
import { AlertService } from './alert.service';
import { QuestAlertComponent } from '../components/alerts/quest-alert/quest-alert.component';
import { QuestID } from '../shared/nestris-org/quest-system';
import { TrophyAlertComponent } from '../components/alerts/trophy-alert/trophy-alert.component';

const TROPHY_ALERT_DURATION = 5;

/*
Handles miscellaneous JsonMessages from the server that don't fit into any other service
*/

@Injectable({
  providedIn: 'root'
})
export class MiscMessageHandlerService {

  constructor(
    private websocket: WebsocketService,
    private router: Router,
    private alertService: AlertService,
  ) {

    this.websocket.onEvent<RedirectMessage>(JsonMessageType.REDIRECT).subscribe((message) => {
      this.router.navigate([message.route]);
    });

    this.websocket.onEvent<TrophyChangeMessage>(JsonMessageType.TROPHY_CHANGE).subscribe((message) => {
      this.alertService.addAlert(
        TrophyAlertComponent,
        `trophyAlert`,
        {type: message.queueType, startTrophies: message.startTrophies, trophyDelta: message.trophyDelta},
        TROPHY_ALERT_DURATION
      );
    });
  }



}
