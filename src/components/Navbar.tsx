import React, { useState, useEffect, useRef } from 'react';
import {
  Compass,
  MapPin,
  Search,
  Layers,
  Cpu,
  BarChart3,
  Camera,
  Network,
  ChevronDown,
  RefreshCw,
  Sparkles,
  Globe,
  Satellite,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Navigation,
  X,
} from 'lucide-react';
import { LocationPreset } from '../types';
import { LOCATION_PRESETS } from '../data/mockLocations';
import {
  geocodeLocation,
  reverseGeocodeLocation,
  GeocodedLocation,
  fetchIntegrationsStatus,
} from '../services/integrationsClient';

export type AppView = 'map' | 'pipeline' | 'scanner' | 'satellite' | 'ablation';

interface NavbarProps {
  currentView: AppView;
  onViewChange: (view: AppView) => void;
  currentLocation: LocationPreset;
  onLocationChange: (preset: LocationPreset) => void;
  onCustomAnalyze: (
    lat: number,
    lng: number,
    radiusKm: number,
    locationName?: string,
    city?: string,
    country?: string
  ) => void;
  isAnalyzing: boolean;
  onOpenArchitecture: () => void;
  onOpenCopilot: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onViewChange,
  currentLocation,
  onLocationChange,
  onCustomAnalyze,
  isAnalyzing,
  onOpenArchitecture,
  onOpenCopilot,
}) => {
  const [isLocationDropdownOpen, setIsLocationDropdownOpen] = useState(false);
  const [customLat, setCustomLat] = useState(currentLocation.lat.toString());
  const [customLng, setCustomLng] = useState(currentLocation.lng.toString());
  const [customRadius, setCustomRadius] = useState(currentLocation.radiusKm.toString());
  const [showCustomCoords, setShowCustomCoords] = useState(false);

  // Address & Place Geocoding Omnibar state
  const [searchAddress, setSearchAddress] = useState('');
  const [suggestions, setSuggestions] = useState<GeocodedLocation[]>([]);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);

  const searchContainerRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<any>(null);

  // Integrations Status
  const [integrationsStatus, setIntegrationsStatus] = useState<{
    gemini: { available: boolean; model: string };
    googleMaps: { available: boolean };
    planet: { available: boolean };
  }>({
    gemini: { available: true, model: 'gemini-3.8-flash' },
    googleMaps: { available: false },
    planet: { available: false },
  });

  useEffect(() => {
    fetchIntegrationsStatus().then(setIntegrationsStatus);
  }, []);

  // Update coordinate inputs if currentLocation changes from outside
  useEffect(() => {
    setCustomLat(currentLocation.lat.toString());
    setCustomLng(currentLocation.lng.toString());
    setCustomRadius(currentLocation.radiusKm.toString());
  }, [currentLocation]);

  // Click outside to dismiss suggestions dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Live debounced autocomplete suggestions
  useEffect(() => {
    const query = searchAddress.trim();
    if (query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const results = await geocodeLocation(query);
        setSuggestions(results);
        setShowSuggestions(results.length > 0);
      } catch {
        setSuggestions([]);
      }
    }, 280);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [searchAddress]);

  const handleApplyCustom = (e: React.FormEvent) => {
    e.preventDefault();
    const lat = parseFloat(customLat);
    const lng = parseFloat(customLng);
    const rad = parseFloat(customRadius) || 1.0;
    if (!isNaN(lat) && !isNaN(lng)) {
      onCustomAnalyze(lat, lng, rad, `Custom Point [${lat.toFixed(4)}, ${lng.toFixed(4)}]`);
      setShowCustomCoords(false);
      setIsLocationDropdownOpen(false);
    }
  };

  const handleSelectGeocodedLocation = (loc: GeocodedLocation) => {
    setShowSuggestions(false);
    setSearchAddress('');
    setCustomLat(loc.lat.toString());
    setCustomLng(loc.lng.toString());
    const rad = parseFloat(customRadius) || 1.0;
    onCustomAnalyze(loc.lat, loc.lng, rad, loc.name || loc.formatted_address, loc.city, loc.country);
  };

  const handleGeocodeSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchAddress.trim();
    if (!query) return;

    setIsGeocoding(true);
    setGeocodeError(null);
    setShowSuggestions(false);

    try {
      const results = await geocodeLocation(query);
      if (results && results.length > 0) {
        const best = results[0];
        setCustomLat(best.lat.toString());
        setCustomLng(best.lng.toString());
        const rad = parseFloat(customRadius) || 1.0;
        onCustomAnalyze(best.lat, best.lng, rad, best.name || best.formatted_address, best.city, best.country);
        setSearchAddress('');
        setIsLocationDropdownOpen(false);
      } else {
        setGeocodeError(`Could not find "${query}". Try another landmark, city, or coordinates (e.g. 51.5074, -0.1278).`);
      }
    } catch {
      setGeocodeError('Geocoding request failed. Please check your network.');
    } finally {
      setIsGeocoding(false);
    }
  };

  // Browser Geolocation / GPS
  const handleUseCurrentDeviceLocation = () => {
    if (!navigator.geolocation) {
      setGeocodeError('Geolocation is not supported by your browser.');
      return;
    }
    setIsGeocoding(true);
    setGeocodeError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setCustomLat(lat.toFixed(5));
        setCustomLng(lng.toFixed(5));
        
        const rev = await reverseGeocodeLocation(lat, lng);
        const name = rev?.name || `My Device Location (${lat.toFixed(3)}, ${lng.toFixed(3)})`;
        onCustomAnalyze(lat, lng, 1.0, name, rev?.city, rev?.country);
        setIsGeocoding(false);
      },
      (err) => {
        setIsGeocoding(false);
        setGeocodeError('Unable to retrieve location: ' + err.message);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  return (
    <header className="sticky top-0 z-[500] w-full bg-slate-950/90 backdrop-blur-xl border-b border-slate-800/80">
      <div className="w-full max-w-[1700px] mx-auto px-4 sm:px-6 py-2.5 flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-5">
        {/* Logo */}
        <div className="flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 via-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-900/30 border border-cyan-400/30 shrink-0">
              <Compass className="w-5 h-5 text-white" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-base font-extrabold text-white tracking-tight whitespace-nowrap">RoadSense AI</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-semibold whitespace-nowrap">
                Multi-Modal
              </span>
            </div>
          </div>

          {/* Architecture Button on mobile */}
          <button
            onClick={onOpenArchitecture}
            className="md:hidden p-2 rounded-lg bg-slate-900 text-slate-300 border border-slate-800 ml-2"
            title="System Architecture"
          >
            <Network className="w-4 h-4" />
          </button>
        </div>

        {/* Prominent Universal Location Omnibar Search - Full width flex */}
        <div className="relative flex-1 w-full min-w-0" ref={searchContainerRef}>
          <form onSubmit={handleGeocodeSearch} className="relative flex items-center w-full">
            <div className="absolute left-3.5 text-cyan-400 pointer-events-none flex items-center justify-center">
              <Search className="w-5 h-5" />
            </div>
            <input
              id="input-omnibar-location"
              type="text"
              value={searchAddress}
              onChange={(e) => setSearchAddress(e.target.value)}
              onFocus={() => {
                if (suggestions.length > 0) setShowSuggestions(true);
              }}
              placeholder="Search any place, city, landmark, or coordinates (e.g. Times Square, Paris, Tokyo, 40.758, -73.985)..."
              className="w-full h-12 bg-slate-900 hover:bg-slate-900/90 focus:bg-slate-950 text-white placeholder:text-slate-400 placeholder:font-normal pl-11 pr-32 rounded-xl border border-slate-700/90 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30 text-sm sm:text-base font-medium transition-all shadow-lg outline-none caret-cyan-400"
            />
            <div className="absolute right-2 flex items-center gap-1.5">
              {searchAddress && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchAddress('');
                    setSuggestions([]);
                    setShowSuggestions(false);
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  title="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={handleUseCurrentDeviceLocation}
                className="p-2 rounded-lg text-slate-300 hover:text-cyan-300 hover:bg-slate-800 transition-colors"
                title="Use current device GPS location"
              >
                <Navigation className="w-4 h-4" />
              </button>
              <button
                type="submit"
                disabled={isGeocoding || !searchAddress.trim()}
                className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-40 text-white font-bold text-xs sm:text-sm transition-all flex items-center gap-1.5 shadow-md active:scale-95"
              >
                {isGeocoding ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Search</span>}
              </button>
            </div>
          </form>

          {/* Live Autocomplete Suggestions Dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute left-0 right-0 mt-2 bg-slate-900/95 backdrop-blur-xl border border-slate-700 rounded-2xl shadow-2xl p-2 z-[700] space-y-1">
              <div className="px-3 py-1.5 text-xs font-mono text-cyan-400 uppercase tracking-wider flex justify-between border-b border-slate-800 mb-1 font-semibold">
                <span>Matching Locations</span>
                <span className="text-slate-400">Click to evaluate</span>
              </div>
              {suggestions.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectGeocodedLocation(item)}
                  className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-slate-800/90 transition-colors flex items-start gap-3 group cursor-pointer"
                >
                  <MapPin className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-white truncate group-hover:text-cyan-300">
                      {item.name || item.formatted_address.split(',')[0]}
                    </div>
                    <div className="text-xs text-slate-300 truncate mt-0.5">
                      {item.formatted_address}
                    </div>
                  </div>
                  {item.country && (
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 shrink-0 border border-slate-700">
                      {item.country}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {geocodeError && (
            <div className="absolute left-0 right-0 mt-2 px-3.5 py-2 rounded-xl bg-rose-950/95 border border-rose-800 text-rose-200 text-xs flex items-center justify-between z-[700] shadow-xl font-medium">
              <span>{geocodeError}</span>
              <button onClick={() => setGeocodeError(null)} className="text-rose-400 hover:text-rose-100 p-0.5">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Location Selector & Actions */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
          {/* Active Integrations Pill */}
          <div className="hidden xl:flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-900/80 border border-slate-800 text-[11px] font-mono text-slate-400">
            <span className="flex items-center gap-1" title="Gemini 3.8 Flash Neural Engine">
              <span className={`w-1.5 h-1.5 rounded-full ${integrationsStatus.gemini.available ? 'bg-emerald-400' : 'bg-slate-500'}`} />
              <span className="text-slate-300">Gemini</span>
            </span>
            <span className="text-slate-700">|</span>
            <span className="flex items-center gap-1" title="Google Maps">
              <span className={`w-1.5 h-1.5 rounded-full ${integrationsStatus.googleMaps.available ? 'bg-emerald-400' : 'bg-cyan-400'}`} />
              <span className="text-slate-300">Google Maps</span>
            </span>
            <span className="text-slate-700">|</span>
            <span className="flex items-center gap-1" title="Planet Labs Satellite">
              <span className={`w-1.5 h-1.5 rounded-full ${integrationsStatus.planet.available ? 'bg-emerald-400' : 'bg-indigo-400'}`} />
              <span className="text-slate-300">Planet</span>
            </span>
          </div>

          <div className="relative">
            <button
              id="btn-location-dropdown"
              onClick={() => setIsLocationDropdownOpen(!isLocationDropdownOpen)}
              className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800/90 text-slate-200 px-3.5 py-2 rounded-xl border border-slate-700/80 text-xs font-medium transition-colors shadow-lg"
              title="Select preset corridor or custom coordinates"
            >
              <MapPin className="w-3.5 h-3.5 text-cyan-400" />
              <span className="max-w-[130px] truncate">{currentLocation.name.split('(')[0].trim()}</span>
              <ChevronDown className="w-3 h-3 text-slate-400 ml-0.5" />
            </button>

            {/* Dropdown Menu for Presets & Manual Lat/Lng */}
            {isLocationDropdownOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-2xl p-3 shadow-2xl space-y-2.5 text-xs z-[600]">
                <div className="font-semibold text-slate-200 flex justify-between items-center pb-1.5 border-b border-slate-800">
                  <span>Research Preset Corridors</span>
                  <span className="text-[10px] text-slate-500 font-mono">N=5</span>
                </div>

                <div className="space-y-1">
                  {LOCATION_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => {
                        onLocationChange(preset);
                        setCustomLat(preset.lat.toString());
                        setCustomLng(preset.lng.toString());
                        setCustomRadius(preset.radiusKm.toString());
                        setIsLocationDropdownOpen(false);
                      }}
                      className={`w-full text-left px-2.5 py-2 rounded-xl transition-colors flex items-center justify-between ${
                        currentLocation.id === preset.id
                          ? 'bg-cyan-950/60 text-cyan-300 border border-cyan-500/30'
                          : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold truncate text-xs">{preset.name}</div>
                        <div className="text-[10px] text-slate-500 truncate">
                          {preset.lat.toFixed(4)}, {preset.lng.toFixed(4)} • R={preset.radiusKm}km
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                <div className="pt-2 border-t border-slate-800">
                  <button
                    onClick={() => setShowCustomCoords(!showCustomCoords)}
                    className="w-full text-center py-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-950/60 border border-slate-800 text-[11px] font-mono transition-colors"
                  >
                    {showCustomCoords ? 'Hide Coordinate Input' : 'Enter Coordinates (Lat/Lng)'}
                  </button>

                  {showCustomCoords && (
                    <form onSubmit={handleApplyCustom} className="mt-2 space-y-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-slate-500 block mb-0.5 font-mono">Latitude</label>
                          <input
                            type="text"
                            value={customLat}
                            onChange={(e) => setCustomLat(e.target.value)}
                            placeholder="17.3850"
                            className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 font-mono text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500 block mb-0.5 font-mono">Longitude</label>
                          <input
                            type="text"
                            value={customLng}
                            onChange={(e) => setCustomLng(e.target.value)}
                            placeholder="78.4867"
                            className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 font-mono text-xs"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 block mb-0.5 font-mono">Radius (km)</label>
                        <input
                          type="text"
                          value={customRadius}
                          onChange={(e) => setCustomRadius(e.target.value)}
                          placeholder="1.0"
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 font-mono text-xs"
                        />
                      </div>
                      <button
                        type="submit"
                        className="w-full py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs transition-colors"
                      >
                        Query Overpass API & Analyze
                      </button>
                    </form>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Quick Analyze Trigger */}
          <button
            id="btn-reanalyze"
            onClick={() => onCustomAnalyze(currentLocation.lat, currentLocation.lng, currentLocation.radiusKm)}
            disabled={isAnalyzing}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all border ${
              isAnalyzing
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 cursor-wait'
                : 'bg-cyan-600 hover:bg-cyan-500 text-white border-cyan-500 shadow-md shadow-cyan-950/40'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
            <span>{isAnalyzing ? 'Querying...' : 'Analyze'}</span>
          </button>

          {/* Architecture Guide Button (Desktop) */}
          <button
            id="btn-open-arch-guide"
            onClick={onOpenArchitecture}
            className="hidden md:flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white px-3 py-2 rounded-xl border border-slate-800 text-xs font-medium transition-colors"
            title="System Architecture & Dataflow"
          >
            <Network className="w-3.5 h-3.5 text-purple-400" />
            <span>Architecture</span>
          </button>

          {/* Gemini AI Copilot Button */}
          <button
            id="btn-open-gemini-copilot"
            onClick={onOpenCopilot}
            className="flex items-center gap-1.5 bg-gradient-to-r from-cyan-900/60 to-blue-900/60 hover:from-cyan-800/80 hover:to-blue-800/80 text-cyan-200 px-3 py-2 rounded-xl border border-cyan-500/40 text-xs font-semibold transition-all shadow-md shadow-cyan-950/40"
            title="Open RoadSense AI Copilot"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">AI Copilot</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-2.5 flex items-center gap-1.5 overflow-x-auto">
        <button
          id="nav-tab-map"
          onClick={() => onViewChange('map')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
            currentView === 'map'
              ? 'bg-slate-800 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Interactive Map & Risk Dashboard</span>
        </button>

        <button
          id="nav-tab-pipeline"
          onClick={() => onViewChange('pipeline')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
            currentView === 'pipeline'
              ? 'bg-slate-800 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Cpu className="w-3.5 h-3.5" />
          <span>Pipeline Inspector (Stages 1–6)</span>
        </button>

        <button
          id="nav-tab-satellite"
          onClick={() => onViewChange('satellite')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
            currentView === 'satellite'
              ? 'bg-slate-800 text-indigo-300 border border-indigo-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Satellite className="w-3.5 h-3.5 text-indigo-400" />
          <span>Planet Satellite Imagery</span>
        </button>

        <button
          id="nav-tab-scanner"
          onClick={() => onViewChange('scanner')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
            currentView === 'scanner'
              ? 'bg-slate-800 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Camera className="w-3.5 h-3.5" />
          <span>Ground Defect & Grad-CAM Scanner</span>
        </button>

        <button
          id="nav-tab-ablation"
          onClick={() => onViewChange('ablation')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
            currentView === 'ablation'
              ? 'bg-slate-800 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>Ablation Study & Evaluation</span>
        </button>
      </div>
    </header>
  );
};
