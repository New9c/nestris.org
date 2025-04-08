import { ClientRoom } from "./client-room";
import { InRoomStatus, InRoomStatusMessage } from "src/app/shared/network/json-message";
import { AnalyticsService } from "../analytics.service";
import { PuzzleRushAttemptEvent, PuzzleRushEventType, PuzzleRushRoomState, PuzzleRushStatus } from "src/app/shared/room/puzzle-rush-models";
import { MeService } from "../state/me.service";
import { StartableTimer, Timer } from "src/app/util/timer";
import { SoundEffect, SoundService } from "../sound.service";
import { PuzzleSubmission } from "src/app/models/puzzles/puzzle";
import { RoomType } from "src/app/shared/room/room-models";
import { BehaviorSubject } from "rxjs";
import { numberAttribute } from "@angular/core";
import { pluralize } from "src/app/util/misc";

export interface SelectedIndex {
    playerIndex: number,
    puzzleIndex: number
}

export class PuzzleRushClientRoom extends ClientRoom {

    readonly analytics = this.injector.get(AnalyticsService);
    readonly sound = this.injector.get(SoundService);
    readonly me = this.injector.get(MeService);

    private myIndex!: number;

    public rushTimer!: StartableTimer;
    public countdownTimer!: StartableTimer;

    private readonly _text$ = new BehaviorSubject<string>("");
    public readonly text$ = this._text$.asObservable();

    private endByTimeout: boolean = false;

    public selectedIndex$ = new BehaviorSubject<SelectedIndex | null>(null);

    public override async init(event: InRoomStatusMessage): Promise<void> {
        const state = event.roomState as PuzzleRushRoomState;

        this.rushTimer = new StartableTimer(state.duration, true, () => this.onTimeout());
        this.countdownTimer = new StartableTimer(3, false, () => this.rushTimer.start(), () => this.sound.play(SoundEffect.NOTE_HIGH));

        await this.onNewMatch(state);
    }

    private async onNewMatch(state: PuzzleRushRoomState) {

        const time = (state.duration % 60 === 0) ? pluralize('minute', state.duration/60) : pluralize('second', state.duration);
        this._text$.next(`Solve as many puzzles as you can in ${time}, but ${pluralize('strike', state.strikes)} and you're out!`);

        this.myIndex = state.players.map(player => player.userid).indexOf(await this.me.getUserID());
        console.log("MY INDEX", this.myIndex);
        if (this.myIndex === -1) throw new Error("User is not either of the players in the room");

        this.analytics.sendEvent("puzzle-rush");

    }

    public getMyIndex(): number {
        return this.myIndex;
    }

    public isSinglePlayer() {
        return (this.getState() as PuzzleRushRoomState).type === RoomType.PUZZLE_RUSH;
    }

    protected override async onStateUpdate(oldState: PuzzleRushRoomState, newState: PuzzleRushRoomState): Promise<void> {
        
        if (oldState.status === PuzzleRushStatus.BEFORE_GAME && newState.status === PuzzleRushStatus.DURING_GAME) {
            this.countdownTimer.start();
        }

        if (oldState.status === PuzzleRushStatus.DURING_GAME && newState.status === PuzzleRushStatus.AFTER_GAME) {
            // Cancel timer if already lost
            this.rushTimer.stop();
            
            if (this.endByTimeout) this._text$.next("Time's up!");
            else if (newState.strikes === 3) this._text$.next("That's three strikes!");
            else if (newState.strikes === 1) this._text$.next("One strike, and it's over!");
            else this._text$.next(`That's ${newState.strikes} strikes!`);
            
            // Select last attempted puzzle to start
            this.selectedIndex$.next({ playerIndex: this.myIndex, puzzleIndex: newState.players[this.getMyIndex()].progress.length - 1});
        }

        // reset game
        if (oldState.status === PuzzleRushStatus.AFTER_GAME && newState.status === PuzzleRushStatus.BEFORE_GAME) {
            this.rushTimer.reset();
            this.countdownTimer.reset();
            this.onNewMatch(newState);
        }

    }

    private onTimeout() {
        this.endByTimeout = true;
        this.sound.play(SoundEffect.NOTES_DOWN);
        this.sendClientRoomEvent({type: PuzzleRushEventType.TIMEOUT });
    }

    public sendReadyEvent() {
        this.sendClientRoomEvent({type: PuzzleRushEventType.READY });
    }

    public sendRematchEvent() {
        this.sendClientRoomEvent({type: PuzzleRushEventType.REMATCH });
    }

    public submitPuzzle(submission: PuzzleSubmission) {
        const attemptEvent: PuzzleRushAttemptEvent = {
            type: PuzzleRushEventType.ATTEMPT,
            current: submission.firstPiece?.getInt2(),
            next: submission.secondPiece?.getInt2(),
        }
        this.sendClientRoomEvent(attemptEvent);
    }

    public override destroy(): void {
        this.countdownTimer.stop();
        this.rushTimer.stop();
    }
}