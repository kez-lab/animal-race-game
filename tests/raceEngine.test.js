/**
 * tests/raceEngine.test.js - 레이스 엔진 라이프사이클 및 물리 시뮬레이션 단위 테스트
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { RaceEngine } from '../js/raceEngine.js';

describe('RaceEngine', () => {
  const participants = [
    { id: 1, name: '말1', color: { body: '#FF0000' } },
    { id: 2, name: '말2', color: { body: '#00FF00' } },
    { id: 3, name: '말3', color: { body: '#0000FF' } }
  ];

  it('setup: 경기 거리, 참가자 수, 아이템 박스가 정상 배치되어야 한다', () => {
    const engine = new RaceEngine();
    engine.setup(participants, 1000, 'item');

    assert.equal(engine.horses.length, 3);
    assert.equal(engine.totalDistance, 1000);
    assert.equal(engine.gameMode, 'item');
    assert.equal(engine.itemBoxes.length, 12); // 4 checkpoints * 3 lanes
    assert.equal(engine.isFinished, false);
  });

  it('start/pause/resume/setTimeScale: 상태가 정상 제어되어야 한다', () => {
    const engine = new RaceEngine();
    engine.setup(participants, 1000, 'speed');

    engine.start();
    assert.equal(engine.isRunning, true);
    assert.equal(engine.isPaused, false);

    engine.pause();
    assert.equal(engine.isPaused, true);

    engine.resume();
    assert.equal(engine.isPaused, false);

    engine.setTimeScale(2.0);
    assert.equal(engine.timeScale, 2.0);
  });

  it('update: 시뮬레이션 진행에 따라 말들의 거리가 증가하고 순위가 실시간 계산되어야 한다', () => {
    const engine = new RaceEngine();
    engine.setup(participants, 1000, 'speed');
    engine.start();

    // 0.1초씩 50스텝 진행 (총 5초)
    for (let i = 0; i < 50; i++) {
      engine.update(0.1);
    }

    assert.ok(engine.elapsedTime > 4.5);
    engine.horses.forEach(horse => {
      assert.ok(horse.distance > 50, `horse ${horse.name} distance should be > 50`);
    });

    // 1위 말의 순위 확인
    assert.equal(engine.horses.find(h => h.rank === 1) !== undefined, true);
  });

  it('fastForwardToEnd: 모든 말이 완주하고 onAllFinished가 호출되어야 한다', () => {
    let allFinishedCalled = false;
    let finishedHorses = [];

    const engine = new RaceEngine({
      onAllFinished: (horses) => {
        allFinishedCalled = true;
        finishedHorses = horses;
      }
    });

    engine.setup(participants, 1000, 'item');
    engine.start();
    engine.fastForwardToEnd();

    assert.equal(engine.isFinished, true);
    assert.equal(allFinishedCalled, true);
    assert.equal(finishedHorses.length, 3);
    finishedHorses.forEach(h => {
      assert.equal(h.finished, true);
      assert.ok(h.finishTime > 0);
    });
  });
});
