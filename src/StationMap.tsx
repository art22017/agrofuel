import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import type { Fuel } from "./data";
import { fmt } from "./data";
import { stations, stationQuote } from "./station-data";
import { getRegion, fetchRegionalStations, getLoadedPrices, subscribeLoadedPrices } from "./region-service";
import type { RegionGeometry } from "./region-service";
import type { Station } from "./station-data";
import { Icon, Notice } from "./ui";
import { priceCells, hexResolution } from "./hex-map";
import type { PriceCell } from "./hex-map";
const EMPTY_CELLS:PriceCell[] = [];
import SegmentedControl from "./vendor/21st/SegmentedControl";
import { Switch } from "./vendor/21st/Switch";

export default function StationMap({
  region,
  fuel,
  onSelect,
  onSources,
  compact = false,
}: {
  region: string;
  fuel: Fuel;
  onSelect: (s: Station) => void;
  onSources: () => void;
  compact?: boolean;
}) {
  const [brand, setBrand] = useState(""),
    [boundary, setBoundary] = useState<RegionGeometry | null>(null),
    [boundaryLoaded, setBoundaryLoaded] = useState(false),
    [dynamicStations, setDynamicStations] = useState<Station[]>([]),
    [pricesVersion, setPricesVersion] = useState(0),
    [sourceStatus, setSourceStatus] = useState("Загрузка АЗС региона…"),
    [listLimit, setListLimit] = useState(100),
    [query, setQuery] = useState(""),
    [heat, setHeat] = useState(false),
    [zoom, setZoom] = useState(12),
    [viewport, setViewport] = useState<[number,number,number,number] | undefined>(),
    [selectedCell, setSelectedCell] = useState<string | null>(null),
    [priced, setPriced] = useState(false),
    [tileError, setTileError] = useState(false);
  const root = useRef<HTMLDivElement>(null),
    map = useRef<L.Map | null>(null),
    layer = useRef<L.LayerGroup | null>(null),
    heatLayer = useRef<L.LayerGroup | null>(null),
    choose = useRef(onSelect),
    loadedArea = useRef("");
  useEffect(() => {
    choose.current = onSelect;
  }, [onSelect]);
  useEffect(() => {
    let alive = true;
    setBoundary(null); setBoundaryLoaded(false); setDynamicStations([]); setBrand(""); setQuery(""); loadedArea.current="";
    setSourceStatus("Загрузка границ региона…");
    getRegion(region).then(value => { if(alive) {setBoundary(value || null); setBoundaryLoaded(true);} })
      .catch(() => {if(alive) {setBoundaryLoaded(true);setSourceStatus("Границы региона недоступны");}});
    return () => {alive=false;};
  }, [region]);
  useEffect(() => subscribeLoadedPrices(() => setPricesVersion(v => v+1)), []);
  const regional = useMemo(() => {
    const combined = new Map<string, Station>();
    for(const station of dynamicStations) combined.set(station.id,station);
    for(const station of stations.filter(s => s.region === region)) {
      const live = combined.get(station.id);
      combined.set(station.id,live ? {...live, prices:station.prices, city:station.city} : station);
    }
    return [...combined.values()].map(station => {
      const fresh = getLoadedPrices(station.id);
      return fresh ? {...station, prices:{...station.prices,...fresh}} : station;
    });
  }, [region, dynamicStations, pricesVersion]);
  const brands = [...new Set(regional.map((s) => s.name))].sort();
  useEffect(() => setListLimit(100), [region, brand, query, priced, fuel]);
  const shown = useMemo(
    () =>
      regional
        .filter(
          (s) =>
            (!brand || s.name === brand) &&
            (!priced || !!stationQuote(s, fuel)) &&
            (s.name + " " + s.address)
              .toLowerCase()
              .includes(query.toLowerCase()),
        )
        .sort(
          (a, b) =>
            (stationQuote(a, fuel)?.price ?? Infinity) -
            (stationQuote(b, fuel)?.price ?? Infinity),
        ),
    [regional, brand, priced, fuel, query],
  );
  useEffect(() => {
    if (!root.current) return;
    const m = L.map(root.current, {
      center: [45.04, 38.99],
      zoom: 12,
      minZoom: 2,
      maxZoom: 19,
      zoomControl: false,
      attributionControl: true,
      scrollWheelZoom: !compact,
    });
    map.current = m;
    m.attributionControl.setPrefix('<a href="https://leafletjs.com/" title="Leaflet">Leaflet</a>');
    L.control.zoom({ position: "bottomright", zoomInTitle: "Увеличить карту", zoomOutTitle: "Уменьшить карту" }).addTo(m);
    const syncView = () => {
      setZoom(m.getZoom());
      const b = m.getBounds();
      const next: [number,number,number,number] = [b.getSouth(),b.getWest(),b.getNorth(),b.getEast()];
      setViewport(previous => previous && previous.every((v,i) => Math.abs(v-next[i]) < 1e-8) ? previous : next);
    };
    m.on("moveend", syncView);
    syncView();
    heatLayer.current = L.layerGroup().addTo(m);
    const group = L.markerClusterGroup({
      maxClusterRadius: 58,
      disableClusteringAtZoom: 16,
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      iconCreateFunction: (cluster) => {
        const prices = cluster.getAllChildMarkers().flatMap(marker => {
          const value = (marker.options as L.MarkerOptions & { fuelPrice?: number }).fuelPrice;
          return value === undefined ? [] : [value];
        });
        return L.divIcon({
          className: "cluster-container",
          html: `<span class="map-price-cluster">${prices.length ? `<b>от ${fmt(Math.min(...prices))} ₽</b>` : ""}<span>${prices.length ? `${prices.length} цен / ` : ""}${cluster.getChildCount()} АЗС</span></span>`,
          iconSize: prices.length ? [148, 52] : [76, 36],
          iconAnchor: prices.length ? [74, 26] : [38, 18],
        });
      },
    }).addTo(m);
    layer.current = group;
    const observer = new ResizeObserver(() => m.invalidateSize());
    observer.observe(root.current);
    return () => {
      observer.disconnect();
      m.off("moveend", syncView);
      m.remove();
      map.current = null;
      layer.current = null;
      heatLayer.current = null;
    };
  }, [region, compact, boundary]);
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    setTileError(false);
    const base = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '<a href="https://www.openstreetmap.org/copyright">© OpenStreetMap</a>', maxZoom: 19,
    }).addTo(m);
    base.on("tileerror", () => setTileError(true));
    base.on("load", () => setTileError(false));

    return () => { m.removeLayer(base); };
  }, [region, compact, boundary]);
  const cells = useMemo(() => heat ? priceCells(shown, fuel, hexResolution(zoom), viewport) : EMPTY_CELLS, [shown, fuel, zoom, viewport, heat]);
  const pricedCells = cells.filter(c => c.average !== undefined);
  const pricesInCells = pricedCells.map(c => c.average!);
  const minCell = pricesInCells.length ? Math.min(...pricesInCells) : undefined;
  const maxCell = pricesInCells.length ? Math.max(...pricesInCells) : undefined;
  const activeCell = cells.find(c => c.id === selectedCell);
  useEffect(() => { setSelectedCell(null); }, [shown, fuel]);
  useEffect(() => {
    const m = map.current,
      g = layer.current,
      h = heatLayer.current;
    if (!m || !g || !h) return;
    g.clearLayers();
    h.clearLayers();
    const valid = shown.filter((s) => stationQuote(s, fuel)),
      prices = valid.map((s) => stationQuote(s, fuel)!.price),
      low = Math.min(...prices),
      high = Math.max(...prices);
    if (heat) {
      const range = (maxCell ?? 0) - (minCell ?? 0);
      const palette = ["#76d85a", "#c9d164", "#e6ac65", "#e07869"];
      cells.forEach(cell => {
        const hasPrice = cell.average !== undefined;
        const fraction = hasPrice && range ? (cell.average! - minCell!) / range : 0;
        const color = hasPrice ? palette[Math.min(3, Math.floor(fraction * 4))] : "#7e91a0";
        const polygon = L.polygon(cell.boundary, {
          color: hasPrice ? "#d4efbc" : "#9aadb3", weight: hasPrice ? 1.4 : 0.7,
          opacity: hasPrice ? .75 : .22, fillColor: color,
          fillOpacity: hasPrice ? .62 : .09, interactive: hasPrice,
        }).addTo(h);
        if (hasPrice) {
          polygon.on("click", () => setSelectedCell(cell.id));
          const center = polygon.getBounds().getCenter();
          const label = L.marker(center, {
            icon: L.divIcon({className:"hex-label-wrap", html:`<span class="hex-price-label">${fmt(cell.average!)}</span>`, iconSize:[64,28], iconAnchor:[32,14]}),
            title: `Средняя цена в соте: ${fmt(cell.average!)} ₽/л; АЗС с ценой: ${cell.stations.length}`,
            keyboard:true,
          }).addTo(h);
          label.on("click", () => setSelectedCell(cell.id));
        }
      });
    }
    shown.forEach((s) => {
      const quote = stationQuote(s, fuel);
      if (heat) return;
      const html = quote
        ? `<span class="station-pin ${quote.price === low ? "best-price" : ""}">${fmt(quote.price)}</span>`
        : '<span class="station-pin unpriced-pin">АЗС</span>';
      const markerOptions: L.MarkerOptions & {fuelPrice?: number} = {
        icon: L.divIcon({
          className: "map-pin-container",
          html,
          iconSize: [66, 36],
          iconAnchor: [33, 18],
        }),
        title: s.name + " · " + s.address,
        keyboard: true,
        alt: s.name,
        fuelPrice: quote?.price,
      };
      const marker = L.marker([s.lat, s.lon], markerOptions).addTo(g);
      marker.on("click", () => choose.current(s));
    });
  }, [shown, fuel, heat, cells, minCell, maxCell, boundary]);
  useEffect(() => {
    const m=map.current;
    if(!m || !boundary) return;
    const [west,south,east,north]=boundary.bbox;
    if(east-west > 180) {setSourceStatus("Для этого региона карта границ недоступна."); return;}
    const outline=L.geoJSON({type:"Feature", properties:{}, geometry:boundary.geometry} as GeoJSON.GeoJsonObject, {
      style:{color:"#98d77b",weight:1.5,opacity:.65,fillOpacity:0,dashArray:"6 6"}, interactive:false,
    }).addTo(m);
    m.fitBounds([[south,west],[north,east]], {padding:[24,24],maxZoom:12,animate:false});
    return () => {outline.remove();};
  }, [region, boundary]);
  useEffect(() => {
    if (!boundary || !viewport) return;
    const [west,south,east,north]=boundary.bbox;
    if(east-west>180) return;
    const entire=north-south<=14 && east-west<=24;
    const [vs,vw,vn,ve]=viewport;
    const box: [number,number,number,number] = entire ? [south,west,north,east] : [Math.max(south,vs),Math.max(west,vw),Math.min(north,vn),Math.min(east,ve)];
    if(box[2]<=box[0] || box[3]<=box[1]) return;
    if(box[2]-box[0]>15 || box[3]-box[1]>25) {setSourceStatus("Приблизьте карту, чтобы загрузить АЗС в этой части региона."); return;}
    const areaKey = region + ":" + box.map(n => n.toFixed(3)).join(",");
    if (loadedArea.current === areaKey) return;
    const controller=new AbortController();
    setSourceStatus("Загрузка АЗС региона…");
    const timer=window.setTimeout(() => {
      fetchRegionalStations(region,boundary,box,controller.signal).then(rows => {
        loadedArea.current=areaKey;
        setDynamicStations(previous => {
          const all = new Map(previous.map(s => [s.id,s]));
          rows.forEach(s=>all.set(s.id,s)); return [...all.values()];
        });
        setSourceStatus(entire ? `АЗС региона: ${rows.length} · Бензас` : `Загружено в области карты: ${rows.length} · Бензас`);
      }).catch(error => { if(error.name !== "AbortError") setSourceStatus("Источник АЗС недоступен. Сохранённые данные показаны, если они есть."); });
    }, 350);
    return () => {clearTimeout(timer);controller.abort();};
  }, [boundary, region, viewport]);
  if (!boundary && !boundaryLoaded) return <div className="loading-panel"><span className="spinner"/>Загрузка карты региона</div>;
  if (!boundary) return <section className="surface blank-state"><h2>Границы региона не загружены</h2><p>Карта АЗС для этого региона пока недоступна. Статистика цен доступна в обзоре.</p><button className="button secondary" onClick={onSources}>Источники данных</button></section>;
  if (boundary.bbox[2] - boundary.bbox[0] > 180) return <section className="surface blank-state"><h2>Карта региона недоступна</h2><p>Для этого региона требуется уточнить геометрию границ. Статистика цен доступна в обзоре.</p><button className="button secondary" onClick={onSources}>Источники данных</button></section>;
  return (
    <div className={"map-page " + (compact ? "map-preview" : "")}>
      {!compact && <div className="map-help"><p>Выберите АЗС на карте или в списке. В карточке доступны адрес, цена и расчёт заправки.</p></div>}
      {!compact && <div className="map-filters">
        <label className="select-control">
          <span>Сеть</span>
          <select
            aria-label="Сеть АЗС"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
          >
            <option value="">Все сети</option>
            {brands.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
        </label>
        <Switch label="С загруженной ценой" checked={priced} onChange={setPriced} />
        <div className="map-view-control"><span>Режим карты</span><SegmentedControl label="Режим карты" value={heat ? "hex" : "stations"} onValueChange={value => {setHeat(value === "hex"); setSelectedCell(null);}} options={[{value:"hex",label:"Соты цен"},{value:"stations",label:"АЗС"}]}/></div>
        <div className="map-provider-badge">Картография <strong>OpenStreetMap</strong></div>
      </div>}
      {!compact && heat && <div className="hex-guide"><span className="hex-guide-title">Средняя цена АЗС в видимой соте, ₽/л</span>
        {minCell !== undefined && maxCell !== undefined ? <><span>{fmt(minCell)}</span><i className="hex-gradient"/><span>{fmt(maxCell)}</span><span className="hex-no-data"><i/> Нет данных</span></> : <span>Для выбранного топлива нет цен</span>}
        <span className="hex-guide-note">Цвет только там, где есть цены. Нажмите на соту.</span>
      </div>}
      <section className="map-workspace surface">
        {!compact && <aside className="station-list">
          <div className="map-list-status" role="status">{sourceStatus}</div>
          <div className="list-search">
            <Icon name="search" />
            <input
              aria-label="Найти АЗС"
              placeholder="Название или адрес"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="station-scroll">
            {shown.slice(0,listLimit).map((s) => (
              <button
                className="station-row"
                key={s.id}
                onClick={() => onSelect(s)}
              >
                <span>
                  <strong>{s.name}</strong>
                  <span>{s.address}</span>
                </span>
                <b>
                  {stationQuote(s, fuel)
                    ? fmt(stationQuote(s, fuel)!.price) + " ₽"
                    : "—"}
                </b>
              </button>
            ))}
            {shown.length > listLimit && <button className="show-more-stations" onClick={() => setListLimit(n=>n+100)}>Показать ещё · {shown.length-listLimit}</button>}
            {!shown.length && <p className="list-empty">АЗС не найдены. Измените фильтры.</p>}
          </div>
        </aside>}
        <div className="map-column">
          <div
            className="real-map"
            ref={root}
            aria-label={"Карта АЗС: " + region}
          />
          {compact && <div className="compact-map-controls"><SegmentedControl label="Режим карты" value={heat ? "hex" : "stations"} onValueChange={value => {setHeat(value === "hex"); setSelectedCell(null);}} options={[{value:"hex",label:"Соты"},{value:"stations",label:"АЗС"}]}/>{heat && <span className="compact-hex-caption">Средняя цена в соте, ₽/л</span>}</div>}
          {heat && activeCell && activeCell.average !== undefined && <div className="hex-inspect" role="region" aria-label="Цены в выбранной соте">
            <button className="hex-close" onClick={() => setSelectedCell(null)} aria-label="Закрыть данные соты">×</button>
            <span>Средняя цена в соте</span><strong>{fmt(activeCell.average)} <small>₽/л</small></strong>
            <p>АЗС с ценой: {activeCell.stations.length}</p>
            <div className="hex-inspect-list">{activeCell.stations.map(s => <button key={s.id} onClick={() => onSelect(s)}><span>{s.name}<small>{s.address}</small></span><b>{fmt(stationQuote(s,fuel)!.price)} ₽</b></button>)}</div>
            <small>Дату каждой цены смотрите в карточке АЗС</small>
          </div>}
          {tileError && (
            <div className="map-offline">
              Подложка карты недоступна. Адреса и цены доступны в списке.
            </div>
          )}
          <div className="map-source">
            <button onClick={onSources}>Бензас / ПетролПлюс / geoBoundaries</button>
            <span>{compact ? sourceStatus : "Дату цены смотрите в карточке АЗС"}</span>
          </div>
        </div>
      </section>
      {!compact && <Notice>{sourceStatus}. На карте — АЗС по приближённым границам региона (2017), в том числе на трассах. Покрытие зависит от источника. Цена загружается в карточке станции. Соты без цен нейтральны; даты наблюдений могут различаться.</Notice>}
    </div>
  );
}
