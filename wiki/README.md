# 🏇 Office Derby - LLM & Developer Wiki

> **오피스 더비 (Office Derby)** 프로젝트의 설계 아키텍처, 의사결정 기록(ADR), 물리/아이템 시스템 명세, 온디바이스 AI 사양 및 확장 가이드를 정리한 위키입니다.  
> LLM 및 개발자가 코드를 이해하고 안전하게 기능을 고도화할 수 있도록 모든 설계 원칙과 히스토리를 상세히 기술합니다.

---

## 📚 위키 목차 (Wiki Index)

| 문서 | 설명 | 주요 내용 |
| :--- | :--- | :--- |
| **[01. 전체 아키텍처 (Architecture)](./01_ARCHITECTURE.md)** | 시스템 모듈 구조 및 데이터 흐름 | 코어 엔진, 렌더러, 오디오, AI 모듈 분리 및 단방향 데이터 흐름 |
| **[02. 아키텍처 의사결정 기록 (ADR)](./02_DECISION_RECORDS_ADR.md)** | 주요 기술 선택 배경 및 판단 근거 | 순수 2D Canvas, Web Audio 합성, 온디바이스 AI, 무의존성 ESM 구조 등 |
| **[03. 아이템 & 물리 시스템 명세](./03_ITEM_SYSTEM_SPEC.md)** | 아이템 6종 물리 및 다중 레인 타겟팅 | 🍌 바나나 레인 추적, 🎯 미사일 포물선, 🛡️ 쉴드 방어 매트릭스 |
| **[04. 온디바이스 AI 시스템 명세](./04_ON_DEVICE_AI_SPEC.md)** | AI 성향 5종 및 생성 엔진 사양 | Chrome Gemini Nano + 브라우저 내장 생성기, 실시간 중계 및 신문 기사 |
| **[05. 개발자 확장 가이드 (Extension Guide)](./05_DEVELOPER_EXTENSION_GUIDE.md)** | 새 기능 추가 및 테스트 방법 | 새 아이템/AI 성향/벌칙 룰 추가 가이드 및 단위 테스트 실행법 |

---

## 🧪 테스트 실행 방법 (Testing)

본 프로젝트는 Node.js 내장 테스트 러너(`node:test`)를 사용하여 외부 의존성 설치 없이 즉시 실행 가능합니다.

```bash
# 전체 단위 테스트 실행 (22개 테스트)
npm test

# 특정 모듈 테스트 실행
node --test tests/penalty.test.js
node --test tests/itemManager.test.js
node --test tests/aiEngine.test.js
node --test tests/presetManager.test.js
node --test tests/raceEngine.test.js
```
