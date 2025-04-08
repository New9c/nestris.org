import { OnlineUserActivityType } from "../../shared/models/online-activity";
import { xpOnPuzzleRush } from "../../shared/nestris-org/xp-system";
import { RushPuzzle } from "../../shared/puzzles/db-puzzle";
import { PuzzleRushAttempt, PuzzleRushAttemptEvent, PuzzleRushEventType, puzzleRushIncorrect, PuzzleRushRoomState, puzzleRushScore, PuzzleRushStatus } from "../../shared/room/puzzle-rush-models";
import { ClientRoomEvent, RoomType } from "../../shared/room/room-models";
import { DBPuzzleRushEvent, DBUserObject } from "../database/db-objects/db-user";
import { EventConsumerManager } from "../online-users/event-consumer";
import { PuzzleRushConsumer } from "../online-users/event-consumers/puzzle-rush-consumer";
import { Room, RoomError } from "../online-users/event-consumers/room-consumer";
import { UserSessionID } from "../online-users/online-user";


export class PuzzleRushRoom extends Room<PuzzleRushRoomState> {

    private puzzleSet!: RushPuzzle[];

    // Whether each player is ready
    private playerReady!: boolean[];

    // How many pieces each player placed
    private pieceCount!: number[];

    // The calculated pps of the player
    private pps!: (number | null)[];
    
    // Previous lifetime record for puzzle rush
    private puzzleRushRecord!: number[];

    // Puzzle attempts for each player
    private attempts!: PuzzleRushAttempt[][];

    // Start time when BEFORE_GAME transitions to DURING_GAME
    private startTime?: number;

    constructor(
        private readonly playerIDs: UserSessionID[],
        private readonly rated: boolean,
    ) {
        if (playerIDs.length === 1 && rated) throw new RoomError("Single player puzzle rush cannot be rated");

        super(
            playerIDs.length > 1 ? OnlineUserActivityType.PUZZLE_BATTLES : OnlineUserActivityType.PUZZLE_RUSH,
            playerIDs,
            false // cannot spectate puzzle rush/battles
        );
    }

    private getPlayerIndex(userid: string) {
        return this.playerIDs.map(playerID => playerID.userid).indexOf(userid);
    }

    protected override async initRoomState(): Promise<PuzzleRushRoomState> {

        // All players are not ready at first
        this.playerReady = this.playerIDs.map(_ => false);

        // No players placed any pieces, and pps not yet known
        this.pieceCount = this.playerIDs.map(_ => 0);
        this.pps = this.playerIDs.map(_ => null);

        // No attempts at start
        this.attempts = this.playerIDs.map(_ => []);

        // get dbUsers from player userids
        const playerUsers = await Promise.all(this.playerIDs.map(playerID => DBUserObject.get(playerID.userid)));

        // Initialize previous puzzle rush record
        this.puzzleRushRecord = playerUsers.map(user => user.puzzle_rush_best);

        // Initialize puzzle set
        const userids = this.playerIDs.map(playerID => playerID.userid);
        this.puzzleSet = await EventConsumerManager.getInstance().getConsumer(PuzzleRushConsumer).fetchPuzzleSetForUsers(userids);

        // Then, initialize puzzle rush state based on users
        return {
            type: playerUsers.length === 1 ? RoomType.PUZZLE_RUSH : RoomType.PUZZLE_BATTLES,
            status: PuzzleRushStatus.BEFORE_GAME,
            rated: this.rated,
            players: playerUsers.map(user => ({
                userid: user.userid,
                username: user.username,
                highestTrophies: user.highest_trophies,
                puzzleElo: user.puzzle_elo,
                progress: [],
                currentPuzzleID: this.puzzleSet[0].id,
                ended: false,
            }))
        };
    }

    /**
     * Handle a event sent by a client in the room
     * @param sessionID The sessionID of the player
     * @param event The event sent by the player
     */
    protected async onClientRoomEvent(userid: string, sessionID: string, event: ClientRoomEvent): Promise<void> {
        const playerIndex = this.getPlayerIndex(userid);
        if (playerIndex === -1) return;

        const state = this.getRoomState();

        switch (event.type) {

            // Change player ready status to ready. If all ready, change state to DURING_GAME
            case PuzzleRushEventType.READY:

                this.playerReady[playerIndex] = true;
                if (this.playerReady.every(ready => ready)) {
                    state.status = PuzzleRushStatus.DURING_GAME;
                    this.startTime = Date.now();
                    this.updateRoomState(state);
                }
                return;

            case PuzzleRushEventType.ATTEMPT:
                this.onSubmitAttempt(playerIndex, event as PuzzleRushAttemptEvent);
                return;

            case PuzzleRushEventType.TIMEOUT:
                this.setEnded(playerIndex);
                return;

            case PuzzleRushEventType.REMATCH:
                this.initRoomState().then(state => this.updateRoomState(state));

        }
    }

    private onSubmitAttempt(playerIndex: number, attempt: PuzzleRushAttemptEvent) {

        // Only relevant while in game
        const state = this.getRoomState();
        if (state.status != PuzzleRushStatus.DURING_GAME) return;

        // Get the puzzle the player is submitting for
        const currentPuzzleID = state.players[playerIndex].currentPuzzleID;
        const puzzle = this.puzzleSet.find(puzzle => puzzle.id === currentPuzzleID);
        if (puzzle === undefined) return;

        // Check whether submission is correct, allowing for inverse placements for same pieces
        const isCorrect = (
            (puzzle.current === attempt.current && puzzle.next === attempt.next)
            ||
            (puzzle.current === attempt.next && puzzle.next === attempt.current)
        );

        // Update the puzzle progress for the user
        state.players[playerIndex].progress.push(isCorrect);

        // Update piece count for player
        if (attempt.current !== undefined) this.pieceCount[playerIndex]++;
        if (attempt.next !== undefined) this.pieceCount[playerIndex]++;

        // Store attempt
        this.attempts[playerIndex].push({ current: attempt.current, next: attempt.next });
        
        // Check if player hit the incorrect limit
        if (puzzleRushIncorrect(state.players[playerIndex]) >= 3) {
            // If 3 incorrect, end player
            this.setEnded(playerIndex);
        } else {
            // Go to next puzzle for user
            const currentIndex = this.puzzleSet.findIndex(puzzle => puzzle.id === currentPuzzleID);
            const nextIndex = (currentIndex + 1) % this.puzzleSet.length; // for the CRAZY chance user exhausts puzzles, wrap around
            state.players[playerIndex].currentPuzzleID = this.puzzleSet[nextIndex].id;
            this.updateRoomState(state);
        }
    }

    // If player leaves room, mark as ended
    protected override async onPlayerLeave(userid: string, sessionID: string): Promise<void> {
        const playerIndex = this.getPlayerIndex(userid);
        if (playerIndex === -1) return;

        this.setEnded(playerIndex);
    }

    // Player has ended. If all players ended, move to AFTER_GAME state
    private setEnded(playerIndex: number) {
        const state = this.getRoomState();
        if (state.status !== PuzzleRushStatus.DURING_GAME) return;
        if (state.players[playerIndex].ended) return;

        // Set ended state
        state.players[playerIndex].ended = true;

        // Calculate pps
        const seconds = (Date.now() - this.startTime!) / 1000;
        const pieceCount = this.pieceCount[playerIndex];
        this.pps[playerIndex] = pieceCount === 0 ? 0 : pieceCount / seconds;

        // Check if all players ended, and end if so
        if (state.players.every(player => player.ended)) {
            this.onMatchEnd(state);
            return;
        }

        // Otherwise, send updated state
        this.updateRoomState(state);
    }

    private getPostMatchStats(state: PuzzleRushRoomState): { label: string, value: string[] }[] {
        const playerIndicies = state.players.map((_, i) => i);

        return [
            {
                label: 'Lifetime record',
                value: playerIndicies.map(playerIndex => Math.max(this.puzzleRushRecord[playerIndex], puzzleRushScore(state.players[playerIndex])).toString()),
            },
            {
                label: 'Pieces per second',
                value: playerIndicies.map(playerIndex => `${this.pps[playerIndex]!.toFixed(1)}/sec`),
            },
            {
                label: 'Puzzles attempted',
                value: playerIndicies.map(playerIndex => state.players[playerIndex].progress.length.toString()),
            }
        ]
    }

    private onMatchEnd(state: PuzzleRushRoomState) {
        const playerIndicies = state.players.map((_, i) => i);

        // End the match and update client
        state.status = PuzzleRushStatus.AFTER_GAME;
        state.puzzleSet = this.puzzleSet;
        state.attempts = this.attempts;
        state.stats = this.getPostMatchStats(state);
        this.updateRoomState(state);

        // update puzzle rush stats for each user, without blocking
        playerIndicies.forEach(playerIndex => {
            const score = puzzleRushScore(state.players[playerIndex]);

            DBUserObject.alter(state.players[playerIndex].userid,new DBPuzzleRushEvent({
                xpGained: xpOnPuzzleRush(score),
                score,
                seconds: (Date.now() - this.startTime!) / 1000,
                pps: this.pps[playerIndex]!,
            }), false);
        });

        // Update puzzle elo if rated match
        if (this.rated) {
            // TODO
        }
    }

}