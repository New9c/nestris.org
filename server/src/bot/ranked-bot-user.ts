import { BehaviorSubject, filter, map, Observable, Subject } from "rxjs";
import { ChatMessage, ClientRoomEventMessage, InRoomStatus, InRoomStatusMessage, JsonMessage, JsonMessageType, RoomStateUpdateMessage } from "../../shared/network/json-message";
import { RankedQueueConsumer } from "../online-users/event-consumers/ranked-queue-consumer";
import { BotUser } from "./bot-user";
import { sleepWithTimeout, waitUntilCondition, waitUntilValue } from "../scripts/rxjs";
import { sleep } from "../../shared/scripts/sleep";
import { randomChoice, randomInt } from "../../shared/scripts/math";
import { MultiplayerRoomEventType, MultiplayerRoomState, MultiplayerRoomStatus, PlayerIndex } from "../../shared/room/multiplayer-room-models";
import { EmulatorGameState } from "../../shared/emulator/emulator-game-state";
import { GymRNG } from "../../shared/tetris/piece-sequence-generation/gym-rng";
import { CurrentlyPressedKeys, KeyManager } from "../../shared/emulator/currently-pressed-keys";
import { TimeDelta } from "../../shared/scripts/time-delta";
import { GameAbbrBoardPacket, GameCountdownPacket, GameEndPacket, GameFullBoardPacket, GamePlacementPacket, GamePlacementSchema, GameStartPacket, PacketOpcode, StackRabbitPlacementPacket } from "../../shared/network/stream-packets/packet";
import { PacketAssembler } from "../../shared/network/stream-packets/packet-assembler";
import { BinaryEncoder } from "../../shared/network/binary-codec";
import { RoomConsumer } from "../online-users/event-consumers/room-consumer";
import { TetrominoType } from "../../shared/tetris/tetromino-type";
import MoveableTetromino from "../../shared/tetris/moveable-tetromino";
import { TetrisBoard } from "../../shared/tetris/tetris-board";
import { SRPlacementAI } from "./sr-placement-ai";
import { AIConfig, AIPlacement, PlacementAI } from "./placement-ai";
import { time } from "console";
import { PacketDisassembler } from "../../shared/network/stream-packets/packet-disassembler";
import { SmartGameStatus } from "../../shared/tetris/smart-game-status";
import { MultiplayerRoom } from "../room/multiplayer-room";
import { Keybind } from "../../shared/emulator/keybinds";

const BEFORE_GAME_MESSAGE = [
    "glhf",
    "gl",
    "good luck",
    "hf",
    "have fun",
    "lets have a good game",
    "hope its a good one",
    "lets do this",
    "ready up",
    "lets run it",
    "match time",
    "all set",
    "locked in",
    "lets get it",
    "lets go",
    "queue up",
    "may the best player win",
];

const AFTER_GAME_MESSAGE = [
    "gg",
    "good game",
    "ggs",
    "wp",
    "well played",
    "close one",
    "thanks for the game",
    "nice match",
    "good stuff",
    "tough one",
    "respect",
    "solid game",
    "we take those",
    "next time",
    "you got me",
    "gg wp",
];

function randomizeMessage(input: string): string {
    if (input.length === 0) return input;

    // Randomly decide whether to capitalize the first letter
    const shouldCapitalize = Math.random() < 0.5;
    const firstLetter = shouldCapitalize 
        ? input.charAt(0).toUpperCase() 
        : input.charAt(0).toLowerCase();
    
    const rest = input.slice(1);
    
    // Randomly decide whether to add an exclamation mark
    const shouldAddExclamation = Math.random() < 0.5;
    const exclamation = shouldAddExclamation ? '!' : '';
    
    return firstLetter + rest + exclamation;
}

function getRandomMessage(messageChoices: string[]) {
    return randomizeMessage(randomChoice(messageChoices));
}

interface OpponentGame {
    status: SmartGameStatus,
    toppedOut: boolean;
}

class LeftRoomEarlyError extends Error {
    constructor() { super('Left room early'); }
}

class MatchAbortedError extends Error {
    constructor() { super('Match aborted'); }
}

export interface RankedBotConfig {
    aiConfig: AIConfig,
}

export class RankedBotUser extends BotUser<RankedBotConfig> {
    readonly queueConsumer = this.eventManager.getConsumer(RankedQueueConsumer);
    readonly roomConsumer = this.eventManager.getConsumer(RoomConsumer);

    private inRoomStatus$ = new BehaviorSubject<InRoomStatusMessage>(
        new InRoomStatusMessage(InRoomStatus.NONE, null, null)
    );
    private roomState$ = this.inRoomStatus$.pipe(
        map(status => status.roomState as MultiplayerRoomState)
    );

    private roomStatus$ = this.inRoomStatus$.pipe(
        map(status => status.status)
    );

    private roomInfo$ = this.inRoomStatus$.pipe(
        map(status => status.roomInfo)
    );

    get roomState() {
        return this.inRoomStatus$.getValue().roomState as MultiplayerRoomState | null;
    }

    get roomInfo() {
        return this.inRoomStatus$.getValue().roomInfo;
    }

    get roomStatus() {
        return this.inRoomStatus$.getValue().status;
    }

    private placementIndex: number = 0;

    override async start() {

        // Wait some time before connecting
        await sleep(randomInt(5000, 1000000));

        // Connect the bot to the server
        this.connect();

        // Keep queuing and playing matches indefinitely
        while (true) {

            // Wait some time before joining the queue
            await sleep(randomInt(5000, 30000));

            // Find a match in the ranked queue
            const matchFound = await this.handleFindMatch(60);

            // If no match found, take a break before trying again
            if (!matchFound) {
                await this.takeBreak(randomInt(100, 1000));
                continue;
            }
            try {

                // If the bot is kicked from the room, end this function early
                const leftRoom$ = this.roomStatus$.pipe(
                    filter(status => status === InRoomStatus.NONE)
                );
                // This error is thrown when the bot leaves the room early
                const error = new LeftRoomEarlyError();

                await this.handleMatchStart(leftRoom$, error);
                await this.handlePlayingGame();
                await this.handleMatchEnd(leftRoom$, error);

                // After match, chance of disconnecting for a bit
                if (Math.random() < 0.5) await this.takeBreak(randomInt(100, 1000));

            } catch (error) {
                if (error instanceof LeftRoomEarlyError) {
                    console.log(`Bot ${this.username} left the room early`);
                } else if (error instanceof MatchAbortedError) {
                    // If match aborted, leave room
                    console.log(`Match bot ${this.username} was in was aborted, leaving room`);
                    await this.roomConsumer.freeSession(this.userid, this.sessionID);
                } else {
                    console.error(`Error in bot ${this.username}:`, error);
                }
            }
        }
    }

    /**
     * Disconnect for some time before reconnecting
     */
    private async takeBreak(seconds: number) {
        this.disconnect();
        await sleep(seconds * 1000);
        this.connect();
    }

    /**
     * Join the ranked queue and waits for a match to be found and the bot to be placed in a room.
     * After this function completes, the bot is in a room and ready to play.
     * If timeout is instead reached, returns false and does not join the room
     */
    private async handleFindMatch(timeoutSeconds: number): Promise<boolean> {

        // Join the ranked queue as a bot
        this.queueConsumer.joinRankedQueue(this.sessionID, null);
        console.log(`Bot ${this.username} joined the ranked queue, waiting for room...`);

        const timeout$ = new Subject<boolean>();
        const timeoutId = setTimeout(() => {
            timeout$.next(true);
            timeout$.complete();
        }, timeoutSeconds * 1000);

        // Wait until the bot is in the ranked room
        try {
            await waitUntilValue(this.roomStatus$, InRoomStatus.PLAYER, timeout$);
            console.log(`Bot ${this.username} is now in a room!`);
            return true;
        } catch {

            // If timeout ran out but just now found match, still continue to match
            if (this.roomStatus === InRoomStatus.PLAYER) return true;

            if (this.queueConsumer.userMatched(this.userid)) {
                console.log("bot timeout, but about to match so wait");
                await waitUntilValue(this.roomStatus$, InRoomStatus.PLAYER);
                console.log("matched after extra wait")
                return true;
            }

            console.log("No opponent found, exiting queue");
            return false;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    /**
     * Called when bot has joined the ranked room. Handles sending an initial message, sending 
     * the 'READY' signal, and waiting for the game to start.
     * After this function completes, the bot should start playing the game.
     * 
     * @param leftRoom$ The observable that emits when the bot prematurely leaves the room
     * @param error The error to throw if the bot leaves the room early
     * @throws {LeftRoomEarlyError} If the bot leaves the room early, thus ending this function early.
     */
    private async handleMatchStart(leftRoom$: Observable<unknown>, error: Error) {

        // Wait a random amount of time before sending a message
        await sleepWithTimeout(randomInt(1000, 2000), leftRoom$, error);

        // Randomly send a message before the game starts
        const message = getRandomMessage(BEFORE_GAME_MESSAGE);
        if (Math.random() < 0.2) this.sendJsonMessageToServer(new ChatMessage(this.username, message));

        // Wait a random amount of time before sending the 'READY' signal
        await sleepWithTimeout(randomInt(2000, 5000), leftRoom$, error);

        // Send 'READY' signal to the server
        this.sendJsonMessageToServer(new ClientRoomEventMessage({type: MultiplayerRoomEventType.READY }));

        // wait for the game to start (both players are ready)
        await waitUntilCondition(this.roomState$, state => state.status !== MultiplayerRoomStatus.BEFORE_GAME, leftRoom$, error);
        if (this.roomState?.status === MultiplayerRoomStatus.ABORTED) throw new MatchAbortedError();
        console.log(`Bot ${this.username} is now in game!`);        
    }

    /**
     * Play the game and stream data to the server until the game is over.
     */
    private async handlePlayingGame() {

        const roomState = this.roomState;
        if (!this.roomInfo || !roomState) throw new Error('Bot is not in a room');

        const room = this.roomConsumer.getRoomByRoomID(this.roomInfo.id);
        if (!room || !(room instanceof MultiplayerRoom)) throw new Error("Room not found by bot, something went wrong");

        // Initialize the game state with the room's seed and start level
        const rng = new GymRNG(this.roomState.currentSeed);
        const state = new EmulatorGameState(roomState.startLevel, rng, 3, false);

        // Initialize the key manager
        const keyManager = new KeyManager();

        // Manages calculating time differences between frames
        const timeDelta = new TimeDelta();

        // Batch packets together and send them at a regular interval
        const packetBatcher = new PacketBatcher((binaryData) => this.sendBinaryMessageToServer(binaryData));

        // Initialize AI and start calculating first placement
        const onPlacementComputed: (placement: AIPlacement) => void = (placement) => 
            packetBatcher.sendPacket(new StackRabbitPlacementPacket().toBinaryEncoder({
                bestEval: placement.bestEval,
                playerEval: placement.playerEval,
            }));
        const placementAI = new SRPlacementAI(this.config.aiConfig, onPlacementComputed);
        placementAI.registerPlacementPosition(0, state.getIsolatedBoard(), state.getCurrentPieceType(), state.getNextPieceType(), state.getStatus().level, state.getStatus().lines);

        // Send initial game start packet
        packetBatcher.sendPacket(new GameStartPacket().toBinaryEncoder({
            level: roomState.startLevel,
            current: state.getCurrentPieceType(),
            next: state.getNextPieceType(),
        }));

        // Send initial frame packet
        packetBatcher.sendPacket(new GameAbbrBoardPacket().toBinaryEncoder({
            delta: timeDelta.getDelta(),
            mtPose: state.getActivePiece().getMTPose(),
        }));

        // Reset the placement index
        this.placementIndex = 0;

        const EMULATOR_FPS = 60;
        let framesDone: number = 0;
        let epoch: number = performance.now();

        let topoutMs: number | null = null;

        // Mullen for a random amount of time after opponent tops out
        const mullenSeconds = randomInt(1, 10);

        // Loop until topout
        while (true) {

            // If opponent already topout and bot has higher score, force early top
            const opponentTopoutScore = room.getOpponentTopoutScore(this.sessionID);
            if (topoutMs === null && opponentTopoutScore !== null && state.getStatus().score > opponentTopoutScore) {
                topoutMs = Date.now();
            }
            const allowTopout = (topoutMs !== null && (Date.now() - topoutMs) / 1000 > mullenSeconds);
        
            // calculate how many frames to advance based on time elapsed to maintain 60fps
            const diff = performance.now() - epoch;
            const frames = diff / 1000 * EMULATOR_FPS | 0;
            const frameAmount = frames - framesDone;
        
            // Advance as many frames as needed to catch up to current time
            let gameOver = false;
            for (let i = 0; i < frameAmount; i++) {
                gameOver = this.advanceEmulatorState(state, keyManager, placementAI, timeDelta, packetBatcher, allowTopout);
                if (gameOver) break;
            }
            if (gameOver) break;
        
            // If more than one frame was executed in a tick cycle, log the number of frames skipped
            if (frameAmount > 1) console.log("Skipped", frameAmount-1, "frames");
        
            // update the number of frames done for the next calculation of frames to advance
            framesDone = frames;

            // Yield control to the event loop briefly
            await sleep(10);
        }

        // Send game end packet
        packetBatcher.sendPacket(new GameEndPacket().toBinaryEncoder({}));

        // Send any remaining packets and end the packet batcher interval
        packetBatcher.end();

        console.log(`Bot ${this.username} finished the game!`);
    }

    /**
     * Advance the emulator state by one game frame and send the updated state to the server.
     * @param state The current emulator game state to modify in-place
     * @param timeDelta The time delta object to use for calculating time differences
     * @param packetBatcher The packet batcher to use for sending packets
     * @param allowTopout If topout allowed, do not send any more inputs
     * @returns True if the game is over, false otherwise
     */
    private advanceEmulatorState(state: EmulatorGameState, keyManager: KeyManager, placementAI: PlacementAI, timeDelta: TimeDelta, packetBatcher: PacketBatcher, allowTopout: boolean): boolean {

        // Store previous state to compare with new state
        const previousBoard = state.getDisplayBoard();
        const previousCountdown = state.getCountdown();
        const wasPieceLocked = state.isPieceLocked();

        // Get the inputs to make for this frame
        const inputs = placementAI.getInputForPlacementAndFrame(this.placementIndex, state.getPlacementFrameCount() - 1);
        const topoutKeybinds = state.getPlacementFrameCount() > 10 ? [Keybind.PUSHDOWN] : [];
        keyManager.setOnlyPressed(allowTopout ? topoutKeybinds : inputs);

        // Advance the emulator state by one frame
        state.executeFrame(keyManager.generate());

        // Get the new state
        const currentBoard = state.getDisplayBoard();
        const currentCountdown = state.getCountdown();
        const isPieceLocked = state.isPieceLocked();
        const activePiece = state.getActivePiece();
        

        // send countdown packet if countdown has changed
        if (currentCountdown !== previousCountdown) {
            packetBatcher.sendPacket(new GameCountdownPacket().toBinaryEncoder({
                delta: timeDelta.getDelta(),
                countdown: currentCountdown ?? 0,
            }));
        }

        // Send placement packet if piece has been placed
        if (!wasPieceLocked && isPieceLocked) {

            // Register the next placement for AI computation. Note that the pieces have not updated yet, so we use next and next-next
            this.placementIndex++;
            const { postLockBoard, postLockStatus, current, next } = state.getPostLockState();
            placementAI.registerPlacementPosition(this.placementIndex, postLockBoard, current, next, postLockStatus.level, postLockStatus.lines);

            packetBatcher.sendPacket(new GamePlacementPacket().toBinaryEncoder({
                nextNextType: state.getNextNextPieceType(),
                    mtPose: activePiece.getMTPose(),
                    pushdown: state.getPushdownPoints(),
            }));
        }

        // Send packet with board info if board has changed
        if (!previousBoard.equals(currentBoard)) {

            if (!isPieceLocked) {
                // if there's an active piece, send abbreviated packet to save bandwidth
                packetBatcher.sendPacket(new GameAbbrBoardPacket().toBinaryEncoder({
                    delta: timeDelta.getDelta(),
                    mtPose: activePiece.getMTPose(),
                }));

            } else {
                // send full state, since there is no active piece to send abbreviated packet info
                packetBatcher.sendPacket(new GameFullBoardPacket().toBinaryEncoder({
                    delta: timeDelta.getDelta(),
                    board: currentBoard,
                }));
            }

        }

        const topout = state.isToppedOut();
        if (topout) console.log(`Bot ${this.username} topped out`);
        return topout;
    }

    /**
     * Wait until the server determines that the match is over, then leave the room.
     * @param leftRoom$ The observable that emits when the bot prematurely leaves the room
     * @param error The error to throw if the bot leaves the room early
     */
    private async handleMatchEnd(leftRoom$: Observable<unknown>, error: Error) {

        // Wait until the match is over, or the bot leaves the room
        await waitUntilCondition(
            this.roomState$,
            state => [MultiplayerRoomStatus.AFTER_MATCH, MultiplayerRoomStatus.ABORTED].includes(state?.status),
            leftRoom$,
            error
        );

        // Randomly send a message after the game ends
        const message = getRandomMessage(AFTER_GAME_MESSAGE);
        if (Math.random() < 0.2) {
            await sleep(randomInt(2000, 4000));
            this.sendJsonMessageToServer(new ChatMessage(this.username, message));
        }

        // Wait a random amount of time
        await sleep(randomInt(1000, 10000));

        // Leave the room
        await this.roomConsumer.freeSession(this.userid, this.sessionID);
    }

    public override async onJsonMessageFromServer(message: JsonMessage) {

        // Update the bot's room status
        if (message.type === JsonMessageType.IN_ROOM_STATUS) {
            const roomStatus = message as InRoomStatusMessage;
            this.inRoomStatus$.next(roomStatus);
        } else if (message.type === JsonMessageType.ROOM_STATE_UPDATE) {
            const roomState = message as RoomStateUpdateMessage;
            // This bot only plays in multiplayer rooms, so we can safely cast
            this.inRoomStatus$.next(new InRoomStatusMessage(
                this.roomStatus,
                this.roomInfo,
                roomState.state
            ))
        }
    }
}


/**
 * A class that batches packets together and sends them at a regular interval.
 */
class PacketBatcher {

    private assembler: PacketAssembler = new PacketAssembler();
    private interval: any;

    /**
     * Create a new packet batcher that sends packets at a regular interval.
     * @param sendBatchedPackets The function to call to send the batched packets
     * @param batchTimeMs The interval in milliseconds to send the packets
     */
    constructor(
        private readonly sendBatchedPackets: (packet: Uint8Array) => void,
        batchTimeMs: number = 250, // in ms, the interval to batch and send packets
    ) {
        // every batchTimeMs, send all accumulated data through callback
        this.interval = setInterval(() => this.flush(), batchTimeMs);
    }

    /**
     * Add a packet to the batcher to be sent.
     * @param packet The packet to add to the batch
     */
    public sendPacket(packetContent: BinaryEncoder) {
        this.assembler.addPacketContent(packetContent);
    }

    /**
     * End the packet batcher and send any remaining packets.
     */
    public end() {
        clearInterval(this.interval);
        this.flush();
    }

    /**
     * Batch and send all packets that have been accumulated since the last batch.
     * @returns 
     */
    private flush() {

        // if there are no packets to send, don't do anything
        if (!this.assembler.hasPackets()) {
            return;
        }
    
        // encode the packets into Uint8Array, and send it
        const binaryData = this.assembler.encode();
        this.sendBatchedPackets(binaryData);
    
        // clear the assembler for the next batch of packets
        this.assembler = new PacketAssembler();
    }
}