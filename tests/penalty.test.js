/**
 * tests/penalty.test.js - 벌칙 산정 및 가격 계산 단위 테스트
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculatePenaltyHorses, calculateEstimatedPrice, PENALTY_RULES } from '../js/penalty.js';

describe('PenaltyCalculator', () => {
  const mockHorses = [
    { id: 1, name: '김팀장', rank: 1 },
    { id: 2, name: '이과장', rank: 2 },
    { id: 3, name: '박대리', rank: 3 },
    { id: 4, name: '최사원', rank: 4 }
  ];

  it('last1 룰: 최하위 1명만 결제자로 선정되어야 한다', () => {
    const result = calculatePenaltyHorses(mockHorses, PENALTY_RULES.LAST1);
    assert.equal(result.length, 1);
    assert.equal(result[0].name, '최사원');
  });

  it('last2 룰: 하위 2명(3위, 4위)이 결제자로 선정되어야 한다', () => {
    const result = calculatePenaltyHorses(mockHorses, PENALTY_RULES.LAST2);
    assert.equal(result.length, 2);
    assert.equal(result[0].name, '최사원');
    assert.equal(result[1].name, '박대리');
  });

  it('winnerSafe 룰: 1등을 제외한 나머지 전원(3명)이 결제자로 선정되어야 한다', () => {
    const result = calculatePenaltyHorses(mockHorses, PENALTY_RULES.WINNER_SAFE);
    assert.equal(result.length, 3);
    assert.equal(result[0].name, '이과장');
    assert.equal(result[1].name, '박대리');
    assert.equal(result[2].name, '최사원');
  });

  it('randomTarget 룰: 4인 이상일 때 4등이 지정 벌칙자로 선정되어야 한다', () => {
    const result = calculatePenaltyHorses(mockHorses, PENALTY_RULES.RANDOM_TARGET);
    assert.equal(result.length, 1);
    assert.equal(result[0].name, '최사원');
  });

  it('빈 배열 입력 시 빈 결과를 안전하게 반환해야 한다', () => {
    const result = calculatePenaltyHorses([], PENALTY_RULES.LAST1);
    assert.deepEqual(result, []);
  });

  it('calculateEstimatedPrice: 참가자 수와 단가를 곱한 총 결제액을 정확히 계산해야 한다', () => {
    const customMenu = { name: '바닐라빈 라떼', price: '5,800원' };
    const priceInfo = calculateEstimatedPrice(4, true, customMenu);
    assert.equal(priceInfo.unitPrice, 5800);
    assert.equal(priceInfo.totalAmount, 23200);
  });
});
