import React, { useState, useEffect, useRef } from 'react';
import { Upload, FileVideo, Download, History, Trash2, Play, CheckCircle, AlertCircle, Languages, Loader2, Sparkles, Settings, X, Eye, EyeOff } from 'lucide-react';
import { SubtitleItem, HistoryItem, GenerationStatus, OutputFormat } from './types';
import { generateSrtContent, generateAssContent, downloadFile } from './utils';
import { generateSubtitles, proofreadSubtitles } from './gemini';

const STORAGE_KEY = 'gemini_subtitle_history';

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState<number>(0);
  const [status, setStatus] = useState<GenerationStatus>(GenerationStatus.IDLE);
  const [progressMsg, setProgressMsg] = useState('');
  const [subtitles, setSubtitles] = useState<SubtitleItem[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // API Keys State - initialized from env but mutable via Settings
  const [apiKeys, setApiKeys] = useState({
    gemini: process.env.API_KEY || '',
    openai: process.env.OPENAI_API_KEY || ''
  });

  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showOpenAIKey, setShowOpenAIKey] = useState(false);

  const isProcessing = status === GenerationStatus.UPLOADING || status === GenerationStatus.PROCESSING || status === GenerationStatus.PROOFREADING;

  // --- Initialization ---
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setHistory(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to load history");
      }
    }
  }, []);

  // --- Helpers ---
  const getFileDuration = (f: File): Promise<number> => {
    return new Promise((resolve) => {
      const element = f.type.startsWith('audio') 
        ? new Audio() 
        : document.createElement('video');
      
      element.preload = 'metadata';
      const url = URL.createObjectURL(f);
      element.src = url;

      element.onloadedmetadata = () => {
        resolve(element.duration);
        URL.revokeObjectURL(url);
      };
      element.onerror = () => {
        resolve(0);
        URL.revokeObjectURL(url);
      };
    });
  };

  const saveToHistory = (subs: SubtitleItem[], currentFile: File) => {
    const newItem: HistoryItem = {
      id: Date.now().toString(),
      fileName: currentFile.name,
      date: new Date().toLocaleString(),
      subtitles: subs
    };
    const existing = history.filter(h => h.fileName !== currentFile.name);
    const updatedHistory = [newItem, ...existing].slice(0, 10);
    setHistory(updatedHistory);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedHistory));
  };

  // --- Handlers ---

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setError(null);
      setSubtitles([]);
      setStatus(GenerationStatus.IDLE);
      
      try {
        const d = await getFileDuration(selectedFile);
        setDuration(d);
      } catch (e) {
        console.warn("Could not determine duration", e);
        setDuration(0);
      }
    }
  };

  const handleGenerate = async () => {
    // Input Validation
    if (!file) {
      setError("Please upload a video or audio file first.");
      return;
    }

    const effectiveGeminiKey = apiKeys.gemini.trim();
    const effectiveOpenaiKey = apiKeys.openai.trim();

    if (!effectiveGeminiKey) {
      setError("Gemini API Key is missing. Please configure it in Settings.");
      setShowSettings(true);
      return;
    }
    if (!effectiveOpenaiKey) {
      setError("OpenAI API Key is missing. Please configure it in Settings.");
      setShowSettings(true);
      return;
    }

    setStatus(GenerationStatus.UPLOADING);
    setError(null);

    try {
      const result = await generateSubtitles(file, duration, effectiveGeminiKey, effectiveOpenaiKey, (msg) => setProgressMsg(msg));
      
      if (result.length === 0) {
        throw new Error("No subtitles were generated.");
      }

      setSubtitles(result);
      setStatus(GenerationStatus.COMPLETED);
      saveToHistory(result, file);

    } catch (err: any) {
      setStatus(GenerationStatus.ERROR);
      setError(err.message);
    }
  };

  const handleProofread = async () => {
    if (subtitles.length === 0 || !file) return;
    const effectiveKey = apiKeys.gemini.trim();
    
    if (!effectiveKey) {
      setError("Gemini API Key is missing. Please configure it in Settings.");
      setShowSettings(true);
      return;
    }

    setStatus(GenerationStatus.PROOFREADING);
    setError(null);

    try {
      const refined = await proofreadSubtitles(subtitles, effectiveKey, (msg) => setProgressMsg(msg));
      setSubtitles(refined);
      setStatus(GenerationStatus.COMPLETED);
      saveToHistory(refined, file);
    } catch (err: any) {
      setStatus(GenerationStatus.ERROR);
      setError("Proofreading failed: " + err.message);
    }
  };

  const handleDownload = (format: OutputFormat) => {
    if (!subtitles.length) return;
    
    const fileNameBase = file?.name.split('.').slice(0, -1).join('.') || 'subtitles';
    const content = format === 'srt' 
      ? generateSrtContent(subtitles)
      : generateAssContent(subtitles, fileNameBase);
    
    downloadFile(`${fileNameBase}.${format}`, content, format);
  };

  const loadFromHistory = (item: HistoryItem) => {
    setSubtitles(item.subtitles);
    setStatus(GenerationStatus.COMPLETED);
    setFile({ name: item.fileName, size: 0 } as File); 
    setShowHistory(false);
    setError(null);
  };

  const clearHistory = () => {
    if(confirm("Clear all history?")) {
        setHistory([]);
        localStorage.removeItem(STORAGE_KEY);
    }
  };

  const StatusBadge = () => {
    switch (status) {
      case GenerationStatus.PROCESSING:
      case GenerationStatus.UPLOADING:
        return (
          <div className="flex items-center space-x-2 text-blue-400 bg-blue-400/10 px-4 py-2 rounded-full animate-pulse">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm font-medium">{progressMsg || 'Processing...'}</span>
          </div>
        );
      case GenerationStatus.PROOFREADING:
        return (
          <div className="flex items-center space-x-2 text-purple-400 bg-purple-400/10 px-4 py-2 rounded-full animate-pulse">
            <Sparkles className="w-4 h-4 animate-spin" />
            <span className="text-sm font-medium">{progressMsg || 'Polishing Translations...'}</span>
          </div>
        );
      case GenerationStatus.COMPLETED:
        return (
          <div className="flex items-center space-x-2 text-emerald-400 bg-emerald-400/10 px-4 py-2 rounded-full">
            <CheckCircle className="w-4 h-4" />
            <span className="text-sm font-medium">Complete</span>
          </div>
        );
      case GenerationStatus.ERROR:
        return (
          <div className="flex items-center space-x-2 text-red-400 bg-red-400/10 px-4 py-2 rounded-full">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm font-medium">Error</span>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="flex justify-between items-center pb-6 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg shadow-indigo-500/20">
              <Languages className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Gemini Subtitle Pro</h1>
              <p className="text-sm text-slate-400">Whisper Transcription + Gemini Translation</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <button 
              onClick={() => setShowSettings(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors text-sm font-medium group"
              title="Configure API Keys"
            >
              <Settings className="w-4 h-4 text-slate-400 group-hover:text-emerald-400 transition-colors" />
              <span className="hidden sm:inline">Settings</span>
            </button>
            <button 
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors text-sm font-medium"
            >
              <History className="w-4 h-4" />
              <span className="hidden sm:inline">History</span>
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Upload & Controls */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* Upload Card */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-sm">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center">
                <Upload className="w-5 h-5 mr-2 text-indigo-400" />
                Upload Media
              </h2>
              
              <div className="relative group">
                <input 
                  type="file" 
                  accept="video/*,audio/*" 
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  disabled={isProcessing}
                />
                <div className={`
                  border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300
                  ${file ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-slate-700 hover:border-indigo-500/50 hover:bg-indigo-500/5'}
                `}>
                  <div className="flex justify-center mb-4">
                    {file ? (
                      <FileVideo className="w-12 h-12 text-emerald-400" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center">
                         <Upload className="w-6 h-6 text-slate-400 group-hover:text-indigo-400" />
                      </div>
                    )}
                  </div>
                  {file ? (
                    <div>
                      <p className="text-emerald-400 font-medium truncate max-w-[200px] mx-auto">{file.name}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {(file.size / (1024*1024)).toFixed(2)} MB
                        {duration > 0 && ` • ${Math.floor(duration / 60)}:${Math.floor(duration % 60).toString().padStart(2,'0')}`}
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-slate-300 font-medium">Click or drag video/audio</p>
                      <p className="text-xs text-slate-500 mt-2">Supports MP4, MP3, WAV, MKV</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6">
                <button
                  onClick={handleGenerate}
                  disabled={isProcessing}
                  className={`
                    w-full py-3 px-4 rounded-xl font-semibold text-white shadow-lg transition-all
                    flex items-center justify-center space-x-2
                    ${isProcessing
                      ? 'bg-slate-700 text-slate-400 cursor-wait' 
                      : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-indigo-500/25 hover:shadow-indigo-500/40 cursor-pointer'
                    }
                  `}
                >
                  {isProcessing ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Play className="w-5 h-5 fill-current" />
                  )}
                  <span>{status === GenerationStatus.IDLE || status === GenerationStatus.COMPLETED || status === GenerationStatus.ERROR ? 'Generate with Whisper' : 'Generating...'}</span>
                </button>
              </div>

              {error && (
                <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400 flex items-start space-x-2 animate-fade-in">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span className="break-words w-full">{error}</span>
                </div>
              )}
            </div>

            {/* Download Options */}
            {(status === GenerationStatus.COMPLETED || status === GenerationStatus.PROOFREADING) && (
              <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 shadow-xl animate-fade-in">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center">
                  <Download className="w-5 h-5 mr-2 text-emerald-400" />
                  Download
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => handleDownload('srt')}
                    className="flex items-center justify-center space-x-2 p-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 rounded-lg transition-all"
                  >
                    <span className="font-bold text-slate-200">.SRT</span>
                    <span className="text-xs text-slate-500">Universal</span>
                  </button>
                  <button
                    onClick={() => handleDownload('ass')}
                    className="flex items-center justify-center space-x-2 p-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 rounded-lg transition-all"
                  >
                    <span className="font-bold text-slate-200">.ASS</span>
                    <span className="text-xs text-slate-500">Styled</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Preview & History */}
          <div className="lg:col-span-2 flex flex-col">
            
            {/* Status Bar */}
            <div className="flex items-center justify-between mb-4 h-10">
              <div className="flex items-center space-x-3">
                <h2 className="text-lg font-semibold text-white">
                  {showHistory ? 'History' : 'Subtitle Preview'}
                </h2>
                {!showHistory && subtitles.length > 0 && status === GenerationStatus.COMPLETED && (
                  <button 
                    onClick={handleProofread}
                    className="flex items-center space-x-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-lg text-xs font-bold text-white shadow-md transition-all animate-fade-in"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Proofread with Gemini 3 Pro</span>
                  </button>
                )}
              </div>
              <StatusBadge />
            </div>

            {/* Main Content Area */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col shadow-2xl relative h-[600px]">
              
              {showHistory ? (
                /* History View */
                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                  {history.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-50">
                      <History className="w-12 h-12 mb-2" />
                      <p>No history yet</p>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-end mb-2">
                         <button onClick={clearHistory} className="text-xs text-red-400 hover:text-red-300 flex items-center">
                           <Trash2 className="w-3 h-3 mr-1" /> Clear All
                         </button>
                      </div>
                      {history.map((item) => (
                        <div 
                          key={item.id} 
                          onClick={() => loadFromHistory(item)}
                          className="bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-indigo-500/50 p-4 rounded-xl cursor-pointer transition-all group"
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-medium text-slate-200 group-hover:text-indigo-300 transition-colors">{item.fileName}</h4>
                              <p className="text-xs text-slate-500 mt-1">{item.date}</p>
                            </div>
                            <span className="text-xs bg-slate-700 px-2 py-1 rounded text-slate-400">
                              {item.subtitles.length} lines
                            </span>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              ) : (
                /* Subtitle Preview View */
                <div className="flex-1 overflow-y-auto custom-scrollbar relative">
                  {subtitles.length > 0 ? (
                    <div className="divide-y divide-slate-800">
                      {subtitles.map((sub) => (
                        <div key={sub.id} className="p-4 hover:bg-slate-800/30 transition-colors group">
                          <div className="flex items-start space-x-4">
                            <div className="text-xs font-mono text-slate-500 min-w-[80px] pt-1">
                              {sub.startTime.split(',')[0]}
                            </div>
                            <div className="flex-1 space-y-1">
                              <p className="text-slate-300 leading-relaxed">{sub.original}</p>
                              <p className="text-indigo-300 leading-relaxed font-medium">{sub.translated}</p>
                            </div>
                            <div className="text-xs font-mono text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity">
                              #{sub.id}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                     <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-600">
                        <div className="w-16 h-16 border-2 border-slate-700 border-dashed rounded-full flex items-center justify-center mb-4">
                           <Languages className="w-6 h-6" />
                        </div>
                        <p className="font-medium">No subtitles generated yet</p>
                        <p className="text-sm mt-2 max-w-xs text-center opacity-70">Upload a video or audio file to start.</p>
                     </div>
                  )}
                </div>
              )}
              
            </div>
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl relative">
            <button 
              onClick={() => setShowSettings(false)} 
              className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            
            <h2 className="text-xl font-bold text-white mb-6 flex items-center">
              <Settings className="w-5 h-5 mr-2 text-indigo-400" />
              API Settings
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Gemini API Key</label>
                <div className="relative">
                  <input 
                    type={showGeminiKey ? "text" : "password"}
                    value={apiKeys.gemini}
                    onChange={(e) => setApiKeys({...apiKeys, gemini: e.target.value})}
                    placeholder="Enter Gemini API Key"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2.5 pl-3 pr-10 text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm"
                  />
                  <button 
                    onClick={() => setShowGeminiKey(!showGeminiKey)}
                    className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
                  >
                    {showGeminiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">OpenAI API Key (for Whisper)</label>
                <div className="relative">
                  <input 
                    type={showOpenAIKey ? "text" : "password"}
                    value={apiKeys.openai}
                    onChange={(e) => setApiKeys({...apiKeys, openai: e.target.value})}
                    placeholder="Enter OpenAI API Key"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2.5 pl-3 pr-10 text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm"
                  />
                   <button 
                    onClick={() => setShowOpenAIKey(!showOpenAIKey)}
                    className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
                  >
                    {showOpenAIKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button 
                  onClick={() => setShowSettings(false)}
                  className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-medium py-2.5 rounded-lg shadow-lg shadow-indigo-500/25 transition-all"
                >
                  Save & Close
                </button>
              </div>
              
              <p className="text-xs text-slate-500 text-center pt-2">
                Keys entered here override environment variables.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}