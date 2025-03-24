import { DBGameType } from "../../../shared/models/db-game";
import { Authentication } from "../../../shared/models/db-user";
import { GetScoreHistogramQuery } from "../../database/db-queries/get-score-histogram-query";
import { Database } from "../../database/db-query";
import { GetRoute, UserInfo } from "../route";

/**
 * Route for getting a histogram of scores for the logged in user
 */
export class GetScoreHistogramRoute extends GetRoute<number[]> {
    route = "/api/v2/score-histogram/:type";
    authentication = Authentication.USER;

    override async get(userInfo: UserInfo | undefined, pathParams: any) {
        const type = pathParams.type as DBGameType | 'any';
        if (type !== 'any' && !Object.values(DBGameType).includes(type)) {
            throw new Error(`Type must be 'any' or one of ${Object.values(DBGameType)}`);
        }

        return await Database.query(GetScoreHistogramQuery, userInfo!.userid, type);
    }
}