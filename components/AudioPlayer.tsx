import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, Download, Volume2, Clock, Copy, Check, Music, Sparkles, Trash2, Gauge, Sliders } from 'lucide-react';
import { GeneratedAudio } from '../types';
import { SOUNDBED_TRACKS, soundbedPlayer } from '../utils/soundbedHelper';

interface AudioPlayerProps {
  item: GeneratedAudio;
  onDelete?: (id: string) => void;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ item, onDelete }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [copied, setCopied] = useState(false);
  
  // Real-time playback speed control (0.75x to 1.75x)
  const [currentSpeed, setCurrentSpeed] = useState<number>(item.speed || 1.0);

  // Soundbed background music state
  const [selectedBgm, setSelectedBgm] = useState<string>('none');
  const [bgmVolume, setBgmVolume] = useState<number>(0.2);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const setAudioData = () => {
      setDuration(audio.duration || 0);
      setCurrentTime(audio.currentTime || 0);
      // Ensure playback rate matches selected speed
      audio.playbackRate = currentSpeed;
    };

    const setAudioTime = () => setCurrentTime(audio.currentTime);
    const setAudioEnded = () => {
      setIsPlaying(false);
      soundbedPlayer.stop();
    };

    audio.addEventListener('loadeddata', setAudioData);
    audio.addEventListener('timeupdate', setAudioTime);
    audio.addEventListener('ended', setAudioEnded);

    return () => {
      audio.removeEventListener('loadeddata', setAudioData);
      audio.removeEventListener('timeupdate', setAudioTime);
      audio.removeEventListener('ended', setAudioEnded);
      soundbedPlayer.stop();
    };
  }, [item.url, currentSpeed]);

  // Synchronize playback speed
  const changeSpeed = (newSpeed: number) => {
    setCurrentSpeed(newSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = newSpeed;
    }
  };

  // Handle BGM volume changes
  useEffect(() => {
    soundbedPlayer.setVolume(bgmVolume);
  }, [bgmVolume]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      soundbedPlayer.stop();
      setIsPlaying(false);
    } else {
      audioRef.current.playbackRate = currentSpeed;
      audioRef.current.play();
      if (selectedBgm !== 'none') {
        soundbedPlayer.play(selectedBgm, bgmVolume);
      }
      setIsPlaying(true);
    }
  };

  const handleBgmChange = (bgmId: string) => {
    setSelectedBgm(bgmId);
    if (isPlaying) {
      if (bgmId === 'none') {
        soundbedPlayer.stop();
      } else {
        soundbedPlayer.play(bgmId, bgmVolume);
      }
    }
  };

  const copyScript = () => {
    navigator.clipboard.writeText(item.fullText || item.textSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatTime = (time: number) => {
    if (isNaN(time) || !isFinite(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col gap-4 shadow-xl hover:border-slate-700/80 transition-all">
      
      {/* Top Details & Action Icons */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-bold text-sm text-white">
              {item.voiceDisplayName || item.voice}
            </span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                item.voiceGender === 'Male'
                  ? 'bg-blue-900/50 text-blue-300 border border-blue-800/50'
                  : item.voiceGender === 'Female'
                  ? 'bg-pink-900/50 text-pink-300 border border-pink-800/50'
                  : 'bg-purple-900/50 text-purple-300 border border-purple-800/50'
              }`}
            >
              {item.isClonedVoice ? '🧬 Cloned' : item.voiceGender}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-mono">
              Speed: {currentSpeed.toFixed(2)}x
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-950/60 text-amber-300 border border-amber-800/50">
              {item.energyLevel}
            </span>
          </div>

          <p className="text-slate-300 text-xs sm:text-sm line-clamp-2 leading-relaxed" title={item.fullText}>
            "{item.fullText || item.textSnippet}"
          </p>

          <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-2">
            <span className="text-indigo-400 font-medium">{item.style}</span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Clock size={10} /> {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>

        {/* Buttons: Copy, Download, Delete */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={copyScript}
            className="p-2 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 hover:text-white transition-all text-xs"
            title="Copy Script"
          >
            {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
          </button>
          
          <a
            href={item.url}
            download={`pakistani-ad-${item.voice}-${item.id}.wav`}
            className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 shadow-md shadow-indigo-900/30 transition-all text-xs flex items-center gap-1"
            title="Download WAV Audio"
          >
            <Download size={14} />
            <span className="text-[10px] font-semibold hidden xs:inline">WAV</span>
          </a>

          {onDelete && (
            <button
              onClick={() => onDelete(item.id)}
              className="p-2 bg-slate-800 text-slate-400 rounded-xl hover:bg-red-500/20 hover:text-red-300 transition-all text-xs"
              title="Delete Audio"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Main Playback Progress Bar */}
      <div className="flex items-center gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
        <button
          onClick={togglePlay}
          className="w-11 h-11 flex items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white shadow-lg shadow-indigo-950/50 active:scale-95 transition-all flex-shrink-0"
        >
          {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
        </button>

        <div className="flex-1 flex flex-col justify-center">
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={(e) => {
              const val = Number(e.target.value);
              if (audioRef.current) audioRef.current.currentTime = val;
              setCurrentTime(val);
            }}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:accent-indigo-400"
          />
          <div className="flex justify-between text-[11px] text-slate-400 mt-1 font-mono">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </div>

      {/* Speed Setting Pill Selector (Live Real-Time Speed Control) */}
      <div className="flex items-center justify-between p-2 bg-slate-950/50 rounded-xl border border-slate-800/80 text-xs">
        <div className="flex items-center gap-1.5 text-cyan-400">
          <Gauge size={14} />
          <span className="font-semibold text-slate-300 text-[11px]">Live Speed:</span>
        </div>

        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {[0.75, 0.9, 1.0, 1.15, 1.25, 1.5].map((s) => (
            <button
              key={s}
              onClick={() => changeSpeed(s)}
              className={`px-2 py-0.5 rounded-lg text-[10px] font-mono transition-all ${
                Math.abs(currentSpeed - s) < 0.03
                  ? 'bg-cyan-500 text-slate-950 font-bold shadow'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

      {/* Commercial Soundbed Mixer */}
      <div className="p-3 bg-slate-950/40 rounded-xl border border-slate-800/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-slate-400">
          <Music size={14} className="text-indigo-400 flex-shrink-0" />
          <span className="font-medium text-slate-300">Commercial BGM Bed:</span>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={selectedBgm}
            onChange={(e) => handleBgmChange(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 outline-none flex-1 sm:flex-initial"
          >
            {SOUNDBED_TRACKS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>

          {selectedBgm !== 'none' && (
            <div className="flex items-center gap-1.5 pl-1">
              <span className="text-[10px] text-slate-500">Vol:</span>
              <input
                type="range"
                min="0.05"
                max="0.4"
                step="0.05"
                value={bgmVolume}
                onChange={(e) => setBgmVolume(parseFloat(e.target.value))}
                className="w-16 h-1 bg-slate-700 rounded appearance-none accent-indigo-400 cursor-pointer"
                title="BGM Volume"
              />
            </div>
          )}
        </div>
      </div>

      <audio ref={audioRef} src={item.url} className="hidden" preload="auto" />
    </div>
  );
};
