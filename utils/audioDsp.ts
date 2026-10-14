// Clean Audio Mastering & Voice Configuration Engine
// Preserves 100% natural, crystal-clear human vocal timbre from Gemini TTS

import { VoiceName } from '../types';

export interface VoiceProfileConfig {
  baseVoice: 'Kore' | 'Zephyr' | 'Charon' | 'Fenrir' | 'Puck';
  defaultSpeed: number;
  label: string;
}

export const VOICE_PROFILES: Record<VoiceName, VoiceProfileConfig> = {
  // Female Voices
  [VoiceName.Ayesha_Pak_Female]: {
    baseVoice: 'Zephyr',
    defaultSpeed: 1.0,
    label: 'Soft & Elegant (Lawn & Beauty)',
  },
  [VoiceName.Maryam_Pak_Female]: {
    baseVoice: 'Kore',
    defaultSpeed: 1.0,
    label: 'Warm & Composed (Chai & Family FMCG)',
  },
  [VoiceName.Zara_Pak_Female]: {
    baseVoice: 'Zephyr',
    defaultSpeed: 1.05,
    label: 'Snappy & Modern (Quick Commerce)',
  },
  [VoiceName.Sana_Pak_Female]: {
    baseVoice: 'Kore',
    defaultSpeed: 1.0,
    label: 'Sharp & Authoritative (Corporate & News)',
  },
  [VoiceName.Mehwish_Pak_Female]: {
    baseVoice: 'Zephyr',
    defaultSpeed: 1.08,
    label: 'Playful & Bubbly (FM Radio RJ)',
  },
  [VoiceName.Hina_Pak_Female]: {
    baseVoice: 'Zephyr',
    defaultSpeed: 0.95,
    label: 'Delicate Nazakat (Poetic Bridal)',
  },

  // Male Voices
  [VoiceName.Hamza_Pak_Male]: {
    baseVoice: 'Fenrir',
    defaultSpeed: 1.05,
    label: 'High-Impact Dhamaka (Bumper Sales)',
  },
  [VoiceName.Tariq_Pak_Male]: {
    baseVoice: 'Charon',
    defaultSpeed: 0.95,
    label: 'Deep Baritone (Luxury Real Estate)',
  },
  [VoiceName.Bilal_Pak_Male]: {
    baseVoice: 'Puck',
    defaultSpeed: 1.05,
    label: 'Karachi/Lahore Youth (App & FM RJ)',
  },
  [VoiceName.Zayd_Pak_Male]: {
    baseVoice: 'Puck',
    defaultSpeed: 1.0,
    label: 'Crisp Bilingual (Corporate Fintech)',
  },
  [VoiceName.Farhan_Pak_Male]: {
    baseVoice: 'Charon',
    defaultSpeed: 0.95,
    label: 'Soulful & Respectful (Ramadan/Eid)',
  },
  [VoiceName.Faizan_Pak_Male]: {
    baseVoice: 'Fenrir',
    defaultSpeed: 1.0,
    label: 'Cinematic Action (Trailer & Launch)',
  },

  // Base Studio Voices
  [VoiceName.Puck]: { baseVoice: 'Puck', defaultSpeed: 1.0, label: 'Standard Clear Male' },
  [VoiceName.Charon]: { baseVoice: 'Charon', defaultSpeed: 1.0, label: 'Deep Baritone Male' },
  [VoiceName.Fenrir]: { baseVoice: 'Fenrir', defaultSpeed: 1.0, label: 'Intense Command Male' },
  [VoiceName.Kore]: { baseVoice: 'Kore', defaultSpeed: 1.0, label: 'Calm & Warm Female' },
  [VoiceName.Zephyr]: { baseVoice: 'Zephyr', defaultSpeed: 1.0, label: 'Soft & Airy Female' },
  [VoiceName.Aoede]: { baseVoice: 'Kore', defaultSpeed: 1.0, label: 'Expressive Female' },
  [VoiceName.Custom_Cloned]: { baseVoice: 'Charon', defaultSpeed: 1.0, label: 'Custom Voice Clone' },
};

/**
 * Clean Broadcast Master
 * Applies gentle dynamics limiting to ensure pristine commercial volume without clipping,
 * while leaving the natural human pitch, speed, and vocal quality 100% UNTOUCHED and NATURAL.
 */
export const enhanceVoiceAcoustics = async (inputBlob: Blob): Promise<Blob> => {
  // If browser Web Audio API is available, apply soft broadcast compression
  // without ANY resampling or pitch changes:
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) return inputBlob;

  const tempCtx = new AudioCtx();
  try {
    const arrayBuffer = await inputBlob.arrayBuffer();
    const sourceBuffer = await tempCtx.decodeAudioData(arrayBuffer);

    const sampleRate = sourceBuffer.sampleRate || 24000;
    const targetLength = sourceBuffer.length;

    // 1-to-1 offline context (exact same duration and sample rate, NO pitch shift, NO speed distortion)
    const offlineCtx = new OfflineAudioContext(1, targetLength, sampleRate);

    const source = offlineCtx.createBufferSource();
    source.buffer = sourceBuffer;
    source.playbackRate.value = 1.0; // Strictly 1.0x native human speed

    // Gentle transparent studio compressor
    const compressor = offlineCtx.createDynamicsCompressor();
    compressor.threshold.value = -16;
    compressor.knee.value = 15;
    compressor.ratio.value = 2.5;
    compressor.attack.value = 0.005;
    compressor.release.value = 0.12;

    source.connect(compressor);
    compressor.connect(offlineCtx.destination);

    source.start(0);

    const renderedBuffer = await offlineCtx.startRendering();
    return audioBufferToWavBlob(renderedBuffer);
  } catch (err) {
    console.warn('Direct clean audio passthrough:', err);
    return inputBlob;
  } finally {
    if (tempCtx.state !== 'closed') {
      tempCtx.close();
    }
  }
};

/**
 * Encodes an AudioBuffer into a WAV Blob (16-bit PCM).
 */
export const audioBufferToWavBlob = (buffer: AudioBuffer): Blob => {
  const numChannels = 1;
  const sampleRate = buffer.sampleRate;
  const channelData = buffer.getChannelData(0);
  const numSamples = channelData.length;

  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;
  const bufferSize = 44 + dataSize;

  const arrayBuffer = new ArrayBuffer(bufferSize);
  const view = new DataView(arrayBuffer);

  // RIFF header
  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // SubChunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat: 1 = PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // BitsPerSample
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Write samples with soft limiter clipping prevention
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    let s = channelData[i];
    if (s > 0.98) s = 0.98;
    else if (s < -0.98) s = -0.98;
    const sample = s < 0 ? s * 0x8000 : s * 0x7fff;
    view.setInt16(offset, sample, true);
    offset += 2;
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
};

const writeAscii = (view: DataView, offset: number, string: string) => {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
};
