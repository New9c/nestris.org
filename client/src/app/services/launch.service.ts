import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, interval, Subscription, Subject } from 'rxjs';
import { filter, map, takeWhile, tap } from 'rxjs/operators';
import { ServerStatsService } from './server-stats.service';
import { DeploymentEnvironment } from '../shared/models/server-stats';

const RELEASE_DATE = new Date(Date.UTC(2025, 3, 9, 16 + 5, 0, 0));

// FOR TESTING ONLY
// const RELEASE_DATE = new Date();
// RELEASE_DATE.setSeconds(RELEASE_DATE.getSeconds() + 5);


export interface Countdown { days: number, hours: number, minutes: number, seconds: number };

@Injectable({
  providedIn: 'root'
})
export class LaunchService {
  private secondsToLaunch$ = new BehaviorSubject<number>(0);
  public countdown$?: Observable<Countdown>;
  private intervalSubscription?: Subscription;

  public show$: BehaviorSubject<boolean> = new BehaviorSubject(false);
  public launch$ = new BehaviorSubject(false);

  constructor(
    private readonly serverStats: ServerStatsService,
  ) {
    const initialSeconds = this.calculateSeconds();
    if (initialSeconds < 0) {
      console.log('launched');
      return;
    }

    this.serverStats.waitForServerStats().then(stats => {
      if (stats.environment === DeploymentEnvironment.PRODUCTION) this.show$.next(true);
    });
    
    this.secondsToLaunch$.next(initialSeconds);
    
    this.intervalSubscription = interval(1000).pipe(
      map(() => this.calculateSeconds()),
      tap(seconds => {
        this.secondsToLaunch$.next(seconds);
        if (seconds <= -4) {
          console.log('launched');
          this.show$.next(false);
          this.intervalSubscription?.unsubscribe();
        } else if (seconds <= 0) {
          this.launch$.next(true);
        }
      })
    ).subscribe();

    this.countdown$ = this.secondsToLaunch$.pipe(
      filter(seconds => seconds >= 0),
      map(seconds => this.convertToTimeObject(seconds))
    );
  }

  private calculateSeconds(): number {
    return Math.floor((RELEASE_DATE.getTime() - Date.now()) / 1000);
  }

  private convertToTimeObject(seconds: number): Countdown {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return { days, hours, minutes, seconds: secs };
  }
}
