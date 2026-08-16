/**
 * tests/horseGenerator.test.js - 온디바이스 AI 경주마 및 5대 능력치 밸런스 검증 단위 테스트
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { HorseGenerator, TOTAL_STAT_BUDGET, MIN_STAT_VALUE, MAX_STAT_VALUE, HORSE_ARCHETYPES } from '../js/horseGenerator.js';

describe('HorseGenerator (350pt Balance System)', () => {
  it('generateBalancedStats: 모든 아키타입에서 스탯 총합이 정확히 350pt여야 한다', () => {
    HORSE_ARCHETYPES.forEach(archetype => {
      const stats = HorseGenerator.generateBalancedStats(archetype.id);
      const sum = stats.speed + stats.accel + stats.stamina + stats.luck + stats.intellect;
      assert.equal(sum, TOTAL_STAT_BUDGET, `Archetype ${archetype.id} must sum to 350`);
    });
  });

  it('100회 연속 무작위 생성 시에도 모든 스탯이 [50, 90] 범위 내에 있고 총합이 350pt여야 한다', () => {
    for (let i = 0; i < 100; i++) {
      const stats = HorseGenerator.generateBalancedStats();
      const sum = stats.speed + stats.accel + stats.stamina + stats.luck + stats.intellect;
      
      assert.equal(sum, TOTAL_STAT_BUDGET);
      assert.ok(stats.speed >= MIN_STAT_VALUE && stats.speed <= MAX_STAT_VALUE, `Speed out of bounds: ${stats.speed}`);
      assert.ok(stats.accel >= MIN_STAT_VALUE && stats.accel <= MAX_STAT_VALUE, `Accel out of bounds: ${stats.accel}`);
      assert.ok(stats.stamina >= MIN_STAT_VALUE && stats.stamina <= MAX_STAT_VALUE, `Stamina out of bounds: ${stats.stamina}`);
      assert.ok(stats.luck >= MIN_STAT_VALUE && stats.luck <= MAX_STAT_VALUE, `Luck out of bounds: ${stats.luck}`);
      assert.ok(stats.intellect >= MIN_STAT_VALUE && stats.intellect <= MAX_STAT_VALUE, `Intellect out of bounds: ${stats.intellect}`);
    }
  });

  it('getDefaultStable: 기본 마구간에 8마리의 유효한 밸런스 명마가 등록되어 있어야 한다', () => {
    const stable = HorseGenerator.getDefaultStable();
    assert.equal(stable.length, 8);
    
    stable.forEach(horse => {
      assert.ok(horse.id);
      assert.ok(horse.name);
      assert.ok(horse.title);
      assert.ok(horse.lore);
      assert.ok(horse.color);
      assert.ok(horse.strategy);
      
      const sum = horse.stats.speed + horse.stats.accel + horse.stats.stamina + horse.stats.luck + horse.stats.intellect;
      assert.equal(sum, TOTAL_STAT_BUDGET, `Default horse ${horse.name} stats must sum to 350`);
    });
  });

  it('generateAIHorse: 온디바이스 AI 생성기가 유효한 새 경주마 객체를 창조해야 한다', async () => {
    const aiHorse = await HorseGenerator.generateAIHorse();
    assert.ok(aiHorse.id.startsWith('horse_'));
    assert.ok(aiHorse.name.length >= 2);
    assert.ok(aiHorse.lore.length >= 5);
    
    const sum = aiHorse.stats.speed + aiHorse.stats.accel + aiHorse.stats.stamina + aiHorse.stats.luck + aiHorse.stats.intellect;
    assert.equal(sum, TOTAL_STAT_BUDGET);
  });
});
