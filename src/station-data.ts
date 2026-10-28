import snapshot from "./stations.json" with { type: "json" };
import type { Fuel } from "./data";
export type StationQuote = {
  price: number;
  observedAt: string | null;
  retrievedAt: string;
  source: string;
  url: string;
  grade: string;
  stale: boolean;
};
export type Station = {
  id: string;
  name: string;
  brand: string;
  address: string;
  lat: number;
  lon: number;
  region: string;
  city: string;
  prices: Partial<Record<Fuel, StationQuote>>;
  coordinateSource: string;
  retrievedAt: string;
};
export const stations = snapshot.stations as Station[];
export const stationSnapshot = snapshot.retrievedAt;
export const stationCities = (region: string) => [
  ...new Set(stations.filter((s) => s.region === region).map((s) => s.city)),
];
export function stationQuote(s: Station, fuel: Fuel) {
  return s.prices[fuel];
}
