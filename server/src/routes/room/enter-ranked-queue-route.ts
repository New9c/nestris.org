import { Authentication, DBUser } from "../../../shared/models/db-user";
import { Platform } from "../../../shared/models/platform";
import { RANKED_UNLOCK_SCORE } from "../../../shared/nestris-org/elo-system";
import { DBObjectNotFoundError } from "../../database/db-object-error";
import { DBUserObject } from "../../database/db-objects/db-user";
import { EventConsumerManager } from "../../online-users/event-consumer";
import { RankedQueueConsumer, UserUnavailableToJoinQueueError } from "../../online-users/event-consumers/ranked-queue-consumer";
import { RoomConsumer } from "../../online-users/event-consumers/room-consumer";
import { SoloRoom } from "../../room/solo-room";
import { PostRoute, RouteError, UserInfo } from "../route";

/**
 * Route for joining the ranked queue
 */
export class EnterRankedQueueRoute extends PostRoute {
    route = "/api/v2/enter-ranked-queue/:sessionid/:platform";
    authentication = Authentication.USER;

    override async post(userInfo: UserInfo | undefined, pathParams: any) {
        
        const sessionID = pathParams.sessionid as string;
        const platform = pathParams.platform as Platform;

        // Make sure sessionID corresponds to the user
        const users = EventConsumerManager.getInstance().getUsers();
        if (!sessionID) throw new RouteError(400, "Session ID is required");
        if (users.getUserIDBySessionID(sessionID) !== userInfo!.userid) {
            throw new RouteError(400, `Session ID ${sessionID} does not correspond to user ${userInfo!.username}`);
        }

        // Make sure user has played game with 100,000 score
        const dbUser = await DBUserObject.get(userInfo!.userid);
        if (dbUser.highest_score < RANKED_UNLOCK_SCORE) {
            throw new RouteError(400, `You must score at least ${RANKED_UNLOCK_SCORE} points in a game to join the ranked queue`);
        }

        // Make sure trophies not -1
        if (dbUser.trophies === -1) {
            throw new RouteError(400, `You have not picked a starting trophy count`);
        }

        // Make sure platform is valid
        if (!Object.values(Platform).includes(platform)) {
            throw new RouteError(400, `Platform ${platform} is not valid`);
        }
        
        // Make sure user is not already in an activity
        if (EventConsumerManager.getInstance().getUsers().isUserInActivity(userInfo!.userid)) {
            throw new RouteError(400, `You are already in an activity!`);
        }

        try {
            // Join the ranked queue
            await EventConsumerManager.getInstance().getConsumer(RankedQueueConsumer).joinRankedQueue(sessionID, platform);

        } catch (error) {
            if (error instanceof UserUnavailableToJoinQueueError) {
                throw new RouteError(400, error.message);
            } else {
                throw new RouteError(500, `Failed to join ranked queue: ${error}`);
            }
        }
        


        return {success: true};
    }
}