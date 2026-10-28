import { lazy, Suspense } from "react";
import { dateLabel, fmt, national, priceAt, stats } from "./data";
import type { Fuel } from "./data";
import type { Station } from "./station-data";
import { Trend, priceRows } from "./Trend";
import { Icon } from "./ui";
import { NumberStepper } from "./vendor/21st/NumberStepper";
import { PriceComparison } from "./vendor/21st/PriceComparison";
import { BentoFrame } from "./vendor/21st/BentoFrame";

import ProviderPrices from "./ProviderPrices";
const StationMap = lazy(() => import("./StationMap"));
export default function FarmOverview({ region, fuel, start, end, date, volume, setVolume,
  onHistory, onBudget, onCalculate, onStations, onStation, onSources,
}: {
  region: string; fuel: Fuel; start: string; end: string; date?: string;
  volume: number; setVolume: (n: number) => void;
  onHistory: (kind: "price" | "change" | "national") => void;
  onBudget: () => void; onCalculate: (mode: "volume" | "fleet") => void;
  onStations: () => void; onStation: (s: Station) => void;
  onSources: () => void;
}) {
  const price = date ? priceAt(region, fuel, date) : undefined;
  const country = date ? priceAt(national, fuel, date) : undefined;
  const market = stats(region, fuel, start, end);
  return <div className="farm-overview farm-layout">
    <BentoFrame className="find-fuel-card surface">
      <div className="find-fuel-intro">
        
        <h2>Где заправиться</h2>
        <p>АЗС в регионе, на трассах и за пределами городов.</p>
        <button className="button primary" onClick={onStations}>Выбрать АЗС <Icon name="arrow" /></button>
      </div>
      <div className="overview-map"><Suspense fallback={<div className="map-loading"><span className="spinner"/>Загрузка карты</div>}><StationMap region={region} fuel={fuel} onSelect={onStation} onSources={onSources} compact /></Suspense></div>
    </BentoFrame>
      <BentoFrame className="fill-card">
        <div className="card-heading"><h2>Сколько стоит заправка</h2><span className="fill-symbol" aria-hidden="true">₽</span></div>
        <NumberStepper label="Сколько литров нужно?" value={volume} onChange={setVolume} min={0} step={100} />
        <div className="volume-presets">{[500,1000,5000].map(n => <button key={n} className={n===volume?"active":""} onClick={() => setVolume(n)}>{fmt(n,0)} л</button>)}</div>
        <div className="fill-estimate"><span>Ориентировочная стоимость</span><button onClick={onBudget} disabled={price === undefined || volume <= 0} aria-label="Стоимость заправки — открыть историю">{price === undefined || volume <= 0 ? "—" : fmt(price*volume,0)} <span>₽</span><Icon name="arrow" /></button></div>
        <p>По средней цене региона. Цена на конкретной АЗС может отличаться.</p>
        <button className="button fill-action" onClick={() => onCalculate("volume")} disabled={!volume}>Уточнить расчёт <Icon name="arrow" /></button>
        <button className="fleet-link" onClick={() => onCalculate("fleet")}>Выбрать технику</button>
      </BentoFrame>

      <BentoFrame className="price-story surface">
        <div className="card-heading"><h2>Цена в регионе</h2><button className="quiet-link" onClick={onSources}>Росстат {date ? ", " + dateLabel(date) : ""}</button></div>
        <div className="price-story-value">
          <button className="hero-number" onClick={() => onHistory("price")} aria-label="Средняя цена — открыть историю">{price === undefined ? "—" : fmt(price)} <span>₽/л</span></button>
          {market.delta !== undefined && <button className={"change-pill " + (market.delta <= 0 ? "down" : "up")} onClick={() => onHistory("change")}>
            {market.delta < 0 ? "Снижение" : market.delta > 0 ? "Рост" : "Без изменения"} {fmt(Math.abs(market.delta))} ₽/л <span>за период</span>
          </button>}
        </div>
        <Trend rows={priceRows([region],fuel,start,end)} lines={[{key:region,label:region}]} height={180} area />
        <PriceComparison region={price} national={country} onSelect={(key) => onHistory(key === "region" ? "price" : "national")} />
      </BentoFrame>
    <ProviderPrices region={region} fuel={fuel}/>
  </div>;
}
