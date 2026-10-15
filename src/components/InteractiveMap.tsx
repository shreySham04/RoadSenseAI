import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import {
  Layers,
  MapPin,
  AlertTriangle,
  ZoomIn,
  ZoomOut,
  Crosshair,
  Info,
  Flame,
  Eye,
  Camera,
  Compass,
  Car,
  Globe,
} from 'lucide-react';
import { GroundDefect, RoadSegment, SatelliteMetadata } from '../types';
import { getRiskBadgeClasses, getRiskColor } from '../services/riskEngine';
import { fetchGoogleMapsConfig } from '../services/integrationsClient';
import { StreetViewModal } from './StreetViewModal';

interface InteractiveMapProps {
  center: [number, number];
  radiusKm: number;
  locationName?: string;
  roads: RoadSegment[];
  defects: GroundDefect[];
  satellite: SatelliteMetadata;
  selectedRoad: RoadSegment | null;
  onSelectRoad: (road: RoadSegment | null) => void;
  onSelectDefect?: (defect: GroundDefect) => void;
  onMapClickCoordinates?: (lat: number, lng: number) => void;
  onOpenPlanetSatellite?: () => void;
}

type BaseMapType = 'gmaps_hybrid' | 'gmaps_streets' | 'gmaps_terrain' | 'osm_voyager' | 'arcgis_sat';

export const InteractiveMap: React.FC<InteractiveMapProps> = ({
  center,
  radiusKm,
  locationName,
  roads,
  defects,
  satellite,
  selectedRoad,
  onSelectRoad,
  onSelectDefect,
  onMapClickCoordinates,
  onOpenPlanetSatellite,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const roadLayersRef = useRef<L.Polyline[]>([]);
  const defectMarkersRef = useRef<L.Marker[]>([]);
  const maskLayerRef = useRef<L.ImageOverlay | null>(null);
  const changeLayerRef = useRef<L.ImageOverlay | null>(null);
  const trafficLayerRef = useRef<L.TileLayer | null>(null);
  const radiusCircleRef = useRef<L.Circle | null>(null);

  // Layer toggles
  const [baseMap, setBaseMap] = useState<BaseMapType>('gmaps_hybrid');
  const [showTraffic, setShowTraffic] = useState(false);
  const [showRoads, setShowRoads] = useState(true);
  const [showDefects, setShowDefects] = useState(true);
  const [showSegmentation, setShowSegmentation] = useState(false);
  const [showChangeDetection, setShowChangeDetection] = useState(false);
  const [showInfraDeficits, setShowInfraDeficits] = useState(true);
  const [isLayerMenuOpen, setIsLayerMenuOpen] = useState(false);

  // Google Maps API configuration
  const [gmapsConfig, setGmapsConfig] = useState<{ available: boolean; apiKey: string }>({
    available: false,
    apiKey: '',
  });

  // Street View Modal state
  const [streetViewTarget, setStreetViewTarget] = useState<{
    isOpen: boolean;
    lat: number;
    lng: number;
    roadName: string;
  }>({
    isOpen: false,
    lat: center[0],
    lng: center[1],
    roadName: 'Corridor',
  });

  useEffect(() => {
    fetchGoogleMapsConfig().then((cfg) => {
      setGmapsConfig(cfg);
    });
  }, []);

  // Base tile configurations
  const TILE_CONFIGS: Record<BaseMapType, { url: string; subdomains?: string[]; maxZoom?: number }> = {
    gmaps_hybrid: {
      url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
      maxZoom: 20,
    },
    gmaps_streets: {
      url: 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
      maxZoom: 20,
    },
    gmaps_terrain: {
      url: 'https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}',
      maxZoom: 20,
    },
    osm_voyager: {
      url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      subdomains: ['a', 'b', 'c', 'd'],
      maxZoom: 19,
    },
    arcgis_sat: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      maxZoom: 19,
    },
  };

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center,
        zoom: 15,
        zoomControl: false,
        attributionControl: false,
      });

      // Default Tile Layer: Google Hybrid
      const defaultTile = TILE_CONFIGS.gmaps_hybrid;
      L.tileLayer(defaultTile.url, {
        maxZoom: defaultTile.maxZoom || 20,
      }).addTo(map);

      map.on('click', (e: L.LeafletMouseEvent) => {
        if (onMapClickCoordinates) {
          onMapClickCoordinates(e.latlng.lat, e.latlng.lng);
        }
      });

      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update Base Layer
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    map.eachLayer((layer) => {
      if (layer instanceof L.TileLayer && layer !== trafficLayerRef.current) {
        map.removeLayer(layer);
      }
    });

    const config = TILE_CONFIGS[baseMap];
    L.tileLayer(config.url, {
      maxZoom: config.maxZoom || 20,
      subdomains: config.subdomains || [],
    }).addTo(map);

    if (showTraffic && trafficLayerRef.current) {
      trafficLayerRef.current.bringToFront();
    }
  }, [baseMap]);

  // Google Maps Traffic Layer
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (trafficLayerRef.current) {
      map.removeLayer(trafficLayerRef.current);
      trafficLayerRef.current = null;
    }

    if (showTraffic) {
      const traffic = L.tileLayer('https://mt1.google.com/vt?lyrs=h,traffic|seconds_into_future:0&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        opacity: 0.85,
      });
      traffic.addTo(map);
      trafficLayerRef.current = traffic;
    }
  }, [showTraffic]);

  // Center update
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    map.setView(center, 15, { animate: true });

    if (radiusCircleRef.current) {
      map.removeLayer(radiusCircleRef.current);
    }
    radiusCircleRef.current = L.circle(center, {
      radius: radiusKm * 1000,
      color: '#0284c7',
      weight: 1.5,
      dashArray: '5, 8',
      fillColor: '#38bdf8',
      fillOpacity: 0.05,
    }).addTo(map);
  }, [center, radiusKm]);

  // Render Road Polylines
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    roadLayersRef.current.forEach((l) => map.removeLayer(l));
    roadLayersRef.current = [];

    if (!showRoads) return;

    roads.forEach((road) => {
      const isSelected = selectedRoad?.id === road.id;
      const color = getRiskColor(road.riskLevel);

      const polyline = L.polyline(road.coordinates, {
        color: isSelected ? '#ffffff' : color,
        weight: isSelected ? 8 : 5,
        opacity: isSelected ? 1 : 0.85,
        lineCap: 'round',
        lineJoin: 'round',
      });

      polyline.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        onSelectRoad(road);
      });

      polyline.bindTooltip(
        `<div class="p-1.5 font-sans">
          <div class="font-bold text-xs text-slate-900">${road.name}</div>
          <div class="text-[11px] text-slate-600 mt-0.5">Risk: <span class="font-bold" style="color:${color}">${road.overallRisk}/100 (${road.riskLevel})</span></div>
          <div class="text-[10px] text-slate-500">Potholes: ${road.potholeCount} | Surface: ${road.surfaceCondition.toUpperCase()}</div>
        </div>`,
        { sticky: true, className: 'leaflet-custom-tooltip' }
      );

      polyline.addTo(map);
      roadLayersRef.current.push(polyline);
    });
  }, [roads, selectedRoad, showRoads]);

  // Render Ground Defect Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    defectMarkersRef.current.forEach((m) => map.removeLayer(m));
    defectMarkersRef.current = [];

    if (!showDefects) return;

    defects.forEach((defect) => {
      const isPothole = defect.type === 'pothole';
      const isCrack = defect.type === 'severe_crack';

      const markerColor = isPothole ? '#ef4444' : isCrack ? '#f97316' : '#eab308';
      const iconHtml = `
        <div class="relative flex items-center justify-center w-7 h-7 rounded-full shadow-lg border-2 border-white transition-transform hover:scale-125 cursor-pointer"
             style="background-color: ${markerColor}">
          <span class="text-[11px] font-bold text-white">${isPothole ? 'P' : isCrack ? 'C' : '!'}</span>
          <span class="absolute -top-1 -right-1 flex h-2.5 w-2.5">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style="background-color: ${markerColor}"></span>
            <span class="relative inline-flex rounded-full h-2.5 w-2.5" style="background-color: ${markerColor}"></span>
          </span>
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'custom-defect-pin',
        html: iconHtml,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const marker = L.marker([defect.lat, defect.lng], { icon: customIcon });

      const popupHtml = `
        <div class="font-sans text-slate-900 max-w-[220px]">
          <div class="flex items-center gap-1.5 font-bold text-xs uppercase tracking-wider text-rose-600 mb-1">
            <span>●</span> ${defect.bbox.label}
          </div>
          <div class="text-xs text-slate-600 mb-1"><strong>Road:</strong> ${defect.roadName}</div>
          <div class="text-xs text-slate-600 mb-2">
            Confidence: <strong>${Math.round(defect.confidence * 100)}%</strong> | Severity: <span class="capitalize font-semibold text-rose-600">${defect.severity}</span>
          </div>
          ${defect.imageUrl ? `<img src="${defect.imageUrl}" class="w-full h-24 object-cover rounded border border-slate-200" alt="Defect" />` : ''}
        </div>
      `;

      marker.bindPopup(popupHtml, { className: 'leaflet-custom-popup' });

      marker.on('click', () => {
        if (onSelectDefect) onSelectDefect(defect);
      });

      marker.addTo(map);
      defectMarkersRef.current.push(marker);
    });
  }, [defects, showDefects]);

  // Satellite U-Net Mask Overlay
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (maskLayerRef.current) {
      map.removeLayer(maskLayerRef.current);
      maskLayerRef.current = null;
    }

    if (showSegmentation) {
      const bounds: L.LatLngBoundsExpression = [
        [center[0] - 0.007, center[1] - 0.007],
        [center[0] + 0.007, center[1] + 0.007],
      ];
      maskLayerRef.current = L.imageOverlay(satellite.unetRoadMaskUrl, bounds, {
        opacity: 0.45,
        interactive: false,
      }).addTo(map);
    }
  }, [showSegmentation, center, satellite]);

  // Satellite Temporal Change Overlay
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (changeLayerRef.current) {
      map.removeLayer(changeLayerRef.current);
      changeLayerRef.current = null;
    }

    if (showChangeDetection) {
      const bounds: L.LatLngBoundsExpression = [
        [center[0] - 0.008, center[1] - 0.008],
        [center[0] + 0.008, center[1] + 0.008],
      ];
      changeLayerRef.current = L.imageOverlay(satellite.changeMaskUrl, bounds, {
        opacity: 0.5,
        interactive: false,
      }).addTo(map);
    }
  }, [showChangeDetection, center, satellite]);

  const handleZoomIn = () => mapInstanceRef.current?.zoomIn();
  const handleZoomOut = () => mapInstanceRef.current?.zoomOut();
  const handleRecenter = () => mapInstanceRef.current?.setView(center, 15);

  const handleOpenStreetView = (lat: number, lng: number, name: string) => {
    setStreetViewTarget({
      isOpen: true,
      lat,
      lng,
      roadName: name,
    });
  };

  return (
    <div id="interactive-map-wrapper" className="relative w-full h-[540px] md:h-[620px] rounded-2xl overflow-hidden border border-slate-800 shadow-2xl bg-slate-950">
      {/* Map Canvas */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Top Left: Map Legend & Info Pill */}
      <div className="absolute top-4 left-4 z-[400] flex flex-col gap-2">
        {locationName && (
          <div className="bg-slate-900/95 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-cyan-500/40 shadow-xl flex items-center gap-2 text-xs">
            <MapPin className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="font-bold text-slate-100 truncate max-w-[240px]">{locationName}</span>
            <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
              ({center[0].toFixed(3)}, {center[1].toFixed(3)} • {radiusKm}km)
            </span>
          </div>
        )}

        <div className="bg-slate-900/90 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-700/60 shadow-xl flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
            <Compass className="w-4 h-4 text-cyan-400" />
            <span>Geospatial Risk Layer</span>
          </div>
          <div className="h-3 w-px bg-slate-700" />
          <div className="flex items-center gap-2 text-[11px] font-mono">
            <span className="flex items-center gap-1 text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              Low
            </span>
            <span className="flex items-center gap-1 text-amber-400">
              <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
              Mod
            </span>
            <span className="flex items-center gap-1 text-orange-400">
              <span className="w-2 h-2 rounded-full bg-orange-500 inline-block" />
              High
            </span>
            <span className="flex items-center gap-1 text-rose-400">
              <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
              Crit
            </span>
          </div>
        </div>

        {/* Selected Road Floating Chip */}
        {selectedRoad && (
          <div className="bg-slate-900/95 backdrop-blur-md px-3.5 py-2.5 rounded-xl border border-amber-500/40 shadow-xl max-w-sm space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-bold text-slate-100 truncate">{selectedRoad.name}</div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold uppercase ${getRiskBadgeClasses(selectedRoad.riskLevel).bg} ${getRiskBadgeClasses(selectedRoad.riskLevel).text} ${getRiskBadgeClasses(selectedRoad.riskLevel).border}`}>
                {selectedRoad.riskLevel} {selectedRoad.overallRisk}/100
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-[10px] text-slate-400 font-mono pt-1 border-t border-slate-800">
              <div>Potholes: <span className="text-rose-400 font-bold">{selectedRoad.potholeCount}</span></div>
              <div>Cracks: <span className="text-amber-400 font-bold">{selectedRoad.crackCount}</span></div>
              <div>Surface: <span className="text-cyan-400 font-bold uppercase">{selectedRoad.surfaceCondition}</span></div>
            </div>

            {/* Google Street View Quick Action */}
            <div className="pt-1 border-t border-slate-800/80">
              <button
                onClick={() => {
                  const midCoord = selectedRoad.coordinates[Math.floor(selectedRoad.coordinates.length / 2)] || center;
                  handleOpenStreetView(midCoord[0], midCoord[1], selectedRoad.name);
                }}
                className="w-full py-1.5 px-2 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <Compass className="w-3.5 h-3.5 text-blue-400" />
                <span>Inspect Google Street View 360°</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Top Right: Layer Switcher & Controls */}
      <div className="absolute top-4 right-4 z-[400] flex flex-col items-end gap-2">
        <div className="flex items-center gap-2">
          {/* Planet Satellite Trigger Button */}
          {onOpenPlanetSatellite && (
            <button
              onClick={onOpenPlanetSatellite}
              className="flex items-center gap-1.5 bg-indigo-950/90 hover:bg-indigo-900/90 text-indigo-200 px-3 py-2 rounded-xl border border-indigo-500/50 shadow-xl text-xs font-semibold transition-all backdrop-blur-md"
              title="Open Planet Labs Satellite Constellation"
            >
              <Globe className="w-3.5 h-3.5 text-indigo-400" />
              <span>Planet Satellite</span>
            </button>
          )}

          {/* Layer Menu Button */}
          <button
            id="btn-toggle-layers"
            onClick={() => setIsLayerMenuOpen(!isLayerMenuOpen)}
            className="flex items-center gap-2 bg-slate-900/90 hover:bg-slate-800 backdrop-blur-md text-slate-200 px-3.5 py-2 rounded-xl border border-slate-700/80 shadow-xl text-xs font-medium transition-colors"
          >
            <Layers className="w-4 h-4 text-cyan-400" />
            <span>Map Layers</span>
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 ml-1" />
          </button>
        </div>

        {/* Layer Flyout Menu */}
        {isLayerMenuOpen && (
          <div className="mt-2 w-72 bg-slate-900/95 backdrop-blur-lg border border-slate-700/80 rounded-2xl p-3.5 shadow-2xl space-y-3 text-xs text-slate-300">
            <div className="font-semibold text-slate-100 pb-1.5 border-b border-slate-800 flex items-center justify-between">
              <span>Active Visual Layers</span>
              <span className="text-[10px] text-cyan-400 font-mono">Google Maps Enabled</span>
            </div>

            {/* Base Map Options */}
            <div>
              <label className="text-[11px] text-slate-400 font-medium block mb-1.5">Base Map Engine</label>
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800">
                <button
                  onClick={() => setBaseMap('gmaps_hybrid')}
                  className={`py-1.5 px-2 text-left rounded-lg text-[11px] font-medium transition-all ${
                    baseMap === 'gmaps_hybrid' ? 'bg-slate-800 text-cyan-300 font-bold shadow' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  ● Google Hybrid
                </button>
                <button
                  onClick={() => setBaseMap('gmaps_streets')}
                  className={`py-1.5 px-2 text-left rounded-lg text-[11px] font-medium transition-all ${
                    baseMap === 'gmaps_streets' ? 'bg-slate-800 text-cyan-300 font-bold shadow' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  ● Google Streets
                </button>
                <button
                  onClick={() => setBaseMap('gmaps_terrain')}
                  className={`py-1.5 px-2 text-left rounded-lg text-[11px] font-medium transition-all ${
                    baseMap === 'gmaps_terrain' ? 'bg-slate-800 text-cyan-300 font-bold shadow' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  ● Google Terrain
                </button>
                <button
                  onClick={() => setBaseMap('osm_voyager')}
                  className={`py-1.5 px-2 text-left rounded-lg text-[11px] font-medium transition-all ${
                    baseMap === 'osm_voyager' ? 'bg-slate-800 text-cyan-300 font-bold shadow' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  ● Carto OSM
                </button>
              </div>
            </div>

            {/* Google Live Traffic Toggle */}
            <div className="pt-2 border-t border-slate-800/80">
              <label className="flex items-center justify-between cursor-pointer p-1.5 rounded-lg hover:bg-slate-800/50 transition-colors">
                <span className="flex items-center gap-2">
                  <Car className="w-3.5 h-3.5 text-amber-400" />
                  <span className="font-semibold text-slate-200">Google Live Traffic</span>
                </span>
                <input
                  type="checkbox"
                  checked={showTraffic}
                  onChange={(e) => setShowTraffic(e.target.checked)}
                  className="accent-amber-500 rounded cursor-pointer"
                />
              </label>
            </div>

            {/* Model Overlays */}
            <div className="space-y-2 pt-2 border-t border-slate-800/80">
              <label className="flex items-center justify-between cursor-pointer group">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-sm bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500" />
                  <span>OSM Roads (Risk-Colored)</span>
                </span>
                <input
                  type="checkbox"
                  checked={showRoads}
                  onChange={(e) => setShowRoads(e.target.checked)}
                  className="accent-cyan-500 rounded"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer group">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  <span>Ground Defects (YOLO)</span>
                </span>
                <input
                  type="checkbox"
                  checked={showDefects}
                  onChange={(e) => setShowDefects(e.target.checked)}
                  className="accent-rose-500 rounded"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer group">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-sm bg-cyan-500/70" />
                  <span>Satellite U-Net Mask</span>
                </span>
                <input
                  type="checkbox"
                  checked={showSegmentation}
                  onChange={(e) => setShowSegmentation(e.target.checked)}
                  className="accent-cyan-500 rounded"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer group">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-sm bg-fuchsia-500/70" />
                  <span>Temporal Change Overlay</span>
                </span>
                <input
                  type="checkbox"
                  checked={showChangeDetection}
                  onChange={(e) => setShowChangeDetection(e.target.checked)}
                  className="accent-fuchsia-500 rounded"
                />
              </label>
            </div>

            {/* Required Google Maps Attribution line */}
            <div className="pt-2 border-t border-slate-800/80 text-[10px] text-slate-400 font-mono flex items-center justify-between">
              <span>Map Data Attribution:</span>
              <span className="font-semibold text-slate-300">Google Maps</span>
            </div>
          </div>
        )}

        {/* Map Nav Buttons */}
        <div className="flex flex-col bg-slate-900/90 backdrop-blur-md rounded-xl border border-slate-700/80 shadow-xl overflow-hidden">
          <button
            id="btn-map-zoom-in"
            onClick={handleZoomIn}
            aria-label="Zoom in"
            className="p-2 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors border-b border-slate-800"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            id="btn-map-zoom-out"
            onClick={handleZoomOut}
            aria-label="Zoom out"
            className="p-2 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors border-b border-slate-800"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            id="btn-map-recenter"
            onClick={handleRecenter}
            aria-label="Recenter map"
            className="p-2 hover:bg-slate-800 text-slate-300 hover:text-cyan-400 transition-colors"
          >
            <Crosshair className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Bottom Center: Coordinates & Stats */}
      <div className="absolute bottom-3 left-4 z-[400] flex items-center gap-2">
        <div className="bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-800 text-[11px] font-mono text-slate-400 flex items-center gap-2 shadow-lg">
          <span className="text-cyan-400">Lat: {center[0].toFixed(4)}</span>
          <span className="text-slate-600">|</span>
          <span className="text-cyan-400">Lng: {center[1].toFixed(4)}</span>
          <span className="text-slate-600">|</span>
          <span>Radius: {radiusKm} km</span>
          <span className="text-slate-600">|</span>
          <span className="text-slate-200 font-semibold">{roads.length} Roads Analyzed</span>
        </div>
      </div>

      {/* Bottom Right: Mandatory Dedicated Attribution */}
      <div className="absolute bottom-3 right-4 z-[400] bg-slate-950/80 backdrop-blur-md px-2.5 py-1 rounded-md border border-slate-800 text-[10px] text-slate-400 font-mono">
        Google Maps
      </div>

      {/* Street View 360 Modal */}
      <StreetViewModal
        isOpen={streetViewTarget.isOpen}
        onClose={() => setStreetViewTarget((prev) => ({ ...prev, isOpen: false }))}
        lat={streetViewTarget.lat}
        lng={streetViewTarget.lng}
        roadName={streetViewTarget.roadName}
        apiKey={gmapsConfig.apiKey}
      />
    </div>
  );
};
