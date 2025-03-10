import { Injectable } from '@angular/core';
import { StateService } from './state.service';
import { GlobalChatMessage, JsonMessage, JsonMessageType, OnGlobalChatMessage } from 'src/app/shared/network/json-message';
import { BehaviorSubject } from 'rxjs';
import { MeService } from './me.service';

// The maximum number of messages to keep in the chat history
const MAX_MESSAGES = 50;

@Injectable({
  providedIn: 'root'
})
export class GlobalChatService extends StateService<GlobalChatMessage[]>() {

  public hasUnread$ = new BehaviorSubject<boolean>(false);
  private initialHistory: boolean = true;

  constructor(
    private readonly meService: MeService,
  ) {
    super([JsonMessageType.ON_GLOBAL_CHAT_MESSAGE]);
  }

  /**
   * Initially, global chat messages are empty
   */
  protected override async fetch(): Promise<GlobalChatMessage[]> {
    return [];
  }

  /**
   * Update the chat history with the new messages
   * @param event The ON_GLOBAL_CHAT_MESSAGE event
   * @param oldState The current chat history
   * @returns The updated chat history
   */
  protected override onEvent(event: JsonMessage, oldState: GlobalChatMessage[]): GlobalChatMessage[] {
    const message = event as OnGlobalChatMessage;

    // Mark that there are unread messages if not from initial chat history
    const myid = this.meService.getUserIDSync()!;
    if (this.initialHistory) {
      this.initialHistory = false;
    } else if (message.messages.some(msg => msg.userid !== myid)) {
      // Show unread if at least one message not from same user
      this.hasUnread$.next(true);
    }
    
    // Add the new messages to the chat history
    const newMessages = [...oldState, ...message.messages];

    // Sort messages from oldest to newest
    newMessages.sort((a, b) => a.timeMs - b.timeMs);

    // Keep only the most recent messages
    return newMessages.slice(-MAX_MESSAGES);
  }
}
