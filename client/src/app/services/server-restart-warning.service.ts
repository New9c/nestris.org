import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { WebsocketService } from './websocket.service';
import { JsonMessageType, ServerAnnouncementMessage, ServerRestartWarningMessage } from '../shared/network/json-message';
import { BannerManagerService, BannerPriority, BannerType } from './banner-manager.service';
import { NotificationService } from './notification.service';
import { NotificationAutohide, NotificationType } from '../shared/models/notifications';
import { FetchService, Method } from './fetch.service';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class ServerRestartWarningService {

  private _warning$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  private notificationID: string | undefined;

  public warning$ = this._warning$.asObservable();

  constructor(
    private fetchService: FetchService,
    private websocketService: WebsocketService,
    private bannerService: BannerManagerService,
    private notificationService: NotificationService,
    private router: Router,
  ) {

    // Subscribe to changes in server restart warning
    this.websocketService.onEvent(JsonMessageType.SERVER_RESTART_WARNING).subscribe((warningMessage) => {
      const warning = (warningMessage as ServerRestartWarningMessage).warning;
      console.log("Server restart warning", warning);
      this.setWarning(warning);
    });

    this.websocketService.onEvent(JsonMessageType.SERVER_ANNOUNCEMENT).subscribe((warningMessage) => {
      const announcement = (warningMessage as ServerAnnouncementMessage).message;
      this.bannerService.removeBanner(BannerType.ANNOUNCEMENT);
      if (announcement) {
          this.bannerService.addBanner({
          id: BannerType.ANNOUNCEMENT,
          priority: BannerPriority.HIGH,
          message: announcement,
          color: "#B73C3C",
        });
      }
    });
  }

  private setWarning(warning: boolean) {

    console.log("Setting server restart warning", warning);

    if (warning) {

      // Leave ranked queue
      if (this.router.url === '/online/ranked') this.router.navigate(["/"]);

      // Send a notification
      this.notificationID = this.notificationService.notify(
        NotificationType.WARNING,
        "The server will restart in a few minutes! Please refrain from starting new games.",
        NotificationAutohide.DISABLED,
        true
      );

      console.log("Showing notification", this.notificationID);

      // Set a banner
      this.bannerService.addBanner({
        id: BannerType.SERVER_RESTART_WARNING,
        priority: BannerPriority.HIGH,
        message: "The server will restart in a few minutes! Please refrain from starting new games.",
        color: "#B73C3C",
      });

    } else {
      // Remove the banner
      this.bannerService.removeBanner(BannerType.SERVER_RESTART_WARNING);

      // Remove the notification, if it exists
      if (this.notificationID) {
        console.log("Hiding notification", this.notificationID);
        this.notificationService.hide(this.notificationID);
        this.notificationID = undefined;
      }
    }

    this._warning$.next(warning);
  }

  public isWarning(): boolean {
    return this._warning$.getValue();
  }

}
