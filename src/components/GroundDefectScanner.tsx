import React, { useState, useRef } from 'react';
import {
  Camera,
  Upload,
  Eye,
  Layers,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Sliders,
  Maximize2,
  RefreshCw,
  FileSearch,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { BoundingBox, DefectSeverity, SurfaceQuality } from '../types';
import { analyzeDefectWithGemini } from '../services/geminiClient';

interface SamplePhoto {
  id: string;
  title: string;
  category: string;
  url: string;
  gradCamUrl: string;
  surface: SurfaceQuality;
  defects: BoundingBox[];
}

const SAMPLE_GROUND_PHOTOS: SamplePhoto[] = [
  {
    id: 'sample-pothole-cluster',
    title: 'Severe Pothole Cluster & Water Infiltration',
    category: 'Urban Arterial (Old City)',
    url: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=1000&auto=format&fit=crop&q=80',
    gradCamUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1000&auto=format&fit=crop&q=80',
    surface: 'poor',
    defects: [
      {
        id: 'box-p1',
        type: 'pothole',
        label: 'Pothole (Depth > 8cm)',
        confidence: 0.94,
        severity: 'severe',
        x: 28,
        y: 50,
        width: 25,
        height: 20,
      },
      {
        id: 'box-p2',
        type: 'pothole',
        label: 'Sub-base Pothole',
        confidence: 0.89,
        severity: 'moderate',
        x: 58,
        y: 62,
        width: 20,
        height: 16,
      },
      {
        id: 'box-c1',
        type: 'severe_crack',
        label: 'Edge Alligator Cracking',
        confidence: 0.86,
        severity: 'severe',
        x: 15,
        y: 35,
        width: 32,
        height: 22,
      },
    ],
  },
  {
    id: 'sample-longitudinal-crack',
    title: 'Shear Longitudinal & Transverse Crack Joint',
    category: 'Bridge Approach',
    url: 'https://images.unsplash.com/photo-1542296332-2e4473faf563?w=1000&auto=format&fit=crop&q=80',
    gradCamUrl: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=1000&auto=format&fit=crop&q=80',
    surface: 'critical',
    defects: [
      {
        id: 'box-c2',
        type: 'severe_crack',
        label: 'Transverse Thermal Crack',
        confidence: 0.96,
        severity: 'severe',
        x: 20,
        y: 25,
        width: 15,
        height: 60,
      },
      {
        id: 'box-p3',
        type: 'pothole',
        label: 'Edge Spall Crater',
        confidence: 0.91,
        severity: 'severe',
        x: 45,
        y: 52,
        width: 26,
        height: 22,
      },
    ],
  },
  {
    id: 'sample-good-highway',
    title: 'Continuous High-Friction Asphalt Surface',
    category: 'Modern Express Highway',
    url: 'https://images.unsplash.com/photo-1578637387939-43c525550085?w=1000&auto=format&fit=crop&q=80',
    gradCamUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1000&auto=format&fit=crop&q=80',
    surface: 'good',
    defects: [],
  },
];

export const GroundDefectScanner: React.FC = () => {
  const [selectedPhoto, setSelectedPhoto] = useState<SamplePhoto>(SAMPLE_GROUND_PHOTOS[0]);
  const [showGradCam, setShowGradCam] = useState<boolean>(true);
  const [showBoundingBoxes, setShowBoundingBoxes] = useState<boolean>(true);
  const [confidenceThreshold, setConfidenceThreshold] = useState<number>(0.75);
  const [customImage, setCustomImage] = useState<string | null>(null);
  const [customDefects, setCustomDefects] = useState<BoundingBox[]>([]);
  const [customSurface, setCustomSurface] = useState<SurfaceQuality>('poor');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [isGeminiAnalyzing, setIsGeminiAnalyzing] = useState<boolean>(false);
  const [geminiAnalysis, setGeminiAnalysis] = useState<string | null>(null);
  const [geminiError, setGeminiError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const activePhotoUrl = customImage || selectedPhoto.url;
  const activeGradCamUrl = selectedPhoto.gradCamUrl;
  const activeDefects = customImage ? customDefects : selectedPhoto.defects;
  const activeSurface = customImage ? customSurface : selectedPhoto.surface;

  const filteredDefects = activeDefects.filter((d) => d.confidence >= confidenceThreshold);

  const handleRunGeminiVision = async () => {
    setIsGeminiAnalyzing(true);
    setGeminiError(null);

    try {
      const analysis = await analyzeDefectWithGemini({
        imageBase64: customImage || undefined,
        imageUrl: customImage ? undefined : selectedPhoto.url,
        defectType: customImage ? 'Custom Road Photo Defect' : selectedPhoto.title,
        roadName: customImage ? 'User Uploaded Segment' : selectedPhoto.category,
      });
      setGeminiAnalysis(analysis);
    } catch (err: any) {
      setGeminiError(err?.message || 'Failed to analyze road image with Gemini Vision.');
    } finally {
      setIsGeminiAnalyzing(false);
    }
  };

  // Handle custom upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const result = uploadEvent.target?.result as string;
      setCustomImage(result);
      setGeminiAnalysis(null);
      setGeminiError(null);
      setIsScanning(true);

      // Simulate live YOLO inference
      setTimeout(() => {
        setIsScanning(false);
        setCustomSurface('poor');
        setCustomDefects([
          {
            id: 'upload-box-1',
            type: 'pothole',
            label: 'Detected Pothole (Depth ~6cm)',
            confidence: 0.92,
            severity: 'severe',
            x: 32,
            y: 48,
            width: 28,
            height: 22,
          },
          {
            id: 'upload-box-2',
            type: 'severe_crack',
            label: 'Alligator Crack Cluster',
            confidence: 0.85,
            severity: 'moderate',
            x: 18,
            y: 30,
            width: 26,
            height: 18,
          },
        ]);
      }, 900);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div id="ground-defect-scanner-wrapper" className="space-y-6">
      {/* Header & Preset Switcher */}
      <div className="bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-800 p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-amber-400 mb-1">
              <Camera className="w-4 h-4 text-amber-400" />
              Street-Level Vision Model (YOLOv8 + Grad-CAM)
            </div>
            <h2 className="text-xl font-bold text-white">Ground Road Defect & Surface Inspector</h2>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="image/*"
              className="hidden"
            />
            <button
              id="btn-upload-ground-photo"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 px-3.5 py-2 rounded-xl transition-all shadow-lg shadow-amber-950/40"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Custom Road Photo</span>
            </button>
          </div>
        </div>

        {/* Preset Thumbnails */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4">
          {SAMPLE_GROUND_PHOTOS.map((photo) => {
            const isSelected = !customImage && selectedPhoto.id === photo.id;
            return (
              <button
                key={photo.id}
                onClick={() => {
                  setCustomImage(null);
                  setSelectedPhoto(photo);
                }}
                className={`p-3 rounded-xl text-left border transition-all flex items-center gap-3 ${
                  isSelected
                    ? 'bg-slate-800 border-amber-500/80 shadow-md shadow-amber-950/40'
                    : 'bg-slate-950/50 border-slate-800 hover:bg-slate-800/40 text-slate-400'
                }`}
              >
                <img src={photo.url} alt={photo.title} className="w-12 h-12 rounded-lg object-cover border border-slate-700" />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-white truncate">{photo.title}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5 truncate">{photo.category}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Vision Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Visual Canvas (2 cols) */}
        <div className="lg:col-span-2 bg-slate-900/95 backdrop-blur-md rounded-2xl border border-slate-800 p-5 shadow-2xl space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-200 flex items-center gap-2">
              <span>{customImage ? 'Uploaded Road Photo Analysis' : selectedPhoto.title}</span>
              {isScanning && (
                <span className="text-[10px] text-amber-400 font-mono flex items-center gap-1 animate-pulse">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  Running YOLOv8...
                </span>
              )}
            </span>

            {/* Canvas Overlay Toggles */}
            <div className="flex items-center gap-2">
              <button
                id="btn-toggle-boxes-scanner"
                onClick={() => setShowBoundingBoxes(!showBoundingBoxes)}
                className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                  showBoundingBoxes
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                    : 'bg-slate-950 text-slate-400 border-slate-800'
                }`}
              >
                Boxes ({filteredDefects.length})
              </button>

              <button
                id="btn-toggle-gradcam-scanner"
                onClick={() => setShowGradCam(!showGradCam)}
                className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                  showGradCam
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                    : 'bg-slate-950 text-slate-400 border-slate-800'
                }`}
              >
                Grad-CAM Heatmap
              </button>
            </div>
          </div>

          {/* Image Canvas with Overlay */}
          <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 h-[380px] flex items-center justify-center">
            <img
              src={activePhotoUrl}
              alt="Road Inspection"
              className="w-full h-full object-cover"
            />

            {/* Grad-CAM Attention Heatmap */}
            {showGradCam && (
              <img
                src={activeGradCamUrl}
                alt="Grad-CAM"
                className="absolute inset-0 w-full h-full object-cover mix-blend-screen opacity-60 pointer-events-none transition-opacity"
              />
            )}

            {/* YOLO Bounding Boxes */}
            {showBoundingBoxes &&
              filteredDefects.map((box) => (
                <div
                  key={box.id}
                  className="absolute border-2 border-rose-500 bg-rose-500/20 shadow-lg"
                  style={{
                    left: `${box.x}%`,
                    top: `${box.y}%`,
                    width: `${box.width}%`,
                    height: `${box.height}%`,
                  }}
                >
                  <div className="absolute -top-6 left-0 bg-rose-600 text-white text-[10px] font-mono px-1.5 py-0.5 rounded font-bold whitespace-nowrap shadow">
                    {box.label} ({Math.round(box.confidence * 100)}%)
                  </div>
                </div>
              ))}
          </div>

          {/* Confidence Slider Control */}
          <div className="flex items-center justify-between gap-4 p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs">
            <span className="text-slate-400 font-medium">YOLO Detection Confidence Threshold:</span>
            <div className="flex items-center gap-3 w-48">
              <input
                type="range"
                min="0.50"
                max="0.95"
                step="0.05"
                value={confidenceThreshold}
                onChange={(e) => setConfidenceThreshold(parseFloat(e.target.value))}
                className="w-full accent-amber-500"
              />
              <span className="font-mono font-bold text-amber-400 w-10 text-right">
                {Math.round(confidenceThreshold * 100)}%
              </span>
            </div>
          </div>
        </div>

        {/* Prediction Results & Defect Table (1 col) */}
        <div className="bg-slate-900/95 backdrop-blur-md rounded-2xl border border-slate-800 p-5 shadow-2xl space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-white border-b border-slate-800 pb-2">
              Vision Model Predictions
            </h3>

            {/* Classification Card */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="text-[10px] text-slate-500 font-mono uppercase">Surface Classification (CNN/ViT)</div>
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold uppercase font-mono text-cyan-400">{activeSurface}</span>
                <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  94.8% Conf
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Grad-CAM highlights localized aggregate raveling, bitumen oxidation, and high pore density in the red spectrum.
              </p>
            </div>

            {/* Detected Defects List */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-300">
                Detected Objects ({filteredDefects.length}):
              </div>

              {filteredDefects.length === 0 ? (
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-center text-xs text-slate-500">
                  No defects detected above {Math.round(confidenceThreshold * 100)}% confidence threshold.
                </div>
              ) : (
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {filteredDefects.map((d) => (
                    <div
                      key={d.id}
                      className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-200">{d.label}</span>
                        <span className="font-mono text-cyan-400">{(d.confidence * 100).toFixed(0)}%</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                        <span>Severity: <strong className="text-rose-400 capitalize">{d.severity}</strong></span>
                        <span>Type: {d.type}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-800">
            <button
              id="btn-run-gemini-vision"
              onClick={handleRunGeminiVision}
              disabled={isGeminiAnalyzing}
              className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-950/40 transition-all disabled:opacity-50"
            >
              {isGeminiAnalyzing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Gemini 3.8 Inspecting Distress...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Run Gemini 3.8 Vision Diagnostic</span>
                </>
              )}
            </button>
            <div className="text-[10px] text-slate-400 text-center font-mono">
              ASTM D6433 & AASHTO Pavement Condition Evaluation
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400 font-mono">
            Ground Vision Feed feeds into <strong>Stage 5 (Fusion)</strong> as normalized defect points.
          </div>
        </div>
      </div>

      {/* Gemini 3.8 Vision Deep Diagnostic Section */}
      {(geminiAnalysis || isGeminiAnalyzing || geminiError) && (
        <div className="bg-slate-900/95 backdrop-blur-md rounded-2xl border border-amber-500/40 p-5 shadow-2xl space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>Gemini 3.8 Flash Vision Diagnostic</span>
                  <span className="text-[10px] font-mono bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/30">
                    Active Multimodal
                  </span>
                </h3>
                <p className="text-[11px] text-slate-400 font-mono">
                  Target: {customImage ? 'Uploaded Road Image' : selectedPhoto.title}
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                setGeminiAnalysis(null);
                setGeminiError(null);
              }}
              className="text-xs text-slate-400 hover:text-white px-2.5 py-1 rounded-lg bg-slate-800"
            >
              Dismiss
            </button>
          </div>

          {isGeminiAnalyzing && (
            <div className="py-8 text-center space-y-3">
              <RefreshCw className="w-7 h-7 text-amber-400 animate-spin mx-auto" />
              <div className="text-sm font-semibold text-white">
                Multimodal Computer Vision Analysis in Progress
              </div>
              <p className="text-xs text-slate-400 font-mono max-w-md mx-auto">
                Gemini 3.8 Flash is analyzing asphalt distress textures, crack geometry, moisture infiltration, and estimating ASTM D6433 PCI deduction points...
              </p>
            </div>
          )}

          {geminiError && (
            <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs font-mono flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{geminiError}</span>
            </div>
          )}

          {geminiAnalysis && !isGeminiAnalyzing && (
            <div className="prose prose-invert prose-xs max-w-none text-slate-200 leading-relaxed space-y-3 p-4 rounded-xl bg-slate-950/80 border border-slate-800">
              <ReactMarkdown>{geminiAnalysis}</ReactMarkdown>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
