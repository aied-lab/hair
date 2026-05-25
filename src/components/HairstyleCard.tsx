import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, RefreshCw, AlertCircle, Sparkles, CheckCircle, Download, Volume2, VolumeX } from 'lucide-react';
import { Suggestion } from '../types';

async function getApiError(response: Response, fallback: string) {
  const bodyText = await response.text().catch(() => '');
  if (!bodyText) return `${fallback} (API ${response.status})`;

  try {
    const body = JSON.parse(bodyText);
    return body.error || body.message || `${fallback} (API ${response.status})`;
  } catch {
    const compactBody = bodyText.replace(/\s+/g, ' ').slice(0, 160);
    return `${fallback} (API ${response.status}): ${compactBody}`;
  }
}

interface HairstyleCardProps {
  key?: React.Key | string | number | null;
  suggestion: Suggestion;
  photo: File;
  index: number;
  apiKey: string;
}

export default function HairstyleCard({ suggestion, photo, index, apiKey }: HairstyleCardProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'queued' | 'generating' | 'success' | 'error'>('queued');
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [ttsLoading, setTtsLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const fetchHairstyleImage = async () => {
    setLoading(true);
    setStatus('generating');
    setError(null);

    const formData = new FormData();
    formData.append('photo', photo);
    formData.append('prompt', suggestion.prompt);

    try {
      const response = await fetch('/api/generate-hairstyle-image', {
        method: 'POST',
        headers: {
          'X-Gemini-Api-Key': apiKey,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(await getApiError(response, '生成失敗'));
      }

      const data = await response.json();
      setImageUrl(data.imageUrl);
      setStatus('success');
    } catch (err: any) {
      console.error(`Error generating image for ${suggestion.name}:`, err);
      setError(err.message || '連線錯誤，請重試');
      setStatus('error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Spacer delay to stagger requests and avoid API rate limit throttling
    const delay = index * 1800;
    const timer = setTimeout(() => {
      fetchHairstyleImage();
    }, delay);

    return () => clearTimeout(timer);
  }, [suggestion, photo, apiKey]);

  // Clean up TTS when component unmounts or audioUrl changes
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, [audioUrl]);

  // Download high-res generated image
  const handleDownload = () => {
    if (!imageUrl) return;
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `MirrorAI_${suggestion.name}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Speaks the comment out loud with high-quality Gemini TTS
  const toggleTTS = async () => {
    // If already playing, toggle pause
    if (audioRef.current && isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }

    // If we have already loaded the voice file, play it
    if (audioUrl && audioRef.current) {
      try {
        setIsPlaying(true);
        await audioRef.current.play();
      } catch (err) {
        console.error("Audio playback error:", err);
        setIsPlaying(false);
      }
      return;
    }

    // Call server API for Gemini premium TTS
    setTtsLoading(true);
    try {
      const textToSpeak = `${suggestion.name}。${suggestion.comment}`;
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Gemini-Api-Key': apiKey,
        },
        body: JSON.stringify({ text: textToSpeak }),
      });

      if (!response.ok) {
        throw new Error(await getApiError(response, 'Gemini TTS engine error'));
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);

      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => {
        setIsPlaying(false);
      };

      audio.onerror = () => {
        setIsPlaying(false);
      };

      setIsPlaying(true);
      await audio.play();
    } catch (err) {
      console.warn("Failed to stream Gemini TTS, falling back to local speech synthesis:", err);
      
      // Fallback: Local Speech Synthesis
      if (!window.speechSynthesis) return;
      window.speechSynthesis.cancel();

      const textToSpeak = `${suggestion.name}。${suggestion.comment}`;
      const utterance = new SpeechSynthesisUtterance(textToSpeak);

      const voices = window.speechSynthesis.getVoices();
      const chineseVoice = voices.find(v => v.lang.includes('zh-TW') || v.lang.includes('zh-HK'))
                         || voices.find(v => v.lang.includes('zh'));

      if (chineseVoice) {
        utterance.voice = chineseVoice;
      }
      utterance.rate = 0.95;

      utterance.onend = () => {
        setIsPlaying(false);
      };

      utterance.onerror = () => {
        setIsPlaying(false);
      };

      setIsPlaying(true);
      window.speechSynthesis.speak(utterance);
    } finally {
      setTtsLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      className={`relative group bg-[#0D1322] rounded-2xl p-4 border border-white/10 flex flex-col gap-3 shadow-xl shadow-black/20 hover:border-cyan-300/40 hover:shadow-cyan-500/10 transition-all duration-300 ${
        status === 'error' ? 'border-red-400/40 bg-red-500/10' : ''
      }`}
    >
      {/* Target aspect ratio square box for image */}
      <div className="relative aspect-square w-full bg-slate-950 rounded-xl overflow-hidden border border-white/10 shadow-sm">
        <AnimatePresence mode="wait">
          {status === 'queued' && (
            <motion.div
              key="queued"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 bg-slate-950 text-slate-500"
            >
              <div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-cyan-300 animate-spin mb-2" />
              <p className="text-xs font-medium">排隊等待生成中...</p>
              <p className="text-[10px] text-slate-600 mt-1">智慧排程避免 API 頻繁請求</p>
            </motion.div>
          )}

          {status === 'generating' && (
            <motion.div
              key="generating"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 bg-cyan-400/10 text-cyan-300"
            >
              <div className="relative mb-3 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin" />
                <Sparkles className="w-4 h-4 absolute text-fuchsia-300 animate-bounce" />
              </div>
              <p className="text-xs font-semibold">MirrorAI 髮型模擬中...</p>
              <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider font-mono">Nano Banana 2 Mode</p>
            </motion.div>
          )}

          {status === 'error' && (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 bg-red-500/10 text-red-200"
            >
              <AlertCircle className="w-8 h-8 mb-2" />
              <p className="text-xs font-semibold">生成模擬圖失敗</p>
              <p className="text-[10px] opacity-80 mt-1 mb-3 line-clamp-2 max-w-[180px]">{error}</p>
              <button
                onClick={fetchHairstyleImage}
                className="px-3 py-1 bg-red-500 text-white rounded-full text-[10px] font-medium hover:bg-red-400 transition flex items-center gap-1 shadow-sm"
              >
                <RefreshCw className="w-3 h-3" />
                重新生成
              </button>
            </motion.div>
          )}

          {status === 'success' && imageUrl && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute inset-0 w-full h-full"
            >
              <img
                src={imageUrl}
                alt={suggestion.name}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover select-none"
              />
              <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <button
                  onClick={handleDownload}
                  className="p-1.5 bg-slate-950/80 hover:bg-cyan-300 text-white hover:text-slate-950 rounded-full shadow-sm border border-white/10 transition"
                  title="下載圖片"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="absolute bottom-2 left-2 bg-emerald-400/95 text-slate-950 text-[9px] px-1.5 py-0.5 rounded flex items-center gap-1 font-semibold shadow-sm">
                <CheckCircle className="w-2.5 h-2.5" />
                AI 模擬完成
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Styled texts below the image */}
      <div className="flex-1 flex flex-col justify-between">
        <div className="flex justify-between items-start gap-2">
          <div className="flex items-center gap-1.5">
            <span className="w-5 h-5 bg-cyan-300 text-slate-950 rounded-full flex items-center justify-center text-[10px] font-bold font-mono">
              {suggestion.id}
            </span>
            <h4 className="font-bold text-sm text-white tracking-tight">{suggestion.name}</h4>
          </div>
          
          {/* TTS Audio narration Speaker Button */}
          {status === 'success' && (
            <button
              onClick={toggleTTS}
              disabled={ttsLoading}
              className={`p-1.5 rounded-lg flex items-center justify-center transition-all ${
                ttsLoading ? 'bg-cyan-400/10 cursor-wait' :
                isPlaying 
                  ? 'bg-cyan-300 text-slate-950 ring-2 ring-cyan-300/30 animate-pulse' 
                  : 'bg-white/5 hover:bg-white/10 text-slate-300'
              }`}
              title={ttsLoading ? "正在透過 Gemini 生成高畫質語音..." : isPlaying ? "停止語音說明" : "撥放語音說明"}
            >
              {ttsLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-300" />
              ) : isPlaying ? (
                <VolumeX className="w-3.5 h-3.5" />
              ) : (
                <Volume2 className="w-3.5 h-3.5" />
              )}
            </button>
          )}
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed mt-1.5 h-12 line-clamp-3">
          {suggestion.comment}
        </p>
      </div>

      {/* Hidden details in development to support aesthetic styling */}
      <div className="hidden text-[9px] font-mono text-slate-500 group-hover:block transition duration-200 mt-auto pt-1 border-t border-dashed border-white/10">
        Prompt: {suggestion.prompt}
      </div>
    </motion.div>
  );
}
