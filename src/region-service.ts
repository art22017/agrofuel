import type { Station, StationQuote } from "./station-data";
import type { Fuel } from "./data";

type Point = [number, number];
type Ring = Point[];
type Polygon = Ring[];
type Geometry = {type:"Polygon"; coordinates:Polygon} | {type:"MultiPolygon"; coordinates:Polygon[]};
export type RegionGeometry = {bbox:[number,number,number,number]; geometry:Geometry};
let regionsPromise: Promise<Record<string,RegionGeometry>> | undefined;
export function getRegion(name:string) {
  regionsPromise ??= fetch("/regions.json").then(r => {if(!r.ok) throw new Error("Нет границ регионов"); return r.json();});
  return regionsPromise.then(regions => regions[name]);
}
function ringHasPoint(ring:Ring, x:number, y:number) {
  let inside = false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++) {
    const [xi,yi]=ring[i], [xj,yj]=ring[j];
    if ((yi>y)!==(yj>y) && x < (xj-xi)*(y-yi)/(yj-yi)+xi) inside=!inside;
  }
  return inside;
}
export function pointInRegion(region:RegionGeometry, lat:number, lon:number) {
  const polygons=region.geometry.type === "Polygon" ? [region.geometry.coordinates] : region.geometry.coordinates;
  return polygons.some(poly => poly.length > 0 && ringHasPoint(poly[0],lon,lat) && !poly.slice(1).some(ring=>ringHasPoint(ring,lon,lat)));
}
const api = typeof window !== "undefined" && location.port === "4173" ? "http://127.0.0.1:8787/api" : "/api";
type RawStation = {osm_id:string; name?:string; brand?:string; addr?:string; lat:number; lon:number};
export async function fetchRegionalStations(region:string, boundary:RegionGeometry, box:[number,number,number,number], signal:AbortSignal):Promise<Station[]> {
  const [south,west,north,east]=box;
  const params=new URLSearchParams({lat1:String(south),lon1:String(west),lat2:String(north),lon2:String(east)});
  const r=await fetch(`${api}/stations?${params}`,{signal});
  if(!r.ok) { const e=await r.json().catch(()=>({})); throw new Error(e.error || "Не удалось загрузить АЗС"); }
  const rows:RawStation[]=await r.json(), retrievedAt=new Date().toISOString();
  return rows.filter(s => s.osm_id && Number.isFinite(s.lat) && Number.isFinite(s.lon) && pointInRegion(boundary,s.lat,s.lon)).map(s => ({
    id:String(s.osm_id), name:s.name || s.brand || "АЗС", brand:s.brand || s.name || "", address:s.addr || "Адрес не указан",
    lat:s.lat, lon:s.lon, region, city:"", prices:{}, coordinateSource:"https://benzas.ru/", retrievedAt,
  }));
}
const loadedPrices = new Map<string, Partial<Record<Fuel,StationQuote>>>();
const listeners = new Set<() => void>();
export const getLoadedPrices = (id:string) => loadedPrices.get(id);
export function subscribeLoadedPrices(callback:() => void) { listeners.add(callback); return () => {listeners.delete(callback);}; }
export async function fetchStationPrices(station:Station,signal:AbortSignal):Promise<Station> {
  const r=await fetch(`${api}/station/${encodeURIComponent(station.id)}`,{signal});
  if(!r.ok) throw new Error("Источник цен недоступен");
  const data=await r.json(), grades:Record<string,Fuel>={"92":"ai92","95":"ai95","98":"ai98","100":"ai98","ДТ":"diesel"};
  const prices:Partial<Record<Fuel,StationQuote>>={...station.prices};
  for(const [grade, value] of Object.entries(data.prices || {})) {
    const entry=value as {price?:number;at?:string;stale?:boolean};
    if(grades[grade] && typeof entry.price === "number" && entry.price>0) prices[grades[grade]]={price:entry.price, observedAt:entry.at || null, retrievedAt:new Date().toISOString(), source:"Бензас",url:"https://benzas.ru/",grade,stale:!!entry.stale};
  }
  loadedPrices.set(station.id, prices); listeners.forEach(callback => callback());
  return {...station,prices};
}
