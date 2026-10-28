import http from "node:http";
import { pathToFileURL } from "node:url";
const port = Number(process.env.AGROFUEL_API_PORT || 8787);
const host = process.env.AGROFUEL_API_HOST || "127.0.0.1";
const cache = new Map();
const originAllowed = origin => /^http:\/\/(127\.0\.0\.1|localhost):(4173|5173|8080)$/.test(origin || "");
const respond = (res, status, body) => { res.writeHead(status,{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}); res.end(JSON.stringify(body)); };
export default async function handler(req,res) {
  if (originAllowed(req.headers.origin)) { res.setHeader("Access-Control-Allow-Origin",req.headers.origin); res.setHeader("Vary","Origin"); }
  if (req.method === "OPTIONS") {res.writeHead(204,{"Access-Control-Allow-Methods":"GET, OPTIONS"}); return res.end();}
  if (req.method !== "GET") return respond(res,405,{error:"Method not allowed"});
  const url = new URL(req.url,`http://${req.headers.host}`);
  let target;
  if (url.pathname === "/api/stations") {
    const values = ["lat1","lon1","lat2","lon2"].map(k => Number(url.searchParams.get(k)));
    const [a,b,c,d] = values;
    if (!values.every(Number.isFinite) || a < -85 || c > 85 || b < -180 || d > 180 || a >= c || b >= d || c-a > 15 || d-b > 25)
      return respond(res,400,{error:"Увеличьте карту для загрузки АЗС."});
    target = new URL("https://benzas.ru/api/stations");
    ["lat1","lon1","lat2","lon2"].forEach((key,i)=>target.searchParams.set(key,values[i].toFixed(4)));
  } else if (/^\/api\/station\/[A-Za-z0-9_-]{1,80}$/.test(url.pathname)) {
    target = new URL("https://benzas.ru/api/station/"+url.pathname.split("/").at(-1)+"/insight");
  } else if (url.pathname === "/api/health") return respond(res,200,{ok:true});
  else return respond(res,404,{error:"Not found"});
  const key=target.toString(), saved=cache.get(key);
  if(saved && saved.expires>Date.now()) return respond(res,200,saved.data);
  try {
    const upstream=await fetch(target,{headers:{"Accept":"application/json","User-Agent":"AgroFuelLocal/1.0"},signal:AbortSignal.timeout(25000)});
    if (!upstream.ok) return respond(res,502,{error:"Источник АЗС временно недоступен."});
    const data=await upstream.json();
    if (url.pathname === "/api/stations" && !Array.isArray(data)) return respond(res,502,{error:"Некорректный ответ источника."});
    if(cache.size>100)cache.delete(cache.keys().next().value);
    cache.set(key,{data,expires:Date.now()+900000});
    respond(res,200,data);
  } catch { respond(res,502,{error:"Не удалось получить данные АЗС."}); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) http.createServer(handler).listen(port,host,()=>console.log(`AgroFuel API listening on ${host}:${port}`));
