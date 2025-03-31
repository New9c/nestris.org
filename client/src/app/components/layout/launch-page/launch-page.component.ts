import { ChangeDetectionStrategy, Component, HostListener } from '@angular/core';
import { Subscription } from 'rxjs';
import { Countdown, LaunchService } from 'src/app/services/launch.service';

@Component({
  selector: 'app-launch-page',
  templateUrl: './launch-page.component.html',
  styleUrls: ['./launch-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LaunchPageComponent {

  score: number = 0;
  scoreVisible: boolean = false;



  constructor(
    public readonly launch: LaunchService
  ) {
  }

  countdownText(countdown: Countdown | null) {
    if (!countdown) return "";

    const { days, hours, minutes, seconds } = countdown;
  
    // Pad each value with leading zeros to ensure they're 2 digits (except days which can be more)
    const formattedDays = days.toString().padStart(2, '0');
    const formattedHours = hours.toString().padStart(2, '0');
    const formattedMinutes = minutes.toString().padStart(2, '0');
    const formattedSeconds = seconds.toString().padStart(2, '0');
    
    return `${formattedDays}d ${formattedHours}h ${formattedMinutes}m ${formattedSeconds}s`;
  }

  label(number: number) {
    return number.toString().padStart(2, '0');
  }

  setScore(score: number) {
    this.score = score;
    if (score > 0) this.scoreVisible = true;
  }


  private keysPressed = new Set<string>();

  @HostListener('window:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent) {
    this.keysPressed.add(event.key.toLowerCase());

    // Secret bypass to hide launch page
    if (this.keysPressed.has('q') && this.keysPressed.has('p')) {
      this.launch.launch$.next(true);
      this.launch.show$.next(false);
    }

    event.stopPropagation();
  }

  @HostListener('window:keyup', ['$event'])
  handleKeyUp(event: KeyboardEvent) {
    this.keysPressed.delete(event.key.toLowerCase());
    event.stopPropagation();
  }

}
