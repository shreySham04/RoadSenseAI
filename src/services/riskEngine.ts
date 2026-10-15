import { RiskLevel, RiskWeights, RoadSegment } from '../types';

export const DEFAULT_RISK_WEIGHTS: RiskWeights = {
  defectWeight: 0.30,
  surfaceWeight: 0.20,
  changeWeight: 0.20,
  infrastructureWeight: 0.15,
  geometryWeight: 0.15,
};

export function getRiskLevel(score: number): RiskLevel {
  if (score <= 25) return 'LOW';
  if (score <= 50) return 'MODERATE';
  if (score <= 75) return 'HIGH';
  return 'CRITICAL';
}

export function getRiskColor(level: RiskLevel): string {
  switch (level) {
    case 'LOW':
      return '#10b981'; // emerald-500
    case 'MODERATE':
      return '#f59e0b'; // amber-500
    case 'HIGH':
      return '#f97316'; // orange-500
    case 'CRITICAL':
      return '#ef4444'; // red-500
  }
}

export function getRiskBadgeClasses(level: RiskLevel): { bg: string; text: string; border: string } {
  switch (level) {
    case 'LOW':
      return { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' };
    case 'MODERATE':
      return { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' };
    case 'HIGH':
      return { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/30' };
    case 'CRITICAL':
      return { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/30' };
  }
}

export interface ComputedRisk {
  overallRisk: number;
  riskLevel: RiskLevel;
  weightedPoints: {
    defects: number;
    surface: number;
    change: number;
    infrastructure: number;
    geometry: number;
  };
  contributors: {
    factor: string;
    description: string;
    points: number;
    weight: number;
    percentage: number;
  }[];
}

export function computeRoadRisk(
  scores: {
    defectScore: number;
    surfaceScore: number;
    changeScore: number;
    infrastructureScore: number;
    geometryScore: number;
  },
  weights: RiskWeights = DEFAULT_RISK_WEIGHTS
): ComputedRisk {
  const normDefect = Math.max(0, Math.min(100, scores.defectScore));
  const normSurface = Math.max(0, Math.min(100, scores.surfaceScore));
  const normChange = Math.max(0, Math.min(100, scores.changeScore));
  const normInfra = Math.max(0, Math.min(100, scores.infrastructureScore));
  const normGeom = Math.max(0, Math.min(100, scores.geometryScore));

  const totalWeight =
    weights.defectWeight +
    weights.surfaceWeight +
    weights.changeWeight +
    weights.infrastructureWeight +
    weights.geometryWeight;

  const wDefect = weights.defectWeight / totalWeight;
  const wSurface = weights.surfaceWeight / totalWeight;
  const wChange = weights.changeWeight / totalWeight;
  const wInfra = weights.infrastructureWeight / totalWeight;
  const wGeom = weights.geometryWeight / totalWeight;

  const ptsDefect = normDefect * wDefect;
  const ptsSurface = normSurface * wSurface;
  const ptsChange = normChange * wChange;
  const ptsInfra = normInfra * wInfra;
  const ptsGeom = normGeom * wGeom;

  const rawRisk = ptsDefect + ptsSurface + ptsChange + ptsInfra + ptsGeom;
  const overallRisk = Math.round(Math.max(0, Math.min(100, rawRisk)));
  const riskLevel = getRiskLevel(overallRisk);

  // Compute percentage contributions
  const sumPts = rawRisk > 0 ? rawRisk : 1;
  const factors = [
    {
      factor: 'Potholes & Defects',
      description: 'YOLO-detected potholes and severe crack clusters',
      points: Math.round(ptsDefect * 10) / 10,
      weight: wDefect,
      percentage: Math.round((ptsDefect / sumPts) * 100),
    },
    {
      factor: 'Road Surface Condition',
      description: 'CNN surface classification (pavement degradation/texture)',
      points: Math.round(ptsSurface * 10) / 10,
      weight: wSurface,
      percentage: Math.round((ptsSurface / sumPts) * 100),
    },
    {
      factor: 'Missing Infrastructure',
      description: 'OSM deficit (sidewalks, crossings, lighting, signals)',
      points: Math.round(ptsInfra * 10) / 10,
      weight: wInfra,
      percentage: Math.round((ptsInfra / sumPts) * 100),
    },
    {
      factor: 'Temporal Satellite Change',
      description: 'Multi-date satellite divergence & construction zone activity',
      points: Math.round(ptsChange * 10) / 10,
      weight: wChange,
      percentage: Math.round((ptsChange / sumPts) * 100),
    },
    {
      factor: 'Road Geometry & Width',
      description: 'Satellite U-Net lane constriction & geometric deviation',
      points: Math.round(ptsGeom * 10) / 10,
      weight: wGeom,
      percentage: Math.round((ptsGeom / sumPts) * 100),
    },
  ].sort((a, b) => b.percentage - a.percentage);

  return {
    overallRisk,
    riskLevel,
    weightedPoints: {
      defects: ptsDefect,
      surface: ptsSurface,
      change: ptsChange,
      infrastructure: ptsInfra,
      geometry: ptsGeom,
    },
    contributors: factors,
  };
}

export function computeCorridorRiskSummary(roads: RoadSegment[], weights: RiskWeights = DEFAULT_RISK_WEIGHTS) {
  if (roads.length === 0) {
    return {
      averageRisk: 0,
      level: 'LOW' as RiskLevel,
      totalPotholes: 0,
      totalCracks: 0,
      poorSurfacePct: 0,
      constructionNearby: false,
      infraCompletenessPct: 100,
      highRiskCount: 0,
      criticalRiskCount: 0,
    };
  }

  let totalRisk = 0;
  let totalPotholes = 0;
  let totalCracks = 0;
  let poorSurfaceCount = 0;
  let constructionCount = 0;
  let infraScoreSum = 0;
  let highRiskCount = 0;
  let criticalRiskCount = 0;

  for (const road of roads) {
    const computed = computeRoadRisk(road, weights);
    totalRisk += computed.overallRisk;
    totalPotholes += road.potholeCount;
    totalCracks += road.crackCount;
    if (road.surfaceCondition === 'poor' || road.surfaceCondition === 'critical') {
      poorSurfaceCount++;
    }
    if (road.constructionNearby || road.changeScore > 50) {
      constructionCount++;
    }
    infraScoreSum += road.infrastructureScore;
    if (computed.riskLevel === 'HIGH') highRiskCount++;
    if (computed.riskLevel === 'CRITICAL') criticalRiskCount++;
  }

  const avgRisk = Math.round(totalRisk / roads.length);
  const avgInfraDeficit = Math.round(infraScoreSum / roads.length);
  // Completeness is inverse of deficit score
  const infraCompleteness = Math.max(10, Math.min(100, 100 - avgInfraDeficit));

  return {
    averageRisk: avgRisk,
    level: getRiskLevel(avgRisk),
    totalPotholes,
    totalCracks,
    poorSurfacePct: Math.round((poorSurfaceCount / roads.length) * 100),
    constructionNearby: constructionCount > 0,
    infraCompletenessPct: infraCompleteness,
    highRiskCount,
    criticalRiskCount,
  };
}
