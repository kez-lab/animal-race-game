/**
 * raceEngine.js - 박진감 넘치는 물리 & 확률 기반 경마 시뮬레이션 엔진
 * 클래식 스피드전 및 마리오카트 스타일 아이템전 모드 지원
 *
 * [결정성 보장 (Deterministic Simulation)]
 * - 모든 난수는 시드 기반 PRNG(this.rng)에서만 뽑습니다. (Math.random 사용 금지)
 * - 시뮬레이션은 렌더 프레임과 분리된 고정 타임스텝(FIXED_STEP)으로만 진행됩니다.
 *   → 같은 시드 + 같은 참가자 + 같은 설정이면 프레임레이트/배속/스킵 여부와 무관하게 결과가 100% 동일합니다.
 *
 * [능력치 반영 모드 (statMode)]
 * - 'fair'  (기본): 모든 말의 물리 성능이 동일. 능력치는 말의 '컨셉'일 뿐이며 결과는 운 + AI 성향으로 결정.
 * - 'stats'       : 5대 능력치가 실제 성능에 반영 (속도/가속/지구력/행운/지능). 말 선택이 곧 전략.
 */

import { ItemManager } from './itemManager.js';
import { WEATHER_TYPES } from './presets.js';
import { createRng, randomSeed } from './rng.js';

export const FIXED_STEP = 1 / 60;

export const STAT_MODES = {
  FAIR: 'fair',
  STATS: 'stats'
};

export const NEUTRAL_STATS = { speed: 70, accel: 70, stamina: 70, luck: 70, intellect: 70 };

/**
 * 능력치전 물리 계수 (중심값 70 기준 편차에 곱해짐)
 * 몬테카를로 시뮬레이션으로 튜닝: 스탯 차이가 '체감'은 되되 특정 말이 꼴찌를 독점하지 않도록 조정
 */
export const STAT_TUNING = {
  baseSpeedMultiplier: 1.06, // 스탯 70 기준 속도 배율 (기존 경기 시간 유지)
  speedPerPoint: 0.0012,     // 스피드 1pt당 속도 배율 변화 (50→-2.4%, 90→+2.4%)
  accelPerPoint: 0.006,      // 가속 1pt당 lerp 배율 변화
  staminaPoolPerPoint: 0.5,  // 지구력 1pt당 최대 스태미나 변화
  staminaDrainPerPoint: 0.006, // 지구력 1pt당 소모율 배율 변화
  luckBonusPerPoint: 1 / 160,  // 행운 50→0%, 90→25% 확률로 1등급 아이템
  intellectBonusPerPoint: 1 / 160 // 지능 50→0, 90→0.25
};

export class RaceEngine {
  constructor(options = {}) {
    this.totalDistance = options.totalDistance || 1200;
    this.gameMode = options.gameMode || 'item'; // 'speed' | 'item'
    this.statMode = options.statMode || STAT_MODES.FAIR;
    this.weather = options.weather || 'sunny';
    this.weatherConfig = WEATHER_TYPES.sunny;
    this.seed = null;
    this.rng = Math.random;
    this.horses = [];
    this.itemBoxes = [];
    this.obstacles = []; // 트랙에 설치된 바나나 등
    this.projectiles = []; // 날아가는 미사일 등
    this.isRunning = false;
    this.isPaused = false;
    this.isFinished = false;
    this.elapsedTime = 0;
    this.accumulator = 0;
    this.timeScale = 1.0;
    this.finishCount = 0;
    this.leadHorse = null;
    this.tailHorse = null;
    this.photoFinishInfo = null;

    // 드라마 이벤트 상태
    this.lastSpurtAnnounced = false;
    this.tailSwapCooldown = 0;
    this.tailDangerCooldown = 0;

    // 콜백 함수들
    this.onTick = options.onTick || (() => {});
    this.onEvent = options.onEvent || (() => {});
    this.onLeadChange = options.onLeadChange || (() => {});
    this.onHorseFinished = options.onHorseFinished || (() => {});
    this.onAllFinished = options.onAllFinished || (() => {});
  }

  /**
   * @param {Array} participants
   * @param {number} distance
   * @param {'item'|'speed'} gameMode
   * @param {Object} [options]
   * @param {number} [options.seed] - 경기 시드 (미지정 시 무작위 생성)
   * @param {'fair'|'stats'} [options.statMode] - 능력치 반영 모드
   * @param {'sunny'|'rain'|'wind'|'night'|'random'} [options.weather] - 트랙 날씨
   */
  setup(participants, distance = 1200, gameMode = 'item', options = {}) {
    this.totalDistance = distance;
    this.gameMode = gameMode;
    if (options.statMode) this.statMode = options.statMode;
    this.seed = (options.seed !== undefined && options.seed !== null) ? (options.seed >>> 0) : randomSeed();
    this.rng = createRng(this.seed);

    // 날씨 결정 (random인 경우 시드 PRNG로 결정적 선택)
    const weatherKeys = ['sunny', 'rain', 'wind', 'night'];
    const reqWeather = options.weather || this.weather || 'sunny';
    if (reqWeather === 'random') {
      this.weather = weatherKeys[Math.floor(this.rng() * weatherKeys.length)];
    } else {
      this.weather = WEATHER_TYPES[reqWeather] ? reqWeather : 'sunny';
    }
    this.weatherConfig = WEATHER_TYPES[this.weather] || WEATHER_TYPES.sunny;

    this.elapsedTime = 0;
    this.accumulator = 0;
    this.isRunning = false;
    this.isPaused = false;
    this.isFinished = false;
    this.finishCount = 0;
    this.leadHorse = null;
    this.tailHorse = null;
    this.photoFinishInfo = null;
    this.obstacles = [];
    this.projectiles = [];
    this.lastSpurtAnnounced = false;
    this.tailSwapCooldown = 0;
    this.tailDangerCooldown = 0;
    this.prevTailId = undefined;

    // 아이템 박스 생성 (20%, 40%, 60%, 80% 지점)
    if (this.gameMode === 'item') {
      this.itemBoxes = ItemManager.createItemBoxes(participants.length, this.totalDistance);
    } else {
      this.itemBoxes = [];
    }

    const avgRaceDuration = distance <= 1000 ? 15 : (distance <= 1600 ? 22 : 32);
    const standardBaseSpeed = distance / avgRaceDuration;
    const useStats = this.statMode === STAT_MODES.STATS;
    const T = STAT_TUNING;

    this.horses = participants.map((p, index) => {
      // 표시용 능력치(stats)와 물리 계산용 능력치(physics)를 분리
      const stats = p.stats || { ...NEUTRAL_STATS };
      const physics = useStats ? stats : NEUTRAL_STATS;

      // 1. 스피드
      const speedMultiplier = T.baseSpeedMultiplier + T.speedPerPoint * (physics.speed - 70);
      const baseVariation = (this.rng() * 0.04 - 0.02) * standardBaseSpeed;
      const initialSpeed = (standardBaseSpeed * speedMultiplier) + baseVariation;

      // 2. 지구력 (스탯 70 → 95)
      const initialStamina = 95 + T.staminaPoolPerPoint * (physics.stamina - 70);

      return {
        id: p.id || index + 1,
        name: p.name,
        horseName: p.horseName || p.name,
        nickname: p.nickname || '질주마',
        drinkId: p.drinkId || 'random',
        color: p.color,
        strategy: p.strategy || null, // AI 기수 성향
        stats: stats, // 표시용 5대 능력치
        physics: physics, // 실제 물리 계산용 능력치 (공정 모드에서는 전원 70)
        luckBonus: useStats ? Math.max(0, (physics.luck - 50) * T.luckBonusPerPoint) : 0,
        intellectBonus: useStats ? Math.max(0, (physics.intellect - 50) * T.intellectBonusPerPoint) : 0,
        wildcardBoost: useStats ? 1.2 : 1.0, // 승부사 꼴찌 부스터 보너스 (공정 모드에서는 비활성)
        lane: index,
        distance: 0,
        progress: 0,
        speed: initialSpeed,
        baseSpeed: initialSpeed,
        targetSpeed: initialSpeed,
        stamina: initialStamina,
        maxStamina: initialStamina,
        state: 'running', // 'running' | 'boost' | 'slip' | 'tired' | 'finish'
        stateDuration: 0,
        stateMessage: '',
        rank: index + 1,
        worstRank: index + 1,
        finished: false,
        finishTime: null,
        spurtTriggered: false,
        eventCooldown: 2.0 + this.rng() * 2.5,
        // 아이템전 전용 프로퍼티
        heldItem: null,
        heldItemTimer: 0,
        shieldActive: false,
        shieldDuration: 0,
        spinAngle: 0,
        // 텔레메트리 (경기 후 MVP 분석용)
        itemsUsed: 0,
        hitsTaken: 0,
        shieldsBlocked: 0,
        overtakes: 0,
        // 애니메이션용 보조 프로퍼티 (렌더 전용, 결과에 영향 없음)
        gallopPhase: index * 0.7
      };
    });

    this.updateRankings();
  }

  start() {
    this.isRunning = true;
    this.isPaused = false;
    this.isFinished = false;
  }

  pause() {
    this.isPaused = true;
  }

  resume() {
    this.isPaused = false;
  }

  setTimeScale(scale) {
    this.timeScale = Math.max(0.5, Math.min(3.0, scale));
  }

  /**
   * 렌더 루프에서 호출. 실제 경과 시간을 누적한 뒤 고정 타임스텝으로만 시뮬레이션을 진행합니다.
   */
  update(rawDt) {
    if (!this.isRunning || this.isPaused || this.isFinished) return;

    this.accumulator += Math.min(Math.max(rawDt, 0), 0.1) * this.timeScale;
    let stepped = false;
    while (this.accumulator >= FIXED_STEP && !this.isFinished) {
      this.accumulator -= FIXED_STEP;
      this.step(FIXED_STEP);
      stepped = true;
    }

    if (stepped) this.emitTick();
  }

  emitTick() {
    this.onTick({
      elapsedTime: this.elapsedTime,
      horses: this.horses,
      leadHorse: this.leadHorse,
      tailHorse: this.tailHorse,
      itemBoxes: this.itemBoxes,
      obstacles: this.obstacles,
      projectiles: this.projectiles,
      weather: this.weather,
      isFinished: this.isFinished
    });
  }

  /**
   * 고정 타임스텝 1회 시뮬레이션
   */
  step(dt) {
    this.elapsedTime += dt;

    // 1. 투사체(미사일 등) 업데이트
    this.updateProjectiles(dt);

    const remainingDistanceThreshold = this.totalDistance * 0.25;
    const wCfg = this.weatherConfig || WEATHER_TYPES.sunny;

    this.horses.forEach(horse => {
      if (horse.finished) return;

      // 방어막 지속시간
      if (horse.shieldActive) {
        horse.shieldDuration -= dt;
        if (horse.shieldDuration <= 0) {
          horse.shieldActive = false;
        }
      }

      // 상태 지속시간 차감
      if (horse.stateDuration > 0) {
        horse.stateDuration -= dt;
        if (horse.state === 'slip') {
          horse.spinAngle += dt * 14;
        }
        if (horse.stateDuration <= 0) {
          horse.state = 'running';
          horse.stateMessage = '';
          horse.spinAngle = 0;
          horse.targetSpeed = horse.baseSpeed;
        }
      }

      // 아이템전 모드: 아이템 박스 충돌 체크
      if (this.gameMode === 'item') {
        this.checkItemBoxCollisions(horse);
        // AI 기수 전략 판단 루프
        if (horse.heldItem) {
          horse.heldItemTimer += dt;
          this.evaluateAIStrategy(horse, dt);
        }
      }

      // 아이템전 모드: 트랙 바나나 밟음 체크
      if (this.gameMode === 'item' && horse.state === 'running') {
        this.checkObstacleCollisions(horse);
      }

      // 일반 스피드전 랜덤 이벤트 체크
      if (this.gameMode === 'speed') {
        horse.eventCooldown -= dt;
        if (horse.eventCooldown <= 0 && horse.state === 'running') {
          this.checkRandomEvent(horse);
        }
      }

      // 막판 스퍼트 체크 (남은 거리 25% 이내)
      const distRemaining = this.totalDistance - horse.distance;
      if (distRemaining <= remainingDistanceThreshold && !horse.spurtTriggered) {
        horse.spurtTriggered = true;
        const spurtChance = 0.45 + (wCfg.spurtChanceBonus || 0);
        if (horse.stamina > 30 || this.rng() < spurtChance) {
          const spurtMult = this.weather === 'night' ? 1.42 : 1.35;
          this.triggerEvent(horse, 'boost', '🔥 막판 칼퇴 스퍼트!', 3.2, spurtMult);
        }
      }

      // 스태미나 소모 및 회복 (지구력 높을수록 덜 지침 + 날씨 보정)
      const baseDrain = 3.0 * (0.88 - STAT_TUNING.staminaDrainPerPoint * (horse.physics.stamina - 70));
      const staminaDrainRate = baseDrain * (wCfg.staminaDrainMult || 1.0);
      if (horse.state === 'boost') {
        horse.stamina = Math.max(0, horse.stamina - (12 + staminaDrainRate) * dt);
      } else if (horse.state === 'slip') {
        horse.stamina = Math.min(horse.maxStamina, horse.stamina + 8 * dt);
      } else {
        horse.stamina = Math.max(0, horse.stamina - staminaDrainRate * dt);
      }

      if (horse.stamina <= 5 && horse.state === 'running') {
        horse.state = 'tired';
        horse.stateDuration = 2.0;
        horse.targetSpeed = horse.baseSpeed * 0.75;
      }

      // 속도 보간 (Lerp) - 가속력 반영 (스탯 70 → 1.12배)
      const accelMultiplier = 1.12 + STAT_TUNING.accelPerPoint * (horse.physics.accel - 70);
      const lerpSpeed = 3.5 * accelMultiplier;
      horse.speed += (horse.targetSpeed - horse.speed) * Math.min(1, dt * lerpSpeed);

      const waveAmp = this.weather === 'wind' ? 0.045 : 0.03;
      const noise = (Math.sin(this.elapsedTime * 4 + horse.lane + 1) * waveAmp) * horse.baseSpeed;
      const actualSpeed = Math.max(5, horse.speed + noise);

      // 거리 이동
      horse.distance += actualSpeed * dt;
      horse.progress = Math.min(1.0, horse.distance / this.totalDistance);

      // 결승선 통과
      if (horse.distance >= this.totalDistance && !horse.finished) {
        horse.distance = this.totalDistance;
        horse.progress = 1.0;
        horse.finished = true;
        horse.finishTime = this.elapsedTime;
        horse.state = 'finish';
        horse.shieldActive = false;
        this.finishCount++;

        this.onHorseFinished(horse, this.finishCount);
      }
    });

    // 순위 갱신
    this.updateRankings();

    // 드라마 이벤트 (중계/카메라용 - 결과에 영향 없음)
    this.checkDramaEvents(dt);

    // 모든 말 완주 체크
    if (this.finishCount >= this.horses.length && !this.isFinished) {
      this.isFinished = true;
      this.isRunning = false;
      this.computePhotoFinish();
      this.onAllFinished(this.horses);
    }
  }

  /**
   * 결승선 통과 기록을 바탕으로 초접전(Photo Finish) 여부 계산
   */
  computePhotoFinish() {
    if (this.horses.length < 2) return;
    const sorted = [...this.horses].sort((a, b) => (a.finishTime || 999) - (b.finishTime || 999));
    const first = sorted[0];
    const second = sorted[1];
    const last = sorted[sorted.length - 1];
    const secondLast = sorted[sorted.length - 2];

    const leadGap = Math.abs((second.finishTime || 0) - (first.finishTime || 0));
    const tailGap = Math.abs((last.finishTime || 0) - (secondLast.finishTime || 0));

    if (tailGap <= 0.25) {
      this.photoFinishInfo = {
        type: 'tail',
        gapSeconds: tailGap,
        survivor: secondLast,
        victim: last
      };
      this.onEvent('photoFinish', last, this.photoFinishInfo);
    } else if (leadGap <= 0.20) {
      this.photoFinishInfo = {
        type: 'lead',
        gapSeconds: leadGap,
        winner: first,
        runnerUp: second
      };
      this.onEvent('photoFinish', first, this.photoFinishInfo);
    }
  }

  /**
   * 꼴찌 경쟁 / 막판 스퍼트 구간 진입 등 중계용 드라마 이벤트 발행
   * - 이 함수는 rng를 사용하지 않으므로 경기 결과(결정성)에 영향을 주지 않습니다.
   */
  checkDramaEvents(dt) {
    const lead = this.leadHorse;
    const tail = this.tailHorse;
    if (!lead || !tail || this.horses.length < 2) return;

    this.tailSwapCooldown = Math.max(0, this.tailSwapCooldown - dt);
    this.tailDangerCooldown = Math.max(0, this.tailDangerCooldown - dt);

    if (!this.lastSpurtAnnounced && lead.progress >= 0.75) {
      this.lastSpurtAnnounced = true;
      this.onEvent('lastSpurtPhase', lead, {});
    }

    if (tail.finished) return;

    const rival = this.horses.find(h => h.rank === this.horses.length - 1);
    if (!rival) return;

    // 꼴찌 교체 (꼴찌 탈출!)
    if (this.prevTailId !== undefined && this.prevTailId !== tail.id && lead.progress > 0.3 && this.tailSwapCooldown <= 0) {
      const escaped = this.horses.find(h => h.id === this.prevTailId);
      this.tailSwapCooldown = 1.5;
      this.onEvent('tailSwap', tail, { escaped });
    }
    this.prevTailId = tail.id;

    // 꼴찌 경쟁 접전 경보
    const gap = rival.distance - tail.distance;
    if (lead.progress > 0.6 && !rival.finished && gap < this.totalDistance * 0.03 && this.tailDangerCooldown <= 0) {
      this.tailDangerCooldown = 5.0;
      this.onEvent('tailDanger', tail, { rival, gap });
    }
  }

  evaluateAIStrategy(horse, dt) {
    if (!horse.heldItem || horse.finished) return;

    const strat = horse.strategy ? horse.strategy.id : 'speedster';
    const item = horse.heldItem;
    const distRemaining = this.totalDistance - horse.distance;
    const isLeader = horse.rank === 1;
    const isTail = horse.rank >= this.horses.length - 1;
    const isOffensive = item.id === 'missile' || item.id === 'lightning' || item.id === 'approval';
    const incomingMissile = this.projectiles.find(p => p.targetHorse.id === horse.id);

    let shouldActivate = false;

    // [지능 효과 1 - 능력치전 전용] 선두일 때 공격 아이템을 낭비하지 않고 최대 4초까지 보류
    if (horse.intellectBonus > 0 && isOffensive && isLeader && horse.heldItemTimer < horse.intellectBonus * 16) {
      return;
    }

    // [지능 효과 2 - 능력치전 전용] 날아오는 미사일 감지 시 지능에 비례한 확률로 쉴드 즉시 전개 (최대 75%)
    if (horse.intellectBonus > 0 && item.id === 'shield' && incomingMissile) {
      if (incomingMissile.reactionRoll === undefined) incomingMissile.reactionRoll = this.rng();
      if (incomingMissile.reactionRoll < horse.intellectBonus * 3) shouldActivate = true;
    }

    // 에스프레소는 스태미나가 65 이하로 떨어지면 어떤 성향이든 빠르게 섭취
    if (item.id === 'espresso' && horse.stamina <= 65 && horse.heldItemTimer >= 0.1) {
      shouldActivate = true;
    }

    // 1. 돌진형 AI (Speedster): 아이템 획득 후 0.15초 내 즉시 발동
    if (strat === 'speedster') {
      if (horse.heldItemTimer >= 0.15) shouldActivate = true;
    }
    // 2. 저격수 AI (Sniper): 미사일/번개/결재서류는 선두가 600m 이내이거나 결승선 접근 시 저격
    else if (strat === 'sniper') {
      if (isOffensive) {
        if (!isLeader && (distRemaining < 600 || horse.heldItemTimer > 3.0)) {
          shouldActivate = true;
        }
      } else {
        if (horse.heldItemTimer >= 0.3) shouldActivate = true;
      }
    }
    // 3. 가디언 AI (Guardian): 쉴드는 날아오는 미사일이나 위기 감지 시 0.1초 반응
    else if (strat === 'guardian') {
      if (item.id === 'shield') {
        if (incomingMissile || isLeader || horse.heldItemTimer > 4.0) {
          shouldActivate = true;
        }
      } else {
        if (horse.heldItemTimer >= 0.25) shouldActivate = true;
      }
    }
    // 4. 트릭스터 AI (Trickster): 바나나는 뒤에 쫓아오는 말이 가까울 때 투척
    else if (strat === 'trickster') {
      if (item.id === 'banana') {
        const trailingHorse = this.horses.find(h => h.id !== horse.id && h.distance < horse.distance && (horse.distance - h.distance) < 40);
        if (trailingHorse || isLeader || horse.heldItemTimer > 2.5) {
          shouldActivate = true;
        }
      } else {
        if (horse.heldItemTimer >= 0.2) shouldActivate = true;
      }
    }
    // 5. 승부사 AI (Wildcard): 후위권일 때 폭발적 가속
    else if (strat === 'wildcard') {
      if (isTail || horse.heldItemTimer >= 0.3) {
        shouldActivate = true;
      }
    } else {
      if (horse.heldItemTimer >= 0.3) shouldActivate = true;
    }

    // 타임아웃 최대 5초 강제 발동
    if (horse.heldItemTimer >= 5.0) shouldActivate = true;

    if (shouldActivate) {
      this.useItem(horse, horse.heldItem);
      horse.heldItem = null;
      horse.heldItemTimer = 0;
    }
  }

  checkItemBoxCollisions(horse) {
    ItemManager.checkItemBoxCollisions([horse], this.itemBoxes, (h, item) => {
      this.onEvent('itemPickup', h, { item });
    }, { rng: this.rng, totalHorses: this.horses.length });
  }

  useItem(horse, item) {
    ItemManager.executeItem({
      horse,
      item,
      horses: this.horses,
      totalDistance: this.totalDistance,
      obstacles: this.obstacles,
      projectiles: this.projectiles,
      rng: this.rng,
      weatherMod: this.weatherConfig,
      triggerEvent: (h, state, msg, dur, spd) => this.triggerEvent(h, state, msg, dur, spd),
      onEvent: (type, h, info) => this.onEvent(type, h, info)
    });
  }

  checkObstacleCollisions(horse) {
    ItemManager.checkObstacleCollisions(
      [horse],
      this.obstacles,
      (h, state, msg, dur, spd) => this.triggerEvent(h, state, msg, dur, spd),
      (type, h, info) => this.onEvent(type, h, info),
      this.weatherConfig
    );
  }

  updateProjectiles(dt) {
    ItemManager.updateProjectiles(
      this.projectiles,
      dt,
      (h, state, msg, dur, spd) => this.triggerEvent(h, state, msg, dur, spd),
      (type, h, info) => this.onEvent(type, h, info),
      this.weatherConfig
    );
  }

  checkRandomEvent(horse) {
    horse.eventCooldown = 2.5 + this.rng() * 2.5;
    const rand = this.rng();
    const isTail = horse.rank >= this.horses.length - 1;
    const isLeader = horse.rank <= 2;
    const slipMult = this.weatherConfig?.slipDurationMult || 1.0;

    if (isTail && rand < 0.38) {
      this.triggerEvent(horse, 'boost', '⚡️ 카페인 도핑! 역전 시동!', 2.2, 1.4);
    } else if (isLeader && rand < 0.28) {
      this.triggerEvent(horse, 'slip', '💦 돌발 업무 호출! 페이스 다운!', 1.8 * slipMult, 0.72);
    } else if (rand < 0.22) {
      this.triggerEvent(horse, 'boost', '🚀 가속 질주!', 2.0, 1.3);
    } else if (rand < 0.34) {
      this.triggerEvent(horse, 'slip', '💨 주춤거림!', 1.5 * slipMult, 0.78);
    }
  }

  triggerEvent(horse, eventType, message, duration, speedMultiplier) {
    horse.state = eventType;
    horse.stateDuration = duration;
    horse.stateMessage = message;
    horse.targetSpeed = horse.baseSpeed * speedMultiplier;

    this.onEvent(eventType, horse, {
      message,
      duration,
      speedMultiplier
    });
  }

  updateRankings() {
    const oldLeader = this.leadHorse;

    const sorted = [...this.horses].sort((a, b) => {
      if (a.finished && b.finished) {
        return a.finishTime - b.finishTime;
      }
      if (a.finished) return -1;
      if (b.finished) return 1;
      return b.distance - a.distance;
    });

    sorted.forEach((horse, idx) => {
      const newRank = idx + 1;
      if (horse.rank && newRank < horse.rank) {
        horse.overtakes = (horse.overtakes || 0) + (horse.rank - newRank);
      }
      if (!horse.worstRank || newRank > horse.worstRank) {
        horse.worstRank = newRank;
      }
      horse.rank = newRank;
    });

    this.leadHorse = sorted[0];
    this.tailHorse = sorted[sorted.length - 1];

    if (oldLeader && this.leadHorse && oldLeader.id !== this.leadHorse.id && !oldLeader.finished) {
      this.onLeadChange(this.leadHorse, oldLeader);
    }
  }

  /**
   * 결과 즉시 보기: 남은 경기를 고정 타임스텝으로 끝까지 계산 (실시간 시청과 결과 동일)
   */
  fastForwardToEnd() {
    if (!this.isRunning || this.isFinished) return;
    let guard = 0;
    const maxSteps = Math.ceil(600 / FIXED_STEP); // 안전장치: 시뮬레이션 시간 10분
    while (!this.isFinished && guard++ < maxSteps) {
      this.step(FIXED_STEP);
    }
    this.accumulator = 0;
    this.emitTick();
  }
}
