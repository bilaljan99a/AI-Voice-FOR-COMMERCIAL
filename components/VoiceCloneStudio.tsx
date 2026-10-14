import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Play, Pause, Upload, Trash2, CheckCircle2, Sparkles, Volume2, AudioWaveform, User, ArrowRight, RefreshCw, AlertCircle } from 'lucide-react';
import { CustomClonedVoice, VoiceName } from '../types';
import { analyzeVoiceSample } from '../utils/audioHelper';
import { VOICE_CATALOG } from '../data/voiceCatalog';

interface VoiceCloneStudioProps {
  customVoices: CustomClonedVoice[];
  onAddCustomVoice: (voice: CustomClonedVoice) => void;
  onDeleteCustomVoice: (id: string) => void;
  onSelectClonedVoice: (voice: CustomClonedVoice) => void;
  selectedClonedVoiceId: string | null;
  onSelectCatalogVoice: (voiceId: VoiceName) => void;
  currentVoiceId: VoiceName;
}

export const VoiceCloneStudio: React.FC<VoiceCloneStudioProps> = ({
  customVoices,
  onAddCustomVoice,
  onDeleteCustomVoice,
  onSelectClonedVoice,
  selectedClonedVoiceId,
  onSelectCatalogVoice,
  currentVoiceId,
}) => {
  // Tab state: 'record' | 'upload' | 'premade'
  const [activeTab, setActiveTab] = useState<'create' | 'premade' | 'my_clones'>('create');
  
  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedBlobUrl, setRecordedBlobUrl] = useState<string | null>(null);
  const [isPlayingRecorded, setIsPlayingRecorded] = useState(false);

  // Analysis / Form State
  const [cloneName, setCloneName] = useState('');
  const [cloneGender, setCloneGender] = useState<'Male' | 'Female'>('Male');
  const [cloneAccent, setCloneAccent] = useState('Pakistani Urdu');
  const [cloneCadence, setCloneCadence] = useState<'Punchy Commercial' | 'Smooth Corporate' | 'Lively RJ' | 'Warm Emotional'>('Punchy Commercial');
  const [analyzedData, setAnalyzedData] = useState<{
    estimatedPitchHz: number;
    pitchCategory: 'Deep Baritone' | 'Natural Mid' | 'High Pitch';
    timbreDescription: string;
    durationSeconds: number;
  } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [cloneSuccess, setCloneSuccess] = useState(false);

  // Premade filter: 'all' | 'Male' | 'Female'
  const [premadeGenderFilter, setPremadeGenderFilter] = useState<'all' | 'Male' | 'Female'>('all');

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
        // Gradient color: indigo to purple/emerald
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

        // Stop all media tracks
        stream.getTracks().forEach((track) => track.stop());
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);

        // Run acoustic analysis
        runAcousticAnalysis(blob);
      };

      recorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);

      timerRef.current = window.setInterval(() => {
        setRecordingSeconds((prev) => {
          if (prev >= 20) {
            handleStopRecording();
            return 20;
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
      setCloneName(file.name.replace(/\.[^/.]+$/, '').slice(0, 24));
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
      if (result.pitchCategory === 'Deep Baritone') {
        setCloneGender('Male');
      } else if (result.pitchCategory === 'High Pitch') {
        setCloneGender('Female');
      }
      if (!cloneName) {
        setCloneName(`Cloned ${result.pitchCategory} Voice`);
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

    // Determine optimal base model voice
    let baseVoice: 'Puck' | 'Charon' | 'Fenrir' | 'Kore' | 'Zephyr' = 'Puck';
    if (cloneGender === 'Male') {
      if (analyzedData?.pitchCategory === 'Deep Baritone' || cloneCadence === 'Warm Emotional') {
        baseVoice = 'Charon';
      } else if (cloneCadence === 'Punchy Commercial') {
        baseVoice = 'Fenrir';
      } else {
        baseVoice = 'Puck';
      }
    } else {
      if (cloneCadence === 'Warm Emotional' || cloneCadence === 'Smooth Corporate') {
        baseVoice = 'Kore';
      } else {
        baseVoice = 'Zephyr';
      }
    }

    const newClonedVoice: CustomClonedVoice = {
      id: `clone-${Date.now()}`,
      name: cloneName.trim(),
      gender: cloneGender,
      recordedSampleBlobUrl: recordedBlobUrl || undefined,
      audioDurationSeconds: analyzedData?.durationSeconds || recordingSeconds,
      sampleFileName: cloneName,
      estimatedPitchHz: analyzedData?.estimatedPitchHz || 140,
      pitchCategory: analyzedData?.pitchCategory || (cloneGender === 'Male' ? 'Natural Mid' : 'High Pitch'),
      timbreDescription: analyzedData?.timbreDescription || `${cloneGender} vocal clone with ${cloneCadence.toLowerCase()} cadence`,
      accent: cloneAccent,
      cadence: cloneCadence,
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

  // Premade cloned voices from catalog (Pakistani commercial voices)
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
                Voice Clone Studio
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  AI Acoustic Engine
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Clone any voice by microphone or audio sample, or select curated Pakistani commercial voice clones.
              </p>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center p-1 bg-slate-950/80 rounded-xl border border-slate-800 text-xs font-medium w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('create')}
            className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg transition-all ${
              activeTab === 'create'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            🎙️ Record / Upload
          </button>
          <button
            onClick={() => setActiveTab('premade')}
            className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg transition-all ${
              activeTab === 'premade'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            🇵🇰 Pakistani Voices ({VOICE_CATALOG.filter(v => v.category === 'pakistani_ad').length})
          </button>
          <button
            onClick={() => setActiveTab('my_clones')}
            className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg transition-all relative ${
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Left Column: Live Mic Recorder */}
            <div className="bg-slate-950/60 p-5 rounded-xl border border-slate-800/80 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${isRecording ? 'bg-red-500 animate-ping' : 'bg-slate-600'}`} />
                    <h3 className="font-semibold text-sm text-slate-200">1. Record Voice Sample</h3>
                  </div>
                  <span className="text-xs font-mono text-slate-400">
                    {recordingSeconds > 0 ? `00:${recordingSeconds.toString().padStart(2, '0')}` : 'Max 20s'}
                  </span>
                </div>

                <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                  Speak clearly into your phone or PC microphone for 5-15 seconds in Urdu, English or Hindi. (e.g. read an ad sentence).
                </p>

                {/* Visualizer canvas */}
                <div className="h-20 w-full bg-slate-900/90 rounded-xl border border-slate-800 flex items-center justify-center overflow-hidden relative mb-4">
                  <canvas ref={canvasRef} width={280} height={80} className="w-full h-full" />
                  {!isRecording && !recordedBlob && (
                    <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-500">
                      Mic standby - Click record to begin
                    </div>
                  )}
                  {isRecording && (
                    <div className="absolute top-2 right-2 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-500/20 border border-red-500/30 text-[10px] text-red-300 font-mono">
                      REC
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
                    Stop Recording ({20 - recordingSeconds}s left)
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
                    <h3 className="font-semibold text-sm text-slate-200">Or Upload Audio File</h3>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">.wav, .mp3, .m4a</span>
                </div>
                <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                  Already have a clear client voiceover, WhatsApp voice note, or commercial sample? Upload it here.
                </p>

                <label className="flex flex-col items-center justify-center h-28 border-2 border-dashed border-slate-700 hover:border-indigo-500/60 rounded-xl cursor-pointer bg-slate-900/40 hover:bg-slate-900/80 transition-all p-4 group">
                  <Upload size={22} className="text-slate-500 group-hover:text-indigo-400 mb-2 transition-transform group-hover:-translate-y-0.5" />
                  <span className="text-xs font-medium text-slate-300 group-hover:text-indigo-300">
                    Tap to select or drop audio file
                  </span>
                  <span className="text-[10px] text-slate-500 mt-1">Recommended 5 - 30 seconds</span>
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
                  <div className="flex items-center gap-2 overflow-hidden">
                    <button
                      onClick={togglePlayRecorded}
                      className="w-8 h-8 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center flex-shrink-0"
                    >
                      {isPlayingRecorded ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
                    </button>
                    <div className="overflow-hidden">
                      <span className="text-xs font-medium text-indigo-200 block truncate">
                        {cloneName || 'Sample Audio'}
                      </span>
                      <span className="text-[10px] text-indigo-400/80">
                        {analyzedData?.durationSeconds ? `${analyzedData.durationSeconds}s sample loaded` : 'Loaded'}
                      </span>
                    </div>
                  </div>
                  <CheckCircle2 size={18} className="text-emerald-400 flex-shrink-0" />
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
            <div className="bg-slate-950 p-5 rounded-xl border border-indigo-500/40 space-y-4 animate-in fade-in slide-in-from-bottom-2">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Sparkles size={18} className="text-indigo-400" />
                  <h3 className="font-semibold text-sm text-white">2. Cloned Voice Profile & Characteristics</h3>
                </div>
                {isAnalyzing ? (
                  <span className="text-xs text-indigo-400 animate-pulse flex items-center gap-1.5">
                    <RefreshCw size={12} className="animate-spin" /> Analyzing acoustic timbre...
                  </span>
                ) : (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono">
                    Acoustics Analyzed ({analyzedData?.estimatedPitchHz || 140} Hz)
                  </span>
                )}
              </div>

              {/* Form Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                
                {/* Voice Name */}
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Voice Name / Label *
                  </label>
                  <input
                    type="text"
                    value={cloneName}
                    onChange={(e) => setCloneName(e.target.value)}
                    placeholder="e.g. Imran Commercial Anchor"
                    className="w-full bg-slate-900 border border-slate-700 focus:border-indigo-500 rounded-lg px-3 py-2 text-sm text-white outline-none"
                  />
                </div>

                {/* Gender */}
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Speaker Gender *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setCloneGender('Male')}
                      className={`py-2 px-3 rounded-lg text-xs font-medium border transition-all ${
                        cloneGender === 'Male'
                          ? 'bg-blue-600 border-blue-500 text-white shadow-sm'
                          : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                      }`}
                    >
                      👨 Male
                    </button>
                    <button
                      type="button"
                      onClick={() => setCloneGender('Female')}
                      className={`py-2 px-3 rounded-lg text-xs font-medium border transition-all ${
                        cloneGender === 'Female'
                          ? 'bg-pink-600 border-pink-500 text-white shadow-sm'
                          : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                      }`}
                    >
                      👩 Female
                    </button>
                  </div>
                </div>

                {/* Accent */}
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Target Accent / Dialect
                  </label>
                  <select
                    value={cloneAccent}
                    onChange={(e) => setCloneAccent(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 focus:border-indigo-500 rounded-lg px-3 py-2 text-sm text-white outline-none"
                  >
                    <option value="Pakistani Urdu">🇵🇰 Pakistani Standard Urdu</option>
                    <option value="Karachi Urban Youth">🇵🇰 Karachi Urban (RJ / Tech)</option>
                    <option value="Lahore / Punjabi Urgency">🇵🇰 Lahore Urgency (Dhamaka Sale)</option>
                    <option value="Pakistani English">🇵🇰 Pakistani English (Bilingual)</option>
                    <option value="Standard Hindi">🇮🇳 Standard Hindi (Commercial)</option>
                  </select>
                </div>

                {/* Cadence */}
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Commercial Cadence
                  </label>
                  <select
                    value={cloneCadence}
                    onChange={(e) => setCloneCadence(e.target.value as any)}
                    className="w-full bg-slate-900 border border-slate-700 focus:border-indigo-500 rounded-lg px-3 py-2 text-sm text-white outline-none"
                  >
                    <option value="Punchy Commercial">💥 Punchy Commercial (Sale / Promo)</option>
                    <option value="Warm Emotional">☕ Warm Emotional (Tea / Family FMCG)</option>
                    <option value="Smooth Corporate">💼 Smooth Corporate & Tech</option>
                    <option value="Lively RJ">📻 Lively RJ & Radio Banter</option>
                  </select>
                </div>

              </div>

              {/* Acoustic Summary Note */}
              {analyzedData && (
                <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800 text-xs text-slate-400 flex items-center justify-between">
                  <span>
                    <strong>Detected Timbre:</strong> {analyzedData.timbreDescription} ({analyzedData.pitchCategory})
                  </span>
                  <span className="font-mono text-indigo-400">
                    Duration: {analyzedData.durationSeconds}s
                  </span>
                </div>
              )}

              {/* Save Button */}
              <div className="pt-2 flex justify-end">
                <button
                  onClick={handleSaveClone}
                  disabled={!cloneName.trim() || isAnalyzing}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-sm shadow-lg shadow-emerald-900/40 flex items-center justify-center gap-2 transition-all active:scale-98 disabled:opacity-50"
                >
                  {cloneSuccess ? (
                    <>
                      <CheckCircle2 size={18} />
                      Voice Cloned & Activated!
                    </>
                  ) : (
                    <>
                      <Sparkles size={18} />
                      Save & Activate Cloned Voice
                    </>
                  )}
                </button>
              </div>

            </div>
          )}

        </div>
      )}

      {/* TAB 2: PAKISTANI COMMERCIAL PREMADE VOICES */}
      {activeTab === 'premade' && (
        <div className="space-y-4">
          {/* Gender Filter Buttons */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-xs text-slate-400">
              Curated voice clones tuned for Pakistani TV, Radio, FMCG, and digital ad campaigns:
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

          {/* Voices Grid */}
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
                Record a quick 10-second sample with your microphone or upload an audio clip to create your first personal cloned voice!
              </p>
              <button
                onClick={() => setActiveTab('create')}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition-all"
              >
                + Create Cloned Voice
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
                          <span className="text-xs text-purple-400 font-medium block mt-0.5">
                            {voice.cadence}
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
                          <span>Accent:</span>
                          <span className="text-slate-200 truncate ml-2">{voice.accent}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Base Archetype:</span>
                          <span className="font-mono text-indigo-300">{voice.baseVoice}</span>
                        </div>
                      </div>
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
