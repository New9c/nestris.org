import { RelativeRanks } from "../../../shared/models/leaderboard";
import { FullHighscoreLeaderboard, FullPuzzleBattleLeaderboard, FullPuzzleRushLeaderboard, FullPuzzlesLeaderboard, FullTrophiesLeaderboard } from "../../leaderboards/full-leaderboard";
import { LeaderboardManager } from "../../leaderboards/leaderboard-manager";
import { GetRoute, RouteError, UserInfo } from "../route";



/**
 * Route for getting the info for all the relative leaderboards for a user on the play page
 */
export class GetRelativeRanksRoute extends GetRoute<RelativeRanks> {
    route = "/api/v2/leaderboard/ranks/:userid";

    override async get(userInfo: UserInfo | undefined, pathParams: any): Promise<RelativeRanks> {
        const userid = pathParams.userid as string;

        try {
            const solo = LeaderboardManager.getFullLeaderboard(FullHighscoreLeaderboard).getRankForUser(userid);
            const ranked = LeaderboardManager.getFullLeaderboard(FullTrophiesLeaderboard).getRankForUser(userid);
            const puzzles = LeaderboardManager.getFullLeaderboard(FullPuzzlesLeaderboard).getRankForUser(userid);

            return { solo, ranked, puzzles };
        } catch {
            throw new RouteError(404, `User ${userid} not found`);
        }
    }
}