import React, { useState, useEffect } from 'react';
import { X, MapPin, Compass, ExternalLink, ShieldCheck, AlertTriangle } from 'lucide-react';
import { checkGoogleStreetView } from '../services/integrationsClient';

interface StreetViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  lat: number;
  lng: number;
  roadName: string;
  apiKey: string;
}

export const StreetViewModal: React.FC<StreetViewModalProps> = ({
  isOpen,
  onClose,
  lat,
  lng,
  roadName,
  apiKey,
}) => {
  const [hasStreetView, setHasStreetView] = useState<boolean | null>(null);
  const [heading, setHeading] = useState<number>(180);
  const [pitch, setPitch] = useState<number>(0);

  useEffect(() => {
    if (isOpen) {
      setHasStreetView(null);
      checkGoogleStreetView(lat, lng).then((res) => {
        setHasStreetView(res.available);
      });
    }
  }, [isOpen, lat, lng]);

  if (!isOpen) return null;

  // Google Maps Embed API for Street View
  const embedUrl = apiKey
    ? `https://www.google.com/maps/embed/v1/streetview?key=${apiKey}&location=${lat},${lng}&heading=${heading}&pitch=${pitch}&fov=80`
    : null;

  return (
    <div className="fixed inset-0 z-[700] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[600px] max-h-[90vh]">
        {/* Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">Google Street View Ground Truth</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30">
                  Photographic Evidence
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5 mt-0.5">
                <MapPin className="w-3 h-3 text-rose-400" />
                <span>{roadName}</span>
                <span className="text-slate-600">•</span>
                <span>{lat.toFixed(5)}, {lng.toFixed(5)}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Street View Container */}
        <div className="flex-1 bg-black relative flex items-center justify-center overflow-hidden">
          {embedUrl ? (
            <iframe
              title={`Google Street View for ${roadName}`}
              width="100%"
              height="100%"
              style={{ border: 0 }}
              loading="lazy"
              allowFullScreen
              referrerPolicy="no-referrer-when-downgrade"
              src={embedUrl}
              className="w-full h-full"
            />
          ) : (
            <div className="text-center p-6 space-y-3">
              <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto" />
              <div className="text-sm font-bold text-white">Google Maps API Key Required</div>
              <p className="text-xs text-slate-400 max-w-md mx-auto font-mono">
                Please ensure GMAPS_API is configured to load Google Street View ground truth panoramas.
              </p>
            </div>
          )}

          {hasStreetView === false && (
            <div className="absolute top-4 left-4 right-4 bg-amber-950/80 border border-amber-500/40 text-amber-300 text-xs p-3 rounded-xl backdrop-blur-sm flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Direct 360° coverage may be limited near exact GPS point. Showing nearest street panorama.</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer & Attribution */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs font-mono text-slate-400">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Used for manual cross-verification of YOLO-detected surface distress and lighting fixtures</span>
          </div>

          <div className="text-right">
            <span className="text-[11px] text-slate-400 font-semibold">Google Maps</span>
          </div>
        </div>
      </div>
    </div>
  );
};
