import { GlobalChatMessage, JsonMessageType, OnGlobalChatMessage } from "../../../shared/network/json-message";
import { CircularBuffer } from "../../../shared/scripts/circular-buffer";
import { EventConsumer } from "../event-consumer";
import { OnSessionConnectEvent, OnSessionJsonMessageEvent } from "../online-user-events";

const MAX_MESSAGE_HISTORY_TO_SEND = 50;

/**
 * Consumer for managing global chat with storing, receiving, and sending messages
 */
export class GlobalChatConsumer extends EventConsumer {

    private chatHistory = new CircularBuffer<GlobalChatMessage>(500);

    /**
     * On receiving a chat message, save to chat history and broadcast to all online sessionids
     */
    protected override async onSessionJsonMessage(event: OnSessionJsonMessageEvent): Promise<void> {

        // On receiving chat message, save to chat history and broadcast to all online sessionids
        if (event.message.type === JsonMessageType.ON_GLOBAL_CHAT_MESSAGE) {
            const message = event.message as OnGlobalChatMessage;
            message.messages.forEach(msg => this.chatHistory.push(msg));

            // Send to all online sessions
            this.users.sendToAllOnlineUsers(message);
        }
    }

    /**
     * On session connect, send recent chat history to the new session
     */
    protected override async onSessionConnect(event: OnSessionConnectEvent): Promise<void> {
        this.users.sendToUserSession(
            event.sessionID,
            new OnGlobalChatMessage(this.chatHistory.toArray().slice(-MAX_MESSAGE_HISTORY_TO_SEND))
        );
    }

    public getInfo() {
        return this.chatHistory.toArray();
    }

}