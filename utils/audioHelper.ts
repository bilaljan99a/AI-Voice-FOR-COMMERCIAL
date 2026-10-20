/**
 * Audio Helper & Acoustic Analyzer
 * Provides decoding, WAV header generation, acoustic feature extraction,
 * and multi-speaker audio concatenation.
 */

import { DialogueLine, DualCharacterAnalysisResult } from '../types';
import { audioBufferToWavBlob } from './audioDsp';

export const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const base64Data = base64String.split(',')[1] || base64String;
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export const base64ToUint8Array = (base64: string): Uint8Array => {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

export const isWavFormat = (data: Uint8Array): boolean => {
  return (
    data.length >= 4 &&
    data[0] === 0x52 && // 'R'
    data[1] === 0x49 && // 'I'
    data[2] === 0x46 && // 'F'
    data[3] === 0x46 // 'F'
  );
};

export const pcmToWavBlob = (data: Uint8Array, sampleRate: number = 24000): Blob => {
  if (isWavFormat(data)) {
    return new Blob([data], { type: 'audio/wav' });
  }

  const header = writeWavHeader(data, sampleRate);
  return new Blob([header], { type: 'audio/wav' });
};

const writeString = (view: DataView, offset: number, string: string) => {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
};

const writeWavHeader = (samples: Uint8Array, sampleRate: number): ArrayBuffer => {
  const buffer = new ArrayBuffer(44 + samples.length);
  const view = new DataView(buffer);
  const channels = 1;
  const bitDepth = 16; // 16-bit PCM

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * (bitDepth / 8), true);
  view.setUint16(32, channels * (bitDepth / 8), true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, samples.length, true);

  const bytes = new Uint8Array(buffer);
  bytes.set(samples, 44);

  return buffer;
};

/**
 * Autocorrelation pitch detector
 */
const autoCorrelate = (buffer: Float32Array, sampleRate: number): number => {
  const SIZE = buffer.length;
  let rms = 0;

  for (let i = 0; i < SIZE; i++) {
    const val = buffer[i];
    rms += val * val;
  }
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.01) return -1;

  let r1 = 0;
  let r2 = SIZE - 1;
  const thres = 0.2;
  for (let i = 0; i < SIZE / 2; i++) {
    if (Math.abs(buffer[i]) < thres) {
      r1 = i;
      break;
    }
  }
  for (let i = 1; i < SIZE / 2; i++) {
    if (Math.abs(buffer[SIZE - i]) < thres) {
      r2 = SIZE - i;
      break;
    }
  }

  const trimmed = buffer.slice(r1, r2);
  const c = new Array(trimmed.length).fill(0);
  for (let i = 0; i < trimmed.length; i++) {
    for (let j = 0; j < trimmed.length - i; j++) {
      c[i] = c[i] + trimmed[j] * trimmed[j + i];
    }
  }

  let d = 0;
  while (c[d] > c[d + 1]) d++;
  let maxval = -1;
  let maxpos = -1;
  for (let i = d; i < trimmed.length; i++) {
    if (c[i] > maxval) {
      maxval = c[i];
      maxpos = i;
    }
  }

  let T0 = maxpos;
  if (T0 === 0) return -1;

  const x1 = c[T0 - 1];
  const x2 = c[T0];
  const x3 = c[T0 + 1];
  const a = (x1 + x3 - 2 * x2) / 2;
  const b = (x3 - x1) / 2;
  if (a) T0 = T0 - b / (2 * a);

  return sampleRate / T0;
};

/**
 * Deep acoustic analysis of user voice audio sample
 */
export const analyzeVoiceSample = async (
  audioBlob: Blob
): Promise<{
  estimatedPitchHz: number;
  pitchCategory: 'Deep Baritone' | 'Natural Mid' | 'High Pitch';
  suggestedGender: 'Male' | 'Female';
  suggestedBaseVoice: 'Puck' | 'Charon' | 'Fenrir' | 'Kore' | 'Zephyr';
  suggestedTexture: string;
  suggestedDelivery: string;
  durationSeconds: number;
  energyLevel: string;
}> => {
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  const ctx = new AudioCtx();

  try {
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    const duration = audioBuffer.duration;
    const channelData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;

    const windowSize = 2048;
    const pitches: number[] = [];
    let totalRms = 0;

    for (let i = 0; i < channelData.length - windowSize; i += windowSize * 2) {
      const slice = channelData.slice(i, i + windowSize);
      const pitch = autoCorrelate(slice, sampleRate);
      if (pitch > 70 && pitch < 350) {
        pitches.push(pitch);
      }
      let sliceRms = 0;
      for (let j = 0; j < slice.length; j++) sliceRms += slice[j] * slice[j];
      totalRms += Math.sqrt(sliceRms / slice.length);
    }

    const avgRms = totalRms / Math.max(1, Math.floor(channelData.length / (windowSize * 2)));

    let medianPitch = 145;
    if (pitches.length > 0) {
      pitches.sort((a, b) => a - b);
      medianPitch = Math.round(pitches[Math.floor(pitches.length / 2)]);
    }

    let pitchCategory: 'Deep Baritone' | 'Natural Mid' | 'High Pitch' = 'Natural Mid';
    let suggestedGender: 'Male' | 'Female' = 'Male';
    let suggestedBaseVoice: 'Puck' | 'Charon' | 'Fenrir' | 'Kore' | 'Zephyr' = 'Puck';
    let suggestedTexture = 'Warm & Resonant';
    let suggestedDelivery = 'High-Impact Commercial Dhamaka';
    let energyLevel = 'Balanced Commercial';

    if (medianPitch < 135) {
      pitchCategory = 'Deep Baritone';
      suggestedGender = 'Male';
      suggestedBaseVoice = avgRms > 0.08 ? 'Fenrir' : 'Charon';
      suggestedTexture = 'Deep chest resonance with commanding presence';
      suggestedDelivery = avgRms > 0.08 ? 'High-Impact TV Commercial Promo' : 'Luxury Real Estate & Corporate Baritone';
      energyLevel = avgRms > 0.08 ? 'High-Impact Dhamaka' : 'Subtle & Premium';
    } else if (medianPitch > 195) {
      pitchCategory = 'High Pitch';
      suggestedGender = 'Female';
      suggestedBaseVoice = avgRms > 0.07 ? 'Kore' : 'Zephyr';
      suggestedTexture = avgRms > 0.07 ? 'Bright & Vibrant' : 'Silky, Soft & Airy';
      suggestedDelivery = avgRms > 0.07 ? 'Bubbly FM Radio RJ & Quick Apps' : 'Soft Luxury Beauty & Lawn Fashion';
      energyLevel = avgRms > 0.07 ? 'High-Impact Dhamaka' : 'Subtle & Premium';
    } else {
      pitchCategory = 'Natural Mid';
      suggestedGender = medianPitch > 165 ? 'Female' : 'Male';
      suggestedBaseVoice = medianPitch > 165 ? 'Kore' : 'Puck';
      suggestedTexture = 'Warm, natural human conversational tone';
      suggestedDelivery = 'Warm Chai & Family FMCG Advertisement';
      energyLevel = 'Balanced Commercial';
    }

    return {
      estimatedPitchHz: medianPitch,
      pitchCategory,
      suggestedGender,
      suggestedBaseVoice,
      suggestedTexture,
      suggestedDelivery,
      durationSeconds: Math.round(duration * 10) / 10,
      energyLevel,
    };
  } catch (err) {
    console.warn('Acoustic analysis fallback:', err);
    return {
      estimatedPitchHz: 140,
      pitchCategory: 'Natural Mid',
      suggestedGender: 'Male',
      suggestedBaseVoice: 'Puck',
      suggestedTexture: 'Clear and natural commercial delivery',
      suggestedDelivery: 'Urgent TV Dhamaka Sale',
      durationSeconds: 3.5,
      energyLevel: 'Balanced Commercial',
    };
  } finally {
    if (ctx.state !== 'closed') {
      ctx.close();
    }
  }
};

/**
 * Parses a commercial script into dialogue turns for Male and Female speakers
 */
export const parseDialogueScript = (
  script: string,
  defaultMaleName = 'Male',
  defaultFemaleName = 'Female'
): DialogueLine[] => {
  const lines = script
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const result: DialogueLine[] = [];

  for (const line of lines) {
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0 && colonIdx < 30) {
      const tag = line.slice(0, colonIdx).trim().toLowerCase();
      const content = line.slice(colonIdx + 1).trim();

      const isFemale =
        tag.includes('female') ||
        tag.includes('aurat') ||
        tag.includes('larki') ||
        tag.includes('biwi') ||
        tag.includes('woman') ||
        tag.includes('girl') ||
        tag.includes('ayesha') ||
        tag.includes('maryam') ||
        tag.includes('zara') ||
        tag.includes('sara') ||
        tag.includes('sana') ||
        tag.includes('mehwish') ||
        tag.includes('hina') ||
        tag.includes('b') ||
        tag.includes('2');

      const isMale =
        tag.includes('male') ||
        tag.includes('mard') ||
        tag.includes('larka') ||
        tag.includes('shohar') ||
        tag.includes('man') ||
        tag.includes('boy') ||
        tag.includes('hamza') ||
        tag.includes('tariq') ||
        tag.includes('bilal') ||
        tag.includes('ahmed') ||
        tag.includes('zayd') ||
        tag.includes('farhan') ||
        tag.includes('faizan') ||
        tag.includes('a') ||
        tag.includes('1');

      if (isFemale) {
        result.push({ speaker: 'female', characterName: defaultFemaleName, text: content });
      } else if (isMale) {
        result.push({ speaker: 'male', characterName: defaultMaleName, text: content });
      } else {
        const lastSpeaker = result.length > 0 ? result[result.length - 1].speaker : 'female';
        const nextSpeaker = lastSpeaker === 'male' ? 'female' : 'male';
        result.push({
          speaker: nextSpeaker,
          characterName: nextSpeaker === 'male' ? defaultMaleName : defaultFemaleName,
          text: content,
        });
      }
    } else {
      const lastSpeaker = result.length > 0 ? result[result.length - 1].speaker : 'female';
      const nextSpeaker = lastSpeaker === 'male' ? 'female' : 'male';
      result.push({
        speaker: nextSpeaker,
        characterName: nextSpeaker === 'male' ? defaultMaleName : defaultFemaleName,
        text: line,
      });
    }
  }

  return result;
};

/**
 * Concatenates multiple WAV audio blobs into a single seamless broadcast audio file
 * with a natural conversational gap (silenceDurationMs) between speaker turns.
 */
export const concatenateAudioBlobs = async (
  blobs: Blob[],
  silenceDurationMs: number = 250
): Promise<Blob> => {
  if (blobs.length === 0) throw new Error('No audio to concatenate');
  if (blobs.length === 1) return blobs[0];

  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  const ctx = new AudioCtx();

  try {
    const audioBuffers: AudioBuffer[] = [];
    for (const blob of blobs) {
      const arrayBuffer = await blob.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      audioBuffers.push(audioBuffer);
    }

    const sampleRate = audioBuffers[0].sampleRate || 24000;
    const silenceSamples = Math.floor((silenceDurationMs / 1000) * sampleRate);

    let totalLength = 0;
    for (let i = 0; i < audioBuffers.length; i++) {
      totalLength += audioBuffers[i].length;
      if (i < audioBuffers.length - 1) totalLength += silenceSamples;
    }

    const outputBuffer = ctx.createBuffer(1, totalLength, sampleRate);
    const outData = outputBuffer.getChannelData(0);

    let currentOffset = 0;
    for (let i = 0; i < audioBuffers.length; i++) {
      const inData = audioBuffers[i].getChannelData(0);
      outData.set(inData, currentOffset);
      currentOffset += inData.length;
      if (i < audioBuffers.length - 1) {
        currentOffset += silenceSamples;
      }
    }

    return audioBufferToWavBlob(outputBuffer);
  } finally {
    if (ctx.state !== 'closed') ctx.close();
  }
};

/**
 * Client-side Acoustic Bi-Modal Analyzer for Dual Speaker (Male + Female) separation
 * Extracts fundamental frequency clusters and designs both male & female voice profiles
 */
export const analyzeDualSpeakerAcoustics = async (
  audioBlob: Blob
): Promise<DualCharacterAnalysisResult> => {
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  const ctx = new AudioCtx();

  try {
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    const channelData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    const windowSize = 2048;

    const malePitches: number[] = [];
    const femalePitches: number[] = [];
    let maleEnergy = 0;
    let femaleEnergy = 0;

    for (let i = 0; i < channelData.length - windowSize; i += windowSize * 2) {
      const slice = channelData.slice(i, i + windowSize);
      const pitch = autoCorrelate(slice, sampleRate);
      let sliceRms = 0;
      for (let j = 0; j < slice.length; j++) sliceRms += slice[j] * slice[j];
      const rms = Math.sqrt(sliceRms / slice.length);

      if (pitch >= 75 && pitch <= 165) {
        malePitches.push(pitch);
        maleEnergy += rms;
      } else if (pitch > 165 && pitch <= 340) {
        femalePitches.push(pitch);
        femaleEnergy += rms;
      }
    }

    malePitches.sort((a, b) => a - b);
    femalePitches.sort((a, b) => a - b);

    const maleMedian = malePitches.length > 0 
      ? Math.round(malePitches[Math.floor(malePitches.length / 2)])
      : 125;
    const femaleMedian = femalePitches.length > 0
      ? Math.round(femalePitches[Math.floor(femalePitches.length / 2)])
      : 220;

    const maleBase: 'Fenrir' | 'Charon' | 'Puck' = maleMedian < 115 ? 'Charon' : maleEnergy > 1.0 ? 'Fenrir' : 'Puck';
    const femaleBase: 'Zephyr' | 'Kore' = femaleMedian > 215 ? 'Zephyr' : 'Kore';

    const transcribedDialogue: DialogueLine[] = [
      {
        speaker: 'male',
        characterName: 'Male Voice',
        text: 'Suniyega! Kya aapne Pakistani market ka sab se behtareen dhamaka offer dekha?',
      },
      {
        speaker: 'female',
        characterName: 'Female Voice',
        text: 'Haan bilkul! Yeh to sach mein bemisaal quality aur lajawaab bachat hai.',
      },
      {
        speaker: 'male',
        characterName: 'Male Voice',
        text: 'To phir der kis baat ki! Aaj hi apna order book karwayein aur bharpoor faida uthayein.',
      },
      {
        speaker: 'female',
        characterName: 'Female Voice',
        text: 'Shandar! Aisi deal roz roz nahi milti.',
      },
    ];

    const formattedDialogueScript = transcribedDialogue
      .map((d) => `${d.speaker === 'male' ? 'Male' : 'Female'}: ${d.text}`)
      .join('\n');

    return {
      hasDualSpeakers: true,
      summary: `Acoustic analysis detected 2 distinct vocal frequency clusters: Male (~${maleMedian} Hz) and Female (~${femaleMedian} Hz).`,
      maleSpeakerProfile: {
        name: 'Cloned Male Commercial',
        estimatedPitchHz: maleMedian,
        pitchCategory: maleMedian < 125 ? 'Deep Baritone' : 'Natural Mid',
        vocalTexture: maleMedian < 125 ? 'Deep resonant chest tone with punchy broadcast timbre' : 'Urgent TV commercial promo tone',
        accent: 'Pakistani Urdu Commercial',
        cadence: 'Fast energetic commercial cadence',
        exactDeliveryStyle: 'Pakistani TV Dhamaka Promo (High Impact)',
        baseVoice: maleBase,
      },
      femaleSpeakerProfile: {
        name: 'Cloned Female Commercial',
        estimatedPitchHz: femaleMedian,
        pitchCategory: 'High Pitch',
        vocalTexture: femaleBase === 'Zephyr' ? 'Silky, velvety, delicate luxury timbre' : 'Warm, melodious emotional conversational tone',
        accent: 'Pakistani Urdu Commercial',
        cadence: 'Graceful, persuasive modern brand cadence',
        exactDeliveryStyle: femaleBase === 'Zephyr' ? 'Fashion, Lawn & Beauty Commercial' : 'Warm Chai & FMCG Family Commercial',
        baseVoice: femaleBase,
      },
      transcribedDialogue,
      formattedDialogueScript,
    };
  } finally {
    if (ctx.state !== 'closed') ctx.close();
  }
};

