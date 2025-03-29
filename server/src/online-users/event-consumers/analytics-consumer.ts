import { EventConsumer, EventConsumerManager } from "../event-consumer";
import { PostHog } from 'posthog-node'
import { ServerRestartWarningConsumer } from "./server-restart-warning-consumer";
import { OnSessionConnectEvent, OnSessionJsonMessageEvent } from "../online-user-events";
import { AnalyticsEventMessage, JsonMessageType } from "../../../shared/network/json-message";
import { DBUserObject } from "../../database/db-objects/db-user";
import { LoginMethod } from "../../../shared/models/db-user";

type AnalyticsConfig = {enabled: boolean};

/**
 * Consumer for handling guests. On guest disconnect, delete the guest user from the database.
 */
export class AnalyticsConsumer extends EventConsumer<AnalyticsConfig> {

    private client?: PostHog;

    public override async init(): Promise<void> {
        if (!this.config.enabled) return;

        EventConsumerManager.getInstance().getConsumer(ServerRestartWarningConsumer).serverRestartWarning$.subscribe(isWarning => {
            if (isWarning) this.stopClient();
            else this.startClient();
        });

        this.startClient();
    }

    protected override async onSessionJsonMessage(event: OnSessionJsonMessageEvent): Promise<void> {
        if (!this.config.enabled) return;

        if (event.message.type === JsonMessageType.ANALYTICS_EVENT) {
            const message = event.message as AnalyticsEventMessage;
            this.client?.capture({
                distinctId: message.userid,
                event: message.event,
                properties: message.properties
            });
        }
    }

    protected override async onSessionConnect(event: OnSessionConnectEvent): Promise<void> {
        if (!this.config.enabled) return;
        
        // Do not track bots
        if ((await DBUserObject.get(event.userid)).login_method === LoginMethod.BOT) return;

        this.client?.identify({
            distinctId: event.userid,
            properties: { username: event.username }
        });
    }

    private startClient() {
        if (this.client) return;
        this.client = new PostHog(
            'phc_bEQCJCF8bafOH9uv7cusTA7R9utHmhL61sIQdbaFr2E',
            { host: 'https://us.i.posthog.com' }
        );
    }

    private stopClient() {
        this.client?.shutdown();
        this.client = undefined;
    }

}