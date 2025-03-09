import { EventConsumerManager } from "../../online-users/event-consumer";
import { GlobalChatConsumer } from "../../online-users/event-consumers/global-chat-consumer";
import { GetRoute, UserInfo } from "../route";

/**
 * Get info about current state of global chat
 */
export class GetGlobalChatRoute extends GetRoute {
    route = "/api/v2/global-chat";

    override async get(userInfo: UserInfo | undefined): Promise<any> {
        return EventConsumerManager.getInstance().getConsumer(GlobalChatConsumer).getInfo();
    }
}