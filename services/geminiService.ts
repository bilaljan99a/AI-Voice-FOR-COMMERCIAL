import { GoogleGenAI } from "@google/genai";
import { VoiceName, SpeechStyle, Language, CustomClonedVoice, CommercialEnergy } from "../types";
import { VOICE_CATALOG } from "../data/voiceCatalog";

const API_KEY = process.env.API_KEY || process.env.GEMINI_API_KEY || '';

// Base API voices supported by Gemini TTS
type BaseApiVoice = 'Puck' | 'Charon' | 'Fenrir' | 'Kore' | 'Zephyr' | 'Aoede';

interface VoicePersonaConfig {
  apiVoice: BaseApiVoice;
  personaPrompt: string;
}

const VOICE_PERSONA_MAP: Record<VoiceName, VoicePersonaConfig> = {
  // Prebuilt Voices
  [VoiceName.Puck]: {
    apiVoice: 'Puck',
    personaPrompt: 'Clear, crisp, modern male voice with natural clarity.'
  },
  [VoiceName.Charon]: {
    apiVoice: 'Charon',
    personaPrompt: 'Deep, resonant, authoritative baritone male voice.'
  },
  [VoiceName.Fenrir]: {
    apiVoice: 'Fenrir',
    personaPrompt: 'Intense, strong, high-impact and energetic male voice.'
  },
  [VoiceName.Kore]: {
    apiVoice: 'Kore',
    personaPrompt: 'Calm, soothing, warm, melodic female voice.'
  },
  [VoiceName.Zephyr]: {
    apiVoice: 'Zephyr',
    personaPrompt: 'Soft, gentle, airy and intimate female voice.'
  },
  [VoiceName.Aoede]: {
    apiVoice: 'Aoede',
    personaPrompt: 'Expressive, vibrant, melodic and engaging female voice.'
  },

  // Pakistani Commercial Male Voices
  [VoiceName.Hamza_Pak_Male]: {
    apiVoice: 'Fenrir',
    personaPrompt: 'High-octane Pakistani TV commercial promo voice. Energetic, punchy, dramatic pauses, emphasizing discounts, bachat, and excitement like a premier Pakistani TV & radio commercial artist.'
  },
  [VoiceName.Bilal_Pak_Male]: {
    apiVoice: 'Puck',
    personaPrompt: 'Upbeat Karachi/Lahore youth FM Radio Jockey and tech startup commercial voice. Friendly, smiling, trendy cadence with quick modern pacing.'
  },
  [VoiceName.Tariq_Pak_Male]: {
    apiVoice: 'Charon',
    personaPrompt: 'Master Pakistani documentary narrator and mega real-estate commercial voice. Deep, commanding, luxurious baritone conveying immense trust and prestige.'
  },
  [VoiceName.Zayd_Pak_Male]: {
    apiVoice: 'Puck',
    personaPrompt: 'Modern Pakistani bilingual corporate commercial voice. Polished, contemporary code-switching between Urdu and English with corporate confidence.'
  },
  [VoiceName.Farhan_Pak_Male]: {
    apiVoice: 'Charon',
    personaPrompt: 'Soulful, emotionally rich and poetic Pakistani brand voice. Warm, nostalgic, respectful tone ideal for Ramadan, Eid, and heritage brand storytelling.'
  },
  [VoiceName.Faizan_Pak_Male]: {
    apiVoice: 'Fenrir',
    personaPrompt: 'Booming action trailer and mega brand launch voice. Deep chest resonance, high cinematic tension and dramatic delivery.'
  },

  // Pakistani Commercial Female Voices
  [VoiceName.Ayesha_Pak_Female]: {
    apiVoice: 'Kore',
    personaPrompt: 'Velvety, soft, aspirational Pakistani beauty and designer lawn commercial voice. Elegant, melodious, whispery glamour with exquisite Urdu enunciation.'
  },
  [VoiceName.Zara_Pak_Female]: {
    apiVoice: 'Zephyr',
    personaPrompt: 'Modern urban Pakistani commercial voice. Bright, confident, persuasive and fresh, tailored for e-commerce, food delivery and retail campaigns.'
  },
  [VoiceName.Maryam_Pak_Female]: {
    apiVoice: 'Kore',
    personaPrompt: 'Warm, heartfelt, comforting Pakistani mother and household FMCG brand voice. Affectionate, homely cadence ideal for tea, dairy, and culinary ads.'
  },
  [VoiceName.Sana_Pak_Female]: {
    apiVoice: 'Kore',
    personaPrompt: 'Sharp, articulate, executive Pakistani female news anchor and banking commercial voice. Clear diction, steady cadence and authoritative poise.'
  },
  [VoiceName.Mehwish_Pak_Female]: {
    apiVoice: 'Zephyr',
    personaPrompt: 'Playful, bubbly, rhythmic Pakistani FM Radio Jockey and FMCG snack ad voice. Infectious enthusiasm, witty cadence, and engaging energy.'
  },
  [VoiceName.Hina_Pak_Female]: {
    apiVoice: 'Zephyr',
    personaPrompt: 'Poetic, graceful Urdu nazakat bridal and haute-couture commercial voice. Delicate, lyrical, traditional elegance.'
  },

  // Cloned
  [VoiceName.Custom_Cloned]: {
    apiVoice: 'Charon',
    personaPrompt: 'Acoustic voice clone reproduction.'
  }
};

/**
 * Builds an optimal prompt for Gemini TTS tailored for Pakistani Commercial voiceovers.
 */
export const buildSpeechPrompt = (
  text: string,
  voice: VoiceName,
  style: SpeechStyle,
  language: Language,
  speed: number,
  energyLevel: CommercialEnergy = 'Balanced Commercial',
  customClonedVoice?: CustomClonedVoice | null
): { prompt: string; targetVoice: string } => {
  let persona = VOICE_PERSONA_MAP[voice] || VOICE_PERSONA_MAP[VoiceName.Charon];
  let apiVoice = persona.apiVoice;

  // Custom cloned voice overrides
  if (voice === VoiceName.Custom_Cloned && customClonedVoice) {
    apiVoice = customClonedVoice.baseVoice;
    persona = {
      apiVoice: customClonedVoice.baseVoice,
      personaPrompt: `Voice Clone Profile: ${customClonedVoice.name} (${customClonedVoice.gender}, Pitch: ${customClonedVoice.pitchCategory || 'Natural'}, Accent: ${customClonedVoice.accent}, Cadence: ${customClonedVoice.cadence}, Tone: ${customClonedVoice.timbreDescription || 'Custom voice clone'}). Reproduce this vocal persona with high fidelity.`
    };
  }

  // Energy modulation
  let energyDirective = 'balanced commercial delivery';
  if (energyLevel === 'High-Impact Dhamaka') {
    energyDirective = 'maximum urgency, powerful projection, explosive high-energy commercial promo tone with dramatic punch';
  } else if (energyLevel === 'Subtle & Premium') {
    energyDirective = 'understated luxury, velvety smooth, refined and relaxed premium tone';
  }

  // Speed directive
  let speedDirective = '';
  if (speed > 1.1) speedDirective = 'Speak with fast, punchy radio ad pacing.';
  else if (speed < 0.9) speedDirective = 'Speak with slow, deliberate, majestic pauses.';

  const prompt = [
    `You are a top-tier voiceover artist recording a high-production commercial advertisement.`,
    `Voice Profile: ${persona.personaPrompt}`,
    `Style & Emotion: ${style}. Delivery should feature ${energyDirective}. ${speedDirective}`,
    `Target Language & Accent: ${language}. Ensure authentic pronunciation, natural emotional cadence, and proper regional cadence.`,
    `Read the following commercial script verbatim without any introductory remarks:`,
    `"${text}"`
  ].join(' ');

  return { prompt, targetVoice: apiVoice };
};

/**
 * Generates speech using Gemini TTS API.
 */
export const generateSpeech = async (
  text: string,
  voice: VoiceName,
  style: SpeechStyle,
  language: Language,
  speed: number,
  energyLevel: CommercialEnergy = 'Balanced Commercial',
  customClonedVoice?: CustomClonedVoice | null
): Promise<string> => {
  if (!API_KEY) {
    throw new Error("Gemini API Key is missing. Please set GEMINI_API_KEY in your environment.");
  }

  const ai = new GoogleGenAI({ apiKey: API_KEY });
  const { prompt, targetVoice } = buildSpeechPrompt(
    text,
    voice,
    style,
    language,
    speed,
    energyLevel,
    customClonedVoice
  );

  // Try TTS models in order of support: 'gemini-2.5-flash-preview-tts', 'gemini-3.8-flash-lite-tts'
  const ttsModels = ["gemini-2.5-flash-preview-tts", "gemini-3.8-flash-lite-tts", "gemini-3.8-flash-tts"];
  let lastError: any = null;

  for (const model of ttsModels) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: targetVoice },
            },
          },
        },
      });

      const candidate = response.candidates?.[0];

      // Extract audio inline data
      let audioData: string | undefined;
      if (candidate?.content?.parts) {
        for (const part of candidate.content.parts) {
          if (part.inlineData && part.inlineData.data) {
            audioData = part.inlineData.data;
            break;
          }
        }
      }

      if (audioData) {
        return audioData;
      }

      if (candidate?.finishReason === 'MAX_TOKENS') {
        throw new Error("The text is too long for a single generation. Please shorten your script.");
      }
      if (candidate?.finishReason === 'SAFETY') {
        throw new Error("The script was flagged by safety filters. Please adjust the text.");
      }
    } catch (err: any) {
      console.warn(`Attempt with ${model} failed:`, err);
      lastError = err;
      // If permission denied or missing key, don't keep looping
      if (err.message?.includes('403') || err.status === 403) {
        throw new Error("Permission denied for TTS model. Verify API key privileges.");
      }
    }
  }

  throw new Error(lastError?.message || "Failed to generate speech with Gemini TTS. Please try again.");
};