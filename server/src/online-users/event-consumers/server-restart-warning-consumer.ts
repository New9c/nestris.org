import { BehaviorSubject } from "rxjs";
import { ServerRestartWarningMessage } from "../../../shared/network/json-message";
import { EventConsumer } from "../event-consumer";
import { OnSessionConnectEvent, OnUserDisconnectEvent } from "../online-user-events";

/**
 * Consumer for toggling server restarts and notifying users
 */
export class ServerRestartWarningConsumer extends EventConsumer {

    private _serverRestartWarning$ = new BehaviorSubject<boolean>(false);
    public serverRestartWarning$ = this._serverRestartWarning$.asObservable();

    public override async init() {
        console.log(`Server restart warning initialized to ${this.isServerRestartWarning()}`);
    }

    public isServerRestartWarning() {
        return this._serverRestartWarning$.getValue();
    }

    /**
     * Toggle the server restart warning and notify all online users
     */
    public toggleServerRestartWarning() {
        this._serverRestartWarning$.next(!this.isServerRestartWarning());
        this.users.sendToAllOnlineUsers(new ServerRestartWarningMessage(this.isServerRestartWarning()));
        console.log(`Server restart warning set to ${this.isServerRestartWarning()}`);
    }

    /**
     * On session connect, send the current server restart warning status if it is active
     * @param event The session connect event
     */
    protected override async onSessionConnect(event: OnSessionConnectEvent): Promise<void> {
        if (this.isServerRestartWarning()) {
            this.users.sendToUserSession(event.sessionID, new ServerRestartWarningMessage(true));
        }
    }

    
}