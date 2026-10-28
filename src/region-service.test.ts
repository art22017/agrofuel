import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {pointInRegion} from "./region-service.ts";

const regions = JSON.parse(readFileSync(new URL("../public/regions.json",import.meta.url),"utf8"));
test("region filtering includes the correct area and excludes neighbouring territory", () => {
  const krasnodar = regions["Краснодарский край"];
  assert.ok(krasnodar);
  assert.equal(pointInRegion(krasnodar,45.035,38.975),true);
  assert.equal(pointInRegion(krasnodar,44.609,40.100),false); // Maykop, Adygea
  assert.ok(regions["Самарская область"] && regions["Воронежская область"]);
});
test("region filtering respects polygon holes", () => {
  const shape = {bbox:[0,0,10,10] as [number,number,number,number], geometry:{type:"Polygon" as const, coordinates:[[[0,0],[10,0],[10,10],[0,10],[0,0]],[[3,3],[7,3],[7,7],[3,7],[3,3]]] as [number,number][][]}};
  assert.equal(pointInRegion(shape,1,1),true);
  assert.equal(pointInRegion(shape,5,5),false);
  assert.equal(pointInRegion(shape,15,5),false);
});
