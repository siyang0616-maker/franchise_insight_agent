# 프랜차이즈 글감 인사이트 에이전트

검색수요를 기준으로 오늘 쓸 프랜차이즈 양도양수 글감을 고르고, 저장한 글감과 초안 품질을 관리하는 로컬 앱입니다.

## Git 기준 폴더

GitHub Desktop과 Codex에서 기준으로 삼을 폴더는 이 저장소 루트입니다.

```text
franchise_insight_agent
```

이 폴더 안에 `.git`, `naver-keyword-server.mjs`, `keyword-insight-agent/insight-agent.html`이 함께 있어야 합니다.

## 실행

윈도우:

```text
keyword-insight-agent/start-keyword-insight-agent.bat
```

macOS:

```text
chmod +x keyword-insight-agent/start-keyword-insight-agent.command
keyword-insight-agent/start-keyword-insight-agent.command
```

브라우저 주소:

```text
http://127.0.0.1:8766/keyword-insight-agent/insight-agent.html
```

## 기능

- 시작 점검: 서버, Git, API 설정, 캐시 상태 확인
- 브랜드 수요 TOP 10: 양도양수/창업/창업비용 수요 비교
- 지역+브랜드 기회 TOP 10: 지역 키워드 기반 글감 후보 정리
- 오늘 글감 후보: 바로 저장할 수 있는 제목/각도 추천
- 저장한 글감: 브라우저 localStorage에 글감 목록 보관
- 백업/가져오기: 저장한 글감과 초안을 JSON 파일로 내보내고 다시 불러오기
- 초안 품질 검수: 글자 수, 문단 수, 2문단 사실 소개, 반복 표현 점검

## 맥/윈도우 공용 운영 순서

1. 작업 시작 전 GitHub Desktop에서 Fetch origin을 누릅니다.
2. Pull 버튼이 보이면 먼저 Pull 합니다.
3. 이 저장소 루트에서 앱을 실행합니다.
4. 작업이 끝나면 GitHub Desktop에서 변경 파일을 확인합니다.
5. 커밋 후 Push origin을 누릅니다.

## 로컬 전용 파일

아래 파일은 PC마다 다르게 유지합니다. GitHub에 올리지 않습니다.

- `naver-api-config.json`
- `keyword-cache*.json`
- `server.log`
- `.DS_Store`

공유용 설정 예시는 `naver-api-config.example.json`만 사용합니다.

## GitHub에 올리기 좋은 시점

비전공자 기준으로는 아래 3가지가 끝났을 때 올리면 됩니다.

1. 앱 화면에서 원하는 기능이 보입니다.
2. 버튼을 눌렀을 때 에러 없이 동작합니다.
3. GitHub Desktop의 Changes 목록에 `naver-api-config.json`, `keyword-cache*.json`, `server.log`가 없습니다.

이 조건이 맞으면 GitHub Desktop에서 Summary에 짧게 적고 Commit to main, Push origin 순서로 진행합니다.

추천 커밋 문구 예시:

```text
Add status dashboard and draft backup tools
```

## 다음 작업 인수인계

Windows 컴퓨터나 다음 Codex 세션에서 이어서 작업할 때는 먼저 아래 문서를 확인합니다.

```text
PROJECT_HANDOFF.md
```

