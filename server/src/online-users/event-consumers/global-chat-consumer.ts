import { GlobalChatConnectMessage, GlobalChatMessage, JsonMessageType } from "../../../shared/network/json-message";
import { CircularBuffer } from "../../../shared/scripts/circular-buffer";
import { EventConsumer } from "../event-consumer";
import { OnSessionDisconnectEvent, OnSessionJsonMessageEvent, OnUserConnectEvent, OnUserDisconnectEvent } from "../online-user-events";

/**
 * Consumer for managing global chat with storing, receiving, and sending messages
 */
export class GlobalChatConsumer extends EventConsumer {

    // List of session ids that are connected to global chat
    private connectedSessions = new Set<string>();

    private chatHistory = new CircularBuffer<GlobalChatMessage>(500);

    protected override async onSessionJsonMessage(event: OnSessionJsonMessageEvent): Promise<void> {

        // Update connectedSessions based on connect/disconnect event by session
        if (event.message.type === JsonMessageType.GLOBAL_CHAT_CONNECT) {
            const message = event.message as GlobalChatConnectMessage;
            if (message.connected) this.connectedSessions.add(event.sessionID);
            else this.connectedSessions.delete(event.sessionID);
        }

        // On receiving chat message, save to chat history and broadcast to all connected sessionids
        if (event.message.type === JsonMessageType.GLOBAL_CHAT_MESSAGE) {
            const message = event.message as GlobalChatMessage;
            this.chatHistory.push(message);

            // Send to all connected sessions
            this.connectedSessions.forEach(sessionID => this.users.sendToUserSession(sessionID, message));
        }
        
    }

    /**
     * If session disconnects, remove from chat if present
     */
    protected override async onSessionDisconnect(event: OnSessionDisconnectEvent): Promise<void> {
        this.connectedSessions.delete(event.sessionID);
    }


    public getInfo() {
        return {
            sessions: Array.from(this.connectedSessions).map(sessionID => {
                const userid = this.users.getUserIDBySessionID(sessionID);
                if (!userid) return { sessionID, error : "Session not online" };
                return { sessionID, user: this.users.getUserInfo(userid) }
            }),
            chatHistory: this.chatHistory.toArray()
        }
    }

}