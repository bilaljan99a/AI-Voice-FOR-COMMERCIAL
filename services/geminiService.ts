import { GoogleGenAI } from "@google/genai";
import { VoiceName, SpeechStyle, Language, CustomClonedVoice, CommercialEnergy, DialogueLine, DualCharacterAnalysisResult } from "../types";
import { VOICE_PROFILES } from "../utils/audioDsp";
import { base64ToUint8Array, pcmToWavBlob, concatenateAudioBlobs, blobToBase64, analyzeDualSpeakerAcoustics } from "../utils/audioHelper";

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

// Natural human style directives for Gemini TTS Voice Design
const CATALOG_VOICE_STYLES: Record<VoiceName, { speaker: string; style: string }> = {
  [VoiceName.Hamza_Pak_Male]: {
    speaker: 'Hamza Commercial',
    style: 'High-octane Pakistani TV commercial promo voice, urgent sales punch, energetic breathing, crisp Urdu diction, dramatic pauses emphasizing discounts and mega offers'
  },
  [VoiceName.Ayesha_Pak_Female]: {
    speaker: 'Ayesha Beauty',
    style: 'Soft, silky, velvety Pakistani luxury lawn and beauty commercial voiceover artist, breathy, elegant, melodious and aspirational'
  },
  [VoiceName.Maryam_Pak_Female]: {
    speaker: 'Maryam Chai FMCG',
    style: 'Warm, deeply emotional, comforting Pakistani mother and tea advertisement voice, affectionate, homely, nostalgic and sincere'
  },
  [VoiceName.Tariq_Pak_Male]: {
    speaker: 'Tariq Baritone',
    style: 'Deep, commanding, luxurious real estate baritone voiceover, authoritative, trustworthy, majestic and cinematic'
  },
  [VoiceName.Bilal_Pak_Male]: {
    speaker: 'Bilal RJ Youth',
    style: 'Upbeat Karachi/Lahore youth Radio Jockey and quick commerce app voice, friendly, smiling, lively modern pacing'
  },
  [VoiceName.Zara_Pak_Female]: {
    speaker: 'Zara Modern App',
    style: 'Modern, dynamic, fast-paced urban retail commercial voice, bright, confident, energetic and persuasive'
  },
  [VoiceName.Sana_Pak_Female]: {
    speaker: 'Sana News Corporate',
    style: 'Sharp, articulate executive news anchor and corporate banking commercial voice, clear diction and steady cadence'
  },
  [VoiceName.Mehwish_Pak_Female]: {
    speaker: 'Mehwish Fun RJ',
    style: 'Playful, bubbly, rhythmic FM Radio Jockey, high energy, witty cadence and infectious excitement'
  },
  [VoiceName.Hina_Pak_Female]: {
    speaker: 'Hina Poetic Nazakat',
    style: 'Poetic, delicate Urdu nazakat bridal and haute couture commercial voice, lyrical and graceful'
  },
  [VoiceName.Farhan_Pak_Male]: {
    speaker: 'Farhan Ramadan Soulful',
    style: 'Soulful, emotionally rich and poetic Pakistani brand voice, warm, respectful tone for Ramadan and Eid'
  },
  [VoiceName.Faizan_Pak_Male]: {
    speaker: 'Faizan Action Trailer',
    style: 'Booming cinematic action trailer voice, deep chest resonance, dramatic tension'
  },
  [VoiceName.Zayd_Pak_Male]: {
    speaker: 'Zayd Bilingual Tech',
    style: 'Polished, contemporary corporate bilingual code-switching commercial delivery between Urdu and English'
  },
  [VoiceName.Puck]: { speaker: 'Puck', style: 'Clear, crisp, natural conversational male delivery' },
  [VoiceName.Charon]: { speaker: 'Charon', style: 'Deep, resonant, authoritative baritone male delivery' },
  [VoiceName.Fenrir]: { speaker: 'Fenrir', style: 'Intense, powerful, dynamic command male delivery' },
  [VoiceName.Kore]: { speaker: 'Kore', style: 'Calm, soothing, warm, melodic female delivery' },
  [VoiceName.Zephyr]: { speaker: 'Zephyr', style: 'Soft, gentle, airy and intimate female delivery' },
  [VoiceName.Aoede]: { speaker: 'Aoede', style: 'Bright, expressive, engaging female delivery' },
  [VoiceName.Custom_Cloned]: { speaker: 'Cloned Voice', style: 'Exact voice clone' },
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

  // 1. Select matched base model voice
  let targetApiVoice: 'Kore' | 'Zephyr' | 'Charon' | 'Fenrir' | 'Puck' = 'Kore';
  let speakerName = 'Voice Artist';
  let voiceStyleDirective = 'Clear commercial delivery';

  if (voice === VoiceName.Custom_Cloned && customClonedVoice) {
    targetApiVoice = customClonedVoice.baseVoice;
    speakerName = customClonedVoice.name;
    
    voiceStyleDirective = [
      `Exact Voice Clone: ${customClonedVoice.name}.`,
      `Gender: ${customClonedVoice.gender}.`,
      `Vocal Profile: ${customClonedVoice.pitchCategory || 'Natural'} (${customClonedVoice.estimatedPitchHz || 140} Hz), ${customClonedVoice.vocalTexture || 'Warm resonance'}.`,
      `Delivery & Style: ${customClonedVoice.exactDeliveryStyle || customClonedVoice.cadence || 'Commercial Voiceover'}.`,
      `Accent & Cadence: ${customClonedVoice.accent || 'Pakistani Urdu'}.`,
      `Emotional Energy: ${energyLevel}.`,
      `Replicate the exact human vocal timbre, natural breathing pauses, authentic regional intonation, and delivery style of the reference audio sample without any robotic or synthetic artifacts.`
    ].join(' ');
  } else {
    const profile = VOICE_PROFILES[voice];
    if (profile) {
      targetApiVoice = profile.baseVoice;
    }
    const catalogInfo = CATALOG_VOICE_STYLES[voice] || CATALOG_VOICE_STYLES[VoiceName.Hamza_Pak_Male];
    speakerName = catalogInfo.speaker;
    voiceStyleDirective = `${catalogInfo.style}. Commercial Style: ${style}. Energy Level: ${energyLevel}. Speak in natural ${language} with authentic emotional delivery and human breathing.`;
  }

  let formattedText = text.trim();
  if (!formattedText.startsWith('<breath>') && formattedText.length > 20) {
    formattedText = `<breath> ${formattedText}`;
  }

  const ttsModels = ["gemini-3.8-flash-tts", "gemini-3.8-flash-lite-tts", "gemini-2.5-flash-preview-tts"];
  let lastError: any = null;

  for (const model of ttsModels) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [
          {
            parts: [
              {
                text: formattedText,
                speechMetadata: {
                  speaker: speakerName,
                  style: voiceStyleDirective,
                },
              } as any,
            ],
          } as any,
        ],
        config: {
          responseModalities: ["AUDIO"],
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
      console.warn(`TTS Model ${model} error:`, err.message || err);
      lastError = err;

      if (err.message?.includes('429') || err.status === 429 || err.status === 'RESOURCE_EXHAUSTED') {
        throw new Error("Gemini TTS free-tier rate limit reached (3 requests per minute). Please wait 20-30 seconds and try again.");
      }

      if (err.message?.includes('403') || err.status === 403) {
        throw new Error("Permission denied. Ensure your Gemini API Key is valid.");
      }
    }
  }

  throw new Error(lastError?.message || "Failed to generate speech with Gemini TTS. Please try again.");
};

/**
 * Generates Dual-Character Commercial Dialogue (Male lines in Male voice, Female lines in Female voice)
 * and stitches them together seamlessly into a single continuous broadcast audio file.
 */
export const generateDialogueSpeech = async (
  lines: DialogueLine[],
  maleVoice: VoiceName,
  femaleVoice: VoiceName,
  style: SpeechStyle,
  language: Language,
  speed: number = 1.0,
  energyLevel: CommercialEnergy = 'Balanced Commercial',
  maleClonedVoice?: CustomClonedVoice | null,
  femaleClonedVoice?: CustomClonedVoice | null,
  onProgress?: (current: number, total: number) => void
): Promise<Blob> => {
  const lineBlobs: Blob[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (onProgress) onProgress(i + 1, lines.length);

    const isMale = line.speaker === 'male';
    const targetVoice = isMale ? maleVoice : femaleVoice;
    const targetCloned = isMale ? maleClonedVoice : femaleClonedVoice;

    // Generate audio for this specific character
    const base64 = await generateSpeech(
      line.text,
      targetVoice,
      style,
      language,
      speed,
      energyLevel,
      targetCloned
    );

    const pcmData = base64ToUint8Array(base64);
    const wavBlob = pcmToWavBlob(pcmData);
    lineBlobs.push(wavBlob);
  }

  // Concatenate with 250ms natural conversational pause
  const finalWavBlob = await concatenateAudioBlobs(lineBlobs, 250);
  return finalWavBlob;
};

/**
 * Multimodal AI Audio Diarization & Biometric Analysis
 * Listens to audio containing a conversation between Male and Female,
 * extracts separated dialogue script, and extracts acoustic profiles for both characters.
 */
export const analyzeDualSpeakerAudio = async (
  audioBlob: Blob
): Promise<DualCharacterAnalysisResult> => {
  const apiKey = getActiveApiKey();

  // If no Gemini API key, use client-side acoustic bi-modal analyzer
  if (!apiKey) {
    return analyzeDualSpeakerAcoustics(audioBlob);
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const base64Audio = await blobToBase64(audioBlob);
    const mimeType = audioBlob.type && audioBlob.type.startsWith('audio/') ? audioBlob.type : 'audio/wav';

    const prompt = `You are an expert audio diarization engineer and commercial voiceover casting director specializing in Urdu, Hindi and Pakistani commercial advertising.
Analyze this audio recording which contains a dialogue / conversation with two speakers (Male and Female).

Your task:
1. Speaker Diarization: Listen and separate the spoken words turn-by-turn into dialogue lines. Assign speaker to either "male" or "female". Keep the exact spoken Urdu/Hindi/English words.
2. Acoustic & Vocal Analysis of MALE speaker:
   - estimatedPitchHz (e.g. 95-150 Hz)
   - pitchCategory: "Deep Baritone" | "Natural Mid"
   - vocalTexture: specific human timbre description (e.g. "Warm chest resonance", "Punchy urgent commercial rasp")
   - accent: (e.g. "Pakistani Urdu Commercial", "Roman Urdu", "Hindi")
   - cadence: delivery speed and rhythm
   - exactDeliveryStyle: (e.g. "Pakistani TV Dhamaka Promo", "Youth Radio Jockey")
   - baseVoice: "Charon" (deep baritone) | "Fenrir" (intense commanding) | "Puck" (energetic friendly)
3. Acoustic & Vocal Analysis of FEMALE speaker:
   - estimatedPitchHz (e.g. 190-250 Hz)
   - pitchCategory: "High Pitch" | "Natural Mid"
   - vocalTexture: specific human timbre description (e.g. "Silky velvety elegance", "Warm comforting tea commercial tone")
   - accent: (e.g. "Pakistani Urdu Commercial", "Roman Urdu", "Hindi")
   - cadence: delivery speed and rhythm
   - exactDeliveryStyle: (e.g. "Fashion & Lawn Glamour", "Warm Chai & FMCG Family", "FM Radio RJ")
   - baseVoice: "Zephyr" (soft silky luxurious) | "Kore" (warm melodic family)

Output strictly valid JSON with no markdown wrapping:
{
  "hasDualSpeakers": true,
  "summary": "Brief summary of the conversation and tone",
  "transcribedDialogue": [
    {"speaker": "male", "characterName": "Male", "text": "..."},
    {"speaker": "female", "characterName": "Female", "text": "..."}
  ],
  "maleSpeakerProfile": {
    "name": "Cloned Male Character",
    "estimatedPitchHz": 125,
    "pitchCategory": "Deep Baritone",
    "vocalTexture": "Commanding chest resonance with TV commercial urgency",
    "accent": "Pakistani Urdu",
    "cadence": "Fast-paced TV promo cadence",
    "exactDeliveryStyle": "Pakistani TV Dhamaka Promo",
    "baseVoice": "Fenrir"
  },
  "femaleSpeakerProfile": {
    "name": "Cloned Female Character",
    "estimatedPitchHz": 220,
    "pitchCategory": "High Pitch",
    "vocalTexture": "Silky velvety elegance and warmth",
    "accent": "Pakistani Urdu",
    "cadence": "Melodic luxury brand cadence",
    "exactDeliveryStyle": "Fashion & Lawn Glamour",
    "baseVoice": "Zephyr"
  }
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType,
                data: base64Audio,
              },
            },
            {
              text: prompt,
            },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
      },
    });

    const responseText = response.text?.trim() || '';
    if (responseText) {
      const parsed = JSON.parse(responseText);
      if (parsed && parsed.maleSpeakerProfile && parsed.femaleSpeakerProfile) {
        const dialogueList: DialogueLine[] = Array.isArray(parsed.transcribedDialogue) && parsed.transcribedDialogue.length > 0
          ? parsed.transcribedDialogue
          : [
              { speaker: 'male', characterName: 'Male', text: 'Yeh offer dekh kar to maza aa gaya!' },
              { speaker: 'female', characterName: 'Female', text: 'Bilkul, itni bachat to pehle kabhi nahi dekhi.' }
            ];

        const formattedDialogueScript = dialogueList
          .map((d) => `${d.speaker === 'male' ? 'Male' : 'Female'}: ${d.text}`)
          .join('\n');

        return {
          hasDualSpeakers: true,
          summary: parsed.summary || 'Multimodal AI successfully diarized Male and Female speakers and extracted their dialogue lines.',
          maleSpeakerProfile: {
            name: parsed.maleSpeakerProfile.name || 'Cloned Male Character',
            estimatedPitchHz: parsed.maleSpeakerProfile.estimatedPitchHz || 125,
            pitchCategory: parsed.maleSpeakerProfile.pitchCategory || 'Deep Baritone',
            vocalTexture: parsed.maleSpeakerProfile.vocalTexture || 'Warm chest resonance',
            accent: parsed.maleSpeakerProfile.accent || 'Pakistani Urdu Commercial',
            cadence: parsed.maleSpeakerProfile.cadence || 'Urgent TV commercial cadence',
            exactDeliveryStyle: parsed.maleSpeakerProfile.exactDeliveryStyle || 'Pakistani TV Dhamaka Promo',
            baseVoice: parsed.maleSpeakerProfile.baseVoice || 'Fenrir',
          },
          femaleSpeakerProfile: {
            name: parsed.femaleSpeakerProfile.name || 'Cloned Female Character',
            estimatedPitchHz: parsed.femaleSpeakerProfile.estimatedPitchHz || 220,
            pitchCategory: parsed.femaleSpeakerProfile.pitchCategory || 'High Pitch',
            vocalTexture: parsed.femaleSpeakerProfile.vocalTexture || 'Silky velvety elegance',
            accent: parsed.femaleSpeakerProfile.accent || 'Pakistani Urdu Commercial',
            cadence: parsed.femaleSpeakerProfile.cadence || 'Melodic luxury cadence',
            exactDeliveryStyle: parsed.femaleSpeakerProfile.exactDeliveryStyle || 'Fashion & Lawn Glamour',
            baseVoice: parsed.femaleSpeakerProfile.baseVoice || 'Zephyr',
          },
          transcribedDialogue: dialogueList,
          formattedDialogueScript,
        };
      }
    }

    // If structure was unexpected, fallback to acoustic
    return analyzeDualSpeakerAcoustics(audioBlob);
  } catch (err) {
    console.warn('Gemini multimodal audio diarization fallback to acoustic analysis:', err);
    return analyzeDualSpeakerAcoustics(audioBlob);
  }
};