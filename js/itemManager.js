/**
 * itemManager.js - 아이템 박스 생성, 획득, 사용, 투사체 및 장애물 충돌 판정 순수 로직 모듈 (테스터블 모듈)
 */

import { ITEM_TYPES } from './presets.js';

// 결정성을 위해 Date.now() 대신 단조 증가 카운터로 ID 생성
let entityCounter = 0;
const nextId = (prefix) => `${prefix}_${++entityCounter}`;

export class ItemManager {
  /**
   * 레이스 체크포인트(20%, 40%, 60%, 80%)에 각 레인별 아이템 박스 목록 생성
   */
  static createItemBoxes(horsesCount, totalDistance) {
    const checkpoints = [0.2, 0.4, 0.6, 0.8];
    const boxes = [];

    checkpoints.forEach((ratio, cIdx) => {
      const dist = totalDistance * ratio;
      for (let laneIdx = 0; laneIdx < horsesCount; laneIdx++) {
        boxes.push({
          id: `box_${cIdx}_${laneIdx}`,
          lane: laneIdx,
          distance: dist,
          collected: false
        });
      }
    });

    return boxes;
  }

  /**
   * 말이 아이템 박스에 닿았는지 체크하고 획득 처리
   * @param {Array} horses - 충돌 검사 대상 말 목록
   * @param {Array} itemBoxes
   * @param {Function} onPickup
   * @param {Object} [options]
   * @param {() => number} [options.rng] - 시드 난수 생성기 (기본 Math.random)
   * @param {number} [options.totalHorses] - 전체 출전 두수 (검사 대상이 일부일 때 필수)
   */
  static checkItemBoxCollisions(horses, itemBoxes, onPickup, options = {}) {
    const rng = options.rng || Math.random;
    const totalHorses = options.totalHorses || horses.length;

    horses.forEach(horse => {
      if (horse.finished) return;

      itemBoxes.forEach(box => {
        if (!box.collected && box.lane === horse.lane) {
          if (Math.abs(horse.distance - box.distance) < 25) {
            box.collected = true;
            this.pickupRandomItem(horse, totalHorses, onPickup, rng);
          }
        }
      });
    });
  }

  /**
   * 순위에 따른 확률 기반 아이템 획득 (8종 아이템 지원)
   * - horse.luckBonus(0~0.25, 능력치전 전용): 해당 확률로 '1등급 아이템' 풀에서 뽑음
   */
  static pickupRandomItem(horse, totalHorses, onPickup, rng = Math.random) {
    let possibleItems = [];
    let premiumItems = [];
    if (horse.rank === 1) {
      possibleItems = [ITEM_TYPES.BANANA, ITEM_TYPES.SHIELD, ITEM_TYPES.BOOSTER, ITEM_TYPES.ESPRESSO];
      premiumItems = [ITEM_TYPES.SHIELD, ITEM_TYPES.BOOSTER, ITEM_TYPES.ESPRESSO];
    } else if (horse.rank >= totalHorses - 1) {
      possibleItems = [ITEM_TYPES.BOOSTER, ITEM_TYPES.LIGHTNING, ITEM_TYPES.MAGNET, ITEM_TYPES.MISSILE, ITEM_TYPES.ESPRESSO];
      premiumItems = [ITEM_TYPES.BOOSTER, ITEM_TYPES.LIGHTNING, ITEM_TYPES.MAGNET, ITEM_TYPES.MISSILE];
    } else {
      possibleItems = Object.values(ITEM_TYPES);
      premiumItems = [ITEM_TYPES.BOOSTER, ITEM_TYPES.LIGHTNING, ITEM_TYPES.MAGNET, ITEM_TYPES.MISSILE, ITEM_TYPES.ESPRESSO];
    }

    const luckBonus = horse.luckBonus || 0;
    const pool = (luckBonus > 0 && rng() < luckBonus) ? premiumItems : possibleItems;
    const picked = pool[Math.floor(rng() * pool.length)];
    horse.heldItem = picked;
    horse.heldItemTimer = 0;

    if (typeof onPickup === 'function') {
      onPickup(horse, picked);
    }
    return picked;
  }

  /**
   * 아이템 사용 시 효과 발동
   */
  static executeItem({
    horse,
    item,
    horses,
    totalDistance,
    obstacles,
    projectiles,
    triggerEvent,
    onEvent,
    rng = Math.random,
    weatherMod = null
  }) {
    if (!item) return;

    // 아이템 사용 즉시 보유 슬롯에서 소모 & 제거
    horse.heldItem = null;
    horse.heldItemTimer = 0;
    horse.itemsUsed = (horse.itemsUsed || 0) + 1;

    const slipMult = weatherMod?.slipDurationMult || 1.0;
    const projSpeedMult = weatherMod?.projectileSpeedMult || 1.0;

    switch (item.id) {
      case 'booster': {
        const isWildcardTail = horse.strategy && horse.strategy.id === 'wildcard' && horse.rank >= horses.length - 1;
        const wildcardBoost = typeof horse.wildcardBoost === 'number' ? horse.wildcardBoost : 1.2;
        const extra = isWildcardTail ? wildcardBoost : 1.0;
        triggerEvent(horse, 'boost', `🚀 [${horse.name}] 부스터 가속!`, item.duration, item.speedMultiplier * extra);
        onEvent('itemUseBooster', horse, { item });
        break;
      }

      case 'banana': {
        // 나보다 앞선 순위의 선두 주자들만 타겟팅하여 전방 레인에 함정 투척 (뒷순위 영향 없음)
        const leadingHorses = horses
          .filter(h => h.id !== horse.id && h.rank < horse.rank && h.distance > horse.distance && !h.finished)
          .sort((a, b) => a.distance - b.distance);

        if (leadingHorses.length > 0) {
          const target1 = leadingHorses[0];
          const dropDist1 = target1.distance + 35;
          obstacles.push({
            id: nextId('banana'),
            type: 'banana',
            lane: target1.lane,
            distance: Math.min(totalDistance - 10, dropDist1),
            targetName: target1.name,
            attackerName: horse.name,
            attackerHorse: horse
          });

          if (leadingHorses.length >= 2 && rng() < 0.5) {
            const target2 = leadingHorses[1];
            const dropDist2 = target2.distance + 40;
            obstacles.push({
              id: nextId('banana'),
              type: 'banana',
              lane: target2.lane,
              distance: Math.min(totalDistance - 10, dropDist2),
              targetName: target2.name,
              attackerName: horse.name,
              attackerHorse: horse
            });
          }
        }
        onEvent('itemUseBanana', horse, { item });
        break;
      }

      case 'shield': {
        horse.shieldActive = true;
        horse.shieldDuration = item.duration;
        onEvent('itemUseShield', horse, { item });
        break;
      }

      case 'lightning': {
        onEvent('itemUseLightning', horse, { item });
        horses.forEach(target => {
          // 나보다 앞선 순위의 선두 주자들만 번개 감전 (뒷순위 영향 없음)
          if (target.id !== horse.id && target.rank < horse.rank && target.distance > horse.distance && !target.finished) {
            if (target.shieldActive) {
              target.shieldActive = false;
              target.shieldsBlocked = (target.shieldsBlocked || 0) + 1;
              onEvent('shieldBlock', target, { attacker: horse, attackerName: horse.name, itemType: 'lightning' });
            } else {
              target.hitsTaken = (target.hitsTaken || 0) + 1;
              triggerEvent(target, 'slip', `⚡️ [${horse.name}]의 번개 감전!`, (item.stunDuration || 1.6) * slipMult, 0.4);
              onEvent('lightningHit', target, { attacker: horse, attackerName: horse.name, itemType: 'lightning' });
            }
          }
        });
        break;
      }

      case 'missile': {
        // 나보다 앞선 1위 선두마만 타겟팅 저격
        const target = horses.find(h => h.rank === 1 && h.id !== horse.id && h.distance > horse.distance && !h.finished);
        if (target) {
          projectiles.push({
            id: nextId('missile'),
            fromHorse: horse,
            targetHorse: target,
            x: horse.distance,
            fromLane: horse.lane,
            targetLane: target.lane,
            speed: (horse.baseSpeed || 60) * 2.8 * projSpeedMult
          });
          onEvent('itemUseMissile', horse, { item, target, attackerName: horse.name });
        } else {
          triggerEvent(horse, 'boost', `🚀 [${horse.name}] 미사일 로켓 부스터!`, 1.5, 1.3);
        }
        break;
      }

      case 'magnet': {
        // 나보다 앞선 1위 선두마를 향해 견인
        const lead = horses.find(h => h.rank === 1 && h.id !== horse.id && h.distance > horse.distance && !h.finished);
        const boostVal = lead ? 1.55 : 1.35;
        triggerEvent(horse, 'boost', `🧲 [${horse.name}] 자석 견인 질주!`, item.duration, boostVal);
        onEvent('itemUseMagnet', horse, { item });
        break;
      }

      case 'espresso': {
        const maxStam = horse.maxStamina || 100;
        const restore = item.staminaRestore || 50;
        horse.stamina = Math.min(maxStam, (horse.stamina || 50) + restore);
        triggerEvent(horse, 'boost', `☕️ [${horse.name}] 더블 에스프레소 각성!`, item.duration || 2.0, item.speedMultiplier || 1.42);
        onEvent('itemUseEspresso', horse, { item });
        break;
      }

      case 'approval': {
        // 바로 앞 순위 경쟁자에게 긴급 결재 서류 투척
        const aheadCandidates = horses
          .filter(h => h.id !== horse.id && h.rank < horse.rank && h.distance > horse.distance && !h.finished)
          .sort((a, b) => a.distance - b.distance);
        const target = aheadCandidates[0] || null;

        triggerEvent(horse, 'boost', `📋 [${horse.name}] 결재 넘기기 가속!`, item.duration || 1.6, item.speedMultiplier || 1.22);
        onEvent('itemUseApproval', horse, { item, target, attackerName: horse.name });

        if (target) {
          if (target.shieldActive) {
            target.shieldActive = false;
            target.shieldsBlocked = (target.shieldsBlocked || 0) + 1;
            onEvent('shieldBlock', target, { attacker: horse, attackerName: horse.name, itemType: 'approval' });
          } else {
            target.hitsTaken = (target.hitsTaken || 0) + 1;
            triggerEvent(target, 'slip', `📋 [${horse.name}]의 긴급 결재 폭탄!`, (item.stunDuration || 1.5) * slipMult, 0.45);
            onEvent('approvalHit', target, { attacker: horse, attackerName: horse.name, itemType: 'approval' });
          }
        }
        break;
      }
    }
  }

  /**
   * 바나나 장애물 충돌 검사
   */
  static checkObstacleCollisions(horses, obstacles, triggerEvent, onEvent, weatherMod = null) {
    const slipMult = weatherMod?.slipDurationMult || 1.0;

    horses.forEach(horse => {
      if (horse.finished) return;

      for (let i = obstacles.length - 1; i >= 0; i--) {
        const obs = obstacles[i];
        if (obs.lane === horse.lane && Math.abs(horse.distance - obs.distance) < 20) {
          obstacles.splice(i, 1);
          if (horse.shieldActive) {
            horse.shieldActive = false;
            horse.shieldsBlocked = (horse.shieldsBlocked || 0) + 1;
            onEvent('shieldBlock', horse, { obstacle: obs, attacker: obs.attackerHorse, attackerName: obs.attackerName, itemType: 'banana' });
          } else {
            horse.hitsTaken = (horse.hitsTaken || 0) + 1;
            const attacker = obs.attackerName ? `[${obs.attackerName}]의 ` : '';
            triggerEvent(horse, 'slip', `🍌 ${attacker}바나나 미끄러짐!`, 1.8 * slipMult, 0.35);
            onEvent('obstacleHit', horse, { obstacle: obs, attacker: obs.attackerHorse, attackerName: obs.attackerName, itemType: 'banana' });
          }
        }
      }
    });
  }

  /**
   * 미사일 투사체 비행 및 피격 판정
   */
  static updateProjectiles(projectiles, dt, triggerEvent, onEvent, weatherMod = null) {
    const slipMult = weatherMod?.slipDurationMult || 1.0;

    for (let i = projectiles.length - 1; i >= 0; i--) {
      const proj = projectiles[i];
      proj.x += proj.speed * dt;
      if (proj.x >= proj.targetHorse.distance - 15) {
        projectiles.splice(i, 1);
        const target = proj.targetHorse;
        const attackerName = proj.fromHorse ? proj.fromHorse.name : '';
        if (target.shieldActive) {
          target.shieldActive = false;
          target.shieldsBlocked = (target.shieldsBlocked || 0) + 1;
          onEvent('shieldBlock', target, { attacker: proj.fromHorse, attackerName: attackerName, itemType: 'missile' });
        } else {
          target.hitsTaken = (target.hitsTaken || 0) + 1;
          const attackerStr = attackerName ? `[${attackerName}]의 ` : '';
          triggerEvent(target, 'slip', `💥 ${attackerStr}미사일 직격타!`, 2.0 * slipMult, 0.3);
          onEvent('missileHit', target, { attacker: proj.fromHorse, attackerName: attackerName, itemType: 'missile' });
        }
      }
    }
  }
}
