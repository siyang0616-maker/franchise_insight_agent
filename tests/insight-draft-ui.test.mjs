import assert from "node:assert/strict";
import fs from "node:fs/promises";

const html = await fs.readFile("keyword-insight-agent/insight-agent.html", "utf8");
const server = await fs.readFile("naver-keyword-server.mjs", "utf8");

assert.match(html, /function metric\(value, status\)/, "검색량 표시 metric 함수가 정의되어야 합니다.");
assert.match(html, /fallback_brand[\s\S]*\u0028추정\u0029/, "브랜드 보정 검색량은 추정 표시를 붙여야 합니다.");

assert.match(html, /id="keywordDetail"/, "키워드 상세 패널이 있어야 합니다.");
assert.match(html, /data-row-index/, "키워드 행 클릭을 위한 row index가 있어야 합니다.");
assert.match(html, /function openKeywordDetail/, "키워드 상세 패널을 여는 함수가 있어야 합니다.");
assert.match(html, /function renderTrendChart/, "상세 패널 추세 차트를 렌더링해야 합니다.");
assert.match(html, /id="inlineDraftForm" class="inline-draft-form" hidden><\/div>/, "인라인 초안 폼은 빈 hidden 블록으로 고정되어야 합니다.");

assert.doesNotMatch(html, /data-draft-index/, "handoff 카드에는 초안 생성 버튼이 없어야 합니다.");
assert.doesNotMatch(html, /id="draftModal"/, "초안 입력 모달이 없어야 합니다.");
assert.doesNotMatch(html, /id="draftFormStep"|id="draftResultStep"/, "초안 입력/결과 단계가 남아 있으면 안 됩니다.");
assert.doesNotMatch(html, /function openDraftModal|function closeDraftModal|function submitDraftModal|function resetDraftModal/, "초안 모달 함수가 남아 있으면 안 됩니다.");
assert.doesNotMatch(html, /function submitInlineDraft|function toggleInlineDraftForm|id="submitInlineDraft"|id="cancelInlineDraft"/, "인라인 초안 생성 함수와 버튼이 남아 있으면 안 됩니다.");
assert.doesNotMatch(html, /\/api\/generate-draft/, "대시보드 화면에서 초안 생성 API를 호출하면 안 됩니다.");
assert.doesNotMatch(html, /바로 초안 만들기/, "대시보드에 바로 초안 만들기 문구가 남아 있으면 안 됩니다.");
assert.match(html, /data-handoff-index/, "handoff 카드의 복사 버튼은 유지되어야 합니다.");

assert.match(html, /지역·브랜드 광고 우선순위/, "대시보드는 광고 판단 보드로 보여야 합니다.");
assert.match(html, /function adDecision/, "행별 광고 판단 함수가 있어야 합니다.");
assert.match(html, /레드오션 회피/, "레드오션 회피 판단이 있어야 합니다.");
assert.match(html, /벤치마킹 후 진입/, "벤치마킹 후 진입 판단이 있어야 합니다.");
assert.match(html, /광고 우선/, "광고 우선 판단이 있어야 합니다.");
assert.match(html, /id="benchmarkAuthors"/, "반복 노출 블로그/카페 벤치마킹 영역이 있어야 합니다.");
assert.match(html, /검색량\+경쟁\+추세\+의도/, "점수 컬럼 헤더에 구성요소 설명이 있어야 합니다.");
assert.match(html, /score-breakdown/, "점수 분해 표시 영역이 있어야 합니다.");
assert.match(html, /row\.searchScore/, "검색량 분해 점수는 서버 payload 필드를 그대로 읽어야 합니다.");
assert.match(html, /row\.competitionBonus/, "경쟁 분해 점수는 서버 payload 필드를 그대로 읽어야 합니다.");
assert.match(html, /row\.trendBonus/, "추세 분해 점수는 서버 payload 필드를 그대로 읽어야 합니다.");
assert.match(html, /row\.intentBonus/, "의도 분해 점수는 서버 payload 필드를 그대로 읽어야 합니다.");

assert.match(server, /row\.searchScore\s*=\s*Math\.round\(searchScore \* 10\) \/ 10/, "서버 row에 searchScore를 저장해야 합니다.");
assert.match(server, /row\.competitionBonus\s*=\s*Math\.round\(competitionBonus \* 10\) \/ 10/, "서버 row에 competitionBonus를 저장해야 합니다.");
assert.match(server, /row\.trendBonus\s*=\s*Math\.round\(trendBonus \* 10\) \/ 10/, "서버 row에 trendBonus를 저장해야 합니다.");
assert.match(server, /row\.intentBonus\s*=\s*Math\.round\(intentBonus \* 10\) \/ 10/, "서버 row에 intentBonus를 저장해야 합니다.");

assert.match(html, /id="historyPanel"/, "발행 이력 추적 패널이 있어야 합니다.");
assert.match(html, /\/api\/draft-history\/update/, "발행/성과 업데이트 API를 호출해야 합니다.");
assert.match(html, /function labelHue/, "지도 색상은 경쟁상태 색조와 검색량 진하기를 분리해야 합니다.");
assert.match(html, /색이 진할수록 검색량이 많습니다/, "지도 범례에 검색량 진하기 설명이 있어야 합니다.");
assert.match(html, /hero-grid\{[^}]*1\.2fr/, "히어로 영역은 KPI 대비 과도하게 크지 않아야 합니다.");
assert.match(html, /viewBox="0 0 720 330"/, "지도 viewBox 높이는 축소되어야 합니다.");
assert.match(html, /map-svg\{[^}]*height:330px/, "지도 SVG 높이는 약 30% 줄어야 합니다.");
assert.match(html, /handoff-card/, "글쓰기 handoff 항목은 압축 스타일을 적용해야 합니다.");
assert.match(html, /다음 업그레이드 예정/, "사이드바에 다음 업그레이드 안내가 있어야 합니다.");
assert.match(html, /ROADMAP\.md 참고/, "업그레이드 안내에서 ROADMAP.md를 안내해야 합니다.");
assert.doesNotMatch(html, /qs\.set\("brands",defaultBrands\.join/, "기본 로딩은 서버 기본 캐시 키를 사용해야 합니다.");
assert.doesNotMatch(html, /qs\.set\("regions",defaultRegions\.join/, "기본 로딩은 서버 기본 지역 캐시 키를 사용해야 합니다.");

console.log("insight draft UI test passed");
