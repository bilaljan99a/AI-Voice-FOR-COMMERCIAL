import React, { useState } from 'react';
import { VoiceName, SpeechStyle, Language, CommercialEnergy, CustomClonedVoice } from '../types';
import { VOICE_CATALOG } from '../data/voiceCatalog';
import {
  User,
  Globe,
  Feather,
  Gauge,
  Flame,
  Search,
  Sparkles,
  Volume2,
  Check,
  ChevronRight,
  Filter
} from 'lucide-react';

interface ControlPanelProps {
  selectedVoice: VoiceName;
  setSelectedVoice: (v: VoiceName) => void;
  selectedStyle: SpeechStyle;
  setSelectedStyle: (s: SpeechStyle) => void;
  selectedLanguage: Language;
  setSelectedLanguage: (l: Language) => void;
  speechSpeed: number;
  setSpeechSpeed: (s: number) => void;
  commercialEnergy: CommercialEnergy;
  setCommercialEnergy: (e: CommercialEnergy) => void;
  customVoices: CustomClonedVoice[];
  activeCustomVoice: CustomClonedVoice | null;
  onOpenCloneStudio?: () => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  selectedVoice,
  setSelectedVoice,
  selectedStyle,
  setSelectedStyle,
  selectedLanguage,
  setSelectedLanguage,
  speechSpeed,
  setSpeechSpeed,
  commercialEnergy,
  setCommercialEnergy,
  customVoices,
  activeCustomVoice,
  onOpenCloneStudio,
}) => {
  // Voice filter state
  const [voiceFilter, setVoiceFilter] = useState<'all' | 'pakistani' | 'male' | 'female' | 'cloned'>('pakistani');
  const [searchQuery, setSearchQuery] = useState('');

  // Filtered voice list
  const filteredVoices = VOICE_CATALOG.filter((voice) => {
    // Gender / category filter
    if (voiceFilter === 'pakistani' && voice.category !== 'pakistani_ad') return false;
    if (voiceFilter === 'male' && voice.gender !== 'Male') return false;
    if (voiceFilter === 'female' && voice.gender !== 'Female') return false;
    
    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        voice.name.toLowerCase().includes(q) ||
        voice.tagline.toLowerCase().includes(q) ||
        voice.description.toLowerCase().includes(q) ||
        voice.accent.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6 pb-6">

      {/* 1. Voice Selection Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-indigo-400">
            <User size={18} />
            <h3 className="font-semibold text-sm text-white">Voice & Speaker</h3>
          </div>
          {onOpenCloneStudio && (
            <button
              onClick={onOpenCloneStudio}
              className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 font-medium bg-purple-500/10 px-2.5 py-1 rounded-full border border-purple-500/20"
            >
              <Sparkles size={12} />
              Clone Voice
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar text-xs">
          <button
            onClick={() => setVoiceFilter('pakistani')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium transition-all ${
              voiceFilter === 'pakistani'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            🇵🇰 Pakistani Ads
          </button>
          <button
            onClick={() => setVoiceFilter('male')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium transition-all ${
              voiceFilter === 'male'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            👨 Male
          </button>
          <button
            onClick={() => setVoiceFilter('female')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium transition-all ${
              voiceFilter === 'female'
                ? 'bg-pink-600 text-white shadow-sm'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            👩 Female
          </button>
          <button
            onClick={() => setVoiceFilter('all')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium transition-all ${
              voiceFilter === 'all'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            All
          </button>
          {customVoices.length > 0 && (
            <button
              onClick={() => setVoiceFilter('cloned')}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium transition-all ${
                voiceFilter === 'cloned'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-slate-800 text-purple-400 hover:text-purple-300'
              }`}
            >
              🧬 Cloned ({customVoices.length})
            </button>
          )}
        </div>

        {/* Quick Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search voice by name, style, accent..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700/80 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500"
          />
        </div>

        {/* Active Custom Cloned Voice Card (if active) */}
        {selectedVoice === VoiceName.Custom_Cloned && activeCustomVoice && (
          <div className="p-3 rounded-xl bg-purple-950/40 border border-purple-500 shadow-md flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center text-white text-sm">
                🧬
              </span>
              <div>
                <span className="text-xs font-bold text-white block">
                  {activeCustomVoice.name}
                </span>
                <span className="text-[10px] text-purple-300">
                  Custom Cloned ({activeCustomVoice.gender}) • {activeCustomVoice.cadence}
                </span>
              </div>
            </div>
            <span className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded font-mono">
              Active
            </span>
          </div>
        )}

        {/* Voice Cards List */}
        <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
          {voiceFilter === 'cloned' ? (
            customVoices.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-500">
                No custom cloned voices yet.
              </div>
            ) : (
              customVoices.map((cloned) => (
                <button
                  key={cloned.id}
                  onClick={() => setSelectedVoice(VoiceName.Custom_Cloned)}
                  className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between ${
                    selectedVoice === VoiceName.Custom_Cloned && activeCustomVoice?.id === cloned.id
                      ? 'bg-purple-950/50 border-purple-500 text-white shadow-lg shadow-purple-950/40'
                      : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-850 hover:border-slate-700'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-white">{cloned.name}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 font-mono">
                        {cloned.gender}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 block mt-0.5">
                      {cloned.cadence} • {cloned.accent}
                    </span>
                  </div>
                  {selectedVoice === VoiceName.Custom_Cloned && activeCustomVoice?.id === cloned.id && (
                    <Check size={16} className="text-purple-400 flex-shrink-0" />
                  )}
                </button>
              ))
            )
          ) : (
            filteredVoices.map((voice) => {
              const isSelected = selectedVoice === voice.id;
              return (
                <button
                  key={voice.id}
                  onClick={() => setSelectedVoice(voice.id)}
                  className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between ${
                    isSelected
                      ? 'bg-indigo-950/60 border-indigo-500 text-white shadow-lg shadow-indigo-950/40 ring-1 ring-indigo-500/50'
                      : 'bg-slate-900/70 border-slate-800 text-slate-300 hover:bg-slate-850 hover:border-slate-700'
                  }`}
                >
                  <div className="flex-1 pr-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-xs text-white">{voice.name}</span>
                      <span
                        className={`text-[9px] px-1.5 py-0.2 rounded font-medium ${
                          voice.gender === 'Male'
                            ? 'bg-blue-900/50 text-blue-300 border border-blue-800/40'
                            : 'bg-pink-900/50 text-pink-300 border border-pink-800/40'
                        }`}
                      >
                        {voice.gender}
                      </span>
                      {voice.category === 'pakistani_ad' && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
                          🇵🇰 Ad
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-indigo-300/90 block mt-0.5 font-medium">
                      {voice.tagline}
                    </span>
                    <span className="text-[10px] text-slate-500 block truncate mt-0.5">
                      {voice.accent}
                    </span>
                  </div>
                  {isSelected && (
                    <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0">
                      <Check size={12} className="text-white" />
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* 2. Pakistani Commercial Ad Styles */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-amber-400">
          <div className="flex items-center gap-2">
            <Feather size={18} />
            <h3 className="font-semibold text-sm text-white">Commercial Style</h3>
          </div>
          <span className="text-[10px] text-amber-400/90 bg-amber-500/10 px-2 py-0.5 rounded font-mono border border-amber-500/20">
            Ad Tuned
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {Object.values(SpeechStyle).map((style) => {
            const isSelected = selectedStyle === style;
            const isPakistaniAd = style.includes('Pakistani') || style.includes('Fashion') || style.includes('Chai') || style.includes('Housing') || style.includes('Food') || style.includes('Ramadan') || style.includes('Radio') || style.includes('Tech');
            return (
              <button
                key={style}
                onClick={() => setSelectedStyle(style)}
                className={`p-2.5 text-left rounded-xl border text-xs transition-all relative ${
                  isSelected
                    ? 'bg-amber-950/50 border-amber-500 text-white shadow-md shadow-amber-950/40 ring-1 ring-amber-500/40'
                    : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-850 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-1">
                  <span className="font-medium line-clamp-1">{style}</span>
                  {isSelected && <Check size={12} className="text-amber-400 flex-shrink-0 mt-0.5" />}
                </div>
                {isPakistaniAd && (
                  <span className="text-[9px] text-emerald-400 font-mono mt-1 block">
                    🇵🇰 Commercial Presets
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Commercial Energy Slider */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-rose-400">
          <Flame size={18} />
          <h3 className="font-semibold text-sm text-white">Commercial Energy</h3>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {(['Subtle & Premium', 'Balanced Commercial', 'High-Impact Dhamaka'] as CommercialEnergy[]).map((level) => (
            <button
              key={level}
              onClick={() => setCommercialEnergy(level)}
              className={`py-2 px-2 text-center rounded-xl border text-xs font-medium transition-all ${
                commercialEnergy === level
                  ? 'bg-rose-950/60 border-rose-500 text-white shadow-sm ring-1 ring-rose-500/50'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <span className="block text-[11px] truncate">
                {level === 'High-Impact Dhamaka' ? '💥 Dhamaka' : level === 'Subtle & Premium' ? '🕊️ Subtle' : '🎯 Balanced'}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* 4. Language Selection */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-emerald-400">
          <Globe size={18} />
          <h3 className="font-semibold text-sm text-white">Script Language</h3>
        </div>

        <select
          value={selectedLanguage}
          onChange={(e) => setSelectedLanguage(e.target.value as Language)}
          className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs sm:text-sm text-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-medium"
        >
          {Object.values(Language).map((lang) => (
            <option key={lang} value={lang}>
              {lang}
            </option>
          ))}
        </select>
      </div>

      {/* 5. Speaking Speed Rate */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-cyan-400">
          <div className="flex items-center gap-2">
            <Gauge size={18} />
            <h3 className="font-semibold text-sm text-white">Commercial Pacing</h3>
          </div>
          <span className="font-mono text-xs text-cyan-300 font-bold bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-800/40">
            {speechSpeed.toFixed(2)}x
          </span>
        </div>

        <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 space-y-2">
          <input
            type="range"
            min="0.75"
            max="1.50"
            step="0.05"
            value={speechSpeed}
            onChange={(e) => setSpeechSpeed(parseFloat(e.target.value))}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
          />
          <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono">
            <button onClick={() => setSpeechSpeed(0.85)} className="hover:text-cyan-400">0.85x (Calm)</button>
            <button onClick={() => setSpeechSpeed(1.0)} className="hover:text-cyan-400">1.0x (Standard)</button>
            <button onClick={() => setSpeechSpeed(1.15)} className="hover:text-cyan-400">1.15x (Radio Punch)</button>
            <button onClick={() => setSpeechSpeed(1.3)} className="hover:text-cyan-400">1.3x (Fast Sale)</button>
          </div>
        </div>
      </div>

    </div>
  );
};