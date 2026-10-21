import React, { useState, useRef, useEffect } from 'react';
import {
  Mic,
  Square,
  Play,
  Pause,
  Upload,
  Trash2,
  CheckCircle2,
  Sparkles,
  Volume2,
  AudioWaveform,
  User,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  Flame,
  Zap,
  Radio,
  Users,
  Copy,
  Check,
  Music2,
  FileCheck2,
  ShieldCheck,
  Languages,
  Plus,
  ArrowUp,
  ArrowDown,
  Globe,
  ListFilter,
  Download,
  Wand2,
  Lock,
  Layers,
} from 'lucide-react';
import {
  CustomClonedVoice,
  VoiceName,
  DualCharacterAnalysisResult,
  DialogueLine,
  Language,
  DiarizedSegment,
  ScriptDialogueRow,
  DubbingWorkflowMode,
  SpeechStyle,
  CommercialEnergy,
} from '../types';
import { analyzeVoiceSample, parseScriptIntoRows, formatRowsIntoScript } from '../utils/audioHelper';
import {
  analyzeDualSpeakerAudio,
  generateDialogueSpeech,
  generateSingleDialogueSegment,
  translateDiarizedSegments,
  translateScriptDialogueRows,
} from '../services/geminiService';
import { audioBufferToWavBlob } from '../utils/audioDsp';
import { VOICE_CATALOG } from '../data/voiceCatalog';

interface VoiceCloneStudioProps {
  customVoices: CustomClonedVoice[];
  onAddCustomVoice: (voice: CustomClonedVoice) => void;
  onDeleteCustomVoice: (id: string) => void;
  onSelectClonedVoice: (voice: CustomClonedVoice) => void;
  selectedClonedVoiceId: string | null;
  onSelectCatalogVoice: (voiceId: VoiceName) => void;
  currentVoiceId: VoiceName;
  onLoadDualClonesAndDialogue?: (maleVoice: CustomClonedVoice, femaleVoice: CustomClonedVoice, dialogueScript: string) => void;
}

export const VoiceCloneStudio: React.FC<VoiceCloneStudioProps> = ({
  customVoices,
  onAddCustomVoice,
  onDeleteCustomVoice,
  onSelectClonedVoice,
  selectedClonedVoiceId,
  onSelectCatalogVoice,
  currentVoiceId,
  onLoadDualClonesAndDialogue,
}) => {
  // Tab state: 'create' | 'dual_clone' | 'premade' | 'my_clones'
  const [activeTab, setActiveTab] = useState<'create' | 'dual_clone' | 'premade' | 'my_clones'>('create');
  
  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedBlobUrl, setRecordedBlobUrl] = useState<string | null>(null);
  const [isPlayingRecorded, setIsPlayingRecorded] = useState(false);

  // Analysis / Form State
  const [cloneName, setCloneName] = useState('');
  const [cloneGender, setCloneGender] = useState<'Male' | 'Female'>('Male');
  const [cloneAccent, setCloneAccent] = useState('Pakistani Standard Urdu');
  const [cloneDeliveryStyle, setCloneDeliveryStyle] = useState('High-Impact TV Commercial Promo (Dhamaka Sale)');
  const [cloneVocalTexture, setCloneVocalTexture] = useState('Warm & Resonant');
  
  const [analyzedData, setAnalyzedData] = useState<{
    estimatedPitchHz: number;
    pitchCategory: 'Deep Baritone' | 'Natural Mid' | 'High Pitch';
    suggestedGender: 'Male' | 'Female';
    suggestedBaseVoice: 'Puck' | 'Charon' | 'Fenrir' | 'Kore' | 'Zephyr';
    suggestedTexture: string;
    suggestedDelivery: string;
    durationSeconds: number;
    energyLevel: string;
  } | null>(null);
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [cloneSuccess, setCloneSuccess] = useState(false);

  // Premade filter: 'all' | 'Male' | 'Female'
  const [premadeGenderFilter, setPremadeGenderFilter] = useState<'all' | 'Male' | 'Female'>('all');

  // Sub-mode under Solo Voice Clone / Dubbing Studio:
  // 'standard_solo' | 'mode_a_dubbing' | 'mode_b_script'
  const [dubbingSubMode, setDubbingSubMode] = useState<DubbingWorkflowMode>('standard_solo');

  // --- Dual-Character (Male + Female) Diarization & Cloner State ---
  const [dualAudioBlob, setDualAudioBlob] = useState<Blob | null>(null);
  const [dualAudioUrl, setDualAudioUrl] = useState<string | null>(null);
  const [dualAudioName, setDualAudioName] = useState<string>('');
  const [isAnalyzingDual, setIsAnalyzingDual] = useState(false);
  const [dualAnalysisResult, setDualAnalysisResult] = useState<DualCharacterAnalysisResult | null>(null);
  const [isPlayingDual, setIsPlayingDual] = useState(false);
  const [dualMaleName, setDualMaleName] = useState('Cloned Male Character');
  const [dualFemaleName, setDualFemaleName] = useState('Cloned Female Character');
  const [editedDialogueScript, setEditedDialogueScript] = useState('');
  const [dualCloneSuccess, setDualCloneSuccess] = useState(false);
  const dualAudioRef = useRef<HTMLAudioElement | null>(null);

  // --- MODE A: Voice-Preserved Translation (Auto Dubbing) State ---
  const [dubbingSegments, setDubbingSegments] = useState<DiarizedSegment[]>([]);
  const [targetDubLanguage, setTargetDubLanguage] = useState<Language>(Language.Telugu);
  const [isTranslatingDub, setIsTranslatingDub] = useState(false);
  const [isGeneratingDub, setIsGeneratingDub] = useState(false);
  const [dubAudioUrl, setDubAudioUrl] = useState<string | null>(null);
  const [dubProgress, setDubProgress] = useState<string | null>(null);
  const [previewingSegmentId, setPreviewingSegmentId] = useState<string | null>(null);
  const [dubFeedback, setDubFeedback] = useState<string | null>(null);
  const [dubMaleVoice, setDubMaleVoice] = useState<VoiceName>(VoiceName.Hamza_Pak_Male);
  const [dubFemaleVoice, setDubFemaleVoice] = useState<VoiceName>(VoiceName.Ayesha_Pak_Female);

  // --- MODE B: Dual-Character Script (Manual Rows) State ---
  const [scriptRows, setScriptRows] = useState<ScriptDialogueRow[]>([
    {
      id: 'row-1',
      lineIndex: 1,
      speaker: 'female',
      characterName: 'Ayesha (Female)',
      text: 'Suniyega! Is Eid par Mega Mart par 50% discount chal raha hai!',
    },
    {
      id: 'row-2',
      lineIndex: 2,
      speaker: 'male',
      characterName: 'Hamza (Male)',
      text: 'Sach mein? Phir to abhi shopping ke liye chalte hain!',
    },
    {
      id: 'row-3',
      lineIndex: 3,
      speaker: 'female',
      characterName: 'Ayesha (Female)',
      text: 'Bilkul! Saare brands par shandar bachat aur dhamaka offers hain.',
    },
    {
      id: 'row-4',
      lineIndex: 4,
      speaker: 'male',
      characterName: 'Hamza (Male)',
      text: 'Zabardast! Aaj hi saari shopping mukammal karte hain.',
    },
  ]);
  const [targetScriptLanguage, setTargetScriptLanguage] = useState<Language>(Language.Telugu);
  const [isTranslatingScriptRows, setIsTranslatingScriptRows] = useState(false);
  const [isGeneratingScriptAudio, setIsGeneratingScriptAudio] = useState(false);
  const [scriptAudioUrl, setScriptAudioUrl] = useState<string | null>(null);
  const [scriptProgress, setScriptProgress] = useState<string | null>(null);
  const [previewingRowId, setPreviewingRowId] = useState<string | null>(null);
  const [scriptFeedback, setScriptFeedback] = useState<string | null>(null);
  const [modeBMaleVoice, setModeBMaleVoice] = useState<VoiceName>(VoiceName.Hamza_Pak_Male);
  const [modeBFemaleVoice, setModeBFemaleVoice] = useState<VoiceName>(VoiceName.Ayesha_Pak_Female);

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Visualizer loop during live recording
  const startVisualizer = (stream: MediaStream) => {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioCtx();
    audioContextRef.current = ctx;
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 64;
    source.connect(analyser);
    analyserRef.current = analyser;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const canvasCtx = canvas.getContext('2d');
    if (!canvasCtx) return;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const draw = () => {
      animationFrameRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
      const barWidth = (canvas.width / dataArray.length) * 1.5;
      let x = 0;

      for (let i = 0; i < dataArray.length; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height;
        canvasCtx.fillStyle = `rgb(${Math.min(255, 99 + barHeight)}, 102, 241)`;
        canvasCtx.fillRect(x, canvas.height - barHeight, barWidth - 2, barHeight);
        x += barWidth;
      }
    };
    draw();
  };

  // Start Live Recording
  const handleStartRecording = async () => {
    try {
      setRecordedBlob(null);
      setRecordedBlobUrl(null);
      setAnalyzedData(null);
      setCloneSuccess(false);
      audioChunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      startVisualizer(stream);

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setRecordedBlob(blob);
        const url = URL.createObjectURL(blob);
        setRecordedBlobUrl(url);

        stream.getTracks().forEach((track) => track.stop());
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);

        runAcousticAnalysis(blob);
      };

      recorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);

      timerRef.current = window.setInterval(() => {
        setRecordingSeconds((prev) => {
          if (prev >= 25) {
            handleStopRecording();
            return 25;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      console.error('Microphone access denied:', err);
      alert('Microphone access is needed to record voice for cloning. Please allow microphone permissions or use file upload.');
    }
  };

  // Stop Recording
  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  // File Upload Handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const baseName = file.name.replace(/\.[^/.]+$/, '').slice(0, 24);
      setCloneName(baseName);
      setRecordedBlob(file);
      const url = URL.createObjectURL(file);
      setRecordedBlobUrl(url);
      runAcousticAnalysis(file);
    }
  };

  // Run acoustic analysis
  const runAcousticAnalysis = async (blob: Blob) => {
    setIsAnalyzing(true);
    try {
      const result = await analyzeVoiceSample(blob);
      setAnalyzedData(result);
      setCloneGender(result.suggestedGender);
      setCloneVocalTexture(result.suggestedTexture);
      setCloneDeliveryStyle(result.suggestedDelivery);
      if (!cloneName) {
        setCloneName(`Cloned ${result.suggestedGender} (${result.pitchCategory})`);
      }
    } catch (err) {
      console.error('Analysis failed:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Play / Pause Recorded Audio
  const togglePlayRecorded = () => {
    if (!previewAudioRef.current) return;
    if (isPlayingRecorded) {
      previewAudioRef.current.pause();
      setIsPlayingRecorded(false);
    } else {
      previewAudioRef.current.play();
      setIsPlayingRecorded(true);
    }
  };

  // Save Custom Cloned Voice
  const handleSaveClone = () => {
    if (!cloneName.trim()) {
      alert('Please provide a name for this cloned voice.');
      return;
    }

    const baseVoice = analyzedData?.suggestedBaseVoice || (cloneGender === 'Male' ? 'Fenrir' : 'Zephyr');

    const newClonedVoice: CustomClonedVoice = {
      id: `clone-${Date.now()}`,
      name: cloneName.trim(),
      gender: cloneGender,
      recordedSampleBlobUrl: recordedBlobUrl || undefined,
      audioDurationSeconds: analyzedData?.durationSeconds || recordingSeconds,
      sampleFileName: cloneName,
      estimatedPitchHz: analyzedData?.estimatedPitchHz || 140,
      pitchCategory: analyzedData?.pitchCategory || (cloneGender === 'Male' ? 'Natural Mid' : 'High Pitch'),
      vocalTexture: cloneVocalTexture,
      timbreDescription: `${cloneGender} voice with ${cloneVocalTexture.toLowerCase()}`,
      accent: cloneAccent,
      cadence: cloneDeliveryStyle,
      exactDeliveryStyle: cloneDeliveryStyle,
      baseVoice,
      createdAt: Date.now(),
    };

    onAddCustomVoice(newClonedVoice);
    onSelectClonedVoice(newClonedVoice);
    setCloneSuccess(true);

    setTimeout(() => {
      setCloneSuccess(false);
      setActiveTab('my_clones');
    }, 1200);
  };

  // --- Dual-Character Diarization & Voice Separation Handlers ---
  const handleDualFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setDualAudioBlob(file);
      const url = URL.createObjectURL(file);
      setDualAudioUrl(url);
      setDualAudioName(file.name);
      runDualDiarization(file);
    }
  };

  const loadDemoDualAudio = async () => {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioCtx();
    try {
      const duration = 4.0;
      const sampleRate = 24000;
      const buffer = ctx.createBuffer(1, Math.floor(sampleRate * duration), sampleRate);
      const data = buffer.getChannelData(0);
      
      // First 2 seconds: Male pitch fundamental ~125 Hz
      for (let i = 0; i < sampleRate * 2; i++) {
        const t = i / sampleRate;
        data[i] = 0.25 * Math.sin(2 * Math.PI * 125 * t) + 0.1 * Math.sin(2 * Math.PI * 250 * t);
      }
      // Next 2 seconds: Female pitch fundamental ~225 Hz
      for (let i = Math.floor(sampleRate * 2); i < sampleRate * 4; i++) {
        const t = i / sampleRate;
        data[i] = 0.25 * Math.sin(2 * Math.PI * 225 * t) + 0.08 * Math.sin(2 * Math.PI * 450 * t);
      }
      
      const wavBlob = audioBufferToWavBlob(buffer);
      setDualAudioBlob(wavBlob);
      const url = URL.createObjectURL(wavBlob);
      setDualAudioUrl(url);
      setDualAudioName('Pakistani_TV_Ad_Dual_Demo.wav');
      runDualDiarization(wavBlob);
    } finally {
      if (ctx.state !== 'closed') ctx.close();
    }
  };

  const runDualDiarization = async (blob: Blob) => {
    setIsAnalyzingDual(true);
    try {
      const result = await analyzeDualSpeakerAudio(blob);
      setDualAnalysisResult(result);
      setDualMaleName(result.maleSpeakerProfile.name || 'Cloned Male Character');
      setDualFemaleName(result.femaleSpeakerProfile.name || 'Cloned Female Character');
      setEditedDialogueScript(result.formattedDialogueScript);

      // Populate MODE A: Diarized Segments with preserved timestamps
      if (result.segments && result.segments.length > 0) {
        setDubbingSegments(result.segments);
        // Also populate MODE B: Script rows
        setScriptRows(
          result.segments.map((seg, i) => ({
            id: seg.id || `row-${i + 1}`,
            lineIndex: i + 1,
            speaker: seg.apparentGender,
            characterName: seg.speakerName,
            text: seg.originalText,
            sourceText: seg.originalText,
            startTimeMs: seg.startTimeMs,
            endTimeMs: seg.endTimeMs,
          }))
        );
      } else if (result.transcribedDialogue && result.transcribedDialogue.length > 0) {
        const segs: DiarizedSegment[] = result.transcribedDialogue.map((d, i) => ({
          id: `seg-${i + 1}-${Date.now() + i}`,
          lineIndex: i + 1,
          speakerId: d.speaker === 'male' ? 'speaker_1' : 'speaker_2',
          apparentGender: d.speaker,
          speakerName: d.speaker === 'male' ? (result.maleSpeakerProfile?.name || 'Male') : (result.femaleSpeakerProfile?.name || 'Female'),
          startTimeMs: i * 3200,
          endTimeMs: (i + 1) * 3200,
          originalText: d.text,
          translatedText: d.text,
          assignedVoice: d.speaker === 'male' ? VoiceName.Hamza_Pak_Male : VoiceName.Ayesha_Pak_Female,
          confidence: 0.95,
        }));
        setDubbingSegments(segs);
        setScriptRows(
          segs.map((seg, i) => ({
            id: seg.id,
            lineIndex: i + 1,
            speaker: seg.apparentGender,
            characterName: seg.speakerName,
            text: seg.originalText,
            sourceText: seg.originalText,
          }))
        );
      }
    } catch (err) {
      console.error('Dual diarization failed:', err);
    } finally {
      setIsAnalyzingDual(false);
    }
  };

  // --- MODE A: Voice-Preserved Translation (Auto Dubbing) Handlers ---
  const handleTranslateDubSegments = async (targetLang: Language) => {
    if (dubbingSegments.length === 0) return;
    setIsTranslatingDub(true);
    setDubFeedback(null);
    try {
      const translated = await translateDiarizedSegments(dubbingSegments, targetLang);
      setDubbingSegments(translated);
      setTargetDubLanguage(targetLang);
      setDubFeedback(`✨ Successfully translated ${translated.length} segments to ${targetLang}! Original Male & Female identities are strictly preserved.`);
      setTimeout(() => setDubFeedback(null), 6000);
    } catch (err: any) {
      alert(err.message || 'Translation failed');
    } finally {
      setIsTranslatingDub(false);
    }
  };

  const handleUpdateSegmentText = (id: string, text: string) => {
    setDubbingSegments((prev) =>
      prev.map((s) => (s.id === id ? { ...s, translatedText: text } : s))
    );
  };

  const handleOverrideSegmentSpeaker = (id: string, gender: 'male' | 'female') => {
    setDubbingSegments((prev) =>
      prev.map((s) =>
        s.id === id
          ? {
              ...s,
              apparentGender: gender,
              speakerId: gender === 'male' ? 'speaker_1' : 'speaker_2',
              speakerName: gender === 'male' ? dualMaleName : dualFemaleName,
            }
          : s
      )
    );
  };

  const handlePreviewSegment = async (segment: DiarizedSegment) => {
    const textToSpeak = (segment.translatedText || segment.originalText).trim();
    if (!textToSpeak) {
      alert('Dialogue text is empty');
      return;
    }
    setPreviewingSegmentId(segment.id);
    try {
      const customMale = customVoices.find((v) => v.name === dualMaleName || v.gender === 'Male');
      const customFemale = customVoices.find((v) => v.name === dualFemaleName || v.gender === 'Female');
      const blob = await generateSingleDialogueSegment(
        textToSpeak,
        segment.apparentGender,
        dubMaleVoice,
        dubFemaleVoice,
        SpeechStyle.Pakistani_Dhamaka,
        targetDubLanguage,
        1.0,
        'Balanced Commercial',
        customMale,
        customFemale
      );
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => setPreviewingSegmentId(null);
      audio.play();
    } catch (err: any) {
      setPreviewingSegmentId(null);
      alert(err.message || 'Failed to preview line');
    }
  };

  const handleGenerateFullDub = async () => {
    const active = dubbingSegments.filter(
      (s) => (s.translatedText || s.originalText).trim().length > 0
    );
    if (active.length === 0) {
      alert('Please provide dialogue text for at least one segment');
      return;
    }
    setIsGeneratingDub(true);
    setDubProgress('Synthesizing dubbed dialogue segments...');
    setDubAudioUrl(null);
    try {
      const lines: DialogueLine[] = active.map((s) => ({
        speaker: s.apparentGender,
        characterName: s.speakerName,
        text: (s.translatedText || s.originalText).trim(),
      }));

      const customMale = customVoices.find((v) => v.name === dualMaleName || v.gender === 'Male');
      const customFemale = customVoices.find((v) => v.name === dualFemaleName || v.gender === 'Female');

      const masterBlob = await generateDialogueSpeech(
        lines,
        dubMaleVoice,
        dubFemaleVoice,
        SpeechStyle.Pakistani_Dhamaka,
        targetDubLanguage,
        1.0,
        'Balanced Commercial',
        customMale,
        customFemale,
        (curr, tot) =>
          setDubProgress(
            `Dubbing line ${curr} of ${tot} (${lines[curr - 1].speaker === 'male' ? '👨 Male' : '👩 Female'})...`
          )
      );

      const url = URL.createObjectURL(masterBlob);
      setDubAudioUrl(url);
      setDubFeedback('🎉 Multilingual video dub audio track generated successfully!');
    } catch (err: any) {
      alert(err.message || 'Dubbing generation failed');
    } finally {
      setIsGeneratingDub(false);
      setDubProgress(null);
    }
  };

  // --- MODE B: Dual-Character Script (Manual Rows) Handlers ---
  const handleAddRow = (afterIndex?: number) => {
    const nextSpeaker =
      scriptRows.length > 0 && scriptRows[scriptRows.length - 1].speaker === 'female'
        ? 'male'
        : 'female';
    const newRow: ScriptDialogueRow = {
      id: `row-${Date.now()}`,
      lineIndex: afterIndex !== undefined ? afterIndex + 2 : scriptRows.length + 1,
      speaker: nextSpeaker,
      characterName: nextSpeaker === 'male' ? 'Male Character' : 'Female Character',
      text: '',
    };
    if (afterIndex !== undefined) {
      const updated = [...scriptRows];
      updated.splice(afterIndex + 1, 0, newRow);
      setScriptRows(updated.map((r, i) => ({ ...r, lineIndex: i + 1 })));
    } else {
      setScriptRows((prev) => [...prev, newRow].map((r, i) => ({ ...r, lineIndex: i + 1 })));
    }
  };

  const handleDeleteRow = (id: string) => {
    if (scriptRows.length <= 1) {
      alert('You must have at least one dialogue row');
      return;
    }
    setScriptRows((prev) => prev.filter((r) => r.id !== id).map((r, i) => ({ ...r, lineIndex: i + 1 })));
  };

  const handleDuplicateRow = (index: number) => {
    const target = scriptRows[index];
    const dup: ScriptDialogueRow = {
      ...target,
      id: `row-dup-${Date.now()}`,
      lineIndex: index + 2,
    };
    const updated = [...scriptRows];
    updated.splice(index + 1, 0, dup);
    setScriptRows(updated.map((r, i) => ({ ...r, lineIndex: i + 1 })));
  };

  const handleMoveRow = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === scriptRows.length - 1) return;
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    const updated = [...scriptRows];
    const temp = updated[index];
    updated[index] = updated[targetIdx];
    updated[targetIdx] = temp;
    setScriptRows(updated.map((r, i) => ({ ...r, lineIndex: i + 1 })));
  };

  const handleUpdateRowSpeaker = (id: string, speaker: 'male' | 'female') => {
    setScriptRows((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              speaker,
              characterName: speaker === 'male' ? 'Male Character' : 'Female Character',
            }
          : r
      )
    );
  };

  const handleUpdateRowText = (id: string, text: string) => {
    setScriptRows((prev) => prev.map((r) => (r.id === id ? { ...r, text } : r)));
  };

  const handleTranslateScriptRows = async (targetLang: Language) => {
    const active = scriptRows.filter((r) => r.text && r.text.trim().length > 0);
    if (active.length === 0) {
      alert('Please enter dialogue text in at least one row before translating');
      return;
    }
    setIsTranslatingScriptRows(true);
    setScriptFeedback(null);
    try {
      const translated = await translateScriptDialogueRows(scriptRows, targetLang);
      setScriptRows(translated);
      setTargetScriptLanguage(targetLang);
      setScriptFeedback(
        `✨ Translated dialogue rows into ${targetLang}! Each row's assigned speaker is strictly preserved.`
      );
      setTimeout(() => setScriptFeedback(null), 6000);
    } catch (err: any) {
      alert(err.message || 'Translation failed');
    } finally {
      setIsTranslatingScriptRows(false);
    }
  };

  const handlePreviewRow = async (row: ScriptDialogueRow) => {
    const text = (row.text || '').trim();
    if (!text) {
      alert('Please enter text for this line first');
      return;
    }
    setPreviewingRowId(row.id);
    try {
      const customMale = customVoices.find((v) => v.name === dualMaleName || v.gender === 'Male');
      const customFemale = customVoices.find((v) => v.name === dualFemaleName || v.gender === 'Female');
      const blob = await generateSingleDialogueSegment(
        text,
        row.speaker,
        modeBMaleVoice,
        modeBFemaleVoice,
        SpeechStyle.Pakistani_Dhamaka,
        targetScriptLanguage,
        1.0,
        'Balanced Commercial',
        customMale,
        customFemale
      );
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => setPreviewingRowId(null);
      audio.play();
    } catch (err: any) {
      setPreviewingRowId(null);
      alert(err.message || 'Failed to preview line');
    }
  };

  const handleGenerateFullScriptAudio = async () => {
    const active = scriptRows.filter((r) => r.text && r.text.trim().length > 0);
    if (active.length === 0) {
      alert('Please enter dialogue text for at least one row');
      return;
    }
    setIsGeneratingScriptAudio(true);
    setScriptProgress('Synthesizing all dialogue rows...');
    setScriptAudioUrl(null);
    try {
      const lines: DialogueLine[] = active.map((r) => ({
        speaker: r.speaker,
        characterName: r.speaker === 'male' ? 'Male' : 'Female',
        text: r.text.trim(),
      }));

      const customMale = customVoices.find((v) => v.name === dualMaleName || v.gender === 'Male');
      const customFemale = customVoices.find((v) => v.name === dualFemaleName || v.gender === 'Female');

      const masterBlob = await generateDialogueSpeech(
        lines,
        modeBMaleVoice,
        modeBFemaleVoice,
        SpeechStyle.Pakistani_Dhamaka,
        targetScriptLanguage,
        1.0,
        'Balanced Commercial',
        customMale,
        customFemale,
        (curr, tot) =>
          setScriptProgress(
            `Synthesizing row ${curr} of ${tot} (${lines[curr - 1].speaker === 'male' ? '👨 Male' : '👩 Female'})...`
          )
      );

      const url = URL.createObjectURL(masterBlob);
      setScriptAudioUrl(url);
      setScriptFeedback('🎉 Dual-character dialogue audio synthesized successfully!');
    } catch (err: any) {
      alert(err.message || 'Audio synthesis failed');
    } finally {
      setIsGeneratingScriptAudio(false);
      setScriptProgress(null);
    }
  };

  const handleSendRowsToStudio = () => {
    const formatted = formatRowsIntoScript(scriptRows);
    if (onLoadDualClonesAndDialogue) {
      const existingMale = customVoices.find((v) => v.name === dualMaleName || v.gender === 'Male');
      const existingFemale = customVoices.find((v) => v.name === dualFemaleName || v.gender === 'Female');

      const finalMale: CustomClonedVoice = existingMale || {
        id: `clone-male-${Date.now()}`,
        name: dualMaleName || 'Cloned Male Voice',
        gender: 'Male',
        accent: 'Commercial Voiceover',
        cadence: 'Commercial',
        exactDeliveryStyle: 'Urgent Promo',
        baseVoice: 'Fenrir',
        createdAt: Date.now(),
      };
      const finalFemale: CustomClonedVoice = existingFemale || {
        id: `clone-female-${Date.now()}`,
        name: dualFemaleName || 'Cloned Female Voice',
        gender: 'Female',
        accent: 'Commercial Voiceover',
        cadence: 'Commercial',
        exactDeliveryStyle: 'Fashion & Lawn',
        baseVoice: 'Zephyr',
        createdAt: Date.now(),
      };
      onLoadDualClonesAndDialogue(finalMale, finalFemale, formatted);
    }
  };

  const togglePlayDual = () => {
    if (!dualAudioRef.current) return;
    if (isPlayingDual) {
      dualAudioRef.current.pause();
      setIsPlayingDual(false);
    } else {
      dualAudioRef.current.play();
      setIsPlayingDual(true);
    }
  };

  const handleSaveDualClones = () => {
    if (!dualAnalysisResult) return;

    const maleVoice: CustomClonedVoice = {
      id: `clone-male-${Date.now()}`,
      name: dualMaleName.trim() || 'Cloned Male Character',
      gender: 'Male',
      recordedSampleBlobUrl: dualAudioUrl || undefined,
      audioDurationSeconds: 15,
      sampleFileName: dualAudioName || 'Dual Audio',
      estimatedPitchHz: dualAnalysisResult.maleSpeakerProfile.estimatedPitchHz,
      pitchCategory: dualAnalysisResult.maleSpeakerProfile.pitchCategory,
      vocalTexture: dualAnalysisResult.maleSpeakerProfile.vocalTexture,
      timbreDescription: dualAnalysisResult.maleSpeakerProfile.vocalTexture,
      accent: dualAnalysisResult.maleSpeakerProfile.accent,
      cadence: dualAnalysisResult.maleSpeakerProfile.cadence,
      exactDeliveryStyle: dualAnalysisResult.maleSpeakerProfile.exactDeliveryStyle,
      baseVoice: dualAnalysisResult.maleSpeakerProfile.baseVoice,
      createdAt: Date.now(),
    };

    const femaleVoice: CustomClonedVoice = {
      id: `clone-female-${Date.now() + 1}`,
      name: dualFemaleName.trim() || 'Cloned Female Character',
      gender: 'Female',
      recordedSampleBlobUrl: dualAudioUrl || undefined,
      audioDurationSeconds: 15,
      sampleFileName: dualAudioName || 'Dual Audio',
      estimatedPitchHz: dualAnalysisResult.femaleSpeakerProfile.estimatedPitchHz,
      pitchCategory: dualAnalysisResult.femaleSpeakerProfile.pitchCategory,
      vocalTexture: dualAnalysisResult.femaleSpeakerProfile.vocalTexture,
      timbreDescription: dualAnalysisResult.femaleSpeakerProfile.vocalTexture,
      accent: dualAnalysisResult.femaleSpeakerProfile.accent,
      cadence: dualAnalysisResult.femaleSpeakerProfile.cadence,
      exactDeliveryStyle: dualAnalysisResult.femaleSpeakerProfile.exactDeliveryStyle,
      baseVoice: dualAnalysisResult.femaleSpeakerProfile.baseVoice,
      createdAt: Date.now() + 1,
    };

    onAddCustomVoice(maleVoice);
    onAddCustomVoice(femaleVoice);
    setDualCloneSuccess(true);

    if (onLoadDualClonesAndDialogue) {
      setTimeout(() => {
        setDualCloneSuccess(false);
        onLoadDualClonesAndDialogue(maleVoice, femaleVoice, editedDialogueScript);
      }, 1000);
    } else {
      setTimeout(() => {
        setDualCloneSuccess(false);
        setActiveTab('my_clones');
      }, 1000);
    }
  };

  // Premade voices from catalog
  const premadeVoices = VOICE_CATALOG.filter((v) => v.category === 'pakistani_ad').filter((v) => {
    if (premadeGenderFilter === 'all') return true;
    return v.gender === premadeGenderFilter;
  });

  return (
    <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-4 sm:p-6 shadow-xl backdrop-blur-md">
      
      {/* Studio Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-900/30">
              <AudioWaveform size={20} />
            </span>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                Voice Clone Lab
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Exact Voice & Style Mimicry
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Provide an audio sample to clone the exact voice, delivery style, and vocal timbre without robotic artifacts.
              </p>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center p-1 bg-slate-950/80 rounded-xl border border-slate-800 text-xs font-medium w-full sm:w-auto overflow-x-auto custom-scrollbar">
          <button
            onClick={() => setActiveTab('create')}
            className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
              activeTab === 'create'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            🎙️ Solo Voice Clone
          </button>
          <button
            onClick={() => setActiveTab('dual_clone')}
            className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg whitespace-nowrap transition-all relative flex items-center justify-center gap-1.5 ${
              activeTab === 'dual_clone'
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users size={13} />
            <span>Dual Diarize & Clone (Male + Female)</span>
            <span className="text-[9px] bg-pink-500/30 text-pink-300 px-1.5 py-0.2 rounded-full font-bold border border-pink-500/40">
              2-in-1
            </span>
          </button>
          <button
            onClick={() => setActiveTab('premade')}
            className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
              activeTab === 'premade'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            🇵🇰 Studio Models ({VOICE_CATALOG.filter(v => v.category === 'pakistani_ad').length})
          </button>
          <button
            onClick={() => setActiveTab('my_clones')}
            className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg whitespace-nowrap transition-all relative ${
              activeTab === 'my_clones'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            🧬 My Clones
            {customVoices.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.2 rounded-full bg-purple-500 text-[10px] text-white">
                {customVoices.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* TAB 1: CREATE NEW CLONE */}
      {activeTab === 'create' && (
        <div className="space-y-6">
          {/* Workflow Mode Selector */}
          <div className="p-2 bg-slate-950/90 rounded-2xl border border-slate-800 flex flex-wrap items-center justify-between gap-2 shadow-lg">
            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setDubbingSubMode('standard_solo')}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  dubbingSubMode === 'standard_solo'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white bg-slate-900/50'
                }`}
              >
                <Mic size={14} />
                <span>🎙️ Solo Voice Clone</span>
              </button>
              <button
                type="button"
                onClick={() => setDubbingSubMode('mode_a_dubbing')}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  dubbingSubMode === 'mode_a_dubbing'
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white bg-slate-900/50'
                }`}
              >
                <Globe size={14} className="text-purple-300" />
                <span>MODE A: Voice-Preserved Translation</span>
                <span className="text-[10px] bg-purple-400/20 text-purple-200 px-1.5 py-0.2 rounded-full border border-purple-400/30 font-bold">
                  Auto Dubbing
                </span>
              </button>
              <button
                type="button"
                onClick={() => setDubbingSubMode('mode_b_script')}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  dubbingSubMode === 'mode_b_script'
                    ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white bg-slate-900/50'
                }`}
              >
                <ListFilter size={14} className="text-pink-300" />
                <span>MODE B: Dual-Character Script</span>
                <span className="text-[10px] bg-pink-400/20 text-pink-200 px-1.5 py-0.2 rounded-full border border-pink-400/30 font-bold">
                  Manual Control
                </span>
              </button>
            </div>

            <div className="text-[11px] text-slate-400 px-2 hidden lg:flex items-center gap-1.5">
              <Lock size={12} className="text-emerald-400" />
              <span>Voice Identity Lock: Active across Punjabi, Hindi, Urdu & Telugu</span>
            </div>
          </div>

          {/* SUB-MODE 1: STANDARD SOLO VOICE CLONE */}
          {dubbingSubMode === 'standard_solo' && (
            <div className="space-y-6 animate-in fade-in">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Left Column: Live Mic Recorder */}
            <div className="bg-slate-950/60 p-5 rounded-xl border border-slate-800/80 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${isRecording ? 'bg-red-500 animate-ping' : 'bg-slate-600'}`} />
                    <h3 className="font-semibold text-sm text-slate-200">1. Speak or Record Voice Sample</h3>
                  </div>
                  <span className="text-xs font-mono text-slate-400">
                    {recordingSeconds > 0 ? `00:${recordingSeconds.toString().padStart(2, '0')}` : 'Max 25s'}
                  </span>
                </div>

                <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                  Record 5–20 seconds speaking in the exact tone you want cloned (e.g. enthusiastic sales promo, warm tea ad, or soft whisper).
                </p>

                {/* Visualizer canvas */}
                <div className="h-20 w-full bg-slate-900/90 rounded-xl border border-slate-800 flex items-center justify-center overflow-hidden relative mb-4">
                  <canvas ref={canvasRef} width={280} height={80} className="w-full h-full" />
                  {!isRecording && !recordedBlob && (
                    <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-500">
                      Mic standby - Click record to capture voice
                    </div>
                  )}
                  {isRecording && (
                    <div className="absolute top-2 right-2 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-500/20 border border-red-500/30 text-[10px] text-red-300 font-mono">
                      REC {recordingSeconds}s
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                {!isRecording ? (
                  <button
                    onClick={handleStartRecording}
                    className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-lg shadow-red-900/30 active:scale-98 transition-all"
                  >
                    <Mic size={18} />
                    Start Mic Recording
                  </button>
                ) : (
                  <button
                    onClick={handleStopRecording}
                    className="flex-1 py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-900/30 active:scale-98 transition-all animate-pulse"
                  >
                    <Square size={18} />
                    Stop Recording ({25 - recordingSeconds}s remaining)
                  </button>
                )}
              </div>
            </div>

            {/* Right Column: Upload Audio File */}
            <div className="bg-slate-950/60 p-5 rounded-xl border border-slate-800/80 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Upload size={16} className="text-indigo-400" />
                    <h3 className="font-semibold text-sm text-slate-200">Or Upload Audio File (.wav, .mp3, .m4a)</h3>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">Any Format</span>
                </div>
                <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                  Upload an audio clip of yourself, an actor, a WhatsApp voice note, or an existing commercial voiceover.
                </p>

                <label className="flex flex-col items-center justify-center h-28 border-2 border-dashed border-slate-700 hover:border-indigo-500/60 rounded-xl cursor-pointer bg-slate-900/40 hover:bg-slate-900/80 transition-all p-4 group">
                  <Upload size={22} className="text-slate-500 group-hover:text-indigo-400 mb-2 transition-transform group-hover:-translate-y-0.5" />
                  <span className="text-xs font-medium text-slate-300 group-hover:text-indigo-300">
                    Tap to upload or drop reference audio
                  </span>
                  <span className="text-[10px] text-slate-500 mt-1">Recommended 5 – 45 seconds</span>
                  <input
                    type="file"
                    accept="audio/*,.wav,.mp3,.m4a,.ogg"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {recordedBlobUrl && (
                <div className="mt-3 p-3 bg-indigo-950/30 border border-indigo-500/30 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <button
                      onClick={togglePlayRecorded}
                      className="w-9 h-9 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center flex-shrink-0 shadow"
                    >
                      {isPlayingRecorded ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
                    </button>
                    <div className="overflow-hidden">
                      <span className="text-xs font-semibold text-indigo-200 block truncate">
                        {cloneName || 'Sample Audio'}
                      </span>
                      <span className="text-[10px] text-indigo-400/90 font-mono">
                        {analyzedData?.durationSeconds ? `${analyzedData.durationSeconds}s reference clip loaded` : 'Loaded'}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded font-mono border border-emerald-500/20">
                    Ready to Clone
                  </span>
                  <audio
                    ref={previewAudioRef}
                    src={recordedBlobUrl}
                    onEnded={() => setIsPlayingRecorded(false)}
                    className="hidden"
                  />
                </div>
              )}
            </div>

          </div>

          {/* Analysis & Voice Profile Configuration */}
          {recordedBlob && (
            <div className="bg-slate-950 p-5 rounded-xl border border-indigo-500/40 space-y-5 animate-in fade-in slide-in-from-bottom-2">
              
              {/* Header Analysis Results */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-4 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Sparkles size={18} className="text-indigo-400" />
                  <h3 className="font-bold text-sm text-white">2. Exact Vocal Blueprint & Style Match</h3>
                </div>
                {isAnalyzing ? (
                  <span className="text-xs text-indigo-400 animate-pulse flex items-center gap-1.5">
                    <RefreshCw size={12} className="animate-spin" /> Analyzing acoustic frequency and cadence...
                  </span>
                ) : analyzedData ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono border border-cyan-500/30">
                      Pitch: {analyzedData.estimatedPitchHz} Hz ({analyzedData.pitchCategory})
                    </span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono border border-emerald-500/30">
                      Base Model: {analyzedData.suggestedBaseVoice}
                    </span>
                  </div>
                ) : null}
              </div>

              {/* Form Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                
                {/* Voice Name */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Cloned Voice Name / Label *
                  </label>
                  <input
                    type="text"
                    value={cloneName}
                    onChange={(e) => setCloneName(e.target.value)}
                    placeholder="e.g. Hamza Commercial Promo"
                    className="w-full bg-slate-900 border border-slate-700 focus:border-indigo-500 rounded-lg px-3 py-2 text-sm text-white outline-none"
                  />
                </div>

                {/* Gender */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Speaker Gender *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setCloneGender('Male')}
                      className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-all ${
                        cloneGender === 'Male'
                          ? 'bg-blue-600 border-blue-500 text-white shadow'
                          : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                      }`}
                    >
                      👨 Male Speaker
                    </button>
                    <button
                      type="button"
                      onClick={() => setCloneGender('Female')}
                      className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-all ${
                        cloneGender === 'Female'
                          ? 'bg-pink-600 border-pink-500 text-white shadow'
                          : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                      }`}
                    >
                      👩 Female Speaker
                    </button>
                  </div>
                </div>

                {/* Dialect / Accent */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Accent & Dialect
                  </label>
                  <select
                    value={cloneAccent}
                    onChange={(e) => setCloneAccent(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 focus:border-indigo-500 rounded-lg px-3 py-2 text-sm text-white outline-none"
                  >
                    <option value="Pakistani Standard Urdu">🇵🇰 Pakistani Standard Urdu</option>
                    <option value="Karachi Urban Youth (RJ)">🇵🇰 Karachi Urban (RJ / Tech)</option>
                    <option value="Lahore Urgency (Dhamaka Sale)">🇵🇰 Lahore Urgency (Dhamaka Sale)</option>
                    <option value="Islamabad Corporate">🇵🇰 Islamabad Corporate Baritone</option>
                    <option value="Pakistani English (Bilingual)">🇵🇰 Pakistani English (Bilingual Code-Switching)</option>
                    <option value="Standard Hindi (Commercial)">🇮🇳 Standard Hindi (Commercial)</option>
                  </select>
                </div>

                {/* Exact Delivery Style */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Exact Delivery Style in Sample *
                  </label>
                  <select
                    value={cloneDeliveryStyle}
                    onChange={(e) => setCloneDeliveryStyle(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 focus:border-indigo-500 rounded-lg px-3 py-2 text-sm text-white outline-none"
                  >
                    <option value="High-Impact TV Commercial Promo (Dhamaka Sale)">
                      💥 High-Impact TV Commercial Promo (Urgent sales punch, dramatic pauses, excitement)
                    </option>
                    <option value="Warm Chai & Family FMCG Advertisement">
                      ☕ Warm Chai & Family FMCG (Emotional, nostalgic, deeply affectionate household tone)
                    </option>
                    <option value="Soft Luxury Beauty & Lawn Fashion Whispers">
                      💄 Soft Luxury Beauty & Lawn Fashion (Silky, velvety, breathy, aspirational elegance)
                    </option>
                    <option value="Luxury Real Estate & Corporate Baritone">
                      🏙️ Luxury Real Estate & Corporate Baritone (Grand, deep chest resonance, authoritative)
                    </option>
                    <option value="Upbeat Food Delivery & Radio RJ Banter">
                      🍕 Upbeat Food Delivery & Radio RJ (Fast-paced, youthful, smiling, contagious energy)
                    </option>
                    <option value="Natural Human Conversational Narrative">
                      🎙️ Natural Human Conversational (Authentic casual tone, zero AI or robotic cadence)
                    </option>
                    <option value="Soulful Ramadan & Eid Festive Greetings">
                      🌙 Soulful Ramadan & Eid Greetings (Respectful, serene, spiritually blessed warmth)
                    </option>
                  </select>
                </div>

                {/* Vocal Texture */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Vocal Texture & Tone
                  </label>
                  <select
                    value={cloneVocalTexture}
                    onChange={(e) => setCloneVocalTexture(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 focus:border-indigo-500 rounded-lg px-3 py-2 text-sm text-white outline-none"
                  >
                    <option value="Warm & Resonant">Warm & Resonant (Full-bodied)</option>
                    <option value="Silky, Soft & Airy">Silky, Soft & Airy (Whispery beauty)</option>
                    <option value="Deep Chest Resonance">Deep Chest Resonance (Commanding)</option>
                    <option value="Punchy & Projected">Punchy & Projected (Commercial power)</option>
                    <option value="Bright & Vibrant">Bright & Vibrant (Upbeat radio)</option>
                    <option value="Crisp & Articulate">Crisp & Articulate (Executive clarity)</option>
                  </select>
                </div>

              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-800">
                <span className="text-xs text-slate-400">
                  This voice will be synthesized using Gemini 3.8 Flash Voice Design with human breathing tags.
                </span>

                <button
                  onClick={handleSaveClone}
                  disabled={!cloneName.trim() || isAnalyzing}
                  className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white font-bold text-sm shadow-xl shadow-emerald-950/50 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                >
                  {cloneSuccess ? (
                    <>
                      <CheckCircle2 size={18} />
                      Voice Cloned & Activated in Studio!
                    </>
                  ) : (
                    <>
                      <Sparkles size={18} />
                      Clone & Use This Exact Voice
                    </>
                  )}
                </button>
              </div>

            </div>
          )}

          {/* Close subMode === 'standard_solo' */}
          </div>
          )}

          {/* SUB-MODE 2: MODE A: VOICE-PRESERVED TRANSLATION (AUTO DUBBING) */}
          {dubbingSubMode === 'mode_a_dubbing' && (
            <div className="space-y-6 animate-in fade-in">
              {/* Hero Banner */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-950/70 via-indigo-950/50 to-slate-950 border border-purple-500/40 shadow-xl">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white flex-shrink-0 shadow-md">
                      <Globe size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-white flex items-center gap-2">
                        Mode A: Voice-Preserved Translation (Automatic Dubbing)
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          Zero Voice Swapping
                        </span>
                      </h3>
                      <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                        Converts existing video/audio commercials and YouTube content into target languages (Telugu, Urdu, Hindi, Punjabi, etc.) while preserving the exact speaker identities, timestamps, and conversational order.
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={loadDemoDualAudio}
                    disabled={isAnalyzingDual}
                    className="px-3.5 py-2 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-500/40 text-xs font-semibold flex items-center gap-1.5 transition-all flex-shrink-0"
                  >
                    <Music2 size={14} />
                    <span>Load Demo Ad Audio</span>
                  </button>
                </div>
              </div>

              {/* Step 1 & 2: Audio Upload & Diarization */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
                  <div>
                    <h4 className="font-semibold text-xs text-slate-200 mb-1 flex items-center gap-2">
                      <Upload size={14} className="text-purple-400" />
                      1. Upload Audio or Video Reference
                    </h4>
                    <p className="text-[11px] text-slate-400 mb-3">
                      Upload audio file with multiple speakers talking. Diarization will segment each speaker turn.
                    </p>
                    <label className="border-2 border-dashed border-purple-500/30 hover:border-purple-400/60 bg-purple-950/10 hover:bg-purple-950/20 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer transition-all text-center">
                      <Upload size={20} className="text-purple-400 mb-1" />
                      <span className="text-xs font-semibold text-slate-200">
                        {dualAudioName || 'Choose file (.mp3, .wav, .m4a, .ogg)'}
                      </span>
                      <input
                        type="file"
                        accept="audio/*,.wav,.mp3,.m4a,.ogg"
                        onChange={handleDualFileUpload}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {dualAudioUrl && (
                    <div className="mt-3 p-2.5 bg-purple-950/40 border border-purple-500/30 rounded-lg flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={togglePlayDual}
                          className="w-7 h-7 rounded-full bg-purple-600 hover:bg-purple-500 text-white flex items-center justify-center"
                        >
                          {isPlayingDual ? <Pause size={12} /> : <Play size={12} className="ml-0.5" />}
                        </button>
                        <span className="text-xs text-purple-200 font-mono truncate max-w-[200px]">
                          {dualAudioName || 'Reference Audio'}
                        </span>
                      </div>
                      <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded font-mono">
                        Diarized
                      </span>
                    </div>
                  )}
                </div>

                {/* Target Language & Voice Casting */}
                <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-3">
                  <h4 className="font-semibold text-xs text-slate-200 flex items-center gap-2">
                    <Globe size={14} className="text-indigo-400" />
                    2. Target Dubbing Language & Cast
                  </h4>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Target Language for Video Dubbing
                    </label>
                    <select
                      value={targetDubLanguage}
                      onChange={(e) => setTargetDubLanguage(e.target.value as Language)}
                      className="w-full bg-slate-900 border border-slate-700 focus:border-indigo-500 rounded-lg p-2 text-xs text-white font-medium outline-none"
                    >
                      {Object.values(Language).map((lang) => (
                        <option key={lang} value={lang}>
                          {lang}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-lg bg-blue-950/30 border border-blue-900/50">
                      <span className="text-[11px] font-bold text-blue-300 block">👨 Male Speaker Voice</span>
                      <select
                        value={dubMaleVoice}
                        onChange={(e) => setDubMaleVoice(e.target.value as VoiceName)}
                        className="w-full bg-slate-900 border border-slate-700 text-[11px] text-white rounded p-1 mt-1 outline-none"
                      >
                        {VOICE_CATALOG.filter((v) => v.gender === 'Male').map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="p-2.5 rounded-lg bg-pink-950/30 border border-pink-900/50">
                      <span className="text-[11px] font-bold text-pink-300 block">👩 Female Speaker Voice</span>
                      <select
                        value={dubFemaleVoice}
                        onChange={(e) => setDubFemaleVoice(e.target.value as VoiceName)}
                        className="w-full bg-slate-900 border border-slate-700 text-[11px] text-white rounded p-1 mt-1 outline-none"
                      >
                        {VOICE_CATALOG.filter((v) => v.gender === 'Female').map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <button
                    onClick={() => handleTranslateDubSegments(targetDubLanguage)}
                    disabled={isTranslatingDub || dubbingSegments.length === 0}
                    className="w-full py-2.5 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all disabled:opacity-50"
                  >
                    {isTranslatingDub ? (
                      <>
                        <RefreshCw size={13} className="animate-spin" />
                        <span>Translating Segments to {targetDubLanguage}...</span>
                      </>
                    ) : (
                      <>
                        <Languages size={13} />
                        <span>Translate Segments to {targetDubLanguage} (Preserve Voices)</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Feedback toast */}
              {dubFeedback && (
                <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-xl text-xs text-emerald-200 flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-400 flex-shrink-0" />
                  <span>{dubFeedback}</span>
                </div>
              )}

              {/* Step 3: Translation Review Table */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <FileCheck2 size={16} className="text-purple-400" />
                    <h4 className="font-bold text-xs text-white">
                      3. Translation Review Stage (Editable Table)
                    </h4>
                  </div>
                  <span className="text-[10px] text-slate-400">
                    Verify each dialogue line, speaker gender, and translated wording before synthesis
                  </span>
                </div>

                {dubbingSegments.length === 0 ? (
                  <div className="py-8 text-center text-slate-500 text-xs">
                    No segments diarized yet. Upload an audio recording or click "Load Demo Ad Audio" above.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400 text-[11px]">
                          <th className="py-2 px-2.5 font-semibold">#</th>
                          <th className="py-2 px-2.5 font-semibold">Time</th>
                          <th className="py-2 px-2.5 font-semibold">Original Dialogue</th>
                          <th className="py-2 px-2.5 font-semibold">Speaker (Gender)</th>
                          <th className="py-2 px-2.5 font-semibold">Target Translation ({targetDubLanguage})</th>
                          <th className="py-2 px-2.5 font-semibold text-center">Preview</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-sans">
                        {dubbingSegments.map((seg, idx) => (
                          <tr key={seg.id} className="hover:bg-slate-900/50 transition-colors">
                            <td className="py-2.5 px-2.5 font-mono text-slate-500">{idx + 1}</td>
                            <td className="py-2.5 px-2.5 font-mono text-[10px] text-slate-400 whitespace-nowrap">
                              {(seg.startTimeMs / 1000).toFixed(1)}s - {(seg.endTimeMs / 1000).toFixed(1)}s
                            </td>
                            <td className="py-2.5 px-2.5 text-slate-300 max-w-[200px] truncate" title={seg.originalText}>
                              {seg.originalText}
                            </td>
                            <td className="py-2.5 px-2.5 whitespace-nowrap">
                              <select
                                value={seg.apparentGender}
                                onChange={(e) =>
                                  handleOverrideSegmentSpeaker(seg.id, e.target.value as 'male' | 'female')
                                }
                                className={`text-[11px] rounded px-2 py-1 outline-none font-bold ${
                                  seg.apparentGender === 'male'
                                    ? 'bg-blue-950 text-blue-300 border border-blue-800'
                                    : 'bg-pink-950 text-pink-300 border border-pink-800'
                                }`}
                              >
                                <option value="male">👨 Male</option>
                                <option value="female">👩 Female</option>
                              </select>
                            </td>
                            <td className="py-2.5 px-2.5 min-w-[220px]">
                              <input
                                type="text"
                                value={seg.translatedText || ''}
                                onChange={(e) => handleUpdateSegmentText(seg.id, e.target.value)}
                                placeholder="Enter or edit translation..."
                                className="w-full bg-slate-900 border border-slate-700 focus:border-purple-500 rounded px-2.5 py-1 text-xs text-white outline-none"
                              />
                            </td>
                            <td className="py-2.5 px-2.5 text-center whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => handlePreviewSegment(seg)}
                                disabled={previewingSegmentId === seg.id}
                                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] flex items-center gap-1 mx-auto"
                                title="Synthesize preview of this line"
                              >
                                {previewingSegmentId === seg.id ? (
                                  <RefreshCw size={11} className="animate-spin text-purple-400" />
                                ) : (
                                  <Volume2 size={11} className="text-purple-400" />
                                )}
                                <span>Preview</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Final Assemble Button */}
                {dubbingSegments.length > 0 && (
                  <div className="pt-3 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <span className="text-xs text-slate-400">
                      {dubProgress || `${dubbingSegments.length} dialogue segments ready for chronological dub assembly.`}
                    </span>

                    <button
                      type="button"
                      onClick={handleGenerateFullDub}
                      disabled={isGeneratingDub}
                      className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                    >
                      {isGeneratingDub ? (
                        <>
                          <RefreshCw size={15} className="animate-spin" />
                          <span>{dubProgress || 'Generating Dub Track...'}</span>
                        </>
                      ) : (
                        <>
                          <Sparkles size={15} />
                          <span>🎬 Dub & Assemble Full Master Audio Track</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* Master Dubbed Audio Output */}
              {dubAudioUrl && (
                <div className="p-4 rounded-xl bg-purple-950/30 border border-purple-500/40 flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in">
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="w-10 h-10 rounded-full bg-purple-600 text-white flex items-center justify-center flex-shrink-0 shadow">
                      <Volume2 size={20} />
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-purple-100">
                        Final Multilingual Dub Audio Track ({targetDubLanguage})
                      </h4>
                      <p className="text-[11px] text-purple-300/80">
                        Synchronized chronological audio with male and female voices locked.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <audio controls src={dubAudioUrl} className="h-8 w-full sm:w-48" />
                    <a
                      href={dubAudioUrl}
                      download={`Dubbed_${targetDubLanguage.replace(/[^a-zA-Z0-9]/g, '_')}_Audio.wav`}
                      className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5 flex-shrink-0"
                    >
                      <Download size={13} />
                      <span>Download</span>
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SUB-MODE 3: MODE B: DUAL-CHARACTER SCRIPT (MANUAL SPEAKER CONTROL) */}
          {dubbingSubMode === 'mode_b_script' && (
            <div className="space-y-6 animate-in fade-in">
              {/* Hero Banner */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-pink-950/70 via-purple-950/50 to-slate-950 border border-pink-500/40 shadow-xl">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center text-white flex-shrink-0 shadow-md">
                      <ListFilter size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-white flex items-center gap-2">
                        Mode B: Dual-Character Script (Manual Speaker Control)
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 border border-pink-500/30">
                          Dynamic Rows
                        </span>
                      </h3>
                      <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                        Control exactly who speaks each line with a dynamic list of dialogue rows. Add, delete, duplicate, or reorder lines, and translate into Telugu, Hindi, or Urdu without ever touching speaker assignments.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => handleAddRow()}
                      className="px-3.5 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md transition-all"
                    >
                      <Plus size={14} />
                      <span>Add Dialogue Line</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Character Voice Casting Bar */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-blue-300 mb-1">
                    👨 Character 1 (Male Voice)
                  </label>
                  <select
                    value={modeBMaleVoice}
                    onChange={(e) => setModeBMaleVoice(e.target.value as VoiceName)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white outline-none"
                  >
                    {VOICE_CATALOG.filter((v) => v.gender === 'Male').map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-pink-300 mb-1">
                    👩 Character 2 (Female Voice)
                  </label>
                  <select
                    value={modeBFemaleVoice}
                    onChange={(e) => setModeBFemaleVoice(e.target.value as VoiceName)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white outline-none"
                  >
                    {VOICE_CATALOG.filter((v) => v.gender === 'Female').map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-indigo-300 mb-1">
                    🌐 Script Language
                  </label>
                  <select
                    value={targetScriptLanguage}
                    onChange={(e) => setTargetScriptLanguage(e.target.value as Language)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white outline-none"
                  >
                    {Object.values(Language).map((lang) => (
                      <option key={lang} value={lang}>
                        {lang}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Feedback toast */}
              {scriptFeedback && (
                <div className="p-3 bg-pink-950/40 border border-pink-500/40 rounded-xl text-xs text-pink-200 flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-pink-400 flex-shrink-0" />
                  <span>{scriptFeedback}</span>
                </div>
              )}

              {/* Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-slate-950 rounded-xl border border-slate-800 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 font-mono text-[11px]">
                    Total Lines: {scriptRows.length} (
                    {scriptRows.filter((r) => r.speaker === 'male').length} Male •{' '}
                    {scriptRows.filter((r) => r.speaker === 'female').length} Female)
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleTranslateScriptRows(targetScriptLanguage)}
                    disabled={isTranslatingScriptRows}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/40 text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-50"
                  >
                    {isTranslatingScriptRows ? (
                      <RefreshCw size={12} className="animate-spin" />
                    ) : (
                      <Languages size={12} />
                    )}
                    <span>Translate Script to {targetScriptLanguage}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAddRow()}
                    className="px-3 py-1.5 rounded-lg bg-slate-850 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1"
                  >
                    <Plus size={12} />
                    <span>Insert Line</span>
                  </button>
                </div>
              </div>

              {/* Dynamic Dialogue Rows List */}
              <div className="space-y-2.5">
                {scriptRows.map((row, idx) => (
                  <div
                    key={row.id}
                    className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 hover:border-slate-700 flex flex-col sm:flex-row items-start sm:items-center gap-2.5 transition-all"
                  >
                    {/* Row Line # and Speaker Selector */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="w-6 h-6 rounded-full bg-slate-850 text-slate-300 flex items-center justify-center font-mono text-xs font-bold border border-slate-700">
                        {idx + 1}
                      </span>
                      <select
                        value={row.speaker}
                        onChange={(e) =>
                          handleUpdateRowSpeaker(row.id, e.target.value as 'male' | 'female')
                        }
                        className={`text-xs rounded-lg px-2.5 py-1.5 outline-none font-bold border ${
                          row.speaker === 'male'
                            ? 'bg-blue-950 text-blue-300 border-blue-800'
                            : 'bg-pink-950 text-pink-300 border-pink-800'
                        }`}
                      >
                        <option value="female">👩 Female (Speaker 2)</option>
                        <option value="male">👨 Male (Speaker 1)</option>
                      </select>
                    </div>

                    {/* Dialogue Text input */}
                    <div className="flex-1 w-full">
                      <input
                        type="text"
                        value={row.text}
                        onChange={(e) => handleUpdateRowText(row.id, e.target.value)}
                        placeholder={`Line ${idx + 1}: Enter ${row.speaker === 'male' ? 'male' : 'female'} dialogue...`}
                        className="w-full bg-slate-900 border border-slate-700/80 focus:border-pink-500 rounded-lg px-3 py-1.5 text-xs text-white outline-none"
                      />
                      {row.sourceText && row.targetText && row.sourceText !== row.targetText && (
                        <span className="text-[10px] text-slate-500 block mt-0.5 truncate font-mono">
                          Original: {row.sourceText}
                        </span>
                      )}
                    </div>

                    {/* Actions: Preview, Add Below, Duplicate, Move Up, Move Down, Delete */}
                    <div className="flex items-center gap-1 flex-shrink-0 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => handlePreviewRow(row)}
                        disabled={previewingRowId === row.id}
                        className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
                        title="Preview this line"
                      >
                        {previewingRowId === row.id ? (
                          <RefreshCw size={13} className="animate-spin text-indigo-400" />
                        ) : (
                          <Volume2 size={13} />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddRow(idx)}
                        className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-emerald-400"
                        title="Add line below"
                      >
                        <Plus size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDuplicateRow(idx)}
                        className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-indigo-400"
                        title="Duplicate line"
                      >
                        <Copy size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveRow(idx, 'up')}
                        disabled={idx === 0}
                        className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white disabled:opacity-20"
                        title="Move Up"
                      >
                        <ArrowUp size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveRow(idx, 'down')}
                        disabled={idx === scriptRows.length - 1}
                        className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white disabled:opacity-20"
                        title="Move Down"
                      >
                        <ArrowDown size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteRow(row.id)}
                        disabled={scriptRows.length <= 1}
                        className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-rose-400 disabled:opacity-20"
                        title="Delete line"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Master Generate & Transfer Controls */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                <span className="text-xs text-slate-400">
                  {scriptProgress ||
                    `${scriptRows.length} lines configured. Generate full continuous dialogue or export to Studio.`}
                </span>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={handleSendRowsToStudio}
                    className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5"
                  >
                    <Layers size={14} />
                    <span>Send to Dialogue Studio</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleGenerateFullScriptAudio}
                    disabled={isGeneratingScriptAudio}
                    className="flex-1 sm:flex-initial px-6 py-2.5 rounded-xl bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 hover:from-pink-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-pink-950/50 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                  >
                    {isGeneratingScriptAudio ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        <span>Synthesizing...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={14} />
                        <span>🎙️ Synthesize Full Dialogue Audio</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Master Script Audio Output Player */}
              {scriptAudioUrl && (
                <div className="p-4 rounded-xl bg-pink-950/30 border border-pink-500/40 flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in">
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="w-10 h-10 rounded-full bg-pink-600 text-white flex items-center justify-center flex-shrink-0 shadow">
                      <Volume2 size={20} />
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-pink-100">
                        Synthesized Dual-Character Dialogue Audio
                      </h4>
                      <p className="text-[11px] text-pink-300/80">
                        {scriptRows.length} lines stitched in natural conversational order.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <audio controls src={scriptAudioUrl} className="h-8 w-full sm:w-48" />
                    <a
                      href={scriptAudioUrl}
                      download={`Dialogue_Audio_${targetScriptLanguage.replace(/[^a-zA-Z0-9]/g, '_')}.wav`}
                      className="px-3 py-1.5 rounded-lg bg-pink-600 hover:bg-pink-500 text-white text-xs font-semibold flex items-center gap-1.5 flex-shrink-0"
                    >
                      <Download size={13} />
                      <span>Download</span>
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB: DUAL-CHARACTER (MALE + FEMALE) DIARIZATION & CLONING */}
      {activeTab === 'dual_clone' && (
        <div className="space-y-6 animate-in fade-in">
          
          {/* Informational Hero Card */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-purple-950/60 via-indigo-950/40 to-slate-950 border border-purple-500/40 shadow-xl">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 via-pink-500 to-indigo-600 flex items-center justify-center text-white flex-shrink-0 shadow-lg shadow-purple-900/40">
                  <Users size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-base text-white">Dual-Character Speaker Diarization & Cloner</h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 border border-pink-500/40">
                      Male + Female Separation
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                    Aap aisi audio upload karein jisme <strong>1 Male aur 1 Female</strong> aapas mein baat kar rahe hon (jaise TV commercial ya podcast).
                    AI automatically dono ke dialogs alag alag transcribe karega, dono ke vocal blueprints (Pitch & Tone) extract karega, aur <strong>2 Cloned Voices</strong> bana kar seedha Dialogue Studio mein load kar dega!
                  </p>
                </div>
              </div>

              <button
                onClick={loadDemoDualAudio}
                disabled={isAnalyzingDual}
                className="px-4 py-2.5 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-500/40 text-xs font-semibold flex items-center gap-2 transition-all flex-shrink-0"
              >
                <Music2 size={15} />
                <span>Load Demo Dual Ad Audio</span>
              </button>
            </div>
          </div>

          {/* Upload & Audio Analysis Area */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Upload Box */}
            <div className="bg-slate-950/80 p-5 rounded-2xl border border-slate-800 flex flex-col justify-between">
              <div>
                <h4 className="font-semibold text-sm text-slate-200 mb-1 flex items-center gap-2">
                  <Upload size={16} className="text-purple-400" />
                  1. Upload Dual-Character Audio Recording
                </h4>
                <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                  Upload any voice file (.mp3, .wav, .m4a) with both Male and Female speakers talking. AI will split their voices.
                </p>

                <label className="border-2 border-dashed border-purple-500/40 hover:border-purple-400/80 bg-purple-950/10 hover:bg-purple-950/20 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all text-center">
                  <div className="w-12 h-12 rounded-full bg-purple-900/40 flex items-center justify-center text-purple-300 mb-2">
                    <Upload size={22} />
                  </div>
                  <span className="text-xs font-bold text-slate-200">
                    Click to select Dual Voice audio file
                  </span>
                  <span className="text-[11px] text-slate-400 mt-0.5">
                    Supports .mp3, .wav, .m4a, .ogg (Max 20MB)
                  </span>
                  <input
                    type="file"
                    accept="audio/*,.wav,.mp3,.m4a,.ogg"
                    onChange={handleDualFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Uploaded Audio Preview Bar */}
              {dualAudioUrl && (
                <div className="mt-4 p-3 bg-purple-950/30 border border-purple-500/30 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <button
                      onClick={togglePlayDual}
                      className="w-9 h-9 rounded-full bg-purple-600 hover:bg-purple-500 text-white flex items-center justify-center flex-shrink-0 shadow"
                    >
                      {isPlayingDual ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
                    </button>
                    <div className="overflow-hidden">
                      <span className="text-xs font-semibold text-purple-200 block truncate">
                        {dualAudioName || 'Dual Speaker Audio'}
                      </span>
                      <span className="text-[10px] text-purple-400/90 font-mono">
                        Reference clip ready for speaker separation
                      </span>
                    </div>
                  </div>
                  <audio
                    ref={dualAudioRef}
                    src={dualAudioUrl}
                    onEnded={() => setIsPlayingDual(false)}
                    className="hidden"
                  />
                </div>
              )}
            </div>

            {/* Analysis Status / Instruction Panel */}
            <div className="bg-slate-950/80 p-5 rounded-2xl border border-slate-800 flex flex-col justify-between">
              <div>
                <h4 className="font-semibold text-sm text-slate-200 mb-2 flex items-center gap-2">
                  <Sparkles size={16} className="text-pink-400" />
                  2. AI Speaker Separation & Biometrics
                </h4>
                
                {isAnalyzingDual ? (
                  <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
                    <RefreshCw size={28} className="animate-spin text-purple-400" />
                    <div>
                      <p className="text-sm font-semibold text-purple-200">
                        Listening to audio & separating speakers...
                      </p>
                      <p className="text-xs text-slate-400 mt-1 max-w-xs">
                        Detecting pitch fundamental clusters, transcribing dialogues, and designing Male & Female clones.
                      </p>
                    </div>
                  </div>
                ) : dualAnalysisResult ? (
                  <div className="space-y-3">
                    <div className="p-3 bg-emerald-950/30 border border-emerald-500/30 rounded-xl flex items-start gap-2.5 text-xs text-emerald-200">
                      <CheckCircle2 size={16} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <strong className="block font-semibold text-emerald-100">Separation Successful!</strong>
                        <span>{dualAnalysisResult.summary || 'Both speakers identified and vocal models calibrated.'}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2.5 rounded-xl bg-blue-950/30 border border-blue-900/50">
                        <span className="text-[11px] font-bold text-blue-300 block">👨 Male Speaker</span>
                        <span className="text-[10px] text-slate-300 block mt-0.5">
                          Pitch: {dualAnalysisResult.maleSpeakerProfile.estimatedPitchHz} Hz ({dualAnalysisResult.maleSpeakerProfile.pitchCategory})
                        </span>
                        <span className="text-[10px] text-blue-400 block font-mono mt-0.5">
                          Base: {dualAnalysisResult.maleSpeakerProfile.baseVoice}
                        </span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-pink-950/30 border border-pink-900/50">
                        <span className="text-[11px] font-bold text-pink-300 block">👩 Female Speaker</span>
                        <span className="text-[10px] text-slate-300 block mt-0.5">
                          Pitch: {dualAnalysisResult.femaleSpeakerProfile.estimatedPitchHz} Hz ({dualAnalysisResult.femaleSpeakerProfile.pitchCategory})
                        </span>
                        <span className="text-[10px] text-pink-400 block font-mono mt-0.5">
                          Base: {dualAnalysisResult.femaleSpeakerProfile.baseVoice}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-8 text-center text-slate-500 text-xs space-y-2">
                    <Users size={32} className="mx-auto text-slate-600" />
                    <p>No audio analyzed yet. Upload an audio file or click "Load Demo Dual Ad Audio" above.</p>
                  </div>
                )}
              </div>

              {dualAnalysisResult && (
                <div className="pt-4 border-t border-slate-800">
                  <span className="text-[11px] text-slate-400">
                    2 Clones will be generated: 1 for Male lines and 1 for Female lines.
                  </span>
                </div>
              )}
            </div>

          </div>

          {/* Extracted Dialogue & Character Customization Box */}
          {dualAnalysisResult && (
            <div className="bg-slate-950 p-5 rounded-2xl border border-purple-500/40 space-y-5 animate-in fade-in">
              
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <FileCheck2 size={18} className="text-purple-400" />
                  <h3 className="font-bold text-sm text-white">
                    3. Extracted Dual-Character Dialogue & Cloned Names
                  </h3>
                </div>
                <span className="text-[11px] text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                  Ready to Copy & Synthesize
                </span>
              </div>

              {/* Cloned Voices Customization */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Male Voice Profile Card */}
                <div className="bg-slate-900/90 p-4 rounded-xl border border-blue-900/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-300 flex items-center gap-1.5">
                      👨 Cloned Character 1 (Male)
                    </span>
                    <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded font-mono">
                      {dualAnalysisResult.maleSpeakerProfile.estimatedPitchHz} Hz
                    </span>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Name / Label</label>
                    <input
                      type="text"
                      value={dualMaleName}
                      onChange={(e) => setDualMaleName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="space-y-1 text-[11px] text-slate-400 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                    <div className="flex justify-between">
                      <span>Vocal Texture:</span>
                      <span className="text-slate-200 truncate ml-2">{dualAnalysisResult.maleSpeakerProfile.vocalTexture}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Delivery Style:</span>
                      <span className="text-slate-200 truncate ml-2">{dualAnalysisResult.maleSpeakerProfile.exactDeliveryStyle}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Assigned Base Model:</span>
                      <span className="font-mono text-blue-400">{dualAnalysisResult.maleSpeakerProfile.baseVoice}</span>
                    </div>
                  </div>
                </div>

                {/* Female Voice Profile Card */}
                <div className="bg-slate-900/90 p-4 rounded-xl border border-pink-900/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-pink-300 flex items-center gap-1.5">
                      👩 Cloned Character 2 (Female)
                    </span>
                    <span className="text-[10px] bg-pink-500/20 text-pink-300 px-2 py-0.5 rounded font-mono">
                      {dualAnalysisResult.femaleSpeakerProfile.estimatedPitchHz} Hz
                    </span>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Name / Label</label>
                    <input
                      type="text"
                      value={dualFemaleName}
                      onChange={(e) => setDualFemaleName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white outline-none focus:border-pink-500"
                    />
                  </div>

                  <div className="space-y-1 text-[11px] text-slate-400 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                    <div className="flex justify-between">
                      <span>Vocal Texture:</span>
                      <span className="text-slate-200 truncate ml-2">{dualAnalysisResult.femaleSpeakerProfile.vocalTexture}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Delivery Style:</span>
                      <span className="text-slate-200 truncate ml-2">{dualAnalysisResult.femaleSpeakerProfile.exactDeliveryStyle}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Assigned Base Model:</span>
                      <span className="font-mono text-pink-400">{dualAnalysisResult.femaleSpeakerProfile.baseVoice}</span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Editable Dialogue Script */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                  <span>Separated Dialogue Script (Lines automatically assigned to Male & Female)</span>
                  <span className="text-[10px] text-slate-500">You can edit dialogues or add new lines</span>
                </label>
                <textarea
                  value={editedDialogueScript}
                  onChange={(e) => setEditedDialogueScript(e.target.value)}
                  rows={5}
                  className="w-full bg-slate-900 border border-slate-700 focus:border-purple-500 rounded-xl p-3 text-xs sm:text-sm text-slate-200 font-mono leading-relaxed outline-none"
                  placeholder="Male: ...&#10;Female: ..."
                />
              </div>

              {/* Final Big Action Button */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-800">
                <span className="text-xs text-slate-400">
                  Yeh action dono voices ko clone karke foran Dual Dialogue Studio mein play karne ke liye tayar karega.
                </span>

                <button
                  onClick={handleSaveDualClones}
                  disabled={isAnalyzingDual || !editedDialogueScript.trim()}
                  className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-sm shadow-xl shadow-purple-950/60 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                >
                  {dualCloneSuccess ? (
                    <>
                      <CheckCircle2 size={18} />
                      Dono Voices Cloned & Studio Mein Loaded!
                    </>
                  ) : (
                    <>
                      <Sparkles size={18} />
                      ✨ Clone Both Voices & Launch in Dialogue Studio
                    </>
                  )}
                </button>
              </div>

            </div>
          )}

        </div>
      )}

      {/* TAB 2: STUDIO COMMERCIAL MODELS */}
      {activeTab === 'premade' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-xs text-slate-400">
              Curated studio voice models with distinct vocal textures:
            </p>
            <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                onClick={() => setPremadeGenderFilter('all')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  premadeGenderFilter === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                All ({VOICE_CATALOG.filter(v => v.category === 'pakistani_ad').length})
              </button>
              <button
                onClick={() => setPremadeGenderFilter('Male')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  premadeGenderFilter === 'Male' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                👨 Male ({VOICE_CATALOG.filter(v => v.category === 'pakistani_ad' && v.gender === 'Male').length})
              </button>
              <button
                onClick={() => setPremadeGenderFilter('Female')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  premadeGenderFilter === 'Female' ? 'bg-pink-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                👩 Female ({VOICE_CATALOG.filter(v => v.category === 'pakistani_ad' && v.gender === 'Female').length})
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {premadeVoices.map((voice) => {
              const isSelected = currentVoiceId === voice.id;
              return (
                <div
                  key={voice.id}
                  className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                    isSelected
                      ? 'bg-indigo-950/40 border-indigo-500 shadow-lg shadow-indigo-950/50'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-white text-sm">{voice.name}</h4>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                              voice.gender === 'Male'
                                ? 'bg-blue-900/50 text-blue-200 border border-blue-800'
                                : 'bg-pink-900/50 text-pink-200 border border-pink-800'
                            }`}
                          >
                            {voice.gender}
                          </span>
                        </div>
                        <span className="text-xs text-indigo-400 font-medium block mt-0.5">
                          {voice.tagline}
                        </span>
                      </div>
                      {isSelected && (
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-semibold border border-emerald-500/30 flex items-center gap-1">
                          Active
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-400 leading-relaxed line-clamp-2 mb-3">
                      {voice.description}
                    </p>

                    <div className="text-[11px] bg-slate-900/80 p-2 rounded-lg border border-slate-800/80 text-slate-300 italic mb-3">
                      "{voice.previewSampleText}"
                    </div>
                  </div>

                  <button
                    onClick={() => onSelectCatalogVoice(voice.id)}
                    className={`w-full py-2 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                      isSelected
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white'
                    }`}
                  >
                    {isSelected ? '✓ Selected Voice' : 'Use this Voice'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: MY CUSTOM CLONED VOICES */}
      {activeTab === 'my_clones' && (
        <div className="space-y-4">
          {customVoices.length === 0 ? (
            <div className="text-center py-12 px-4 bg-slate-950/40 rounded-xl border border-dashed border-slate-800">
              <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-3 text-slate-500">
                <Mic size={24} />
              </div>
              <h3 className="font-semibold text-white text-sm mb-1">No Custom Cloned Voices Yet</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto mb-4">
                Record a quick 10-second audio sample or upload an audio clip to clone an exact voice and delivery style!
              </p>
              <button
                onClick={() => setActiveTab('create')}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition-all"
              >
                + Clone a Voice Now
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {customVoices.map((voice) => {
                const isSelected = selectedClonedVoiceId === voice.id && currentVoiceId === VoiceName.Custom_Cloned;
                return (
                  <div
                    key={voice.id}
                    className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'bg-purple-950/40 border-purple-500 shadow-lg shadow-purple-950/50'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-white text-sm">{voice.name}</h4>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                                voice.gender === 'Male'
                                  ? 'bg-blue-900/50 text-blue-200 border border-blue-800'
                                  : 'bg-pink-900/50 text-pink-200 border border-pink-800'
                              }`}
                            >
                              {voice.gender}
                            </span>
                          </div>
                          <span className="text-xs text-purple-400 font-medium block mt-0.5 line-clamp-1">
                            {voice.exactDeliveryStyle || voice.cadence}
                          </span>
                        </div>
                        <button
                          onClick={() => onDeleteCustomVoice(voice.id)}
                          className="text-slate-500 hover:text-red-400 p-1 rounded transition-colors"
                          title="Delete cloned voice"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      <div className="space-y-1.5 text-xs text-slate-400 mb-3 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                        <div className="flex justify-between">
                          <span>Pitch:</span>
                          <span className="font-mono text-slate-200">{voice.pitchCategory || `${voice.estimatedPitchHz} Hz`}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Texture:</span>
                          <span className="text-slate-200 truncate ml-2">{voice.vocalTexture || 'Natural'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Accent:</span>
                          <span className="text-slate-200 truncate ml-2">{voice.accent}</span>
                        </div>
                      </div>

                      {voice.recordedSampleBlobUrl && (
                        <div className="mb-3">
                          <audio controls src={voice.recordedSampleBlobUrl} className="w-full h-8" />
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => onSelectClonedVoice(voice)}
                      className={`w-full py-2 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                        isSelected
                          ? 'bg-purple-600 text-white'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white'
                      }`}
                    >
                      {isSelected ? '✓ Active Cloned Voice' : 'Select for Generation'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

    </div>
  );
};
