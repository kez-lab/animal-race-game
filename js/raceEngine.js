/**
 * raceEngine.js - 박진감 넘치는 물리 & 확률 기반 경마 시뮬레이션 엔진
 * 클래식 스피드전 및 마리오카트 스타일 아이템전 모드 지원
 */

import { ITEM_TYPES } from './presets.js';
import { ItemManager } from './itemManager.js';

export class RaceEngine {
  constructor(options = {}) {
    this.totalDistance = options.totalDistance || 1200;
    this.gameMode = options.gameMode || 'item'; // 'speed' | 'item'
    this.horses = [];
    this.itemBoxes = [];
    this.obstacles = []; // 트랙에 설치된 바나나 등
    this.projectiles = []; // 날아가는 미사일 등
    this.isRunning = false;
    this.isPaused = false;
    this.isFinished = false;
    this.elapsedTime = 0;
    this.timeScale = 1.0;
    this.finishCount = 0;
    this.leadHorse = null;
    this.tailHorse = null;

    // 콜백 함수들
    this.onTick = options.onTick || (() => {});
    this.onEvent = options.onEvent || (() => {});
    this.onLeadChange = options.onLeadChange || (() => {});
    this.onHorseFinished = options.onHorseFinished || (() => {});
    this.onAllFinished = options.onAllFinished || (() => {});
  }

  setup(participants, distance = 1200, gameMode = 'item') {
    this.totalDistance = distance;
    this.gameMode = gameMode;
    this.elapsedTime = 0;
    this.isRunning = false;
    this.isPaused = false;
    this.isFinished = false;
    this.finishCount = 0;
    this.leadHorse = null;
    this.tailHorse = null;
    this.obstacles = [];
    this.projectiles = [];

    // 아이템 박스 생성 (20%, 40%, 60%, 80% 지점)
    if (this.gameMode === 'item') {
      this.itemBoxes = ItemManager.createItemBoxes(participants.length, this.totalDistance);
    } else {
      this.itemBoxes = [];
    }

    const avgRaceDuration = distance <= 1000 ? 15 : (distance <= 1600 ? 22 : 32);
    const standardBaseSpeed = distance / avgRaceDuration;

    this.horses = participants.map((p, index) => {
      const baseVariation = (Math.random() * 0.08 - 0.04) * standardBaseSpeed;
      const initialSpeed = standardBaseSpeed + baseVariation;

      return {
        id: p.id || index + 1,
        name: p.name,
        nickname: p.nickname || '질주마',
        color: p.color,
        strategy: p.strategy || null, // 온디바이스 AI 성향
        lane: index,
        distance: 0,
        progress: 0,
        speed: initialSpeed,
        baseSpeed: initialSpeed,
        targetSpeed: initialSpeed,
        stamina: 85 + Math.random() * 15,
        maxStamina: 100,
        state: 'running', // 'running' | 'boost' | 'slip' | 'tired' | 'finish'
        stateDuration: 0,
        stateMessage: '',
        rank: index + 1,
        finished: false,
        finishTime: null,
        spurtTriggered: false,
        eventCooldown: 2.0 + Math.random() * 2.5,
        // 아이템전 전용 프로퍼티
        heldItem: null,
        heldItemTimer: 0,
        shieldActive: false,
        shieldDuration: 0,
        spinAngle: 0,
        // 애니메이션용 보조 프로퍼티
        gallopPhase: Math.random() * Math.PI * 2
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

  update(rawDt) {
    if (!this.isRunning || this.isPaused || this.isFinished) return;

    const dt = Math.min(rawDt, 0.1) * this.timeScale;
    this.elapsedTime += dt;

    // 1. 투사체(미사일 등) 업데이트
    this.updateProjectiles(dt);

    const remainingDistanceThreshold = this.totalDistance * 0.25;

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
        // 온디바이스 AI 전략 판단 루프
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

      // 막판 스퍼트 체크 (남은 거리 250m 이내)
      const distRemaining = this.totalDistance - horse.distance;
      if (distRemaining <= remainingDistanceThreshold && !horse.spurtTriggered) {
        horse.spurtTriggered = true;
        if (horse.stamina > 30 || Math.random() < 0.45) {
          this.triggerEvent(horse, 'boost', '🔥 막판 칼퇴 스퍼트!', 3.2, 1.35);
        }
      }

      // 스태미나 소모 및 회복
      if (horse.state === 'boost') {
        horse.stamina = Math.max(0, horse.stamina - 15 * dt);
      } else if (horse.state === 'slip') {
        horse.stamina = Math.min(horse.maxStamina, horse.stamina + 6 * dt);
      } else {
        horse.stamina = Math.max(0, horse.stamina - 3 * dt);
      }

      if (horse.stamina <= 5 && horse.state === 'running') {
        horse.state = 'tired';
        horse.stateDuration = 2.0;
        horse.targetSpeed = horse.baseSpeed * 0.75;
      }

      // 속도 보간 (Lerp)
      const lerpSpeed = 3.5;
      horse.speed += (horse.targetSpeed - horse.speed) * Math.min(1, dt * lerpSpeed);

      const noise = (Math.sin(this.elapsedTime * 4 + horse.id) * 0.035) * horse.baseSpeed;
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

    // 틱 콜백
    this.onTick({
      elapsedTime: this.elapsedTime,
      horses: this.horses,
      leadHorse: this.leadHorse,
      tailHorse: this.tailHorse,
      itemBoxes: this.itemBoxes,
      obstacles: this.obstacles,
      projectiles: this.projectiles,
      isFinished: this.isFinished
    });

    // 모든 말 완주 체크
    if (this.finishCount >= this.horses.length && !this.isFinished) {
      this.isFinished = true;
      this.isRunning = false;
      this.onAllFinished(this.horses);
    }
  }

  evaluateAIStrategy(horse, dt) {
    if (!horse.heldItem || horse.finished) return;

    const strat = horse.strategy ? horse.strategy.id : 'speedster';
    const item = horse.heldItem;
    const distRemaining = this.totalDistance - horse.distance;
    const isLeader = horse.rank === 1;
    const isTail = horse.rank >= this.horses.length - 1;

    let shouldActivate = false;

    // 1. 돌진형 AI (Speedster): 아이템 획득 후 0.15초 내 즉시 발동
    if (strat === 'speedster') {
      if (horse.heldItemTimer >= 0.15) shouldActivate = true;
    }
    // 2. 저격수 AI (Sniper): 미사일/번개는 선두가 500m 이내이거나 결승선 접근 시 저격
    else if (strat === 'sniper') {
      if (item.id === 'missile' || item.id === 'lightning') {
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
        const incomingMissile = this.projectiles.find(p => p.targetHorse.id === horse.id);
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
    });
  }

  useItem(horse, item) {
    ItemManager.executeItem({
      horse,
      item,
      horses: this.horses,
      totalDistance: this.totalDistance,
      obstacles: this.obstacles,
      projectiles: this.projectiles,
      triggerEvent: (h, state, msg, dur, spd) => this.triggerEvent(h, state, msg, dur, spd),
      onEvent: (type, h, info) => this.onEvent(type, h, info)
    });
  }

  checkObstacleCollisions(horse) {
    ItemManager.checkObstacleCollisions(
      [horse],
      this.obstacles,
      (h, state, msg, dur, spd) => this.triggerEvent(h, state, msg, dur, spd),
      (type, h, info) => this.onEvent(type, h, info)
    );
  }

  updateProjectiles(dt) {
    ItemManager.updateProjectiles(
      this.projectiles,
      dt,
      (h, state, msg, dur, spd) => this.triggerEvent(h, state, msg, dur, spd),
      (type, h, info) => this.onEvent(type, h, info)
    );
  }

  checkRandomEvent(horse) {
    horse.eventCooldown = 2.5 + Math.random() * 2.5;
    const rand = Math.random();
    const isTail = horse.rank >= this.horses.length - 1;
    const isLeader = horse.rank <= 2;

    if (isTail && rand < 0.38) {
      this.triggerEvent(horse, 'boost', '⚡️ 카페인 도핑! 역전 시동!', 2.2, 1.4);
    } else if (isLeader && rand < 0.28) {
      this.triggerEvent(horse, 'slip', '💦 돌발 업무 호출! 페이스 다운!', 1.8, 0.72);
    } else if (rand < 0.22) {
      this.triggerEvent(horse, 'boost', '🚀 가속 질주!', 2.0, 1.3);
    } else if (rand < 0.34) {
      this.triggerEvent(horse, 'slip', '💨 주춤거림!', 1.5, 0.78);
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
      horse.rank = idx + 1;
    });

    this.leadHorse = sorted[0];
    this.tailHorse = sorted[sorted.length - 1];

    if (oldLeader && this.leadHorse && oldLeader.id !== this.leadHorse.id && !oldLeader.finished) {
      this.onLeadChange(this.leadHorse, oldLeader);
    }
  }

  fastForwardToEnd() {
    if (!this.isRunning || this.isFinished) return;
    while (!this.isFinished) {
      this.update(0.1);
    }
  }
}
