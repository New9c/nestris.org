import { InvitationCancellationReason, InvitationType, MatchInvitation } from "../../shared/models/invitation";
import { NotificationAutohide, NotificationType } from "../../shared/models/notifications";
import { SendPushNotificationMessage } from "../../shared/network/json-message";
import { errorHandler } from "../errors/error-handler";
import { EventConsumerManager } from "../online-users/event-consumer";
import { RoomConsumer, RoomError } from "../online-users/event-consumers/room-consumer";
import { UserSessionID } from "../online-users/online-user";
import { MultiplayerRoom } from "../room/multiplayer-room";
import { InvitationManager, InvitationRequirement } from "./invitation";

/**
 * Manager for friendly match challenges by friends
 */
export class MatchInvitationManager extends InvitationManager<MatchInvitation> {

    // This manager handles match invitations
    public readonly invitationType = InvitationType.MATCH_REQUEST;

    // Can only invite to a match if not already doing an activity
    protected readonly invitationRequirement = InvitationRequirement.SESSION_NOT_IN_ACTIVITY;

    protected override async onCreateInvitation(invitation: MatchInvitation): Promise<void> {

        // Send a success message to the session of the sender who created the challenge
        this.users.sendToUserSession(
            invitation.senderSessionID,
            new SendPushNotificationMessage(NotificationType.SUCCESS,
                `Sent a friendly challenge to ${invitation.receiverUsername}!`,
                NotificationAutohide.SHORT
            )
        );

        // Notify all sessions of the receiver the challenge is addressed to
        this.users.sendToUser(
            invitation.receiverID,
            new SendPushNotificationMessage(NotificationType.SUCCESS,
                `${invitation.senderUsername} sent you a friendly challenge!`,
                NotificationAutohide.SHORT
            )
        );        
    }

    /**
     * When a friend request is accepted, the sender and receiver become friends.
     * @param invitation The friend request to accept
     */
    protected override async onAcceptInvitation(invitation: MatchInvitation): Promise<void> {
        console.log(`Creating match`, invitation);

        this.users.sendToUserSession(
            invitation.senderSessionID,
            new SendPushNotificationMessage(
                NotificationType.SUCCESS,
                `${invitation.receiverUsername} accepted your friendly challenge!`,
                NotificationAutohide.SHORT
            )
        )

        try {
            const senderID: UserSessionID = { userid: invitation.senderID, sessionID: invitation.senderSessionID };
            const receiverID: UserSessionID = { userid: invitation.receiverID, sessionID: invitation.receiverSessionID! };
            const room = new MultiplayerRoom(senderID, receiverID, false, invitation.startLevel, invitation.winningScore, invitation.levelCap);
            await EventConsumerManager.getInstance().getConsumer(RoomConsumer).createRoom(room);
        } catch (error) {
        
        // If room aborted, send push notification to notify
        if (error instanceof RoomError) {
            this.users.sendToUserSession(invitation.receiverSessionID!, new SendPushNotificationMessage(
                NotificationType.ERROR, "The friendly challenge could not be created. Please try again!"
            ));
        }
        errorHandler.logError("error creating friendly challenge", error);
    }
        
    }

    /**
     * When the match invitation is cancelled in any way, tell the user why
     */
    protected override async onCancelInvitation(invitation: MatchInvitation, reason: InvitationCancellationReason): Promise<void> {
        
        // Send an error message to the session that the sender sent the challenge from
        const notifySender = (message: string) => {
            this.users.sendToUserSession(
                invitation.senderSessionID,
                new SendPushNotificationMessage(NotificationType.ERROR, message)
            );
        };

        // Send an error message to all sessions of the challenge receiver
        const notifyReceiver = (message: string) => {
            this.users.sendToUser(
                invitation.receiverID,
                new SendPushNotificationMessage(NotificationType.ERROR, message)
            );
        };

        switch (reason) {
            case InvitationCancellationReason.SENDER_ACTIVITY_START:
            case InvitationCancellationReason.SENDER_CANCEL:
            case InvitationCancellationReason.SENDER_DISCONNECT:
                return notifyReceiver(`${invitation.senderUsername} cancelled their friendly challenge!`);
            case InvitationCancellationReason.RECEIVER_DISCONNECT:
            case InvitationCancellationReason.RECEIVER_ACTIVITY_START:
            case InvitationCancellationReason.RECEIVER_DECLINE:
                return notifySender(`${invitation.receiverUsername} declined your friendly challenge!`);            
        }
    }

    protected override async errorCreatingInvitation(invitation: MatchInvitation): Promise<string | null> {
        const existingInvitation = this.getInvitationByUsers(invitation.senderID, invitation.receiverID);
        if (existingInvitation) {
            return (
                existingInvitation.senderID === invitation.senderID ?
                `You already sent ${invitation.receiverUsername} a friendly challenge!` :
                `${invitation.receiverUsername} already sent you a friendly challenge!`
            )
        }

        return null;
    }

}