import assert from "node:assert/strict";
import { buildGenerateDraftResponse } from "../scripts/generate-draft-api.mjs";

const response = await buildGenerateDraftResponse({
  brand: "서브웨이",
  region: "수원시",
  sales: "1350",
  premium: "4200",
  listingMemo: "역세권 점심 수요와 포장 주문이 있는 매장",
  author: "insight-agent",
  useLlm: false
});

assert.equal(response.ok, true, response.score?.criticalFailures?.join(" / "));
assert.equal(response.draft.brand, "서브웨이");
assert.equal(response.draft.region, "수원시");
assert.equal(response.draft.author, "insight-agent");
assert.ok(response.draft.titles.length >= 1, "제목 후보가 있어야 합니다.");
assert.equal(response.score.structure.paragraphs, 12);
assert.equal(response.score.structure.repeatCount, 5);
assert.match(response.draft.body, /수원|역세권|대학가|주거/, "수원시 지역 맥락이 반영되어야 합니다.");

console.log("generate draft API integration test passed");
