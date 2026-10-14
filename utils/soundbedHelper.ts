// Interactive Commercial Soundbed Synthesizer using Web Audio API

export interface SoundbedTrack {
  id: string;
  name: string;
  category: string;
  bpm: number;
}

export const SOUNDBED_TRACKS: SoundbedTrack[] = [
  { id: 'none', name: 'None (Pure Voiceover)', category: 'Clean', bpm: 0 },
  { id: 'hype_beat', name: '💥 Dhamaka Commercial Beat', category: 'TV Promo & Sale', bpm: 124 },
  { id: 'warm_chai', name: '☕ Warm Chai & FMCG Acoustic', category: 'Emotional / Family', bpm: 90 },
  { id: 'epic_trailer', name: '🏙️ Epic Housing & Property Launch', category: 'Cinematic / Luxury', bpm: 75 },
  { id: 'desi_melody', name: '🌙 Desi Sitar & Festive Ambience', category: 'Cultural / Festive', bpm: 82 },
  { id: 'corporate_tech', name: '💼 Modern Tech & App Pulse', category: 'Corporate / Fintech', bpm: 110 },
];

class SoundbedEngine {
  private ctx: AudioContext | null = null;
  private isPlaying = false;
  private intervalId: number | null = null;
  private masterGain: GainNode | null = null;
  private currentTrackId: string = 'none';

  private initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.18; // Ducked so voiceover is clear
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setVolume(volume0to1: number) {
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(Math.max(0, Math.min(1, volume0to1)), this.ctx.currentTime, 0.05);
    }
  }

  public play(trackId: string, volume: number = 0.2) {
    this.stop();
    if (trackId === 'none') {
      this.currentTrackId = 'none';
      return;
    }

    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    this.currentTrackId = trackId;
    this.isPlaying = true;
    this.setVolume(volume);

    const track = SOUNDBED_TRACKS.find(t => t.id === trackId);
    const bpm = track?.bpm || 100;
    const beatIntervalMs = (60 / bpm) * 1000;

    let step = 0;

    const playStep = () => {
      if (!this.isPlaying || !this.ctx || !this.masterGain) return;
      const now = this.ctx.currentTime;

      if (trackId === 'hype_beat') {
        // Kick on 0, 2
        if (step % 2 === 0) {
          this.triggerKick(now);
        }
        // Hihat on every beat
        this.triggerHihat(now);
        // Synth bassline chord
        const bassNotes = [110, 130.81, 98, 123.47]; // A2, C3, G2, B2
        this.triggerSynth(bassNotes[Math.floor(step / 2) % bassNotes.length], now, 0.2, 'sawtooth');
      } else if (trackId === 'warm_chai') {
        // Gentle acoustic guitar-like chords
        const chords = [
          [261.63, 329.63, 392.00], // C major
          [220.00, 261.63, 329.63], // A minor
          [174.61, 220.00, 261.63], // F major
          [196.00, 246.94, 293.66], // G major
        ];
        const chord = chords[Math.floor(step / 4) % chords.length];
        const note = chord[step % chord.length];
        this.triggerAcousticPluck(note, now, 0.6);
      } else if (trackId === 'epic_trailer') {
        // Low cinematic drone & sub boom
        if (step % 4 === 0) {
          this.triggerCinematicBoom(now);
          this.triggerSynth(55, now, 1.8, 'sine'); // Sub bass 55Hz
          this.triggerSynth(164.81, now, 1.5, 'triangle'); // E3
        }
      } else if (trackId === 'desi_melody') {
        // Raag Bhairavi inspired modal notes (Sitar / Tanpura drone)
        if (step % 8 === 0) {
          // Tanpura base drone (Sa - Pa)
          this.triggerSynth(146.83, now, 2.8, 'triangle'); // D3
          this.triggerSynth(220.00, now, 2.5, 'sine'); // A3
        }
        const sitarRaga = [293.66, 311.13, 369.99, 440.00, 493.88, 554.37, 587.33];
        const currentNote = sitarRaga[step % sitarRaga.length];
        this.triggerSitarTone(currentNote, now);
      } else if (trackId === 'corporate_tech') {
        // Tech arpeggio
        const techNotes = [220, 277.18, 329.63, 440, 329.63, 277.18];
        this.triggerPluck(techNotes[step % techNotes.length], now);
        if (step % 4 === 0) {
          this.triggerKick(now, 0.5);
        }
      }

      step++;
    };

    playStep();
    this.intervalId = window.setInterval(playStep, beatIntervalMs);
  }

  public stop() {
    this.isPlaying = false;
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  // --- Voice Synthesis Instruments ---
  private triggerKick(time: number, power: number = 0.8) {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.frequency.setValueAtTime(140, time);
    osc.frequency.exponentialRampToValueAtTime(38, time + 0.12);
    gain.gain.setValueAtTime(power, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.16);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(time);
    osc.stop(time + 0.16);
  }

  private triggerHihat(time: number) {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'highpass' as any;
    osc.frequency.setValueAtTime(8000, time);
    gain.gain.setValueAtTime(0.08, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(time);
    osc.stop(time + 0.05);
  }

  private triggerSynth(freq: number, time: number, duration: number, type: OscillatorType) {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);
    gain.gain.setValueAtTime(0.12, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(time);
    osc.stop(time + duration);
  }

  private triggerAcousticPluck(freq: number, time: number, duration: number) {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, time);
    gain.gain.setValueAtTime(0.2, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(time);
    osc.stop(time + duration);
  }

  private triggerCinematicBoom(time: number) {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.frequency.setValueAtTime(90, time);
    osc.frequency.exponentialRampToValueAtTime(25, time + 0.9);
    gain.gain.setValueAtTime(0.4, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 1.2);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(time);
    osc.stop(time + 1.2);
  }

  private triggerSitarTone(freq: number, time: number) {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, time);
    // slight vibrato
    osc.frequency.linearRampToValueAtTime(freq * 1.02, time + 0.1);
    osc.frequency.linearRampToValueAtTime(freq, time + 0.3);
    gain.gain.setValueAtTime(0.09, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.45);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(time);
    osc.stop(time + 0.45);
  }

  private triggerPluck(freq: number, time: number) {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, time);
    gain.gain.setValueAtTime(0.1, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(time);
    osc.stop(time + 0.18);
  }
}

export const soundbedPlayer = new SoundbedEngine();
