import assert from "node:assert/strict";
import fs from "node:fs/promises";

const source = await fs.readFile("naver-keyword-server.mjs", "utf8");

assert.match(
  source,
  /classifyContentCompetition\(row\.totalSearch,\s*row\.blogTotal,\s*row\.newsTotal,\s*\[\]\)/,
  "모든 topRows는 추천 대시보드 생성 전에 공급비 기반 기본 경쟁 라벨을 가져야 합니다."
);
assert.doesNotMatch(
  source,
  /competitionLabel:\s*row\.competitionLabel\s*\|\|\s*legacyBlogVolumeLabel/,
  "추천 응답 competitionLabel은 legacy 블로그 경쟁 라벨로 fallback 되면 안 됩니다."
);
assert.match(
  source,
  /const transferRows = safeRows\.filter/,
  "테이블 후보는 지역 양도양수만이 아니라 브랜드 단위 양도양수까지 포함하는 transferRows에서 출발해야 합니다."
);
assert.match(
  source,
  /const regionalOpportunities = topBy\(\s*writingSourceRows,/,
  "메인 테이블 후보는 writingSourceRows를 써서 고검색량 브랜드 후보도 함께 노출해야 합니다."
);

console.log("competition pipeline static test passed");
