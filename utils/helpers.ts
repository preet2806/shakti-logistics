
import { TripStatus, RouteData } from '../types.ts';

/**
 * Fetches real road routes using OSRM (Open Source Routing Machine)
 * This is a free public API.
 */
export async function fetchRoutes(
  startLat: number, 
  startLng: number, 
  endLat: number, 
  endLng: number
): Promise<RouteData[]> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson&alternatives=true`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.code !== 'Ok') return [];

    return data.routes.map((r: any) => ({
      distanceKm: Number((r.distance / 1000).toFixed(1)),
      durationMin: Math.round(r.duration / 60),
      geometry: r.geometry.coordinates.map((coord: [number, number]) => [coord[1], coord[0]]), // Convert [lng, lat] to [lat, lng]
      summary: r.name || 'Main Route'
    }));
  } catch (error) {
    console.error("OSRM Fetch Error:", error);
    return [];
  }
}

/**
 * Calculates the great-circle distance between two points (Haversine formula)
 * Returns distance in kilometers.
 * Added to fix missing export error in TripList.tsx.
 */
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return Number(d.toFixed(1));
}

function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}

export const formatMT = (qty: number) => `${qty.toFixed(2)} MT`;
export const formatKm = (qty: number) => `${Math.round(qty)} KM`;
export const formatLiters = (qty: number) => `${Math.round(qty)} L`;

export const getNextTripStatus = (current: TripStatus): TripStatus[] => {
  switch (current) {
    case TripStatus.PLANNED: return [TripStatus.LOADED_AT_SUPPLIER, TripStatus.CANCELLED];
    case TripStatus.LOADED_AT_SUPPLIER: return [TripStatus.IN_TRANSIT];
    case TripStatus.IN_TRANSIT: return [TripStatus.PARTIALLY_UNLOADED, TripStatus.CLOSED];
    case TripStatus.PARTIALLY_UNLOADED: return [TripStatus.PARTIALLY_UNLOADED, TripStatus.CLOSED];
    default: return [];
  }
};
