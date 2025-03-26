import { NotificationType } from "../../../shared/models/notifications";
import { SendPushNotificationMessage } from "../../../shared/network/json-message";
import { EventConsumer } from "../event-consumer";

export class DelayedCounter {
    private counts: Map<string, number> = new Map();
    private delay: number;
    private timeouts: Map<string, Set<NodeJS.Timeout>> = new Map();
  
    constructor(delayInSeconds: number) {
      this.delay = delayInSeconds * 1000; // Convert to milliseconds
    }
  
    increment(userid: string): void {
      this.counts.set(userid, (this.counts.get(userid) || 0) + 1);
      
      const timeout = setTimeout(() => {
        this.counts.set(userid, (this.counts.get(userid) || 0) - 1);
        this.timeouts.get(userid)?.delete(timeout);
      }, this.delay);
      
      if (!this.timeouts.has(userid)) {
        this.timeouts.set(userid, new Set());
      }
      this.timeouts.get(userid)?.add(timeout);
    }
  
    getCount(userid: string): number {
      return this.counts.get(userid) || 0;
    }
  
    reset(userid: string): void {
      this.timeouts.get(userid)?.forEach(clearTimeout);
      this.timeouts.delete(userid);
      this.counts.delete(userid);
    }
}

const ABORT_WARN_COUNT = 3;
const ABORT_SUSPENSION_COUNT = 5;
const SUSPENSION_MINUTES = 30; 

export class RankedAbortConsumer extends EventConsumer {

    // An abort is remembered for 10 minutes
    private readonly aborts = new DelayedCounter(600);

    // A map of userid to when suspension is lifted
    private readonly suspensions = new Map<string, number>();

    public onAbort(userid: string, sessionID?: string) {
        this.aborts.increment(userid);
        const count = this.aborts.getCount(userid);

        console.log(`${userid} aborted, abort count at ${count}`);

        const sendToUser = (message: SendPushNotificationMessage) => {
            if (sessionID) this.users.sendToUserSession(sessionID, message);
            else this.users.sendToUser(userid, message);
        }

        if (count >= ABORT_SUSPENSION_COUNT) {
            if (!this.suspendedMessage(userid)) {
                this.suspensions.set(userid, Date.now() + SUSPENSION_MINUTES * 60 * 1000);

                sendToUser(new SendPushNotificationMessage(
                    NotificationType.ERROR,
                    `You have been suspended from ranked mode for the next ${SUSPENSION_MINUTES} minutes due to excessive aborts.`
                ));
            }
        } else if (count >= ABORT_WARN_COUNT) {
            sendToUser(new SendPushNotificationMessage(
                NotificationType.WARNING,
                `Please avoid aborting too often. Frequent aborts will be punished!`
            ));
        }
    }

    // Returns the suspended message if suspended, else null
    public suspendedMessage(userid: string): string | null {
        const suspensionTime = this.suspensions.get(userid);
        if (!suspensionTime) return null;

        const now = Date.now();
        if (now > suspensionTime) {
            // Suspension expired
            this.suspensions.delete(userid);
            return null;
        } else {
            // Still suspended
            const minutes = Math.ceil((suspensionTime - now) / 1000 / 60);
            return `You have been suspended from ranked mode for the next ${minutes} minutes due to excessive aborts.`;
        }
    }

}