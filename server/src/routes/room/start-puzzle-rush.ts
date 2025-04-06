import { Authentication } from "../../../shared/models/db-user";
import { EventConsumerManager } from "../../online-users/event-consumer";
import { ActivityConsumer } from "../../online-users/event-consumers/activity-consumer";
import { RoomAbortError, RoomConsumer } from "../../online-users/event-consumers/room-consumer";
import { PuzzleRushRoom } from "../../room/puzzle-rush-room";
import { SoloRoom } from "../../room/solo-room";
import { PostRoute, RouteError, UserInfo } from "../route";

/**
 * Route for creating a puzzle rush room for single player
 */
export class StartPuzzleRushRoute extends PostRoute {
    route = "/api/v2/start-puzzle-rush/:sessionid";
    authentication = Authentication.USER;

    override async post(userInfo: UserInfo | undefined, pathParams: any) {
        
        const sessionID = pathParams.sessionid as string;

        const users = EventConsumerManager.getInstance().getUsers();
        const activityConsumer = EventConsumerManager.getInstance().getConsumer(ActivityConsumer);

        // Make sure sessionID corresponds to the user
        if (!sessionID) throw new RouteError(400, "Session ID is required");
        if (users.getUserIDBySessionID(sessionID) !== userInfo!.userid) {
            throw new RouteError(400, `Session ID ${sessionID} does not correspond to user ${userInfo!.username}`);
        }

        await activityConsumer.freeUserFromActivity(userInfo!.userid);
        
        // Create a puzzle rush room
        try {
            const roomConsumer = EventConsumerManager.getInstance().getConsumer(RoomConsumer);
            await roomConsumer.freeSession(userInfo!.userid, sessionID);
            const puzzleRushRoom = new PuzzleRushRoom([{ userid: userInfo!.userid, sessionID: sessionID }], false);
            roomConsumer.createRoom(puzzleRushRoom);
        } catch (error: any) {
            if (error instanceof RoomAbortError) {
                throw new RouteError(404, `Unable to create room for ${error.name}: ${error.message}`);
            } else throw error;
        }

        return {success: true};
    }
}