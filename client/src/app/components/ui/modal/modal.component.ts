import { ChangeDetectionStrategy, Component, HostListener, Input, OnInit } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { ModalManagerService } from 'src/app/services/modal-manager.service';

@Component({
  selector: 'app-modal',
  templateUrl: './modal.component.html',
  styleUrls: ['./modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ModalComponent {
  @Input() visibility$: BehaviorSubject<boolean> = new BehaviorSubject(true);
  @Input() showX: boolean = true;
  @Input() padding: boolean = true;

  public backgroundColor = this.modalManager.getModalBackgroundColor();

  constructor(
    private readonly modalManager: ModalManagerService,
  ) {
  }

  // if escape key is pressed, close the modal
  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      this.visibility$.next(false);
    }
  }

}
