import { Activity, ActivityType, TimestampedActivity } from "../../../shared/models/activity";
import { OnlineUserActivityType } from "../../../shared/models/online-activity";
import { RedirectMessage } from "../../../shared/network/json-message";
import { Database, DBQuery, WriteDBQuery } from "../../database/db-query";
import { EventConsumer, EventConsumerManager } from "../event-consumer";
import { RankedQueueConsumer } from "./ranked-queue-consumer";
import { RoomConsumer } from "./room-consumer";

class CreateActivityQuery extends WriteDBQuery {
    public override readonly query = `INSERT INTO activities (userid, data) VALUES ($1, $2)`;
    public override readonly warningMs = null;

    constructor(userid: string, data: Activity) {
        super([userid, data]);
    }
}

class GetActivitiesForUserQuery extends DBQuery<TimestampedActivity[]> {

    public override readonly query = `
        SELECT id, created_at, data
        FROM activities
        WHERE userid = $1
        ORDER BY created_at DESC
    `;

    public override readonly warningMs = null;

    constructor(userid: string) {
        super([userid]);
    }

    public override parseResult(resultRows: any[]): TimestampedActivity[] {
        return resultRows.map((row) => ({
            id: row.id,
            timestamp: row.created_at,
            activity: row.data as Activity,
        }));
    }
}

// Handles events related to users
export class ActivityConsumer extends EventConsumer {

    public async createActivity(userid: string, data: Activity) {
        await Database.query(CreateActivityQuery, userid, data);
    }

    public async getActivitiesForUser(userid: string): Promise<TimestampedActivity[]> {
        return await Database.query(GetActivitiesForUserQuery, userid);
    }

    /**
     * If user is in an activity, leave activity and go to home page
     */
    public async freeUserFromActivity(userid: string) {

        const currentActivity = this.users.getUserActivity(userid);
        if (!currentActivity) return;

        // End existing activity
        switch (currentActivity.type) {
            case OnlineUserActivityType.SOLO:
            case OnlineUserActivityType.MULTIPLAYER:
                const roomConsumer = EventConsumerManager.getInstance().getConsumer(RoomConsumer);
                await roomConsumer.freeSession(userid, currentActivity.sessionID);
            case OnlineUserActivityType.QUEUEING:
                const queueConsumer = EventConsumerManager.getInstance().getConsumer(RankedQueueConsumer);
                await queueConsumer.leaveRankedQueue(userid);
        }

        // Send to home page        
        this.users.resetUserActivity(userid);
        this.users.sendToUserSession(currentActivity.sessionID, new RedirectMessage("/"));
    }

}