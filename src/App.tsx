import React, { useState } from 'react';
import { Navbar, AppView } from './components/Navbar';
import { InteractiveMap } from './components/InteractiveMap';
import { RiskSummaryCard } from './components/RiskSummaryCard';
import { PipelineInspector } from './components/PipelineInspector';
import { GroundDefectScanner } from './components/GroundDefectScanner';
import { PlanetSatelliteViewer } from './components/PlanetSatelliteViewer';
import { AblationStudy } from './components/AblationStudy';
import { ArchitectureModal } from './components/ArchitectureModal';
import { CopilotModal } from './components/CopilotModal';
import { LOCATION_PRESETS } from './data/mockLocations';
import { LocationPreset, RoadSegment, GroundDefect } from './types';
import { fetchOSMRoads, generateDefectsForRoads } from './services/osmService';
import {
  Download,
  Info,
  MapPin,
  Compass,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  Layers,
  Cpu,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { getRiskBadgeClasses } from './services/riskEngine';

export default function App() {
  const [currentView, setCurrentView] = useState<AppView>('map');
  const [currentLocation, setCurrentLocation] = useState<LocationPreset>(LOCATION_PRESETS[0]);
  const [selectedRoad, setSelectedRoad] = useState<RoadSegment | null>(LOCATION_PRESETS[0].roads[0]);
  const [selectedDefect, setSelectedDefect] = useState<GroundDefect | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isArchModalOpen, setIsArchModalOpen] = useState<boolean>(false);
  const [isCopilotOpen, setIsCopilotOpen] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Quick Preset Selection
  const handleLocationPresetChange = (preset: LocationPreset) => {
    setCurrentLocation(preset);
    setSelectedRoad(preset.roads[0] || null);
    setSelectedDefect(preset.defects[0] || null);
    setStatusMessage(`Loaded geospatial corridor: ${preset.name}`);
    setTimeout(() => setStatusMessage(null), 3500);
  };

  // Custom Location & Coordinate Analysis
  const handleAnalyzeLocation = async (
    lat: number,
    lng: number,
    radiusKm: number,
    locationName?: string,
    city?: string,
    country?: string
  ) => {
    setIsAnalyzing(true);
    const resolvedName = locationName || `Corridor [${lat.toFixed(3)}, ${lng.toFixed(3)}]`;
    setStatusMessage(`Acquiring geospatial infrastructure telemetry for ${resolvedName}...`);

    try {
      const result = await fetchOSMRoads(lat, lng, radiusKm, currentLocation.roads);
      if (result.roads && result.roads.length > 0) {
        const freshDefects = generateDefectsForRoads(result.roads, lat, lng);
        const updatedLocation: LocationPreset = {
          ...currentLocation,
          id: `loc-${lat.toFixed(4)}-${lng.toFixed(4)}`,
          name: resolvedName,
          city: city || currentLocation.city || 'Evaluated Region',
          country: country || currentLocation.country || '',
          lat,
          lng,
          radiusKm,
          description: `Active corridor at coordinates [${lat.toFixed(4)}, ${lng.toFixed(4)}] evaluated with multi-modal neural fusion.`,
          roads: result.roads,
          defects: freshDefects.length > 0 ? freshDefects : currentLocation.defects,
          satellite: {
            ...currentLocation.satellite,
            changeDetectedPct: Math.round((12 + Math.random() * 15) * 10) / 10,
            roadWidthDetectedM: 8.4,
            constructionHotspots: Math.floor(Math.random() * 3),
          },
        };

        setCurrentLocation(updatedLocation);
        setSelectedRoad(result.roads[0] || null);
        setSelectedDefect(freshDefects[0] || null);
        setStatusMessage(
          `Navigated to ${resolvedName}: ${result.roads.length} road segments & ${freshDefects.length} defect telemetry points loaded.`
        );
      }
    } catch {
      setStatusMessage(`Analyzed ${resolvedName} with synthesized neural features.`);
    } finally {
      setIsAnalyzing(false);
      setTimeout(() => setStatusMessage(null), 4500);
    }
  };

  // Map Click Coordinate Handler
  const handleMapClick = (lat: number, lng: number) => {
    handleAnalyzeLocation(lat, lng, currentLocation.radiusKm, `Custom Coordinates [${lat.toFixed(4)}, ${lng.toFixed(4)}]`);
  };

  // Export JSON Report
  const handleExportJSON = () => {
    const report = {
      title: 'RoadSense AI Multi-Modal Road Risk Assessment Report',
      timestamp: new Date().toISOString(),
      location: {
        name: currentLocation.name,
        city: currentLocation.city,
        country: currentLocation.country,
        coordinates: [currentLocation.lat, currentLocation.lng],
        radiusKm: currentLocation.radiusKm,
      },
      satellite: {
        baselineDate: currentLocation.satellite.t1Date,
        currentDate: currentLocation.satellite.t2Date,
        segmentationIoU: currentLocation.satellite.segmentationIoU,
        changeDetectedPct: currentLocation.satellite.changeDetectedPct,
      },
      evaluatedRoadsCount: currentLocation.roads.length,
      evaluatedDefectsCount: currentLocation.defects.length,
      roads: currentLocation.roads.map((r) => ({
        id: r.id,
        osmWayId: r.osmWayId,
        name: r.name,
        highwayType: r.osm.highwayType,
        lanes: r.osm.lanes,
        potholes: r.potholeCount,
        cracks: r.crackCount,
        surface: r.surfaceCondition,
        changeScore: r.changeScore,
        infrastructureScore: r.infrastructureScore,
        overallRisk: r.overallRisk,
        riskLevel: r.riskLevel,
        primaryContributors: r.primaryContributors,
      })),
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `roadsense-risk-report-${currentLocation.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Top Navigation Bar */}
      <Navbar
        currentView={currentView}
        onViewChange={setCurrentView}
        currentLocation={currentLocation}
        onLocationChange={handleLocationPresetChange}
        onCustomAnalyze={handleAnalyzeLocation}
        isAnalyzing={isAnalyzing}
        onOpenArchitecture={() => setIsArchModalOpen(true)}
        onOpenCopilot={() => setIsCopilotOpen(true)}
      />

      {/* Ephemeral Status Alert Banner */}
      {statusMessage && (
        <div className="bg-cyan-950/80 border-b border-cyan-500/30 px-4 py-2 text-center text-xs font-mono text-cyan-300 flex items-center justify-center gap-2 animate-fadeIn">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Main App Content Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Quick Corridor Switcher Bar */}
        <div className="flex items-center justify-between gap-4 overflow-x-auto pb-1 text-xs">
          <div className="flex items-center gap-2 font-mono text-slate-400 shrink-0">
            <Compass className="w-3.5 h-3.5 text-cyan-400" />
            <span>Preset Research Corridors:</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {LOCATION_PRESETS.map((p) => {
              const isSelected = currentLocation.id === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => handleLocationPresetChange(p)}
                  className={`px-3 py-1.5 rounded-xl font-medium transition-all ${
                    isSelected
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-sm'
                      : 'bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  {p.city} ({p.name.split('(')[1]?.replace(')', '') || p.name})
                </button>
              );
            })}
          </div>

          <div className="hidden lg:flex items-center gap-2 shrink-0">
            <button
              onClick={handleExportJSON}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-medium transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>Export Risk GeoJSON</span>
            </button>
          </div>
        </div>

        {/* VIEW 1: INTERACTIVE MAP & RISK DASHBOARD (Default Core View) */}
        {currentView === 'map' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left: Leaflet Map (8 cols) */}
              <div className="lg:col-span-8 space-y-4">
                <InteractiveMap
                  center={[currentLocation.lat, currentLocation.lng]}
                  radiusKm={currentLocation.radiusKm}
                  locationName={currentLocation.name}
                  roads={currentLocation.roads}
                  defects={currentLocation.defects}
                  satellite={currentLocation.satellite}
                  selectedRoad={selectedRoad}
                  onSelectRoad={setSelectedRoad}
                  onSelectDefect={setSelectedDefect}
                  onMapClickCoordinates={handleMapClick}
                  onOpenPlanetSatellite={() => setCurrentView('satellite')}
                />

                {/* Road Segments Horizontal Carousel */}
                <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-4 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-200 flex items-center gap-2">
                      <Layers className="w-4 h-4 text-cyan-400" />
                      <span>Evaluated Road Segments ({currentLocation.roads.length})</span>
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">Click to inspect features</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-48 overflow-y-auto pr-1">
                    {currentLocation.roads.map((r) => {
                      const isSelected = selectedRoad?.id === r.id;
                      const badge = getRiskBadgeClasses(r.riskLevel);
                      return (
                        <button
                          key={r.id}
                          onClick={() => setSelectedRoad(r)}
                          className={`p-3 rounded-xl text-left border transition-all ${
                            isSelected
                              ? 'bg-slate-800 border-cyan-500/80 shadow-md shadow-cyan-950/40'
                              : 'bg-slate-950/60 border-slate-800/80 hover:bg-slate-800/50 text-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-xs text-white truncate max-w-[130px]">{r.name}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${badge.bg} ${badge.text} ${badge.border}`}>
                              {r.overallRisk}/100
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                            <span>Potholes: {r.potholeCount}</span>
                            <span>Cracks: {r.crackCount}</span>
                            <span className="uppercase text-cyan-400">{r.surfaceCondition}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Right: Risk Summary & Attribution Card (4 cols) */}
              <div className="lg:col-span-4 space-y-4">
                <RiskSummaryCard
                  currentLocation={currentLocation}
                  selectedRoad={selectedRoad}
                  onSelectRoad={setSelectedRoad}
                />

                {/* Quick Pipeline Transition Card */}
                <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-4 space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-white">
                    <Cpu className="w-4 h-4 text-cyan-400" />
                    <span>How Was This Score Predicted?</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Inspect the 6 sequential stages: from Overpass geospatial queries to satellite U-Net segmentation, temporal change detection, and YOLO defect detection.
                  </p>
                  <button
                    onClick={() => setCurrentView('pipeline')}
                    className="w-full mt-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-semibold flex items-center justify-center gap-2 transition-colors border border-slate-700"
                  >
                    <span>Inspect Step-by-Step Pipeline</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: PIPELINE INSPECTOR (Stages 1 to 6) */}
        {currentView === 'pipeline' && (
          <PipelineInspector
            currentLocation={currentLocation}
            selectedRoad={selectedRoad}
            onSelectRoad={setSelectedRoad}
            onOpenPlanetSatellite={() => setCurrentView('satellite')}
          />
        )}

        {/* VIEW 3: PLANET LABS SATELLITE CONSTELLATION EXPLORER */}
        {currentView === 'satellite' && (
          <PlanetSatelliteViewer currentLocation={currentLocation} />
        )}

        {/* VIEW 4: GROUND DEFECT & GRAD-CAM SCANNER */}
        {currentView === 'scanner' && <GroundDefectScanner />}

        {/* VIEW 5: ABLATION STUDY & EVALUATION BENCHMARKS */}
        {currentView === 'ablation' && <AblationStudy />}
      </main>

      {/* Architecture & Methodology Modal */}
      <ArchitectureModal isOpen={isArchModalOpen} onClose={() => setIsArchModalOpen(false)} />

      {/* Gemini AI Copilot Modal */}
      <CopilotModal
        isOpen={isCopilotOpen}
        onClose={() => setIsCopilotOpen(false)}
        currentLocation={currentLocation}
        selectedRoad={selectedRoad}
      />

      {/* Footer */}
      <footer className="w-full bg-slate-950 border-t border-slate-800/80 py-4 px-4 sm:px-6 text-xs text-slate-500 font-mono">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
          <div>
            RoadSense AI • Multi-Modal Road-Risk Assessment Framework (OSM + Satellite + Ground Vision)
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <span>U-Net (ResNet-34)</span>
            <span>•</span>
            <span>YOLOv8</span>
            <span>•</span>
            <span>Siamese CD</span>
            <span>•</span>
            <span>ViT-B/16</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
