# 05. 개발자 확장 가이드 (Developer Extension Guide)

> 이 문서는 새로운 아이템, AI 성향, 벌칙 룰, 사운드 효과 등을 안전하게 추가하고자 하는 개발자 및 LLM을 위한 확장 가이드입니다.

---

## 1. 새로운 아이템 추가 방법 (How to Add a New Item)

새로운 아이템(예: 💣 `폭탄` 또는 🧊 `얼음`)을 추가할 때는 다음 3개 파일을 순서대로 수정합니다.

### 1단계: `js/presets.js`에 아이템 상수 등록
```javascript
export const ITEM_TYPES = {
  // 기존 아이템들...
  ICE: {
    id: 'ice',
    name: '얼음 마법',
    icon: '🧊',
    desc: '선두 주자를 2초간 꽁꽁 얼려 정지시킵니다.',
    duration: 2.0
  }
};
```

### 2단계: `js/itemManager.js`에 발동 효과 구현
```javascript
case 'ice': {
  const target = horses.find(h => h.rank === 1 && !h.finished);
  if (target) {
    if (target.shieldActive) {
      target.shieldActive = false;
      onEvent('shieldBlock', target, { attacker: horse });
    } else {
      triggerEvent(target, 'slip', `🧊 [${target.name}] 얼음 빙결!`, item.duration, 0.0);
    }
  }
  break;
}
```

### 3단계: `tests/itemManager.test.js`에 단위 테스트 추가
```javascript
it('useItem (Ice): 1등 말을 2초간 정지시켜야 한다', () => {
  // 테스트 코드 작성
});
```

---

## 2. 새로운 온디바이스 AI 성향 추가 방법

### 1단계: `js/presets.js`에 `AI_STRATEGIES` 등록
```javascript
{
  id: 'tactician',
  name: '전술가',
  icon: '♟️',
  tag: '완벽한 쿨타임 계산',
  desc: '트랙 중간(50%)에 도달할 때까지 모든 아이템을 아꼈다가 연속 콤보 발동',
  color: '#8B5CF6'
}
```

### 2단계: `js/raceEngine.js`의 `evaluateAIStrategy`에 판단 분기 추가
```javascript
else if (strat === 'tactician') {
  if (horse.distance >= this.totalDistance * 0.5) {
    shouldActivate = true;
  }
}
```

---

## 3. 새로운 커피 벌칙 룰 추가 방법

### 1단계: `js/penalty.js`에 룰 등록 및 로직 추가
```javascript
export const PENALTY_RULES = {
  // 기존 룰...
  TOP3_SAFE: 'top3Safe'
};

export const RULE_DESCRIPTIONS = {
  // 기존 설명...
  top3Safe: '🥉 1~3등 포디움 제외 전원 N빵'
};

export function calculatePenaltyHorses(finalRankings, rule) {
  // ...
  if (rule === PENALTY_RULES.TOP3_SAFE) {
    return finalRankings.slice(3); // 4등부터 전원
  }
}
```

### 2단계: `tests/penalty.test.js`에 테스트 케이스 추가 후 검증
```bash
npm test
```

---

## 4. 커밋 & 품질 체크리스트 (Quality Checklist)

모든 코드 수정 후 다음 명령어를 실행하여 100% 그린 라이트를 확인하세요:
- [ ] `npm test` (전체 22+ 단위 테스트 패스)
- [ ] 브라우저에서 아이템전 & 스피드전 1회 이상 정상 완주 확인
- [ ] [📋 슬랙 / 카톡 결과 복사] 클립보드 포맷팅 정상 확인
