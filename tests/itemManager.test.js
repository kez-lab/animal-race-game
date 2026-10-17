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
    assert.equal(boxes.length, 12);
    assert.equal(boxes[0].distance, 200);
    assert.equal(boxes[3].distance, 400);
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
    assert.equal(obstacles[0].lane, 0);
    assert.ok(obstacles[0].distance > 400);
  });

  it('useItem (Banana): 1위 선두 주자가 바나나를 쓰면 앞선 사람이 없으므로 후속 주자에게 영향이 가지 않아야 한다', () => {
    const horses = [
      { id: 1, name: '선두', lane: 0, distance: 400, rank: 1, finished: false },
      { id: 2, name: '추격자', lane: 1, distance: 350, rank: 2, finished: false }
    ];
    const obstacles = [];

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

    assert.equal(obstacles.length, 0);
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

    assert.equal(obstacles.length, 0);
    assert.equal(horse.shieldActive, false);
    assert.equal(shieldBlocked, true);
    assert.equal(slipTriggered, false);
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
      horse: horses[2],
      item: ITEM_TYPES.LIGHTNING,
      horses,
      totalDistance: 1000,
      obstacles: [],
      projectiles: [],
      triggerEvent: (h) => slips.push(h.name),
      onEvent: (type, h) => {
        if (type === 'shieldBlock') shieldBlocks.push(h.name);
      }
    });

    assert.deepEqual(slips, ['1등말']);
    assert.deepEqual(shieldBlocks, ['2등말']);
    assert.equal(horses[1].shieldActive, false);
  });

  it('useItem (Espresso): 스태미나를 즉시 회복하고 가속 부스트를 발동해야 한다', () => {
    const horse = { id: 1, name: '피로마', stamina: 20, maxStamina: 100, rank: 2, finished: false };
    let boosted = false;

    ItemManager.executeItem({
      horse,
      item: ITEM_TYPES.ESPRESSO,
      horses: [horse],
      totalDistance: 1000,
      obstacles: [],
      projectiles: [],
      triggerEvent: (h, state) => { if (state === 'boost') boosted = true; },
      onEvent: () => {}
    });

    assert.equal(horse.stamina, 70);
    assert.equal(boosted, true);
  });

  it('useItem (Approval): 바로 앞 경쟁자를 감속시키고 본인은 가속해야 한다', () => {
    const horses = [
      { id: 1, name: '선두', lane: 0, distance: 500, rank: 1, shieldActive: false, finished: false },
      { id: 2, name: '후발', lane: 1, distance: 440, rank: 2, shieldActive: false, finished: false }
    ];
    const states = {};

    ItemManager.executeItem({
      horse: horses[1],
      item: ITEM_TYPES.APPROVAL,
      horses,
      totalDistance: 1000,
      obstacles: [],
      projectiles: [],
      triggerEvent: (h, state) => { states[h.name] = state; },
      onEvent: () => {}
    });

    assert.equal(states['후발'], 'boost');
    assert.equal(states['선두'], 'slip');
  });
});
