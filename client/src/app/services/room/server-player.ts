import { BehaviorSubject, Observable } from "rxjs";
import { GameState, GameStateSnapshot, GameStateSnapshotWithoutBoard } from "src/app/shared/game-state-from-packets/game-state";
import { Platform } from "src/app/shared/models/platform";
import { COUNTDOWN_NOT_IN_GAME, GameAbbrBoardSchema, GameCountdownSchema, GameFullBoardSchema, GameFullStateSchema, GamePlacementSchema, GameRecoverySchema, GameStartSchema, PACKET_NAME, PacketContent, PacketOpcode } from "src/app/shared/network/stream-packets/packet";
import MoveableTetromino from "src/app/shared/tetris/moveable-tetromino";
import { TetrisBoard } from "src/app/shared/tetris/tetris-board";
import { TetrominoType } from "src/app/shared/tetris/tetromino-type";
import { PacketReplayer } from "src/app/util/packet-replayer";
import { RoomService } from "./room.service";
import { ClientRoom } from "./client-room";
import { RequestRecoveryRoomEvent, RoomEventType } from "src/app/shared/room/room-models";
import { PlayerIndex } from "src/app/shared/room/multiplayer-room-models";

/**
 * A ServerPlayer tracks game state of a player based on server-sent packets. It uses lag buffering to
 * smooth out the game state updates, and maintains the current state of the player.
 */
export class ServerPlayer {
    private snapshot$ = new BehaviorSubject<GameStateSnapshotWithoutBoard>(this.getDefaultSnapshot());
    private board$ = new BehaviorSubject<TetrisBoard>(new TetrisBoard());

    // The current game state of the player, or null if not in a game
    private state: GameState | null;

    // The replayer that buffers packets and updates the game state
    private replayer: PacketReplayer;

    // Stores the most recent snapshot of the game state, if the game has ended
    private previousSnapshot: GameStateSnapshot | null;

    private sendRecoveryRequestInterval?: any;
    private recoveryRetries: number = 0;
  
    // The constructor initializes the ServerPlayer with a buffer delay (in ms) for the PacketReplayer
    constructor(
      private readonly clientRoom: ClientRoom,
      private readonly playerIndex: PlayerIndex.PLAYER_1 | PlayerIndex.PLAYER_2,
      private readonly defaultLevel: number,
      private readonly isPlayer: boolean,
      bufferDelay: number = 300
    ) {

        // No ongoing game at initialization
        this.state = null;

        // No snapshot at initialization
        this.previousSnapshot = null;

        // Create a PacketReplayer to buffer packets from the server
        this.replayer = new PacketReplayer((packets) => {

            // When PacketReplayer decides it is time for a packet(s) to be executed, update the player state with the packet(s)
            packets.forEach((packet) => { 
              try {
                this.processPacket(packet);
              } catch {

                // If received an invalid packet and no subsequent recovery packet, keep requesting for a new recovery packet
                if (!this.sendRecoveryRequestInterval) {

                  const event: RequestRecoveryRoomEvent = {
                    type: RoomEventType.REQUEST_RECOVERY,
                    playerIndex: this.playerIndex
                  }
                  this.sendRecoveryRequestInterval = setInterval(() => {
                  
                    // Recovery request still causes bugs. Quickfix for spectators is just to reload the page and try again
                    if (!this.isPlayer && this.recoveryRetries >= 3) location.reload();
                    else {
                      this.recoveryRetries++;
                      this.clientRoom.sendClientRoomEvent(event);
                      console.log("Sent request for recovery packet, attempt", this.recoveryRetries);
                    }
                    
                  }, 3000);
                  console.log("Packet error, starting timer to request for recovery packet");
                }
              }
        });

        }, bufferDelay);
    }  
  
    /**
     * Process a packet received from the server. Updates the game state of the player based on the packet.
     * @param packet The packet received from the server
     */
    private processPacket(packet: PacketContent) {

      // Ignore stackrabbit placement packets
      if (packet.opcode === PacketOpcode.STACKRABBIT_PLACEMENT) return;
  
      // Can only transition null -> GameStartPacket or null -> GameRecoveryPacket
      // Otherwise, ignore the packet
      if (this.state === null && ![PacketOpcode.GAME_START, PacketOpcode.GAME_RECOVERY].includes(packet.opcode)) {
        throw new Error(`Invalid packet received for player: ${PACKET_NAME[packet.opcode]}`);
        return;
      }
 
      if (packet.opcode === PacketOpcode.GAME_START) {
        const gameStart = packet.content as GameStartSchema;
        this.state = new GameState(gameStart.level, gameStart.current, gameStart.next);

      } else if (packet.opcode === PacketOpcode.GAME_RECOVERY) {
        const gameRecovery = packet.content as GameRecoverySchema;

        if (this.sendRecoveryRequestInterval) {
          clearInterval(this.sendRecoveryRequestInterval);
          this.sendRecoveryRequestInterval = undefined;
          console.log("Got recovery packet, stopping request for recovery timer");
        }

        // Sent when spectator joins after game ends
        if (gameRecovery.countdown === COUNTDOWN_NOT_IN_GAME) {
          this.state = null;
          this.previousSnapshot = {
            board: gameRecovery.isolatedBoard,
            level: gameRecovery.level,
            lines: gameRecovery.lines,
            score: gameRecovery.score,
            next: gameRecovery.next,
            tetrisRate: 0,
            droughtCount: 0,
            transitionInto19: null,
            transitionInto29: null,
            numPlacements: 0,
            countdown: 0
          };
          console.log("got spectator recovery packet after topout", packet.content);
        }

        // Spectators that join mid-game will be sent a recovery packet
        else if (!this.state) {
          this.state = GameState.fromRecovery(gameRecovery);
          console.log("game recovery for server player, create new state");
        }
        else {
          this.state.onRecovery(gameRecovery);
          console.log("game recovery for server player, update existing state");
        }

      } else if (packet.opcode === PacketOpcode.GAME_FULL_STATE) {
        const fullState = packet.content as GameFullStateSchema;
        this.state!.onFullState(fullState); 

      } else if (packet.opcode === PacketOpcode.GAME_PLACEMENT) {
        const placement = (packet.content as GamePlacementSchema);
        const activePiece = MoveableTetromino.fromMTPose(this.state!.getCurrentType(), placement.mtPose);
        this.state!.onPlacement(activePiece.getMTPose(), placement.nextNextType, placement.pushdown);

      } else if (packet.opcode === PacketOpcode.GAME_COUNTDOWN) {
        this.state!.setCountdown((packet.content as GameCountdownSchema).countdown);

      } else if (packet.opcode === PacketOpcode.GAME_FULL_BOARD) {
        const board = (packet.content as GameFullBoardSchema).board;
        this.state!.onFullBoardUpdate(board);

      } else if (packet.opcode === PacketOpcode.GAME_ABBR_BOARD) {
        const mtPose = (packet.content as GameAbbrBoardSchema).mtPose;
        this.state!.onAbbreviatedBoardUpdate(mtPose);

      } else if (packet.opcode === PacketOpcode.GAME_END) {
        this.previousSnapshot = this.state!.getSnapshot();
        this.state = null;

      } else {
        console.error(`Invalid packet received for player: ${PACKET_NAME[packet.opcode]}`);
      }

      // Update the snapshot
      this.snapshot$.next(this.state?.getSnapshotWithoutBoard() ?? this.previousSnapshot ?? this.getDefaultSnapshot());
      this.board$.next(this.state?.getCurrentBoard() ?? this.previousSnapshot?.board ?? new TetrisBoard());
    }
  
    /**
     * Called when a packet is received from the server. Adds the packet to the PacketReplayer queue.
     * @param packet The packet received from the server
     */
    public onReceivePacket(packet: PacketContent) {
  
      // add the packet to the PacketReplayer queue, to be executed when the PacketReplayer decides
      this.replayer.ingestPacket(packet);
  
    }

    /**
     * Resets the game state of the player to the default state.
     */
    public resetSnapshot() {
      this.board$.next(new TetrisBoard());
      this.snapshot$.next(this.getDefaultSnapshot());
    }
  
    /**
     * @returns An observable of the current game state of the player
     */
    public getSnapshot$(): Observable<GameStateSnapshotWithoutBoard> {
      return this.snapshot$.asObservable();
    }

    /**
     * @returns An observable of the current game board of the player
     */
    public getBoard$(): Observable<TetrisBoard> {
      return this.board$;
    }

    private getDefaultSnapshot(): GameStateSnapshotWithoutBoard {
      return { 
        level: this.defaultLevel,
        lines: 0,
        score: 0,
        next: TetrominoType.ERROR_TYPE,
        countdown: 0,
        tetrisRate: 0,
        droughtCount: null,
        transitionInto19: null,
        transitionInto29: null,
        numPlacements: 0,
      }
    };

    public onDelete() {
      clearInterval(this.sendRecoveryRequestInterval);
    }
}