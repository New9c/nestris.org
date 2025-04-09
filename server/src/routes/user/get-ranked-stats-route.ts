import { QueueType, RankedStats } from "../../../shared/network/json-message";
import { RankedStatsQuery } from "../../database/db-queries/ranked-stats-query";
import { Database } from "../../database/db-query";
import { GetRoute, UserInfo } from "../route";

/**
 * Route for getting the logged in user's information
 */
export class GetRankedStatsRoute extends GetRoute<RankedStats> {
    route = "/api/v2/ranked-stats/:userid";

    override async get(userInfo: UserInfo | undefined, pathParams: any): Promise<RankedStats> {
        const userid = pathParams.userid as string;

        return Object.assign({}, { type: QueueType.RANKED }, await Database.query(RankedStatsQuery, userid), { highscore: -1 } ) as RankedStats;
    }
}