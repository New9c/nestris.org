import { Directive, HostListener, Input } from '@angular/core';
import { SoundEffect, SoundService } from '../services/sound.service';

@Directive({
  selector: '[appClickSound]'
})
export class ClickSoundDirective {
  @Input() clickSoundDisabled: boolean = false;

  constructor(
    private readonly soundService: SoundService
  ) {}

  @HostListener('mousedown')
  onMouseDown() {
    if (!this.clickSoundDisabled) this.soundService.play(SoundEffect.CLICK);
  }

}
