import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Camera, Upload, Loader2, Sparkles, RefreshCw, Scissors, UserCheck, Compass, CheckCircle, KeyRound } from 'lucide-react';
import { HairstyleResult } from './types';
import HairstyleCard from './components/HairstyleCard';

async function getApiError(response: Response, fallback: string) {
  const bodyText = await response.text().catch(() => '');
  if (!bodyText) return `${fallback} (API ${response.status})`;

  try {
    const body = JSON.parse(bodyText);
    return body.error || body.message || `${fallback} (API ${response.status})`;
  } catch {
    const compactBody = bodyText.replace(/\s+/g, ' ').slice(0, 180);
    return `${fallback} (API ${response.status}): ${compactBody}`;
  }
}

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<HairstyleResult | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setApiKey(localStorage.getItem('geminiApiKey') || '');
  }, []);

  const handleApiKeyChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextKey = event.target.value.trim();
    setApiKey(nextKey);
    if (nextKey) {
      localStorage.setItem('geminiApiKey', nextKey);
    } else {
      localStorage.removeItem('geminiApiKey');
    }
  };

  const handleFileChange = (uploadedFile: File) => {
    if (!uploadedFile.type.startsWith('image/')) {
      setError('請選擇正確的圖片檔案 (PNG, JPG 等)');
      return;
    }
    setFile(uploadedFile);
    setError(null);
    setResult(null); // Clear previous suggestions when uploading a new file
  };

  const handleUploadClick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = event.target.files?.[0];
    if (uploadedFile) {
      handleFileChange(uploadedFile);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const triggerAnalysis = async () => {
    if (!file) {
      setError('請先上傳您的照片');
      return;
    }
    if (!apiKey) {
      setError('請先輸入 Gemini API key');
      return;
    }
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('photo', file);

    try {
      const response = await fetch('/api/generate-hairstyles', {
        method: 'POST',
        headers: {
          'X-Gemini-Api-Key': apiKey,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(await getApiError(response, '髮型建議生成失敗'));
      }

      const data = await response.json();
      setResult(data);
    } catch (err: any) {
      console.error('Error conducting analysis:', err);
      setError(err.message || '連線逾時，請重試');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setResult(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[#070A12] text-[#F8FAFC] p-4 md:p-8 font-sans antialiased selection:bg-cyan-300 selection:text-slate-950">
      
      {/* Header Bar */}
      <header className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4 mb-8 border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <motion.div 
            whileHover={{ scale: 1.05 }}
            className="w-10 h-10 bg-cyan-400 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/25"
          >
            <Camera className="text-slate-950 w-5.5 h-5.5" />
          </motion.div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              MirrorAI <span className="text-cyan-300 text-xl font-semibold">髮型小幫手</span>
            </h1>
            <p className="text-xs text-slate-500 font-medium tracking-wide">Nano Banana 2 視覺擬真引擎</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {file && (
            <motion.button 
              whileTap={{ scale: 0.95 }}
              onClick={handleReset}
              className="px-4 py-2 bg-white/5 border border-white/10 rounded-full text-xs font-semibold text-slate-200 hover:bg-white/10 hover:text-red-300 shadow-sm transition flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              重新開始
            </motion.button>
          )}
          <a
            href="https://ai.studio/build"
            target="_blank"
            rel="noreferrer"
            className="text-xs text-slate-500 hover:text-cyan-300 font-semibold tracking-tight transition"
          >
            AI Studio Build
          </a>
        </div>
      </header>

      <main className="max-w-7xl mx-auto">
        <AnimatePresence mode="wait">
          {!result && !loading ? (
            /* Upload & Onboarding Frame */
            <motion.div
              key="uploader"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="max-w-3xl mx-auto mt-6"
            >
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold tracking-tight mb-2 text-white">探索您的完美髮型</h2>
                <p className="text-slate-400 text-sm max-w-md mx-auto">
                  上傳您的清晰正面照，AI 專家系統將深度分析您的臉部線條與特徵，為您即時擬真渲染出 9 款專屬設計。
                </p>
              </div>

              <label className="mb-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 shadow-lg shadow-black/20 focus-within:border-cyan-300/70">
                <KeyRound className="h-4 w-4 shrink-0 text-cyan-300" />
                <input
                  type="password"
                  value={apiKey}
                  onChange={handleApiKeyChange}
                  placeholder="輸入 Gemini API key"
                  className="min-w-0 flex-1 bg-transparent text-sm font-medium text-white outline-none placeholder:text-slate-600"
                  autoComplete="off"
                />
                <span className="hidden shrink-0 text-[10px] font-semibold text-slate-500 sm:inline">
                  已儲存在此瀏覽器
                </span>
              </label>

              {/* Drag n Drop Active Card */}
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`w-full bg-[#0D1322]/90 rounded-3xl p-8 border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center text-center cursor-pointer min-h-[350px] relative overflow-hidden group shadow-2xl shadow-black/30 ${
                  isDragActive 
                    ? "border-cyan-300 bg-cyan-400/10 scale-[0.99]" 
                    : "border-white/10 hover:border-cyan-300/80 hover:shadow-cyan-500/10 shadow-sm"
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleUploadClick}
                  accept="image/*"
                  className="hidden"
                />

                <AnimatePresence mode="wait">
                  {file ? (
                    <motion.div 
                      key="file-preview"
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="flex flex-col items-center gap-4 relative z-10 w-full max-w-xs"
                      onClick={(e) => e.stopPropagation()} // Prevent refiring input click
                    >
                      <div className="relative w-48 h-48 rounded-2xl overflow-hidden border border-cyan-300/30 shadow-lg shadow-cyan-500/10 group-hover:scale-[1.02] transition duration-300">
                        <img 
                          src={URL.createObjectURL(file)} 
                          alt="Preview" 
                          className="w-full h-full object-cover"
                        />
                        <button
                          onClick={handleReset}
                          className="absolute inset-0 bg-black/40 text-white font-semibold text-xs flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-200"
                        >
                          更換照片
                        </button>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-300 font-mono mb-1 truncate">{file.name}</p>
                        <p className="text-[10px] text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div 
                      key="empty-state"
                      initial={{ scale: 0.95, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="flex flex-col items-center gap-4 text-center"
                    >
                      <div className="w-16 h-16 bg-cyan-400/10 rounded-2xl flex items-center justify-center text-cyan-300 group-hover:bg-cyan-300/20 transition duration-300 shadow-lg shadow-cyan-500/10">
                        <Upload className="w-8 h-8" />
                      </div>
                      <div>
                        <p className="font-bold text-white text-lg">拖曳或點擊上傳正面照</p>
                        <p className="text-xs text-slate-500 mt-1">支持 PNG, JPG, JPEG 格式</p>
                      </div>
                      <div className="flex gap-4 mt-2">
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-300 font-semibold bg-white/5 border border-white/10 px-3 py-1 rounded-full">
                          <Scissors className="w-3.5 h-3.5 text-cyan-300" />
                          髮型重塑
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-300 font-semibold bg-white/5 border border-white/10 px-3 py-1 rounded-full">
                          <UserCheck className="w-3.5 h-3.5 text-cyan-300" />
                          特徵辨識
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {isDragActive && (
                  <div className="absolute inset-0 bg-cyan-400/10 backdrop-blur-xs flex items-center justify-center">
                    <p className="text-cyan-200 font-bold text-lg animate-pulse">釋放滑鼠以上傳照片</p>
                  </div>
                )}
              </div>

              {error && (
                <div className="mt-4 p-4.5 bg-red-500/10 rounded-2xl border border-red-400/30 text-red-200 text-xs text-center font-medium leading-relaxed shadow-sm">
                  {error}
                </div>
              )}

              {file && (
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={triggerAnalysis}
                  className="w-full mt-6 py-4 bg-cyan-300 text-slate-950 font-semibold text-sm rounded-2xl hover:bg-cyan-200 shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 transition"
                >
                  <Sparkles className="w-4 h-4 text-fuchsia-600" />
                  開始 AI 臉型與 9 款髮型設計建議
                </motion.button>
              )}
            </motion.div>
          ) : loading ? (
            /* Loading Shimmer frame */
            <motion.div
              key="loader-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="max-w-md mx-auto py-16 flex flex-col items-center justify-center text-center"
            >
              <div className="relative mb-6">
                <div className="w-16 h-16 rounded-full border-4 border-white/10 border-t-cyan-300 animate-spin" />
                <Sparkles className="w-6 h-6 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-cyan-300 animate-pulse" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">MirrorAI 智慧分析中</h3>
              <p className="text-sm text-slate-400 leading-relaxed mb-4">
                正在辨識您的臉型輪廓、五官比例、適合髮色與量身訂製 9 套髮型草案，這大約需要 3-5 秒...
              </p>
              <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                <div className="bg-cyan-300 h-full w-2/3 rounded-full animate-pulse shadow-sm shadow-cyan-500/30" />
              </div>
            </motion.div>
          ) : (
            /* Full Bento Grid Interface */
            <motion.div
              key="results-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-12 gap-5"
            >
              {/* Left Pane - Source Photo & Detected Face Info */}
              <section className="col-span-12 lg:col-span-3 flex flex-col gap-4">
                {/* Captured Photo Bento block */}
                <div className="bg-[#0D1322] rounded-3xl p-5 border border-white/10 shadow-2xl shadow-black/25 flex flex-col gap-3 relative overflow-hidden">
                  <div className="relative aspect-square w-full bg-slate-950 rounded-2xl overflow-hidden shadow-inner border border-white/10">
                    {file && (
                      <img 
                        src={URL.createObjectURL(file)} 
                        alt="My uploaded face" 
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold tracking-wider text-cyan-300 uppercase block mb-1">MirrorAI 智慧辨識</span>
                    <h3 className="text-lg font-bold text-white flex items-center gap-1.5">
                      {result?.faceShape || "鵝蛋臉 · 淺膚色"}
                      <CheckCircle className="w-4 h-4 text-emerald-500" />
                    </h3>
                  </div>
                </div>

                {/* AI Professional Report Bento block */}
                <div className="bg-fuchsia-600 rounded-3xl p-6 text-white flex flex-col justify-between shadow-lg shadow-fuchsia-500/20 min-h-[220px]">
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Compass className="w-4.5 h-4.5 text-fuchsia-100" />
                      <h3 className="text-xs font-bold uppercase tracking-widest text-fuchsia-100">AI 護髮與身形診斷</h3>
                    </div>
                    <p className="text-sm leading-relaxed font-medium">
                      {result?.analysisReport || "您的額頭比例完美，額角寬度適中，適合露出額頭的修剪或輕薄法式瀏海，以便更均勻地擴展整體的立體感與面部輪廓。"}
                    </p>
                  </div>
                  <div className="pt-4 border-t border-white/20 text-[10px] text-fuchsia-100 font-mono flex justify-between items-center">
                    <span>STATUS: ALL SENSORS READ</span>
                    <span>9/9 SCHEMES</span>
                  </div>
                </div>
              </section>

              {/* Right Bento Grid - 9 Custom Hairstyle Suggestions */}
              <section className="col-span-12 lg:col-span-9">
                <div className="mb-4">
                  <h3 className="text-lg font-bold text-white tracking-tight">為您推薦 9 種黃金比例髮型</h3>
                  <p className="text-xs text-slate-500">髮型圖片採用 Nano Banana 2 視覺生圖神經網路進行即時渲染更替，依序生成完畢即可直接下載保存。</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {result?.suggestions.map((suggestion, idx) => (
                    file && (
                      <HairstyleCard 
                        key={suggestion.id} 
                        suggestion={suggestion} 
                        photo={file} 
                        index={idx}
                        apiKey={apiKey}
                      />
                    )
                  ))}
                </div>
              </section>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
