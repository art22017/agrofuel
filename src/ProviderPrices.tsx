import { useState } from "react";
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
