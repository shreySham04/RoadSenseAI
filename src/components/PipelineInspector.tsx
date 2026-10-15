import React, { useState } from 'react';
import {
  Layers,
  Satellite,
  Camera,
  GitCompare,
  Cpu,
  ShieldAlert,
  ArrowRight,
  CheckCircle2,
  Sliders,
  Sparkles,
  ExternalLink,
  Code,
  Eye,
  AlertTriangle,
  Play,
  RotateCcw,
  Compass,
  Globe,
} from 'lucide-react';
import { LocationPreset, RoadSegment } from '../types';
import { buildOverpassQL } from '../services/osmService';
import { computeRoadRisk, getRiskBadgeClasses } from '../services/riskEngine';
import { fetchGoogleMapsConfig } from '../services/integrationsClient';
import { StreetViewModal } from './StreetViewModal';

interface PipelineInspectorProps {
  currentLocation: LocationPreset;
  selectedRoad: RoadSegment | null;
  onSelectRoad: (road: RoadSegment) => void;
  onOpenPlanetSatellite?: () => void;
}

export const PipelineInspector: React.FC<PipelineInspectorProps> = ({
  currentLocation,
  selectedRoad,
  onSelectRoad,
  onOpenPlanetSatellite,
}) => {
  const [activeStage, setActiveStage] = useState<number>(1);
  const [isAutoPlaying, setIsAutoPlaying] = useState<boolean>(false);
  const [showGradCam, setShowGradCam] = useState<boolean>(true);
  const [showYoloBoxes, setShowYoloBoxes] = useState<boolean>(true);
  const [satelliteViewMode, setSatelliteViewMode] = useState<'t1' | 't2' | 'unet_mask' | 'change_mask'>('unet_mask');
  const [isStreetViewOpen, setIsStreetViewOpen] = useState<boolean>(false);
  const [gmapsConfig, setGmapsConfig] = useState<{ available: boolean; apiKey: string }>({
    available: false,
    apiKey: '',
  });

  React.useEffect(() => {
    fetchGoogleMapsConfig().then(setGmapsConfig);
  }, []);

  const road = selectedRoad || currentLocation.roads[0];
  const computed = computeRoadRisk(road);
  const sampleGround = currentLocation.sampleGroundImages[0];
  const overpassQL = buildOverpassQL(currentLocation.lat, currentLocation.lng, currentLocation.radiusKm);

  const stages = [
    {
      id: 1,
      name: 'Stage 1: Geospatial & OSM Layer',
      subtitle: 'Coordinates & Vector Infrastructure',
      icon: Layers,
      color: 'text-cyan-400',
      badge: 'Geospatial Foundation',
      summary: 'Extracts road geometry, highway tier, lane counts, sidewalks, and crossings via Overpass API.',
    },
    {
      id: 2,
      name: 'Stage 2: Satellite & U-Net Segmentation',
      subtitle: 'Sub-Meter Overhead Vision',
      icon: Satellite,
      color: 'text-blue-400',
      badge: 'Satellite U-Net',
      summary: 'Performs pixel-wise binary road mask segmentation to extract actual road alignment and carriageway width.',
    },
    {
      id: 3,
      name: 'Stage 3: Multi-Date Change Detection',
      subtitle: 'Bi-Temporal Difference (T1 vs T2)',
      icon: GitCompare,
      color: 'text-fuchsia-400',
      badge: 'Temporal Delta',
      summary: 'Detects structural road diversions, utility excavation, and ongoing heavy construction zones across time.',
    },
    {
      id: 4,
      name: 'Stage 4: Ground Vision Models',
      subtitle: 'YOLO Detection & CNN Classification',
      icon: Camera,
      color: 'text-amber-400',
      badge: 'Ground Visual AI',
      summary: 'YOLO detects discrete defects (potholes, cracks); CNN classifies continuous surface condition with Grad-CAM explainability.',
    },
    {
      id: 5,
      name: 'Stage 5: Multi-Modal Feature Fusion',
      subtitle: 'Cross-Modal Feature Matrix',
      icon: Cpu,
      color: 'text-purple-400',
      badge: 'Feature Fusion',
      summary: 'Unifies overhead geometry, ground visual evidence, temporal change, and OSM topological semantics into a single vector.',
    },
    {
      id: 6,
      name: 'Stage 6: Explainable Risk Engine',
      subtitle: 'Calibrated Risk Scoring (0–100)',
      icon: ShieldAlert,
      color: 'text-rose-400',
      badge: 'Final Prediction',
      summary: 'Calculates the final 0–100 road risk score with mathematically transparent factor contributor percentages.',
    },
  ];

  // Auto-play through stages
  const handleAutoRun = () => {
    setIsAutoPlaying(true);
    let step = 1;
    setActiveStage(1);
    const interval = setInterval(() => {
      step++;
      if (step > 6) {
        clearInterval(interval);
        setIsAutoPlaying(false);
      } else {
        setActiveStage(step);
      }
    }, 1800);
  };

  return (
    <div id="pipeline-inspector-container" className="space-y-6">
      {/* Top Banner & Flow Header */}
      <div className="bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-800 p-5 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 uppercase tracking-widest mb-1">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              Multi-Stage Computational Pipeline
            </div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span>RoadSense AI Architecture</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono font-normal">
                Analyzing: {road.name}
              </span>
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="btn-run-pipeline"
              onClick={handleAutoRun}
              disabled={isAutoPlaying}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                isAutoPlaying
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 animate-pulse cursor-wait'
                  : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-900/40 hover:shadow-cyan-800/60'
              }`}
            >
              <Play className="w-3.5 h-3.5" />
              <span>{isAutoPlaying ? 'Executing Stages...' : 'Simulate Full Pipeline Flow'}</span>
            </button>
          </div>
        </div>

        {/* Step Navigation Ribbon */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2 pt-4">
          {stages.map((stg) => {
            const Icon = stg.icon;
            const isActive = activeStage === stg.id;
            const isCompleted = activeStage > stg.id;

            return (
              <button
                key={stg.id}
                id={`btn-stage-${stg.id}`}
                onClick={() => setActiveStage(stg.id)}
                className={`relative flex flex-col p-3 rounded-xl text-left border transition-all ${
                  isActive
                    ? 'bg-slate-800/90 border-cyan-500/80 shadow-lg shadow-cyan-950/50 scale-[1.02]'
                    : isCompleted
                    ? 'bg-slate-900/60 border-slate-700/60 text-slate-300 hover:bg-slate-800/50'
                    : 'bg-slate-950/40 border-slate-800/60 text-slate-500 hover:bg-slate-900/40'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className={`p-1.5 rounded-lg ${isActive ? 'bg-cyan-500/20 text-cyan-300' : 'bg-slate-800 text-slate-400'}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  {isCompleted ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <span className="text-[10px] font-mono font-bold text-slate-500">#{stg.id}</span>
                  )}
                </div>
                <div className={`text-xs font-bold leading-snug line-clamp-1 ${isActive ? 'text-white' : 'text-slate-300'}`}>
                  {stg.name.split(':')[1]}
                </div>
                <div className="text-[10px] text-slate-400 truncate mt-0.5">{stg.subtitle}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Stage Detail Workspace */}
      <div className="bg-slate-900/95 backdrop-blur-md rounded-2xl border border-slate-800 p-6 shadow-2xl">
        {/* STAGE 1: GEOSPATIAL & OSM */}
        {activeStage === 1 && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-800">
              <div>
                <span className="text-xs font-mono font-semibold text-cyan-400">STAGE 1 / 6</span>
                <h3 className="text-lg font-bold text-white">Geospatial Foundation & OpenStreetMap Ingestion</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Spatial query for highway tags, lane geometry, intersections, bridges, and pedestrian infrastructure.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-slate-300">
                <span>Lat: {currentLocation.lat.toFixed(4)}</span>
                <span>•</span>
                <span>Lng: {currentLocation.lng.toFixed(4)}</span>
                <span>•</span>
                <span>R: {currentLocation.radiusKm} km</span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left: Overpass QL Query */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Code className="w-3.5 h-3.5 text-cyan-400" />
                    Overpass QL Geographic Request
                  </span>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    200 OK • 18 Elements
                  </span>
                </div>
                <pre className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-[11px] font-mono text-cyan-300/90 overflow-x-auto leading-relaxed h-[240px]">
                  {overpassQL}
                </pre>
                <div className="text-[11px] text-slate-400">
                  Extracts raw vector linestrings and OSM properties: <code className="text-slate-200">highway=*</code>, <code className="text-slate-200">lanes=*</code>, <code className="text-slate-200">sidewalk=*</code>, <code className="text-slate-200">lit=*</code>, and <code className="text-slate-200">surface=*</code>.
                </div>
              </div>

              {/* Right: Parsed Topological Attributes */}
              <div className="space-y-3">
                <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-cyan-400" />
                  Extracted Topological Features for: <span className="text-cyan-300">{road.name}</span>
                </span>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <div className="text-[10px] text-slate-500 uppercase font-mono">OSM Way ID</div>
                    <div className="text-sm font-mono font-bold text-slate-200">#{road.osmWayId}</div>
                    <div className="text-[10px] text-slate-500 mt-1">Highway: <span className="text-cyan-400 font-semibold uppercase">{road.osm.highwayType}</span></div>
                  </div>

                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <div className="text-[10px] text-slate-500 uppercase font-mono">Lanes & Speed Limit</div>
                    <div className="text-sm font-mono font-bold text-slate-200">{road.osm.lanes} Lanes ({road.osm.speedLimitKmh} km/h)</div>
                    <div className="text-[10px] text-slate-500 mt-1">Carriageway: <span className="text-cyan-400 font-semibold">{road.widthMeters}m</span></div>
                  </div>

                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <div className="text-[10px] text-slate-500 uppercase font-mono">Pedestrian Sidewalk</div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`w-2 h-2 rounded-full ${road.osm.hasSidewalk ? 'bg-emerald-400' : 'bg-rose-500'}`} />
                      <span className="text-xs font-semibold text-slate-200 capitalize">{road.osm.sidewalkType}</span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1">{road.osm.hasSidewalk ? 'Adequate buffer' : '⚠️ Missing sidewalk deficit'}</div>
                  </div>

                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <div className="text-[10px] text-slate-500 uppercase font-mono">Crossings & Signals</div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`w-2 h-2 rounded-full ${road.osm.hasCrossing ? 'bg-emerald-400' : 'bg-rose-500'}`} />
                      <span className="text-xs font-semibold text-slate-200">
                        {road.osm.hasCrossing ? 'Zebra Markings Present' : '⚠️ Missing Crossing'}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1">Traffic Signal: {road.osm.hasTrafficSignal ? 'Yes' : 'Uncontrolled'}</div>
                  </div>
                </div>

                <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 text-xs text-slate-300 flex items-center justify-between">
                  <span>Infrastructure Deficit Score:</span>
                  <span className="font-mono font-bold text-amber-400">{road.infrastructureScore}/100</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STAGE 2: SATELLITE & U-NET SEGMENTATION */}
        {activeStage === 2 && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-800">
              <div>
                <span className="text-xs font-mono font-semibold text-blue-400">STAGE 2 / 6</span>
                <h3 className="text-lg font-bold text-white">Satellite Imagery Acquisition & U-Net Road Segmentation</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Semantic segmentation of road pixels vs background to measure geometric alignment and carriageway width.
                </p>
              </div>

              {/* View Switcher */}
              <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                <button
                  onClick={() => setSatelliteViewMode('t1')}
                  className={`px-3 py-1 rounded-lg font-medium transition-colors ${satelliteViewMode === 't1' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  RGB Satellite
                </button>
                <button
                  onClick={() => setSatelliteViewMode('unet_mask')}
                  className={`px-3 py-1 rounded-lg font-medium transition-colors ${satelliteViewMode === 'unet_mask' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  U-Net Road Mask
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
              {/* Image / Mask Canvas */}
              <div className="relative rounded-2xl overflow-hidden border border-slate-800 h-[280px] bg-slate-950 flex items-center justify-center">
                <img
                  src={satelliteViewMode === 't1' ? currentLocation.satellite.t1ImageUrl : currentLocation.satellite.unetRoadMaskUrl}
                  alt="Satellite / U-Net"
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-3 left-3 bg-slate-950/80 backdrop-blur-md px-3 py-1 rounded-lg border border-slate-800 text-[11px] font-mono text-cyan-400">
                  {satelliteViewMode === 't1' ? 'Sentinel-2 / Landsat RGB (0.5m GSD)' : 'Binary Segmentation Mask (Road=255)'}
                </div>
              </div>

              {/* Architecture & Metrics Card */}
              <div className="space-y-4">
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                  <div className="text-xs font-semibold text-slate-200 flex items-center justify-between">
                    <span>U-Net (ResNet-34 Backbone)</span>
                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      IoU: {currentLocation.satellite.segmentationIoU.toFixed(3)}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                      <div className="text-[10px] text-slate-500 font-mono">Dice Score</div>
                      <div className="text-sm font-bold text-cyan-400">{currentLocation.satellite.segmentationDice.toFixed(3)}</div>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                      <div className="text-[10px] text-slate-500 font-mono">Detected Width</div>
                      <div className="text-sm font-bold text-slate-200">{road.widthMeters}m</div>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                      <div className="text-[10px] text-slate-500 font-mono">Constriction?</div>
                      <div className={`text-sm font-bold ${road.widthChanged ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {road.widthChanged ? 'Narrowed' : 'Normal'}
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-slate-400 leading-relaxed">
                    The U-Net model maps high-resolution overhead features into a continuous carriageway skeleton. Geometric deviations between the predicted centerline and OSM alignment flag unmapped pinch points.
                  </p>
                </div>

                <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 text-xs text-slate-300 flex items-center justify-between">
                  <span>Road Geometry Deviation Score:</span>
                  <span className="font-mono font-bold text-blue-400">{road.geometryScore}/100</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STAGE 3: MULTI-DATE CHANGE DETECTION */}
        {activeStage === 3 && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-800">
              <div>
                <span className="text-xs font-mono font-semibold text-fuchsia-400">STAGE 3 / 6</span>
                <h3 className="text-lg font-bold text-white">Satellite Temporal Change Detection (T1 vs T2)</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Bi-temporal imagery subtraction and Siamese CNN to isolate road widening, diversions, and construction disruption.
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs font-mono text-fuchsia-400 bg-fuchsia-500/10 px-3 py-1.5 rounded-lg border border-fuchsia-500/20">
                <span>Baseline T1: {currentLocation.satellite.t1Date}</span>
                <span>➔</span>
                <span>Current T2: {currentLocation.satellite.t2Date}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* T1 Imagery */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-300">T1 Historical Imagery ({currentLocation.satellite.t1Date})</div>
                <div className="h-48 rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
                  <img src={currentLocation.satellite.t1ImageUrl} alt="T1" className="w-full h-full object-cover" />
                </div>
                <div className="text-[11px] text-slate-500">Undisturbed pre-construction corridor state.</div>
              </div>

              {/* T2 Imagery */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-300">T2 Current Imagery ({currentLocation.satellite.t2Date})</div>
                <div className="h-48 rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
                  <img src={currentLocation.satellite.t2ImageUrl} alt="T2" className="w-full h-full object-cover" />
                </div>
                <div className="text-[11px] text-slate-500">Visible excavation, lane diversion, and ground scraping.</div>
              </div>

              {/* Change Mask */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-fuchsia-400 flex items-center justify-between">
                  <span>Siamese Change Mask Δ(T1, T2)</span>
                  <span className="text-[10px] font-mono text-fuchsia-300 font-bold">{road.changePercentage}%</span>
                </div>
                <div className="h-48 rounded-xl overflow-hidden border border-fuchsia-500/40 bg-slate-950 relative">
                  <img src={currentLocation.satellite.changeMaskUrl} alt="Change Mask" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-fuchsia-950/20 pointer-events-none" />
                </div>
                <div className="text-[11px] text-slate-400">
                  Change Score: <strong className="text-fuchsia-400 font-mono">{road.changeScore}/100</strong> • {road.constructionNearby ? 'Active construction zone detected' : 'Stable corridor'}
                </div>
              </div>
            </div>

            {onOpenPlanetSatellite && (
              <div className="pt-2 flex justify-end">
                <button
                  onClick={onOpenPlanetSatellite}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-950/80 hover:bg-indigo-900 text-indigo-200 border border-indigo-500/40 text-xs font-semibold transition-all shadow-md"
                >
                  <Globe className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Inspect Multi-Temporal Planet Labs Satellite Constellation (3m GSD)</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* STAGE 4: GROUND VISION MODELS */}
        {activeStage === 4 && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-800">
              <div>
                <span className="text-xs font-mono font-semibold text-amber-400">STAGE 4 / 6</span>
                <h3 className="text-lg font-bold text-white">Ground Vision: YOLO Defect Detection & CNN Classification</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Object detection identifies discrete potholes and cracks; surface classification predicts pavement wear with Grad-CAM.
                </p>
              </div>

              {/* Toggles */}
              <div className="flex items-center gap-2">
                <button
                  id="btn-toggle-yolo-boxes"
                  onClick={() => setShowYoloBoxes(!showYoloBoxes)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    showYoloBoxes
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                      : 'bg-slate-950 text-slate-400 border-slate-800'
                  }`}
                >
                  YOLO Bounding Boxes ({sampleGround.defects.length})
                </button>

                <button
                  id="btn-toggle-gradcam"
                  onClick={() => setShowGradCam(!showGradCam)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    showGradCam
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                      : 'bg-slate-950 text-slate-400 border-slate-800'
                  }`}
                >
                  Grad-CAM Heatmap
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Interactive Ground Image with YOLO and Grad-CAM */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>{sampleGround.title}</span>
                  <span className="text-[10px] text-slate-500 font-mono">{sampleGround.locationDesc}</span>
                </div>

                <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 h-[300px]">
                  {/* Base Photo */}
                  <img
                    src={sampleGround.imageUrl}
                    alt="Ground road sample"
                    className="w-full h-full object-cover"
                  />

                  {/* Grad-CAM Attention Heatmap Overlay */}
                  {showGradCam && (
                    <img
                      src={sampleGround.gradCamUrl}
                      alt="Grad-CAM"
                      className="absolute inset-0 w-full h-full object-cover mix-blend-screen opacity-65 pointer-events-none transition-opacity"
                    />
                  )}

                  {/* YOLO Bounding Boxes */}
                  {showYoloBoxes &&
                    sampleGround.defects.map((box) => (
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

                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                  <span>Grad-CAM highlights CNN attention weights in red/yellow.</span>
                  <span className="font-mono text-rose-400 font-semibold">{road.potholeCount} Potholes Detected</span>
                </div>
              </div>

              {/* Classification & Defect Breakdown */}
              <div className="space-y-4">
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-200">Road Surface Quality (CNN)</span>
                    <span className="text-xs font-mono font-bold uppercase px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30">
                      {road.surfaceCondition}
                    </span>
                  </div>

                  <div className="text-xs text-slate-400 leading-relaxed">
                    Classified as <strong className="text-slate-200 uppercase">{road.surfaceCondition}</strong> based on severe aggregate loss, raveling, and water intrusion signatures.
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-800">
                    <div className="text-xs font-semibold text-slate-300">Detected Defect Inventory:</div>
                    {sampleGround.defects.map((d) => (
                      <div key={d.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-900 text-xs">
                        <span className="flex items-center gap-2 text-slate-200">
                          <span className="w-2 h-2 rounded-full bg-rose-500" />
                          {d.label}
                        </span>
                        <span className="font-mono text-slate-400">
                          Conf: <strong className="text-cyan-400">{(d.confidence * 100).toFixed(0)}%</strong> • Severity: <strong className="text-rose-400 capitalize">{d.severity}</strong>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800">
                    <div className="text-[10px] text-slate-500 uppercase font-mono">Defect Score</div>
                    <div className="text-lg font-mono font-bold text-rose-400">{road.defectScore}/100</div>
                  </div>
                  <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800">
                    <div className="text-[10px] text-slate-500 uppercase font-mono">Surface Score</div>
                    <div className="text-lg font-mono font-bold text-amber-400">{road.surfaceScore}/100</div>
                  </div>
                </div>

                {/* Google Street View Ground Truth Verification */}
                <div className="pt-2">
                  <button
                    onClick={() => setIsStreetViewOpen(true)}
                    className="w-full py-2 px-3 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm"
                  >
                    <Compass className="w-4 h-4 text-blue-400" />
                    <span>Verify Ground Truth via Google Street View 360°</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STAGE 5: MULTI-MODAL FEATURE FUSION */}
        {activeStage === 5 && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-800">
              <div>
                <span className="text-xs font-mono font-semibold text-purple-400">STAGE 5 / 6</span>
                <h3 className="text-lg font-bold text-white">Multi-Modal Feature Extraction & Fusion</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Fusing satellite macro-geometry, ground micro-defects, and vector topology into a unified representation.
                </p>
              </div>

              <span className="text-xs font-mono text-purple-400 bg-purple-500/10 px-3 py-1 rounded-lg border border-purple-500/20">
                Vector Dimension: 12 Features
              </span>
            </div>

            {/* Fusion Diagram */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Satellite Inputs */}
              <div className="bg-slate-950 p-4 rounded-xl border border-blue-500/30 space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-bold text-blue-400">
                  <Satellite className="w-4 h-4" />
                  <span>Satellite Modality (Macro)</span>
                </div>
                <div className="space-y-1.5 text-xs text-slate-300 font-mono">
                  <div className="flex justify-between"><span>Carriageway Width:</span> <strong className="text-blue-300">{road.widthMeters}m</strong></div>
                  <div className="flex justify-between"><span>Width Changed:</span> <strong className="text-blue-300">{road.widthChanged ? 'Yes' : 'No'}</strong></div>
                  <div className="flex justify-between"><span>Change %:</span> <strong className="text-blue-300">{road.changePercentage}%</strong></div>
                  <div className="flex justify-between"><span>Segmentation IoU:</span> <strong className="text-blue-300">{currentLocation.satellite.segmentationIoU}</strong></div>
                </div>
              </div>

              {/* Ground Inputs */}
              <div className="bg-slate-950 p-4 rounded-xl border border-amber-500/30 space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                  <Camera className="w-4 h-4" />
                  <span>Ground Vision Modality (Micro)</span>
                </div>
                <div className="space-y-1.5 text-xs text-slate-300 font-mono">
                  <div className="flex justify-between"><span>Potholes Count:</span> <strong className="text-amber-300">{road.potholeCount}</strong></div>
                  <div className="flex justify-between"><span>Severe Cracks:</span> <strong className="text-amber-300">{road.crackCount}</strong></div>
                  <div className="flex justify-between"><span>Surface Condition:</span> <strong className="text-amber-300 uppercase">{road.surfaceCondition}</strong></div>
                  <div className="flex justify-between"><span>Defect Score:</span> <strong className="text-amber-300">{road.defectScore}</strong></div>
                </div>
              </div>

              {/* OSM Inputs */}
              <div className="bg-slate-950 p-4 rounded-xl border border-cyan-500/30 space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-bold text-cyan-400">
                  <Layers className="w-4 h-4" />
                  <span>Geospatial Semantics (OSM)</span>
                </div>
                <div className="space-y-1.5 text-xs text-slate-300 font-mono">
                  <div className="flex justify-between"><span>Highway Class:</span> <strong className="text-cyan-300 uppercase">{road.osm.highwayType}</strong></div>
                  <div className="flex justify-between"><span>Design Lanes:</span> <strong className="text-cyan-300">{road.osm.lanes}</strong></div>
                  <div className="flex justify-between"><span>Sidewalk Present:</span> <strong className="text-cyan-300">{road.osm.hasSidewalk ? 'Yes' : 'No'}</strong></div>
                  <div className="flex justify-between"><span>Infra Deficit Score:</span> <strong className="text-cyan-300">{road.infrastructureScore}</strong></div>
                </div>
              </div>
            </div>

            {/* Fusion Arrow & Latent Representation */}
            <div className="flex items-center justify-center p-3 bg-purple-950/20 rounded-xl border border-purple-500/30 text-xs font-mono text-purple-300">
              <span>Fused Feature Tensor = [ {road.defectScore}, {road.surfaceScore}, {road.changeScore}, {road.infrastructureScore}, {road.geometryScore} ]</span>
            </div>
          </div>
        )}

        {/* STAGE 6: EXPLAINABLE RISK ENGINE */}
        {activeStage === 6 && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-800">
              <div>
                <span className="text-xs font-mono font-semibold text-rose-400">STAGE 6 / 6</span>
                <h3 className="text-lg font-bold text-white">Explainable Risk Engine (XAI Result)</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Mathematical evaluation of calibrated weights, yielding a 0–100 risk score and factor attribution.
                </p>
              </div>

              <div className={`px-4 py-1.5 rounded-xl border text-sm font-bold font-mono ${getRiskBadgeClasses(computed.riskLevel).bg} ${getRiskBadgeClasses(computed.riskLevel).text} ${getRiskBadgeClasses(computed.riskLevel).border}`}>
                Road Risk Score: {computed.overallRisk}/100 — {computed.riskLevel} ⚠️
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Formula & Breakdown */}
              <div className="space-y-4">
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                  <div className="text-xs font-semibold text-slate-300 font-mono">Calibrated Linear Formulation:</div>
                  <div className="text-xs font-mono text-cyan-300 bg-slate-900 p-3 rounded-lg border border-slate-800 leading-relaxed">
                    Risk = 0.30×Defect + 0.20×Surface + 0.20×Change + 0.15×Infra + 0.15×Geometry
                  </div>
                  <div className="text-[11px] text-slate-400 mt-2 font-mono">
                    = (0.30×{road.defectScore}) + (0.20×{road.surfaceScore}) + (0.20×{road.changeScore}) + (0.15×{road.infrastructureScore}) + (0.15×{road.geometryScore})
                    <br />
                    = <span className="text-white font-bold">{computed.overallRisk}</span> (Normalized 0–100)
                  </div>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2.5 text-xs text-slate-300">
                  <div className="font-semibold text-white">Actionable Engineering Recommendation:</div>
                  <p className="text-slate-400 leading-relaxed text-xs">
                    {computed.overallRisk > 75
                      ? 'CRITICAL HAZARD: Immediate cold-mix asphalt patch required within 24 hours. Post temporary warning signage and coordinate lane closure with metro utility contractors.'
                      : computed.overallRisk > 50
                      ? 'HIGH RISK: Schedule milling and asphalt overlay within 14 days. Re-establish missing pedestrian crosswalk markings and repair damaged road shoulders.'
                      : 'NORMAL MAINTENANCE: Routine monitoring quarterly; current road geometry and surface friction remain within safety thresholds.'}
                  </p>
                </div>
              </div>

              {/* Factor Contributor Breakdown Chart */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="text-xs font-semibold text-slate-200">Primary Risk Contributors (XAI Attribution)</div>
                <div className="space-y-2.5">
                  {computed.contributors.map((c) => (
                    <div key={c.factor} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-300 font-medium">{c.factor}</span>
                        <span className="font-mono font-bold text-slate-200">{c.percentage}%</span>
                      </div>
                      <div className="w-full h-2.5 rounded-full bg-slate-900 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-rose-500 transition-all duration-500"
                          style={{ width: `${c.percentage}%` }}
                        />
                      </div>
                      <div className="text-[10px] text-slate-500 flex justify-between">
                        <span>{c.description}</span>
                        <span className="font-mono">{c.points.toFixed(1)} pts</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Google Street View Modal */}
      <StreetViewModal
        isOpen={isStreetViewOpen}
        onClose={() => setIsStreetViewOpen(false)}
        lat={road.coordinates[0]?.[0] || currentLocation.lat}
        lng={road.coordinates[0]?.[1] || currentLocation.lng}
        roadName={road.name}
        apiKey={gmapsConfig.apiKey}
      />
    </div>
  );
};
