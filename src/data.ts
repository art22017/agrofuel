import snapshot from "./snapshot.json" with { type: "json" };
export type Fuel = "diesel" | "ai92" | "ai95" | "ai98";
export type Observation = {
  region: string;
  date: string;
  fuel: string;
  price: number;
  source: string;
};
export const observations: Observation[] = snapshot.observations;
export const sources = snapshot.sources;
export const dates = [...new Set(observations.map((o) => o.date))].sort();
export const latestDate = dates.at(-1)!;
export const firstDate = dates[0];
export const daysBefore = (iso: string, days: number) => {
  const date = new Date(iso + "T12:00:00Z");
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
};
export const fuels: { id: Fuel; label: string; short: string }[] = [
  { id: "diesel", label: "Дизельное топливо", short: "ДТ" },
  { id: "ai92", label: "Бензин АИ-92", short: "АИ-92" },
  { id: "ai95", label: "Бензин АИ-95", short: "АИ-95" },
  { id: "ai98", label: "Бензин АИ-98 и выше", short: "АИ-98+" },
];
export const national = "Российская Федерация";
export const fmt = (v: number, d = 2) =>
  new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  }).format(v);
export const plural = (n: number, one: string, few: string, many: string) =>
  n % 100 >= 11 && n % 100 <= 14
    ? many
    : n % 10 === 1
      ? one
      : n % 10 >= 2 && n % 10 <= 4
        ? few
        : many;
export const dateLabel = (s: string, year = false) =>
  new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    ...(year ? { year: "numeric" } : {}),
  }).format(new Date(s + "T12:00:00"));
export const regionNames = [...new Set(observations.map((o) => o.region))]
  .filter((x) => x !== national)
  .sort((a, b) => a.localeCompare(b, "ru"));
export const priceAt = (region: string, fuel: Fuel, date: string) =>
  observations.find(
    (o) => o.region === region && o.fuel === fuel && o.date === date,
  )?.price;
export function series(region: string, fuel: Fuel, start: string, end: string) {
  return observations
    .filter(
      (o) =>
        o.region === region &&
        o.fuel === fuel &&
        o.date >= start &&
        o.date <= end,
    )
    .sort((a, b) => a.date.localeCompare(b.date));
}
export function stats(region: string, fuel: Fuel, start: string, end: string) {
  const rows = series(region, fuel, start, end),
    first = rows[0],
    last = rows.at(-1);
  return {
    rows,
    first,
    last,
    delta:
      first && last && rows.length > 1 ? last.price - first.price : undefined,
    percent:
      first && last && rows.length > 1
        ? (last.price / first.price - 1) * 100
        : undefined,
  };
}
export function calculate(volume: number, price: number, delivery: number = 0) {
  return {
    volume,
    fuelCost: Math.round(volume * price * 100) / 100,
    total: Math.round((volume * price + delivery) * 100) / 100,
  };
}
export function downloadCsv(name: string, rows: (string | number)[][]) {
  const content =
    "\uFEFF" +
    rows
      .map((row) =>
        row.map((v) => '"' + String(v).replaceAll('"', '""') + '"').join(";"),
      )
      .join("\r\n");
  const url = URL.createObjectURL(
    new Blob([content], { type: "text/csv;charset=utf-8;" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
// Tile positions express geography schematically; they are not boundaries.
const tileRows = [
  "МУР:Мурманская область:4 КАМ:Камчатский край:17 ЧУК:Чукотский авт. округ:18",
  "КАР:Республика Карелия:4 АРХ:Архангельская область:6 НЕН:Ненецкий авт. округ:8 ЯНАО:Ямало-Ненецкий авт. округ:10 ЯКУ:Республика Саха (Якутия):14 МАГ:Магаданская область:16",
  "СПБ:г. Санкт-Петербург:2 ЛЕН:Ленинградская область:3 ВОЛ:Вологодская область:5 КОМ:Республика Коми:7 ХМАО:Ханты-Мансийский авт. округ:10 КРЯ:Красноярский край:12 ХАБ:Хабаровский край:16 САХ:Сахалинская область:18",
  "КЛГ:Калининградская область:0 ПСК:Псковская область:2 НОВ:Новгородская область:3 ТВЕ:Тверская область:4 ЯРО:Ярославская область:5 КОС:Костромская область:6 КИР:Кировская область:7 ПЕР:Пермский край:8 СВЕ:Свердловская область:9 ТЮМ:Тюменская область:10 ТОМ:Томская область:11 ИРК:Иркутская область:13 АМУ:Амурская область:15 ЕАО:Еврейская авт. область:16",
  "СМО:Смоленская область:2 МСК:г. Москва:3 МО:Московская область:4 ВЛА:Владимирская область:5 ИВА:Ивановская область:6 МЭ:Республика Марий Эл:7 УДМ:Удмуртская Республика:8 БАШ:Республика Башкортостан:9 КУР:Курганская область:10 НСО:Новосибирская область:11 КЕМ:Кемеровская область:12 БУР:Республика Бурятия:14 ЗАБ:Забайкальский край:15 ПРИ:Приморский край:17",
  "БРЯ:Брянская область:2 КАЛ:Калужская область:3 ТУЛ:Тульская область:4 РЯЗ:Рязанская область:5 НИЖ:Нижегородская область:6 ЧУВ:Чувашская Республика:7 ТАТ:Республика Татарстан:8 ЧЕЛ:Челябинская область:9 ОМС:Омская область:10 АЛТ:Алтайский край:11 ХАК:Республика Хакасия:12 ТЫВ:Республика Тыва:13",
  "КУС:Курская область:2 ОРЛ:Орловская область:3 ЛИП:Липецкая область:4 ТАМ:Тамбовская область:5 МОР:Республика Мордовия:6 УЛЬ:Ульяновская область:7 САМ:Самарская область:8 ОРЕ:Оренбургская область:9 РАЛ:Республика Алтай:11",
  "БЕЛ:Белгородская область:2 ВОР:Воронежская область:3 ПЕН:Пензенская область:5 САР:Саратовская область:6",
  "СЕВ:г. Севастополь:0 КРМ:Республика Крым:1 КДА:Краснодарский край:2 РОС:Ростовская область:3 ВГГ:Волгоградская область:4 КМЫ:Республика Калмыкия:5 АСТ:Астраханская область:6",
  "АДЫ:Республика Адыгея:2 СТА:Ставропольский край:3 ДАГ:Республика Дагестан:6",
  "КЧР:Карачаево-Черкесская Республика:2 КБР:Кабардино-Балкарская Республика:3 ОСЕ:Республика Северная Осетия - Алания:4 ИНГ:Республика Ингушетия:5 ЧЕЧ:Чеченская Республика:6",
];
export const tiles = tileRows.flatMap((row, y) =>
  row.split(/\s+(?=[А-ЯЁ]+:)/).map((t) => {
    const [code, name, x] = t.split(":");
    return { code, name, x: Number(x), y };
  }),
);
