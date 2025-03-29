import { Injectable } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { WebsocketService } from './websocket.service';
import { AnalyticsEventMessage } from '../shared/network/json-message';
import { MeService } from './state/me.service';

@Injectable({
  providedIn: 'root'
})
export class AnalyticsService {

  constructor(
    private readonly websocket: WebsocketService,
    private readonly me: MeService,
    private readonly router: Router
  ) {

    this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        this.onURLChange(event.url);
      }
    });

    this.onSiteLoad();
  }

  public async sendEvent(event: string, properties: {[key: string]: any} = {}) {
    await this.websocket.waitForSignIn();
    const userid = await this.me.getUserID();

    console.log("Analytics event", userid, event, properties);

    properties['$session_id'] = this.websocket.getSessionID();
    this.websocket.sendJsonMessage(new AnalyticsEventMessage(userid, event, properties));
  }

  public async onSiteLoad() {
    this.sendEvent('pageload', { $referrer: document.referrer });
  }

  public async onURLChange(url: string) {
    this.sendEvent('$pageview', { $current_url: url});
  }
}
