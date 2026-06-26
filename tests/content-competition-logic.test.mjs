import assert from "node:assert/strict";
import {
  classifyContentCompetition,
  occupancyBonusFor
} from "../scripts/keyword-insight-metrics.mjs";

const adItem = { ageDays: 3, intent: "양도양수형" };
const infoItem = { ageDays: 20, intent: "정보형" };

assert.equal(classifyContentCompetition(6920, 30, 0, []).label, "틈새");
assert.equal(classifyContentCompetition(6920, 50000, 0, [adItem, adItem, adItem, adItem]).label, "피하기");
assert.equal(classifyContentCompetition(10, 5, 0, []).label, "관찰");

const midDecision = classifyContentCompetition(300, 80, 0, [infoItem]);
assert.ok(["관찰", "따라쓰기"].includes(midDecision.label));
assert.equal(midDecision.supplyRatio, 26.67);
assert.equal(midDecision.demandLevel, "mid");

assert.equal(occupancyBonusFor({ competitionLabel: "틈새" }), 2.0);
assert.equal(occupancyBonusFor({ competitionLabel: "따라쓰기" }), 0.8);
assert.equal(occupancyBonusFor({ competitionLabel: "관찰" }), 0);
assert.equal(occupancyBonusFor({ competitionLabel: "피하기" }), -1.5);

console.log("content competition logic test passed");
