import { OnlineUserActivityType } from "../../shared/models/online-activity";
import { RushPuzzle } from "../../shared/puzzles/db-puzzle";
import { PuzzleRushRoomState, PuzzleRushStatus } from "../../shared/room/puzzle-rush-models";
import { RoomType } from "../../shared/room/room-models";
import { DBUserObject } from "../database/db-objects/db-user";
import { EventConsumerManager } from "../online-users/event-consumer";
import { PuzzleRushConsumer } from "../online-users/event-consumers/puzzle-rush-consumer";
import { Room, RoomError } from "../online-users/event-consumers/room-consumer";
import { UserSessionID } from "../online-users/online-user";


export class PuzzleRushRoom extends Room<PuzzleRushRoomState> {

    private puzzleSet!: RushPuzzle[];

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

}