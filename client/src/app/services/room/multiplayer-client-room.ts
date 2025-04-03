import { ClientRoom } from "./client-room";
import { RoomModal } from "src/app/components/layout/room/room/room.component";
import { BehaviorSubject, map, Observable, of, Subscription, switchMap } from "rxjs";
import { EmulatorService } from "../emulator/emulator.service";
import { PlatformInterfaceService } from "../platform-interface.service";
import { bothPlayerIndicies, MultiplayerRoomEventType, MultiplayerRoomState, MultiplayerRoomStatus, PlayerIndex } from "src/app/shared/room/multiplayer-room-models";
import { ServerPlayer } from "./server-player";
import { WebsocketService } from "../websocket.service";
import { PacketGroup } from "src/app/shared/network/stream-packets/packet";
import { GameStateSnapshotWithoutBoard } from "src/app/shared/game-state-from-packets/game-state";
import { TetrisBoard } from "src/app/shared/tetris/tetris-board";
import { TetrominoType } from "src/app/shared/tetris/tetromino-type";
import { OcrGameService } from "../ocr/ocr-game.service";
import { OCRConfig } from "src/app/ocr/state-machine/ocr-state-machine";
import { Platform } from "src/app/shared/models/platform";
import { OCRStateID } from "src/app/ocr/state-machine/ocr-states/ocr-state-id";
import { InRoomStatusMessage } from "src/app/shared/network/json-message";
import { RoomService } from "./room.service";
import { AnalyticsService } from "../analytics.service";

export enum OCRStatus {
    NOT_OCR,
    OCR_BEFORE_GAME,
    OCR_IN_GAME,
    OCR_AFTER_GAME,
}

class Timer {

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

export class MultiplayerClientRoom extends ClientRoom {

    private readonly websocket = this.injector.get(WebsocketService);
    private readonly emulator = this.injector.get(EmulatorService);
    private readonly platform = this.injector.get(PlatformInterfaceService);
    private readonly ocr = this.injector.get(OcrGameService);
    private readonly room = this.injector.get(RoomService);
    private readonly analytics = this.injector.get(AnalyticsService);

    private serverPlayers!: {[PlayerIndex.PLAYER_1]: ServerPlayer, [PlayerIndex.PLAYER_2]: ServerPlayer};

    // The index of the client in the room, or null if the client is a spectator
    private myIndex!: PlayerIndex.PLAYER_1 | PlayerIndex.PLAYER_2 | null;

    private packetGroupSubscription?: Subscription;
    private ocrStateSubscription?: Subscription;

    private ocrStatus$ = new BehaviorSubject<OCRStatus>(OCRStatus.NOT_OCR);

    public readyTimer$ = new BehaviorSubject<Timer | undefined>(undefined); // Timer to get ready
    public ocrTimer$ = new BehaviorSubject<Timer | undefined>(undefined); // Timer to start ocr game after in_game start

    public override async init(event: InRoomStatusMessage): Promise<void> {
        const state = event.roomState as MultiplayerRoomState;

        // Reset game data
        this.platform.updateGameData({
            board: new TetrisBoard(),
            level: state.startLevel,
            lines: 0,
            score: 0,
            nextPiece: TetrominoType.ERROR_TYPE,
            trt: 0,
            drought: null,
            countdown: undefined
        })

        // Derive the index of the client in the room, or null if the client is a spectator
        const mySessionID = this.websocket.getSessionID();
        if (state.players[PlayerIndex.PLAYER_1].sessionID === mySessionID) this.myIndex = PlayerIndex.PLAYER_1;
        else if (state.players[PlayerIndex.PLAYER_2].sessionID === mySessionID) this.myIndex = PlayerIndex.PLAYER_2;
        else this.myIndex = null;

        // Initialize serverPlayers
        const defaultLevel = state.startLevel;
        this.serverPlayers = {
            [PlayerIndex.PLAYER_1]: new ServerPlayer(this, PlayerIndex.PLAYER_1, defaultLevel),
            [PlayerIndex.PLAYER_2]: new ServerPlayer(this, PlayerIndex.PLAYER_2, defaultLevel),
        }

        // Initialize my OCRStatus
        if (this.myIndex !== null && this.platform.getPlatform() === Platform.OCR) {
            this.ocrStatus$.next(OCRStatus.OCR_BEFORE_GAME);
        }

        // Subscribe to websocket binary messages
        this.websocket.setPacketGroupContainsPrefix(true);
        this.packetGroupSubscription = this.websocket.onPacketGroup().subscribe(async (packetGroup: PacketGroup) => {
            
            if (packetGroup.playerIndex === undefined) throw new Error("Player index not defined in packet group");

            // Only process packets that are intended for player 1 or player 2
            const playerIndex = packetGroup.playerIndex as PlayerIndex.PLAYER_1 | PlayerIndex.PLAYER_2;
            if (![PlayerIndex.PLAYER_1, PlayerIndex.PLAYER_2].includes(playerIndex)) return;

            // Process the packets
            packetGroup.packets.forEach(packet => this.serverPlayers[playerIndex].onReceivePacket(packet));
        });

        // If player and ranked, set a timeout to be ready. On expire, abort
        if (this.myIndex !== null && state.ranked) {
            this.setReadyTimer();
        }


        if (this.myIndex !== null) {
            this.analytics.sendEvent("play-multiplayer", { ranked: state.ranked, platform: this.platform.getPlatform() });
        } else this.analytics.sendEvent("spectate-multiplayer");
    }

    private setReadyTimer() {
        this.readyTimer$.getValue()?.stop();
        this.readyTimer$.next(new Timer(60, () => {
            if (this.getState<MultiplayerRoomState>().status === MultiplayerRoomStatus.BEFORE_GAME) {
                this.sendClientRoomEvent({type: MultiplayerRoomEventType.ABORT});
            }
        }));
    }

    /**
     * Get the index of the client in the room, or null if the client is a spectator
     */
    public getMyIndex(): PlayerIndex.PLAYER_1 | PlayerIndex.PLAYER_2 | null {
        return this.myIndex;
    }

    public getOpponentIndex(): PlayerIndex.PLAYER_1 | PlayerIndex.PLAYER_2 | null {
        if (this.myIndex === null) return null;
        if (this.myIndex === PlayerIndex.PLAYER_1) return PlayerIndex.PLAYER_2;
        return PlayerIndex.PLAYER_1;
    }

    public getSnapshotForPlayer$(playerIndex: PlayerIndex.PLAYER_1 | PlayerIndex.PLAYER_2): Observable<GameStateSnapshotWithoutBoard> {
        return this.serverPlayers[playerIndex].getSnapshot$();
    }

    public getBoardForPlayer$(playerIndex: PlayerIndex.PLAYER_1 | PlayerIndex.PLAYER_2): Observable<TetrisBoard> {
        return this.serverPlayers[playerIndex].getBoard$();
    }

    public getPlayerScore(playerIndex: PlayerIndex.PLAYER_1 | PlayerIndex.PLAYER_2) {
        // If my index, use the client-side score
        if (this.myIndex === playerIndex) return this.platform.getGameData$().pipe(
            map(data => data.score)
        );

        // Otherwise, use the server-side score
        return this.serverPlayers[playerIndex].getSnapshot$().pipe(
            map(snapshot => snapshot.score)
        );
    }

    protected override async onStateUpdate(oldState: MultiplayerRoomState, newState: MultiplayerRoomState): Promise<void> {

        // If client goes from not ready to ready, reset game
        bothPlayerIndicies.forEach(playerIndex => {
            if (!oldState.ready[playerIndex] && newState.ready[playerIndex]) {
                console.log("player", playerIndex, "ready");
                this.serverPlayers[playerIndex].resetSnapshot();

                // Reset game data if client is the player
                if (this.getMyIndex() === playerIndex) {
                    this.platform.updateGameData({
                        board: new TetrisBoard(),
                        level: newState.startLevel,
                        lines: 0,
                        score: 0,
                        nextPiece: TetrominoType.ERROR_TYPE,
                        trt: 0,
                        drought: null,
                        countdown: undefined
                    })
                }
            }
        })
        

        // If client is a player, and going from BEFORE_GAME -> IN_GAME, start game
        if (this.myIndex !== null && oldState.status === MultiplayerRoomStatus.BEFORE_GAME && newState.status === MultiplayerRoomStatus.IN_GAME) {
            if (this.platform.getPlatform() === Platform.ONLINE) {
                this.emulator.startGame(newState.startLevel, true, newState.levelCap, newState.currentSeed, this);
            } else {

                // Start OCR game
                const config: OCRConfig = { startLevel: newState.startLevel, seed: newState.currentSeed, multipleGames: false, levelCap: newState.levelCap };
                const stateObservable$ = this.ocr.startGameCapture(config, this.platform, true);
                if (!stateObservable$) throw new Error(`Game capture already started`);

                // If ranked, start timer where user has to start game before it expires
                if (newState.ranked) this.ocrTimer$.next(new Timer(10, () => {
                    this.sendClientRoomEvent({type: MultiplayerRoomEventType.ABORT});
                    this.ocr.stopGameCapture();
                }));

                this.ocrStateSubscription = stateObservable$.subscribe((state) => {
                    if (state.id === OCRStateID.PIECE_DROPPING) {
                        if (this.ocrTimer$.getValue()?.secondsLeft) this.ocrTimer$.getValue()?.stop();
                        this.ocrStatus$.next(OCRStatus.OCR_IN_GAME);
                    }
                    if (state.id === OCRStateID.GAME_END) {
                        this.ocrStatus$.next(OCRStatus.OCR_AFTER_GAME);
                    }
                })
            }
        }

        // If going back to before game, reset
        if (oldState.status !== MultiplayerRoomStatus.BEFORE_GAME && newState.status === MultiplayerRoomStatus.BEFORE_GAME) {
            
            this.emulator.stopGame(true);
            this.ocr.stopGameCapture();
            this.ocrStateSubscription?.unsubscribe();

            if (this.myIndex !== null && newState.ranked) {
                this.setReadyTimer();
            }

            if (this.myIndex !== null && this.platform.getPlatform() === Platform.OCR) {
                this.ocrStatus$.next(OCRStatus.OCR_BEFORE_GAME);
            }
        }

        if (oldState.status !== MultiplayerRoomStatus.AFTER_MATCH && newState.status === MultiplayerRoomStatus.AFTER_MATCH) {
            this.ocr.stopGameCapture();

            // If resigned, imediately show after match modal
            if (newState.wonByResignation) this.showAfterMatchModal();

            this.room.onMatchEnd$.next();
        }

        // If aborted, show after match modal
        if (oldState.status !== MultiplayerRoomStatus.AFTER_MATCH && newState.status === MultiplayerRoomStatus.ABORTED) {
            this.showAfterMatchModal();
        }

        // Reset 
        if (oldState.status === MultiplayerRoomStatus.AFTER_MATCH && newState.status === MultiplayerRoomStatus.BEFORE_GAME) {
            // hide modal
            this.modal$.next(null);

            // reset boards
            bothPlayerIndicies.forEach(playerIndex => this.serverPlayers[playerIndex].resetSnapshot());
        }
    }

    /**
     * Sent when the client is ready to start the game
     */
    public sendReadyEvent() {
        this.readyTimer$.getValue()?.stop();
        this.sendClientRoomEvent({type: MultiplayerRoomEventType.READY });
    }

    /**
     * Sent to show the after match modal, if not speectator
     */
    public showAfterMatchModal() {
        if (this.myIndex !== null) this.modal$.next(RoomModal.MULTIPLAYER_AFTER_MATCH);
    }


    public showingAfterMatchModal(): boolean {
        return this.modal$.getValue() === RoomModal.MULTIPLAYER_AFTER_MATCH;
    }

    public getOCRStatus$(): Observable<OCRStatus> {
        return this.ocrStatus$.asObservable();
    }

    public override destroy(): void {
        this.emulator.stopGame(true);
        this.ocr.stopGameCapture();
        this.ocrStateSubscription?.unsubscribe();
        this.packetGroupSubscription?.unsubscribe();
        bothPlayerIndicies.forEach(playerIndex => this.serverPlayers[playerIndex].onDelete());

        // Stop any ongoing timers
        this.ocrTimer$.getValue()?.stop();
        this.readyTimer$.getValue()?.stop();
    }

}