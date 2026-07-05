import { UZ_CITIES, type UzCity } from '@/lib/data/uz-cities';

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Ближайший город по прямой — этого достаточно для UZ (12 крупных городов),
// без обращения к внешнему geocoding API и без бэкенда.
export function findNearestCity(lat: number, lon: number): string {
  let nearest: UzCity = UZ_CITIES[0];
  let nearestDistanceKm = Infinity;

  for (const city of UZ_CITIES) {
    const distanceKm = haversineKm(lat, lon, city.lat, city.lon);
    if (distanceKm < nearestDistanceKm) {
      nearestDistanceKm = distanceKm;
      nearest = city;
    }
  }

  return nearest.name;
}
