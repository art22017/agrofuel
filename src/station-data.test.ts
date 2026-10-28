import test from "node:test";
import assert from "node:assert/strict";
import { stations, stationQuote } from "./station-data.ts";
import { regionNames } from "./data.ts";

test("station locations have unique identities and verified supported regional scope", () => {
  assert.ok(stations.length > 0);
  assert.equal(new Set(stations.map((s) => s.id)).size, stations.length);
  for (const station of stations) {
    assert.ok(regionNames.includes(station.region));
    assert.ok(Number.isFinite(station.lat) && Number.isFinite(station.lon));
    assert.ok(
      station.lat > 40 &&
        station.lat < 60 &&
        station.lon > 30 &&
        station.lon < 55,
    );
    assert.equal(station.coordinateSource, "https://benzas.ru/");
  }
});
test("station quotes retain their own source and unknown dates remain unknown", () => {
  assert.ok(stations.some((s) => stationQuote(s, "diesel")));
  for (const station of stations)
    for (const quote of Object.values(station.prices)) {
      assert.ok(quote && Number.isFinite(quote.price) && quote.price > 0);
      assert.ok(!Number.isNaN(Date.parse(quote.retrievedAt)));
      if (quote.source === "ПетролПлюс") assert.equal(quote.observedAt, null);
      if (quote.observedAt !== null)
        assert.ok(!Number.isNaN(Date.parse(quote.observedAt)));
      const url = new URL(quote.url);
      assert.equal(url.protocol, "https:");
      assert.equal(url.username, "");
      assert.equal(url.password, "");
    }
});

test("each external address with a quote maps to at most one station in a city", () => {
  const byAddress = new Map();
  for (const station of stations) for (const quote of Object.values(station.prices)) {
    const address = (quote as {referenceAddress?: string}).referenceAddress;
    if (!address) continue;
    const key = station.city + "|" + address;
    const ids = byAddress.get(key) || new Set();
    ids.add(station.id);
    byAddress.set(key, ids);
  }
  for (const ids of byAddress.values()) assert.equal(ids.size,1);
});
