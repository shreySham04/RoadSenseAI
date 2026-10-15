import { IntegrationsStatus, PlanetScene } from '../types';

export interface GoogleMapsConfig {
  available: boolean;
  apiKey: string;
  attributionId: string;
}

export async function fetchIntegrationsStatus(): Promise<IntegrationsStatus> {
  try {
    const res = await fetch('/api/integrations/status');
    if (!res.ok) throw new Error('Status fetch failed');
    return await res.json();
  } catch (err) {
    console.warn('Could not retrieve integrations status:', err);
    return {
      gemini: { available: false, model: 'gemini-3.8-flash' },
      googleMaps: { available: false },
      planet: { available: false },
    };
  }
}

export async function fetchGoogleMapsConfig(): Promise<GoogleMapsConfig> {
  try {
    const res = await fetch('/api/maps/config');
    if (!res.ok) throw new Error('Maps config failed');
    return await res.json();
  } catch (err) {
    console.warn('Could not fetch Google Maps config:', err);
    return { available: false, apiKey: '', attributionId: 'gmp_git_agentskills_v1' };
  }
}

export async function searchPlanetScenes(params: {
  lat: number;
  lng: number;
  radiusKm?: number;
  maxCloudCover?: number;
}): Promise<{ count: number; features: PlanetScene[] }> {
  try {
    const res = await fetch('/api/planet/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lat: params.lat,
        lng: params.lng,
        radiusKm: params.radiusKm ?? 2.0,
        maxCloudCover: params.maxCloudCover ?? 0.25,
        itemTypes: ['PSScene'],
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error || `Planet search error (${res.status})`);
    }

    const data = await res.json();
    return {
      count: data.count || 0,
      features: data.features || [],
    };
  } catch (err: any) {
    console.warn('Planet search failed:', err);
    throw err;
  }
}

export async function checkGoogleStreetView(lat: number, lng: number): Promise<{ available: boolean; status: string }> {
  try {
    const res = await fetch(`/api/maps/streetview/metadata?lat=${lat}&lng=${lng}`);
    if (!res.ok) return { available: false, status: 'UNKNOWN' };
    const data = await res.json();
    return {
      available: data.status === 'OK',
      status: data.status,
    };
  } catch {
    return { available: false, status: 'ERROR' };
  }
}

export interface GeocodedLocation {
  formatted_address: string;
  name: string;
  city?: string;
  country?: string;
  lat: number;
  lng: number;
  source?: string;
}

export async function geocodeLocation(query: string): Promise<GeocodedLocation[]> {
  try {
    const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
    if (!res.ok) return [];
    const data = await res.json();
    if (data.status === 'OK' && Array.isArray(data.results)) {
      return data.results;
    }
    return [];
  } catch (err) {
    console.warn('Geocoding request failed:', err);
    return [];
  }
}

export async function reverseGeocodeLocation(lat: number, lng: number): Promise<GeocodedLocation | null> {
  try {
    const res = await fetch(`/api/geocode/reverse?lat=${lat}&lng=${lng}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status === 'OK') {
      return {
        formatted_address: data.formatted_address,
        name: data.name,
        city: data.city,
        country: data.country,
        lat,
        lng,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function geocodeWithGoogleMaps(query: string): Promise<{
  formatted_address: string;
  lat: number;
  lng: number;
  name?: string;
  city?: string;
  country?: string;
} | null> {
  const results = await geocodeLocation(query);
  if (results.length > 0) {
    return results[0];
  }
  return null;
}
