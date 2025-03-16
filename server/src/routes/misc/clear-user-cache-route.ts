import { Authentication } from "../../../shared/models/db-user";
import { DBUserObject } from "../../database/db-objects/db-user";
import { LeaderboardManager } from "../../leaderboards/leaderboard-manager";
import { EventConsumerManager } from "../../online-users/event-consumer";
import { PostRoute, UserInfo } from "../route";

/**
 * Clear the in-memory cache of all user objects
 */
export class ClearUserCacheRoute extends PostRoute {
    route = "/api/v2/user-cache/clear";
    authentication = Authentication.ADMIN;

    override async post(userInfo: UserInfo | undefined) {
        DBUserObject.clearCache();
        await LeaderboardManager.init(EventConsumerManager.getInstance().getUsers(), false);
        return {success: true};
    }
}