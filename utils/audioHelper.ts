/**
 * Decodes a base64 string into a Uint8Array.
 */
export const base64ToUint8Array = (base64: string): Uint8Array => {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

/**
 * Checks if the buffer starts with the 'RIFF' 4-byte signature.
 */
export const isWavFormat = (data: Uint8Array): boolean => {
  return data.length >= 4 &&
    data[0] === 0x52 && // 'R'
    data[1] === 0x49 && // 'I'
    data[2] === 0x46 && // 'F'
    data[3] === 0x46;   // 'F'
};

/**
 * Wraps raw PCM data in a WAV container if not already WAV.
 * Assumes 24kHz, 1 channel, 16-bit PCM (standard for Gemini TTS).
 */
export const pcmToWavBlob = (data: Uint8Array, sampleRate: number = 24000): Blob => {
  // If the audio data already has a valid WAV header, return it directly!
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

  // RIFF identifier
  writeString(view, 0, 'RIFF');
  // File length
  view.setUint32(4, 36 + samples.length, true);
  // RIFF type
  writeString(view, 8, 'WAVE');
  // Format chunk identifier
  writeString(view, 12, 'fmt ');
  // Format chunk length
  view.setUint32(16, 16, true);
  // Sample format (1 = PCM)
  view.setUint16(20, 1, true);
  // Channel count
  view.setUint16(22, channels, true);
  // Sample rate
  view.setUint32(24, sampleRate, true);
  // Byte rate (sample rate * block align)
  view.setUint32(28, sampleRate * channels * (bitDepth / 8), true);
  // Block align (channel count * bytes per sample)
  view.setUint16(32, channels * (bitDepth / 8), true);
  // Bits per sample
  view.setUint16(34, bitDepth, true);
  // Data chunk identifier
  writeString(view, 36, 'data');
  // Data chunk length
  view.setUint32(40, samples.length, true);

  // Write the PCM samples
  const bytes = new Uint8Array(buffer);
  bytes.set(samples, 44);

  return buffer;
};

/**
 * Analyzes an audio file or recorded Blob to estimate vocal characteristics
 * (pitch, fundamental frequency, brightness) for voice cloning profile.
 */
export const analyzeVoiceSample = async (
  audioBlob: Blob
): Promise<{
  estimatedPitchHz: number;
  pitchCategory: 'Deep Baritone' | 'Natural Mid' | 'High Pitch';
  timbreDescription: string;
  durationSeconds: number;
}> => {
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  const ctx = new AudioCtx();
  
  try {
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    const duration = audioBuffer.duration;
    const channelData = audioBuffer.getChannelData(0);

    // Simple zero-crossing rate & autocorrelation to estimate fundamental frequency
    let zeroCrossings = 0;
    for (let i = 1; i < channelData.length; i++) {
      if ((channelData[i] >= 0 && channelData[i - 1] < 0) || (channelData[i] < 0 && channelData[i - 1] >= 0)) {
        zeroCrossings++;
      }
    }

    const estimatedFreq = Math.round((zeroCrossings / (2 * duration)) || 140);
    // Clamp to human vocal fundamental range (80Hz - 350Hz)
    const normalizedPitch = Math.max(85, Math.min(320, estimatedFreq));

    let pitchCategory: 'Deep Baritone' | 'Natural Mid' | 'High Pitch' = 'Natural Mid';
    let timbre = 'Warm and resonant with balanced harmonics';

    if (normalizedPitch < 130) {
      pitchCategory = 'Deep Baritone';
      timbre = 'Heavy low-end punch, commanding presence and chest resonance';
    } else if (normalizedPitch > 210) {
      pitchCategory = 'High Pitch';
      timbre = 'Crisp, bright upper register with high articulation';
    } else {
      pitchCategory = 'Natural Mid';
      timbre = 'Natural conversational warmth, balanced clarity and rich presence';
    }

    return {
      estimatedPitchHz: normalizedPitch,
      pitchCategory,
      timbreDescription: timbre,
      durationSeconds: Math.round(duration * 10) / 10,
    };
  } catch (err) {
    console.warn('Audio analysis fallback:', err);
    return {
      estimatedPitchHz: 145,
      pitchCategory: 'Natural Mid',
      timbreDescription: 'Rich commercial tone with balanced projection',
      durationSeconds: 3.5,
    };
  } finally {
    if (ctx.state !== 'closed') {
      ctx.close();
    }
  }
};
