import { GroundDefect, RoadSegment, SurfaceQuality } from '../types';

export interface OverpassQueryResult {
  queryQL: string;
  source: 'live_overpass' | 'local_geospatial_cache' | 'simulated_fallback';
  waysFound: number;
  roads: RoadSegment[];
  executionTimeMs: number;
}

export function buildOverpassQL(lat: number, lng: number, radiusKm: number): string {
  const radiusMeters = Math.round(radiusKm * 1000);
  return `[out:json][timeout:15];
(
  way["highway"](around:${radiusMeters}, ${lat.toFixed(4)}, ${lng.toFixed(4)});
);
out body geom;
relation["route"="road"](around:${radiusMeters}, ${lat.toFixed(4)}, ${lng.toFixed(4)});
out body;`;
}

export async function fetchOSMRoads(
  lat: number,
  lng: number,
  radiusKm: number,
  fallbackRoads?: RoadSegment[]
): Promise<OverpassQueryResult> {
  const queryQL = buildOverpassQL(lat, lng, radiusKm);
  const startTime = performance.now();

  // ONLY use fallbackRoads if the coordinates actually match the cached dataset (within ~1.5km)
  if (fallbackRoads && fallbackRoads.length > 0 && fallbackRoads[0].coordinates[0]) {
    const firstCoord = fallbackRoads[0].coordinates[0];
    const latDiff = Math.abs(firstCoord[0] - lat);
    const lngDiff = Math.abs(firstCoord[1] - lng);
    if (latDiff < 0.025 && lngDiff < 0.025) {
      return {
        queryQL,
        source: 'local_geospatial_cache',
        waysFound: fallbackRoads.length,
        roads: fallbackRoads,
        executionTimeMs: Math.round(performance.now() - startTime),
      };
    }
  }

  // 1. Try server-side Overpass proxy (bypasses browser CORS and network restrictions)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);
    const srvResp = await fetch('/api/osm/overpass', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queryQL }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (srvResp.ok) {
      const data = await srvResp.json();
      if (data.elements && data.elements.length > 0) {
        const parsedRoads = parseOverpassElements(data.elements, lat, lng);
        if (parsedRoads.length > 0) {
          return {
            queryQL,
            source: 'live_overpass',
            waysFound: parsedRoads.length,
            roads: parsedRoads,
            executionTimeMs: Math.round(performance.now() - startTime),
          };
        }
      }
    }
  } catch {
    // continue to direct public Overpass or synthetic generator
  }

  // 2. Try direct public Overpass API endpoint
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const endpoint = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(queryQL)}`;
    const response = await fetch(endpoint, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data.elements && data.elements.length > 0) {
        const parsedRoads = parseOverpassElements(data.elements, lat, lng);
        if (parsedRoads.length > 0) {
          return {
            queryQL,
            source: 'live_overpass',
            waysFound: parsedRoads.length,
            roads: parsedRoads,
            executionTimeMs: Math.round(performance.now() - startTime),
          };
        }
      }
    }
  } catch {
    // Network timeout, CORS or rate limit - fallback to synthesized local network around requested lat/lng
  }

  // 3. Synthesize realistic geometry around requested lat/lng
  const synthRoads = generateSynthesizedRoads(lat, lng, radiusKm);
  return {
    queryQL,
    source: 'simulated_fallback',
    waysFound: synthRoads.length,
    roads: synthRoads,
    executionTimeMs: Math.round(performance.now() - startTime),
  };
}

function parseOverpassElements(elements: any[], centerLat: number, centerLng: number): RoadSegment[] {
  const ways = elements.filter((el) => el.type === 'way' && el.geometry && el.geometry.length > 1);
  const roads: RoadSegment[] = [];

  for (let i = 0; i < Math.min(12, ways.length); i++) {
    const way = ways[i];
    const tags = way.tags || {};
    const coords: [number, number][] = way.geometry.map((g: any) => [g.lat, g.lon]);
    
    // Determine highway characteristics from OSM tags
    const highwayType = tags.highway || 'secondary';
    const lanes = parseInt(tags.lanes) || (highwayType === 'motorway' ? 6 : highwayType === 'primary' ? 4 : 2);
    const hasSidewalk = tags.sidewalk ? tags.sidewalk !== 'no' && tags.sidewalk !== 'none' : false;
    const hasCrossing = tags.crossing === 'yes' || tags['highway'] === 'crossing';
    const hasTrafficSignal = tags['traffic_signals'] === 'yes';
    const isLit = tags.lit === 'yes';
    const surfaceDeclared = tags.surface || 'asphalt';
    
    // Simulate AI inference outputs based on road type
    const isMajor = highwayType === 'primary' || highwayType === 'motorway';
    const potholeCount = isMajor ? Math.floor(Math.random() * 3) : Math.floor(Math.random() * 5);
    const crackCount = Math.floor(Math.random() * 3);
    const surfaceQuality: SurfaceQuality = potholeCount > 2 ? 'poor' : potholeCount > 0 ? 'moderate' : 'good';
    
    const defectScore = Math.min(95, potholeCount * 22 + crackCount * 14);
    const surfaceScore = surfaceQuality === 'poor' ? 75 : surfaceQuality === 'moderate' ? 45 : 15;
    const changeScore = Math.floor(Math.random() * 50) + 10;
    const infrastructureScore = (hasSidewalk ? 0 : 35) + (hasCrossing ? 0 : 25) + (isLit ? 0 : 20);
    const geometryScore = Math.floor(Math.random() * 40) + 20;

    const risk = Math.round(
      0.30 * defectScore +
      0.20 * surfaceScore +
      0.20 * changeScore +
      0.15 * infrastructureScore +
      0.15 * geometryScore
    );

    roads.push({
      id: `osm-way-${way.id}`,
      osmWayId: way.id,
      name: tags.name || `${highwayType.toUpperCase()} Corridor (${way.id})`,
      coordinates: coords,
      lengthMeters: Math.round(calculatePathLength(coords)),
      osm: {
        hasSidewalk,
        sidewalkType: hasSidewalk ? 'both' : 'none',
        hasCrossing,
        hasTrafficSignal,
        isLit,
        lanes,
        surfaceDeclared,
        speedLimitKmh: parseInt(tags.maxspeed) || 50,
        highwayType: highwayType as any,
        bridge: tags.bridge === 'yes',
      },
      potholeCount,
      crackCount,
      surfaceCondition: surfaceQuality,
      widthMeters: lanes * 3.5,
      widthChanged: changeScore > 40,
      changePercentage: Math.round((changeScore / 2) * 10) / 10,
      constructionNearby: changeScore > 45,
      defectScore,
      surfaceScore,
      changeScore,
      infrastructureScore,
      geometryScore,
      overallRisk: risk,
      riskLevel: risk > 75 ? 'CRITICAL' : risk > 50 ? 'HIGH' : risk > 25 ? 'MODERATE' : 'LOW',
      primaryContributors: [
        { factor: 'Potholes & Cracks (YOLO)', percentage: 34, contributionPoints: defectScore * 0.3 },
        { factor: 'Road Surface Degradation (CNN)', percentage: 22, contributionPoints: surfaceScore * 0.2 },
        { factor: 'Satellite Temporal Change', percentage: 18, contributionPoints: changeScore * 0.2 },
        { factor: 'Missing Infrastructure (OSM)', percentage: 15, contributionPoints: infrastructureScore * 0.15 },
        { factor: 'Road Geometry Constriction (U-Net)', percentage: 11, contributionPoints: geometryScore * 0.15 },
      ],
    });
  }

  return roads;
}

function calculatePathLength(coords: [number, number][]): number {
  let meters = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const lat1 = coords[i][0];
    const lon1 = coords[i][1];
    const lat2 = coords[i + 1][0];
    const lon2 = coords[i + 1][1];
    const R = 6371e3;
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    meters += R * c;
  }
  return meters;
}

function generateSynthesizedRoads(centerLat: number, centerLng: number, radiusKm: number): RoadSegment[] {
  const delta = (radiusKm * 0.009) * 0.6; // approx degrees
  const roads: RoadSegment[] = [];

  const roadConfigs = [
    {
      name: 'North-South Arterial Axis',
      coords: [
        [centerLat - delta, centerLng],
        [centerLat - delta * 0.4, centerLng + delta * 0.1],
        [centerLat + delta * 0.3, centerLng - delta * 0.05],
        [centerLat + delta, centerLng + delta * 0.1],
      ] as [number, number][],
      highwayType: 'primary' as const,
      lanes: 4,
      potholes: 3,
      cracks: 2,
      surface: 'poor' as SurfaceQuality,
    },
    {
      name: 'East-West Ring Connection',
      coords: [
        [centerLat, centerLng - delta],
        [centerLat + delta * 0.1, centerLng - delta * 0.3],
        [centerLat - delta * 0.1, centerLng + delta * 0.4],
        [centerLat + delta * 0.05, centerLng + delta],
      ] as [number, number][],
      highwayType: 'secondary' as const,
      lanes: 2,
      potholes: 1,
      cracks: 1,
      surface: 'moderate' as SurfaceQuality,
    },
    {
      name: 'Commercial Access Boulevard',
      coords: [
        [centerLat - delta * 0.7, centerLng - delta * 0.6],
        [centerLat, centerLng],
        [centerLat + delta * 0.8, centerLng + delta * 0.7],
      ] as [number, number][],
      highwayType: 'residential' as const,
      lanes: 2,
      potholes: 4,
      cracks: 2,
      surface: 'critical' as SurfaceQuality,
    },
  ];

  for (let i = 0; i < roadConfigs.length; i++) {
    const cfg = roadConfigs[i];
    const defectScore = cfg.potholes * 24 + cfg.cracks * 12;
    const surfaceScore = cfg.surface === 'critical' ? 90 : cfg.surface === 'poor' ? 75 : 40;
    const changeScore = 45;
    const infrastructureScore = 65;
    const geometryScore = 50;
    const risk = Math.round(
      0.30 * defectScore +
      0.20 * surfaceScore +
      0.20 * changeScore +
      0.15 * infrastructureScore +
      0.15 * geometryScore
    );

    roads.push({
      id: `synth-road-${i + 1}`,
      osmWayId: 900000 + i,
      name: cfg.name,
      coordinates: cfg.coords,
      lengthMeters: 650,
      osm: {
        hasSidewalk: false,
        sidewalkType: 'none',
        hasCrossing: false,
        hasTrafficSignal: true,
        isLit: true,
        lanes: cfg.lanes,
        surfaceDeclared: 'asphalt',
        speedLimitKmh: 45,
        highwayType: cfg.highwayType,
        bridge: false,
      },
      potholeCount: cfg.potholes,
      crackCount: cfg.cracks,
      surfaceCondition: cfg.surface,
      widthMeters: cfg.lanes * 3.5,
      widthChanged: true,
      changePercentage: 14.5,
      constructionNearby: true,
      defectScore,
      surfaceScore,
      changeScore,
      infrastructureScore,
      geometryScore,
      overallRisk: risk,
      riskLevel: risk > 75 ? 'CRITICAL' : risk > 50 ? 'HIGH' : risk > 25 ? 'MODERATE' : 'LOW',
      primaryContributors: [
        { factor: 'Potholes & Cracks (YOLO)', percentage: 35, contributionPoints: defectScore * 0.3 },
        { factor: 'Road Surface Degradation (CNN)', percentage: 22, contributionPoints: surfaceScore * 0.2 },
        { factor: 'Satellite Temporal Change', percentage: 18, contributionPoints: changeScore * 0.2 },
        { factor: 'Missing Infrastructure (OSM)', percentage: 14, contributionPoints: infrastructureScore * 0.15 },
        { factor: 'Road Geometry Constriction (U-Net)', percentage: 11, contributionPoints: geometryScore * 0.15 },
      ],
    });
  }

  return roads;
}

export function generateDefectsForRoads(roads: RoadSegment[], centerLat: number, centerLng: number): GroundDefect[] {
  const defects: GroundDefect[] = [];
  const defectImages = [
    'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=600&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=600&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=600&auto=format&fit=crop&q=80',
  ];
  const gradCamUrls = [
    'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=600&auto=format&fit=crop&q=80',
  ];

  let idCounter = 1;

  for (const road of roads) {
    if (road.potholeCount === 0 && road.crackCount === 0) continue;

    // Distribute defects along the road coordinates
    const coords = road.coordinates;
    if (coords.length === 0) continue;

    const totalToGenerate = Math.min(4, road.potholeCount + road.crackCount);
    for (let k = 0; k < totalToGenerate; k++) {
      const stepFraction = (k + 1) / (totalToGenerate + 1);
      const coordIndex = Math.min(coords.length - 1, Math.floor(stepFraction * coords.length));
      const baseCoord = coords[coordIndex] || [centerLat, centerLng];

      // Add a small realistic jitter (within ~10-20 meters)
      const jitterLat = (Math.random() - 0.5) * 0.0002;
      const jitterLng = (Math.random() - 0.5) * 0.0002;
      const lat = baseCoord[0] + jitterLat;
      const lng = baseCoord[1] + jitterLng;

      const isPothole = k % 2 === 0;
      const severity = road.surfaceCondition === 'critical' ? 'severe' : road.surfaceCondition === 'poor' ? 'moderate' : 'low';
      const confidence = Math.round((0.82 + Math.random() * 0.15) * 100) / 100;

      defects.push({
        id: `def-${road.id}-${idCounter++}`,
        type: isPothole ? 'pothole' : 'severe_crack',
        lat,
        lng,
        severity,
        confidence,
        roadId: road.id,
        roadName: road.name,
        imageUrl: defectImages[idCounter % defectImages.length],
        gradCamUrl: gradCamUrls[idCounter % gradCamUrls.length],
        bbox: {
          id: `box-${idCounter}`,
          type: isPothole ? 'pothole' : 'severe_crack',
          label: isPothole ? `Pothole (${severity})` : `Severe Crack (${severity})`,
          confidence,
          severity,
          x: Math.round(20 + Math.random() * 40),
          y: Math.round(30 + Math.random() * 40),
          width: Math.round(18 + Math.random() * 20),
          height: Math.round(14 + Math.random() * 16),
        },
      });
    }
  }

  return defects;
}
