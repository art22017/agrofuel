import test from "node:test";
import assert from "node:assert/strict";
import { priceCells, hexResolution } from "./hex-map.ts";
import { stations, stationQuote } from "./station-data.ts";

test("H3 cells aggregate actual station prices and leave neighbours without invented values", () => {
  const area = stations.filter(s => s.city === "Краснодар");
  const cells = priceCells(area, "diesel", 7);
  const measured = cells.filter(cell => cell.average !== undefined);
  assert.ok(measured.length > 0);
  assert.ok(cells.some(cell => cell.average === undefined && cell.stations.length === 0));
  assert.equal(measured.reduce((sum, cell) => sum + cell.stations.length, 0), area.filter(s => stationQuote(s,"diesel")).length);
  for (const cell of measured) {
    const prices = cell.stations.map(s => stationQuote(s,"diesel")!.price);
    assert.equal(cell.average, prices.reduce((a,b) => a+b,0) / prices.length);
    assert.equal(cell.minimum, Math.min(...prices));
    assert.equal(cell.maximum, Math.max(...prices));
    assert.ok(cell.boundary.length >= 5);
  }
});

test("no quoted observations means no colored or invented hex cells", () => {
  const unpriced = stations.filter(s => !stationQuote(s,"ai98"));
  assert.deepEqual(priceCells(unpriced, "ai98", 7), []);
  assert.ok(hexResolution(14) > hexResolution(10));
});

test("visible area is fully tessellated and missing cells remain unpriced", () => {
  const area = stations.filter(s => s.city === "Краснодар");
  const cells = priceCells(area, "diesel", 7, [44.99,38.85,45.17,39.20]);
  assert.ok(cells.length > 30);
  assert.ok(cells.some(c => c.average === undefined && c.stations.length === 0));
  assert.ok(cells.some(c => c.average !== undefined));
});

test("an unpriced viewport is neutral even when the grid is visible", () => {
  const area = stations.filter(s => s.city === "Краснодар").map(s => ({...s, prices:{}}));
  const cells = priceCells(area, "diesel", 6, [44.99,38.85,45.17,39.20]);
  assert.ok(cells.length > 0);
  assert.ok(cells.every(c => c.average === undefined && c.stations.length === 0));
});
