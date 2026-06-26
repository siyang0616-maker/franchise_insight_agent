import assert from "node:assert/strict";
import { areaContexts, brandContexts, generateLocalBlogArticle } from "../scripts/blog-writing-engine.mjs";

assert.ok(brandContexts["서브웨이"], "서브웨이 표기 컨텍스트가 있어야 합니다.");
assert.ok(!brandContexts["써브웨이"], "글쓰기 엔진 내부 표기는 서브웨이로 통일되어야 합니다.");
assert.ok(brandContexts["BBQ"], "BBQ 전용 브랜드 컨텍스트가 있어야 합니다.");
assert.ok(brandContexts["BBQ"].validationTerms.includes("조리 표준"), "BBQ 컨텍스트는 치킨 운영 맥락을 가져야 합니다.");
assert.ok(areaContexts["수원시"], "수원시 지역 컨텍스트가 있어야 합니다.");
assert.ok(areaContexts["인천"], "인천 지역 컨텍스트가 있어야 합니다.");

const generated = generateLocalBlogArticle({
  brand: "BBQ",
  region: "인천",
  sales: "1200",
  premium: "5000",
  listingMemo: "배달 주문이 꾸준한 주거 배후 매장"
}, { useLlm: false });

assert.equal(generated.ok, true, generated.score?.criticalFailures?.join(" / "));
assert.equal(generated.score.structure.paragraphs, 12);
assert.equal(generated.score.structure.repeatCount, 5);
assert.equal(generated.score.checks.numericClaims.ok, true, generated.score.checks.numericClaims.value);
assert.match(generated.body, /치킨|배달|조리|주말/, "BBQ 초안은 치킨 브랜드 맥락을 반영해야 합니다.");
assert.match(generated.body, /인천|신도시|산업|구도심|역세권/, "인천 초안은 지역 맥락을 반영해야 합니다.");

console.log("blog context coverage test passed");
