import { getLeagueFromIndex } from "../../../shared/nestris-org/league-system";
import { FoundOpponentMessage, NumQueuingPlayersMessage, RankedStats, RedirectMessage, SendPushNotificationMessage } from "../../../shared/network/json-message";
import { TrophyDelta } from "../../../shared/room/multiplayer-room-models";
import { sleep } from "../../../shared/scripts/sleep";
import { DBUserObject } from "../../database/db-objects/db-user";
import { RankedMultiplayerRoom } from "../../room/ranked-multiplayer-room";
import { EventConsumer, EventConsumerManager } from "../event-consumer";
import { OnSessionDisconnectEvent } from "../online-user-events";
import { RoomAbortError, RoomConsumer } from "./room-consumer";
import { NotificationType } from "../../../shared/models/notifications";
import { OnlineUserActivityType } from "../../../shared/models/online-activity";
import { DBUser, LoginMethod } from "../../../shared/models/db-user";
import { getEloChange, getLevelCapForElo, getStartLevelForElo } from "../../../shared/nestris-org/elo-system";
import { Database } from "../../database/db-query";
import { RankedAbortConsumer } from "./ranked-abort-consumer";
import { ServerRestartWarningConsumer } from "./server-restart-warning-consumer";
import { RankedStatsQuery } from "../../database/db-queries/ranked-stats-query";

export class QueueError extends Error {}
export class UserUnavailableToJoinQueueError extends QueueError {}

const MIN_BOT_MATCH_SECONDS = 15;


/**
 * Represents a range of trophies that a user can be matched with
 */
class TrophyRange {

    /**
     * Create a trophy range with a delta from the given number of trophies
     * @param trophies The number of trophies
     * @param delta The range of trophies to include on either side of the given number of trophies
     * @returns A trophy range with the given number of trophies and delta
     */
    static fromDelta(trophies: number, delta: number): TrophyRange {
        return new TrophyRange(trophies - delta, trophies + delta);
    }
    
    /**
     * Create a trophy range with the given min and max values
     * @param min The minimum number of trophies, or null if there is no minimum
     * @param max The maximum number of trophies, or null if there is no maximum
     */
    constructor(
        public readonly min: number | null,
        public readonly max: number | null,
    ) {}

    /**
     * Check if the given number of trophies is within the range
     * @param trophies The number of trophies to check
     * @returns True if the number of trophies is within the range, false otherwise
     */
    public contains(trophies: number): boolean {
        return (this.min === null || trophies >= this.min) && (this.max === null || trophies <= this.max);
    }
}

class QueueMatch {
    private abortedId: string | null = null;

    constructor(
        public readonly userid1: string,
        public readonly userid2: string,
    ) {}

    public get aborted(): boolean {
        return this.abortedId !== null;
    }

    public get aborteeUserid(): string | null {
        return this.abortedId;
    }

    public contains(userid: string): boolean {
        return this.userid1 === userid || this.userid2 === userid;
    }

    public abort(abortedId: string) {
        this.abortedId = abortedId;
        console.log(`${abortedId} aborted match between ${this.userid1} and ${this.userid2}`);

        const rankedAbortConsumer = EventConsumerManager.getInstance().getConsumer(RankedAbortConsumer);
        rankedAbortConsumer.onAbort(abortedId);
    }
}

/**
 * Represents a user in the ranked queue
 */
class QueueUser {

    public readonly queueStartTime = Date.now();

    constructor(
        public readonly userid: string,
        public readonly username: string,
        public readonly sessionID: string,
        public readonly trophies: number,
        public readonly highestTrophies: number,
        public readonly highscore: number,
        public readonly matchesPlayed: number,
        public readonly allowBotOpponents: boolean,
        public readonly isBot: boolean,
    ) {}

    /**
     * Get the time elapsed since the user was added to the queue in seconds
     * @returns The time elapsed since the user was added to the queue in seconds
     */
    public queueElapsedSeconds(): number {
        return (Date.now() - this.queueStartTime) / 1000;
    }

    /**
     * Calculate opponent trophy range for user based on the user's trophies and queue time
     */
    public getTrophyRange(queueSeconds: number): TrophyRange {

        // Disallow any matches with more than 600 trophy difference
        if (queueSeconds < 3) return TrophyRange.fromDelta(this.trophies, 100);
        if (queueSeconds < 10) return TrophyRange.fromDelta(this.trophies, 200);
        if (queueSeconds < 30) return TrophyRange.fromDelta(this.trophies, 400);
        return TrophyRange.fromDelta(this.trophies, 600);
        
    }

}

/**
 * Consumer for handling guests. On guest disconnect, delete the guest user from the database.
 */
export class RankedQueueConsumer extends EventConsumer {

    private queue: QueueUser[] = [];

    // Map of previous opponent's userid for each userid, used to discourage rematches     
    private previousOpponent: Map<string, string> = new Map();

    private matches: QueueMatch[] = [];

    public override async init() {

        // Find matches every second
        setInterval(() => this.findMatches(), 1000);
    }

    /**
     * Get the number of players in the queue
     * @returns The number of players in the queue
     */
    public playersInQueue(): number {
        return this.queue.length;
    }

    public userMatched(userid: string): boolean {
        return this.matches.some(match => match.contains(userid));
    }

    /**
     * When a session disconnects, remove the user from the queue if the user's session is the one that disconnected
     * @param event The session disconnect event
     */
    protected override async onSessionDisconnect(event: OnSessionDisconnectEvent): Promise<void> {

        // Get the QueueUser corresponding to the session that disconnected
        const queueUser = this.getQueueUser(event.userid);
        if (!queueUser) return;
        if (queueUser.sessionID !== event.sessionID) return;

        // Remove the user from the queue
        this.leaveRankedQueue(event.userid);
    }

    /**
     * Add a user to the ranked queue
     * @param sessionID The session ID of the user to add to the queue
     * @param platform The platform the player is playing on, or null if bot
     * @throws UserUnavailableToJoinQueueError if the user is unavailable to join the queue
     */
    public async joinRankedQueue(sessionID: string) {

        // Get userid from sessionid
        const userid = this.users.getUserIDBySessionID(sessionID);
        if (!userid) throw new Error(`Session ID ${sessionID} is not connected to a user`);

        // If user is already in the queue
        const existingQueueUser = this.getQueueUser(userid);
        if (existingQueueUser) {

            // If user is already in the queue with the same sessionid, do nothing
            if (existingQueueUser.sessionID === sessionID) return;

            // If user is trying to join the queue with a different sessionid, throw an error
            throw new UserUnavailableToJoinQueueError(`User ${userid} is already in the queue with a different session`);
        }

        // Check that user is available to join the queue
        if (this.users.isUserInActivity(userid)) throw new UserUnavailableToJoinQueueError(`User ${userid} is already in an activity`);

        // Set user's activity as in the queue
        this.users.setUserActivity(sessionID, OnlineUserActivityType.QUEUEING);

        // Get user object from database
        const dbUser = await DBUserObject.get(userid);

        // Add user to the queue, maintaining earliest-joined-first order
        const isBot = dbUser.login_method === LoginMethod.BOT;
        this.queue.push(new QueueUser(
            userid, dbUser.username, sessionID, dbUser.trophies, dbUser.highest_trophies, dbUser.highest_score, dbUser.matches_played, dbUser.allow_bot_opponents, isBot
        ));

        // Send the number of players in the queue to all users in the queue
        this.sendNumQueuingPlayers();

        //console.log(`User ${userid} joined the ranked queue`);
    }

    /**
     * Remove a user from the ranked queue
     * @param userid The userid of the user to remove from the queue
     */
    public async leaveRankedQueue(userid: string) {

        // Abort any matches about to start
        this.matches.filter(match => match.contains(userid)).forEach(match => match.abort(userid));

        // if user is not in the queue, do nothing
        if (!this.getQueueUser(userid)) return;

        // Remove user from the queue
        this.queue = this.queue.filter(user => user.userid !== userid);

        // Reset user's activity
        this.users.resetUserActivity(userid);

        // Send the number of players in the queue to all users in the queue
        this.sendNumQueuingPlayers();

        //console.log(`User ${userid} left the ranked queue`);
    }

    /**
     * Get the QueueUser corresponding to a userid
     * @param userid The userid to get the QueueUser for
     * @returns 
     */
    private getQueueUser(userid: string): QueueUser | undefined {
        return this.queue.find(user => user.userid === userid);
    }

    /**
     * Find matches between users in the queue
     */
    private findMatches() {

        let newestBots: {
            bot1: QueueUser,
            bot2: QueueUser,
            numMatches: number
        } | undefined;

        // We find matches by iterating through the queue earliest-joined-first
        // and trying to match each user with another user in the queue
        for (let i = 0; i < this.queue.length; i++) {
            const user1 = this.queue[i];
            for (let j = i + 1; j < this.queue.length; j++) {
                const user2 = this.queue[j];

                // Check if the users meet the criteria to be matched
                if (this.canMatch(user1, user2)) {

                    if (user1.isBot && user2.isBot) { // If both are bots

                        // Don't match bots immediately yet. see if there's bots that have played less matches
                        const numMatches = user1.matchesPlayed + user2.matchesPlayed;
                        if (newestBots === undefined || numMatches < newestBots.numMatches) {
                            newestBots = {
                                bot1: user1,
                                bot2: user2,
                                numMatches: numMatches
                            }
                        }

                    } else { // At least one is not a bot
                        // Match users. This will also remove the users from the queue
                        this.match(user1, user2);
                    }
                }
            }
        }

        // Match bots if there is a valid pair, no ongoing matches and server is not about to restart
        const roomConsumer = EventConsumerManager.getInstance().getConsumer(RoomConsumer);
        const ongoingMatchCount = roomConsumer.getRoomCount(room => room instanceof RankedMultiplayerRoom);
        if (EventConsumerManager.getInstance().getConsumer(ServerRestartWarningConsumer).isServerRestartWarning()) return;
        if (this.matches.length + ongoingMatchCount > 1) return;
        if (newestBots) this.match(newestBots.bot1, newestBots.bot2);
    }

    /**
     * Check if two users meet the criteria to be matched
     * @param user1 The first user in the potential match
     * @param user2 The second user in the potential match
     */
    private canMatch(user1: QueueUser, user2: QueueUser): boolean {

        // Check if the users are not the same
        if (user1.userid === user2.userid) return false;

        // Bots can match each other if within 200 trophies
        if (user1.isBot && user2.isBot) {
            return Math.abs(user1.trophies - user2.trophies) < 200;
        }

        // If either player has not been in the queue for at least one second, they cannot be matched
        if (user1.queueElapsedSeconds() < 1) return false;
        if (user2.queueElapsedSeconds() < 1) return false;

        
        const hasBot = user1.isBot || user2.isBot;
        const nonBotUsers = [user1, user2].filter(user => !user.isBot);
        let queueSeconds = Math.min(...nonBotUsers.map(user => user.queueElapsedSeconds()));

        // If a player disables setting to match against bot opponents, do not allow match with bot
        if ((!user1.allowBotOpponents || !user2.allowBotOpponents) && hasBot) return false;

        // Matching with bot delays the match process by some amount
        if (hasBot) {
            // The first two matches played have faster matches for retention
            const minSeconds = nonBotUsers[0].matchesPlayed >= 2 ? MIN_BOT_MATCH_SECONDS : MIN_BOT_MATCH_SECONDS / 2;

            if (queueSeconds < minSeconds) return false; // Can only match with bot after this time
            else queueSeconds -= minSeconds;
        }

        // Check if the users have similar trophies
        const trophyRange = user1.getTrophyRange(queueSeconds);
        if (!trophyRange.contains(user2.trophies)) return false;

        // Check if the users have not played each other before, unless both users have been waiting for a long time
        const MAX_WAIT_TIME = 5; // If both users have been waiting for more than MAX_WAIT_TIME seconds, they can rematch
        if (user1.queueElapsedSeconds() < MAX_WAIT_TIME && user2.queueElapsedSeconds() < MAX_WAIT_TIME) {
            if (this.previousOpponent.get(user1.userid) === user2.userid) return false;
            if (this.previousOpponent.get(user2.userid) === user1.userid) return false;
        }

        // If all criteria are met, the users can be matched
        return true;
    }

    /**
     * Calculate the win/loss trophy delta for two users after a match
     * @param user1 The first user in the match
     * @param user2 The second user in the match
     */
    private calculateTrophyDelta(user1: DBUser, user2: DBUser): {
        player1TrophyDelta: TrophyDelta,
        player2TrophyDelta: TrophyDelta,
    } {

        const elo1 = user1.trophies;
        const elo2 = user2.trophies;
        let numMatches1 = user1.matches_played;
        let numMatches2 = user2.matches_played;

        // Bots do not have drastic elo change because they have already been a little tuned
        if (user1.login_method === LoginMethod.BOT) numMatches1 = Math.max(3, numMatches1);
        if (user2.login_method === LoginMethod.BOT) numMatches2 = Math.max(3, numMatches2);


        // use the elo system to calculate the win/loss trophy delta for each user
        return {
            player1TrophyDelta: {
                trophyGain: getEloChange(elo1, elo2, 1, numMatches1),
                trophyLoss: getEloChange(elo1, elo2, 0, numMatches1),
            },
            player2TrophyDelta: {
                trophyGain: getEloChange(elo2, elo1, 1, numMatches2),
                trophyLoss: getEloChange(elo2, elo1, 0, numMatches2),
            }
        };
    }

    /**
     * Match two users in the queue
     * @param user1 
     * @param user2 
     */
    private async match(user1: QueueUser, user2: QueueUser) {

        // Add match to list
        const match = new QueueMatch(user1.userid, user2.userid);
        this.matches.push(match);

        // Remove users from the queue before awaiting the match
        this.queue = this.queue.filter(user => user !== user1 && user !== user2);

        // Set the previous opponent for each user to the other user
        this.previousOpponent.set(user1.userid, user2.userid);
        this.previousOpponent.set(user2.userid, user1.userid);

        const [dbUser1, dbUser2] = await Promise.all([
            DBUserObject.get(user1.userid),
            DBUserObject.get(user2.userid),
        ]);

        // Calculate the win/loss XP delta for the users
        const { player1TrophyDelta, player2TrophyDelta } = this.calculateTrophyDelta(dbUser1, dbUser2);

        // Calculate start level
        const lowerElo = Math.min(dbUser1.trophies, dbUser2.trophies);
        const startLevel = getStartLevelForElo(lowerElo);
        const levelCap = getLevelCapForElo(lowerElo);

        const getStats = async (user: DBUser): Promise<RankedStats> => {
            const { performance, aggression, consistency } = await Database.query(RankedStatsQuery, user.userid);
            return { highscore: user.highest_score, performance, aggression, consistency };
        }
        const [user1Stats, user2Stats] = await Promise.all([getStats(dbUser1), getStats(dbUser2)]);

        // Send the message that an opponent has been found to both users
        const player1League = getLeagueFromIndex(dbUser1.league);
        const player2League = getLeagueFromIndex(dbUser2.league);
        this.users.sendToUserSession(user1.sessionID, new FoundOpponentMessage(
            user2.username, user2.trophies, user2.highestTrophies, player2League, player1TrophyDelta, startLevel, levelCap, user1Stats, user2Stats
        ));
        this.users.sendToUserSession(user2.sessionID, new FoundOpponentMessage(
            user1.username, user1.trophies, user1.highestTrophies, player1League, player2TrophyDelta, startLevel, levelCap, user2Stats, user1Stats
        ));

        console.log(`Matched users ${user1.username} and ${user2.username} with trophies ${user1.trophies} and ${user2.trophies}and delta ${player1TrophyDelta.trophyGain}/${player1TrophyDelta.trophyLoss} and ${player2TrophyDelta.trophyGain}/${player2TrophyDelta.trophyLoss}`);

        // Wait for client-side animations
        await sleep(13000);

        // Temporarily reset the activities of the users before adding them to the multiplayer room
        this.users.resetUserActivity(user1.userid);
        this.users.resetUserActivity(user2.userid);

        // Add the users to the multiplayer room, which will send them to the room
        const user1ID = {userid: user1.userid, sessionID: user1.sessionID};
        const user2ID = {userid: user2.userid, sessionID: user2.sessionID};

        try {
            if (match.aborted) throw new RoomAbortError(match.aborteeUserid!, 'Left room');

            const room = new RankedMultiplayerRoom(startLevel, levelCap, user1ID, user2ID, player1TrophyDelta, player2TrophyDelta);
            await EventConsumerManager.getInstance().getConsumer(RoomConsumer).createRoom(room);
        } catch (error) {

            // If room aborted, send push notification to notify
            if (error instanceof RoomAbortError) {
                const otherUser = error.userid === user1ID.userid ? user2ID : user1ID;
                this.users.sendToUserSession(otherUser.sessionID, new SendPushNotificationMessage(
                    NotificationType.ERROR, "Match aborted by opponent"
                ));
            }

            // Redirect users back to the home page
            [user1ID, user2ID].forEach(user => {
                this.users.sendToUserSession(user.sessionID, new RedirectMessage("/"));
            });
        }
        
        // Remove match from list
        this.matches = this.matches.filter(m => m !== match);
    }

    /**
     * Send the number of players in the queue to all users in the queue
     */
    private async sendNumQueuingPlayers() {
        const numQueuingPlayers = this.playersInQueue();

        this.queue.forEach(user => this.users.sendToUserSession(
            user.sessionID,
            new NumQueuingPlayersMessage(numQueuingPlayers)
        ));
    }

}