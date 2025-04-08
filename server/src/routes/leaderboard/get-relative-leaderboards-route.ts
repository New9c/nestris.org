import { Authentication } from "../../../shared/models/db-user";
import { RelativeLeaderboards } from "../../../shared/models/leaderboard";
import { DBUserObject } from "../../database/db-objects/db-user";
import { FullHighscoreLeaderboard, FullPuzzlesLeaderboard, FullTrophiesLeaderboard } from "../../leaderboards/full-leaderboard";
import { LeaderboardManager } from "../../leaderboards/leaderboard-manager";
import { EventConsumerManager } from "../../online-users/event-consumer";
import { RankedQueueConsumer } from "../../online-users/event-consumers/ranked-queue-consumer";
import { RatedPuzzleConsumer } from "../../online-users/event-consumers/rated-puzzle-consumer";
import { RoomConsumer } from "../../online-users/event-consumers/room-consumer";
import { MultiplayerRoom } from "../../room/multiplayer-room";
import { PuzzleRushRoom } from "../../room/puzzle-rush-room";
import { SoloRoom } from "../../room/solo-room";
import { GetRoute, UserInfo } from "../route";



/**
 * Route for getting the info for all the relative leaderboards for a user on the play page
 */
export class GetRelativeLeaderboardsRoute extends GetRoute<RelativeLeaderboards> {
    route = "/api/v2/leaderboard/relative";
    authentication = Authentication.USER;

    override async get(userInfo: UserInfo | undefined): Promise<RelativeLeaderboards> {
        const userid = userInfo!.userid;

        const roomConsumer = EventConsumerManager.getInstance().getConsumer(RoomConsumer);

        let puzzlesPlayingNow: number = 0;
        try {
            const puzzleConsumer = EventConsumerManager.getInstance().getConsumer(RatedPuzzleConsumer);
            puzzlesPlayingNow = puzzleConsumer.activePuzzleCount();
        } catch {}
      
        const soloPlayingNow: number = roomConsumer.getRoomCount(room => room instanceof SoloRoom);
        const soloLeaderboard = LeaderboardManager.getFullLeaderboard(FullHighscoreLeaderboard).getLeaderboardForUser(userid);

        const rankedPlayingNow: number = 2 * roomConsumer.getRoomCount(room => room instanceof MultiplayerRoom && room.ranked);
        const rankedLeaderboard = LeaderboardManager.getFullLeaderboard(FullTrophiesLeaderboard).getLeaderboardForUser(userid);
        
        const rushPlayingNow: number = roomConsumer.getRoomCount(room => room instanceof PuzzleRushRoom);
        const puzzlesLeaderboard = LeaderboardManager.getFullLeaderboard(FullPuzzlesLeaderboard).getLeaderboardForUser(userid);

        return {
            solo: {
                playingNow: soloPlayingNow,
                leaderboard: soloLeaderboard
            },
            ranked: {
                playingNow: rankedPlayingNow,
                leaderboard: rankedLeaderboard
            },
            puzzles: {
                playingNow: puzzlesPlayingNow + rushPlayingNow,
                leaderboard: puzzlesLeaderboard
            }
        }
      }
}