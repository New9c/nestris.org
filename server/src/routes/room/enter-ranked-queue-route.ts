import { Authentication, DBUser } from "../../../shared/models/db-user";
import { Platform } from "../../../shared/models/platform";
import { RANKED_UNLOCK_SCORE } from "../../../shared/nestris-org/elo-system";
import { QueueType } from "../../../shared/network/json-message";
import { DBObjectNotFoundError } from "../../database/db-object-error";
import { DBUserObject } from "../../database/db-objects/db-user";
import { EventConsumerManager } from "../../online-users/event-consumer";
import { ActivityConsumer } from "../../online-users/event-consumers/activity-consumer";
import { RankedAbortConsumer } from "../../online-users/event-consumers/ranked-abort-consumer";
import { RankedQueueConsumer, UserUnavailableToJoinQueueError } from "../../online-users/event-consumers/ranked-queue-consumer";
import { RoomConsumer } from "../../online-users/event-consumers/room-consumer";
import { SoloRoom } from "../../room/solo-room";
import { PostRoute, RouteError, UserInfo } from "../route";

/**
 * Route for joining the ranked queue
 */
export class EnterRankedQueueRoute extends PostRoute {
    route = "/api/v2/enter-ranked-queue/:queueType/:sessionid";
    authentication = Authentication.USER;

    override async post(userInfo: UserInfo | undefined, pathParams: any) {
        
        const sessionID = pathParams.sessionid as string;
        const queueType = pathParams.queueType as QueueType;

        // Make sure queueType is valid
        if (!Object.values(QueueType).includes(queueType)) {
            throw new RouteError(400, `Invalid queue type: ${queueType}`);
        }

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

        // Make sure not too many aborts
        const rankedAbortConsumer = EventConsumerManager.getInstance().getConsumer(RankedAbortConsumer);
        const suspended = rankedAbortConsumer.suspendedMessage(userInfo!.userid);
        if (suspended) throw new RouteError(400, suspended);

        const roomConsumer = EventConsumerManager.getInstance().getConsumer(RoomConsumer);
        const activityConsumer = EventConsumerManager.getInstance().getConsumer(ActivityConsumer);
        
        // Leave any existing activities
        await activityConsumer.freeUserFromActivity(userInfo!.userid);

        try {
            // Join the ranked queue
            await roomConsumer.freeSession(userInfo!.userid, sessionID);
            await EventConsumerManager.getInstance().getConsumer(RankedQueueConsumer).joinRankedQueue(queueType, sessionID);

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