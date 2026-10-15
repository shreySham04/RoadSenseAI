export type RiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

export type DefectType = 'pothole' | 'severe_crack' | 'damaged_surface' | 'debris';
export type DefectSeverity = 'low' | 'moderate' | 'severe';
export type SurfaceQuality = 'good' | 'moderate' | 'poor' | 'critical';

export interface BoundingBox {
  id: string;
  type: DefectType;
  label: string;
  confidence: number;
  severity: DefectSeverity;
  // Relative percentages (0-100) on the image
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GroundDefect {
  id: string;
  type: DefectType;
  lat: number;
  lng: number;
  severity: DefectSeverity;
  confidence: number;
  roadId: string;
  roadName: string;
  imageUrl: string;
  gradCamUrl?: string;
  bbox: BoundingBox;
}

export interface OSMInfrastructure {
  hasSidewalk: boolean;
  sidewalkType: 'both' | 'left' | 'right' | 'none';
  hasCrossing: boolean;
  hasTrafficSignal: boolean;
  isLit: boolean;
  lanes: number;
  surfaceDeclared: string;
  speedLimitKmh: number;
  highwayType: 'primary' | 'secondary' | 'tertiary' | 'residential' | 'motorway' | 'trunk';
  bridge: boolean;
}

export interface RoadSegment {
  id: string;
  osmWayId: number;
  name: string;
  coordinates: [number, number][]; // [lat, lng] pairs
  lengthMeters: number;
  osm: OSMInfrastructure;
  
  // Model features
  potholeCount: number;
  crackCount: number;
  surfaceCondition: SurfaceQuality;
  widthMeters: number;
  widthChanged: boolean;
  changePercentage: number;
  constructionNearby: boolean;
  
  // Normalized component scores (0 - 100)
  defectScore: number;       // Potholes & cracks severity
  surfaceScore: number;      // Ground surface classification
  changeScore: number;       // Satellite temporal change detection
  infrastructureScore: number;// Missing pedestrian/lighting/signal deficit (higher = worse risk)
  geometryScore: number;     // Alignment, lane constriction, width deviation
  
  // Fused Final Risk (0 - 100)
  overallRisk: number;
  riskLevel: RiskLevel;
  primaryContributors: {
    factor: string;
    percentage: number;
    contributionPoints: number;
  }[];
}

export interface SatelliteMetadata {
  t1Date: string; // e.g. "2024-03"
  t2Date: string; // e.g. "2026-02"
  resolutionMeters: number;
  t1ImageUrl: string;
  t2ImageUrl: string;
  unetRoadMaskUrl: string;
  changeMaskUrl: string;
  roadWidthDetectedM: number;
  changeDetectedPct: number;
  constructionHotspots: number;
  segmentationIoU: number;
  segmentationDice: number;
}

export interface LocationPreset {
  id: string;
  name: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
  radiusKm: number;
  description: string;
  roads: RoadSegment[];
  defects: GroundDefect[];
  satellite: SatelliteMetadata;
  sampleGroundImages: {
    id: string;
    title: string;
    locationDesc: string;
    imageUrl: string;
    gradCamUrl: string;
    defects: BoundingBox[];
    surfaceCondition: SurfaceQuality;
    surfaceConfidence: number;
  }[];
}

export interface RiskWeights {
  defectWeight: number;        // Default 0.30
  surfaceWeight: number;       // Default 0.20
  changeWeight: number;        // Default 0.20
  infrastructureWeight: number;// Default 0.15
  geometryWeight: number;      // Default 0.15
}

export interface AblationStudyResult {
  modelId: string;
  name: string;
  description: string;
  modalities: string[];
  f1: number;
  mae: number;
  rmse: number;
  spearman: number;
  isFullSystem?: boolean;
}

export interface ComponentBenchmark {
  name: string;
  modelArchitecture: string;
  primaryMetric: string;
  primaryValue: number;
  secondaryMetric: string;
  secondaryValue: number;
  precision: number;
  recall: number;
}

export interface PlanetScene {
  id: string;
  itemType: string;
  acquired: string;
  cloudCover: number;
  sunElevation: number;
  groundSampleDistance: number;
  instrument: string;
  satelliteId: string;
  thumbnailUrl: string;
}

export interface IntegrationsStatus {
  gemini: {
    available: boolean;
    model: string;
  };
  googleMaps: {
    available: boolean;
  };
  planet: {
    available: boolean;
  };
}

