/**
 * tests/statsManager.test.js - 사내 명예의 전당 및 누적 결제 통계 단위 테스트
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { StatsManager } from '../js/statsManager.js';

describe('StatsManager (Hall of Fame)', () => {
  it('recordRaceResult: 경기 결과를 누적 집계하고 우승자 및 결제자의 통계를 정확히 갱신해야 한다', () => {
    let state = StatsManager.createEmptyState();

    const finalRankings = [
      { id: 1, name: '김팀장', rank: 1 },
      { id: 2, name: '이대리', rank: 2 },
      { id: 3, name: '박사원', rank: 3 }
    ];
    const penaltyHorses = [finalRankings[2]]; // 박사원 당첨

    state = StatsManager.recordRaceResult(state, {
      finalRankings,
      penaltyHorses,
      totalAmount: 15000,
      ruleDesc: '꼴찌 1명 몰빵',
      seedCode: 'ABC123'
    });

    assert.equal(state.totalRaces, 1);
    assert.equal(state.totalCoffeeCups, 3);
    assert.equal(state.totalMoneySpent, 15000);
    assert.equal(state.players['김팀장'].wins, 1);
    assert.equal(state.players['김팀장'].penalties, 0);
    assert.equal(state.players['박사원'].penalties, 1);
    assert.equal(state.players['박사원'].totalSpent, 15000);
    assert.equal(state.history.length, 1);
    assert.equal(state.history[0].seedCode, 'ABC123');
  });

  it('getRankings: 다수 경기 후 최다 결제왕과 최다 우승왕 순위를 올바르게 정렬해야 한다', () => {
    let state = StatsManager.createEmptyState();
    const r1 = [
      { id: 1, name: '김팀장', rank: 1 },
      { id: 2, name: '박사원', rank: 2 }
    ];

    state = StatsManager.recordRaceResult(state, {
      finalRankings: r1,
      penaltyHorses: [r1[1]],
      totalAmount: 10000
    });
    state = StatsManager.recordRaceResult(state, {
      finalRankings: r1,
      penaltyHorses: [r1[1]],
      totalAmount: 12000
    });

    const { topPayers, topWinners } = StatsManager.getRankings(state);
    assert.equal(topPayers[0].name, '박사원');
    assert.equal(topPayers[0].totalSpent, 22000);
    assert.equal(topWinners[0].name, '김팀장');
    assert.equal(topWinners[0].wins, 2);
  });
});
