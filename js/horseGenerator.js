/**
 * horseGenerator.js - 온디바이스 AI 기반 밸런스 경주마 및 5대 능력치 생성 순수 모듈 (테스터블 모듈)
 * 
 * [스탯 밸런스 보장 시스템]
 * 모든 경주마는 총합 350 포인트의 스탯 예산(Stat Budget)을 엄격하게 나누어 가집니다.
 * - 최고속도 (Speed): 50 ~ 90
 * - 가속력 (Acceleration): 50 ~ 90
 * - 지구력 (Stamina): 50 ~ 90
 * - 행운 (Luck): 50 ~ 90
 * - 지능 (Intellect): 50 ~ 90
 * 합계: 정확히 350 pt (평균 70 pt)
 */

import { HORSE_COLORS, AI_STRATEGIES } from './presets.js';

export const TOTAL_STAT_BUDGET = 350;
export const MIN_STAT_VALUE = 50;
export const MAX_STAT_VALUE = 90;

export const HORSE_ARCHETYPES = [
  {
    id: 'sprinter',
    name: '스프린터 (단거리 폭격기)',
    desc: '초반 및 최고속도에 특화되어 선두를 빠르게 장악합니다.',
    baseWeights: { speed: 85, accel: 80, stamina: 55, luck: 65, intellect: 65 },
    defaultStrategy: 'speedster'
  },
  {
    id: 'stayer',
    name: '스테이어 (장거리 강철심장)',
    desc: '지구력과 페이스 조절이 뛰어나 후반 직선주로에서 지치지 않습니다.',
    baseWeights: { speed: 75, accel: 60, stamina: 85, luck: 65, intellect: 65 },
    defaultStrategy: 'wildcard'
  },
  {
    id: 'tactician',
    name: '전술형 (지능적 암살마)',
    desc: '높은 지능과 행운으로 결정적인 아이템 타이밍을 낚아챕니다.',
    baseWeights: { speed: 60, accel: 65, stamina: 60, luck: 80, intellect: 85 },
    defaultStrategy: 'sniper'
  },
  {
    id: 'guardian_tank',
    name: '철벽 가디언 (디펜더)',
    desc: '단단한 방어력과 지능으로 상대의 공격을 튕겨내며 전진합니다.',
    baseWeights: { speed: 65, accel: 60, stamina: 85, luck: 60, intellect: 80 },
    defaultStrategy: 'guardian'
  },
  {
    id: 'trick_master',
    name: '트릭 마스터 (함정 전문가)',
    desc: '극강의 행운과 가속력으로 트랙을 혼란에 빠뜨립니다.',
    baseWeights: { speed: 60, accel: 80, stamina: 55, luck: 90, intellect: 65 },
    defaultStrategy: 'trickster'
  },
  {
    id: 'allrounder',
    name: '올라운더 (육각형 밸런스)',
    desc: '모든 영역에서 결점 없이 균형 잡힌 안정적인 경기력을 발휘합니다.',
    baseWeights: { speed: 70, accel: 70, stamina: 70, luck: 70, intellect: 70 },
    defaultStrategy: 'speedster'
  }
];

const HORSE_NAME_PREFIXES = [
  '질풍의', '번개치는', '불패의', '새벽의', '황금빛',
  '강철의', '은빛', '천둥', '영광의', '돌풍의',
  '커피향', '칼퇴의', '월급날', '탕비실', '야근탈출'
];

const HORSE_NAME_SUFFIXES = [
  '질주마', '스트라이커', '바람', '챔피언', '다크호스',
  '샤이닝', '불사조', '샤크', '에스프레소', '토네이도',
  '익스프레스', '루키', '워리어', '마스터', '스피릿'
];

const HORSE_LORES = [
  '회사 탕비실 커피머신 옆에서 태어나 카페인을 마시며 자란 명마.',
  '퇴근 종소리만 들리면 100m를 9초에 주파한다는 전설의 칼퇴마.',
  '어떤 악조건의 트랙에서도 포기하지 않는 강철의 멘탈을 지닌 에이스.',
  '상대방의 빈틈을 정확하게 파고드는 지능적인 레이스 설계의 달인.',
  '꼴찌로 달리다가도 결승선 100m 앞에서 기적의 스퍼트를 폭발시키는 승부사.'
];

export class HorseGenerator {
  /**
   * 지정된 아키타입 기반으로 총합 350pt가 수학적으로 정확히 일치하는 스탯 생성
   */
  static generateBalancedStats(archetypeId = 'allrounder') {
    const archetype = HORSE_ARCHETYPES.find(a => a.id === archetypeId) || HORSE_ARCHETYPES[5];
    const base = { ...archetype.baseWeights };

    // 약간의 랜덤 편차(±4) 추가
    const keys = ['speed', 'accel', 'stamina', 'luck', 'intellect'];
    keys.forEach(key => {
      const delta = Math.floor(Math.random() * 9) - 4; // -4 ~ +4
      base[key] = Math.max(MIN_STAT_VALUE, Math.min(MAX_STAT_VALUE, base[key] + delta));
    });

    // 총합이 350이 되도록 정규화 (Zero-Sum 조정)
    return this.normalizeStatsToBudget(base, TOTAL_STAT_BUDGET);
  }

  /**
   * 스탯 객체의 총합을 targetTotal(350)로 정확히 맞추는 밸런스 정규화 알고리즘
   */
  static normalizeStatsToBudget(stats, targetTotal = TOTAL_STAT_BUDGET) {
    const keys = ['speed', 'accel', 'stamina', 'luck', 'intellect'];
    let currentSum = keys.reduce((sum, k) => sum + stats[k], 0);

    let attempts = 0;
    while (currentSum !== targetTotal && attempts < 100) {
      attempts++;
      const diff = targetTotal - currentSum;
      const step = diff > 0 ? 1 : -1;
      
      // 랜덤한 키를 골라 1pt씩 증감 조정 (단, [MIN, MAX] 범위 준수)
      const randomKey = keys[Math.floor(Math.random() * keys.length)];
      const newVal = stats[randomKey] + step;
      
      if (newVal >= MIN_STAT_VALUE && newVal <= MAX_STAT_VALUE) {
        stats[randomKey] = newVal;
        currentSum += step;
      }
    }

    return {
      speed: stats.speed,
      accel: stats.accel,
      stamina: stats.stamina,
      luck: stats.luck,
      intellect: stats.intellect
    };
  }

  /**
   * 온디바이스 AI 또는 로컬 생성기로 유니크한 밸런스 경주마 1두 생성
   */
  static async generateAIHorse(customOptions = {}) {
    const archetype = customOptions.archetype || HORSE_ARCHETYPES[Math.floor(Math.random() * HORSE_ARCHETYPES.length)];
    const stats = this.generateBalancedStats(archetype.id);

    const prefix = HORSE_NAME_PREFIXES[Math.floor(Math.random() * HORSE_NAME_PREFIXES.length)];
    const suffix = HORSE_NAME_SUFFIXES[Math.floor(Math.random() * HORSE_NAME_SUFFIXES.length)];
    const horseName = customOptions.name || `${prefix} ${suffix}`;
    const lore = customOptions.lore || HORSE_LORES[Math.floor(Math.random() * HORSE_LORES.length)];

    const color = customOptions.color || HORSE_COLORS[Math.floor(Math.random() * HORSE_COLORS.length)];
    const stratId = customOptions.strategyId || archetype.defaultStrategy;
    const strategy = AI_STRATEGIES.find(s => s.id === stratId) || AI_STRATEGIES[0];

    return {
      id: `horse_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
      name: horseName,
      title: archetype.name,
      archetypeId: archetype.id,
      lore: lore,
      color: color,
      strategy: strategy,
      stats: stats
    };
  }

  /**
   * 초기 마구간(Stable) 기본 8마리 밸런스 명마 풀 반환
   */
  static getDefaultStable() {
    return [
      {
        id: 'stable_1',
        name: '⚡️ 번개질풍 (Lightning Bolt)',
        title: '스프린터 (단거리 폭격기)',
        archetypeId: 'sprinter',
        lore: '출발 총성과 함께 음속으로 치고 나가는 초반 가속의 제왕.',
        color: HORSE_COLORS[0], // 레드
        strategy: AI_STRATEGIES.find(s => s.id === 'speedster'),
        stats: { speed: 86, accel: 82, stamina: 54, luck: 64, intellect: 64 }
      },
      {
        id: 'stable_2',
        name: '🛡️ 강철의 가디언 (Iron Shield)',
        title: '철벽 가디언 (디펜더)',
        archetypeId: 'guardian_tank',
        lore: '단단한 기백으로 상대의 미사일과 번개 공격을 튕겨내는 수호마.',
        color: HORSE_COLORS[1], // 블루
        strategy: AI_STRATEGIES.find(s => s.id === 'guardian'),
        stats: { speed: 64, accel: 60, stamina: 86, luck: 58, intellect: 82 }
      },
      {
        id: 'stable_3',
        name: '🎯 매의 눈 (Hawk Eye)',
        title: '전술형 (지능적 암살마)',
        archetypeId: 'tactician',
        lore: '결승선 500m 전까지 조용히 기회를 엿보다가 회심의 미사일을 발사합니다.',
        color: HORSE_COLORS[2], // 그린
        strategy: AI_STRATEGIES.find(s => s.id === 'sniper'),
        stats: { speed: 62, accel: 64, stamina: 58, luck: 82, intellect: 84 }
      },
      {
        id: 'stable_4',
        name: '🍌 트릭스터 킹 (Trick King)',
        title: '트릭 마스터 (함정 전문가)',
        archetypeId: 'trick_master',
        lore: '후속 주자가 바짝 붙는 순간 정밀한 바나나 폭격을 날리는 장난꾸러기.',
        color: HORSE_COLORS[3], // 옐로우
        strategy: AI_STRATEGIES.find(s => s.id === 'trickster'),
        stats: { speed: 58, accel: 82, stamina: 56, luck: 88, intellect: 66 }
      },
      {
        id: 'stable_5',
        name: '🎲 라스트 승부사 (Last Stand)',
        title: '스테이어 (장거리 강철심장)',
        archetypeId: 'stayer',
        lore: '꼴찌로 뒤처져도 마지막 200m 구간에서 폭발적인 부스터를 터뜨리는 역전의 명수.',
        color: HORSE_COLORS[4], // 퍼플
        strategy: AI_STRATEGIES.find(s => s.id === 'wildcard'),
        stats: { speed: 76, accel: 60, stamina: 84, luck: 66, intellect: 64 }
      },
      {
        id: 'stable_6',
        name: '☕️ 에스프레소 샷 (Espresso Shot)',
        title: '올라운더 (육각형 밸런스)',
        archetypeId: 'allrounder',
        lore: '진한 카페인 도핑의 힘으로 모든 능력치가 고르게 완벽한 모범마.',
        color: HORSE_COLORS[5], // 오렌지
        strategy: AI_STRATEGIES.find(s => s.id === 'speedster'),
        stats: { speed: 70, accel: 70, stamina: 70, luck: 70, intellect: 70 }
      },
      {
        id: 'stable_7',
        name: '🏃‍♂️ 칼퇴 익스프레스 (Clock-out Express)',
        title: '스프린터 (단거리 폭격기)',
        archetypeId: 'sprinter',
        lore: '정시 퇴근을 위해서라면 그 어떤 코너도 드리프트로 찢고 달립니다.',
        color: HORSE_COLORS[6], // 핑크
        strategy: AI_STRATEGIES.find(s => s.id === 'speedster'),
        stats: { speed: 84, accel: 84, stamina: 52, luck: 66, intellect: 64 }
      },
      {
        id: 'stable_8',
        name: '💳 법카의 수호신 (Corporate Card)',
        title: '철벽 가디언 (디펜더)',
        archetypeId: 'guardian_tank',
        lore: '내 지갑은 내가 지킨다! 커피 결제로부터 팀원을 철벽 방어하는 수호신.',
        color: HORSE_COLORS[7], // 시안
        strategy: AI_STRATEGIES.find(s => s.id === 'guardian'),
        stats: { speed: 66, accel: 62, stamina: 82, luck: 60, intellect: 80 }
      }
    ];
  }
}
