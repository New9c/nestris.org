import { Injectable } from '@angular/core';
import { sleep } from '../util/misc';
import { MeService } from './state/me.service';

export enum SoundEffect {
  CLICK = 'click',
  NOTE_LOW = 'note_low',
  NOTE_HIGH = 'note_high',
  NOTES_UP_LOW = 'note_up_low',
  NOTES_UP_HIGH = 'notes_up_high',
  NOTES_DOWN = 'notes_down',
  INCORRECT = 'incorrect',
  POP = 'pop',
  SWORD = 'sword',
}

@Injectable({
  providedIn: 'root'
})
export class SoundService {

  private audioContext: AudioContext;
  private audioBuffers: Map<SoundEffect, AudioBuffer> = new Map();
  private gainNodes: Map<SoundEffect, GainNode> = new Map();

  // Define sound files and corresponding volumes here
  private soundConfigs: Record<SoundEffect, { file: string, gain: number }> = {
    [SoundEffect.CLICK]: { file: 'click.wav', gain: 0.2 },
    [SoundEffect.NOTE_LOW]: { file: 'note-low.wav', gain: 1.1 },
    [SoundEffect.NOTE_HIGH]: { file: 'note-high.wav', gain: 1.3 },
    [SoundEffect.NOTES_UP_LOW]: { file: 'notes-up-low.wav', gain: 0.8 },
    [SoundEffect.NOTES_UP_HIGH]: { file: 'notes-up-high.wav', gain: 0.8 },
    [SoundEffect.NOTES_DOWN]: { file: 'notes-down.wav', gain: 0.8 },
    [SoundEffect.INCORRECT]: { file: 'incorrect.wav', gain: 0.4 },
    [SoundEffect.POP]: { file: 'pop.wav', gain: 0.8 },
    [SoundEffect.SWORD]: { file: 'sword.wav', gain: 0.1 },
  };

  constructor(
    private meService: MeService,
  ) {
    this.audioContext = new AudioContext();
    this.preloadSounds();
  }

  private async preloadSounds() {
    const startTime = Date.now();

    for (const [sound, { file, gain }] of Object.entries(this.soundConfigs)) {
      const buffer = await this.loadAudioBuffer(`./assets/sounds/${file}`);
      if (buffer) {
        this.audioBuffers.set(sound as SoundEffect, buffer);
        const gainNode = this.audioContext.createGain();
        gainNode.gain.value = gain;
        this.gainNodes.set(sound as SoundEffect, gainNode);
      }
    }

    console.log("All sounds loaded in", Date.now() - startTime, "ms");

    //this.testSounds();
  }

  private async testSounds() {
    console.log("test sounds");
    for (const sound of Object.values(SoundEffect)) {
      await sleep(1000);
      this.play(sound);
    }
  }

  private async loadAudioBuffer(url: string): Promise<AudioBuffer | null> {
    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      return await this.audioContext.decodeAudioData(arrayBuffer);
    } catch (error) {
      console.error(`Error loading sound ${url}:`, error);
      return null;
    }
  }


  play(sound: SoundEffect) {
    if (!this.meService.getSync()?.enable_sound) return;

    const buffer = this.audioBuffers.get(sound);
    const gainNode = this.gainNodes.get(sound);

    if (!buffer || !gainNode) return;

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    source.start(0);
  }
}
