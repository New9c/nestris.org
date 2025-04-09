import { Component, OnDestroy, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { BehaviorSubject, interval, map, Subscription } from "rxjs";
import { RankedQueueService } from "src/app/services/room/ranked-queue.service";
import { SoundEffect, SoundService } from "src/app/services/sound.service";
import { MeService } from "src/app/services/state/me.service";
import { NumQueuingPlayersMessage, QueueType } from "src/app/shared/network/json-message";
import { pluralize } from "src/app/util/misc";


@Component({
  selector: 'app-matchmaking-loading-page',
  templateUrl: './matchmaking-loading-page.component.html',
  styleUrls: ['./matchmaking-loading-page.component.scss']
})
export class MatchmakingLoadingPageComponent implements OnInit, OnDestroy {

    score: number = 0;
    scoreVisible: boolean = false;

    numPeriods$: BehaviorSubject<number> = new BehaviorSubject(0);
    intervalSubscription!: Subscription;
    foundSubscription: Subscription;

    readonly playersInQueue$ = this.rankedQueueService.getNumQueuingPlayers$();
    readonly foundOpponent$ = this.rankedQueueService.getFoundOpponent$();
    readonly me$ = this.meService.get$();

    readonly QueueType = QueueType;
    readonly pluralize = pluralize;

    constructor(
        private meService: MeService,
        public rankedQueueService: RankedQueueService,
        private sound: SoundService,
        private router: Router,
    ) {
        this.foundSubscription = this.foundOpponent$.subscribe(() => {
            setTimeout(() => this.sound.play(SoundEffect.SWORD), 2100);
        });
    }
    
    async ngOnInit() {

        // rotate between '', '.', '..', '...' for the periods
        this.intervalSubscription = interval(500).subscribe(() => {
            this.numPeriods$.next((this.numPeriods$.value + 1) % 4);
        });

        // Join the ranked queue, if not already in queue
        const success = await this.rankedQueueService.joinQueue();
        
        // If the user was not successfully added to the queue, navigate back to home
        if (!success) this.router.navigate(['/']);   
    }

    async ngOnDestroy() {

        // Leave the ranked queue
        await this.rankedQueueService.leaveQueue();

        this.intervalSubscription.unsubscribe();
        this.foundSubscription?.unsubscribe();
    }

    getMessage(periods: number) {
      return `Searching for opponent` + ('.'.repeat(periods));
    }

    setScore(score: number) {
        this.score = score;
        if (score > 0) this.scoreVisible = true;
    }

    queueCount(message: NumQueuingPlayersMessage | null, queueType: QueueType) {
        if (!message) return 0;
        return queueType === QueueType.RANKED ? message.rankedCount : message.battleCount;
    }

}
