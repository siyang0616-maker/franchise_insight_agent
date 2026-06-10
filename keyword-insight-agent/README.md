# 프랜차이즈 글감 인사이트 에이전트

글쓰기 에이전트에서 분리한 검색수요 분석 전용 앱입니다.

## 역할

- 브랜드별 양도양수/창업/창업비용 검색수요 확인
- 지역+브랜드 조합의 글감 기회 확인
- 오늘 먼저 검토할 글감 후보 정리

## 실행

루트 폴더의 `naver-keyword-server.mjs`를 실행한 뒤 아래 주소로 접속합니다.

```text
http://127.0.0.1:8765/keyword-insight-agent/insight-agent.html
```

윈도우에서는 `start-keyword-insight-agent.bat`, 맥에서는 `start-keyword-insight-agent.command`를 사용할 수 있습니다.

## 운영 기준

이 앱은 글을 직접 쓰지 않습니다. 무엇을 쓸지 판단하는 역할만 맡고, 실제 문체와 초안 품질은 `naver-blog-agent.html`에서 관리합니다.
