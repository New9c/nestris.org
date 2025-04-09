import { DBUser, LoginMethod } from "../../shared/models/db-user";
import { DBUserObject } from "../database/db-objects/db-user";
import { Database, DBQuery } from "../database/db-query";
import { RelativeLeaderboard } from "../../shared/models/leaderboard";
import { sortLeaderboard } from "./sort-leaderboard";

interface LeaderboardUser {
    userid: string,
    username: string,
    score: number,
    rank: number,
}

/**
 * In-memory, a full leaderboard contains a sorted list of every user in the system each with a singular score to sort by, which
 * is populated through a SQL query at server startup.
 * 
 * The full leaderboard has schema (userid, username, score) for each user. Each implementation should specify how to make SQL queries
 * to initially populate the in-memory list, as well as subscribe to DBUser onChanges to update in-memory leaderboard in real-time.
 * 
 */
export abstract class FullLeaderboard {

    protected abstract readonly name: string;
    
    // The full leaderboard is a sorted list of all the users in the system with their score
    private leaderboard: LeaderboardUser[] = [];

    constructor() {

        // Subscribe to DBUser changes to update the leaderboard in real-time
        DBUserObject.onChange().subscribe((change: {id: string, before: DBUser, after: DBUser}) => {
            
            // Bots are not a part of the leaderboard
            if (change.after.login_method === LoginMethod.BOT) return;

            // Check if the user's score has changed
            const scoreBefore = this.getScoreFromUser(change.before);
            const scoreAfter = this.getScoreFromUser(change.after);
            if (scoreBefore == scoreAfter) return;

            // Update the user's score in the leaderboard
            const user = this.leaderboard.find((user) => user.userid === change.id);
            if (!user) {
                console.error("User not found in leaderboard");
                return;
            }
            user.score = scoreAfter;

            // Re-sort the leaderboard, from highest to lowest score
            sortLeaderboard(this.leaderboard);

            console.log(`Updated leaderboard ${this.name} for user ${change.id}`);
        });

        // Subscribe to DBUser creation to add new users to the leaderboard
        DBUserObject.onCreate().subscribe((create: {id: string, object: DBUser}) => {

            // Bots are not a part of the leaderboard
            if (create.object.login_method === LoginMethod.BOT) return;

            // Add the new user to the leaderboard
            this.leaderboard.push({
                rank: -1,
                userid: create.id,
                username: create.object.username,
                score: this.getScoreFromUser(create.object),
            });

            // Re-sort the leaderboard, from highest to lowest score
            sortLeaderboard(this.leaderboard);

            console.log(`Added user ${create.id} to leaderboard ${this.name}`);
        });

        // Subscribe to DBUser deletion to remove users from the leaderboard
        DBUserObject.onDelete().subscribe((deleted: {id: string, object: DBUser}) => {

            // Bots are not a part of the leaderboard
            if (deleted.object.login_method === LoginMethod.BOT) return;

            // Remove the user from the leaderboard
            const index = this.leaderboard.findIndex((user) => user.userid === deleted.id);
            if (index === -1) {
                console.error("User not found in leaderboard");
                return;
            }
            this.leaderboard.splice(index, 1);

            // Re-sort the leaderboard, from highest to lowest score
            sortLeaderboard(this.leaderboard);

            console.log(`Removed user ${deleted.id} from leaderboard ${this.name}`);
        });

    }

    /**
     * Initialize the leaderboard by populating the list of users and their scores.
     */
    public async init() {
        this.leaderboard = await this.populateLeaderboard();
        sortLeaderboard(this.leaderboard);

        console.log(`Initialized leaderboard ${this.name}`);
    }

    protected abstract populateLeaderboard(): Promise<LeaderboardUser[]>;
    protected abstract getScoreFromUser(user: DBUser): number;

    /**
     * Get the leaderboard for a user, including the user and the two users above and below them.
     * @param userid The user to get the leaderboard for
     * @returns The leaderboard for the user
     */
    public getLeaderboardForUser(userid: string): RelativeLeaderboard {
        const index = this.leaderboard.findIndex((user) => user.userid === userid);
        if (index === -1) throw new Error(`User ${userid} not found in leaderboard`);

        // iterate from the player better than user (index - 1) to the player worse than user (index + 1)
        let leaderboard: RelativeLeaderboard = [];
        for (let i = index - 1; i <= index + 1; i++) {
            if (i < 0 || i >= this.leaderboard.length) {
                leaderboard.push(null);
            } else {
                leaderboard.push({
                    rank: this.leaderboard[i].rank,
                    userid: this.leaderboard[i].userid,
                    username: this.leaderboard[i].username,
                    score: this.leaderboard[i].score,
                });
            }
        }

        return leaderboard;
    }

    /**
     * Get the rank of a user, adjusted for 1-indexing and ties.
     * @param userid The user to get the rank for
     */
    public getRankForUser(userid: string): number | null {
        const index = this.leaderboard.findIndex((user) => user.userid === userid);
        if (index === -1) return null;
        return this.leaderboard[index].rank;
    }

    /**
     * Get all the usernames in the leaderboard matching a search pattern, in alphabetical order.
     * @param pattern The search pattern to match usernames against
     * @param limit The maximum number of usernames to return
     */
    public getNonGuestUsernamesMatchingPattern(pattern: string, limit: number): {userid: string, username: string}[] {

        const isGuestUsername = (username: string): boolean => {
            return /^guest\d+$/.test(username);
        };

        return this.leaderboard
            .filter((user) => !isGuestUsername(user.username) && user.username.toLowerCase().includes(pattern.toLowerCase()))
            .slice(0, limit)
            .map((user) => ({userid: user.userid, username: user.username}))
            .sort((a, b) => a.username.localeCompare(b.username));
    }


}

class GetAllUsersScoreQuery extends DBQuery<LeaderboardUser[]> {
    public override readonly query: string;
    public override readonly warningMs = null;

    constructor(score_column: string) {
        super([]);

        this.query = `
            SELECT userid, username, ${score_column} as score
            FROM users
            WHERE login_method != 'bot'
        `;
    }

    public override parseResult(resultRows: any[]): LeaderboardUser[] {
        return resultRows.map((row) => ({
            rank: -1,
            userid: row.userid,
            username: row.username,
            score: Math.max(row.score, 0),
        }));
    }
}

export class FullHighscoreLeaderboard extends FullLeaderboard {

    protected override readonly name = "highscore";

    protected async populateLeaderboard(): Promise<LeaderboardUser[]> {
        return await Database.query(GetAllUsersScoreQuery, 'highest_score');
    }
    protected getScoreFromUser(user: DBUser): number {
        return user.highest_score;
    }
}

export class FullTrophiesLeaderboard extends FullLeaderboard {

    protected override readonly name = "trophies";

    protected async populateLeaderboard(): Promise<LeaderboardUser[]> {
        return await Database.query(GetAllUsersScoreQuery, 'trophies');
    }
    protected getScoreFromUser(user: DBUser): number {
        return Math.max(user.trophies, 0);
    }
}

export class FullPuzzlesLeaderboard extends FullLeaderboard {

    protected override readonly name = "puzzles";

    protected async populateLeaderboard(): Promise<LeaderboardUser[]> {
        return await Database.query(GetAllUsersScoreQuery, 'puzzle_elo');
    }
    protected getScoreFromUser(user: DBUser): number {
        return user.puzzle_elo;
    }
}



export class FullPuzzleRushLeaderboard extends FullLeaderboard {

    protected override readonly name = "rush";

    protected async populateLeaderboard(): Promise<LeaderboardUser[]> {
        return await Database.query(GetAllUsersScoreQuery, 'puzzle_rush_best');
    }
    protected getScoreFromUser(user: DBUser): number {
        return user.puzzle_rush_best;
    }
}

export class FullPuzzleBattleLeaderboard extends FullLeaderboard {

    protected override readonly name = "battle";

    protected async populateLeaderboard(): Promise<LeaderboardUser[]> {
        return await Database.query(GetAllUsersScoreQuery, 'puzzle_battle_elo');
    }
    protected getScoreFromUser(user: DBUser): number {
        return user.puzzle_battle_elo;
    }
}