import { GoogleGenAI } from "@google/genai";
import { VoiceName, SpeechStyle, Language, CustomClonedVoice, CommercialEnergy } from "../types";
import { VOICE_PROFILES } from "../utils/audioDsp";

// Get API key from environment or localStorage for external / GitHub deployments
export const getActiveApiKey = (): string => {
  if (typeof window !== 'undefined') {
    const customKey = localStorage.getItem('voicecraft_gemini_api_key');
    if (customKey && customKey.trim().length > 10) {
      return customKey.trim();
    }
  }
  return process.env.API_KEY || process.env.GEMINI_API_KEY || '';
};

// Natural expressive style directives for Gemini TTS
const STYLE_PROMPTS: Record<SpeechStyle, string> = {
  [SpeechStyle.Pakistani_Dhamaka]: 'energetic commercial promotion with exciting sales punch',
  [SpeechStyle.Pakistani_Chai_Warm]: 'warm, loving, emotional family commercial style',
  [SpeechStyle.Pakistani_Lawn_Beauty]: 'soft, velvety, elegant luxury commercial style',
  [SpeechStyle.Pakistani_RealEstate]: 'deep, majestic, trustworthy luxury property presentation',
  [SpeechStyle.Pakistani_Food_Delivery]: 'upbeat, youthful, fast-paced food delivery commercial',
  [SpeechStyle.Pakistani_Ramadan_Eid]: 'serene, heartfelt, blessed festive greetings style',
  [SpeechStyle.Pakistani_Radio_RJ]: 'bubbly, upbeat, smiling FM radio jockey delivery',
  [SpeechStyle.Pakistani_Bilingual_Tech]: 'modern, confident corporate tech commercial style',
  [SpeechStyle.News]: 'clear, authoritative news anchor style',
  [SpeechStyle.Storytelling]: 'expressive Urdu storytelling style',
  [SpeechStyle.Motivation]: 'inspiring, confident motivational speaker style',
  [SpeechStyle.Whisper]: 'soft, intimate whisper style',
  [SpeechStyle.Neutral]: 'clear, natural professional style',
};

export const generateSpeech = async (
  text: string,
  voice: VoiceName,
  style: SpeechStyle,
  language: Language,
  speed: number = 1.0,
  energyLevel: CommercialEnergy = 'Balanced Commercial',
  customClonedVoice?: CustomClonedVoice | null
): Promise<string> => {
  const apiKey = getActiveApiKey();
  if (!apiKey) {
    throw new Error(
      "Gemini API Key is missing. Click '⚙️ API Key' in the top header to enter your Google Gemini API Key."
    );
  }

  const ai = new GoogleGenAI({ apiKey });

  // 1. Select natural prebuilt human voice
  let targetApiVoice: 'Kore' | 'Zephyr' | 'Charon' | 'Fenrir' | 'Puck' = 'Kore';

  if (voice === VoiceName.Custom_Cloned && customClonedVoice) {
    targetApiVoice = customClonedVoice.baseVoice;
  } else {
    const profile = VOICE_PROFILES[voice];
    if (profile) {
      targetApiVoice = profile.baseVoice;
    }
  }

  // 2. Concise natural prompt directive
  const styleDescription = STYLE_PROMPTS[style] || 'natural commercial style';
  
  let languageName = 'Urdu';
  if (language === Language.Hindi) languageName = 'Hindi';
  else if (language === Language.English || language === Language.GlobalEnglish) languageName = 'English';
  else if (language === Language.RomanUrdu) languageName = 'conversational Pakistani Roman Urdu';

  // Natural human instruction that guides intonation without confusing the model
  const prompt = `Read in ${languageName} with a ${styleDescription}: "${text.trim()}"`;

  // Try supported TTS models
  const ttsModels = ["gemini-2.5-flash-preview-tts", "gemini-3.8-flash-lite-tts"];
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
              prebuiltVoiceConfig: { voiceName: targetApiVoice },
            },
          },
        },
      });

      const candidate = response.candidates?.[0];

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
        throw new Error("The text is too long for a single audio generation. Please shorten your script.");
      }
      if (candidate?.finishReason === 'SAFETY') {
        throw new Error("The content was flagged by safety filters. Please adjust the script.");
      }
    } catch (err: any) {
      console.warn(`Model ${model} error:`, err.message || err);
      lastError = err;

      if (err.message?.includes('429') || err.status === 429 || err.status === 'RESOURCE_EXHAUSTED') {
        throw new Error("Gemini TTS rate limit reached (3 requests per minute). Please wait 20-30 seconds and try again.");
      }

      if (err.message?.includes('403') || err.status === 403) {
        throw new Error("Permission denied. Ensure your Gemini API Key is valid.");
      }
    }
  }

  throw new Error(lastError?.message || "Failed to generate speech with Gemini TTS. Please try again.");
};