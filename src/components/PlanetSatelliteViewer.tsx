import React, { useState, useEffect } from 'react';
import {
  Satellite,
  RefreshCw,
  Calendar,
  Cloud,
  Sun,
  Maximize2,
  Sliders,
  ExternalLink,
  Layers,
  ArrowRight,
  GitCompare,
  AlertCircle,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { LocationPreset, PlanetScene } from '../types';
import { searchPlanetScenes } from '../services/integrationsClient';

interface PlanetSatelliteViewerProps {
  currentLocation: LocationPreset;
  onSelectSceneForOverhead?: (scene: PlanetScene) => void;
}

export const PlanetSatelliteViewer: React.FC<PlanetSatelliteViewerProps> = ({
  currentLocation,
  onSelectSceneForOverhead,
}) => {
  const [scenes, setScenes] = useState<PlanetScene[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [maxCloudCover, setMaxCloudCover] = useState<number>(0.2);
  const [selectedSceneA, setSelectedSceneA] = useState<PlanetScene | null>(null);
  const [selectedSceneB, setSelectedSceneB] = useState<PlanetScene | null>(null);
  const [compareMode, setCompareMode] = useState<boolean>(false);
  const [previewScene, setPreviewScene] = useState<PlanetScene | null>(null);

  const loadScenes = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await searchPlanetScenes({
        lat: currentLocation.lat,
        lng: currentLocation.lng,
        radiusKm: currentLocation.radiusKm || 2,
        maxCloudCover,
      });
      setScenes(res.features);
      if (res.features.length >= 2) {
        // Default Scene A (newer) and Scene B (older)
        setSelectedSceneA(res.features[0]);
        setSelectedSceneB(res.features[Math.min(res.features.length - 1, 4)]);
      } else if (res.features.length === 1) {
        setSelectedSceneA(res.features[0]);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to query Planet Labs API.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadScenes();
  }, [currentLocation.id, maxCloudCover]);

  // Format date helper
  const formatDate = (isoString?: string) => {
    if (!isoString) return 'N/A';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  const getDaysBetween = (d1?: string, d2?: string) => {
    if (!d1 || !d2) return 0;
    try {
      const diff = Math.abs(new Date(d1).getTime() - new Date(d2).getTime());
      return Math.round(diff / (1000 * 60 * 60 * 24));
    } catch {
      return 0;
    }
  };

  return (
    <div className="bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-800 p-5 shadow-2xl space-y-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-cyan-600 text-white flex items-center justify-center border border-indigo-400/30 shadow-lg shadow-indigo-950/50">
            <Satellite className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white tracking-tight">
                Planet Labs Satellite Explorer
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                PlanetScope 3m Constellation
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Live multi-date overhead captures for {currentLocation.name} ({currentLocation.city})
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-xs text-slate-300 font-mono">
            <Cloud className="w-3.5 h-3.5 text-cyan-400" />
            <span>Max Cloud:</span>
            <select
              value={maxCloudCover}
              onChange={(e) => setMaxCloudCover(parseFloat(e.target.value))}
              className="bg-transparent border-none text-cyan-300 font-bold focus:outline-none cursor-pointer"
            >
              <option value="0.1" className="bg-slate-900">10%</option>
              <option value="0.2" className="bg-slate-900">20%</option>
              <option value="0.3" className="bg-slate-900">30%</option>
              <option value="0.5" className="bg-slate-900">50%</option>
            </select>
          </div>

          <button
            onClick={loadScenes}
            disabled={isLoading}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700 disabled:opacity-50"
            title="Refresh Planet Scenes"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs font-mono flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="py-12 text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin mx-auto" />
          <div className="text-sm font-bold text-white">
            Querying Planet Labs Satellite Constellation
          </div>
          <p className="text-xs text-slate-400 font-mono max-w-sm mx-auto">
            Searching PlanetScope Dove satellites passing over [{currentLocation.lat.toFixed(4)}, {currentLocation.lng.toFixed(4)}]...
          </p>
        </div>
      )}

      {/* Scene Content */}
      {!isLoading && scenes.length > 0 && (
        <div className="space-y-4">
          {/* Bi-Temporal Comparison Banner */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950/50 border border-indigo-500/30">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <GitCompare className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs font-bold text-white">
                    Multi-Date Temporal Change Analysis
                  </span>
                  <span className="text-[10px] font-mono text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                    Δ {selectedSceneA && selectedSceneB ? getDaysBetween(selectedSceneA.acquired, selectedSceneB.acquired) : 0} Days
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed font-mono">
                  Compare two distinct Planet satellite passes to detect road corridor excavation, surface deterioration, or widening works.
                </p>
              </div>

              <button
                onClick={() => setCompareMode(!compareMode)}
                className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 shrink-0 shadow-md shadow-indigo-950/40"
              >
                <GitCompare className="w-3.5 h-3.5" />
                <span>{compareMode ? 'Exit Dual View' : 'Compare Two Scenes'}</span>
              </button>
            </div>

            {/* Dual Compare View */}
            {compareMode && selectedSceneA && selectedSceneB && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-800">
                {/* Scene A (Current / T2) */}
                <div className="p-3 rounded-xl bg-slate-900 border border-indigo-500/40 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-cyan-300 font-mono flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-cyan-400" />
                      Current Pass (T2)
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      Cloud: {selectedSceneA.cloudCover}%
                    </span>
                  </div>
                  <div className="aspect-video bg-black rounded-lg overflow-hidden relative border border-slate-800 group">
                    <img
                      src={selectedSceneA.thumbnailUrl}
                      alt={selectedSceneA.id}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute bottom-2 left-2 bg-slate-950/80 px-2 py-0.5 rounded text-[10px] font-mono text-white">
                      {formatDate(selectedSceneA.acquired)}
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono flex justify-between">
                    <span>GSD: {selectedSceneA.groundSampleDistance}m</span>
                    <span>Sun Elev: {selectedSceneA.sunElevation}°</span>
                  </div>
                </div>

                {/* Scene B (Baseline / T1) */}
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-700 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-amber-300 font-mono flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-400" />
                      Baseline Pass (T1)
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      Cloud: {selectedSceneB.cloudCover}%
                    </span>
                  </div>
                  <div className="aspect-video bg-black rounded-lg overflow-hidden relative border border-slate-800 group">
                    <img
                      src={selectedSceneB.thumbnailUrl}
                      alt={selectedSceneB.id}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute bottom-2 left-2 bg-slate-950/80 px-2 py-0.5 rounded text-[10px] font-mono text-white">
                      {formatDate(selectedSceneB.acquired)}
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono flex justify-between">
                    <span>GSD: {selectedSceneB.groundSampleDistance}m</span>
                    <span>Sun Elev: {selectedSceneB.sunElevation}°</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Grid of Real Planet Scenes */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-300 font-mono">
                Available PlanetScope Scenes ({scenes.length} passes)
              </span>
              <span className="text-[11px] text-slate-500 font-mono">
                Click to select for comparison or overhead preview
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[360px] overflow-y-auto p-1">
              {scenes.map((scene) => {
                const isA = selectedSceneA?.id === scene.id;
                const isB = selectedSceneB?.id === scene.id;

                return (
                  <div
                    key={scene.id}
                    onClick={() => {
                      if (compareMode) {
                        if (!isA) setSelectedSceneB(scene);
                      } else {
                        setSelectedSceneA(scene);
                      }
                    }}
                    className={`p-2.5 rounded-xl border transition-all cursor-pointer space-y-2 group ${
                      isA
                        ? 'bg-cyan-950/40 border-cyan-500 shadow-md shadow-cyan-950/50'
                        : isB
                        ? 'bg-amber-950/40 border-amber-500 shadow-md shadow-amber-950/50'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="aspect-video bg-black rounded-lg overflow-hidden relative border border-slate-800/80">
                      <img
                        src={scene.thumbnailUrl}
                        alt={scene.id}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                      <div className="absolute top-1 right-1 bg-slate-950/85 px-1.5 py-0.5 rounded text-[9px] font-mono text-slate-300 flex items-center gap-1">
                        <Cloud className="w-2.5 h-2.5 text-cyan-400" />
                        <span>{scene.cloudCover}%</span>
                      </div>
                      {(isA || isB) && (
                        <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold text-white bg-indigo-600">
                          {isA ? 'Scene A (T2)' : 'Scene B (T1)'}
                        </div>
                      )}
                    </div>

                    <div className="space-y-1">
                      <div className="text-[11px] font-bold text-slate-200 truncate font-mono">
                        {formatDate(scene.acquired)}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono flex items-center justify-between">
                        <span>{scene.satelliteId}</span>
                        <span>{scene.groundSampleDistance}m GSD</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && scenes.length === 0 && !error && (
        <div className="py-8 text-center text-slate-400 text-xs font-mono space-y-2">
          <Satellite className="w-8 h-8 text-slate-600 mx-auto" />
          <p>No Planet satellite scenes found for the current cloud threshold.</p>
          <button
            onClick={() => setMaxCloudCover(0.5)}
            className="text-cyan-400 hover:underline text-xs"
          >
            Increase cloud cover tolerance to 50%
          </button>
        </div>
      )}

      {/* Footer Attribution */}
      <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500 font-mono">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>Planet Labs Data API (Direct Constellation Feed)</span>
        </div>
        <span className="text-[10px] text-slate-400">Resolution: 3.0m PlanetScope</span>
      </div>
    </div>
  );
};
