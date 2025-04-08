import { Authentication, DBUser, DBUserAttributes, LoginMethod } from "../../../shared/models/db-user";
import { getLeagueFromIndex, updateXP } from "../../../shared/nestris-org/league-system";
import { DBObject } from "../db-object";
import { DBObjectAlterError, DBObjectNotFoundError } from "../db-object-error";
import { Database, DBQuery, WriteDBQuery } from "../db-query";
import { SetHighscoreGameQuery } from "../db-queries/set-highscore-game-query";
import { getQuest, getQuestStatus, QuestID } from "../../../shared/nestris-org/quest-system";

// The initial number of trophies a user has. -1 means the user has not played any ranked games yet
const INITIAL_RANKED_TROPHIES = -1;


// The parameters required to create a new user
export interface DBUserParams {
    username: string,
    login_method: LoginMethod,
    authentication: Authentication
}

abstract class DBUserEvent {
    constructor() {}

    toString(): string {
        return this.constructor.name;
    }
}

class GenericEvent<T extends {}> extends DBUserEvent {
    constructor(public readonly args: T) { super(); }

    override toString(): string {
        return `${super.toString()} with args ${JSON.stringify(this.args)}`;
    }
}

// When user connects to the server, update last_online
export class DBUserOnlineEvent extends DBUserEvent {}

// Update a single attribute of the user
interface UpdateAttributeArgs { attribute: string, value: any }
export class DBUpdateAttributeEvent extends GenericEvent<UpdateAttributeArgs> {}

// Set the initial trophies of the user, provided they have not already been set
interface SetInitialTrophiesArgs { trophies: number }
export class DBSetInitialTrophiesEvent extends GenericEvent<SetInitialTrophiesArgs> {}

// Manual set highscore of the user
interface ManualSetHighscoreArgs { highscore: number }
export class DBManualSetHighscoreEvent extends GenericEvent<ManualSetHighscoreArgs> {}

// An XP event advances the user's XP and possibly their league. In addition, DBUser will check for quest update
// changes and trigger additional XP increases if necessary.
interface XPArgs { xpGained: number }
export class XPEvent<T extends XPArgs = XPArgs> extends GenericEvent<T> {}

// Update user stats after puzzle submission
interface PuzzleSubmitArgs extends XPArgs { newElo: number, isCorrect: boolean, seconds: number }
export class DBPuzzleSubmitEvent extends XPEvent<PuzzleSubmitArgs> {}

interface PuzzleRushArgs extends XPArgs { score: number, pps: number, seconds: number }
export class DBPuzzleRushEvent extends XPEvent<PuzzleRushArgs> {}

// Update highest stats on game end
interface GameEndArgs extends XPArgs {
    gameID: string,
    score: number,
    level: number,
    lines: number,
    transitionInto19: number | null,
    transitionInto29: number | null,
    numPlacements: number
}
export class DBGameEndEvent extends XPEvent<GameEndArgs> {}

// When the user has made progress to any quest
interface QuestProgressArgs extends XPArgs { questProgress: number[] }
export class DBQuestProgressEvent extends XPEvent<QuestProgressArgs> {}



// Update user's trophies by trophyDelta amount
interface RankedMatchEndArgs extends XPArgs { win: boolean, lose: boolean, trophyChange: number }
export class DBRankedMatchEndEvent extends XPEvent<RankedMatchEndArgs> {}



export class DBUserObject extends DBObject<DBUser, DBUserParams, DBUserEvent>("DBUser") {

    protected override async fetchFromDB(): Promise<DBUser> {

        class UserQuery extends DBQuery<DBUser> {

            public override query = `
                SELECT ${DBUserAttributes.join(',')} FROM users WHERE userid = $1
            `;
        
            public override warningMs = null;
        
            constructor(userid: string) {
                super([userid]);
            }
        
            public override parseResult(resultRows: any[]): DBUser {
                if (resultRows.length === 0) {
                    throw new DBObjectNotFoundError('User not found');
                }
                const user: DBUser = resultRows[0];

                // int8 are returned as strings due to possible overflow, cast to number
                user.puzzle_seconds_played = Number(user.puzzle_seconds_played);
                return user;
            }
        }

        return await Database.query(UserQuery, this.id);
    }

    // Given parameters, create the DBUser in-memory with initial values
    protected override createInMemory(params: DBUserParams): DBUser {
        return {
            userid: this.id,
            username: params.username,
            login_method: params.login_method,
            authentication: params.authentication,
            created_at: new Date(),
            last_online: new Date(),
            league: 0,
            xp: 0,

            matches_played: 0,
            wins: 0,
            losses: 0,
            trophies: INITIAL_RANKED_TROPHIES,
            highest_trophies: INITIAL_RANKED_TROPHIES,

            puzzle_elo: 0,
            highest_puzzle_elo: 0,
            puzzles_attempted: 0,
            puzzles_solved: 0,
            puzzle_seconds_played: 0,

            puzzle_rush_best: 0,
            puzzle_rush_attempts: 0,
            puzzle_rush_pps: 0,

            games_played: 0,
            highest_score: 0,
            highest_level: 0,
            highest_lines: 0,

            highest_transition_into_19: 0,
            highest_transition_into_29: 0,
            enable_receive_friend_requests: true,
            notify_on_friend_online: true,
            enable_sound: true,
            enable_runahead: false,
            show_live_analysis: true,
            disable_midgame_quests: false,

            allow_bot_opponents: true,

            keybind_emu_move_left: 'ArrowLeft',
            keybind_emu_move_right: 'ArrowRight',
            keybind_emu_rot_left: 'Z',
            keybind_emu_rot_right: 'X',
            keybind_emu_up: 'ArrowUp',
            keybind_emu_down: 'ArrowDown',
            keybind_emu_start: 'Enter',
            keybind_emu_reset: 'R',
            keybind_puzzle_rot_left: 'Z',
            keybind_puzzle_rot_right: 'X',
            keybind_puzzle_undo: 'Q',

            quest_progress: [],
            about_me: null,
        };
    }

    // Given the newly-created in-memory object, create it in the database
    protected override async createInDatabase(newUser: DBUser): Promise<void> {

        class CreateUserQuery extends WriteDBQuery {
            public override query = `
                INSERT INTO users (
                    ${DBUserAttributes.join(',')}
                ) VALUES (
                    ${DBUserAttributes.map((_, i) => `$${i + 1}`).join(',')}
                )
            `;
            public override warningMs = null;
        
            constructor(newUser: DBUser) {
                super(DBUserAttributes.map(attr => (newUser as any)[attr]));
            }
        }

        await Database.query(CreateUserQuery, newUser);
    }

    // Completely deletes the object from the database
    protected override deleteFromDatabase(userid: string): Promise<void> {

        class DeleteUserQuery extends WriteDBQuery {
            public override query = `DELETE FROM users WHERE userid = $1`;
            public override warningMs = null;
        
            constructor(userid: string) {
                super([userid]);
            }
        }

        return Database.query(DeleteUserQuery, userid);
    }

    // Given an event, alters the object in-memory
    protected override alterInMemory(event: DBUserEvent): void {

        // Function to increment XP and potentially promote user to a new league
        const incrementXP = (xpGained: number) => {
            // Calculate new XP and league
            const currentLeague = getLeagueFromIndex(this.inMemoryObject.league);
            const { newXP, newLeague } = updateXP(this.inMemoryObject.xp, currentLeague, xpGained);

            // Update in-memory object
            this.inMemoryObject.xp = newXP;
            this.inMemoryObject.league = newLeague;
        }

        // Alter the user based on the event
        switch (event.constructor) {

            // On user online, update last_online to now
            case DBUserOnlineEvent:
                this.inMemoryObject.last_online = new Date();
                break;

            // On alter quest progress, update quest progress
            case DBQuestProgressEvent:
                const questArgs = (event as DBQuestProgressEvent).args;
                this.inMemoryObject.quest_progress = [...questArgs.questProgress];
                break;
            
            // On alter trophies, add trophyDelta to trophies, ensuring trophies is non-negative
            case DBRankedMatchEndEvent:
                const matchArg = (event as DBRankedMatchEndEvent).args;
                this.inMemoryObject.matches_played++;
                if (matchArg.win) this.inMemoryObject.wins++;
                if (matchArg.lose) this.inMemoryObject.losses++;
                this.inMemoryObject.trophies = Math.max(0, this.inMemoryObject.trophies + matchArg.trophyChange);
                this.inMemoryObject.highest_trophies = Math.max(this.inMemoryObject.highest_trophies, this.inMemoryObject.trophies);
                break;

            // On alter puzzle elo, update puzzle stats
            case DBPuzzleSubmitEvent:
                const puzzleArgs = (event as DBPuzzleSubmitEvent).args;
                this.inMemoryObject.puzzle_elo = puzzleArgs.newElo;
                this.inMemoryObject.highest_puzzle_elo = Math.max(this.inMemoryObject.highest_puzzle_elo, puzzleArgs.newElo);
                this.inMemoryObject.puzzles_attempted++;
                this.inMemoryObject.puzzles_solved += puzzleArgs.isCorrect ? 1 : 0;
                this.inMemoryObject.puzzle_seconds_played += Math.round(puzzleArgs.seconds);
                break;

            // On puzzle rush, update puzzle rush record if it's higher, and increment attempts
            case DBPuzzleRushEvent:
                const puzzleRushArgs = (event as DBPuzzleRushEvent).args;
                this.inMemoryObject.puzzle_rush_attempts++;
                // If new record, update score and pps
                if (puzzleRushArgs.score > this.inMemoryObject.puzzle_rush_best) {
                    this.inMemoryObject.puzzle_rush_best = puzzleRushArgs.score;
                    this.inMemoryObject.puzzle_rush_pps = Math.round(puzzleRushArgs.pps * 100); // stored multipled by 100 for space
                }
                break;

            // On game end, update highest stats
            case DBGameEndEvent:
                const gameEndArgs = (event as DBGameEndEvent).args;
                const isHighscore = gameEndArgs.score > this.inMemoryObject.highest_score;
                this.inMemoryObject.highest_score = Math.max(this.inMemoryObject.highest_score, gameEndArgs.score);
                this.inMemoryObject.highest_level = Math.max(this.inMemoryObject.highest_level, gameEndArgs.level);
                this.inMemoryObject.highest_lines = Math.max(this.inMemoryObject.highest_lines, gameEndArgs.lines);
                this.inMemoryObject.highest_transition_into_19 = Math.max(this.inMemoryObject.highest_transition_into_19, gameEndArgs.transitionInto19 ?? 0);
                this.inMemoryObject.highest_transition_into_29 = Math.max(this.inMemoryObject.highest_transition_into_29, gameEndArgs.transitionInto29 ?? 0);
                this.inMemoryObject.games_played++;

                // If highscore, start query to update the highscore game
                if (isHighscore) {
                    Database.query(SetHighscoreGameQuery, this.inMemoryObject.userid, gameEndArgs.gameID);
                }
                break;

            case DBSetInitialTrophiesEvent:
                const initialTrophiesArgs = (event as DBSetInitialTrophiesEvent).args;
                if (this.inMemoryObject.trophies !== INITIAL_RANKED_TROPHIES) {
                    throw new DBObjectAlterError('Initial trophies already set');
                }
                this.inMemoryObject.trophies = initialTrophiesArgs.trophies;
                this.inMemoryObject.highest_trophies = initialTrophiesArgs.trophies;
                break;

            case DBManualSetHighscoreEvent:
                const highscoreArgs = (event as DBManualSetHighscoreEvent).args;
                this.inMemoryObject.highest_score = highscoreArgs.highscore;
                break;
                
            // Update a single attribute
            case DBUpdateAttributeEvent:
                const attributeArgs = (event as DBUpdateAttributeEvent).args;
                
                // If attribute does not exist, throw error
                if (!this.inMemoryObject.hasOwnProperty(attributeArgs.attribute)) {
                    throw new DBObjectAlterError(`Attribute ${attributeArgs.attribute} does not exist`);
                }

                // Update the attribute
                (this.inMemoryObject as any)[attributeArgs.attribute] = attributeArgs.value;
                break;
        }

        // Update xp gained
        if (event instanceof XPEvent) incrementXP((event as XPEvent).args.xpGained);
    }

    // Save altered DBUser to the database
    protected override saveToDatabase(): Promise<void> {

        const userid = this.id;

        class SaveUserQuery extends WriteDBQuery {
            public override query = `
                UPDATE users SET (
                    ${DBUserAttributes.join(',')}
                ) = (
                    ${DBUserAttributes.map((_, i) => `$${i + 1}`).join(',')}
                ) WHERE userid = $${DBUserAttributes.length + 1}
            `;
            public override warningMs = null;
        
            constructor(user: DBUser) {
                super(DBUserAttributes.map(attr => (user as any)[attr]).concat([userid]));
            }
        }

        return Database.query(SaveUserQuery, this.inMemoryObject);
    }

}