import assert from "node:assert/strict";
import {
  buildTrend7d,
  normalizeDataLabPoints
} from "../scripts/keyword-insight-metrics.mjs";

const points = normalizeDataLabPoints([
  { period: "2026-06-20", ratio: 10.04 },
  { period: "2026-06-21", ratio: 12.05 },
  { period: "2026-06-22", ratio: 15.56 }
]);

assert.deepEqual(points, [
  { date: "2026-06-20", value: 10 },
  { date: "2026-06-21", value: 12.1 },
  { date: "2026-06-22", value: 15.6 }
]);

const trend7d = buildTrend7d({
  points: [
    { date: "2026-06-14", value: 1 },
    { date: "2026-06-15", value: 2 },
    { date: "2026-06-16", value: 3 },
    { date: "2026-06-17", value: 4 },
    { date: "2026-06-18", value: 5 },
    { date: "2026-06-19", value: 6 },
    { date: "2026-06-20", value: 7 },
    { date: "2026-06-21", value: 8 }
  ]
});

assert.equal(trend7d.points.length, 7);
assert.deepEqual(trend7d.points[0], { date: "2026-06-15", value: 2 });
assert.equal(trend7d.average, 5);
assert.equal(trend7d.delta, 6);

console.log("trend point shape test passed");
