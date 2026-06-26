import assert from "node:assert/strict";
import fs from "node:fs/promises";

const html = await fs.readFile("keyword-insight-agent/insight-agent.html", "utf8");

assert.match(html, /data-draft-index/, "handoff 카드에는 바로 초안 만들기 버튼이 있어야 합니다.");
assert.match(html, /id="draftModal"/, "초안 입력 모달이 있어야 합니다.");
assert.match(html, /id="draftResult"/, "생성된 초안 결과 영역이 있어야 합니다.");
assert.match(html, /function openDraftModal/, "추천 row로 모달을 여는 함수가 있어야 합니다.");
assert.match(html, /function submitDraftModal/, "초안 생성 제출 함수가 있어야 합니다.");
assert.match(html, /\/api\/generate-draft/, "초안 생성 API를 호출해야 합니다.");
assert.match(html, /data-copy-draft/, "생성된 초안을 전체 복사할 수 있어야 합니다.");
assert.doesNotMatch(html, /qs\.set\("brands",defaultBrands\.join/, "기본 로딩은 서버 기본 캐시 키를 사용해야 합니다.");
assert.doesNotMatch(html, /qs\.set\("regions",defaultRegions\.join/, "기본 로딩은 서버 기본 지역 캐시 키를 사용해야 합니다.");

console.log("insight draft UI test passed");
