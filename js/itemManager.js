/**
 * itemManager.js - 아이템 박스 생성, 획득, 사용, 투사체 및 장애물 충돌 판정 순수 로직 모듈 (테스터블 모듈)
 */

import { ITEM_TYPES } from './presets.js';

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
   */
  static checkItemBoxCollisions(horses, itemBoxes, onPickup) {
    horses.forEach(horse => {
      if (horse.finished) return;

      itemBoxes.forEach(box => {
        if (!box.collected && box.lane === horse.lane) {
          if (Math.abs(horse.distance - box.distance) < 25) {
            box.collected = true;
            this.pickupRandomItem(horse, horses.length, onPickup);
          }
        }
      });
    });
  }

  /**
   * 순위에 따른 확률 기반 아이템 획득
   */
  static pickupRandomItem(horse, totalHorses, onPickup) {
    let possibleItems = [];
    if (horse.rank === 1) {
      possibleItems = [ITEM_TYPES.BANANA, ITEM_TYPES.SHIELD, ITEM_TYPES.BOOSTER];
    } else if (horse.rank >= totalHorses - 1) {
      possibleItems = [ITEM_TYPES.BOOSTER, ITEM_TYPES.LIGHTNING, ITEM_TYPES.MAGNET, ITEM_TYPES.MISSILE];
    } else {
      possibleItems = Object.values(ITEM_TYPES);
    }

    const picked = possibleItems[Math.floor(Math.random() * possibleItems.length)];
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
  static executeItem({ horse, item, horses, totalDistance, obstacles, projectiles, triggerEvent, onEvent }) {
    if (!item) return;

    // 아이템 사용 즉시 보유 슬롯에서 소모 & 제거
    horse.heldItem = null;
    horse.heldItemTimer = 0;

    switch (item.id) {
      case 'booster': {
        const isWildcardTail = horse.strategy && horse.strategy.id === 'wildcard' && horse.rank >= horses.length - 1;
        const extra = isWildcardTail ? 1.2 : 1.0;
        triggerEvent(horse, 'boost', `🚀 [${horse.name}] 부스터 가속!`, item.duration, item.speedMultiplier * extra);
        onEvent('itemUseBooster', horse, { item });
        break;
      }

      case 'banana': {
        const trailingHorses = horses
          .filter(h => h.id !== horse.id && h.distance < horse.distance && !h.finished)
          .sort((a, b) => b.distance - a.distance);

        if (trailingHorses.length > 0) {
          const target1 = trailingHorses[0];
          const dropDist1 = Math.min(horse.distance - 10, target1.distance + 35);
          obstacles.push({
            id: `banana_${Date.now()}_1`,
            type: 'banana',
            lane: target1.lane,
            distance: Math.max(10, dropDist1),
            targetName: target1.name
          });

          if (trailingHorses.length >= 2 && Math.random() < 0.6) {
            const target2 = trailingHorses[1];
            const dropDist2 = Math.min(horse.distance - 15, target2.distance + 40);
            obstacles.push({
              id: `banana_${Date.now()}_2`,
              type: 'banana',
              lane: target2.lane,
              distance: Math.max(10, dropDist2),
              targetName: target2.name
            });
          }
        } else {
          const leadingHorses = horses
            .filter(h => h.id !== horse.id && h.distance > horse.distance && !h.finished)
            .sort((a, b) => a.distance - b.distance);
          if (leadingHorses.length > 0) {
            const target = leadingHorses[0];
            obstacles.push({
              id: `banana_${Date.now()}_lead`,
              type: 'banana',
              lane: target.lane,
              distance: target.distance + 45,
              targetName: target.name
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
          if (target.id !== horse.id && target.rank < horse.rank && !target.finished) {
            if (target.shieldActive) {
              target.shieldActive = false;
              onEvent('shieldBlock', target, { attacker: horse });
            } else {
              triggerEvent(target, 'slip', `⚡️ [${target.name}] 번개 감전!`, item.stunDuration, 0.4);
            }
          }
        });
        break;
      }

      case 'missile': {
        const target = horses.find(h => h.rank === 1 && h.id !== horse.id && !h.finished);
        if (target) {
          projectiles.push({
            id: `missile_${Date.now()}`,
            fromHorse: horse,
            targetHorse: target,
            x: horse.distance,
            fromLane: horse.lane,
            targetLane: target.lane,
            speed: horse.baseSpeed * 2.8
          });
          onEvent('itemUseMissile', horse, { item, target });
        } else {
          triggerEvent(horse, 'boost', `🚀 [${horse.name}] 미사일 로켓 부스터!`, 2.0, 1.4);
        }
        break;
      }

      case 'magnet': {
        const lead = horses.find(h => h.rank === 1 && h.id !== horse.id && !h.finished);
        const boostVal = lead ? 1.55 : 1.35;
        triggerEvent(horse, 'boost', `🧲 [${horse.name}] 자석 견인 질주!`, item.duration, boostVal);
        onEvent('itemUseMagnet', horse, { item });
        break;
      }
    }
  }

  /**
   * 바나나 장애물 충돌 검사
   */
  static checkObstacleCollisions(horses, obstacles, triggerEvent, onEvent) {
    horses.forEach(horse => {
      if (horse.finished) return;

      for (let i = obstacles.length - 1; i >= 0; i--) {
        const obs = obstacles[i];
        if (obs.lane === horse.lane && Math.abs(horse.distance - obs.distance) < 20) {
          obstacles.splice(i, 1);
          if (horse.shieldActive) {
            horse.shieldActive = false;
            onEvent('shieldBlock', horse, { obstacle: obs });
          } else {
            triggerEvent(horse, 'slip', `🍌 [${horse.name}] 바나나 미끄러짐!`, 1.6, 0.35);
            onEvent('obstacleHit', horse, { obstacle: obs });
          }
        }
      }
    });
  }

  /**
   * 미사일 투사체 비행 및 피격 판정
   */
  static updateProjectiles(projectiles, dt, triggerEvent, onEvent) {
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const proj = projectiles[i];
      proj.x += proj.speed * dt;
      if (proj.x >= proj.targetHorse.distance - 15) {
        projectiles.splice(i, 1);
        const target = proj.targetHorse;
        if (target.shieldActive) {
          target.shieldActive = false;
          onEvent('shieldBlock', target, { attacker: proj.fromHorse });
        } else {
          triggerEvent(target, 'slip', `💥 [${target.name}] 미사일 직격타!`, 1.8, 0.3);
          onEvent('missileHit', target, { attacker: proj.fromHorse });
        }
      }
    }
  }
}
