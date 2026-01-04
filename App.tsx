
import React, { useState, useRef, useEffect } from 'react';
import { Camera, RefreshCw, Scissors, ChevronRight, Activity, ShoppingBag, X, Upload, Plus, Download, AlertCircle, Sparkles } from 'lucide-react';
import CameraFeed, { CameraFeedHandle } from './components/CameraFeed';
import { analyzeFaceImage, generateTryOnImage } from './services/geminiService';
import { supabase } from './services/supabaseClient';
import { HAIRSTYLE_CATALOG } from './constants'; // Fallback catalog
import { FaceAnalysis, AppState, HairstyleItem } from './types';

function App() {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [analysis, setAnalysis] = useState<FaceAnalysis | null>(null);
  const [selectedHairstyle, setSelectedHairstyle] = useState<HairstyleItem | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [userSnapshot, setUserSnapshot] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [uploadedHairstyles, setUploadedHairstyles] = useState<HairstyleItem[]>([]);
  const [dbHairstyles, setDbHairstyles] = useState<HairstyleItem[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);
  
  const cameraRef = useRef<CameraFeedHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const styleInputRef = useRef<HTMLInputElement>(null);

  // --- Initialization ---
  
  useEffect(() => {
    const fetchCatalog = async () => {
      setIsLoadingCatalog(true);
      
      // If Supabase is not configured (client is null), fallback immediately
      if (!supabase) {
        setDbHairstyles(HAIRSTYLE_CATALOG);
        setIsLoadingCatalog(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('hairstyles') // Changed table name target
          .select('*');
        
        if (error) {
          // If table doesn't exist (42P01) or other error, fallback to static data
          if (error.code === '42P01' || error.message.includes('Could not find the table')) {
             console.warn('Database table "hairstyles" not found. Using static catalog.');
          } else {
             console.warn('Error fetching from DB, using fallback:', error.message);
          }
          setDbHairstyles(HAIRSTYLE_CATALOG);
        } else if (data && data.length > 0) {
          setDbHairstyles(data as HairstyleItem[]);
        } else {
           setDbHairstyles(HAIRSTYLE_CATALOG);
        }
      } catch (err: any) {
        console.warn('Supabase connection issue, using fallback:', err.message || err);
        setDbHairstyles(HAIRSTYLE_CATALOG);
      } finally {
        setIsLoadingCatalog(false);
      }
    };

    fetchCatalog();
  }, []);

  // --- Utilities ---

  /**
   * Standardizes an uploaded image to match the "Mirror" aspect ratio (9:16).
   */
  const standardizeImage = (base64Str: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const targetWidth = 1080;
        const targetHeight = 1920;
        
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(base64Str);
          return;
        }

        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, targetWidth, targetHeight);

        const scale = Math.min(targetWidth / img.width, targetHeight / img.height);
        const x = (targetWidth / 2) - (img.width / 2) * scale;
        const y = (targetHeight / 2) - (img.height / 2) * scale;

        ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
        
        resolve(canvas.toDataURL('image/jpeg', 0.9));
      };
      img.src = base64Str;
    });
  };

  // --- Handlers ---

  const handleError = (error: any) => {
    console.error(error);
    setErrorMsg("Something went wrong. Please check your connection or try again.");
    
    if (appState === AppState.GENERATING_TRYON) {
      setAppState(AppState.SHOPPING);
    } else {
      setAppState(AppState.IDLE);
    }
    
    setTimeout(() => setErrorMsg(null), 5000);
  };

  const handleScanFace = async () => {
    if (!cameraRef.current) return;
    
    cameraRef.current.triggerPoseSuccess();
    
    setTimeout(async () => {
        const snapshot = cameraRef.current?.captureFrame();
        if (!snapshot) return;
        await processUserImage(snapshot);
    }, 600);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const rawBase64 = reader.result as string;
        const standardizedImage = await standardizeImage(rawBase64);
        await processUserImage(standardizedImage);
      };
      reader.readAsDataURL(file);
    }
  };

  const processUserImage = async (imageSrc: string) => {
    setUserSnapshot(imageSrc);
    setAppState(AppState.ANALYZING);
    try {
        const result = await analyzeFaceImage(imageSrc);
        setAnalysis(result);
        setAppState(AppState.SHOPPING);
      } catch (err) {
        handleError(err);
      }
  }

  const handleStyleUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const newItem: HairstyleItem = {
          id: `custom-${Date.now()}`,
          name: 'Custom Look',
          category: 'Uploaded',
          description: 'A custom uploaded hairstyle reference',
          image: reader.result as string,
          isCustom: true
        };
        setUploadedHairstyles(prev => [newItem, ...prev]);
        setSelectedHairstyle(newItem);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleTryOn = async () => {
    if (!selectedHairstyle || !userSnapshot) return;

    setAppState(AppState.GENERATING_TRYON);
    
    try {
      const customImage = selectedHairstyle.isCustom ? selectedHairstyle.image : undefined;
      
      const resultImage = await generateTryOnImage(
        userSnapshot, 
        selectedHairstyle.description,
        customImage
      );
      
      setGeneratedImage(resultImage);
      setAppState(AppState.RESULT);
    } catch (err) {
      handleError(err);
    }
  };

  const handleDownload = () => {
    if (generatedImage) {
      const link = document.createElement('a');
      link.href = generatedImage;
      link.download = `magic-mirror-hair-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const resetProcess = () => {
    setAppState(AppState.IDLE);
    setGeneratedImage(null);
    setSelectedHairstyle(null);
    setAnalysis(null);
    setUserSnapshot(null);
    setUploadedHairstyles([]);
  };

  // Combine Uploaded items + DB items
  const fullCatalog = [...uploadedHairstyles, ...dbHairstyles];

  return (
    <div className="relative w-screen h-screen overflow-hidden font-sans selection:bg-pink-500/30">
      
      {/* Hidden Inputs */}
      <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />
      <input type="file" ref={styleInputRef} onChange={handleStyleUpload} accept="image/*" className="hidden" />

      {/* Layer 1: Background/Camera */}
      <div className={`absolute inset-0 transition-all duration-700 ${userSnapshot ? 'blur-sm opacity-50' : 'opacity-100'}`}>
         {!userSnapshot ? (
            <CameraFeed isActive={appState === AppState.IDLE || appState === AppState.ANALYZING} ref={cameraRef} />
         ) : (
            <img src={userSnapshot} className="w-full h-full object-contain bg-black" alt="User" />
         )}
      </div>

      {/* Layer 2: Result Overlay */}
      {appState === AppState.RESULT && generatedImage && (
        <div className="absolute inset-0 z-10 bg-black/60 backdrop-blur-md animate-in fade-in duration-700 flex items-center justify-center p-4">
           <img 
             src={generatedImage} 
             alt="Try On Result" 
             className="max-w-full max-h-full object-contain rounded-lg shadow-[0_0_50px_rgba(255,255,255,0.2)] border border-white/20" 
           />
        </div>
      )}

      {/* Layer 3: HUD (Glassmorphism) */}
      <div className="absolute inset-0 z-20 pointer-events-none flex flex-col justify-between p-6 md:p-8">
        
        {/* Header */}
        <header className="flex justify-between items-start">
          <div className="glass-panel px-6 py-4 rounded-2xl flex flex-col">
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-pink-300 to-indigo-300 bg-clip-text text-transparent">Magic Mirror</h1>
            <p className="text-xs text-gray-300 uppercase tracking-widest mt-1">Hair Studio</p>
          </div>
          
          {/* Status Chip */}
          <div className="glass-panel px-4 py-2 rounded-full flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full shadow-[0_0_10px_currentColor] ${appState === AppState.IDLE ? 'bg-green-400 text-green-400 animate-pulse' : 'bg-purple-400 text-purple-400'}`}></div>
            <span className="text-xs font-bold uppercase tracking-wider text-white/90">
              {appState === AppState.IDLE && "Ready to Scan"}
              {appState === AppState.ANALYZING && "Analyzing Features..."}
              {appState === AppState.SHOPPING && "Select Style"}
              {appState === AppState.GENERATING_TRYON && "Styling Hair..."}
              {appState === AppState.RESULT && "New Look Ready"}
            </span>
          </div>
        </header>

        {/* Error Notification */}
        {errorMsg && (
          <div className="absolute top-32 left-1/2 transform -translate-x-1/2 glass-panel border-l-4 border-red-500 text-white px-8 py-4 rounded-xl shadow-2xl animate-bounce flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Loading Spinner */}
        {(appState === AppState.ANALYZING || appState === AppState.GENERATING_TRYON) && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-tr from-pink-500 to-indigo-500 rounded-full blur-xl opacity-50 animate-pulse"></div>
              <div className="glass-card p-10 rounded-full">
                <RefreshCw className="w-12 h-12 text-white animate-spin" />
              </div>
            </div>
          </div>
        )}

        {/* Analysis Data Panel */}
        <div className={`pointer-events-auto transition-all duration-700 transform ${analysis ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0'} absolute left-6 md:left-12 top-40 w-72`}>
          {analysis && (
            <div className="glass-panel p-6 rounded-2xl space-y-5 hover:bg-white/10 transition-colors">
              <div className="flex items-center gap-3 text-pink-300 border-b border-white/10 pb-3">
                <Sparkles className="w-5 h-5" />
                <h2 className="font-bold uppercase tracking-widest text-sm">Face Analysis</h2>
              </div>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <label className="text-white/60 text-xs uppercase">Shape</label>
                  <div className="text-white font-medium">{analysis.faceShape}</div>
                </div>
                <div className="flex justify-between items-center">
                  <label className="text-white/60 text-xs uppercase">Skin Tone</label>
                  <div className="text-white font-medium">{analysis.skinTone}</div>
                </div>
                 <div className="flex justify-between items-center">
                  <label className="text-white/60 text-xs uppercase">Current</label>
                  <div className="text-pink-300 font-bold text-sm text-right">{analysis.currentHairTexture}</div>
                </div>
                 <div className="pt-3 border-t border-white/10">
                  <label className="text-white/60 text-xs uppercase block mb-1">Stylist Tip</label>
                  <p className="text-white/90 italic text-xs leading-relaxed font-light">"{analysis.styleAdvice}"</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Interface */}
        <div className="pointer-events-auto flex flex-col md:flex-row items-end md:items-center justify-between w-full mt-auto gap-6">
          
          {/* Hairstyle Selector */}
          {appState === AppState.SHOPPING && (
            <div className="w-full md:w-auto overflow-x-auto flex gap-4 pb-4 md:pb-0 scroll-smooth px-2 py-4 mask-gradient">
              {/* Upload Card */}
              <button
                onClick={() => styleInputRef.current?.click()}
                className="glass-card flex-shrink-0 w-32 md:w-40 aspect-[3/4] rounded-2xl flex flex-col items-center justify-center gap-2 hover:bg-white/10 transition-all border-dashed border-2 border-white/30 text-white/70 hover:text-white hover:border-white"
              >
                <Plus className="w-8 h-8" />
                <span className="text-xs font-bold uppercase">Upload</span>
              </button>

              {/* Loading State for DB items */}
              {isLoadingCatalog && (
                <div className="flex-shrink-0 w-32 md:w-40 aspect-[3/4] rounded-2xl glass-card flex items-center justify-center animate-pulse">
                   <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                </div>
              )}

              {/* Catalog Items */}
              {!isLoadingCatalog && fullCatalog.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSelectedHairstyle(item)}
                  className={`relative group flex-shrink-0 w-32 md:w-40 aspect-[3/4] rounded-2xl overflow-hidden transition-all duration-300 ${selectedHairstyle?.id === item.id ? 'ring-2 ring-pink-400 scale-105 shadow-[0_0_30px_rgba(236,72,153,0.3)]' : 'opacity-80 hover:opacity-100 hover:scale-105'}`}
                >
                  <div className="absolute inset-0 bg-gray-900">
                    <img src={item.image} alt={item.name} className="w-full h-full object-cover opacity-90 group-hover:opacity-100" />
                  </div>
                  <div className="absolute inset-x-0 bottom-0 glass-panel border-0 border-t rounded-none p-3 pt-6 text-left">
                    <p className="text-xs font-bold text-white truncate">{item.name}</p>
                    {item.isCustom && <span className="text-[9px] bg-purple-500 px-1 rounded text-white inline-block mt-1">CUSTOM</span>}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Controls */}
          <div className="flex gap-4 ml-auto items-center">
            {/* IDLE State Controls */}
            {appState === AppState.IDLE && (
              <div className="flex gap-3">
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="glass-button p-4 rounded-full text-white hover:scale-110 transition-transform"
                  title="Upload Photo"
                >
                  <Upload className="w-6 h-6" />
                </button>
                <button 
                  onClick={handleScanFace}
                  className="glass-button px-8 py-4 rounded-full text-white font-bold tracking-widest uppercase hover:bg-white/10 transition-all shadow-[0_0_30px_rgba(255,255,255,0.1)] hover:shadow-[0_0_50px_rgba(74,222,128,0.3)] flex items-center gap-3"
                >
                  <Camera className="w-6 h-6" />
                  <span>Scan Face</span>
                </button>
              </div>
            )}

            {/* SHOPPING State Controls */}
            {appState === AppState.SHOPPING && (
              <button 
                onClick={handleTryOn}
                disabled={!selectedHairstyle}
                className={`glass-button px-8 py-4 rounded-full font-bold tracking-widest uppercase flex items-center gap-3 transition-all ${selectedHairstyle ? 'text-white shadow-[0_0_40px_rgba(236,72,153,0.4)] hover:shadow-[0_0_60px_rgba(236,72,153,0.6)] bg-white/10' : 'text-gray-500 cursor-not-allowed opacity-50'}`}
              >
                <Scissors className="w-6 h-6" />
                <span>Style Hair</span>
                {selectedHairstyle && <ChevronRight className="w-5 h-5 animate-pulse" />}
              </button>
            )}

            {/* RESULT State Controls */}
            {appState === AppState.RESULT && (
              <div className="flex gap-3">
                <button 
                  onClick={handleDownload}
                  className="glass-button px-6 py-3 rounded-xl text-white font-semibold flex items-center gap-2 hover:bg-green-500/20 hover:border-green-500/50"
                  title="Save Result"
                >
                  <Download className="w-5 h-5" />
                  <span>Save</span>
                </button>
                 <button 
                  onClick={() => setAppState(AppState.SHOPPING)}
                  className="glass-button px-6 py-3 rounded-xl text-white font-semibold flex items-center gap-2 hover:bg-white/10"
                >
                  <ShoppingBag className="w-5 h-5" />
                  <span>Gallery</span>
                </button>
                <button 
                  onClick={resetProcess}
                  className="glass-button px-6 py-3 rounded-xl text-white font-semibold flex items-center gap-2 hover:bg-red-500/20 hover:border-red-500/50"
                >
                  <X className="w-5 h-5" />
                  <span>Close</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
