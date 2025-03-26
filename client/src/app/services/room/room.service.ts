import { Injectable, Injector } from '@angular/core';
import { ChatMessage, InRoomStatus, InRoomStatusMessage, JsonMessage, JsonMessageType, RoomStateUpdateMessage, SpectatorCountMessage } from 'src/app/shared/network/json-message';
import { RoomInfo, RoomState, RoomType } from 'src/app/shared/room/room-models';
import { WebsocketService } from '../websocket.service';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { MeService } from '../state/me.service';
import { ClientRoom } from './client-room';
import { SoloClientRoom } from './solo-client-room';
import { RoomModal } from 'src/app/components/layout/room/room/room.component';
import { v4 as uuid } from 'uuid';
import { MultiplayerClientRoom } from './multiplayer-client-room';
import { FetchService, Method } from '../fetch.service';

const MAX_MESSAGES = 15;
export interface Message extends ChatMessage {
  id: string;
}


/**
 * A service that manages the state of the room the client is in.
 * 
 * IN_ROOM_STATUS messages from the server update the ClientRoom on whether the session is in a room or not.
 */
@Injectable({
  providedIn: 'root'
})
export class RoomService {

  private status: InRoomStatus = InRoomStatus.NONE;

  // The client room the client is currently in
  private clientRoom: ClientRoom | null = null;

  // The client room the client is currently in, or was in before it was destroyed
  private oldClientRoom: ClientRoom | null = null;

  public modal$ = new BehaviorSubject<RoomModal | null>(null);

  private roomInfo$ = new BehaviorSubject<RoomInfo | null>(null);
  private numSpectators$ = new BehaviorSubject<number>(0);

  private messages$ = new BehaviorSubject<Message[]>([]);

  // Unfortunate lazy hack. Triggers whenever multiplayer match ends, to trigger tv room refresh
  public onMatchEnd$ = new Subject<void>();

  constructor(
    private injector: Injector,
    private websocketService: WebsocketService,
    private meService: MeService,
    private fetchService: FetchService,
    private router: Router,
  ) {

    this.websocketService.onEvent(JsonMessageType.IN_ROOM_STATUS).subscribe(async (event: JsonMessage) => {
      await this.onInRoomStatusEvent(event as InRoomStatusMessage);
    });

    this.websocketService.onEvent(JsonMessageType.ROOM_STATE_UPDATE).subscribe(async (event: JsonMessage) => {
      await this.onRoomStateUpdate(event as RoomStateUpdateMessage);
    });

    this.websocketService.onEvent(JsonMessageType.SPECTATOR_COUNT).subscribe((event: JsonMessage) => {
      this.numSpectators$.next((event as SpectatorCountMessage).count);
    });

    this.websocketService.onEvent(JsonMessageType.CHAT).subscribe((event: JsonMessage) => {
      const chatMessage = event as ChatMessage;

      // Push the message to the messages array, limiting the number of messages
      const newMessage: Message = Object.assign({}, chatMessage, { id: uuid() });
      this.messages$.next([
        ...this.messages$.getValue(), newMessage
      ].slice(-MAX_MESSAGES));
    });
  }

  /**
   * Leave the room the client is in, if any.
   */
  public async leaveRoom() {

    // Cleanup the client room
    this.clientRoom?.destroy();

    // Tell the server to leave the room
    await this.fetchService.fetch(Method.POST, `/api/v2/leave-room/${this.websocketService.getSessionID()}`);
  }

  /**
   * Send a chat message to the server.
   */
  public async sendChatMessage(message: string) {
    const username = await this.meService.getUsername();
    this.websocketService.sendJsonMessage(new ChatMessage(username, message));
  }

  private createClientRoom(event: InRoomStatusMessage): ClientRoom {

    // Reset modal
    this.modal$.next(null);

    // Create the client room based on the room type
    switch (event.roomState!.type) {
      case RoomType.SOLO: return new SoloClientRoom(this.injector, this.modal$, event);
      case RoomType.MULTIPLAYER: return new MultiplayerClientRoom(this.injector, this.modal$, event);
      default: throw new Error(`Unknown room type ${event.roomState!.type}`);
    }
  }

  /**
   * Update the room state based on the IN_ROOM_STATUS message from the server.
   * @param event The IN_ROOM_STATUS message
   */
  private async onInRoomStatusEvent(event: InRoomStatusMessage) {

    // If the client is not in a room
    if (event.status === InRoomStatus.NONE) {
      this.status = InRoomStatus.NONE;
      this.roomInfo$.next(null);
      this.clientRoom = null;
      this.numSpectators$.next(0);

      console.log("Updated room status to NONE");
      return;
    }

    // Assert that roomID exists now that the client is in a room
    if (!event.roomInfo || !event.roomState) {
      throw new Error('Client is in a room but room info is missing');
    }

    // Update the room state
    this.status = event.status;
    this.roomInfo$.next(event.roomInfo);

    // Reset messages
    this.messages$.next([]);

    // Create the client room
    this.clientRoom = this.createClientRoom(event);
    this.oldClientRoom = this.clientRoom;
    await this.clientRoom.init(event);

    // If not tv mode, navigate to the room and set room id as query parameter
    if (!event.isTVMode) this.router.navigate(['/online/room'], { queryParams: {id: event.roomInfo.id }});

    console.log(`Navigating to room with status ${this.status}, room info ${this.getRoomInfo()}, and room state ${this.clientRoom.getState()}`);
  }

  /**
   * Update the room state based on the ROOM_EVENT message from the server.
   * @param event The ROOM_EVENT message
   */
  private async onRoomStateUpdate(event: RoomStateUpdateMessage) {

    if (!this.clientRoom) {
      throw new Error('Client is not in a room but received a room state update');
    }

    await this.clientRoom._updateState(event.state);
    console.log('Updated room state', event.state);
  }

  /**
   * Get the room info.
   */
  public getRoomInfo(): RoomInfo | null {
    return this.roomInfo$.getValue();
  }

  public getRoomInfo$(): Observable<RoomInfo | null> {
    return this.roomInfo$.asObservable();
  }

  /**
   * Get the type of the room.
   * @returns The type of the room, or null if the client is not in a room
   */
  public getRoomType(): RoomType | null {
    if (!this.clientRoom) return null;
    return this.clientRoom.getState().type;
  }

  /**
   * Get the messages as an observable.
   */
  public getMessages$(): Observable<Message[]> {
    return this.messages$.asObservable();
  }

  /**
   * Get the number of spectators as an observable.
   */
  public getNumSpectators$(): Observable<number> {
    return this.numSpectators$.asObservable();
  }

  /**
   * Get the client room.
   * @returns The client room
   */
  public getClient<T extends ClientRoom = ClientRoom>(): T {
    if (!this.clientRoom) {
      throw new Error('Client is not in a room');
    }
    return this.clientRoom as T;
  }

  /**
   * Get the old client room.
   * @returns The old client room
   */
  public getOldClient<T extends ClientRoom = ClientRoom>(): T {
    if (!this.oldClientRoom) {
      throw new Error('Client is not in a room');
    }
    return this.oldClientRoom as T;
  }

}

