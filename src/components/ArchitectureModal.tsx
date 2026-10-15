import React from 'react';
import { X, Network, CheckCircle, ArrowDown, ArrowRight, Cpu, Layers } from 'lucide-react';

interface ArchitectureModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ArchitectureModal: React.FC<ArchitectureModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-700/80 rounded-2xl p-6 shadow-2xl space-y-6 my-8 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              <Network className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">System Architecture & Research Pipeline</h3>
              <p className="text-xs text-slate-400">RoadSense AI multi-modal dataflow and mathematical fusion specification</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ASCII & Graph Flow Diagram */}
        <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-4">
          <div className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider">
            1. Conceptual Pipeline Hierarchy
          </div>

          <div className="p-4 rounded-lg bg-slate-900/90 font-mono text-[11px] text-slate-300 leading-relaxed overflow-x-auto whitespace-pre">
{`                 USER SELECTS LOCATION (Lat, Lng, Radius)
                         │
                         ▼
                ┌──────────────────┐
                │ Geospatial Layer │
                │ OSM + Coordinates│
                └────────┬─────────┘
                         │
          ┌──────────────┴──────────────┐
          ▼                             ▼
   Satellite Images              Ground Images
          │                             │
          ▼                             ▼
  Satellite Models              Vision Models
          │                             │
     ┌────┴─────┐                ┌──────┴──────┐
     ▼          ▼                ▼             ▼
Segmentation  Change          Detection    Classification
   (U-Net)   (Siamese)         (YOLOv8)      (ViT)
     │          │                │             │
     └──────────┴────────────────┴─────────────┘
                         │
                         ▼
                  FEATURE EXTRACTION
                         │
                         ▼
             CALIBRATED RISK ENGINE
     (0.30·Defect + 0.20·Surf + 0.20·Δ + 0.15·Infra + 0.15·Geom)
                         │
                         ▼
                 EXPLAINABLE RESULT (XAI)
                         │
                         ▼
                  INTERACTIVE MAP`}
          </div>
        </div>

        {/* The 6 Fixed Road Risk Factors (Section 1) */}
        <div className="space-y-3">
          <div className="text-xs font-mono font-bold text-slate-200 uppercase tracking-wider">
            2. Fixed Set of Road-Risk Factors (Input ➔ AI Output)
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-mono text-[11px]">
                  <th className="py-2.5 px-3">Risk Factor</th>
                  <th className="py-2.5 px-3">Primary Input</th>
                  <th className="py-2.5 px-3">AI Model / Output</th>
                  <th className="py-2.5 px-3">Target Representation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300 text-[11px]">
                <tr>
                  <td className="py-2.5 px-3 font-semibold text-white">Potholes</td>
                  <td className="py-2.5 px-3 text-amber-400">Ground Image</td>
                  <td className="py-2.5 px-3 text-cyan-300">YOLOv8 Detection</td>
                  <td className="py-2.5 px-3 text-slate-400">Bounding boxes / severity</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-semibold text-white">Cracks</td>
                  <td className="py-2.5 px-3 text-amber-400">Ground Image</td>
                  <td className="py-2.5 px-3 text-cyan-300">YOLOv8 + Grad-CAM</td>
                  <td className="py-2.5 px-3 text-slate-400">Segmentation mask / severity</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-semibold text-white">Road Surface</td>
                  <td className="py-2.5 px-3 text-amber-400">Ground Image</td>
                  <td className="py-2.5 px-3 text-cyan-300">ViT-B/16 Classifier</td>
                  <td className="py-2.5 px-3 text-slate-400">Good / moderate / poor / critical</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-semibold text-white">Road Geometry</td>
                  <td className="py-2.5 px-3 text-blue-400">Satellite + OSM</td>
                  <td className="py-2.5 px-3 text-cyan-300">U-Net Segmentation</td>
                  <td className="py-2.5 px-3 text-slate-400">Road alignment / carriageway width</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-semibold text-white">Missing Infrastructure</td>
                  <td className="py-2.5 px-3 text-indigo-400">Satellite + OSM</td>
                  <td className="py-2.5 px-3 text-cyan-300">Overpass Tag Analysis</td>
                  <td className="py-2.5 px-3 text-slate-400">Sidewalk, crossing, signal deficit</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-semibold text-white">Construction / Change</td>
                  <td className="py-2.5 px-3 text-fuchsia-400">Multi-date Satellite</td>
                  <td className="py-2.5 px-3 text-cyan-300">Bi-Temporal Siamese CNN</td>
                  <td className="py-2.5 px-3 text-slate-400">Change mask & excavation hotspots</td>
                </tr>
                <tr className="bg-slate-950 font-bold">
                  <td className="py-2.5 px-3 text-emerald-400">Overall Road Risk</td>
                  <td className="py-2.5 px-3 text-white">All Modalities</td>
                  <td className="py-2.5 px-3 text-emerald-400">Weighted Fusion Engine</td>
                  <td className="py-2.5 px-3 text-emerald-300">0–100 calibrated score</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Engineering Architecture Stack (Section 14 & 15) */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-xs">
          <div className="font-bold text-white">3. Geospatial Production Stack</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1 text-slate-400">
            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
              <span className="font-semibold text-cyan-300 block mb-1">Frontend Layer</span>
              React + Leaflet + Tailwind CSS with dynamic vector layers and Grad-CAM visualizer.
            </div>
            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
              <span className="font-semibold text-cyan-300 block mb-1">Geospatial Backend</span>
              Spring Boot + PostGIS geospatial indexing + Overpass API query proxy.
            </div>
            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
              <span className="font-semibold text-cyan-300 block mb-1">ML Inference API</span>
              FastAPI + PyTorch (YOLOv8, U-Net ResNet-34, Siamese Change Detection, ViT).
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition-colors"
          >
            Close Architecture Guide
          </button>
        </div>
      </div>
    </div>
  );
};
