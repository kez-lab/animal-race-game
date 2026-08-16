/**
 * raceEngine.js - 박진감 넘치는 물리 & 확률 기반 경마 시뮬레이션 엔진
 * 클래식 스피드전 및 마리오카트 스타일 아이템전 모드 지원
 */

import { ITEM_TYPES } from './presets.js';

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
    this.itemBoxes = [];
    if (this.gameMode === 'item') {
      const checkpoints = [0.2, 0.4, 0.6, 0.8];
      checkpoints.forEach((ratio, cIdx) => {
        const dist = this.totalDistance * ratio;
        participants.forEach((_, laneIdx) => {
          this.itemBoxes.push({
            id: `box_${cIdx}_${laneIdx}`,
            lane: laneIdx,
            distance: dist,
            collected: false
          });
        });
      });
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

  checkItemBoxCollisions(horse) {
    this.itemBoxes.forEach(box => {
      if (!box.collected && box.lane === horse.lane) {
        if (Math.abs(horse.distance - box.distance) < 25) {
          box.collected = true;
          this.pickupItem(horse);
        }
      }
    });
  }

  pickupItem(horse) {
    let possibleItems = [];
    if (horse.rank === 1) {
      possibleItems = [ITEM_TYPES.BANANA, ITEM_TYPES.SHIELD, ITEM_TYPES.BOOSTER];
    } else if (horse.rank >= this.horses.length - 1) {
      possibleItems = [ITEM_TYPES.BOOSTER, ITEM_TYPES.LIGHTNING, ITEM_TYPES.MAGNET, ITEM_TYPES.MISSILE];
    } else {
      possibleItems = Object.values(ITEM_TYPES);
    }

    const picked = possibleItems[Math.floor(Math.random() * possibleItems.length)];
    horse.heldItem = picked;

    this.onEvent('itemPickup', horse, { item: picked });

    // 0.35초 후 자동 아이템 사용
    setTimeout(() => {
      if (this.isRunning && !horse.finished && horse.heldItem) {
        this.useItem(horse, horse.heldItem);
        horse.heldItem = null;
      }
    }, 350);
  }

  useItem(horse, item) {
    if (item.id === 'booster') {
      this.triggerEvent(horse, 'boost', `🚀 [${horse.name}] 부스터 가속!`, item.duration, item.speedMultiplier);
      this.onEvent('itemUseBooster', horse, { item });
    } else if (item.id === 'banana') {
      this.obstacles.push({
        id: `banana_${Date.now()}_${Math.random()}`,
        type: 'banana',
        lane: horse.lane,
        distance: Math.max(0, horse.distance - 20)
      });
      this.onEvent('itemUseBanana', horse, { item });
    } else if (item.id === 'shield') {
      horse.shieldActive = true;
      horse.shieldDuration = item.duration;
      this.onEvent('itemUseShield', horse, { item });
    } else if (item.id === 'lightning') {
      this.onEvent('itemUseLightning', horse, { item });
      this.horses.forEach(target => {
        if (target.id !== horse.id && target.rank < horse.rank && !target.finished) {
          if (target.shieldActive) {
            target.shieldActive = false;
            this.onEvent('shieldBlock', target, { attacker: horse });
          } else {
            this.triggerEvent(target, 'slip', `⚡️ [${target.name}] 번개 감전!`, item.stunDuration, 0.45);
          }
        }
      });
    } else if (item.id === 'missile') {
      const target = this.leadHorse && this.leadHorse.id !== horse.id ? this.leadHorse : null;
      if (target) {
        this.projectiles.push({
          id: `missile_${Date.now()}`,
          fromHorse: horse,
          targetHorse: target,
          x: horse.distance,
          targetX: target.distance,
          lane: target.lane,
          speed: horse.baseSpeed * 2.5
        });
        this.onEvent('itemUseMissile', horse, { item, target });
      } else {
        this.triggerEvent(horse, 'boost', `🚀 [${horse.name}] 미사일 로켓 부스터!`, 2.0, 1.4);
      }
    } else if (item.id === 'magnet') {
      this.triggerEvent(horse, 'boost', `🧲 [${horse.name}] 자석 견인 질주!`, item.duration, item.speedMultiplier);
      this.onEvent('itemUseMagnet', horse, { item });
    }
  }

  checkObstacleCollisions(horse) {
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obs = this.obstacles[i];
      if (obs.lane === horse.lane && Math.abs(horse.distance - obs.distance) < 18) {
        this.obstacles.splice(i, 1);
        if (horse.shieldActive) {
          horse.shieldActive = false;
          this.onEvent('shieldBlock', horse, { obstacle: obs });
        } else {
          this.triggerEvent(horse, 'slip', `🍌 [${horse.name}] 바나나 미끄러짐!`, 1.4, 0.4);
          this.onEvent('obstacleHit', horse, { obstacle: obs });
        }
      }
    }
  }

  updateProjectiles(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      proj.x += proj.speed * dt;
      if (proj.x >= proj.targetHorse.distance - 10) {
        this.projectiles.splice(i, 1);
        const target = proj.targetHorse;
        if (target.shieldActive) {
          target.shieldActive = false;
          this.onEvent('shieldBlock', target, { missile: proj });
        } else {
          this.triggerEvent(target, 'slip', `🎯 [${target.name}] 미사일 폭격 피격!`, 1.8, 0.35);
          this.onEvent('missileHit', target, { missile: proj });
        }
      }
    }
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
