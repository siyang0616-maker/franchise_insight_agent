import assert from "node:assert/strict";
import { normalizeDraftHistoryItem } from "../scripts/server-ops.mjs";

const item = normalizeDraftHistoryItem({
  brand: "BBQ",
  region: "인천",
  sourceKeyword: "인천 BBQ 양도양수",
  sourceScore: "9.7",
  sourceCompetitionLabel: "틈새",
  recommendedAt: "2026-06-26T00:00:00.000Z",
  publishedAt: "2026-06-26",
  publishedUrl: "https://example.com/post",
  performanceCheckedAt: "2026-06-27",
  performanceRank: "3",
  performanceNote: "상위 노출 확인",
  inquiryCount: "2"
}, "테스터");

assert.equal(item.sourceKeyword, "인천 BBQ 양도양수");
assert.equal(item.sourceScore, 9.7);
assert.equal(item.sourceCompetitionLabel, "틈새");
assert.equal(item.recommendedAt, "2026-06-26T00:00:00.000Z");
assert.equal(item.publishedAt, "2026-06-26");
assert.equal(item.publishedUrl, "https://example.com/post");
assert.equal(item.performanceCheckedAt, "2026-06-27");
assert.equal(item.performanceRank, 3);
assert.equal(item.performanceNote, "상위 노출 확인");
assert.equal(item.inquiryCount, 2);
assert.equal(item.author, "테스터");

console.log("draft source field normalization test passed");
