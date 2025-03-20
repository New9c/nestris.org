import { Authentication } from "../../../shared/models/db-user";
import { EventConsumerManager } from "../../online-users/event-consumer";
import { RoomConsumer } from "../../online-users/event-consumers/room-consumer";
import { PostRoute, RouteError, UserInfo } from "../route";

/**
 * Route for spectating a room
 * Special route has :roomid = tv, meaning it will find best match
 */
export class SpectateRoomRoute extends PostRoute {
    route = "/api/v2/spectate-room/:roomid/:sessionid";
    authentication = Authentication.USER;

    override async post(userInfo: UserInfo | undefined, pathParams: any) {
        
        let roomID = pathParams.roomid as string;
        const sessionID = pathParams.sessionid as string;

        // Make sure sessionID corresponds to the user
        const users = EventConsumerManager.getInstance().getUsers();
        if (!sessionID) throw new RouteError(400, "Session ID is required");
        if (users.getUserIDBySessionID(sessionID) !== userInfo!.userid) {
            throw new RouteError(400, `Session ID ${sessionID} does not correspond to user ${userInfo!.username}, or is not online`);
        }

        const roomConsumer = EventConsumerManager.getInstance().getConsumer(RoomConsumer);
        const isTvMode = roomID === 'tv';
        if (isTvMode) {
            const bestRoom = roomConsumer.getTVRoom();
            if (bestRoom) roomID = bestRoom.getRoomInfo().id;
            else throw new RouteError(404, `Currently no ranked multiplayer rooms`);
        }

        return { roomState: await roomConsumer.spectateRoom(roomID, userInfo!.userid, sessionID, isTvMode) };
    }
}