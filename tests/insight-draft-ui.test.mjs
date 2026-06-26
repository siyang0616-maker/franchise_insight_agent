import assert from "node:assert/strict";
import fs from "node:fs/promises";

const html = await fs.readFile("keyword-insight-agent/insight-agent.html", "utf8");

assert.match(html, /data-draft-index/, "handoff 카드에는 바로 초안 만들기 버튼이 있어야 합니다.");
assert.match(html, /id="draftModal"/, "초안 입력 모달이 있어야 합니다.");
assert.match(html, /function metric\(value, status\)/, "검색량 표시 metric 함수가 정의되어야 합니다.");
assert.match(html, /fallback_brand[\s\S]*\u0028추정\u0029/, "브랜드 보정 검색량은 추정 표시를 붙여야 합니다.");
assert.match(html, /id="draftFormStep"/, "모달 안에 초안 입력 단계가 있어야 합니다.");
assert.match(html, /id="draftResultStep"/, "모달 안에 생성 결과 단계가 있어야 합니다.");
assert.doesNotMatch(html, /<section class="panel draft-result" id="draftResult"/, "초안 결과는 우측 사이드 패널에 있으면 안 됩니다.");
assert.match(html, /function openDraftModal/, "추천 row로 모달을 여는 함수가 있어야 합니다.");
assert.match(html, /function submitDraftModal/, "초안 생성 제출 함수가 있어야 합니다.");
assert.match(html, /function submitDraftModal[\s\S]*const submitBtn\s*=\s*\$\("submitDraftModal"\);[\s\S]*submitBtn\.disabled\s*=\s*true[\s\S]*showDraftResult\(data\.draft\)[\s\S]*finally\s*\{[\s\S]*submitBtn\.disabled\s*=\s*false/, "초안 생성 모달은 제출 중 버튼을 잠그고, 결과 표시 후 같은 모달에서 버튼 상태를 복구해야 합니다.");
const submitDraftModalBody = html.slice(html.indexOf("async function submitDraftModal"), html.indexOf("async function renderAll"));
assert.doesNotMatch(submitDraftModalBody, /closeDraftModal\(\)/, "초안 생성 완료 후 모달이 자동으로 닫히면 안 됩니다.");
assert.match(html, /function resetDraftModal/, "모달 닫기와 단계 초기화 로직이 있어야 합니다.");
assert.match(html, /\/api\/generate-draft/, "초안 생성 API를 호출해야 합니다.");
assert.match(html, /data-copy-draft/, "생성된 초안을 전체 복사할 수 있어야 합니다.");
assert.match(html, /id="keywordDetail"/, "키워드 상세 패널이 있어야 합니다.");
assert.match(html, /data-row-index/, "키워드 행 클릭을 위한 row index가 있어야 합니다.");
assert.match(html, /function openKeywordDetail/, "키워드 상세 패널을 여는 함수가 있어야 합니다.");
assert.match(html, /function renderTrendChart/, "상세 패널 추세 차트를 렌더링해야 합니다.");
assert.match(html, /function submitInlineDraft/, "상세 패널 인라인 초안 생성 함수가 있어야 합니다.");
assert.match(html, /function submitInlineDraft[\s\S]*const payload = \{[\s\S]*recommendedAt: new Date\(\)\.toISOString\(\),\s*useLlm:false[\s\S]*\};\s*const submitBtn/, "인라인 초안 생성도 로컬 엔진 경로를 사용해야 합니다.");
assert.match(html, /!data\.ok&&!\s*data\.draft/, "품질 경고로 ok=false여도 draft가 있으면 결과를 보여줘야 합니다.");
assert.match(html, /id="historyPanel"/, "발행 이력 추적 패널이 있어야 합니다.");
assert.match(html, /\/api\/draft-history\/update/, "발행/성과 업데이트 API를 호출해야 합니다.");
assert.match(html, /function labelHue/, "지도 색상은 경쟁상태 색조와 검색량 진하기를 분리해야 합니다.");
assert.match(html, /색이 진할수록 검색량이 많습니다/, "지도 범례에 검색량 진하기 설명이 있어야 합니다.");
assert.match(html, /hero-grid\{[^}]*1\.2fr/, "히어로 영역은 KPI 대비 과도하게 크지 않아야 합니다.");
assert.match(html, /viewBox="0 0 720 330"/, "지도 viewBox 높이는 축소되어야 합니다.");
assert.match(html, /map-svg\{[^}]*height:330px/, "지도 SVG 높이는 약 30% 줄어야 합니다.");
assert.match(html, /handoff-card/, "글쓰기 handoff 항목은 압축 스타일을 적용해야 합니다.");
assert.doesNotMatch(html, /qs\.set\("brands",defaultBrands\.join/, "기본 로딩은 서버 기본 캐시 키를 사용해야 합니다.");
assert.doesNotMatch(html, /qs\.set\("regions",defaultRegions\.join/, "기본 로딩은 서버 기본 지역 캐시 키를 사용해야 합니다.");

console.log("insight draft UI test passed");
