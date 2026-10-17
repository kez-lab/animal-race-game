/**
 * tests/penalty.test.js - 벌칙 산정, 개별 음료 정산 및 경기 MVP 산출 단위 테스트
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculatePenaltyHorses,
  calculateEstimatedPrice,
  calculateDetailedOrder,
  computeRaceMVPs,
  PENALTY_RULES
} from '../js/penalty.js';

describe('PenaltyCalculator', () => {
  const mockHorses = [
    { id: 1, name: '김팀장', rank: 1, worstRank: 4, overtakes: 3, finishTime: 18.2 },
    { id: 2, name: '이과장', rank: 2, worstRank: 2, shieldsBlocked: 2, finishTime: 18.9 },
    { id: 3, name: '박대리', rank: 3, worstRank: 3, hitsTaken: 3, finishTime: 19.5 },
    { id: 4, name: '최사원', rank: 4, worstRank: 4, finishTime: 20.1 }
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

  it('calculateDetailedOrder: 참가자별 지정 음료를 집계하여 정확한 소계와 총액을 산출해야 한다', () => {
    const customParticipants = [
      { name: '김팀장', drinkId: 'americano' }, // 4,500
      { name: '이과장', drinkId: 'americano' }, // 4,500
      { name: '박대리', drinkId: 'vanilla' }    // 5,800
    ];
    const order = calculateDetailedOrder(customParticipants, true);
    assert.equal(order.totalAmount, 14800);
    assert.equal(order.items.length, 2);
  });

  it('computeRaceMVPs: 경기 텔레메트리 기반으로 역전 우승, 추월왕, 동네북, 수호신 배지를 산출해야 한다', () => {
    const awards = computeRaceMVPs(mockHorses);
    assert.ok(awards.length >= 2);
    assert.ok(awards.some(a => a.title === '김팀장'));
  });
});
