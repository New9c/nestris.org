import { Injectable } from '@angular/core';
import { BehaviorSubject, filter, firstValueFrom, Observable } from 'rxjs';
import { DeploymentEnvironment, ServerStats } from '../shared/models/server-stats';
import { BannerManagerService, BannerPriority, BannerType } from './banner-manager.service';
import { FetchService, Method } from './fetch.service';

@Injectable({
  providedIn: 'root'
})
export class ServerStatsService {

  private serverStats$ = new BehaviorSubject<ServerStats | undefined>(undefined);

  constructor(
    private readonly fetchService: FetchService,
    private readonly bannerManager: BannerManagerService
  ) {
    this.fetchServerStats();
  }

  private async fetchServerStats(): Promise<void> {
    try {
      const stats = await this.fetchService.fetch<ServerStats>(Method.GET, '/api/v2/server-stats');
      this.serverStats$.next(stats);
      
      if (stats.environment === DeploymentEnvironment.PRODUCTION) {
        this.bannerManager.addBanner({
          id: BannerType.BETA_WARNING,
          priority: BannerPriority.LOW,
          color: "#3C5EB7",
          message: "Join our <a href='https://discord.gg/4xkBHvGtzp' target='_blank'><u>Discord</u></a> community, or support us on <a href='https://www.patreon.com/c/nestrisorg' target='_blank'><u>Patreon</u></a>!"
        });
      } else if (stats.environment === DeploymentEnvironment.STAGING) {
        this.bannerManager.addBanner({
          id: BannerType.STAGING_WARNING,
          priority: BannerPriority.HIGH,
          color: "#B73C3C",
          message: "You are on the beta. Learn more at our <a href='https://discord.gg/4xkBHvGtzp' target='_blank'><u>Discord</u></a> server."
        });
      } else if (stats.environment === DeploymentEnvironment.DEV) {
        this.bannerManager.addBanner({
          id: BannerType.DEV_WARNING,
          priority: BannerPriority.HIGH,
          color: "#6c3cb7",
          message: "You are running on a local development environment. Learn more at our <a href='https://discord.gg/4xkBHvGtzp' target='_blank'><u>Discord</u></a> server."
        });
      }
    } catch (error) {
      console.error('Failed to fetch server stats:', error);
    }
  }

  getServerStats$(): Observable<ServerStats> {
    return this.serverStats$.pipe(
      filter((stats): stats is ServerStats => stats !== undefined)
    );
  }

  // Wait for the server stats to be fetched before returning
  async waitForServerStats(): Promise<ServerStats> {
    return firstValueFrom(this.getServerStats$());
  }
}
