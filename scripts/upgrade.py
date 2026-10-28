from pathlib import Path
p=Path('src/ProviderPrices.tsx')
p.write_text('''import { useState } from "react";
import rows from "./provider-prices.json";
import { fmt, dateLabel } from "./data";
import type { Fuel } from "./data";
import { Dialog } from "./ui";
export default function ProviderPrices({region,fuel}:{region:string;fuel:Fuel}) {
 const [selected,setSelected]=useState<(typeof rows)[number] | null>(null);
 const quotes=rows.filter(q=>q.region===region && q.fuel===fuel);
 return <section className="provider-prices surface"><div><h2>Другие источники</h2><p>Средние по выборке поставщика, ₽/л</p></div>
 {quotes.length ? <div className="provider-rows">{quotes.map(q=><button key={q.source} onClick={()=>setSelected(q)} className="provider-row"><span><strong>{q.source}</strong><small>{q.observedAt ? dateLabel(q.observedAt,true) : "Дата цены не опубликована"}</small></span><b>{fmt(q.price)}</b></button>)}</div> : <p>Для этого топлива в регионе дополнительных значений пока нет.</p>}
 {selected && <Dialog title={selected.source} onClose={()=>setSelected(null)}><div className="provider-detail"><strong>{fmt(selected.price)} ₽/л</strong><p>{region}. {selected.scope}. Это региональный индекс, а не предложение конкретной АЗС.</p><p>{selected.observedAt ? "Дата наблюдения: "+dateLabel(selected.observedAt,true) : "Источник не опубликовал дату наблюдения."} Получено {dateLabel(selected.retrievedAt,true)}.</p><p>Сохранено одно наблюдение. График появится после следующего импорта; ежедневные значения не моделируются.</p><a className="button secondary" href={selected.url} target="_blank" rel="noreferrer">Открыть источник</a></div></Dialog>}
 </section>;
}
''',encoding='utf-8')
p=Path('src/FarmOverview.tsx');s=p.read_text(encoding='utf-8').replace('const StationMap =','import ProviderPrices from "./ProviderPrices";\nconst StationMap =');s=s.replace('<span className="location-eyebrow">Весь регион</span>','').replace('Росстат {date ? "· "','Росстат {date ? ", "').replace('{market.delta < 0 ? "↘" : market.delta > 0 ? "↗" : "→"}','{market.delta < 0 ? "Снижение" : market.delta > 0 ? "Рост" : "Без изменения"}');s=s.replace('  </div>;','    <ProviderPrices region={region} fuel={fuel}/>\n  </div>;');p.write_text(s,encoding='utf-8')
p=Path('src/StationMap.tsx');s=p.read_text(encoding='utf-8').replace('Бензас · ПетролПлюс · geoBoundaries','Бензас / ПетролПлюс / geoBoundaries');p.write_text(s,encoding='utf-8')
p=Path('src/ui.tsx');s=p.read_text(encoding='utf-8');a=s.index('  const paths =');b=s.index('\n}\nexport function Dialog',a);s=s[:a]+'''  const icons = {search: MagnifyingGlass, close: X, arrow: ArrowRight, down: CaretDown, plus: Plus, check: Check, back: ArrowLeft};
  const Glyph=icons[name];
  return <Glyph size={size} weight="regular" aria-hidden="true"/>;'''+s[b:];s='import { MagnifyingGlass, X, ArrowRight, CaretDown, Plus, Check, ArrowLeft } from "@phosphor-icons/react";\n'+s;p.write_text(s,encoding='utf-8')
# Reuse exactly the same read-only handler locally and on Vercel.
p=Path('server/api.mjs');s=p.read_text();s=s.replace('http.createServer(async (req,res) => {','export default async function handler(req,res) {');s=s.replace('}).listen(port,host,()=>console.log(`AgroFuel API listening on ${host}:${port}`));','}\nif (process.argv[1] && import.meta.url === new URL(process.argv[1], "file:///").href) http.createServer(handler).listen(port,host,()=>console.log(`AgroFuel API listening on ${host}:${port}`));');s=s.replace('import http from "node:http";','import http from "node:http";\nimport { pathToFileURL } from "node:url";').replace('new URL(process.argv[1], "file:///").href','pathToFileURL(process.argv[1]).href');p.write_text(s)
Path('api').mkdir(exist_ok=True);Path('api/[...path].js').write_text('export { default } from "../server/api.mjs";\n')
Path('vercel.json').write_text('{"framework":"vite","buildCommand":"npm run build","outputDirectory":"dist","functions":{"api/[...path].js":{"maxDuration":30}},"rewrites":[{"source":"/api/:path*","destination":"/api/[...path]"}]}')
