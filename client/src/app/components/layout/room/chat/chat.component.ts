import { Component, ElementRef, EventEmitter, Input, Output } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Message } from 'src/app/services/room/room.service';

const MAX_CHARACTERS = 100;

@Component({
  selector: 'app-chat',
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.scss']
})
export class ChatComponent {
  @Input() disabledMessage?: string;
  @Input() placeholderMessage?: string;
  @Input() numSpectators: number = 0;
  @Input() messages: Message[] = [];
  @Output() sendMessage = new EventEmitter<string>();

  public message: string = "";
  public rows$ = new BehaviorSubject<number>(1);

  public messageHash(index: number, message: Message) {
    return message.id;
  }
}
