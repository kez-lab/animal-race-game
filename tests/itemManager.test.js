/**
 * tests/itemManager.test.js - 아이템 물리, 타겟팅 및 충돌 판정 단위 테스트
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ItemManager } from '../js/itemManager.js';
import { ITEM_TYPES } from '../js/presets.js';

describe('ItemManager', () => {
  it('createItemBoxes: 4개 체크포인트(20%, 40%, 60%, 80%)에 각 레인별 상자를 생성해야 한다', () => {
    const boxes = ItemManager.createItemBoxes(3, 1000);
    // 4 checkpoints * 3 lanes = 12 boxes
    assert.equal(boxes.length, 12);
    assert.equal(boxes[0].distance, 200); // 20% of 1000
    assert.equal(boxes[3].distance, 400); // 40% of 1000
  });

  it('checkItemBoxCollisions: 말이 박스 위치에 도달하면 박스가 수집되고 아이템을 획득해야 한다', () => {
    const horses = [
      { id: 1, name: '말1', lane: 0, distance: 205, rank: 1, finished: false, heldItem: null }
    ];
    const boxes = [
      { id: 'box_0_0', lane: 0, distance: 200, collected: false }
    ];

    let pickupFired = false;
    ItemManager.checkItemBoxCollisions(horses, boxes, (horse, item) => {
      pickupFired = true;
      assert.ok(item);
    });

    assert.equal(boxes[0].collected, true);
    assert.equal(pickupFired, true);
    assert.ok(horses[0].heldItem);
  });

  it('useItem (Banana): 후속 주자가 바나나를 던지면 자신보다 앞선 선두 주자의 레인에 바나나가 매설되어야 한다', () => {
    const horses = [
      { id: 1, name: '선두', lane: 0, distance: 400, rank: 1, finished: false },
      { id: 2, name: '추격자', lane: 1, distance: 350, rank: 2, finished: false }
    ];
    const obstacles = [];
    const events = [];

    // 2위 추격자가 바나나 투척
    ItemManager.executeItem({
      horse: horses[1],
      item: ITEM_TYPES.BANANA,
      horses,
      totalDistance: 1000,
      obstacles,
      projectiles: [],
      triggerEvent: () => {},
      onEvent: (type) => events.push(type)
    });

    assert.equal(obstacles.length, 1);
    assert.equal(obstacles[0].type, 'banana');
    assert.equal(obstacles[0].lane, 0); // 1위 선두의 레인(0) 전방에 매설!
    assert.ok(obstacles[0].distance > 400); // 선두 앞쪽에 설치
  });

  it('useItem (Banana): 1위 선두 주자가 바나나를 쓰면 앞선 사람이 없으므로 후속 주자에게 영향이 가지 않아야 한다', () => {
    const horses = [
      { id: 1, name: '선두', lane: 0, distance: 400, rank: 1, finished: false },
      { id: 2, name: '추격자', lane: 1, distance: 350, rank: 2, finished: false }
    ];
    const obstacles = [];

    // 1위 선두가 바나나 사용 시 (앞선 순위가 없음)
    ItemManager.executeItem({
      horse: horses[0],
      item: ITEM_TYPES.BANANA,
      horses,
      totalDistance: 1000,
      obstacles,
      projectiles: [],
      triggerEvent: () => {},
      onEvent: () => {}
    });

    assert.equal(obstacles.length, 0); // 후속 주자에게는 영향 없음!
  });

  it('checkObstacleCollisions (Shield Block): 쉴드를 켠 말이 바나나를 밟으면 쉴드가 깨지고 미끄러지지 않아야 한다', () => {
    const horse = {
      id: 2,
      name: '추격자',
      lane: 1,
      distance: 385,
      shieldActive: true,
      finished: false
    };
    const obstacles = [
      { id: 'b1', type: 'banana', lane: 1, distance: 385 }
    ];

    let shieldBlocked = false;
    let slipTriggered = false;

    ItemManager.checkObstacleCollisions(
      [horse],
      obstacles,
      (h, state) => { if (state === 'slip') slipTriggered = true; },
      (type) => { if (type === 'shieldBlock') shieldBlocked = true; }
    );

    assert.equal(obstacles.length, 0); // 바나나 소모
    assert.equal(horse.shieldActive, false); // 쉴드 소모
    assert.equal(shieldBlocked, true); // 쉴드 방어 이벤트 발생
    assert.equal(slipTriggered, false); // 미끄러짐 방어 성공
  });

  it('useItem (Lightning): 번개 발동 시 자신보다 앞선 선두 말들을 감전시켜야 한다', () => {
    const horses = [
      { id: 1, name: '1등말', lane: 0, distance: 600, rank: 1, shieldActive: false, finished: false },
      { id: 2, name: '2등말', lane: 1, distance: 500, rank: 2, shieldActive: true, finished: false },
      { id: 3, name: '3등말', lane: 2, distance: 400, rank: 3, shieldActive: false, finished: false }
    ];

    const slips = [];
    const shieldBlocks = [];

    ItemManager.executeItem({
      horse: horses[2], // 3등 말이 번개 사용
      item: ITEM_TYPES.LIGHTNING,
      horses,
      totalDistance: 1000,
      obstacles: [],
      projectiles: [],
      triggerEvent: (h, state) => slips.push(h.name),
      onEvent: (type, h) => {
        if (type === 'shieldBlock') shieldBlocks.push(h.name);
      }
    });

    assert.deepEqual(slips, ['1등말']); // 1등말 감전 피격
    assert.deepEqual(shieldBlocks, ['2등말']); // 2등말은 쉴드로 방어
    assert.equal(horses[1].shieldActive, false); // 2등말 쉴드 깨짐
  });
});
