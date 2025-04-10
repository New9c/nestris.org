import { Component } from '@angular/core';
import { FetchService, Method } from 'src/app/services/fetch.service';
import { NotificationService } from 'src/app/services/notification.service';
import { NotificationType } from 'src/app/shared/models/notifications';

@Component({
  selector: 'app-control-panel-page',
  templateUrl: './control-panel-page.component.html',
  styleUrls: ['./control-panel-page.component.scss']
})
export class ControlPanelPageComponent {

  public announcement: string | null = null;
  
  constructor(
    private fetchService: FetchService,
    private notificationService: NotificationService,
  ) {}


  async toggleServerRestart() {
    await this.fetchService.fetch(Method.POST, '/api/v2/server-restart-warning');
  }

  onAnnouncementChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.announcement = input.value.trim();
    console.log("Announcement changed", this.announcement);
  }

  async sendServerAnnouncement() {
    await this.fetchService.fetch(Method.POST, '/api/v2/announcement', { message: this.announcement ?? null });
    this.notificationService.notify(NotificationType.SUCCESS, "Server announcement set");
  }

  async clearUserCache() {
    await this.fetchService.fetch(Method.POST, '/api/v2/user-cache/clear');
    this.notificationService.notify(NotificationType.SUCCESS, "User cache cleared");
  }

}
