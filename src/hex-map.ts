import { cellToBoundary, gridDisk, latLngToCell, polygonToCells } from "h3-js";
import { stationQuote } from "./station-data.ts";
import type { Station } from "./station-data.ts";
import type { Fuel } from "./data.ts";

export type PriceCell = {
  id: string;
  boundary: [number, number][];
  stations: Station[];
  average?: number;
  minimum?: number;
  maximum?: number;
};

/** Only measured prices are colored; the surrounding cells have no inferred price. */
export function priceCells(stations: Station[], fuel: Fuel, resolution: number, viewport?: [number, number, number, number]): PriceCell[] {
  const groups = new Map<string, Station[]>();
  for (const station of stations) {
    if (!stationQuote(station, fuel)) continue;
    const id = latLngToCell(station.lat, station.lon, resolution);
    const entries = groups.get(id) || [];
    entries.push(station);
    groups.set(id, entries);
  }
  const all = new Set<string>();
  if (viewport) {
    const [south,west,north,east] = viewport;
    const w = Math.max(-179.99, west), e = Math.min(179.99, east);
    const n = Math.min(85, north), s = Math.max(-85, south);
    if (w < e && s < n && e-w < 350) {
      const visible = polygonToCells([[s,w],[s,e],[n,e],[n,w]], resolution);
      if (!visible.length) visible.push(latLngToCell((s+n)/2, (w+e)/2, resolution));
      for (const id of visible) for (const neighbour of gridDisk(id,1)) all.add(neighbour);
    }
  } else {
    for (const id of groups.keys()) for (const neighbour of gridDisk(id, 2)) all.add(neighbour);
  }
  return Array.from(all, id => {
    const entries = groups.get(id) || [];
    const prices = entries.map(s => stationQuote(s, fuel)!.price);
    return {
      id, boundary: cellToBoundary(id) as [number, number][], stations: entries,
      average: prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : undefined,
      minimum: prices.length ? Math.min(...prices) : undefined,
      maximum: prices.length ? Math.max(...prices) : undefined,
    };
  });
}

export function hexResolution(zoom: number) {
  return zoom < 5 ? 1 : zoom < 6 ? 2 : zoom < 7 ? 3 : zoom < 8 ? 4 : zoom < 9 ? 5 : zoom < 10 ? 6 : zoom < 12 ? 6 : zoom < 14 ? 7 : zoom < 16 ? 8 : 9;
}
