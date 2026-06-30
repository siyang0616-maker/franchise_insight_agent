# ROADMAP.md - franchise_insight_agent 업그레이드 트래커

이 파일은 Claude와 Codex가 세션이 바뀌어도 놓치지 않도록 미래 작업 항목을 기록해두는 파일입니다.
작업 완료 시 해당 항목에 체크 표시 후 날짜를 기입합니다.

---

## 즉시 처리 필요

### ✅ [URGENT-1] 점수 분해(score-breakdown) 서버 연결
- 완료일: 2026-06-30
- 문제: opportunityScore() 함수가 searchScore, competitionBonus, trendBonus, intentBonus를 내부에서 계산하고 버림.
- 수정 위치: naver-keyword-server.mjs 의 opportunityScore() 함수
- 완료 상태: row 객체에 searchScore, competitionBonus, trendBonus, intentBonus를 저장하도록 연결.
- 완료 조건: 대시보드 키워드 행에 "검색량 5.3 · 경쟁 1.4 · 추세 1.5 · 의도 2.0" 형식 표시 가능.

### ✅ [URGENT-2] 대시보드에서 글쓰기 UI 분리
- 완료일: 2026-06-30
- 문제: "바로 초안 만들기" 버튼이 대시보드 여러 곳에 노출됨.
- 수정 위치: keyword-insight-agent/insight-agent.html
- 완료 상태: 인라인 초안 폼, 전역 초안 모달, handoff 카드의 초안 생성 버튼 제거.
- 완료 조건: 대시보드는 인사이트 확인과 복사용 handoff만 제공하고, 글쓰기는 별도 도구에서 처리.

---

## 다음 단계

### [NEXT-1] 스냅샷 기반 전일/주간 대비 변화 표시
- 현황: snapshots/ 저장은 완성됨. 데이터가 쌓이는 중.
- 추가할 것: 대시보드 KPI 카드에 "전일 대비 +N" 표시.
- 참고: /api/snapshots/compare 라우트는 이미 존재하므로 화면 연결 중심.
- 필요 데이터 누적량: 최소 2일치.

### [NEXT-2] 브랜드 포트폴리오 주간 리포트
- 목적: "이 브랜드를 계속 밀지, 버릴지" 중장기 판단.
- 내용: 브랜드별 검색량 추세(주별 평균), 동시 하락 지역 수.
- 트리거 조건: 스냅샷 7일치 이상 쌓였을 때 자동 계산.

---

## 중기 업그레이드

### [MID-1] 글 엔진 - 다양한 포맷 지원
- 현황: blog-writing-engine.mjs 가 단일 포맷(양도양수 매물형) 생성.
- 추가할 것: 포맷 선택 기능.
- 포맷 A: 현재 방식 (지역/브랜드/매출/비용 중심 매물 소개형).
- 포맷 B: 창업 정보형 (브랜드 전반 특성, 상권 분석 중심).
- 참고 스타일: https://blog.naver.com/yhns12345/224317641868
- 구현 방식: generateBlogArticle(input, { format: "A" | "B" }) 파라미터 추가.
- 완료 조건: 동일 입력에 포맷 A/B 결과를 나란히 미리보기 가능.

### [MID-2] 경쟁 블로그 추적
- 목적: 특정 키워드에서 반복 노출되는 경쟁 블로그/카페 파악.
- 현황: items 배열에 URL/제목/작성자 정보가 있음.
- 추가할 것: 동일 author가 여러 키워드에서 반복 등장하면 "경쟁 주의" 태그 표시.

---

## 설계 원칙

1. 대시보드(franchise_insight_agent)의 목적은 인사이트 확인이다. 글쓰기로 자동 연결하는 것이 목적이 아니다.
2. 글 엔진(blog_writing_maker)의 입력은 사람이 직접 선택한다. 지역, 브랜드명, 창업비용, 월매출, 매장 스펙을 대시보드에서 자동으로 가져올 필요는 없다.
3. 한 도구의 완성도가 높아도 다른 도구가 자동으로 좋아지는 것은 아니다. 대시보드와 글쓰기 엔진은 분리해서 개선한다.
4. 점수(score)는 화면에서 투명하게 분해 표시해야 신뢰할 수 있다.
5. 디자인은 macOS 스타일의 차분한 카드, Pretendard, 적당한 radius와 shadow를 유지한다.
