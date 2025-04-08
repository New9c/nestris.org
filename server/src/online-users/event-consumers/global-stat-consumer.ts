import { stat } from "fs";
import { GlobalStat, GlobalStats } from "../../../shared/models/global-stat";
import { DBGameEndEvent, DBPuzzleRushEvent, DBPuzzleSubmitEvent, DBRankedMatchEndEvent, DBUserObject } from "../../database/db-objects/db-user";
import { Database, DBQuery, WriteDBQuery } from "../../database/db-query";
import { EventConsumer } from "../event-consumer";

// Count the number of users in the database
export class CountUsersQuery extends DBQuery<number> {
    public override query = `SELECT COUNT(*) AS count FROM users WHERE login_method != 'bot';`;
    public override warningMs = null;

    public override parseResult(resultRows: any[]): number {
        if (resultRows.length === 0) throw new Error('Count of users not found');

        return parseInt(resultRows[0].count);
    }
}

export class CountGamesPlayedQuery extends DBQuery<number> {
    public override query = `SELECT SUM(games_played) FROM users;`;
    public override warningMs = null;

    public override parseResult(resultRows: any[]): number {
        if (resultRows.length === 0) throw new Error('Count of games played not found');

        return parseInt(resultRows[0].sum);
    }
}


// Stats that are stored directly in the global_stats table
const DATABASE_STATS = [
    GlobalStat.TOTAL_PUZZLES_SOLVED,
    GlobalStat.TOTAL_PUZZLE_HOURS,
    GlobalStat.TOTAL_PIECES_PLACED,
    GlobalStat.TOTAL_MATCHES_PLAYED,
    GlobalStat.TOTAL_MATCH_HOURS,
];

export class GetGlobalStatQuery extends DBQuery<number> {
    
    public override query = `SELECT value FROM global_stats WHERE stat = $1 LIMIT 1;`;

    public override warningMs = null;

    private defaultValue: number;

    constructor(stat: GlobalStat, defaultValue: number) {
        super([stat]);
        this.defaultValue = defaultValue;
    }

    public override parseResult(resultRows: any[]): number {
        if (resultRows.length === 0) {
            return this.defaultValue;
        }
        return parseFloat(resultRows[0].value);
    }
}

export class SetGlobalStatQuery extends WriteDBQuery {
    public override query = `
        INSERT INTO global_stats (stat, value)
        VALUES ($1, $2)
        ON CONFLICT (stat) DO UPDATE SET value = EXCLUDED.value;
    `;

    public override warningMs = null;

    constructor(stat: GlobalStat, value: number) {
        super([stat, value]);
    }
}


/**
 * Consumer for handling guests. On guest disconnect, delete the guest user from the database.
 */
export class GlobalStatConsumer extends EventConsumer {

    private stats: GlobalStats = {
        [GlobalStat.TOTAL_USER_COUNT]: 0,
        [GlobalStat.TOTAL_GAMES_PLAYED]: 0,

        [GlobalStat.TOTAL_PUZZLES_SOLVED]: 0,
        [GlobalStat.TOTAL_PUZZLE_HOURS]: 0,
        [GlobalStat.TOTAL_PIECES_PLACED]: 0,
        [GlobalStat.TOTAL_MATCHES_PLAYED]: 0,
        [GlobalStat.TOTAL_MATCH_HOURS]: 0,
    }

    // Increment a global stat only in memory
    private incrementStat(stat: GlobalStat, amount: number = 1) {
        this.stats[stat] += amount;
        console.log('Incremented global stat:', stat, 'by', amount, 'to', this.stats[stat]);
    }

    // Increment a global stat in memory and in the database for stats that are stored in the global_stats table
    private incrementDatabaseStat(stat: GlobalStat, amount: number = 1) {
        if (!DATABASE_STATS.includes(stat)) {
            throw new Error(`Stat ${stat} is not stored in the global_stats table`);
        }
        this.incrementStat(stat, amount);
        Database.query(SetGlobalStatQuery, stat, this.stats[stat]);
    }

    public override async init(): Promise<void> {

        // Query database for initial total user count, and increment it when a new user is created
        this.stats[GlobalStat.TOTAL_USER_COUNT] = await Database.query(CountUsersQuery);
        DBUserObject.onCreate().subscribe(() => this.incrementStat(GlobalStat.TOTAL_USER_COUNT));

        // Query database for initial total games played count, and increment it when a user plays a game
        this.stats[GlobalStat.TOTAL_GAMES_PLAYED] = await Database.query(CountGamesPlayedQuery);
        DBUserObject.onChange().subscribe((change) => {
            if (change.event instanceof DBGameEndEvent) this.incrementStat(GlobalStat.TOTAL_GAMES_PLAYED);
        });

        // Initialize global stats that are pulled directly from global stats database table
        for (let stat of DATABASE_STATS) {
            this.stats[stat] = await Database.query(GetGlobalStatQuery, stat, 0);
        }

        // Increment total pieces placed after each game
        DBUserObject.onChange().subscribe((change) => {
            if (change.event instanceof DBGameEndEvent && change.event.args.numPlacements > 0) {
                this.incrementDatabaseStat(GlobalStat.TOTAL_PIECES_PLACED, change.event.args.numPlacements);
            }
            if (change.event instanceof DBPuzzleSubmitEvent) {
                if (change.event.args.isCorrect) this.incrementStat(GlobalStat.TOTAL_PUZZLES_SOLVED);
                if (change.event.args.seconds > 0) this.incrementStat(GlobalStat.TOTAL_PUZZLE_HOURS, change.event.args.seconds / 3600.0);
            }
            if (change.event instanceof DBPuzzleRushEvent) {
                this.incrementStat(GlobalStat.TOTAL_PUZZLES_SOLVED, change.event.args.score);
                this.incrementStat(GlobalStat.TOTAL_PUZZLE_HOURS, change.event.args.seconds / 3600.0);
            }
        });    

        // Print the initial stats
        console.log('Initial stats:', this.stats);
    }

    // Increment total matches played and total match hours after each ranked match
    public onMatchEnd(durationSeconds: number) {
        this.incrementDatabaseStat(GlobalStat.TOTAL_MATCHES_PLAYED);
        this.incrementDatabaseStat(GlobalStat.TOTAL_MATCH_HOURS, durationSeconds / 3600.0);
    }

    public getStats(): GlobalStats {
        return this.stats;
    }
}