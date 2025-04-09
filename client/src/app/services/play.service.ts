import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { NotificationType } from '../shared/models/notifications';
import { Platform } from '../shared/models/platform';
import { FetchService, Method } from './fetch.service';
import { ModalManagerService, ModalType } from './modal-manager.service';
import { NotificationService } from './notification.service';
import { VideoCaptureService } from './ocr/video-capture.service';
import { PlatformInterfaceService } from './platform-interface.service';
import { RankedQueueService } from './room/ranked-queue.service';
import { WebsocketService } from './websocket.service';
import { MeService } from './state/me.service';
import { RoomService } from './room/room.service';
import { ServerRestartWarningService } from './server-restart-warning.service';
import { QueueType } from '../shared/network/json-message';

@Injectable({
  providedIn: 'root'
})
export class PlayService {

  constructor(
    public platformService: PlatformInterfaceService,
    public videoCapture: VideoCaptureService,
    private modalManager: ModalManagerService,
    private fetchService: FetchService,
    private websocketService: WebsocketService,
    private notifier: NotificationService,
    private rankedQueueService: RankedQueueService,
    private roomService: RoomService,
    private meService: MeService,
    private restartWarning: ServerRestartWarningService,
    private router: Router,
  ) { }


  // If in OCR mode, opens up modal if video source disconnected. Returns true if need to open up modal
  private checkVideoSource(callback: () => void): boolean {

    if (this.platformService.getPlatform() === Platform.ONLINE) return false;
    if (this.videoCapture.getCalibrationValid()) return false;

    this.notifier.notify(NotificationType.WARNING, "Your capture source was disconnected and needs to be recalibrated.");
    this.modalManager.showModal(ModalType.CALIBRATE_OCR, {}, () => {
      if (this.platformService.getPlatform() === Platform.OCR && this.videoCapture.getCalibrationValid()) {
        callback();
      }
    });
    
    return true;
  }

  private checkWarning(): boolean {
    if (this.restartWarning.isWarning()) {
      this.notifier.notify(NotificationType.ERROR, "Server is about to restart! Please wait.");
      return true;
    }
    return false;
  }

  async playSolo(checkVideoSource: boolean = true) {
    if (this.checkWarning()) return;
    if (checkVideoSource && this.checkVideoSource(() => this.playSolo(false))) return;

    const sessionID = this.websocketService.getSessionID();
    this.fetchService.fetch(Method.POST, `/api/v2/create-solo-room/${sessionID}`);
  }

  async playRanked(checkVideoSource: boolean = true) {
    if (this.checkWarning()) return;
    if (checkVideoSource && this.checkVideoSource(() => this.playRanked(false))) return;

    // If user has not selected starting trophies
    if (this.meService.getSync()!.trophies === -1) {
      
      // If not in play page and modal not showing, just go to play page and hide any modals
      if (this.router.url !== '/play' || this.modalManager.isModal()) {
        this.router.navigate(['/play']);
        this.modalManager.hideModal();
      } else {
        // Open the select starting trophies modal
        this.modalManager.showModal(ModalType.SELECT_STARTING_TROPHIES);
      }

      // In either case, do not attempt to join the queue
      return;
    }

    // Attempt to join the ranked queue
    await this.rankedQueueService.joinQueue();
  }

  async playPuzzles() {
    if (this.checkWarning()) return;

    // Leave any existing room
    this.roomService.leaveRoom();

    this.router.navigate(['/online/puzzle'], { 
      queryParams: { mode: 'rated' } 
    });
  }

  async playPuzzleRush() {
    if (this.checkWarning()) return;

    const sessionID = this.websocketService.getSessionID();
    this.fetchService.fetch(Method.POST, `/api/v2/start-puzzle-rush/${sessionID}`);
  }

  async playPuzzleBattle() {
    if (this.checkWarning()) return;

    await this.rankedQueueService.joinQueue(QueueType.PUZZLE_BATTLE);
  }
}
