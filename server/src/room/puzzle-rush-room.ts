import { OnlineUserActivityType } from "../../shared/models/online-activity";
import { RushPuzzle } from "../../shared/puzzles/db-puzzle";
import { PuzzleRushEventType, PuzzleRushRoomState, PuzzleRushStatus } from "../../shared/room/puzzle-rush-models";
import { ClientRoomEvent, RoomType } from "../../shared/room/room-models";
import { DBUserObject } from "../database/db-objects/db-user";
import { EventConsumerManager } from "../online-users/event-consumer";
import { PuzzleRushConsumer } from "../online-users/event-consumers/puzzle-rush-consumer";
import { Room, RoomError } from "../online-users/event-consumers/room-consumer";
import { UserSessionID } from "../online-users/online-user";


export class PuzzleRushRoom extends Room<PuzzleRushRoomState> {

    private puzzleSet!: RushPuzzle[];

    // Whether each player is ready
    private playerReady: boolean[];

    constructor(
        private readonly playerIDs: UserSessionID[],
        private readonly rated: boolean,
    ) {
        if (playerIDs.length === 1 && rated) throw new RoomError("Single player puzzle rush cannot be rated");

        super(
            playerIDs.length > 1 ? OnlineUserActivityType.PUZZLE_BATTLES : OnlineUserActivityType.PUZZLE_RUSH,
            playerIDs,
            false // cannot spectate puzzle rush/battles
        );

        // All players are not ready at first
        this.playerReady = this.playerIDs.map(_ => false);
    }

    private getPlayerIndex(userid: string) {
        return this.playerIDs.map(playerID => playerID.userid).indexOf(userid);
    }

    protected override async initRoomState(): Promise<PuzzleRushRoomState> {

        // First, initialize puzzle set
        const userids = this.playerIDs.map(playerID => playerID.userid);
        this.puzzleSet = await EventConsumerManager.getInstance().getConsumer(PuzzleRushConsumer).fetchPuzzleSetForUsers(userids);

        // Then, initialie state based on users
        const playerUsers = await Promise.all(this.playerIDs.map(playerID => DBUserObject.get(playerID.userid)));
        return {
            type: playerUsers.length === 1 ? RoomType.PUZZLE_RUSH : RoomType.PUZZLE_BATTLES,
            status: PuzzleRushStatus.BEFORE_GAME,
            players: playerUsers.map(user => ({
                userid: user.userid,
                username: user.username,
                highestTrophies: user.highest_trophies,
                puzzleElo: user.puzzle_elo,
                progress: [],
                currentPuzzleID: this.puzzleSet[0].id
            }))
        };
    }

    /**
     * Handle a event sent by a client in the room
     * @param sessionID The sessionID of the player
     * @param event The event sent by the player
     */
    protected async onClientRoomEvent(userid: string, sessionID: string, event: ClientRoomEvent): Promise<void> {
        const playerIndex = this.getPlayerIndex(userid);
        if (playerIndex === -1) return;

        const state = this.getRoomState();

        switch (event.type) {

            // Change player ready status to ready. If all ready, change state to DURING_GAME
            case PuzzleRushEventType.READY:

                this.playerReady[playerIndex] = true;
                if (this.playerReady.every(ready => ready)) {
                    state.status = PuzzleRushStatus.DURING_GAME;
                    this.updateRoomState(state);
                }
                return;
        }

    }

}