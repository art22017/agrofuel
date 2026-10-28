import test from "node:test";
import assert from "node:assert/strict";
import {
  calculate,
  observations,
  priceAt,
  series,
  sources,
  stats,
  tiles,
  regionNames,
} from "./data.ts";

test("regional observations preserve source keys, unique grain and positive prices", () => {
  const keys = observations.map((o) => [o.region, o.fuel, o.date].join("|"));
  assert.equal(new Set(keys).size, keys.length);
  for (const o of observations) {
    assert.ok(Number.isFinite(o.price) && o.price > 0);
    assert.ok(
      sources.some((s) => s.id === o.source && s.observedAt === o.date),
    );
  }
});
test("missing prices remain absent on the selected date", () => {
  assert.equal(
    priceAt("Магаданская область", "diesel", "2026-10-19"),
    undefined,
  );
  assert.equal(priceAt("Магаданская область", "ai98", "2026-10-05"), undefined);
  assert.deepEqual(
    series("Краснодарский край", "diesel", "2026-10-20", "2026-10-27"),
    [],
  );
});
test("same-date national benchmark and exact regional endpoints", () => {
  const s = stats("Краснодарский край", "diesel", "2026-09-20", "2026-10-19");
  assert.equal(s.first?.price, 79.72);
  assert.equal(s.last?.price, 79.16);
  assert.ok(Math.abs(s.delta! + 0.56) < 1e-10);
  assert.ok(Math.abs(s.percent! - (79.16 / 79.72 - 1) * 100) < 1e-10);
  assert.equal(priceAt("Российская Федерация", "diesel", "2026-10-19"), 86.58);
  const week = stats(
    "Краснодарский край",
    "diesel",
    "2026-10-12",
    "2026-10-19",
  );
  assert.equal(week.rows.length, 2);
  assert.ok(Math.abs(week.delta! - 0.1) < 1e-10);
});
test("fuel switches and inclusive custom ranges select their own observations", () => {
  assert.equal(priceAt("Краснодарский край", "ai95", "2026-10-19"), 82.08);
  assert.equal(
    series("Краснодарский край", "diesel", "2026-10-05", "2026-10-12").length,
    2,
  );
  assert.equal(
    stats("Краснодарский край", "diesel", "2026-10-19", "2026-10-19").delta,
    undefined,
  );
});
test("bulk and fleet calculations include delivery and round money to kopecks", () => {
  assert.deepEqual(calculate(10000, 79.16), {
    volume: 10000,
    fuelCost: 791600,
    total: 791600,
  });
  assert.equal(calculate(5 * 130 * 0.5, 79.16, 1500).total, 27227);
  assert.equal(calculate(3, 70.555, 10).total, 221.67);
});
test("tile map has unique coordinates and region names with canonical keys", () => {
  assert.equal(new Set(tiles.map((t) => t.name)).size, tiles.length);
  assert.equal(new Set(tiles.map((t) => `${t.x},${t.y}`)).size, tiles.length);
  assert.equal(tiles.length, 85);
  for (const t of tiles) {
    assert.ok(Number.isFinite(t.x) && Number.isFinite(t.y));
    assert.ok(regionNames.includes(t.name), t.name);
  }
});
