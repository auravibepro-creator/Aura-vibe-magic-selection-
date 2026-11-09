import React, { useState, useRef } from 'react';
import { Camera, Upload, Sparkles, Download, Mic, MicOff, Split, Wand2, Layers } from 'lucide-react';

interface PatternNode {
  id: string;
  name: string;
  level: 'macro' | 'meso' | 'micro';
  color: string;
  pixelCount: number;
  visible: boolean;
  canvas: HTMLCanvasElement | null;
  children?: PatternNode[];
}
interface ImageItem { id: string; src: string; name: string }

export default function PatternMasterStudio() {
  const [gallery, setGallery] = useState<ImageItem[]>([]);
  const [activeImageId, setActiveImageId] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [layerTree, setLayerTree] = useState<PatternNode[]>([]);
  const [sensitivity, setSensitivity] = useState(25);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Upload or capture an image to begin.');
  const [isListening, setIsListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mainCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const originalImageRef = useRef<HTMLImageElement | null>(null);

  const stopCamera = () => {
    const stream = videoRef.current?.srcObject as MediaStream | null;
    stream?.getTracks().forEach(track => track.stop());
    setIsCameraOpen(false);
  };

  const startCamera = async () => {
    setIsCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      console.error('Camera access failed', err);
      setStatusMessage('Could not access camera. Please check browser permissions.');
    }
  };

  const selectImage = (item: ImageItem) => {
    setActiveImageId(item.id);
    const img = new Image();
    img.src = item.src;
    img.onload = () => {
      originalImageRef.current = img;
      const canvas = mainCanvasRef.current;
      if (!canvas) return;
      let width = img.naturalWidth || img.width;
      let height = img.naturalHeight || img.height;
      const maxDim = 2000;
      if (width > maxDim || height > maxDim) {
        const scale = maxDim / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d')?.drawImage(img, 0, 0, width, height);
      setStatusMessage(`Loaded: ${item.name}. Ready for pattern decomposition.`);
      setLayerTree([]);
    };
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 1280;
    canvas.height = videoRef.current.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const item = { id: `img-${Date.now()}`, src: canvas.toDataURL('image/png'), name: `Camera Capture ${gallery.length + 1}` };
      setGallery(prev => [...prev, item]);
      selectImage(item);
    }
    stopCamera();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const items = Array.from(files).map((file, idx) => ({ id: `upload-${Date.now()}-${idx}`, src: URL.createObjectURL(file), name: file.name }));
    setGallery(prev => [...prev, ...items]);
    if (items.length && !activeImageId) selectImage(items[0]);
    e.target.value = '';
  };

  const executeDeepDecomposition = () => {
    const canvas = mainCanvasRef.current;
    if (!originalImageRef.current || !canvas) { setStatusMessage('Please select or capture an image first.'); return; }
    setIsProcessing(true);
    setStatusMessage('Extracting multi-level pattern layers (Macro, Meso, Micro)...');
    window.setTimeout(() => {
      try {
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas context unavailable');
        const { width, height } = canvas;
        const data = ctx.getImageData(0, 0, width, height).data;
        const buckets: Record<string, { r: number; g: number; b: number; count: number }> = {};
        for (let i = 0; i < data.length; i += 16) {
          if (data[i + 3] < 50) continue;
          const r = Math.min(255, Math.round(data[i] / sensitivity) * sensitivity);
          const g = Math.min(255, Math.round(data[i + 1] / sensitivity) * sensitivity);
          const b = Math.min(255, Math.round(data[i + 2] / sensitivity) * sensitivity);
          const key = `${r}-${g}-${b}`;
          buckets[key] ??= { r, g, b, count: 0 };
          buckets[key].count++;
        }
        const colors = Object.values(buckets).sort((a, b) => b.count - a.count).slice(0, 4);
        const tree: PatternNode[] = colors.map((bucket, n) => {
          const macro = document.createElement('canvas'); macro.width = width; macro.height = height;
          const macroCtx = macro.getContext('2d')!;
          const macroPixels = macroCtx.createImageData(width, height);
          let count = 0;
          for (let i = 0; i < data.length; i += 4) {
            if (Math.abs(data[i] - bucket.r) + Math.abs(data[i + 1] - bucket.g) + Math.abs(data[i + 2] - bucket.b) <= sensitivity * 1.5) {
              macroPixels.data[i] = data[i]; macroPixels.data[i + 1] = data[i + 1]; macroPixels.data[i + 2] = data[i + 2]; macroPixels.data[i + 3] = 255; count++;
            }
          }
          macroCtx.putImageData(macroPixels, 0, 0);
          const meso = document.createElement('canvas'); meso.width = width; meso.height = height;
          const micro = document.createElement('canvas'); micro.width = width; micro.height = height;
          const mesoCtx = meso.getContext('2d')!; const microCtx = micro.getContext('2d')!;
          const mesoPixels = mesoCtx.createImageData(width, height); const microPixels = microCtx.createImageData(width, height);
          for (let y = 1; y < height - 1; y += 2) for (let x = 1; x < width - 1; x += 2) {
            const i = (y * width + x) * 4;
            if (!macroPixels.data[i + 3]) continue;
            const edge = Math.abs(data[i] - data[i + 4]) + Math.abs(data[i] - data[i + width * 4]);
            const target = edge > 35 ? microPixels.data : mesoPixels.data;
            target[i] = edge > 35 ? 255 : data[i]; target[i + 1] = edge > 35 ? 215 : data[i + 1];
            target[i + 2] = edge > 35 ? 0 : data[i + 2]; target[i + 3] = edge > 35 ? 255 : 220;
          }
          mesoCtx.putImageData(mesoPixels, 0, 0); microCtx.putImageData(microPixels, 0, 0);
          return { id: `macro-${n + 1}`, name: `Pattern Motif #${n + 1}`, level: 'macro' as const, color: `rgb(${bucket.r},${bucket.g},${bucket.b})`, pixelCount: count, visible: true, canvas: macro, children: [
            { id: `meso-${n + 1}`, name: `Inner Ornament Fill ${n + 1}`, level: 'meso' as const, color: `rgba(${bucket.r},${bucket.g},${bucket.b},0.8)`, pixelCount: Math.round(count * 0.6), visible: true, canvas: meso },
            { id: `micro-${n + 1}`, name: `Fine Stitch Detail ${n + 1}`, level: 'micro' as const, color: '#ffd700', pixelCount: Math.round(count * 0.15), visible: true, canvas: micro }
          ] };
        });
        setLayerTree(tree);
        setStatusMessage(`Decomposition complete: ${tree.length} primary motif hierarchies extracted.`);
      } catch (err) { console.error(err); setStatusMessage('Error during pattern decomposition.'); }
      finally { setIsProcessing(false); }
    }, 150);
  };

  const applyPremiumEnhance = () => {
    const canvas = mainCanvasRef.current;
    if (!canvas) return;
    setIsProcessing(true); setStatusMessage('Applying high-contrast embroidery enhancement...');
    window.setTimeout(() => {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const factor = (259 * (1.25 + 255)) / (255 * (259 - 1.25));
        for (let i = 0; i < image.data.length; i += 4) for (let c = 0; c < 3; c++) image.data[i + c] = Math.max(0, Math.min(255, factor * (image.data[i + c] - 128) + 128));
        ctx.putImageData(image, 0, 0);
      }
      setIsProcessing(false); setStatusMessage('Studio enhancement applied successfully!');
    }, 200);
  };

  const exportLayer = (layer: PatternNode, format: 'png' | 'svg') => {
    if (!layer.canvas) return;
    const link = document.createElement('a');
    link.download = `${layer.name.toLowerCase().replace(/\s+/g, '-')}.${format}`;
    if (format === 'png') link.href = layer.canvas.toDataURL('image/png');
    else {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${layer.canvas.width}" height="${layer.canvas.height}"><image width="100%" height="100%" href="${layer.canvas.toDataURL('image/png')}" /></svg>`;
      link.href = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    }
    link.click();
    if (format === 'svg') window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  };

  const toggleVoice = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) { setStatusMessage('Voice recognition is not supported in this browser.'); return; }
    if (isListening) { setIsListening(false); return; }
    const recognition = new SpeechRecognition();
    recognition.continuous = false; recognition.lang = 'en-US';
    recognition.onstart = () => { setIsListening(true); setStatusMessage("Listening: say 'decompose', 'camera', or 'premium'..."); };
    recognition.onresult = (event: any) => {
      const command = event.results[0][0].transcript.toLowerCase(); setVoiceTranscript(command);
      if (['separate', 'decompose', 'split', 'break'].some(word => command.includes(word))) executeDeepDecomposition();
      else if (command.includes('premium') || command.includes('enhance')) applyPremiumEnhance();
      else if (command.includes('camera') || command.includes('capture')) startCamera();
      else setStatusMessage(`Recognized: "${command}"`);
    };
    recognition.onerror = () => setIsListening(false); recognition.onend = () => setIsListening(false); recognition.start();
  };

  return <div className="flex h-screen w-full bg-slate-950 text-slate-100 font-sans overflow-hidden">
    <aside className="w-80 border-r border-slate-800 bg-slate-900/60 backdrop-blur flex flex-col p-4 gap-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800"><div className="flex items-center gap-2"><Sparkles className="w-5 h-5 text-indigo-400"/><span className="font-semibold text-sm uppercase tracking-wide">Aura Vibe Magic</span></div><button onClick={toggleVoice} className={`p-2 rounded-full border ${isListening ? 'bg-rose-500/20 border-rose-500 text-rose-400 animate-pulse' : 'bg-slate-800 border-slate-700 text-slate-300'}`}>{isListening ? <Mic className="w-4 h-4"/> : <MicOff className="w-4 h-4"/>}</button></div>
      <div className="grid grid-cols-2 gap-2"><label className="flex items-center justify-center gap-2 p-2.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 cursor-pointer text-xs font-medium"><Upload className="w-4 h-4 text-indigo-400"/><span>Upload Batch</span><input type="file" multiple accept="image/*" className="hidden" onChange={handleFileUpload}/></label><button onClick={startCamera} className="flex items-center justify-center gap-2 p-2.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-medium"><Camera className="w-4 h-4 text-emerald-400"/><span>Camera</span></button></div>
      <div className="flex-1 overflow-y-auto space-y-2"><div className="text-xs uppercase text-slate-400 font-semibold mb-2">Gallery ({gallery.length})</div>{gallery.length === 0 ? <div className="text-center py-8 text-xs text-slate-500 border border-dashed border-slate-800 rounded-lg">No images loaded.<br/>Upload or use camera.</div> : gallery.map(item => <div key={item.id} onClick={() => selectImage(item)} className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer border ${activeImageId === item.id ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-800 bg-slate-800/40'}`}><img src={item.src} alt={item.name} className="w-12 h-12 object-cover rounded bg-slate-900 border border-slate-700"/><div className="flex-1 min-w-0"><div className="text-xs font-medium text-slate-200 truncate">{item.name}</div><div className="text-[10px] text-slate-400 mt-0.5">Click to select</div></div></div>)}</div>
      <div className="space-y-3 pt-3 border-t border-slate-800"><div><div className="flex justify-between text-xs text-slate-400 mb-1"><span>Separation Sensitivity</span><span>{sensitivity}</span></div><input type="range" min="10" max="60" value={sensitivity} onChange={e => setSensitivity(Number(e.target.value))} className="w-full accent-indigo-500 h-1.5 bg-slate-700 rounded-lg cursor-pointer"/></div><button onClick={executeDeepDecomposition} disabled={isProcessing || !activeImageId} className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-medium text-xs"><Split className="w-4 h-4"/><span>Deep Auto Decompose</span></button><button onClick={applyPremiumEnhance} disabled={isProcessing || !activeImageId} className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white font-medium text-xs"><Wand2 className="w-4 h-4"/><span>Make It Premium</span></button></div>
    </aside>
    <main className="flex-1 flex flex-col bg-slate-950 relative"><div className="h-10 border-b border-slate-800 bg-slate-900/40 px-4 flex items-center justify-between text-xs text-slate-400"><div className="flex items-center gap-2"><span className={`w-2 h-2 rounded-full ${isProcessing ? 'bg-amber-400 animate-ping' : 'bg-emerald-400'}`}/><span>{statusMessage}</span></div>{voiceTranscript && <div className="italic">Voice: "{voiceTranscript}"</div>}</div><div className="flex-1 flex items-center justify-center p-6 overflow-auto bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px]"><canvas ref={mainCanvasRef} className="max-w-full max-h-full rounded-lg shadow-2xl border border-slate-800 object-contain"/></div>{isCameraOpen && <div className="absolute inset-0 bg-slate-950/90 backdrop-blur z-50 flex items-center justify-center p-6"><div className="max-w-xl w-full bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden"><video ref={videoRef} autoPlay playsInline className="w-full h-80 object-cover bg-black"/><div className="p-4 flex justify-between"><button onClick={stopCamera} className="px-4 py-2 text-xs text-slate-400">Cancel</button><button onClick={capturePhoto} className="px-6 py-2.5 rounded-full bg-emerald-500 text-slate-950 font-semibold text-xs"><Camera className="w-4 h-4 inline mr-2"/>Capture Photo</button></div></div></div>}</main>
    <aside className="w-80 border-l border-slate-800 bg-slate-900/60 backdrop-blur flex flex-col p-4"><div className="flex items-center gap-2 pb-3 border-b border-slate-800 mb-3"><Layers className="w-4 h-4 text-indigo-400"/><span className="font-semibold text-xs uppercase tracking-wider text-slate-300">Hierarchical Layers</span></div><div className="flex-1 overflow-y-auto space-y-3">{layerTree.length === 0 ? <div className="text-center py-16 text-xs text-slate-500 border border-dashed border-slate-800 rounded-lg">No layers extracted yet.<br/>Click "Deep Auto Decompose" to generate motifs.</div> : layerTree.map(layer => <div key={layer.id} className="border border-slate-800 rounded-lg bg-slate-800/40 p-2.5 space-y-2"><div className="flex items-center justify-between"><div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full border border-white/20" style={{ backgroundColor: layer.color }}/><span className="text-xs font-medium">{layer.name}</span></div><div className="flex gap-1"><button onClick={() => exportLayer(layer, 'png')} className="px-2 py-1 bg-slate-700 rounded text-[10px]">PNG</button><button onClick={() => exportLayer(layer, 'svg')} className="px-2 py-1 bg-indigo-600 rounded text-[10px]">SVG</button></div></div>{layer.children?.map(child => <div key={child.id} className="flex items-center justify-between pl-4 text-[11px] text-slate-400"><span>{child.name}</span><div className="flex gap-1"><button onClick={() => exportLayer(child, 'png')} className="px-1.5 py-0.5 bg-slate-800 rounded text-[9px]">PNG</button><button onClick={() => exportLayer(child, 'svg')} className="px-1.5 py-0.5 bg-indigo-950 rounded text-[9px]">SVG</button></div></div>)}</div>)}</div>{layerTree.length > 0 && <div className="pt-3 border-t border-slate-800"><button onClick={() => layerTree.forEach(layer => exportLayer(layer, 'svg'))} className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-slate-800 text-xs"><Download className="w-3.5 h-3.5 text-indigo-400"/><span>Export All as SVG</span></button></div>}</aside>
  </div>;
}
