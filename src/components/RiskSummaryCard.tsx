import React, { useState } from 'react';
import {
  AlertTriangle,
  Sliders,
  ShieldCheck,
  ShieldAlert,
  Flame,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Sparkles,
  Info,
  FileText,
  Copy,
  CheckCircle2,
  RefreshCw,
  Download,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { LocationPreset, RiskWeights, RoadSegment } from '../types';
import {
  DEFAULT_RISK_WEIGHTS,
  computeCorridorRiskSummary,
  computeRoadRisk,
  getRiskBadgeClasses,
  getRiskColor,
} from '../services/riskEngine';
import { generateGeminiAuditReport } from '../services/geminiClient';

interface RiskSummaryCardProps {
  currentLocation: LocationPreset;
  selectedRoad: RoadSegment | null;
  onSelectRoad?: (road: RoadSegment | null) => void;
  onWeightsChange?: (weights: RiskWeights) => void;
}

export const RiskSummaryCard: React.FC<RiskSummaryCardProps> = ({
  currentLocation,
  selectedRoad,
  onSelectRoad,
}) => {
  const [weights, setWeights] = useState<RiskWeights>(DEFAULT_RISK_WEIGHTS);
  const [showWeightSliders, setShowWeightSliders] = useState<boolean>(false);
  const [isGeneratingAudit, setIsGeneratingAudit] = useState<boolean>(false);
  const [auditReport, setAuditReport] = useState<string | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [showAuditModal, setShowAuditModal] = useState<boolean>(false);
  const [isCopied, setIsCopied] = useState<boolean>(false);

  // Focus on selected road if clicked, otherwise aggregate across all roads in the zone
  const isSegmentFocus = !!selectedRoad;
  const targetRoad = selectedRoad || currentLocation.roads[0];
  const computed = computeRoadRisk(targetRoad, weights);
  const corridorSummary = computeCorridorRiskSummary(currentLocation.roads, weights);

  const displayRisk = isSegmentFocus ? computed.overallRisk : corridorSummary.averageRisk;
  const displayLevel = isSegmentFocus ? computed.riskLevel : corridorSummary.level;
  const badgeClasses = getRiskBadgeClasses(displayLevel);

  const handleResetWeights = () => {
    setWeights(DEFAULT_RISK_WEIGHTS);
  };

  const handleWeightChange = (key: keyof RiskWeights, value: number) => {
    setWeights((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleGenerateAudit = async () => {
    setIsGeneratingAudit(true);
    setAuditError(null);
    setShowAuditModal(true);

    try {
      const report = await generateGeminiAuditReport(targetRoad, currentLocation, weights);
      setAuditReport(report);
    } catch (err: any) {
      setAuditError(err?.message || 'Failed to generate audit report.');
    } finally {
      setIsGeneratingAudit(false);
    }
  };

  const handleCopyReport = () => {
    if (!auditReport) return;
    navigator.clipboard.writeText(auditReport);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2500);
  };

  const handleDownloadReport = () => {
    if (!auditReport) return;
    const blob = new Blob([auditReport], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `roadsense-audit-${targetRoad.id || 'corridor'}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div id="risk-summary-card" className="bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-800 p-5 shadow-2xl space-y-5">
      {/* Top Header */}
      <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono uppercase tracking-widest text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
              {isSegmentFocus ? 'Single Segment Analysis' : 'Corridor Multi-Segment Assessment'}
            </span>
            {isSegmentFocus && (
              <button
                onClick={() => onSelectRoad && onSelectRoad(null)}
                className="text-[10px] text-slate-400 hover:text-white underline"
              >
                Reset to Corridor
              </button>
            )}
          </div>
          <h3 className="text-base font-bold text-white mt-1">
            {isSegmentFocus ? targetRoad.name : currentLocation.name}
          </h3>
        </div>

        {/* Weight Adjuster Button */}
        <button
          id="btn-toggle-weights"
          onClick={() => setShowWeightSliders(!showWeightSliders)}
          className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition-all ${
            showWeightSliders
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
              : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border-slate-700'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Calibrate Weights</span>
          {showWeightSliders ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      {/* Main Score Hero Block */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-950/80 border border-slate-800">
        <div>
          <div className="text-[11px] font-mono text-slate-400 uppercase">
            {isSegmentFocus ? 'Road Risk Score' : 'Corridor Aggregate Risk Score'}
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-4xl font-extrabold text-white tracking-tight font-mono">{displayRisk}</span>
            <span className="text-lg text-slate-500 font-mono">/100</span>
          </div>
        </div>

        <div className="flex flex-col items-start sm:items-end">
          <div
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-sm font-bold font-mono tracking-wider ${badgeClasses.bg} ${badgeClasses.text} ${badgeClasses.border}`}
          >
            <AlertTriangle className="w-4 h-4" />
            <span>{displayLevel} RISK</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1.5 font-mono">
            Scale: 0–25 Low • 26–50 Mod • 51–75 High • 76–100 Crit
          </div>
        </div>
      </div>

      {/* 4 Essential Factors Grid (from prompt section 4) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
          <div className="text-[10px] text-slate-500 uppercase font-mono">Potholes</div>
          <div className="text-xl font-bold font-mono text-rose-400 mt-0.5">
            {isSegmentFocus ? targetRoad.potholeCount : corridorSummary.totalPotholes}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">YOLO detected</div>
        </div>

        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
          <div className="text-[10px] text-slate-500 uppercase font-mono">Severe Cracks</div>
          <div className="text-xl font-bold font-mono text-amber-400 mt-0.5">
            {isSegmentFocus ? targetRoad.crackCount : corridorSummary.totalCracks}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">Alligator & shear</div>
        </div>

        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
          <div className="text-[10px] text-slate-500 uppercase font-mono">Surface</div>
          <div className="text-xl font-bold font-mono text-cyan-400 uppercase mt-0.5">
            {isSegmentFocus ? targetRoad.surfaceCondition : targetRoad.surfaceCondition}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">CNN classification</div>
        </div>

        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
          <div className="text-[10px] text-slate-500 uppercase font-mono">Infrastructure</div>
          <div className="text-xl font-bold font-mono text-indigo-400 mt-0.5">
            {isSegmentFocus ? Math.max(10, 100 - targetRoad.infrastructureScore) : corridorSummary.infraCompletenessPct}%
          </div>
          <div className="text-[10px] text-slate-400 mt-1">Sidewalk & lighting</div>
        </div>
      </div>

      {/* Primary Contributors XAI Breakdown (from prompt section 12) */}
      <div className="space-y-3 pt-1">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-200">
          <span>Primary Contributors (XAI Attribution)</span>
          <span className="text-[10px] text-slate-400 font-mono">Sum = 100%</span>
        </div>

        <div className="space-y-2">
          {computed.contributors.map((item) => (
            <div key={item.factor} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-300 font-medium">{item.factor}</span>
                <span className="font-mono font-bold text-slate-200">{item.percentage}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden border border-slate-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-500 to-rose-500 transition-all duration-300"
                  style={{ width: `${item.percentage}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Expandable Weight Adjuster */}
      {showWeightSliders && (
        <div className="p-4 rounded-xl bg-slate-950 border border-amber-500/30 space-y-3.5">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5" />
              Tune Risk Engine Coefficients
            </span>
            <button
              id="btn-reset-weights"
              onClick={handleResetWeights}
              className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1 font-mono"
            >
              <RotateCcw className="w-3 h-3" />
              Reset Defaults
            </button>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span>Defect Score Weight (Potholes/Cracks):</span>
                <span className="font-mono font-bold text-cyan-400">{weights.defectWeight.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.05"
                max="0.60"
                step="0.05"
                value={weights.defectWeight}
                onChange={(e) => handleWeightChange('defectWeight', parseFloat(e.target.value))}
                className="w-full accent-cyan-500"
              />
            </div>

            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span>Surface Condition Weight:</span>
                <span className="font-mono font-bold text-cyan-400">{weights.surfaceWeight.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.05"
                max="0.50"
                step="0.05"
                value={weights.surfaceWeight}
                onChange={(e) => handleWeightChange('surfaceWeight', parseFloat(e.target.value))}
                className="w-full accent-cyan-500"
              />
            </div>

            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span>Satellite Temporal Change Weight:</span>
                <span className="font-mono font-bold text-cyan-400">{weights.changeWeight.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.05"
                max="0.50"
                step="0.05"
                value={weights.changeWeight}
                onChange={(e) => handleWeightChange('changeWeight', parseFloat(e.target.value))}
                className="w-full accent-cyan-500"
              />
            </div>

            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span>OSM Missing Infrastructure Weight:</span>
                <span className="font-mono font-bold text-cyan-400">{weights.infrastructureWeight.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.05"
                max="0.40"
                step="0.05"
                value={weights.infrastructureWeight}
                onChange={(e) => handleWeightChange('infrastructureWeight', parseFloat(e.target.value))}
                className="w-full accent-cyan-500"
              />
            </div>

            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span>Road Geometry / U-Net Constriction Weight:</span>
                <span className="font-mono font-bold text-cyan-400">{weights.geometryWeight.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.05"
                max="0.40"
                step="0.05"
                value={weights.geometryWeight}
                onChange={(e) => handleWeightChange('geometryWeight', parseFloat(e.target.value))}
                className="w-full accent-cyan-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* Gemini AI Municipal Audit Action Card */}
      <div className="pt-2 border-t border-slate-800">
        <div className="p-3.5 rounded-xl bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950/40 border border-cyan-500/30 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/40">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-bold text-white">Gemini 3.8 Engineering Audit</span>
            </div>
            <span className="text-[10px] font-mono text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
              Multi-Modal XAI
            </span>
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed">
            Synthesize OSM tags, satellite delta, and ground vision defects into an official municipal safety audit and 3-tier maintenance work order.
          </p>

          <button
            id="btn-generate-ai-audit"
            onClick={handleGenerateAudit}
            disabled={isGeneratingAudit}
            className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-lg shadow-cyan-950/50 transition-all disabled:opacity-50"
          >
            {isGeneratingAudit ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Auditing with Gemini 3.8 Flash...</span>
              </>
            ) : (
              <>
                <FileText className="w-3.5 h-3.5 text-cyan-200" />
                <span>{auditReport ? 'View / Re-run Gemini Audit Report' : 'Generate Gemini Risk Audit'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Audit Report Modal / Drawer */}
      {showAuditModal && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Municipal Risk Audit & Work Orders
                  </h3>
                  <div className="text-[10px] text-slate-400 font-mono">
                    {targetRoad.name} • {currentLocation.name} • Gemini 3.8 Flash
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {auditReport && (
                  <>
                    <button
                      onClick={handleCopyReport}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1 transition-colors"
                      title="Copy Markdown"
                    >
                      {isCopied ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <button
                      onClick={handleDownloadReport}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1 transition-colors"
                      title="Download .md report"
                    >
                      <Download className="w-3.5 h-3.5 text-cyan-400" />
                    </button>
                  </>
                )}
                <button
                  onClick={() => setShowAuditModal(false)}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {isGeneratingAudit && (
                <div className="py-12 text-center space-y-3">
                  <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mx-auto" />
                  <div className="text-sm font-bold text-white">
                    Synthesizing Multi-Modal Road Telemetry
                  </div>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto font-mono">
                    Gemini 3.8 Flash is correlating OpenStreetMap safety deficits, satellite change vectors, and ground YOLO distress counts...
                  </p>
                </div>
              )}

              {auditError && (
                <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Audit Generation Error</span>
                  </div>
                  <p className="text-[11px] font-mono">{auditError}</p>
                </div>
              )}

              {auditReport && !isGeneratingAudit && (
                <div className="prose prose-invert prose-xs max-w-none text-slate-200 leading-relaxed space-y-3">
                  <ReactMarkdown>{auditReport}</ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
