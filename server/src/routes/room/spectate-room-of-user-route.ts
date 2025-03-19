import { Authentication } from "../../../shared/models/db-user";
import { EventConsumerManager } from "../../online-users/event-consumer";
import { RoomConsumer } from "../../online-users/event-consumers/room-consumer";
import { PostRoute, RouteError, UserInfo } from "../route";

/**
 * Route for spectating a room that the given userid is in, from sessionid
 */
export class SpectateRoomOfUserRoute extends PostRoute {
    route = "/api/v2/spectate-room-of-user/:roomuserid/:sessionid";
    authentication = Authentication.USER;

    override async post(userInfo: UserInfo | undefined, pathParams: any) {
        
        const roomUserID = pathParams.roomuserid as string;
        const sessionID = pathParams.sessionid as string;

        // Make sure sessionID corresponds to the user
        const users = EventConsumerManager.getInstance().getUsers();
        if (!sessionID) throw new RouteError(400, "Session ID is required");
        if (users.getUserIDBySessionID(sessionID) !== userInfo!.userid) {
            throw new RouteError(400, `Session ID ${sessionID} does not correspond to user ${userInfo!.username}, or is not online`);
        }

        // Find the room where the roomUserID is a player
        const roomConsumer = EventConsumerManager.getInstance().getConsumer(RoomConsumer);
        const userRooms = (
            users.getUserInfo(roomUserID)?.sessions ?? []
        ).map(
            sessionID => ({ sessionID , room: roomConsumer.getRoomBySessionID(sessionID) })
        ).filter(
            ({ sessionID, room }) => room !== undefined && room.isPlayer(sessionID)
        ).map(({ room }) => room!);
        if (userRooms.length === 0) throw new RouteError(400, `Room user id ${roomUserID} is not a player in any room`);

        return { roomState: roomConsumer.spectateRoom(userRooms[0].id, userInfo!.userid, sessionID) };
    }
}