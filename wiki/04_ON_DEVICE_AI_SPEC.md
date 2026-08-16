# 04. 온디바이스 AI 시스템 명세 (On-Device AI Specification)

## 1. 개요
오피스 더비는 외부 클라우드 LLM API 호출 없이, 브라우저 로컬에서 작동하는 **온디바이스 AI 아키텍처**를 채택하고 있습니다.
- **Tier 1 (Built-in LLM)**: Chrome Canary/Dev/Beta의 `window.ai.languageModel` (Gemini Nano)
- **Tier 2 (Fallback Generator)**: 인브라우저 휴리스틱 & 조합 신경망 생성기 (`js/aiEngine.js`)

---

## 2. 5대 온디바이스 AI 전략 아키타입 (AI Strategic Archetypes)

레이스 중 각 말은 5가지 AI 성향 중 하나를 부여받으며, 매 프레임마다 주변 상황을 실시간 모니터링하여 최적의 타이밍에 아이템을 발동합니다.

```
                  [ evaluateAIStrategy(horse, dt) ]
                                 │
         ┌───────────────┬───────┴───────┬───────────────┐
         ▼               ▼               ▼               ▼
   🎯 저격수        ⚡️ 돌진형       🛡️ 철벽 수호자    🍌 트릭스터 / 🎲 승부사
(Sniper Mode)   (Speedster Mode) (Guardian Mode)  (Trickster / Wildcard)
 1위 500m 이내       아이템 획득      위협 감지 즉시       추격자 20m 접근 시
   카운터 저격        0.3초 내 분사      0.1초 쉴드 방어     바나나 투척 / 막판 스퍼트
```

### 1) 🎯 저격수 (Sniper)
- **전략**: 선두가 결승선 500m 이내로 들어올 때까지 미사일/번개를 아껴두었다가 결정적인 순간에 카운터 저격.
- **트리거**: `item in ['missile', 'lightning']` && `leadHorse.distance >= totalDistance - 500`.

### 2) ⚡️ 돌진형 (Speedster)
- **전략**: 가속 아이템 획득 즉시 폭풍 질주로 초반 선두 장악.
- **트리거**: `item in ['booster', 'magnet']` -> 0.3초 내 즉시 발동.

### 3) 🛡️ 철벽 수호자 (Guardian)
- **전략**: 트랙 전방 50m 내 바나나 감지 또는 미사일 발사 감지 시 0.1초 만에 쉴드 전개.
- **트리거**: `item === 'shield'` && (`obstacleAhead` || `incomingMissile`).

### 4) 🍌 트릭스터 (Trickster)
- **전략**: 뒤따르는 말이 20~30m 내로 바짝 붙었을 때 완벽한 타이밍에 바나나 기습 투척.
- **트리거**: `item === 'banana'` && `hasCloseFollower`.

### 5) 🎲 승부사 (Wildcard)
- **전략**: 꼴찌/최하위권으로 밀릴 때 부스터 위력 +30% 폭발 및 기습 번개 역전 도모.
- **트리거**: `rank >= totalHorses - 1` -> 부스터 배율 1.8배 폭발.

---

## 3. 온디바이스 AI 3대 생성 기능 (Generative Features)

1. **🪄 온디바이스 AI 맞춤형 별명 생성 (AI Nickname Generator)**:
   - 참가자 이름의 음절과 선택된 AI 전략 키워드를 분석하여 `#법카의폭주기관차`, `#마감의장인`, `#탕비실바리스타` 등 유쾌한 사내 캐릭터 별명 생성.
2. **🎙️ 상황 인지형 실시간 AI 스포츠 중계 (Context-Aware Commentary)**:
   - 추월, 아이템 피격, 쉴드 방어 발생 시 공격자와 타겟, AI 성향을 결합하여 역동적인 한국어 캐스터 자막 송출.
3. **📰 경기 후 온디바이스 AI 특종 속보 발행 (AI Post-Race Story)**:
   - 경기 종료 후 1위 우승자와 커피 결제자를 주인공으로 한 스포츠 신문 1면 헤드라인 및 2줄 기사 즉석 작성.
