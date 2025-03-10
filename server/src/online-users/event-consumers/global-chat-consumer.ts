import { GlobalChatMessage, JsonMessageType, OnGlobalChatMessage } from "../../../shared/network/json-message";
import { CircularBuffer } from "../../../shared/scripts/circular-buffer";
import { EventConsumer } from "../event-consumer";
import { OnSessionJsonMessageEvent } from "../online-user-events";

/**
 * Consumer for managing global chat with storing, receiving, and sending messages
 */
export class GlobalChatConsumer extends EventConsumer {

    private chatHistory = new CircularBuffer<GlobalChatMessage>(500);

    protected override async onSessionJsonMessage(event: OnSessionJsonMessageEvent): Promise<void> {

        // On receiving chat message, save to chat history and broadcast to all connected sessionids
        if (event.message.type === JsonMessageType.ON_GLOBAL_CHAT_MESSAGE) {
            const message = event.message as OnGlobalChatMessage;
            message.messages.forEach(msg => this.chatHistory.push(msg));

            // Send to all online sessions
            this.users.sendToAllOnlineUsers(message);
        }
    }

    public getInfo() {
        return this.chatHistory.toArray();
    }

}