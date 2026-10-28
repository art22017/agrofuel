import { lazy, Suspense, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  calculate,
  dateLabel,
  dates,
  daysBefore,
  firstDate,
  fmt,
  fuels,
  latestDate,
  national,
  priceAt,
  regionNames,
  series,
  sources,
  stats,
} from "./data";
import type { Fuel } from "./data";
import { Dialog, Icon, Notice, RegionField, useLocal } from "./ui";
import { Trend, lineColors, priceRows } from "./Trend";
import type { PlotRow } from "./Trend";
import { stationQuote } from "./station-data";
import FarmOverview from "./FarmOverview";
import { fetchStationPrices } from "./region-service";
import { SearchOrb } from "./vendor/21st/SearchOrb";
import Tabs21 from "./vendor/21st/Tabs";
import type { Station } from "./station-data";

const StationMap = lazy(() => import("./StationMap"));
type Page = "market" | "stations" | "compare" | "planning" | "alerts";
type Selection = { region: string; fuel: Fuel };
type Plan = {
  id: string;
  name: string;
  region: string;
  fuel: Fuel;
  volume: number;
  price: number;
  delivery: number;
  total: number;
  createdAt?: string;
};
type Rule = {
  id: string;
  region: string;
  fuel: Fuel;
  price: number;
  direction: "below" | "above";
};
type Metric = {
  title: string;
  region: string;
  fuel: Fuel;
  kind: "price" | "change" | "national" | "budget";
  volume?: number;
  delivery?: number;
  fixedPrice?: number;
  threshold?: number;
};
const pages: { id: Page; label: string }[] = [
  { id: "market", label: "Главная" },
  { id: "stations", label: "АЗС на карте" },
  { id: "compare", label: "Сравнить регионы" },
  { id: "planning", label: "Расчёт заправки" },
  { id: "alerts", label: "Следить за ценой" },
];
const fuelLabel = (fuel: Fuel) =>
  fuel === "diesel" ? "Дизель" : fuels.find((f) => f.id === fuel)!.short;
const signed = (v: number) => `${v > 0 ? "+" : ""}${fmt(v)}`;
const exactRegion = (value: string) =>
  regionNames.find((n) => n.toLowerCase() === value.trim().toLowerCase());
function pageFromHash(): Page | null {
  const value = location.hash.replace(/^#\/?/, "");
  return pages.some((p) => p.id === value) ? (value as Page) : null;
}

function SearchForm({
  initial,
  onSearch,
  busy = false,
}: {
  initial?: Selection | null;
  onSearch: (s: Selection) => void;
  busy?: boolean;
}) {
  const [region, setRegion] = useState(initial?.region || ""),
    [fuel, setFuel] = useState<Fuel>(initial?.fuel || "diesel"),
    [error, setError] = useState("");
  function search(chosen?: string) {
    if (busy) return;
    const result = exactRegion(chosen || region);
    if (!result) {
      setError("Выберите регион из списка.");
      return;
    }
    setError("");
    onSearch({ region: result, fuel });
  }
  return (
    <form
      className={"search-form " + (busy ? "searching" : "")}
      onSubmit={(e) => {
        e.preventDefault();
        search();
      }}
    >
      <div className="search-fields">
        <label className="search-region-label"><span>Регион</span><RegionField
          value={region}
          onChange={setRegion}
          onEnter={(r) => search(r)}
        /></label>
        <label className="search-fuel-label"><span>Топливо</span><select
          aria-label="Вид топлива для поиска"
          value={fuel}
          onChange={(e) => setFuel(e.target.value as Fuel)}
        >
          {fuels.map((f) => (
            <option key={f.id} value={f.id}>
              {fuelLabel(f.id)}
            </option>
          ))}
        </select></label>
        <button
          className="button primary search-submit"
          disabled={busy}
          type="submit"
        >
          {busy ? (
            <>
              <SearchOrb />
              Поиск
            </>
          ) : (
            <>
              Найти цены <Icon name="arrow" />
            </>
          )}
        </button>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {busy && (
        <div className="search-progress" role="status" aria-label="Поиск цен">
          <span />
        </div>
      )}
    </form>
  );
}
function MetricDialog({
  metric,
  start,
  end,
  onClose,
}: {
  metric: Metric;
  start: string;
  end: string;
  onClose: () => void;
}) {
  const baseRegion = metric.kind === "national" ? national : metric.region;
  const base = series(baseRegion, metric.fuel, start, end),
    first = base[0]?.price;
  const rows: PlotRow[] =
    metric.kind === "budget" && metric.fixedPrice !== undefined
      ? [
          {
            date: new Intl.DateTimeFormat("sv-SE", {
              timeZone: "Europe/Moscow",
            }).format(new Date()),
            value: calculate(
              metric.volume || 0,
              metric.fixedPrice,
              metric.delivery || 0,
            ).total,
          },
        ]
      : base.map((r) => ({
          date: r.date,
          value:
            metric.kind === "change"
              ? r.price - (first || 0)
              : metric.kind === "budget"
                ? calculate(metric.volume || 0, r.price, metric.delivery || 0)
                    .total
                : r.price,
        }));
  const value = rows.at(-1)?.value,
    unit = metric.kind === "budget" ? "₽" : "₽/л";
  return (
    <Dialog title={metric.title} onClose={onClose} wide>
      <div className="metric-detail">
        <div className="detail-number">
          {typeof value === "number"
            ? fmt(value, metric.kind === "budget" ? 0 : 2)
            : "—"}
          <span>{unit}</span>
        </div>
        <p className="detail-context">
          {baseRegion} · {fuelLabel(metric.fuel)}
        </p>
        <Trend
          rows={rows}
          lines={[{ key: "value", label: metric.title }]}
          unit={unit}
          height={320}
          threshold={metric.threshold}
        />
        {metric.kind === "budget" && (
          <Notice>
            {metric.fixedPrice !== undefined
              ? "Расчёт по указанной вами цене."
              : "Стоимость выбранного объёма по ценам Росстата, а не история фактических закупок."}
          </Notice>
        )}
        {metric.kind === "change" && first !== undefined && (
          <Notice>
            Изменение относительно первого наблюдения выбранного периода.
          </Notice>
        )}
        {metric.threshold !== undefined && (
          <Notice>Ценовой порог: {fmt(metric.threshold)} ₽/л.</Notice>
        )}
        <details className="values-table">
          <summary>Значения и источник</summary>
          <table>
            <thead>
              <tr>
                <th>Дата</th>
                <th>Значение</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.date}>
                  <td>{dateLabel(r.date, true)}</td>
                  <td>
                    {typeof r.value === "number" ? fmt(r.value) : "—"} {unit}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>
            {metric.kind === "budget" && metric.fixedPrice !== undefined
              ? "Расчёт по указанной цене."
              : "Росстат · средние розничные цены" +
                (metric.kind === "budget" ? " · расчётная стоимость" : "") +
                "."}
          </p>
        </details>
      </div>
    </Dialog>
  );
}

function CalculatorPage({
  selection,
  start,
  end,
  plans,
  setPlans,
  onMetric,
  quote,
  onClearQuote,
  onSaved,
  initialVolume,
  initialMode,
}: {
  selection: Selection;
  start: string;
  end: string;
  plans: Plan[];
  setPlans: (p: Plan[]) => void;
  onMetric: (m: Metric) => void;
  quote: { price: number; station: string } | null;
  onClearQuote: () => void;
  onSaved: () => void;
  initialVolume: number;
  initialMode: "volume" | "fleet";
}) {
  const [tab, setTab] = useState<"calculator" | "saved">("calculator"),
    [mode, setMode] = useState(initialMode),
    [volume, setVolume] = useState(initialVolume),
    [machine, setMachine] = useState("МТЗ-82.1"),
    [count, setCount] = useState(1),
    [tank, setTank] = useState(130),
    [fill, setFill] = useState(100),
    [delivery, setDelivery] = useState(0),
    [manualPrice, setManualPrice] = useState(quote ? String(quote.price) : "");
  const [priceEdited, setPriceEdited] = useState(!!quote);
  const { region, fuel } = selection;
  const market = stats(region, fuel, start, end).last;
  const price = priceEdited ? Number(manualPrice) : market?.price;
  const liters =
    mode === "volume" ? volume : Math.round(count * tank * fill) / 100;
  const valid =
    Number.isFinite(price) &&
    price !== undefined &&
    price > 0 &&
    liters > 0 &&
    delivery >= 0 &&
    count > 0 &&
    tank > 0;
  const result = calculate(liters, price || 0, delivery);
  const history = () =>
    onMetric({
      title: "Стоимость заправки",
      region,
      fuel,
      kind: "budget",
      volume: liters,
      delivery,
      ...(priceEdited ? { fixedPrice: Number(manualPrice) } : {}),
    });
  function save(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setPlans([
      {
        id: crypto.randomUUID(),
        name: mode === "volume" ? "Закупка топлива" : machine + " × " + count,
        region,
        fuel,
        volume: liters,
        price: price!,
        delivery,
        total: result.total,
        createdAt: new Date().toISOString(),
      },
      ...plans,
    ]);
    onSaved();
  }
  const models: Record<string, number> = {
    "МТЗ-82.1": 130,
    "Кировец К-744": 800,
    "Ростсельмаш ACROS": 540,
    "Своя техника": tank,
  };
  return (
    <>
      <Tabs21 tabs={[{id:"calculator", label:"Калькулятор"}, {id:"saved", label:"Сохранённые расчёты"}]} value={tab} onChange={(id) => setTab(id as "calculator" | "saved")}>
      {() => tab === "calculator" ? (
        <div className="calculator-layout">
          <form className="surface calculator-form" onSubmit={save}>
            <div className="segmented">
              <button
                type="button"
                className={mode === "volume" ? "active" : ""}
                onClick={() => setMode("volume")}
              >
                Объём
              </button>
              <button
                type="button"
                className={mode === "fleet" ? "active" : ""}
                onClick={() => setMode("fleet")}
              >
                Техника
              </button>
            </div>
            {quote && (
              <Notice>
                {quote.station}
                <button
                  type="button"
                  className="inline-link"
                  onClick={() => {
                    onClearQuote();
                    setManualPrice("");
                    setPriceEdited(false);
                  }}
                >
                  Использовать среднюю цену
                </button>
              </Notice>
            )}
            <div className="form-grid">
              {mode === "volume" ? (
                <label className="span-two">
                  Объём, л
                  <input
                    type="number"
                    aria-label="Объём топлива"
                    min="1"
                    max="100000000"
                    required
                    value={volume}
                    onChange={(e) => setVolume(Number(e.target.value))}
                  />
                </label>
              ) : (
                <>
                  <label className="span-two">
                    Техника
                    <select
                      aria-label="Техника"
                      value={machine}
                      onChange={(e) => {
                        setMachine(e.target.value);
                        setTank(models[e.target.value]);
                      }}
                    >
                      {Object.keys(models).map((m) => (
                        <option key={m}>{m}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Количество
                    <input
                      type="number"
                      aria-label="Количество техники"
                      min="1"
                      max="10000"
                      required
                      value={count}
                      onChange={(e) => setCount(Number(e.target.value))}
                    />
                  </label>
                  <label>
                    Бак, л
                    <input
                      type="number"
                      aria-label="Объём бака"
                      min="1"
                      max="100000"
                      required
                      value={tank}
                      onChange={(e) => setTank(Number(e.target.value))}
                    />
                  </label>
                  <label className="span-two">
                    Доля заправки, %
                    <input
                      type="number"
                      aria-label="Доля заправки"
                      min="1"
                      max="100"
                      value={fill}
                      onChange={(e) => setFill(Number(e.target.value))}
                      required
                    />
                  </label>
                </>
              )}
              <label>
                Цена, ₽/л
                <input
                  type="number"
                  aria-label="Цена за литр"
                  min="0.01"
                  max="10000"
                  step="0.01"
                  placeholder="Укажите цену"
                  value={priceEdited ? manualPrice : (market?.price ?? "")}
                  onChange={(e) => { setManualPrice(e.target.value); setPriceEdited(true); }}
                />
              </label>
              <label>
                Доставка, ₽
                <input
                  type="number"
                  aria-label="Стоимость доставки"
                  min="0"
                  max="100000000"
                  value={delivery}
                  onChange={(e) => setDelivery(Number(e.target.value))}
                  required
                />
              </label>
            </div>
            <button className="button primary" disabled={!valid} type="submit">
              Сохранить расчёт <Icon name="arrow" />
            </button>
          </form>
          <section className="surface calculation-result">
            <span>Стоимость заправки</span>
            <button
              className="result-number"
              onClick={history}
              disabled={!valid}
              aria-label="Открыть график стоимости закупки"
            >
              {valid ? fmt(result.total, 0) : "—"}
              <span>₽ ↗</span>
            </button>
            <dl className="result-breakdown">
              <div>
                <dt>Топливо</dt>
                <dd>
                  <button className="numeric-link" onClick={history}>
                    {fmt(result.fuelCost, 0)} ₽
                  </button>
                </dd>
              </div>
              <div>
                <dt>Доставка</dt>
                <dd>
                  <button className="numeric-link" onClick={history}>
                    {fmt(delivery, 0)} ₽
                  </button>
                </dd>
              </div>
              <div>
                <dt>Объём</dt>
                <dd>
                  <button className="numeric-link" onClick={history}>
                    {fmt(liters, 0)} л
                  </button>
                </dd>
              </div>
            </dl>
            <Notice>
              {priceEdited
                ? "Цена из расчёта"
                : market
                  ? "Росстат · " + dateLabel(market.date, true)
                  : "Укажите цену для расчёта"}
              . Оптовые условия и сезонность дизеля уточняйте у поставщика.
            </Notice>
          </section>
        </div>
      ) : (
        <section className="surface saved-calculations">
          {plans.length ? (
            <table className="plain-table">
              <thead>
                <tr>
                  <th>Расчёт</th>
                  <th>Регион</th>
                  <th>Стоимость</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {plans.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <button
                        className="row-link"
                        onClick={() =>
                          onMetric({
                            title: p.name,
                            region: p.region,
                            fuel: p.fuel,
                            kind: "budget",
                            volume: p.volume,
                            delivery: p.delivery,
                            fixedPrice: p.price,
                          })
                        }
                      >
                        {p.name}
                      </button>
                    </td>
                    <td>{p.region}</td>
                    <td>
                      <button
                        className="numeric-link"
                        onClick={() =>
                          onMetric({
                            title: "Стоимость заправки",
                            region: p.region,
                            fuel: p.fuel,
                            kind: "budget",
                            volume: p.volume,
                            delivery: p.delivery,
                            fixedPrice: p.price,
                          })
                        }
                      >
                        {fmt(p.total, 0)} ₽
                      </button>
                    </td>
                    <td>
                      <button
                        className="square-button"
                        aria-label={"Удалить расчёт " + p.name}
                        onClick={() =>
                          setPlans(plans.filter((x) => x.id !== p.id))
                        }
                      >
                        <Icon name="close" size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="blank-state">
              <h2>Сохранённых расчётов нет</h2>
              <button
                className="button primary"
                onClick={() => setTab("calculator")}
              >
                Рассчитать закупку
              </button>
            </div>
          )}
        </section>
      )}
      </Tabs21>
    </>
  );
}

export default function Workspace() {
  const [storedSelection, setStoredSelection] = useLocal<Selection | null>(
      "selection",
      null,
    ),
    [selection, setSelection] = useState<Selection | null>(() =>
      pageFromHash() ? storedSelection : null,
    ),
    [page, setPage] = useState<Page>(pageFromHash() || "market");
  const [busy, setBusy] = useState(false),
    [searchOpen, setSearchOpen] = useState(false),
    [sourcesOpen, setSourcesOpen] = useState(false),
    [metric, setMetric] = useState<Metric | null>(null),
    [station, setStation] = useState<Station | null>(null),
    [stationHistory, setStationHistory] = useState(false),
    [stationLoading, setStationLoading] = useState(false),
    [stationPriceError, setStationPriceError] = useState(false),
    [mobileOpen, setMobileOpen] = useState(false),
    [ruleOpen, setRuleOpen] = useState(false),
    [periodOpen, setPeriodOpen] = useState(false),
    [addRegion, setAddRegion] = useState(false),
    [toast, setToast] = useState(""),
    [ruleError, setRuleError] = useState(""),
    [compareError, setCompareError] = useState("");
  const [quickVolume, setQuickVolume] = useState(1000);
  const [calculatorMode, setCalculatorMode] = useState<"volume" | "fleet">("volume");
  const [period, setPeriod] = useState("month"),
    [start, setStart] = useState(daysBefore(latestDate, 29)),
    [end, setEnd] = useState(latestDate),
    [periodError, setPeriodError] = useState("");
  const [comparisons, setComparisons] = useState<string[]>([]),
    [compareDraft, setCompareDraft] = useState(""),
    [quote, setQuote] = useState<{ price: number; station: string } | null>(
      null,
    );
  const [plans, setPlans] = useLocal<Plan[]>("plans", []),
    [rules, setRules] = useLocal<Rule[]>("alerts", []);
  const [ruleRegion, setRuleRegion] = useState("Краснодарский край"),
    [ruleFuel, setRuleFuel] = useState<Fuel>("diesel");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    document.documentElement.dataset.theme = "rshb";
    const old = () => {
      const p = pageFromHash();
      if (p) {
        setPage(p);
        setSelection((current) => current || storedSelection);
      } else setSelection(null);
      setMobileOpen(false);
    };
    window.addEventListener("hashchange", old);
    return () => {
      window.removeEventListener("hashchange", old);
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [storedSelection]);
  useEffect(() => {
    setStationHistory(false);
    if (!station) return;
    const controller=new AbortController(), id=station.id;
    setStationLoading(true); setStationPriceError(false);
    fetchStationPrices(station,controller.signal).then(updated => {
      setStation(current => current?.id === id ? updated : current);
    }).catch(error => {if(error.name !== "AbortError") setStationPriceError(true);})
      .finally(() => {if(!controller.signal.aborted) setStationLoading(false);});
    return () => controller.abort();
  }, [station?.id]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(t);
  }, [toast]);
  function go(p: Page) {
    setPage(p);
    location.hash = "/" + p;
    setMobileOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function search(s: Selection) {
    if (busy) return;
    setBusy(true);
    searchTimer.current = setTimeout(() => {
      setSelection(s);
      setStoredSelection(s);
      setSearchOpen(false);
      setQuote(null);
      setComparisons([]);
      setBusy(false);
      go("market");
    }, 900);
  }
  function setRange(p: string) {
    setPeriod(p);
    if (p === "custom") {
      setPeriodOpen(true);
      return;
    }
    setEnd(latestDate);
    setStart(
      p === "week"
        ? daysBefore(latestDate, 7)
        : p === "all"
          ? firstDate
          : daysBefore(latestDate, 29),
    );
  }
  const region = selection?.region || "Краснодарский край",
    fuel = selection?.fuel || "diesel",
    selectedDate = dates.filter((d) => d >= start && d <= end).at(-1),
    market = stats(region, fuel, start, end),
    current = selectedDate ? priceAt(region, fuel, selectedDate) : undefined;
  const selectedRegions = [
    region,
    ...comparisons.filter((r) => r !== region),
  ].slice(0, 4);
  const selectedFuelQuote = station ? stationQuote(station, fuel) : undefined;
  const openMetric = (
    kind: Metric["kind"],
    title: string,
    extra: Partial<Metric> = {},
  ) => setMetric({ kind, title, region, fuel, ...extra });
  const openRule = () => {
    setRuleRegion(region);
    setRuleFuel(fuel);
    setRuleError("");
    setRuleOpen(true);
  };
  function saveRule(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget),
      p = Number(form.get("price"));
    const r = exactRegion(ruleRegion);
    if (!r || !Number.isFinite(p) || p <= 0) {
      setRuleError(
        !r ? "Выберите регион из списка." : "Укажите цену больше нуля.",
      );
      return;
    }
    setRules([
      ...rules,
      {
        id: crypto.randomUUID(),
        region: r,
        fuel: ruleFuel,
        price: p,
        direction: form.get("direction") as Rule["direction"],
      },
    ]);
    setRuleOpen(false);
    setToast("Правило сохранено");
  }
  return (
    <div className={"product " + (!selection ? "landing-product" : "")}>
      <header className="product-header">
        <a
          className="digital-brand"
          href="#"
          aria-label="РСХБ.цифра — новый поиск"
          onClick={() => {
            setSelection(null);
            setMobileOpen(false);
          }}
        >
          <img src="/brand/rshb-digital.svg" alt="РСХБ | ЦИФРА" />
        </a>
        <span className="product-name">Топливо</span>
        {selection && (
          <button
            className="text-button new-search"
            onClick={() => setSearchOpen(true)}
          >
            <Icon name="search" />
            Новый поиск
          </button>
        )}
        <button
          className="text-button source-header"
          onClick={() => setSourcesOpen(true)}
        >
          Источники
        </button>
        {selection && (
          <button
            className="square-button mobile-navigation"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Открыть меню"
          >
            <span className="menu-lines" />
          </button>
        )}
      </header>
      {!selection ? (
        <main className="search-screen">
          <section className="search-panel">
            <h1>Цены на топливо</h1>
            <p className="search-explanation">Найдите АЗС в своём регионе и рассчитайте стоимость заправки техники.</p>
            <SearchForm
              initial={storedSelection}
              onSearch={search}
              busy={busy}
            />
            <div className="entry-path" aria-label="Как пользоваться сервисом"><span><b>Регион и топливо</b>Выберите, где искать</span><i>→</i><span><b>Цены и АЗС</b>Сравните на карте</span><i>→</i><span><b>Расчёт заправки</b>В литрах или по технике</span></div>
          </section>
        </main>
      ) : (
        <div className="workspace">
          <aside
            className={"navigation " + (mobileOpen ? "navigation-open" : "")}
          >
            <nav aria-label="Разделы сервиса">
              {pages.map((p) => (
                <a
                  href={"#/" + p.id}
                  key={p.id}
                  className={page === p.id ? "active" : ""}
                  aria-current={page === p.id ? "page" : undefined}
                  onClick={(e) => {
                    e.preventDefault();
                    go(p.id);
                  }}
                >
                  {p.label}
                </a>
              ))}
            </nav>
            <button
              className="text-button navigation-source"
              onClick={() => setSourcesOpen(true)}
            >
              Источники данных
            </button>
          </aside>
          {mobileOpen && (
            <div
              className="navigation-shade"
              onClick={() => setMobileOpen(false)}
            />
          )}
          <main className="workspace-main" key={page}>
            <div className="context-row">
              <button
                className="region-context"
                onClick={() => setSearchOpen(true)}
              >
                {region}
                <Icon name="down" size={18} />
              </button>
              <select
                className="fuel-context"
                aria-label="Вид топлива"
                value={fuel}
                onChange={(e) => {
                  const s = { region, fuel: e.target.value as Fuel };
                  setSelection(s);
                  setStoredSelection(s);
                  setQuote(null);
                }}
              >
                {fuels.map((f) => (
                  <option value={f.id} key={f.id}>
                    {fuelLabel(f.id)}
                  </option>
                ))}
              </select>
              {page !== "stations" && page !== "alerts" && (
                <div className="period-context">
                  <span className="sr-only">Период</span>
                  <select
                    aria-label="Период"
                    value={period}
                    onChange={(e) => setRange(e.target.value)}
                  >
                    <option value="week">Неделя</option>
                    <option value="month">Месяц</option>
                    <option value="all">Все даты</option>
                    <option value="custom">Выбрать даты</option>
                  </select>
                  {period === "custom" && (
                    <button
                      className="text-button edit-period"
                      onClick={() => setPeriodOpen(true)}
                    >
                      Изменить даты
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className={"workspace-heading " + (page === "market" ? "market-page-heading" : "")}>
              <h1>{page === "market" ? "Цены и заправка" : pages.find((p) => p.id === page)?.label}</h1>
              {page === "market" && (
                <button
                  className="source-date"
                  onClick={() => setSourcesOpen(true)}
                >
                  Росстат ·{" "}
                  {selectedDate
                    ? dateLabel(selectedDate, true)
                    : "нет наблюдений"}
                </button>
              )}
              {page === "alerts" && (
                <button className="button primary" onClick={openRule}>
                  Добавить правило <Icon name="plus" />
                </button>
              )}
            </div>
            {page === "market" && (
              <FarmOverview region={region} fuel={fuel} start={start} end={end} date={selectedDate}
                volume={quickVolume} setVolume={setQuickVolume}
                onHistory={(kind) => openMetric(kind, kind === "change" ? "Изменение цены" : kind === "national" ? "Цена по России" : "Цена топлива")}
                onBudget={() => openMetric("budget", "Стоимость заправки", {volume:quickVolume})}
                onCalculate={(mode) => {setCalculatorMode(mode); setQuote(null); go("planning");}}
                onStations={() => go("stations")} onStation={setStation}
                onSources={() => setSourcesOpen(true)}
              />
            )}
            {page === "stations" && (
              <Suspense
                fallback={
                  <div className="loading-panel">
                    <span className="spinner" />
                    Загрузка карты
                  </div>
                }
              >
                <StationMap
                  region={region}
                  fuel={fuel}
                  onSelect={setStation}
                  onSources={() => setSourcesOpen(true)}
                />
              </Suspense>
            )}
            {page === "compare" && (
              <>
                <div className="comparison-bar">
                  {selectedRegions.map((r, i) => (
                    <span className="region-chip" key={r}>
                      <i style={{ background: lineColors[i] }} />
                      {r}
                      {r !== region && (
                        <button
                          aria-label={"Убрать " + r}
                          onClick={() =>
                            setComparisons(comparisons.filter((x) => x !== r))
                          }
                        >
                          <Icon name="close" size={18} />
                        </button>
                      )}
                    </span>
                  ))}
                  <button
                    className="button secondary"
                    onClick={() => {
                      setCompareDraft("");
                      setCompareError("");
                      setAddRegion(true);
                    }}
                    disabled={selectedRegions.length >= 4}
                  >
                    Добавить регион <Icon name="plus" size={18} />
                  </button>
                </div>
                <section className="surface comparison-table">
                  <table className="plain-table">
                    <thead>
                      <tr>
                        <th>Регион</th>
                        <th>Цена, ₽/л</th>
                        <th>Изменение, ₽/л</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedRegions.map((r) => {
                        const value = selectedDate
                          ? priceAt(r, fuel, selectedDate)
                          : undefined;
                        const delta = stats(r, fuel, start, end).delta;
                        return (
                          <tr key={r}>
                            <td>
                              <button
                                className="row-link"
                                onClick={() =>
                                  openMetric("price", "Цена топлива", {
                                    region: r,
                                  })
                                }
                              >
                                {r}
                              </button>
                            </td>
                            <td>
                              <button
                                className="numeric-link"
                                onClick={() =>
                                  openMetric("price", "Цена топлива", {
                                    region: r,
                                  })
                                }
                              >
                                {value === undefined
                                  ? "Нет данных"
                                  : fmt(value)}
                              </button>
                            </td>
                            <td>
                              <button
                                className="numeric-link"
                                onClick={() =>
                                  openMetric("change", "Изменение цены", {
                                    region: r,
                                  })
                                }
                              >
                                {delta === undefined ? "—" : signed(delta)}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </section>
                <section className="surface comparison-chart">
                  <Trend
                    rows={priceRows(selectedRegions, fuel, start, end)}
                    lines={selectedRegions.map((r, i) => ({
                      key: r,
                      label: r,
                      color: lineColors[i],
                    }))}
                    height={330}
                  />
                </section>
              </>
            )}
            {page === "planning" && (
              <CalculatorPage
                key={quote?.station || "market"}
                selection={selection}
                initialVolume={quickVolume}
                initialMode={calculatorMode}
                start={start}
                end={end}
                plans={plans}
                setPlans={setPlans}
                onMetric={setMetric}
                quote={quote}
                onClearQuote={() => setQuote(null)}
                onSaved={() => setToast("Расчёт сохранён")}
              />
            )}
            {page === "alerts" && (
              <>
                <Notice>
                  Правила проверяются по последнему загруженному срезу. Отправка
                  email и push не подключена.
                </Notice>
                {rules.length ? (
                  <section className="surface rule-list">
                    {rules.map((r) => {
                      const p = priceAt(r.region, r.fuel, latestDate),
                        hit =
                          p !== undefined &&
                          (r.direction === "below"
                            ? p <= r.price
                            : p >= r.price);
                      return (
                        <div className="rule-row" key={r.id}>
                          <div>
                            <h2>{r.region}</h2>
                            <span>
                              {fuelLabel(r.fuel)} ·{" "}
                              {p === undefined
                                ? "нет наблюдения"
                                : hit
                                  ? "условие выполнено"
                                  : "условие не выполнено"}
                            </span>
                          </div>
                          <button
                            className="rule-threshold"
                            onClick={() =>
                              setMetric({
                                title: "Ценовой порог",
                                region: r.region,
                                fuel: r.fuel,
                                kind: "price",
                                threshold: r.price,
                              })
                            }
                          >
                            {r.direction === "below" ? "≤" : "≥"} {fmt(r.price)}
                            <span>₽/л ↗</span>
                          </button>
                          <button
                            className="square-button"
                            aria-label={"Удалить правило " + r.region}
                            onClick={() =>
                              setRules(rules.filter((x) => x.id !== r.id))
                            }
                          >
                            <Icon name="close" />
                          </button>
                        </div>
                      );
                    })}
                  </section>
                ) : (
                  <section className="surface blank-state">
                    <h2>Правил пока нет</h2>
                    <button className="button secondary" onClick={openRule}>
                      Добавить правило
                    </button>
                  </section>
                )}
              </>
            )}
          </main>
        </div>
      )}
      {toast && (
        <div className="toast-message" role="status">
          <Icon name="check" />
          {toast}
        </div>
      )}
      {searchOpen && (
        <Dialog title="Поиск топлива" onClose={() => setSearchOpen(false)} wide>
          <SearchForm initial={selection} onSearch={search} busy={busy} />
        </Dialog>
      )}
      {metric && (
        <MetricDialog
          metric={metric}
          start={start}
          end={end}
          onClose={() => setMetric(null)}
        />
      )}
      {periodOpen && (
        <Dialog title="Период" onClose={() => setPeriodOpen(false)}>
          <form
            className="dialog-form"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget),
                a = String(f.get("start")),
                b = String(f.get("end"));
              if (a > b) {
                setPeriodError("Дата начала должна быть раньше окончания.");
                return;
              }
              setStart(a);
              setEnd(b);
              setPeriod("custom");
              setPeriodError("");
              setPeriodOpen(false);
            }}
          >
            <label>
              С
              <input
                name="start"
                type="date"
                aria-label="Начало периода"
                required
                defaultValue={start}
              />
            </label>
            <label>
              По
              <input
                name="end"
                type="date"
                aria-label="Конец периода"
                required
                defaultValue={end}
              />
            </label>
            {periodError && <p className="form-error">{periodError}</p>}
            <button className="button primary" type="submit">
              Применить
            </button>
          </form>
        </Dialog>
      )}
      {addRegion && (
        <Dialog title="Добавить регион" onClose={() => setAddRegion(false)}>
          <form
            className="dialog-form"
            onSubmit={(e) => {
              e.preventDefault();
              const r = exactRegion(compareDraft);
              if (r && !selectedRegions.includes(r)) {
                setComparisons([...comparisons, r]);
                setAddRegion(false);
              } else
                setCompareError(
                  r
                    ? "Этот регион уже в сравнении."
                    : "Выберите регион из списка.",
                );
            }}
          >
            <RegionField
              value={compareDraft}
              onChange={setCompareDraft}
              onEnter={(r) => {
                if (!selectedRegions.includes(r)) {
                  setComparisons([...comparisons, r]);
                  setAddRegion(false);
                } else setCompareError("Этот регион уже в сравнении.");
              }}
            />
            {compareError && (
              <p className="form-error" role="alert">
                {compareError}
              </p>
            )}
            <button className="button primary" type="submit">
              Добавить
            </button>
          </form>
        </Dialog>
      )}
      {ruleOpen && (
        <Dialog title="Ценовое правило" onClose={() => setRuleOpen(false)}>
          <form className="dialog-form" onSubmit={saveRule}>
            <RegionField value={ruleRegion} onChange={setRuleRegion} />
            {ruleError && (
              <p className="form-error" role="alert">
                {ruleError}
              </p>
            )}
            <label>
              Топливо
              <select
                aria-label="Топливо для правила"
                value={ruleFuel}
                onChange={(e) => setRuleFuel(e.target.value as Fuel)}
              >
                {fuels.map((f) => (
                  <option value={f.id} key={f.id}>
                    {fuelLabel(f.id)}
                  </option>
                ))}
              </select>
            </label>
            <div className="form-grid">
              <label>
                Условие
                <select name="direction" aria-label="Условие цены">
                  <option value="below">Не выше</option>
                  <option value="above">Не ниже</option>
                </select>
              </label>
              <label>
                Цена, ₽/л
                <input
                  name="price"
                  aria-label="Ценовой порог"
                  type="number"
                  min="0.01"
                  step="0.01"
                  max="10000"
                  defaultValue={current ? Math.floor(current) : 78}
                  required
                />
              </label>
            </div>
            <button className="button primary" type="submit">
              Сохранить
            </button>
          </form>
        </Dialog>
      )}
      {station && (
        <Dialog title={station.name} onClose={() => setStation(null)} drawer>
          <div className="station-detail">
            <p className="station-address">{station.address}</p>
            <div className="detail-fuel-tabs">
              {fuels.map((f) => (
                <button
                  key={f.id}
                  className={fuel === f.id ? "active" : ""}
                  onClick={() => {
                    const s = { region, fuel: f.id };
                    setSelection(s);
                    setStoredSelection(s);
                  }}
                >
                  {fuelLabel(f.id)}
                </button>
              ))}
            </div>
            {stationLoading && <p className="station-loading" role="status">Обновляем данные АЗС…</p>}
            {stationPriceError && <p className="station-loading">Источник сейчас недоступен. Показаны сохранённые данные.</p>}
            {selectedFuelQuote ? (
              <>
                <button className="detail-number station-price-button" onClick={() => setStationHistory(!stationHistory)} aria-expanded={stationHistory}>
                  {fmt(selectedFuelQuote.price)}
                  <span>₽/л</span><span className="station-history-link">История цены {stationHistory ? "↑" : "↓"}</span>
                </button>
                <p>{selectedFuelQuote.grade}</p>
                <Notice>
                  {selectedFuelQuote.observedAt
                    ? "Цена от " +
                      dateLabel(selectedFuelQuote.observedAt.slice(0, 10), true)
                    : "Источник не указал дату цены. Получено " +
                      dateLabel(
                        selectedFuelQuote.retrievedAt.slice(0, 10),
                        true,
                      )}{" "}
                  {selectedFuelQuote.stale && "Источник пометил цену как устаревшую."}
                </Notice>
                <a
                  className="inline-link"
                  href={selectedFuelQuote.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {selectedFuelQuote.source} ↗
                </a>
              </>
            ) : (
              <div className="chart-empty">
                {stationLoading ? "Загружаем цену…" : "Цена этого топлива не опубликована."}
              </div>
            )}
            {selectedFuelQuote && <section className="station-quick-budget">
              <label>Нужно литров<input aria-label="Объём заправки на АЗС" type="number" min="1" max="100000000" value={quickVolume || ""} onChange={e => setQuickVolume(Math.max(0,Math.min(100000000,Number(e.target.value))))}/></label>
              <div><span>Стоимость топлива</span><button disabled={!quickVolume} onClick={() => { openMetric("budget", "Стоимость заправки на АЗС", {volume:quickVolume,fixedPrice:selectedFuelQuote.price}); setStation(null); }}>{fmt(quickVolume * selectedFuelQuote.price,0)} ₽</button></div>
            </section>}
            <div className="station-actions">
              <a
                className="button secondary"
                href={`https://yandex.ru/maps/?rtext=~${station.lat}%2C${station.lon}&rtt=auto`}
                target="_blank"
                rel="noreferrer"
              >
                Маршрут ↗
              </a>
              <button
                className="button primary"
                disabled={!selectedFuelQuote}
                onClick={() => {
                  if (selectedFuelQuote) {
                    setQuote({
                      price: selectedFuelQuote.price,
                      station: station.name + " · " + station.address,
                    });
                    setStation(null);
                    setCalculatorMode("volume");
                    go("planning");
                  }
                }}
              >
                Рассчитать заправку <Icon name="arrow" />
              </button>
            </div>
            {stationHistory && selectedFuelQuote && <section className="station-history-chart"><h2>История цены на АЗС</h2>
                <Trend
                  rows={[
                    {
                      date: (
                        selectedFuelQuote.observedAt ||
                        selectedFuelQuote.retrievedAt
                      ).slice(0, 10),
                      value: selectedFuelQuote.price,
                    },
                  ]}
                  lines={[{ key: "value", label: "Цена на АЗС" }]}
                  height={240}
                />
<Notice>Доступно одно сохранённое наблюдение. Получение страницы не означает обновление цены.</Notice></section>}
          </div>
        </Dialog>
      )}
      {sourcesOpen && (
        <Dialog
          title="Источники данных"
          onClose={() => setSourcesOpen(false)}
          wide
        >
          <div className="source-sections">
            <section>
              <h3>Региональная статистика</h3>
              <p>
                Средние розничные цены Росстата. Даты наблюдений и полнота
                покрытия различаются. Средняя по России берётся из официальной
                публикации.
              </p>
              <div className="publication-list">
                {sources.map((s) => (
                  <a key={s.id} href={s.url} target="_blank" rel="noreferrer">
                    {s.title}
                    <span>↗</span>
                  </a>
                ))}
              </div>
            </section>
            <section>
              <h3>АЗС внутри региона</h3>
              <p>
                Координаты АЗС и цены по запросу из открытой карты Бензас.
                Дополнительные сохранённые цены из ПетролПлюс. Границы регионов
                из geoBoundaries / OpenStreetMap, упрощённая геометрия 2017 года.
                Полнота и точность зависят от источников.
              </p>
              <p>
                Даты получения и обновления цены разделены. Если источник не
                опубликовал дату цены, это указано в карточке АЗС. Средняя по
                региону не подставляется вместо цены АЗС.
              </p>
              <div className="publication-list">
                <a href="https://benzas.ru/" target="_blank" rel="noreferrer">
                  Бензас <span>↗</span>
                </a>
                <a
                  href="https://www.petrolplus.ru/fuelstations/"
                  target="_blank"
                  rel="noreferrer"
                >
                  ПетролПлюс <span>↗</span>
                </a>
                <a href="https://www.geoboundaries.org/" target="_blank" rel="noreferrer">geoBoundaries <span>↗</span></a>
                <a
                  href="https://www.openstreetmap.org/copyright"
                  target="_blank"
                  rel="noreferrer"
                >
                  OpenStreetMap <span>↗</span>
                </a>
              </div>
            </section>
            <section>
              <h3>Расчёты</h3>
              <p>
                Стоимость: объём × цена за литр + доставка. Для техники:
                количество × объём бака × доля заправки. Пропуски не
                заполняются. Расчёты и правила сохраняются в этом браузере.
              </p>
            </section>
          </div>
        </Dialog>
      )}
    </div>
  );
}
