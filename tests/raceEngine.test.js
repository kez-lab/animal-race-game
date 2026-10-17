/**
 * tests/raceEngine.test.js - 레이스 엔진 라이프사이클, 결정적 시드 재현 및 기상/스탯 모드 단위 테스트
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { RaceEngine, STAT_MODES } from '../js/raceEngine.js';

describe('RaceEngine', () => {
  const participants = [
    { id: 1, name: '말1', color: { body: '#FF0000' }, stats: { speed: 85, accel: 80, stamina: 55, luck: 65, intellect: 65 } },
    { id: 2, name: '말2', color: { body: '#00FF00' }, stats: { speed: 60, accel: 65, stamina: 85, luck: 70, intellect: 70 } },
    { id: 3, name: '말3', color: { body: '#0000FF' }, stats: { speed: 70, accel: 70, stamina: 70, luck: 70, intellect: 70 } }
  ];

  it('setup: 경기 거리, 참가자 수, 아이템 박스가 정상 배치되어야 한다', () => {
    const engine = new RaceEngine();
    engine.setup(participants, 1000, 'item');

    assert.equal(engine.horses.length, 3);
    assert.equal(engine.totalDistance, 1000);
    assert.equal(engine.gameMode, 'item');
    assert.equal(engine.itemBoxes.length, 12);
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

    for (let i = 0; i < 50; i++) {
      engine.update(0.1);
    }

    assert.ok(engine.elapsedTime > 4.5);
    engine.horses.forEach(horse => {
      assert.ok(horse.distance > 50, `horse ${horse.name} distance should be > 50`);
    });

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

  it('결정성 보장: 동일한 시드(seed)로 실행한 두 경기는 완주 기록과 순위가 100% 일치해야 한다', () => {
    const seed = 20261018;

    const e1 = new RaceEngine();
    e1.setup(participants, 1600, 'item', { seed, statMode: STAT_MODES.STATS, weather: 'rain' });
    e1.start();
    e1.fastForwardToEnd();

    const e2 = new RaceEngine();
    e2.setup(participants, 1600, 'item', { seed, statMode: STAT_MODES.STATS, weather: 'rain' });
    e2.start();
    // 실시간 프레임 업데이트와 스킵 혼합 테스트
    for (let i = 0; i < 30; i++) e2.update(0.05);
    e2.fastForwardToEnd();

    const times1 = e1.horses.map(h => h.finishTime);
    const times2 = e2.horses.map(h => h.finishTime);
    assert.deepEqual(times1, times2);
  });

  it('weather & statMode: 공정 모드에서는 모든 말의 물리 스탯이 70으로 동일해야 하며 랜덤 날씨가 정상 결정되어야 한다', () => {
    const engine = new RaceEngine();
    engine.setup(participants, 1000, 'item', { seed: 777, statMode: STAT_MODES.FAIR, weather: 'random' });

    assert.ok(['sunny', 'rain', 'wind', 'night'].includes(engine.weather));
    engine.horses.forEach(h => {
      assert.equal(h.physics.speed, 70);
      assert.equal(h.physics.stamina, 70);
      assert.equal(h.luckBonus, 0);
    });
  });
});
