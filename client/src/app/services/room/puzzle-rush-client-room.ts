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


export class PuzzleRushClientRoom extends ClientRoom {

    readonly analytics = this.injector.get(AnalyticsService);
    readonly sound = this.injector.get(SoundService);
    readonly me = this.injector.get(MeService);

    private myIndex!: number;

    public readonly rushTimer = new StartableTimer(60 * 3, true, () => this.onTimeout());
    public readonly countdownTimer = new StartableTimer(3, false, () => this.rushTimer.start(), () => this.sound.play(SoundEffect.NOTE_HIGH));

    private readonly _text$ = new BehaviorSubject<string>("Solve as many puzzles as you can in 3 minutes, but 3 strikes and you're out!");
    public readonly text$ = this._text$.asObservable();

    private endByTimeout: boolean = false;

    public override async init(event: InRoomStatusMessage): Promise<void> {
        const state = event.roomState as PuzzleRushRoomState;

        this.myIndex = state.players.map(player => player.userid).indexOf(await this.me.getUserID());
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

            this._text$.next(this.endByTimeout ? "Time's up!" : "That's three strikes!");
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

    public submitPuzzle(submission: PuzzleSubmission) {
        const attemptEvent: PuzzleRushAttemptEvent = {
            type: PuzzleRushEventType.ATTEMPT,
            current: submission.firstPiece?.getInt2(),
            next: submission.secondPiece?.getInt2(),
        }
        this.sendClientRoomEvent(attemptEvent);
    }

    public override destroy(): void {

    }
}