import { BehaviorSubject, map, Observable } from "rxjs";

// DEPRACATED
export class Timer {

    private _time$: BehaviorSubject<number | null>;
    public time$: Observable<number | null>;

    private interval: any;

    constructor(seconds: number, private readonly onExpire: () => void) {
        if (seconds <= 0) throw new Error("Seconds must be positive");

        this._time$ = new BehaviorSubject<number | null>(seconds);
        this.time$ = this._time$.asObservable();

        this.interval = setInterval(() => {
            if (this.secondsLeft === null) return;
            this._time$.next(this.secondsLeft - 1);
            if (this.secondsLeft === 0) {
                clearInterval(this.interval);
                this.onExpire();
            }
        }, 1000);
    }

    get secondsLeft() {
        return this._time$.getValue();
    }

    // An observable that emits values once time goes at or under the specified seconds
    timeVisibleAt$(seconds: number): Observable<number | null> {
        return this._time$.pipe(
            map(time => (time !== null && time <= seconds) ? time : null),
        );
    }

    stop() {
        clearInterval(this.interval);
        this._time$.next(null);
    }
}

export class StartableTimer {

    private _time$ = new BehaviorSubject<number | null>(null);
    public time$ = this._time$.asObservable();

    private interval: any;

    constructor(private readonly startSeconds: number, private readonly onExpire: () => void, private readonly onSecond?: () => void) {
        if (startSeconds <= 0) throw new Error("Seconds must be positive");
    }

    get secondsLeft() {
        return this._time$.getValue();
    }

    // An observable that emits values once time goes at or under the specified seconds
    timeVisibleAt$(seconds: number): Observable<number | null> {
        return this._time$.pipe(
            map(time => (time !== null && time <= seconds) ? time : null),
        );
    }

    start() {
        if (this.interval) throw new Error("Already started");

        this._time$.next(this.startSeconds);
        if (this.onSecond) this.onSecond();

        this.interval = setInterval(() => {
            if (this.secondsLeft === null) return;
            this._time$.next(this.secondsLeft - 1);
            if (this.secondsLeft === 0) {
                clearInterval(this.interval);
                this.onExpire();
            } else if (this.onSecond) this.onSecond();
        }, 1000);
    }

    stop() {
        if (!this.interval) throw new Error("Did not start yet");

        clearInterval(this.interval);
        this._time$.next(null);
    }
}