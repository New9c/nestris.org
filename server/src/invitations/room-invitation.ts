import { Invitation, InvitationCancellationReason, InvitationType, MatchInvitation, PuzzleBattleInvitation } from "../../shared/models/invitation";
import { NotificationAutohide, NotificationType } from "../../shared/models/notifications";
import { SendPushNotificationMessage } from "../../shared/network/json-message";
import { errorHandler } from "../errors/error-handler";
import { EventConsumerManager } from "../online-users/event-consumer";
import { Room, RoomConsumer, RoomError } from "../online-users/event-consumers/room-consumer";
import { UserSessionID } from "../online-users/online-user";
import { MultiplayerRoom } from "../room/multiplayer-room";
import { PuzzleRushRoom } from "../room/puzzle-rush-room";
import { InvitationManager, InvitationRequirement } from "./invitation";

/**
 * Manager for friendly match challenges by friends
 */
export abstract class RoomInvitationManager<I extends Invitation> extends InvitationManager<I> {

    protected abstract readonly name: string;

    /**
     * Creates the room with the invitation-specific parameters
     * @throws RoomError on errors with room
     */
    protected abstract createRoom(invitation: I, senderID: UserSessionID, receiverID: UserSessionID): Room;

    // Can only invite to a match if not already doing an activity
    protected readonly invitationRequirement = InvitationRequirement.SESSION_NOT_IN_ACTIVITY;

    protected override async onCreateInvitation(invitation: I): Promise<void> {

        // Send a success message to the session of the sender who created the challenge
        this.users.sendToUserSession(
            invitation.senderSessionID,
            new SendPushNotificationMessage(NotificationType.SUCCESS,
                `Sent a ${this.name} challenge to ${invitation.receiverUsername}!`,
                NotificationAutohide.SHORT
            )
        );

        // Notify all sessions of the receiver the challenge is addressed to
        this.users.sendToUser(
            invitation.receiverID,
            new SendPushNotificationMessage(NotificationType.SUCCESS,
                `${invitation.senderUsername} sent you a ${this.name} challenge!`,
                NotificationAutohide.SHORT
            )
        );        
    }

    /**
     * When a friend request is accepted, the sender and receiver become friends.
     * @param invitation The friend request to accept
     */
    protected override async onAcceptInvitation(invitation: I): Promise<void> {
        console.log(`Creating match`, invitation);

        this.users.sendToUserSession(
            invitation.senderSessionID,
            new SendPushNotificationMessage(
                NotificationType.SUCCESS,
                `${invitation.receiverUsername} accepted your ${this.name} challenge!`,
                NotificationAutohide.SHORT
            )
        )

        try {
            const senderID: UserSessionID = { userid: invitation.senderID, sessionID: invitation.senderSessionID };
            const receiverID: UserSessionID = { userid: invitation.receiverID, sessionID: invitation.receiverSessionID! };
            const room = this.createRoom(invitation, senderID, receiverID);
            await EventConsumerManager.getInstance().getConsumer(RoomConsumer).createRoom(room);
        } catch (error) {
        
        // If room aborted, send push notification to notify
        if (error instanceof RoomError) {
            this.users.sendToUserSession(invitation.receiverSessionID!, new SendPushNotificationMessage(
                NotificationType.ERROR, `The ${this.name} challenge could not be created. Please try again!`
            ));
        }
        errorHandler.logError(`error creating ${this.name} challenge`, error);
    }
        
    }

    /**
     * When the match invitation is cancelled in any way, tell the user why
     */
    protected override async onCancelInvitation(invitation: I, reason: InvitationCancellationReason): Promise<void> {
        
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
                return notifyReceiver(`${invitation.senderUsername} cancelled their ${this.name} challenge!`);
            case InvitationCancellationReason.RECEIVER_DISCONNECT:
            case InvitationCancellationReason.RECEIVER_ACTIVITY_START:
            case InvitationCancellationReason.RECEIVER_DECLINE:
                return notifySender(`${invitation.receiverUsername} declined your ${this.name} challenge!`);            
        }
    }

    protected override async errorCreatingInvitation(invitation: I): Promise<string | null> {
        const existingInvitation = this.getInvitationByUsers(invitation.senderID, invitation.receiverID);
        if (existingInvitation) {
            return (
                existingInvitation.senderID === invitation.senderID ?
                `You already sent ${invitation.receiverUsername} a ${this.name} challenge!` :
                `${invitation.receiverUsername} already sent you a ${this.name} challenge!`
            )
        }

        return null;
    }
}

export class MatchInvitationManager extends RoomInvitationManager<MatchInvitation> {
    public override readonly invitationType = InvitationType.MATCH_REQUEST;
    protected override name = "friendly";

    protected override createRoom(invitation: MatchInvitation, senderID: UserSessionID, receiverID: UserSessionID) {
        return new MultiplayerRoom(senderID, receiverID, false, invitation.startLevel, invitation.winningScore, invitation.levelCap);
    }
}

export class PuzzleBattleInvitationManager extends RoomInvitationManager<PuzzleBattleInvitation> {
    public override readonly invitationType = InvitationType.PUZZLE_BATTLE_REQUEST;
    protected override name = "Puzzle Wars";

    protected override createRoom(invitation: PuzzleBattleInvitation, senderID: UserSessionID, receiverID: UserSessionID) {
        return new PuzzleRushRoom([senderID, receiverID], false, invitation.duration, invitation.strikes);
    }
}