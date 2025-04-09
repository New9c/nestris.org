import { Authentication } from "../../../shared/models/db-user";
import { EventConsumerManager } from "../../online-users/event-consumer";
import { ServerRestartWarningConsumer } from "../../online-users/event-consumers/server-restart-warning-consumer";
import { SoloRoom } from "../../room/solo-room";
import { PostRoute, UserInfo } from "../route";

/**
 * Toggle the server restart warning
 */
export class SetServerAnnouncementRoute extends PostRoute {
    route = "/api/v2/announcement";
    authentication = Authentication.ADMIN;

    override async post(userInfo: UserInfo | undefined, pathParams: any, queryParams: any, bodyParams: any) {

        let message = bodyParams.message;
        if (!message) message = null;

        console.log(`Setting server announcement to ${message}`);
        
        // Toggle the server restart warning and notify all online users
        EventConsumerManager.getInstance().getConsumer(ServerRestartWarningConsumer).setAnnouncement(message);

        return {success: true};
    }
}