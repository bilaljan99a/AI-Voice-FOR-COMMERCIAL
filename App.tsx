import React, { useState, useEffect } from 'react';
import { ControlPanel } from './components/ControlPanel';
import { AudioPlayer } from './components/AudioPlayer';
import { VoiceCloneStudio } from './components/VoiceCloneStudio';
import {
  VoiceName,
  VoiceGender,
  SpeechStyle,
  Language,
  GeneratedAudio,
  CommercialEnergy,
  CustomClonedVoice,
  AdTemplate,
  ScriptDialogueRow,
  DialogueLine,
} from './types';
import {
  generateSpeech,
  generateDialogueSpeech,
  getActiveApiKey,
  autoDetectAndFormatDialogueScript,
  translateDialogueScript,
  translateScriptDialogueRows,
  generateSingleDialogueSegment,
} from './services/geminiService';
import {
  base64ToUint8Array,
  pcmToWavBlob,
  parseDialogueScript,
  parseScriptIntoRows,
  formatRowsIntoScript,
} from './utils/audioHelper';
import { enhanceVoiceAcoustics } from './utils/audioDsp';
import { VOICE_CATALOG } from './data/voiceCatalog';
import { PAKISTANI_AD_TEMPLATES } from './data/adTemplates';
import {
  Sparkles,
  Loader2,
  MessageSquareText,
  History,
  Mic2,
  Radio,
  Sliders,
  FileText,
  Volume2,
  Flame,
  CheckCircle2,
  X,
  Gauge,
  Key,
  Globe,
  ExternalLink,
  HelpCircle,
  Users,
  UserCheck,
  Wand2,
  Languages,
  Lock,
  RefreshCw,
  Plus,
  Trash2,
  Copy,
  ArrowUp,
  ArrowDown,
  Play,
  Check,
  ListFilter,
} from 'lucide-react';

const LOCAL_STORAGE_CLONES_KEY = 'voicecraft_custom_cloned_voices_v1';
const LOCAL_STORAGE_KEY_STORAGE = 'voicecraft_gemini_api_key';

const App: React.FC = () => {
  // Mobile / View Mode: 'studio' | 'voices' | 'clone_lab' | 'templates' | 'history'
  const [activeTab, setActiveTab] = useState<'studio' | 'voices' | 'clone_lab' | 'templates' | 'history'>('studio');

  // Studio Mode: 'single' | 'dual_dialogue'
  const [generationMode, setGenerationMode] = useState<'single' | 'dual_dialogue'>('single');

  // Single Voice controls state
  const [selectedVoice, setSelectedVoice] = useState<VoiceName>(VoiceName.Ayesha_Pak_Female);
  const [selectedStyle, setSelectedStyle] = useState<SpeechStyle>(SpeechStyle.Pakistani_Lawn_Beauty);
  const [selectedLanguage, setSelectedLanguage] = useState<Language>(Language.RomanUrdu);
  const [speechSpeed, setSpeechSpeed] = useState<number>(1.0);
  const [commercialEnergy, setCommercialEnergy] = useState<CommercialEnergy>('Balanced Commercial');

  // Dual Character Dialogue state
  const [dualMaleVoice, setDualMaleVoice] = useState<VoiceName>(VoiceName.Hamza_Pak_Male);
  const [dualFemaleVoice, setDualFemaleVoice] = useState<VoiceName>(VoiceName.Ayesha_Pak_Female);
  const [dialogueProgress, setDialogueProgress] = useState<string | null>(null);

  // API Key & Deployment Modal State
  const [showDeployModal, setShowDeployModal] = useState<boolean>(false);
  const [apiKeyInput, setApiKeyInput] = useState<string>(() => {
    return localStorage.getItem(LOCAL_STORAGE_KEY_STORAGE) || '';
  });
  const [apiKeySavedSuccess, setApiKeySavedSuccess] = useState<boolean>(false);

  // Voice Cloning State
  const [customVoices, setCustomVoices] = useState<CustomClonedVoice[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_CLONES_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [activeCustomVoice, setActiveCustomVoice] = useState<CustomClonedVoice | null>(null);
  const [activeMaleClonedVoice, setActiveMaleClonedVoice] = useState<CustomClonedVoice | null>(null);
  const [activeFemaleClonedVoice, setActiveFemaleClonedVoice] = useState<CustomClonedVoice | null>(null);

  // Content state
  const [text, setText] = useState<string>(
    'Khubsurati jo dilon ko moh le... Noor Fashion ki nayi Festive Lawn Collection ab dastyab hai tamam leading stores par. Sajaiye apna har pal, ba-waqar andaaz mein.'
  );
  const [dialogueText, setDialogueText] = useState<string>(
    `Male: Suno Ayesha! Is Bari Eid par Mega Mart par pure 50% discount ka sab se bara dhamaka shuru ho gaya hai!
Female: Sach mein Hamza? Pure pachas feesad? Phir to humein abhi chalna chahiye shopping ke liye!
Male: Bilkul! Har brand aur har item par bachat. Stock mehdood hai, aaj hi tashreef laayein!
Female: To der kis baat ki! Aaj hi tashreef laayein aur bachat ka faida uthayein!`
  );

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [generatedList, setGeneratedList] = useState<GeneratedAudio[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showTemplateModal, setShowTemplateModal] = useState<boolean>(false);

  // Auto-Detect & Translation States
  const [isDetectingSpeakers, setIsDetectingSpeakers] = useState<boolean>(false);
  const [detectFeedback, setDetectFeedback] = useState<string | null>(null);
  const [isTranslatingDialogue, setIsTranslatingDialogue] = useState<boolean>(false);
  const [showTranslateModal, setShowTranslateModal] = useState<boolean>(false);

  // Dual-Character Dialogue Mode: 'builder' (Interactive Line-by-Line with speaker switches) | 'raw' (Freeform script)
  const [dialogueEditorTab, setDialogueEditorTab] = useState<'builder' | 'raw'>('builder');
  const [dialogueRows, setDialogueRows] = useState<ScriptDialogueRow[]>(() => {
    return parseScriptIntoRows(`Male: Suno Ayesha! Is Bari Eid par Mega Mart par pure 50% discount ka sab se bara dhamaka shuru ho gaya hai!
Female: Sach mein Hamza? Pure pachas feesad? Phir to humein abhi chalna chahiye shopping ke liye!
Male: Bilkul! Har brand aur har item par bachat. Stock mehdood hai, aaj hi tashreef laayein!
Female: To der kis baat ki! Aaj hi tashreef laayein aur bachat ka faida uthayein!`);
  });
  const [previewingRowId, setPreviewingRowId] = useState<string | null>(null);

  // Memoized parsed dialogue line counts
  const dialogueLinesParsed = React.useMemo(() => {
    if (generationMode !== 'dual_dialogue') return { male: 0, female: 0, total: 0 };
    if (dialogueEditorTab === 'builder') {
      const activeRows = dialogueRows.filter((r) => r.text && r.text.trim().length > 0);
      const male = activeRows.filter((r) => r.speaker === 'male').length;
      const female = activeRows.filter((r) => r.speaker === 'female').length;
      return { male, female, total: activeRows.length };
    }
    const lines = parseDialogueScript(dialogueText);
    const male = lines.filter((l) => l.speaker === 'male').length;
    const female = lines.filter((l) => l.speaker === 'female').length;
    return { male, female, total: lines.length };
  }, [dialogueText, dialogueRows, dialogueEditorTab, generationMode]);

  // Save custom voices to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_CLONES_KEY, JSON.stringify(customVoices));
    } catch (e) {
      console.error('Failed to save custom voices to localStorage', e);
    }
  }, [customVoices]);

  // Handle Voice Cloning actions
  const handleAddCustomVoice = (voice: CustomClonedVoice) => {
    setCustomVoices((prev) => [voice, ...prev]);
    setActiveCustomVoice(voice);
    if (voice.gender === 'Male') {
      setActiveMaleClonedVoice(voice);
      setDualMaleVoice(VoiceName.Custom_Cloned);
      setSelectedVoice(VoiceName.Custom_Cloned);
    } else {
      setActiveFemaleClonedVoice(voice);
      setDualFemaleVoice(VoiceName.Custom_Cloned);
      setSelectedVoice(VoiceName.Custom_Cloned);
    }
  };

  const handleDeleteCustomVoice = (id: string) => {
    setCustomVoices((prev) => prev.filter((v) => v.id !== id));
    if (activeCustomVoice?.id === id) {
      setActiveCustomVoice(null);
      setSelectedVoice(VoiceName.Ayesha_Pak_Female);
    }
    if (activeMaleClonedVoice?.id === id) {
      setActiveMaleClonedVoice(null);
      setDualMaleVoice(VoiceName.Hamza_Pak_Male);
    }
    if (activeFemaleClonedVoice?.id === id) {
      setActiveFemaleClonedVoice(null);
      setDualFemaleVoice(VoiceName.Ayesha_Pak_Female);
    }
  };

  const handleSelectClonedVoice = (voice: CustomClonedVoice) => {
    setActiveCustomVoice(voice);
    setSelectedVoice(VoiceName.Custom_Cloned);
    if (voice.gender === 'Male') {
      setActiveMaleClonedVoice(voice);
      setDualMaleVoice(VoiceName.Custom_Cloned);
    } else {
      setActiveFemaleClonedVoice(voice);
      setDualFemaleVoice(VoiceName.Custom_Cloned);
    }
    setActiveTab('studio');
  };

  // 2-in-1 Dual Clones & Transcribed Dialogue Loader
  const handleLoadDualClonesAndDialogue = (
    maleVoice: CustomClonedVoice,
    femaleVoice: CustomClonedVoice,
    dialogueScript: string
  ) => {
    setActiveMaleClonedVoice(maleVoice);
    setActiveFemaleClonedVoice(femaleVoice);
    setActiveCustomVoice(maleVoice);
    setDualMaleVoice(VoiceName.Custom_Cloned);
    setDualFemaleVoice(VoiceName.Custom_Cloned);
    setDialogueText(dialogueScript);
    setDialogueRows(parseScriptIntoRows(dialogueScript, maleVoice.name, femaleVoice.name));
    setGenerationMode('dual_dialogue');
    setDialogueEditorTab('builder');
    setActiveTab('studio');
  };

  const handleSelectCatalogVoice = (voiceId: VoiceName) => {
    setSelectedVoice(voiceId);
    setActiveCustomVoice(null);
    setActiveTab('studio');
  };

  // Load an ad template
  const applyAdTemplate = (template: AdTemplate) => {
    if (template.isDialogue) {
      setGenerationMode('dual_dialogue');
      setDialogueText(template.script);
      setDialogueRows(parseScriptIntoRows(template.script));
      setDualMaleVoice(template.suggestedVoice);
      if (template.suggestedFemaleVoice) setDualFemaleVoice(template.suggestedFemaleVoice);
    } else {
      setGenerationMode('single');
      setText(template.script);
      setSelectedVoice(template.suggestedVoice);
    }
    setSelectedLanguage(template.language);
    setSelectedStyle(template.suggestedStyle);
    setSpeechSpeed(template.suggestedSpeed);
    setShowTemplateModal(false);
    setActiveTab('studio');
  };

  // --- DUAL-CHARACTER LINE-BY-LINE BUILDER ACTIONS ---
  const handleSyncRawToBuilder = () => {
    if (!dialogueText.trim()) return;
    const parsed = parseScriptIntoRows(dialogueText);
    setDialogueRows(parsed);
    setDetectFeedback(`✨ Synchronized ${parsed.length} dialogue lines into the Line-by-Line Builder.`);
    setTimeout(() => setDetectFeedback(null), 4000);
  };

  const handleToggleRowSpeaker = (rowId: string, targetSpeaker?: 'male' | 'female') => {
    setDialogueRows((prev) => {
      const updated = prev.map((r) => {
        if (r.id !== rowId) return r;
        const newSpeaker = targetSpeaker || (r.speaker === 'male' ? 'female' : 'male');
        return {
          ...r,
          speaker: newSpeaker,
          characterName: newSpeaker === 'male' ? 'Male' : 'Female',
        };
      });
      setDialogueText(formatRowsIntoScript(updated));
      return updated;
    });
  };

  const handleUpdateRowText = (rowId: string, newText: string) => {
    setDialogueRows((prev) => {
      const updated = prev.map((r) => (r.id === rowId ? { ...r, text: newText } : r));
      setDialogueText(formatRowsIntoScript(updated));
      return updated;
    });
  };

  const handleAddDialogueRow = (insertAfterIndex?: number) => {
    setDialogueRows((prev) => {
      const lastSpeaker = prev.length > 0 ? prev[prev.length - 1].speaker : 'female';
      const nextSpeaker = lastSpeaker === 'male' ? 'female' : 'male';
      const newRow: ScriptDialogueRow = {
        id: `row-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        lineIndex: prev.length + 1,
        speaker: nextSpeaker,
        characterName: nextSpeaker === 'male' ? 'Male' : 'Female',
        text: '',
      };
      let updated: ScriptDialogueRow[];
      if (typeof insertAfterIndex === 'number' && insertAfterIndex >= 0 && insertAfterIndex < prev.length) {
        updated = [...prev.slice(0, insertAfterIndex + 1), newRow, ...prev.slice(insertAfterIndex + 1)];
      } else {
        updated = [...prev, newRow];
      }
      updated = updated.map((r, i) => ({ ...r, lineIndex: i + 1 }));
      setDialogueText(formatRowsIntoScript(updated));
      return updated;
    });
  };

  const handleDeleteDialogueRow = (rowId: string) => {
    if (dialogueRows.length <= 1) return;
    setDialogueRows((prev) => {
      const updated = prev.filter((r) => r.id !== rowId).map((r, i) => ({ ...r, lineIndex: i + 1 }));
      setDialogueText(formatRowsIntoScript(updated));
      return updated;
    });
  };

  const handleDuplicateDialogueRow = (rowId: string) => {
    const row = dialogueRows.find((r) => r.id === rowId);
    if (!row) return;
    setDialogueRows((prev) => {
      const idx = prev.findIndex((r) => r.id === rowId);
      const newRow: ScriptDialogueRow = {
        ...row,
        id: `row-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      };
      const updated = [...prev.slice(0, idx + 1), newRow, ...prev.slice(idx + 1)].map((r, i) => ({ ...r, lineIndex: i + 1 }));
      setDialogueText(formatRowsIntoScript(updated));
      return updated;
    });
  };

  const handleMoveDialogueRow = (rowId: string, direction: 'up' | 'down') => {
    setDialogueRows((prev) => {
      const idx = prev.findIndex((r) => r.id === rowId);
      if (idx === -1) return prev;
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= prev.length) return prev;
      const updated = [...prev];
      const temp = updated[idx];
      updated[idx] = updated[targetIdx];
      updated[targetIdx] = temp;
      const reindexed = updated.map((r, i) => ({ ...r, lineIndex: i + 1 }));
      setDialogueText(formatRowsIntoScript(reindexed));
      return reindexed;
    });
  };

  const handlePreviewDialogueRow = async (row: ScriptDialogueRow) => {
    const textToSpeak = (row.text || '').trim();
    if (!textToSpeak) {
      setError('Please enter dialogue text for this line before previewing.');
      return;
    }
    setPreviewingRowId(row.id);
    setError(null);
    try {
      const customMale = dualMaleVoice === VoiceName.Custom_Cloned
        ? (activeMaleClonedVoice || (activeCustomVoice?.gender === 'Male' ? activeCustomVoice : null))
        : null;
      const customFemale = dualFemaleVoice === VoiceName.Custom_Cloned
        ? (activeFemaleClonedVoice || (activeCustomVoice?.gender === 'Female' ? activeCustomVoice : null))
        : null;

      const blob = await generateSingleDialogueSegment(
        textToSpeak,
        row.speaker,
        dualMaleVoice,
        dualFemaleVoice,
        selectedStyle,
        selectedLanguage,
        speechSpeed,
        commercialEnergy,
        customMale,
        customFemale
      );
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => setPreviewingRowId(null);
      audio.onerror = () => setPreviewingRowId(null);
      await audio.play();
    } catch (err: any) {
      setPreviewingRowId(null);
      setError(err.message || 'Failed to preview dialogue line.');
    }
  };

  // 1-Click Translation for Dialogue Rows (Mode A: Voice-Preserved Translation)
  const handleTranslateAllDialogueRows = async (targetLang: Language) => {
    const active = dialogueRows.filter((r) => r.text && r.text.trim().length > 0);
    if (active.length === 0) {
      setError('Please enter dialogue text in at least one line before translating.');
      return;
    }
    setIsTranslatingDialogue(true);
    setError(null);
    setShowTranslateModal(false);
    try {
      const translated = await translateScriptDialogueRows(dialogueRows, targetLang);
      setDialogueRows(translated);
      setDialogueText(formatRowsIntoScript(translated));
      setSelectedLanguage(targetLang);
      setDetectFeedback(`✨ 100% Voice-Preserved Translation into ${targetLang}! Every line's speaker (Female/Male) was strictly kept.`);
      setTimeout(() => setDetectFeedback(null), 6000);
    } catch (e: any) {
      setError(e.message || 'Failed to translate dialogue rows.');
    } finally {
      setIsTranslatingDialogue(false);
    }
  };

  // Auto-Detect Male & Female dialogue turns from unstructured text
  const handleAutoDetectSpeakers = async () => {
    if (!dialogueText.trim()) return;
    setIsDetectingSpeakers(true);
    setError(null);
    setDetectFeedback(null);
    try {
      const result = await autoDetectAndFormatDialogueScript(dialogueText);
      setDialogueText(result.formattedScript);
      if (result.detectedLanguage) {
        setSelectedLanguage(result.detectedLanguage);
      }
      setDetectFeedback(`✨ ${result.summary} (👨 ${result.maleLinesCount} Male • 👩 ${result.femaleLinesCount} Female)`);
      setTimeout(() => setDetectFeedback(null), 6000);
    } catch (e: any) {
      setError(e.message || 'Failed to auto-detect speakers');
    } finally {
      setIsDetectingSpeakers(false);
    }
  };

  // 1-Click Dialogue Language Translation & Voice Consistency
  const handleTranslateDialogue = async (targetLang: Language) => {
    if (!dialogueText.trim()) {
      setError('Please enter dialogue script text before translating.');
      return;
    }
    setIsTranslatingDialogue(true);
    setError(null);
    setShowTranslateModal(false);
    try {
      const translated = await translateDialogueScript(dialogueText, targetLang);
      setDialogueText(translated);
      setSelectedLanguage(targetLang);
      setDetectFeedback(`🌐 Script translated to ${targetLang}! Identical Male & Female cloned voices are preserved.`);
      setTimeout(() => setDetectFeedback(null), 6000);
    } catch (e: any) {
      setError(e.message || 'Failed to translate dialogue');
    } finally {
      setIsTranslatingDialogue(false);
    }
  };

  // Save custom API key
  const handleSaveApiKey = () => {
    if (apiKeyInput.trim()) {
      localStorage.setItem(LOCAL_STORAGE_KEY_STORAGE, apiKeyInput.trim());
      setApiKeySavedSuccess(true);
      setTimeout(() => {
        setApiKeySavedSuccess(false);
        setShowDeployModal(false);
      }, 1500);
    } else {
      localStorage.removeItem(LOCAL_STORAGE_KEY_STORAGE);
      setApiKeySavedSuccess(true);
      setTimeout(() => {
        setApiKeySavedSuccess(false);
        setShowDeployModal(false);
      }, 1000);
    }
  };

  // Handle Generation (Single Voice OR Dual-Character Dialogue)
  const handleGenerate = async () => {
    setIsLoading(true);
    setError(null);
    setDialogueProgress(null);

    try {
      if (generationMode === 'dual_dialogue') {
        // --- DUAL CHARACTER DIALOGUE GENERATION ---
        const maleVoiceObj = VOICE_CATALOG.find((v) => v.id === dualMaleVoice);
        const femaleVoiceObj = VOICE_CATALOG.find((v) => v.id === dualFemaleVoice);

        const customMale = dualMaleVoice === VoiceName.Custom_Cloned
          ? (activeMaleClonedVoice || (activeCustomVoice?.gender === 'Male' ? activeCustomVoice : null))
          : null;
        const customFemale = dualFemaleVoice === VoiceName.Custom_Cloned
          ? (activeFemaleClonedVoice || (activeCustomVoice?.gender === 'Female' ? activeCustomVoice : null))
          : null;

        const maleName = customMale ? customMale.name : maleVoiceObj?.name || 'Male Speaker';
        const femaleName = customFemale ? customFemale.name : femaleVoiceObj?.name || 'Female Speaker';

        let lines: DialogueLine[];
        let fullDialogueScript = dialogueText;

        if (dialogueEditorTab === 'builder') {
          const activeRows = dialogueRows.filter((r) => r.text && r.text.trim().length > 0);
          if (activeRows.length === 0) {
            throw new Error('Please enter dialogue text for at least one line before generating audio.');
          }
          lines = activeRows.map((r) => ({
            speaker: r.speaker,
            characterName: r.speaker === 'male' ? maleName : femaleName,
            text: r.text.trim(),
          }));
          fullDialogueScript = formatRowsIntoScript(activeRows);
        } else {
          if (!dialogueText || !dialogueText.trim()) {
            throw new Error('Please enter dialogue script text in [Male]: ... and [Female]: ... format before generating.');
          }
          lines = parseDialogueScript(dialogueText, maleName, femaleName);
          if (lines.length === 0) {
            throw new Error('Please enter at least one dialogue line in Male: ... and Female: ... format');
          }
        }

        const combinedWavBlob = await generateDialogueSpeech(
          lines,
          dualMaleVoice,
          dualFemaleVoice,
          selectedStyle,
          selectedLanguage,
          speechSpeed,
          commercialEnergy,
          customMale,
          customFemale,
          (curr, tot) => {
            const line = lines[curr - 1];
            setDialogueProgress(`Generating line ${curr} of ${tot} (${line.speaker === 'male' ? '👨 ' + maleName : '👩 ' + femaleName})...`);
          }
        );

        const cleanWavBlob = await enhanceVoiceAcoustics(combinedWavBlob);
        const audioUrl = URL.createObjectURL(cleanWavBlob);

        const newAudio: GeneratedAudio = {
          id: Date.now().toString(),
          textSnippet: fullDialogueScript.slice(0, 70) + (fullDialogueScript.length > 70 ? '...' : ''),
          fullText: fullDialogueScript,
          url: audioUrl,
          timestamp: Date.now(),
          voice: dualMaleVoice,
          voiceDisplayName: `🎭 ${maleName} + ${femaleName}`,
          voiceGender: 'Dual_Dialogue',
          style: selectedStyle,
          language: selectedLanguage,
          speed: speechSpeed,
          energyLevel: commercialEnergy,
          isDialogue: true,
          maleVoiceName: maleName,
          femaleVoiceName: femaleName,
        };

        setGeneratedList((prev) => [newAudio, ...prev]);
      } else {
        // --- SINGLE VOICE GENERATION ---
        if (!text || !text.trim()) {
          throw new Error('Please enter text to generate speech.');
        }

        const base64Audio = await generateSpeech(
          text,
          selectedVoice,
          selectedStyle,
          selectedLanguage,
          speechSpeed,
          commercialEnergy,
          selectedVoice === VoiceName.Custom_Cloned ? activeCustomVoice : null
        );

        const pcmData = base64ToUint8Array(base64Audio);
        const rawWavBlob = pcmToWavBlob(pcmData);
        const cleanWavBlob = await enhanceVoiceAcoustics(rawWavBlob);
        const audioUrl = URL.createObjectURL(cleanWavBlob);

        let voiceDisplayName = 'Ayesha (Pakistani Beauty)';
        let voiceGender: VoiceGender = 'Female';

        if (selectedVoice === VoiceName.Custom_Cloned && activeCustomVoice) {
          voiceDisplayName = `🧬 ${activeCustomVoice.name}`;
          voiceGender = activeCustomVoice.gender;
        } else {
          const found = VOICE_CATALOG.find((v) => v.id === selectedVoice);
          if (found) {
            voiceDisplayName = found.name;
            voiceGender = found.gender;
          }
        }

        const newAudio: GeneratedAudio = {
          id: Date.now().toString(),
          textSnippet: text.slice(0, 65) + (text.length > 65 ? '...' : ''),
          fullText: text,
          url: audioUrl,
          timestamp: Date.now(),
          voice: selectedVoice,
          voiceDisplayName,
          voiceGender,
          style: selectedStyle,
          language: selectedLanguage,
          speed: speechSpeed,
          energyLevel: commercialEnergy,
          isClonedVoice: selectedVoice === VoiceName.Custom_Cloned,
          clonedVoiceName: activeCustomVoice?.name,
        };

        setGeneratedList((prev) => [newAudio, ...prev]);
      }

      if (window.innerWidth < 768) {
        setActiveTab('history');
      }
    } catch (err: any) {
      console.error('Generation error:', err);
      const errorMessage =
        err instanceof Error
          ? err.message
          : 'Failed to generate commercial audio. Please try again or simplify script.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
      setDialogueProgress(null);
    }
  };

  const handleDeleteHistoryItem = (id: string) => {
    setGeneratedList((prev) => prev.filter((item) => item.id !== id));
  };

  const currentContent = generationMode === 'dual_dialogue' ? dialogueText : text;
  const isUrduScript = /[\u0600-\u06FF]/.test(currentContent);

  return (
    <div className="min-h-[100dvh] bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      
      {/* Top Application Header */}
      <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 py-3 sm:px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-tr from-emerald-500 via-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-950/60 ring-1 ring-white/20">
              <Sparkles size={20} className="text-white animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-base sm:text-lg tracking-tight text-white">
                  VoiceCraft <span className="text-emerald-400">Studio</span>
                </h1>
                <span className="hidden sm:inline-block text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-medium">
                  Male + Female Dual Dialogue AI
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden xs:block">
                Authentic Voice Cloning • 2-Character Male & Female Commercials • 100% Natural Speech
              </p>
            </div>
          </div>

          {/* Desktop Top Nav Buttons */}
          <div className="hidden md:flex items-center gap-2 text-xs font-medium">
            <button
              onClick={() => setActiveTab('studio')}
              className={`px-3.5 py-1.5 rounded-xl transition-all ${
                activeTab === 'studio'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-slate-850 text-slate-300 hover:bg-slate-800'
              }`}
            >
              🎙️ Studio
            </button>
            <button
              onClick={() => setActiveTab('clone_lab')}
              className={`px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
                activeTab === 'clone_lab'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'bg-purple-950/40 text-purple-300 border border-purple-500/30 hover:bg-purple-900/40'
              }`}
            >
              <Mic2 size={13} />
              Voice Clone Lab
              {customVoices.length > 0 && (
                <span className="w-4 h-4 rounded-full bg-purple-500 text-white text-[9px] flex items-center justify-center">
                  {customVoices.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setShowTemplateModal(true)}
              className="px-3.5 py-1.5 rounded-xl bg-slate-850 text-slate-300 hover:bg-slate-800 transition-all flex items-center gap-1.5"
            >
              <FileText size={13} className="text-amber-400" />
              Ad Templates (Dialogue & Single)
            </button>
            <button
              onClick={() => setShowDeployModal(true)}
              className="px-3.5 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition-all flex items-center gap-1.5"
              title="GitHub & Custom Domain Setup"
            >
              <Globe size={13} className="text-cyan-400" />
              GitHub / Domain Setup
            </button>
          </div>

          {/* Mobile Quick Action Buttons */}
          <div className="md:hidden flex items-center gap-2">
            <button
              onClick={() => setShowDeployModal(true)}
              className="p-1.5 rounded-lg bg-slate-800 text-cyan-400"
              title="GitHub / API Key"
            >
              <Globe size={16} />
            </button>
            <button
              onClick={() => setActiveTab('clone_lab')}
              className="px-2.5 py-1 rounded-lg bg-purple-950/60 border border-purple-500/40 text-purple-300 text-xs font-medium flex items-center gap-1"
            >
              <Mic2 size={12} />
              Clone
            </button>
            <button
              onClick={() => setShowTemplateModal(true)}
              className="p-1.5 rounded-lg bg-slate-800 text-amber-400"
              title="Templates"
            >
              <FileText size={16} />
            </button>
          </div>

        </div>
      </header>

      {/* Main Body Area */}
      <main className="flex-1 flex flex-col md:flex-row max-w-7xl mx-auto w-full overflow-hidden">
        
        {/* Left Sidebar: Controls & Voice Selection (Visible on Desktop, or when 'voices' tab on Mobile) */}
        <div
          className={`w-full md:w-80 lg:w-96 flex-shrink-0 p-4 sm:p-5 overflow-y-auto border-r border-slate-800/80 bg-slate-900/40 custom-scrollbar ${
            activeTab === 'voices' ? 'block' : 'hidden md:block'
          }`}
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-200 flex items-center gap-1.5">
              <Sliders size={16} className="text-indigo-400" />
              Voice & Style Controls
            </h2>
            <span className="text-[10px] text-slate-500 font-mono">
              {VOICE_CATALOG.length} voices
            </span>
          </div>

          <ControlPanel
            selectedVoice={selectedVoice}
            setSelectedVoice={setSelectedVoice}
            selectedStyle={selectedStyle}
            setSelectedStyle={setSelectedStyle}
            selectedLanguage={selectedLanguage}
            setSelectedLanguage={setSelectedLanguage}
            speechSpeed={speechSpeed}
            setSpeechSpeed={setSpeechSpeed}
            commercialEnergy={commercialEnergy}
            setCommercialEnergy={setCommercialEnergy}
            customVoices={customVoices}
            activeCustomVoice={activeCustomVoice}
            onOpenCloneStudio={() => setActiveTab('clone_lab')}
          />
        </div>

        {/* Center / Right Dynamic Content Area */}
        <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar p-4 sm:p-6 lg:p-8">

          {/* VIEW 1: FULL VOICE CLONE LAB */}
          {activeTab === 'clone_lab' && (
            <div className="space-y-6">
              <VoiceCloneStudio
                customVoices={customVoices}
                onAddCustomVoice={handleAddCustomVoice}
                onDeleteCustomVoice={handleDeleteCustomVoice}
                onSelectClonedVoice={handleSelectClonedVoice}
                selectedClonedVoiceId={activeCustomVoice?.id || null}
                onSelectCatalogVoice={handleSelectCatalogVoice}
                currentVoiceId={selectedVoice}
                onLoadDualClonesAndDialogue={handleLoadDualClonesAndDialogue}
              />
            </div>
          )}

          {/* VIEW 2: AD TEMPLATES DRAWER */}
          {activeTab === 'templates' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <FileText className="text-amber-400" size={20} />
                  Pakistani Commercial Ad Scripts
                </h2>
                <button
                  onClick={() => setActiveTab('studio')}
                  className="text-xs text-indigo-400 hover:text-indigo-300"
                >
                  Back to Studio
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {PAKISTANI_AD_TEMPLATES.map((tpl) => (
                  <div
                    key={tpl.id}
                    className="p-4 bg-slate-900/90 rounded-2xl border border-slate-800 hover:border-amber-500/40 transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <h4 className="font-bold text-white text-sm">{tpl.title}</h4>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          tpl.isDialogue ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                        }`}>
                          {tpl.isDialogue ? '🎭 Dual Dialogue' : tpl.brandType}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed mb-4 italic whitespace-pre-line">
                        "{tpl.script}"
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                      <span className="text-[10px] text-slate-400">
                        {tpl.language} • {tpl.suggestedSpeed}x speed
                      </span>
                      <button
                        onClick={() => applyAdTemplate(tpl)}
                        className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow transition-all"
                      >
                        Use Script
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* VIEW 3: STUDIO SCRIPT INPUT & GENERATOR */}
          {(activeTab === 'studio' || (activeTab !== 'clone_lab' && activeTab !== 'templates' && activeTab !== 'voices' && activeTab !== 'history')) && (
            <div className="flex-1 flex flex-col gap-5 max-w-4xl mx-auto w-full">
              
              {/* Studio Commercial Mode Switcher: Single vs Dual Character Dialogue */}
              <div className="grid grid-cols-2 p-1 bg-slate-900/90 border border-slate-800 rounded-2xl shadow-lg">
                <button
                  onClick={() => setGenerationMode('single')}
                  className={`py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                    generationMode === 'single'
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <MessageSquareText size={16} />
                  Single Voice Commercial
                </button>
                <button
                  onClick={() => setGenerationMode('dual_dialogue')}
                  className={`py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                    generationMode === 'dual_dialogue'
                      ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Users size={16} />
                  🎭 Dual Dialogue (Male + Female)
                </button>
              </div>

              {/* DUAL CHARACTER CONTROLS BANNER (When in Dual Dialogue Mode) */}
              {generationMode === 'dual_dialogue' ? (
                <div className="p-4 bg-purple-950/30 border border-purple-500/40 rounded-2xl space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                      <Users size={16} className="text-purple-400" />
                      Two-Character Commercial Dialogue Cast
                    </span>
                    <button
                      onClick={() => setShowTemplateModal(true)}
                      className="text-[11px] text-amber-300 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20 hover:bg-amber-500/20"
                    >
                      Load Dialogue Preset
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    
                    {/* Male Character Selector */}
                    <div className="bg-slate-900/80 p-3 rounded-xl border border-blue-900/50">
                      <label className="block text-[11px] font-semibold text-blue-300 mb-1 flex items-center justify-between">
                        <span>👨 Character 1 (Male Voice)</span>
                        {dualMaleVoice === VoiceName.Custom_Cloned && activeMaleClonedVoice && (
                          <span className="text-[10px] text-blue-400 bg-blue-500/10 px-1.5 py-0.2 rounded font-mono truncate max-w-[120px]">
                            🧬 {activeMaleClonedVoice.name}
                          </span>
                        )}
                      </label>
                      <select
                        value={dualMaleVoice === VoiceName.Custom_Cloned && activeMaleClonedVoice ? activeMaleClonedVoice.id : dualMaleVoice}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val.startsWith('clone-')) {
                            const found = customVoices.find((v) => v.id === val);
                            if (found) {
                              setActiveMaleClonedVoice(found);
                              setDualMaleVoice(VoiceName.Custom_Cloned);
                            }
                          } else {
                            setDualMaleVoice(val as VoiceName);
                          }
                        }}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white outline-none focus:border-blue-500"
                      >
                        <optgroup label="🇵🇰 Studio Models">
                          {VOICE_CATALOG.filter((v) => v.gender === 'Male').map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.name} ({v.tagline})
                            </option>
                          ))}
                        </optgroup>
                        {customVoices.filter(v => v.gender === 'Male').length > 0 && (
                          <optgroup label="🧬 Cloned Male Voices">
                            {customVoices.filter(v => v.gender === 'Male').map((cv) => (
                              <option key={cv.id} value={cv.id}>
                                🧬 Cloned: {cv.name} ({cv.pitchCategory || `${cv.estimatedPitchHz} Hz`})
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    </div>

                    {/* Female Character Selector */}
                    <div className="bg-slate-900/80 p-3 rounded-xl border border-pink-900/50">
                      <label className="block text-[11px] font-semibold text-pink-300 mb-1 flex items-center justify-between">
                        <span>👩 Character 2 (Female Voice)</span>
                        {dualFemaleVoice === VoiceName.Custom_Cloned && activeFemaleClonedVoice && (
                          <span className="text-[10px] text-pink-400 bg-pink-500/10 px-1.5 py-0.2 rounded font-mono truncate max-w-[120px]">
                            🧬 {activeFemaleClonedVoice.name}
                          </span>
                        )}
                      </label>
                      <select
                        value={dualFemaleVoice === VoiceName.Custom_Cloned && activeFemaleClonedVoice ? activeFemaleClonedVoice.id : dualFemaleVoice}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val.startsWith('clone-')) {
                            const found = customVoices.find((v) => v.id === val);
                            if (found) {
                              setActiveFemaleClonedVoice(found);
                              setDualFemaleVoice(VoiceName.Custom_Cloned);
                            }
                          } else {
                            setDualFemaleVoice(val as VoiceName);
                          }
                        }}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white outline-none focus:border-pink-500"
                      >
                        <optgroup label="🇵🇰 Studio Models">
                          {VOICE_CATALOG.filter((v) => v.gender === 'Female').map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.name} ({v.tagline})
                            </option>
                          ))}
                        </optgroup>
                        {customVoices.filter(v => v.gender === 'Female').length > 0 && (
                          <optgroup label="🧬 Cloned Female Voices">
                            {customVoices.filter(v => v.gender === 'Female').map((cv) => (
                              <option key={cv.id} value={cv.id}>
                                🧬 Cloned: {cv.name} ({cv.pitchCategory || `${cv.estimatedPitchHz} Hz`})
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    </div>

                  </div>

                  {/* Dual Voice Consistency & Multi-Language Lock Bar */}
                  <div className="pt-2.5 border-t border-purple-900/40 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                    <div className="flex items-center gap-1.5 text-slate-300">
                      <Lock size={12} className="text-emerald-400 flex-shrink-0" />
                      <span>
                        <strong className="text-emerald-300 font-semibold">Dual Voice Consistency Lock:</strong> Active • Male & Female cloned voices retain 100% stable pitch & identity across all dialogue turns and languages.
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-medium bg-purple-950/80 text-purple-200 px-2 py-0.5 rounded-full border border-purple-800/60">
                        🌐 Script: {selectedLanguage}
                      </span>
                      <button
                        onClick={() => setShowTranslateModal(true)}
                        className="text-[11px] text-indigo-300 hover:text-white underline flex items-center gap-1 font-semibold"
                      >
                        <Languages size={12} /> Translate Script
                      </button>
                    </div>
                  </div>

                </div>
              ) : (
                /* SINGLE CHARACTER BANNER */
                <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-900/80 border border-slate-800/80 shadow-md">
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs flex-shrink-0">
                      {selectedVoice === VoiceName.Custom_Cloned ? '🧬' : '🎙️'}
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-white truncate block">
                        {selectedVoice === VoiceName.Custom_Cloned && activeCustomVoice
                          ? `Cloned: ${activeCustomVoice.name}`
                          : VOICE_CATALOG.find((v) => v.id === selectedVoice)?.name || selectedVoice}
                      </span>
                      <span className="text-[10px] text-indigo-400 block truncate">
                        {selectedStyle} • {speechSpeed.toFixed(2)}x Speed • {commercialEnergy}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => setActiveTab('voices')}
                      className="md:hidden text-xs text-slate-300 hover:text-white px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700"
                    >
                      Change Voice
                    </button>
                    <button
                      onClick={() => setShowTemplateModal(true)}
                      className="text-xs text-amber-300 hover:text-amber-200 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center gap-1"
                    >
                      <FileText size={12} />
                      <span className="hidden sm:inline">Pakistani</span> Scripts
                    </button>
                  </div>
                </div>
              )}

              {/* Script Input Card */}
              <div className="bg-slate-900/90 rounded-2xl border border-slate-700/80 shadow-2xl focus-within:ring-2 focus-within:ring-indigo-500/40 flex flex-col transition-all overflow-hidden">
                
                {/* Header with Mode Tabs for Dual Dialogue */}
                <div className="px-4 py-3 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 bg-slate-950/40">
                  <div className="flex items-center gap-2">
                    {generationMode === 'dual_dialogue' ? <Users size={16} className="text-purple-400" /> : <MessageSquareText size={16} className="text-indigo-400" />}
                    <span className="font-semibold text-slate-200">
                      {generationMode === 'dual_dialogue' ? 'Dual-Character Script (Male & Female Dialogue)' : 'Commercial Script'}
                    </span>
                  </div>

                  {generationMode === 'dual_dialogue' && (
                    <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
                      <button
                        type="button"
                        onClick={() => {
                          setDialogueEditorTab('builder');
                          if (dialogueRows.length === 0 && dialogueText.trim()) {
                            handleSyncRawToBuilder();
                          }
                        }}
                        className={`px-3 py-1 rounded-lg font-semibold flex items-center gap-1.5 transition-all text-xs ${
                          dialogueEditorTab === 'builder'
                            ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <ListFilter size={13} />
                        <span>📝 Line-by-Line Builder</span>
                        <span className="text-[10px] bg-purple-400/20 px-1 rounded text-purple-200 font-normal">
                          Tarteeb-war
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setDialogueEditorTab('raw');
                          setDialogueText(formatRowsIntoScript(dialogueRows));
                        }}
                        className={`px-3 py-1 rounded-lg font-semibold flex items-center gap-1.5 transition-all text-xs ${
                          dialogueEditorTab === 'raw'
                            ? 'bg-slate-800 text-white shadow'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <FileText size={13} />
                        <span>📄 Freeform Script Box</span>
                      </button>
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    {isUrduScript && (
                      <span className="text-[10px] text-emerald-400 font-mono bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        Urdu Script
                      </span>
                    )}
                    <span className="font-mono text-slate-500 text-[11px]">
                      {generationMode === 'dual_dialogue' && dialogueEditorTab === 'builder'
                        ? `${dialogueRows.length} lines (${dialogueLinesParsed.female} 👩 Female • ${dialogueLinesParsed.male} 👨 Male)`
                        : `${currentContent.length} / 2500 chars`}
                    </span>
                  </div>
                </div>

                {/* DUAL DIALOGUE: TAB 1 - INTERACTIVE LINE-BY-LINE BUILDER */}
                {generationMode === 'dual_dialogue' && dialogueEditorTab === 'builder' ? (
                  <div className="p-4 sm:p-5 space-y-4">
                    
                    {/* Mode A: 1-Click Multilingual Dubbing Bar */}
                    <div className="p-3 rounded-xl bg-purple-950/30 border border-purple-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <Globe size={15} className="text-purple-400" />
                          <h4 className="font-bold text-xs text-white">
                            Option 1: 1-Click Multilingual Dubbing (Voice-Preserved Translation)
                          </h4>
                        </div>
                        <p className="text-[11px] text-slate-300 mt-0.5">
                          Convert this dialogue into Telugu, Punjabi, Hindi or Urdu for YouTube videos. Line 1 stays Female, Line 2 stays Male with 100% lock!
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap w-full sm:w-auto">
                        <button
                          type="button"
                          disabled={isTranslatingDialogue}
                          onClick={() => handleTranslateAllDialogueRows(Language.Telugu)}
                          className="px-2.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold text-[11px] flex items-center gap-1 transition-all shadow"
                        >
                          {isTranslatingDialogue && selectedLanguage === Language.Telugu ? (
                            <RefreshCw size={12} className="animate-spin" />
                          ) : (
                            <Globe size={12} />
                          )}
                          <span>Telugu (తెలుగు)</span>
                        </button>

                        <button
                          type="button"
                          disabled={isTranslatingDialogue}
                          onClick={() => handleTranslateAllDialogueRows(Language.Punjabi)}
                          className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium transition-all"
                        >
                          Punjabi
                        </button>

                        <button
                          type="button"
                          disabled={isTranslatingDialogue}
                          onClick={() => handleTranslateAllDialogueRows(Language.Hindi)}
                          className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium transition-all"
                        >
                          Hindi
                        </button>

                        <button
                          type="button"
                          disabled={isTranslatingDialogue}
                          onClick={() => handleTranslateAllDialogueRows(Language.Urdu)}
                          className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium transition-all"
                        >
                          Urdu
                        </button>
                      </div>
                    </div>

                    {/* Dialogue Line Rows (Option 2: Tarteeb-war Speaker Assignment) */}
                    <div className="space-y-3">
                      {dialogueRows.map((row, idx) => {
                        const isMale = row.speaker === 'male';
                        const assignedVoiceTitle = isMale
                          ? (dualMaleVoice === VoiceName.Custom_Cloned && activeMaleClonedVoice ? activeMaleClonedVoice.name : (VOICE_CATALOG.find(v => v.id === dualMaleVoice)?.name || 'Male Speaker'))
                          : (dualFemaleVoice === VoiceName.Custom_Cloned && activeFemaleClonedVoice ? activeFemaleClonedVoice.name : (VOICE_CATALOG.find(v => v.id === dualFemaleVoice)?.name || 'Female Speaker'));

                        return (
                          <div
                            key={row.id}
                            className={`p-3.5 rounded-xl border transition-all ${
                              isMale
                                ? 'bg-blue-950/20 border-blue-900/60 hover:border-blue-700/80'
                                : 'bg-pink-950/20 border-pink-900/60 hover:border-pink-700/80'
                            }`}
                          >
                            {/* Row Header Bar */}
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-800/80">
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] font-mono font-bold text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                                  Line {idx + 1}
                                </span>

                                {/* Speaker Selector Buttons */}
                                <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-xs">
                                  <button
                                    type="button"
                                    onClick={() => handleToggleRowSpeaker(row.id, 'female')}
                                    className={`px-2.5 py-1 rounded-md font-bold text-[11px] flex items-center gap-1 transition-all ${
                                      !isMale
                                        ? 'bg-pink-600 text-white shadow-sm'
                                        : 'text-slate-400 hover:text-pink-300'
                                    }`}
                                  >
                                    <span>👩 Female</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleToggleRowSpeaker(row.id, 'male')}
                                    className={`px-2.5 py-1 rounded-md font-bold text-[11px] flex items-center gap-1 transition-all ${
                                      isMale
                                        ? 'bg-blue-600 text-white shadow-sm'
                                        : 'text-slate-400 hover:text-blue-300'
                                    }`}
                                  >
                                    <span>👨 Male</span>
                                  </button>
                                </div>

                                {/* Active Assigned Voice Tag */}
                                <span className={`text-[10px] px-2 py-0.5 rounded font-mono truncate max-w-[150px] ${
                                  isMale ? 'text-blue-300 bg-blue-950/80 border border-blue-800/60' : 'text-pink-300 bg-pink-950/80 border border-pink-800/60'
                                }`}>
                                  🎙️ {assignedVoiceTitle}
                                </span>
                              </div>

                              {/* Row Utility Buttons */}
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handlePreviewDialogueRow(row)}
                                  disabled={previewingRowId === row.id || !row.text.trim()}
                                  className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold flex items-center gap-1 transition-all disabled:opacity-40"
                                  title="Test speak this single line"
                                >
                                  {previewingRowId === row.id ? (
                                    <RefreshCw size={11} className="animate-spin text-purple-400" />
                                  ) : (
                                    <Play size={11} className="text-purple-400" />
                                  )}
                                  <span>{previewingRowId === row.id ? 'Playing...' : 'Test Line'}</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleMoveDialogueRow(row.id, 'up')}
                                  disabled={idx === 0}
                                  className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30"
                                  title="Move Line Up"
                                >
                                  <ArrowUp size={13} />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleMoveDialogueRow(row.id, 'down')}
                                  disabled={idx === dialogueRows.length - 1}
                                  className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30"
                                  title="Move Line Down"
                                >
                                  <ArrowDown size={13} />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleDuplicateDialogueRow(row.id)}
                                  className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
                                  title="Duplicate Line"
                                >
                                  <Copy size={13} />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleDeleteDialogueRow(row.id)}
                                  disabled={dialogueRows.length <= 1}
                                  className="p-1 rounded text-slate-400 hover:text-red-400 hover:bg-slate-800 disabled:opacity-30"
                                  title="Delete Line"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>

                            {/* Dialogue Line Textarea */}
                            <textarea
                              rows={2}
                              value={row.text}
                              onChange={(e) => handleUpdateRowText(row.id, e.target.value)}
                              placeholder={`Line ${idx + 1} (${isMale ? 'Male' : 'Female'}): Enter dialogue in Telugu, Urdu, Hindi, Punjabi or English...`}
                              className={`w-full bg-slate-950/80 border rounded-lg p-2.5 text-xs sm:text-sm text-slate-100 placeholder-slate-600 outline-none transition-all ${
                                isMale
                                  ? 'border-blue-900/50 focus:border-blue-500'
                                  : 'border-pink-900/50 focus:border-pink-500'
                              } ${isUrduScript ? 'font-serif text-right text-base' : 'font-sans'}`}
                            />
                          </div>
                        );
                      })}
                    </div>

                    {/* Bottom Builder Controls */}
                    <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={() => handleAddDialogueRow()}
                        className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-500/40 text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95"
                      >
                        <Plus size={15} />
                        <span>+ Add New Dialogue Line (Line {dialogueRows.length + 1})</span>
                      </button>

                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <span>Speaker lock: Every line speaks strictly with its assigned voice.</span>
                      </div>
                    </div>

                  </div>
                ) : (
                  /* TAB 2 OR SINGLE MODE: TEXTAREA INPUT */
                  <div>
                    {generationMode === 'dual_dialogue' && (
                      <div className="p-3 bg-purple-950/20 border-b border-purple-900/30 flex items-center justify-between gap-2">
                        <span className="text-[11px] text-purple-300">
                          Paste your script with <strong>Female:</strong> and <strong>Male:</strong> lines. You can convert it into the Line-by-Line Builder anytime.
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            handleSyncRawToBuilder();
                            setDialogueEditorTab('builder');
                          }}
                          className="px-3 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold text-[11px] flex items-center gap-1 transition-all flex-shrink-0 shadow"
                        >
                          <Wand2 size={12} />
                          <span>Load into Line Builder</span>
                        </button>
                      </div>
                    )}

                    <textarea
                      className={`w-full min-h-[160px] sm:min-h-[200px] bg-transparent p-4 sm:p-5 text-base sm:text-lg text-slate-100 placeholder-slate-600 outline-none resize-none leading-relaxed font-light ${
                        isUrduScript ? 'font-serif text-right text-xl leading-loose' : 'font-sans'
                      }`}
                      placeholder={
                        generationMode === 'dual_dialogue'
                          ? `Write or paste dialogue with Female: and Male: prefix:\n\nFemale:\nThakkuva vayassulo meeku 10 nundi 12 shatham juttu thellabaduthunte...\n\nMale Voice:\nMarket lo intha manchi mehndi unnappudu, ika bhayam deniki?\n\nFemale:\nIndulo aavala nune mariyu prakruthi siddhamaina aushadhamulu unnai!`
                          : `Enter your commercial script in Urdu, Roman Urdu, Hindi or English...\n\nExample:\n"Khushkhabri! Is Bari Eid par laya hai Mega Mart sab se bara Dhamaka Offer! Pure 50% tak ki bachat. Stock mehdood hai, aaj hi tashreef laayein!"`
                      }
                      value={generationMode === 'dual_dialogue' ? dialogueText : text}
                      onChange={(e) => {
                        if (generationMode === 'dual_dialogue') setDialogueText(e.target.value);
                        else setText(e.target.value);
                      }}
                      maxLength={2500}
                    />
                  </div>
                )}

                {/* Quick Presets Bar */}
                <div className="px-4 py-2 bg-slate-950/60 border-t border-slate-800 flex items-center gap-2 overflow-x-auto no-scrollbar text-xs">
                  <span className="text-slate-500 text-[10px] whitespace-nowrap">1-Click Presets:</span>
                  {generationMode === 'dual_dialogue' ? (
                    <>
                      <button
                        onClick={() => applyAdTemplate(PAKISTANI_AD_TEMPLATES[0])}
                        className="px-2.5 py-1 rounded-lg bg-purple-950/60 hover:bg-purple-900/60 text-purple-300 border border-purple-800/40 whitespace-nowrap text-[11px]"
                      >
                        ☕ Shaahi Chai Dialogue
                      </button>
                      <button
                        onClick={() => applyAdTemplate(PAKISTANI_AD_TEMPLATES[1])}
                        className="px-2.5 py-1 rounded-lg bg-pink-950/60 hover:bg-pink-900/60 text-pink-300 border border-pink-800/40 whitespace-nowrap text-[11px]"
                      >
                        💥 Eid Sale Shopping Dialogue
                      </button>
                      <button
                        onClick={() => applyAdTemplate(PAKISTANI_AD_TEMPLATES[2])}
                        className="px-2.5 py-1 rounded-lg bg-blue-950/60 hover:bg-blue-900/60 text-blue-300 border border-blue-800/40 whitespace-nowrap text-[11px]"
                      >
                        🍕 20-Min Delivery Dialogue
                      </button>
                      <button
                        onClick={() => applyAdTemplate(PAKISTANI_AD_TEMPLATES[3])}
                        className="px-2.5 py-1 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-800/40 whitespace-nowrap text-[11px]"
                      >
                        🏙️ Housing Scheme Dialogue
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => applyAdTemplate(PAKISTANI_AD_TEMPLATES[6])}
                        className="px-2.5 py-1 rounded-lg bg-pink-950/50 hover:bg-pink-900/60 text-pink-300 border border-pink-800/40 whitespace-nowrap text-[11px]"
                      >
                        👩 Ayesha (Beauty & Lawn)
                      </button>
                      <button
                        onClick={() => applyAdTemplate(PAKISTANI_AD_TEMPLATES[5])}
                        className="px-2.5 py-1 rounded-lg bg-emerald-950/50 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-800/40 whitespace-nowrap text-[11px]"
                      >
                        👩 Maryam (Shaahi Chai)
                      </button>
                      <button
                        onClick={() => applyAdTemplate(PAKISTANI_AD_TEMPLATES[4])}
                        className="px-2.5 py-1 rounded-lg bg-slate-850 hover:bg-slate-800 text-slate-300 whitespace-nowrap text-[11px]"
                      >
                        👨 Hamza (Dhamaka Sale)
                      </button>
                    </>
                  )}
                </div>

                {/* Generate Action Bar */}
                <div className="p-4 border-t border-slate-800 bg-slate-900/60 rounded-b-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>
                      {generationMode === 'dual_dialogue'
                        ? 'Dual Character Voice Synthesizer Ready'
                        : 'Gemini Natural Human Voice Ready'}
                    </span>
                  </div>

                  <button
                    onClick={handleGenerate}
                    disabled={isLoading || !(generationMode === 'dual_dialogue' ? dialogueText.trim() : text.trim())}
                    className={`w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl font-bold text-sm transition-all shadow-xl transform active:scale-95 ${
                      isLoading || !(generationMode === 'dual_dialogue' ? dialogueText.trim() : text.trim())
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                        : generationMode === 'dual_dialogue'
                        ? 'bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-purple-900/50'
                        : 'bg-gradient-to-r from-emerald-600 via-indigo-600 to-purple-600 hover:from-emerald-500 hover:to-purple-500 text-white shadow-indigo-900/50'
                    }`}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 size={18} className="animate-spin text-white" />
                        {dialogueProgress || 'Synthesizing Commercial Audio...'}
                      </>
                    ) : (
                      <>
                        <Sparkles size={18} />
                        {generationMode === 'dual_dialogue' ? 'Generate Dialogue Commercial' : 'Generate Commercial Audio'}
                      </>
                    )}
                  </button>
                </div>

              </div>

              {/* Error Message Box */}
              {error && (
                <div className="p-4 bg-red-950/40 border border-red-800/80 rounded-2xl text-red-200 text-xs sm:text-sm animate-in fade-in flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-red-500 mt-1 flex-shrink-0" />
                  <div className="flex-1">
                    <strong className="block font-semibold text-red-100">Audio Generation Note</strong>
                    <span className="text-red-200/90 leading-relaxed">{error}</span>
                  </div>
                  <button onClick={() => setError(null)} className="text-red-400 hover:text-white">
                    <X size={16} />
                  </button>
                </div>
              )}

              {/* Generated Audio Section */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm text-slate-200 flex items-center gap-2">
                    <History size={16} className="text-indigo-400" />
                    Generated Commercials & Dialogues
                    {generatedList.length > 0 && (
                      <span className="px-2 py-0.2 rounded-full bg-slate-800 text-xs text-slate-400 font-mono">
                        {generatedList.length}
                      </span>
                    )}
                  </h3>
                  {generatedList.length > 0 && (
                    <span className="text-[11px] text-slate-500">
                      WAV Studio Format • Live Speed Controls • BGM Mixer
                    </span>
                  )}
                </div>

                {generatedList.length === 0 ? (
                  <div className="py-10 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-950/40">
                    <div className="w-12 h-12 rounded-full bg-slate-850 flex items-center justify-center mx-auto mb-2 text-slate-500">
                      <Volume2 size={22} />
                    </div>
                    <p className="text-xs text-slate-400">No voiceovers generated yet.</p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Choose Single Voice or Dual Dialogue mode, write your script, then tap Generate!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {generatedList.map((item) => (
                      <AudioPlayer
                        key={item.id}
                        item={item}
                        onDelete={handleDeleteHistoryItem}
                      />
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* VIEW 4: HISTORY ONLY (Mobile Tab) */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <History className="text-indigo-400" size={18} />
                  Generated Commercials History ({generatedList.length})
                </h2>
                <button
                  onClick={() => setActiveTab('studio')}
                  className="text-xs text-indigo-400 hover:text-indigo-300"
                >
                  Back to Studio
                </button>
              </div>

              {generatedList.length === 0 ? (
                <div className="py-12 text-center rounded-2xl border border-dashed border-slate-800">
                  <p className="text-xs text-slate-400">No generated audio files yet.</p>
                  <button
                    onClick={() => setActiveTab('studio')}
                    className="mt-3 px-4 py-2 bg-indigo-600 rounded-xl text-xs font-semibold text-white"
                  >
                    Go to Studio & Generate
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {generatedList.map((item) => (
                    <AudioPlayer
                      key={item.id}
                      item={item}
                      onDelete={handleDeleteHistoryItem}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden sticky bottom-0 z-40 bg-slate-900/95 backdrop-blur-lg border-t border-slate-800 px-2 py-2 flex items-center justify-around">
        <button
          onClick={() => setActiveTab('studio')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all ${
            activeTab === 'studio' ? 'text-indigo-400 font-semibold' : 'text-slate-400'
          }`}
        >
          <MessageSquareText size={18} />
          <span className="text-[10px]">Studio</span>
        </button>

        <button
          onClick={() => setActiveTab('voices')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all ${
            activeTab === 'voices' ? 'text-indigo-400 font-semibold' : 'text-slate-400'
          }`}
        >
          <Sliders size={18} />
          <span className="text-[10px]">Voices</span>
        </button>

        <button
          onClick={() => setActiveTab('clone_lab')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all relative ${
            activeTab === 'clone_lab' ? 'text-purple-400 font-semibold' : 'text-slate-400'
          }`}
        >
          <Mic2 size={18} />
          <span className="text-[10px]">Voice Clone</span>
          {customVoices.length > 0 && (
            <span className="absolute top-0 right-2 w-2 h-2 rounded-full bg-purple-500" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all relative ${
            activeTab === 'history' ? 'text-indigo-400 font-semibold' : 'text-slate-400'
          }`}
        >
          <History size={18} />
          <span className="text-[10px]">Audio</span>
          {generatedList.length > 0 && (
            <span className="absolute top-0 right-2 w-4 h-4 rounded-full bg-indigo-600 text-[9px] text-white flex items-center justify-center font-mono">
              {generatedList.length}
            </span>
          )}
        </button>
      </nav>

      {/* Ad Templates Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            
            <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white text-base flex items-center gap-2">
                  <FileText size={18} className="text-amber-400" />
                  Pakistani Commercial Scripts & Dialogues
                </h3>
                <p className="text-xs text-slate-400">
                  Select a pre-written high-converting script (Single Voice or Male+Female Dual Dialogue).
                </p>
              </div>
              <button
                onClick={() => setShowTemplateModal(false)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-3 custom-scrollbar flex-1">
              {PAKISTANI_AD_TEMPLATES.map((tpl) => (
                <div
                  key={tpl.id}
                  onClick={() => applyAdTemplate(tpl)}
                  className="p-3.5 bg-slate-950/70 border border-slate-800 hover:border-amber-500/50 rounded-xl cursor-pointer transition-all group"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-sm text-white group-hover:text-amber-300 transition-colors">
                      {tpl.title}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      tpl.isDialogue ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                    }`}>
                      {tpl.isDialogue ? '🎭 Dual Dialogue' : tpl.brandType}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 italic line-clamp-3 leading-relaxed whitespace-pre-line">
                    "{tpl.script}"
                  </p>
                  <div className="flex items-center justify-between mt-2 text-[10px] text-slate-500">
                    <span>{tpl.isDialogue ? 'Male + Female Cast' : `Voice: ${VOICE_CATALOG.find(v => v.id === tpl.suggestedVoice)?.name}`}</span>
                    <span className="text-indigo-400 font-semibold group-hover:underline">Use this Script →</span>
                  </div>
                </div>
              ))}
            </div>

          </div>
        </div>
      )}

      {/* GitHub & Custom Domain Deployment Guide Modal */}
      {showDeployModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-2xl max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            
            <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white text-base flex items-center gap-2">
                  <Globe size={18} className="text-cyan-400" />
                  Deploy Outside AI Studio & Custom Domain
                </h3>
                <p className="text-xs text-slate-400">
                  How to host on GitHub, Vercel, Netlify, or your own custom domain.
                </p>
              </div>
              <button
                onClick={() => setShowDeployModal(false)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-5 custom-scrollbar text-xs leading-relaxed text-slate-300">
              
              {/* API Key setting */}
              <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white flex items-center gap-1.5">
                    <Key size={14} className="text-amber-400" />
                    Custom Gemini API Key
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">Saved in browser</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  When deployed on GitHub Pages or custom domain, enter your free API key from Google AI Studio here:
                </p>
                <div className="flex gap-2">
                  <input
                    type="password"
                    placeholder="AIzaSy..."
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-indigo-500"
                  />
                  <button
                    onClick={handleSaveApiKey}
                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium text-xs transition-all"
                  >
                    {apiKeySavedSuccess ? '✓ Saved!' : 'Save Key'}
                  </button>
                </div>
              </div>

              {/* Step by step deployment */}
              <div className="space-y-3">
                <h4 className="font-bold text-white text-sm">
                  🚀 1-Click Deployment to Vercel (Recommended & Free):
                </h4>
                <ol className="list-decimal pl-5 space-y-1.5 text-slate-300">
                  <li>Push your code to your GitHub repository.</li>
                  <li>Go to <span className="text-cyan-400 font-semibold">vercel.com</span> (or netlify.com) and log in with GitHub.</li>
                  <li>Click <span className="font-semibold text-white">"Add New Project"</span> and select your GitHub repo.</li>
                  <li>In <strong>Environment Variables</strong>, add:
                    <div className="bg-slate-950 p-2 rounded mt-1 font-mono text-[11px] text-emerald-400 border border-slate-800">
                      GEMINI_API_KEY = your_gemini_api_key
                    </div>
                  </li>
                  <li>Click <span className="font-semibold text-white">"Deploy"</span>! Your app is live with SSL HTTPS!</li>
                  <li>To add your custom domain (e.g. <code>myvoiceapp.com</code>), go to <strong>Project Settings → Domains</strong> and type your domain name.</li>
                </ol>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-800">
                <h4 className="font-bold text-white text-sm">
                  📦 GitHub Pages Option:
                </h4>
                <p className="text-slate-400 text-[11px]">
                  GitHub by itself only stores the code. To enable GitHub Pages, go to your GitHub repository <strong>Settings → Pages → Build and deployment → Source: GitHub Actions (Vite)</strong>.
                  We have added <code>base: './'</code> to <code>vite.config.ts</code> so all assets load properly on GitHub Pages!
                </p>
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default App;