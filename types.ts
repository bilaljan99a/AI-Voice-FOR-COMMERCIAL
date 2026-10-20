export enum VoiceName {
  // Prebuilt Base Voices
  Puck = 'Puck', // Male standard/lively
  Charon = 'Charon', // Male deep/resonant
  Fenrir = 'Fenrir', // Male intense/powerful
  Kore = 'Kore', // Female warm/calm
  Zephyr = 'Zephyr', // Female soft/gentle
  Aoede = 'Aoede', // Female expressive

  // Pakistani Commercial Male Voice Personas
  Hamza_Pak_Male = 'Hamza_Pak_Male', // Pakistani TV Dhamaka & Bumper Sale
  Bilal_Pak_Male = 'Bilal_Pak_Male', // FM Radio Jockey & Youth Brand
  Tariq_Pak_Male = 'Tariq_Pak_Male', // Real Estate Baritone & Master Narrator
  Zayd_Pak_Male = 'Zayd_Pak_Male', // Modern Corporate & Bilingual Tech
  Farhan_Pak_Male = 'Farhan_Pak_Male', // Soulful Ramadan & Poetic Heritage
  Faizan_Pak_Male = 'Faizan_Pak_Male', // Mega Launch & Dramatic Trailer

  // Pakistani Commercial Female Voice Personas
  Ayesha_Pak_Female = 'Ayesha_Pak_Female', // Beauty, Cosmetics & Lawn Fashion
  Zara_Pak_Female = 'Zara_Pak_Female', // Trendy Urban & Quick Commerce App
  Maryam_Pak_Female = 'Maryam_Pak_Female', // Warm Household, Milk & Chai Commercial
  Sana_Pak_Female = 'Sana_Pak_Female', // Corporate, Banking & News Commercial
  Mehwish_Pak_Female = 'Mehwish_Pak_Female', // FM Radio RJ & Quirky Fun Ad
  Hina_Pak_Female = 'Hina_Pak_Female', // Delicate Nazakat & Festive Bridal

  // Custom Cloned Voice Indicator
  Custom_Cloned = 'Custom_Cloned',
}

export type VoiceGender = 'Male' | 'Female' | 'Cloned' | 'Dual_Dialogue';
export type VoiceCategory = 'pakistani_ad' | 'standard' | 'cloned';

export interface VoiceOption {
  id: VoiceName;
  name: string;
  gender: VoiceGender;
  category: VoiceCategory;
  accent: string;
  tagline: string;
  description: string;
  recommendedStyles?: SpeechStyle[];
  previewSampleText?: string;
  baseModelVoice: 'Puck' | 'Charon' | 'Fenrir' | 'Kore' | 'Zephyr' | 'Aoede';
}

export enum SpeechStyle {
  // Pakistani Commercial Ad Styles
  Pakistani_Dhamaka = 'Pakistani TV Dhamaka (Mega Sale / Promo)',
  Pakistani_Chai_Warm = 'Warm Chai & FMCG (Emotional Apnepan)',
  Pakistani_Lawn_Beauty = 'Fashion & Lawn (Glamour & Nazakat)',
  Pakistani_RealEstate = 'Mega Housing & Real Estate Launch',
  Pakistani_Food_Delivery = 'Food Delivery & Youth Quick Promo',
  Pakistani_Ramadan_Eid = 'Ramadan & Eid Festive Blessings',
  Pakistani_Radio_RJ = 'FM Radio Commercial RJ Flair',
  Pakistani_Bilingual_Tech = 'Bilingual Tech / Telecom Promo',

  // Classic Styles
  News = 'News Anchor & Documentary',
  Storytelling = 'Urdu Dastangoi / Storyteller',
  Motivation = 'High-Impact Motivational',
  Whisper = 'Soft Whisper / ASMR',
  Neutral = 'Neutral Professional',
}

export enum Language {
  Urdu = 'Urdu (اردو)',
  RomanUrdu = 'Roman Urdu (Pakistani Ad Script)',
  Hindi = 'Hindi (हिन्दी)',
  English = 'Pakistani English (Commercial Accent)',
  GlobalEnglish = 'English (Global Standard)',
  Arabic = 'Arabic (العربية)',
}

export type CommercialEnergy = 'Subtle & Premium' | 'Balanced Commercial' | 'High-Impact Dhamaka';

export interface CustomClonedVoice {
  id: string;
  name: string;
  gender: 'Male' | 'Female';
  recordedSampleBlobUrl?: string;
  audioDurationSeconds?: number;
  sampleFileName?: string;
  estimatedPitchHz?: number;
  pitchCategory?: 'Deep Baritone' | 'Natural Mid' | 'High Pitch';
  vocalTexture?: string;
  timbreDescription?: string;
  accent: string;
  cadence: string;
  exactDeliveryStyle: string;
  baseVoice: 'Puck' | 'Charon' | 'Fenrir' | 'Kore' | 'Zephyr';
  createdAt: number;
}

export interface DialogueLine {
  speaker: 'male' | 'female';
  characterName: string;
  text: string;
}

export interface DualCharacterAnalysisResult {
  hasDualSpeakers: boolean;
  summary?: string;
  maleSpeakerProfile: {
    name: string;
    estimatedPitchHz: number;
    pitchCategory: 'Deep Baritone' | 'Natural Mid' | 'High Pitch';
    vocalTexture: string;
    accent: string;
    cadence: string;
    exactDeliveryStyle: string;
    baseVoice: 'Puck' | 'Charon' | 'Fenrir';
  };
  femaleSpeakerProfile: {
    name: string;
    estimatedPitchHz: number;
    pitchCategory: 'Deep Baritone' | 'Natural Mid' | 'High Pitch';
    vocalTexture: string;
    accent: string;
    cadence: string;
    exactDeliveryStyle: string;
    baseVoice: 'Kore' | 'Zephyr';
  };
  transcribedDialogue: DialogueLine[];
  formattedDialogueScript: string;
}

export interface AdTemplate {
  id: string;
  title: string;
  category: string;
  brandType: string;
  language: Language;
  suggestedVoice: VoiceName;
  suggestedFemaleVoice?: VoiceName;
  isDialogue?: boolean;
  suggestedStyle: SpeechStyle;
  suggestedSpeed: number;
  script: string;
}

export interface GeneratedAudio {
  id: string;
  textSnippet: string;
  fullText: string;
  url: string;
  timestamp: number;
  voice: VoiceName;
  voiceDisplayName: string;
  voiceGender: VoiceGender;
  style: SpeechStyle;
  language: Language;
  speed: number;
  energyLevel: CommercialEnergy;
  isClonedVoice?: boolean;
  clonedVoiceName?: string;
  isDialogue?: boolean;
  maleVoiceName?: string;
  femaleVoiceName?: string;
  bgmTrack?: string;
}
