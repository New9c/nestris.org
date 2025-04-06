import { OnlineUserActivityType } from "../../shared/models/online-activity";
import { DBGameType } from "../../shared/models/db-game";
import { soloXPStrategy } from "../../shared/nestris-org/xp-system";
import { PacketAssembler } from "../../shared/network/stream-packets/packet-assembler";
import { PacketDisassembler } from "../../shared/network/stream-packets/packet-disassembler";
import { ClientRoomEvent, RoomEventType, RoomType } from "../../shared/room/room-models";
import { SoloRoomState } from "../../shared/room/solo-room-models";
import { DBSoloGamesListAddEvent, DBSoloGamesListView } from "../database/db-views/db-solo-games-list";
import { Room } from "../online-users/event-consumers/room-consumer";
import { UserSessionID } from "../online-users/online-user";
import { GameEndEvent, GamePlayer, GameStartEvent } from "./game-player";
import { PlayerIndex } from "../../shared/room/multiplayer-room-models";


export class SoloRoom extends Room<SoloRoomState> {

    private player: GamePlayer;
    private pendingSessionRecovery: string[] = [];
    
    /**
     * Creates a new SoloRoom for the single player with the given playerSessionID
     * @param playerSessionID The playerSessionID of the player in the room
     */
    constructor(playerSessionID: UserSessionID) {
        super(
            OnlineUserActivityType.SOLO,
            [playerSessionID],
            true,
        )

        const username = SoloRoom.Users.getUserInfo(playerSessionID.userid)!.username;

        this.player = new GamePlayer(SoloRoom.Users, PlayerIndex.PLAYER_1, playerSessionID.userid, username, playerSessionID.sessionID, DBGameType.SOLO, null, soloXPStrategy);
        
        // Handle solo-room-specific behavior when the game starts
        this.player.onGameStart$().subscribe(async (event: GameStartEvent) => {

            // Send message to player indicating that the game has started
            this.updateRoomState(Object.assign({}, this.getRoomState(), { serverInGame: true, lastGameSummary: null }));
        });

        // Handle solo-room-specific behavior when the game ends
        this.player.onGameEnd$().subscribe(async (event: GameEndEvent) => {

            const score = event.state.getStatus().score;

            // Add game to list of solo games
            DBSoloGamesListView.alter(this.player.userid, new DBSoloGamesListAddEvent(event.gameID, score, event.xpGained));

            // Send message to player indicating that the game has ended, with updated previous games
            const updatedPreviousGames = (await DBSoloGamesListView.get(this.player.userid)).view;
            this.updateRoomState({
                type: RoomType.SOLO,
                serverInGame: false,
                previousGames: updatedPreviousGames,
                lastGameSummary: {
                    gameID: event.gameID,
                    score: score,
                    isPersonalBest: event.isPersonalBest,
                    linesCleared: event.state.getStatus().lines,
                    tetrisCount: event.state.getNumTetrises(),
                    accuracy: event.accuracy,
                }
            });
        });
    }

    /**
     * Define the initial state of solo room
     */
    protected override async initRoomState(): Promise<SoloRoomState> {
        const previousGames = (await DBSoloGamesListView.get(this.player.userid)).view;
        return { type: RoomType.SOLO, serverInGame: false, previousGames, lastGameSummary: null };
    }

    /**
     * Handle binary message from the player in the room
     * @param sessionID The sessionID of the player. We only have one player in a solo room, so don't really care about this.
     * @param message The binary message from the player
     */
    protected async onPlayerSendBinaryMessage(sessionID: string, message: PacketDisassembler): Promise<void> {

        // Handle each packet individually
        while (message.hasMorePackets()) {
            const packet = message.nextPacket();
            await this.player.handlePacket(packet);
        }

        // If any sessions need recoveries, send them
        if (this.pendingSessionRecovery.length > 0) {
            this.pendingSessionRecovery.forEach(sessionID => {
                this.player.sendRecoveryPacket(sessionID);
            });
            this.pendingSessionRecovery = [];
        }

        // Resend message to all other players in the room
        this.sendToAllExcept(sessionID, PacketAssembler.encodeIndexFromPacketDisassembler(message, 0));
    }

    /**
     * Handle the player leaving the room
     */
    protected override async onDelete(): Promise<void> {
        await this.player.onDelete();
    }

    /**
     * When spectator joins, send recovery packet to get spectator up-to-date on game state
     * @param sessionID SessionID of spectator
     */
    protected override async onSpectatorJoin(sessionID: string): Promise<void> {
        setTimeout(() => this.sendRecovery(sessionID), 100);
    }

    protected override async onClientRoomEvent(userid: string, sessionID: string, event: ClientRoomEvent): Promise<void> {
        switch (event.type) {
            case RoomEventType.REQUEST_RECOVERY:
                this.sendRecovery(sessionID);
                return;
        }
    }

    private sendRecovery(sessionID: string) {
        if (this.player.isInGame()) this.pendingSessionRecovery.push(sessionID);
        else this.player.sendRecoveryPacket(sessionID);
    }
}