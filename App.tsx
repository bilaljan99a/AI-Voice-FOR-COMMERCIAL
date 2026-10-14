import React, { useState, useEffect } from 'react';
import { ControlPanel } from './components/ControlPanel';
import { AudioPlayer } from './components/AudioPlayer';
import { VoiceCloneStudio } from './components/VoiceCloneStudio';
import {
  VoiceName,
  SpeechStyle,
  Language,
  GeneratedAudio,
  CommercialEnergy,
  CustomClonedVoice,
  AdTemplate,
} from './types';
import { generateSpeech, getActiveApiKey } from './services/geminiService';
import { base64ToUint8Array, pcmToWavBlob } from './utils/audioHelper';
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
  HelpCircle
} from 'lucide-react';

const LOCAL_STORAGE_CLONES_KEY = 'voicecraft_custom_cloned_voices_v1';
const LOCAL_STORAGE_KEY_STORAGE = 'voicecraft_gemini_api_key';

const App: React.FC = () => {
  // Mobile / View Mode: 'studio' | 'voices' | 'clone_lab' | 'templates' | 'history'
  const [activeTab, setActiveTab] = useState<'studio' | 'voices' | 'clone_lab' | 'templates' | 'history'>('studio');

  // Controls state
  const [selectedVoice, setSelectedVoice] = useState<VoiceName>(VoiceName.Ayesha_Pak_Female);
  const [selectedStyle, setSelectedStyle] = useState<SpeechStyle>(SpeechStyle.Pakistani_Lawn_Beauty);
  const [selectedLanguage, setSelectedLanguage] = useState<Language>(Language.RomanUrdu);
  const [speechSpeed, setSpeechSpeed] = useState<number>(1.0);
  const [commercialEnergy, setCommercialEnergy] = useState<CommercialEnergy>('Balanced Commercial');

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

  // Content state
  const [text, setText] = useState<string>(
    'Khubsurati jo dilon ko moh le... Noor Fashion ki nayi Festive Lawn Collection ab dastyab hai tamam leading stores par. Sajaiye apna har pal, ba-waqar andaaz mein.'
  );
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [generatedList, setGeneratedList] = useState<GeneratedAudio[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showTemplateModal, setShowTemplateModal] = useState<boolean>(false);

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
    setSelectedVoice(VoiceName.Custom_Cloned);
  };

  const handleDeleteCustomVoice = (id: string) => {
    setCustomVoices((prev) => prev.filter((v) => v.id !== id));
    if (activeCustomVoice?.id === id) {
      setActiveCustomVoice(null);
      setSelectedVoice(VoiceName.Ayesha_Pak_Female);
    }
  };

  const handleSelectClonedVoice = (voice: CustomClonedVoice) => {
    setActiveCustomVoice(voice);
    setSelectedVoice(VoiceName.Custom_Cloned);
    setActiveTab('studio');
  };

  const handleSelectCatalogVoice = (voiceId: VoiceName) => {
    setSelectedVoice(voiceId);
    setActiveCustomVoice(null);
    setActiveTab('studio');
  };

  // Load an ad template
  const applyAdTemplate = (template: AdTemplate) => {
    setText(template.script);
    setSelectedLanguage(template.language);
    setSelectedVoice(template.suggestedVoice);
    setSelectedStyle(template.suggestedStyle);
    setSpeechSpeed(template.suggestedSpeed);
    setShowTemplateModal(false);
    setActiveTab('studio');
  };

  // Save custom API key for GitHub Pages or Custom domain usage
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

  // Handle TTS Generation
  const handleGenerate = async () => {
    if (!text.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      // 1. Call Gemini TTS API with natural human styling
      const base64Audio = await generateSpeech(
        text,
        selectedVoice,
        selectedStyle,
        selectedLanguage,
        speechSpeed,
        commercialEnergy,
        selectedVoice === VoiceName.Custom_Cloned ? activeCustomVoice : null
      );

      // 2. Wrap PCM in pure 24kHz WAV container
      const pcmData = base64ToUint8Array(base64Audio);
      const rawWavBlob = pcmToWavBlob(pcmData);

      // 3. Gentle broadcast mastering limiting (NO robotic pitch or speed distortion)
      const cleanWavBlob = await enhanceVoiceAcoustics(rawWavBlob);
      const audioUrl = URL.createObjectURL(cleanWavBlob);

      // Voice display info
      let voiceDisplayName = 'Ayesha (Pakistani Beauty)';
      let voiceGender: 'Male' | 'Female' | 'Cloned' = 'Female';

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

      // 4. Update State
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

      // Automatically switch to history view on mobile
      if (window.innerWidth < 768) {
        setActiveTab('history');
      }
    } catch (err: any) {
      console.error('Generation error:', err);
      const errorMessage =
        err instanceof Error
          ? err.message
          : 'Failed to generate commercial speech. Please try again or simplify script.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteHistoryItem = (id: string) => {
    setGeneratedList((prev) => prev.filter((item) => item.id !== id));
  };

  // Determine if text is Urdu / Arabic script
  const isUrduScript = /[\u0600-\u06FF]/.test(text);

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
                  Natural Human Commercial Voice AI
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden xs:block">
                Authentic Male & Female Voices • Pakistani Commercial Ads • Deploy Anywhere
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
              Ad Templates
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
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20 font-medium">
                          {tpl.category}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed mb-4 italic">
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
            <div className="flex-1 flex flex-col gap-6 max-w-4xl mx-auto w-full">
              
              {/* Active Voice Pill Banner */}
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

              {/* Script Input Card */}
              <div className="bg-slate-900/90 rounded-2xl border border-slate-700/80 shadow-2xl focus-within:ring-2 focus-within:ring-indigo-500/40 flex flex-col transition-all">
                
                {/* Textarea Header */}
                <div className="px-4 py-3 border-b border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                  <div className="flex items-center gap-2">
                    <MessageSquareText size={16} className="text-indigo-400" />
                    <span className="font-medium text-slate-200">Commercial Script</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {isUrduScript && (
                      <span className="text-[10px] text-emerald-400 font-mono bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        Urdu Script Detected
                      </span>
                    )}
                    <span className="font-mono text-slate-500 text-[11px]">
                      {text.length} / 2000 chars
                    </span>
                  </div>
                </div>

                {/* Textarea Input */}
                <textarea
                  className={`w-full min-h-[160px] sm:min-h-[200px] bg-transparent p-4 sm:p-5 text-base sm:text-lg text-slate-100 placeholder-slate-600 outline-none resize-none leading-relaxed font-light ${
                    isUrduScript ? 'font-serif text-right text-xl leading-loose' : 'font-sans'
                  }`}
                  placeholder={`Enter your commercial script in Urdu, Roman Urdu, Hindi or English...\n\nExample:\n"Khushkhabri! Is Bari Eid par sab se bara Dhamaka Offer! Pure 50% tak ki bachat. Stock mehdood hai, aaj hi tashreef laayein!"`}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  maxLength={2000}
                />

                {/* Quick Script Preset Buttons */}
                <div className="px-4 py-2 bg-slate-950/60 border-t border-slate-800 flex items-center gap-2 overflow-x-auto no-scrollbar text-xs">
                  <span className="text-slate-500 text-[10px] whitespace-nowrap">Load Preset:</span>
                  <button
                    onClick={() => applyAdTemplate(PAKISTANI_AD_TEMPLATES[3])}
                    className="px-2.5 py-1 rounded-lg bg-pink-950/50 hover:bg-pink-900/60 text-pink-300 border border-pink-800/40 whitespace-nowrap text-[11px]"
                  >
                    👩 Ayesha (Beauty & Lawn)
                  </button>
                  <button
                    onClick={() => applyAdTemplate(PAKISTANI_AD_TEMPLATES[1])}
                    className="px-2.5 py-1 rounded-lg bg-emerald-950/50 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-800/40 whitespace-nowrap text-[11px]"
                  >
                    👩 Maryam (Shaahi Chai)
                  </button>
                  <button
                    onClick={() => applyAdTemplate(PAKISTANI_AD_TEMPLATES[0])}
                    className="px-2.5 py-1 rounded-lg bg-slate-850 hover:bg-slate-800 text-slate-300 whitespace-nowrap text-[11px]"
                  >
                    👨 Hamza (Dhamaka Sale)
                  </button>
                  <button
                    onClick={() => applyAdTemplate(PAKISTANI_AD_TEMPLATES[2])}
                    className="px-2.5 py-1 rounded-lg bg-slate-850 hover:bg-slate-800 text-slate-300 whitespace-nowrap text-[11px]"
                  >
                    👨 Tariq (Real Estate)
                  </button>
                </div>

                {/* Speed Setting Quick Bar */}
                <div className="px-4 py-2.5 bg-slate-900/40 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 text-cyan-400 font-mono">
                    <Gauge size={14} />
                    <span>Speed: {speechSpeed.toFixed(2)}x (Natural Pitch-Preserved)</span>
                  </div>

                  <div className="flex items-center gap-1 text-[11px] text-slate-400">
                    <span>Quick Speed:</span>
                    {[0.85, 1.0, 1.15, 1.3].map((s) => (
                      <button
                        key={s}
                        onClick={() => setSpeechSpeed(s)}
                        className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                          Math.abs(speechSpeed - s) < 0.03
                            ? 'bg-cyan-500 text-slate-950 font-bold'
                            : 'bg-slate-800 text-slate-300 hover:text-white'
                        }`}
                      >
                        {s}x
                      </button>
                    ))}
                  </div>
                </div>

                {/* Generate Action Bar */}
                <div className="p-4 border-t border-slate-800 bg-slate-900/60 rounded-b-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Gemini TTS Human Voice Ready</span>
                  </div>

                  <button
                    onClick={handleGenerate}
                    disabled={isLoading || !text.trim()}
                    className={`w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl font-bold text-sm transition-all shadow-xl transform active:scale-95 ${
                      isLoading || !text.trim()
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                        : 'bg-gradient-to-r from-emerald-600 via-indigo-600 to-purple-600 hover:from-emerald-500 hover:to-purple-500 text-white shadow-indigo-900/50'
                    }`}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 size={18} className="animate-spin text-white" />
                        Generating Natural Audio...
                      </>
                    ) : (
                      <>
                        <Sparkles size={18} />
                        Generate Commercial Audio
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

              {/* Generated Audio Section (Center preview for recent items) */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm text-slate-200 flex items-center gap-2">
                    <History size={16} className="text-indigo-400" />
                    Generated Commercial Voiceovers
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
                      Choose a voice (Ayesha for soft beauty, Maryam for warm Chai, Hamza for sale promo), then tap Generate!
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
                  Pakistani Commercial Ad Scripts
                </h3>
                <p className="text-xs text-slate-400">
                  Select a pre-written high-converting Pakistani TV/Radio ad script to test instantly.
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
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
                      {tpl.brandType}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 italic line-clamp-2 leading-relaxed">
                    "{tpl.script}"
                  </p>
                  <div className="flex items-center justify-between mt-2 text-[10px] text-slate-500">
                    <span>Suggested Voice: {VOICE_CATALOG.find(v => v.id === tpl.suggestedVoice)?.name}</span>
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