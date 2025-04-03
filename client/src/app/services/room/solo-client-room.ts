import { SoloGameInfo, SoloRoomState } from "src/app/shared/room/solo-room-models";
import { ClientRoom } from "./client-room";
import { RoomModal } from "src/app/components/layout/room/room/room.component";
import { BehaviorSubject, Observable, Subscription } from "rxjs";
import { EmulatorService } from "../emulator/emulator.service";
import { PlatformInterfaceService } from "../platform-interface.service";
import { QuestService } from "../quest.service";
import { getQuest, QuestCategory } from "src/app/shared/nestris-org/quest-system";
import { OcrGameService } from "../ocr/ocr-game.service";
import { Platform } from "src/app/shared/models/platform";
import { OCRStateID } from "src/app/ocr/state-machine/ocr-states/ocr-state-id";
import { InRoomStatus, InRoomStatusMessage } from "src/app/shared/network/json-message";
import { ServerPlayer } from "./server-player";
import { WebsocketService } from "../websocket.service";
import { PacketGroup } from "src/app/shared/network/stream-packets/packet";
import { TetrisBoard } from "src/app/shared/tetris/tetris-board";
import { GameStateSnapshotWithoutBoard } from "src/app/shared/game-state-from-packets/game-state";
import { FetchService, Method } from "../fetch.service";
import { DBUser } from "src/app/shared/models/db-user";
import { ServerRestartWarningService } from "../server-restart-warning.service";
import { NotificationService } from "../notification.service";
import { NotificationType } from "src/app/shared/models/notifications";
import { Router } from "@angular/router";
import { CONFIG } from "src/app/shared/config";
import { AnalyticsService } from "../analytics.service";
import { RoomService } from "./room.service";
import { PlayerIndex } from "src/app/shared/room/multiplayer-room-models";

export enum SoloClientState {
    BEFORE_GAME_MODAL = 'BEFORE_GAME_MODAL',
    IN_GAME = 'IN_GAME',
    TOPOUT = 'TOPOUT',
    AFTER_GAME_MODAL = 'AFTER_GAME_MODAL',
}

export class SoloClientRoom extends ClientRoom {

    readonly room = this.injector.get(RoomService);
    readonly emulator = this.injector.get(EmulatorService);
    readonly ocr = this.injector.get(OcrGameService);
    readonly platformInterface = this.injector.get(PlatformInterfaceService);
    readonly activeQuestService = this.injector.get(QuestService);
    readonly websocket = this.injector.get(WebsocketService);
    readonly fetch = this.injector.get(FetchService);
    readonly restartWarning = this.injector.get(ServerRestartWarningService);
    readonly notifier = this.injector.get(NotificationService);
    readonly router = this.injector.get(Router);
    readonly analytics = this.injector.get(AnalyticsService);

    // The level at which the game starts, persisted across games
    public static startLevel$: BehaviorSubject<number> = new BehaviorSubject(18);

    private soloState$ = new BehaviorSubject<SoloClientState>(SoloClientState.BEFORE_GAME_MODAL);

    private originalGames!: SoloGameInfo[];

    private ocrSubscription?: Subscription;
    public detectingOCR$ = new BehaviorSubject<boolean>(false);
    private inGame: boolean = false;

    // If spectating, this is the data for the player being streamed from server to this client
    private spectatorPlayer?: ServerPlayer;
    private packetGroupSubscription?: Subscription;
    public spectatorBoard$?: Observable<TetrisBoard>;
    public spectatorSnapshot$?: Observable<GameStateSnapshotWithoutBoard>;

    // Only relevant for spectators: get score pb
    public userHighestScore$ = new BehaviorSubject<number>(0);

    public override async init(event: InRoomStatusMessage): Promise<void> {
        const state = event.roomState as SoloRoomState;

        // Get the original games already completed in the room
        this.originalGames = state.previousGames;

        // If spectating, only show game screen
        if (event.status === InRoomStatus.SPECTATOR) {
            this.setSoloState(SoloClientState.IN_GAME);
            this.spectatorPlayer = new ServerPlayer(this, PlayerIndex.PLAYER_1, 18);
            this.spectatorBoard$ = this.spectatorPlayer.getBoard$();
            this.spectatorSnapshot$ = this.spectatorPlayer.getSnapshot$();

            // Subscribe to websocket binary messages
            this.websocket.setPacketGroupContainsPrefix(true);
            this.packetGroupSubscription = this.websocket.onPacketGroup().subscribe(async (packetGroup: PacketGroup) => {
                packetGroup.packets.forEach(packet => this.spectatorPlayer!.onReceivePacket(packet));
            });

            // Only relevant for spectators: get score pb without blocking
            this.fetch.fetch<DBUser>(
                Method.GET, `/api/v2/user/${this.info.players[0].userid}`
            ).then(
                user => this.userHighestScore$.next(user.highest_score)
            );

            this.analytics.sendEvent("spectate-solo");
            return;
        }

        // Set level to 29 if doing a level 29 quest
        const activeQuestID = this.activeQuestService.activeQuestID$.getValue();
        if (activeQuestID && getQuest(activeQuestID).category === QuestCategory.LINES29) SoloClientRoom.startLevel$.next(29);

        // Initialize at before game
        this.setSoloState(SoloClientState.BEFORE_GAME_MODAL);

        // If going into solo mode game and in ocr, start capturing
        const platform = this.platformInterface.getPlatform();
        if (platform === Platform.OCR) {

            this.detectingOCR$.next(true);

            const currentState$ = this.ocr.startGameCapture({
                startLevel: null, // Player can play on any level in solo mode with OCR
                seed: null, // No required seed
                multipleGames: true, // Player can play as many games as desired while on solo page
                midGameStart: CONFIG.allowOCRMidGameStart,
            });

            this.ocrSubscription = currentState$?.subscribe(state => {
                if (state.id === OCRStateID.PIECE_DROPPING && !this.inGame) {
                    this.setSoloState(SoloClientState.IN_GAME);
                    this.detectingOCR$.next(false);
                    this.inGame = true;
                } if (state.id === OCRStateID.GAME_END) this.inGame = false;
            });
        }

        this.analytics.sendEvent("play-solo", { platform: platform });
    }

    protected override async onStateUpdate(oldState: SoloRoomState, newState: SoloRoomState): Promise<void> {
        
        // if topout, go to TOPOUT mode
        // if (oldState.serverInGame && !newState.serverInGame) {
        //     this.setSoloState(SoloClientState.TOPOUT);
        // }

        if (
            this.platformInterface.getPlatform() === Platform.OCR &&
            !this.inGame &&
            oldState.lastGameSummary === null
            && newState.lastGameSummary
        ) {
            this.setSoloState(SoloClientState.AFTER_GAME_MODAL);
            this.detectingOCR$.next(true);
        }

    }

    public setSoloState(state: SoloClientState) {

        // IF OCR platform, skip before-game modal and go straight to game
        if (state === SoloClientState.BEFORE_GAME_MODAL && this.platformInterface.getPlatform() === Platform.OCR) {
            state = SoloClientState.IN_GAME;
            
        }

        this.soloState$.next(state);

        // Set the corresponding modal
        switch (state) {
            case SoloClientState.BEFORE_GAME_MODAL:
                this.modal$.next(RoomModal.SOLO_BEFORE_GAME);
                break;
            case SoloClientState.AFTER_GAME_MODAL:
                this.modal$.next(RoomModal.SOLO_AFTER_GAME);
                break;
            default:
                this.modal$.next(null);
        }
    }


    public startGame(countdown = 3, delay: boolean = false) {

        if (this.platformInterface.getPlatform() === Platform.OCR) throw new Error(`Cannot start emulator game on OCR`);
        
        if (this.restartWarning.isWarning()) {
            this.notifier.notify(NotificationType.ERROR, "Server is about to restart! Please wait.");
            this.router.navigate(["/"]);
            return;
        }

        const startLevel = SoloClientRoom.startLevel$.getValue();
        //console.log('Starting game with start level', startLevel);

        // Transition to in-game state
        this.setSoloState(SoloClientState.IN_GAME);

        // Start the game
        if (delay) {
            this.platformInterface.resetGameData();
            setTimeout(() => this.emulator.startGame(startLevel, true, undefined, undefined, this, countdown), 1000);
        }
        else this.emulator.startGame(startLevel, true, undefined, undefined, this, countdown);
    }

    public getSoloState$(): Observable<SoloClientState> {
        return this.soloState$.asObservable();
    }

    public getSoloState(): SoloClientState {
        return this.soloState$.getValue();
    }

    public isOriginalGame(gameID: string): boolean {
        return this.originalGames.some(game => game.gameID === gameID);
    }

    public override destroy(): void {
        this.emulator.stopGame(true);
        this.ocr.stopGameCapture();
        this.ocrSubscription?.unsubscribe();
        this.packetGroupSubscription?.unsubscribe();
        this.spectatorPlayer?.onDelete();

        this.analytics.sendEvent("leave-solo");
    }

}