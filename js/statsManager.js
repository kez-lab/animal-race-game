/**
 * statsManager.js - 사내 오피스 더비 명예의 전당(전적/통계/커피 결제 장부) 순수 관리 모듈 (테스터블 모듈)
 */

export const STATS_STORAGE_KEY = 'office_derby_hall_of_fame_v1';

export class StatsManager {
  static createEmptyState() {
    return {
      totalRaces: 0,
      totalCoffeeCups: 0,
      totalMoneySpent: 0,
      players: {}, // { [name]: { name, races, wins, penalties, totalSpent, lastPlayedAt } }
      history: []  // 최근 20경기 기록
    };
  }

  static loadStats(storage = globalThis.localStorage) {
    if (!storage) return this.createEmptyState();
    try {
      const raw = storage.getItem(STATS_STORAGE_KEY);
      if (!raw) return this.createEmptyState();
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && parsed.players) {
        return {
          totalRaces: Number(parsed.totalRaces) || 0,
          totalCoffeeCups: Number(parsed.totalCoffeeCups) || 0,
          totalMoneySpent: Number(parsed.totalMoneySpent) || 0,
          players: parsed.players || {},
          history: Array.isArray(parsed.history) ? parsed.history : []
        };
      }
    } catch (e) {
      console.warn('Failed to load Hall of Fame stats', e);
    }
    return this.createEmptyState();
  }

  static saveStats(state, storage = globalThis.localStorage) {
    if (!storage || !state) return false;
    try {
      storage.setItem(STATS_STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (e) {
      console.warn('Failed to save Hall of Fame stats', e);
      return false;
    }
  }

  static clearStats(storage = globalThis.localStorage) {
    const empty = this.createEmptyState();
    if (storage) {
      try {
        storage.removeItem(STATS_STORAGE_KEY);
      } catch (e) {}
    }
    return empty;
  }

  /**
   * 경기 결과를 반영하여 새로운 통계 상태를 반환 (순수 함수)
   * @param {Object} currentState
   * @param {Object} raceResult
   * @param {Array} raceResult.finalRankings - 완주 순위 배열
   * @param {Array} raceResult.penaltyHorses - 결제 당첨 말 배열
   * @param {number} raceResult.totalAmount - 총 예상 결제 금액
   * @param {string} raceResult.ruleDesc - 적용된 벌칙 룰 설명
   * @param {string} [raceResult.seedCode] - 경기 시드 코드
   * @param {string} [raceResult.gameMode] - 'item' | 'speed'
   * @param {number} [raceResult.distance] - 트랙 거리
   */
  static recordRaceResult(currentState, raceResult) {
    const state = currentState ? JSON.parse(JSON.stringify(currentState)) : this.createEmptyState();
    const {
      finalRankings = [],
      penaltyHorses = [],
      totalAmount = 0,
      ruleDesc = '꼴찌 몰빵',
      seedCode = '',
      gameMode = 'item',
      distance = 1600,
      timestamp = new Date().toISOString()
    } = raceResult || {};

    if (finalRankings.length === 0) return state;

    state.totalRaces += 1;
    state.totalCoffeeCups += finalRankings.length;
    state.totalMoneySpent += totalAmount;

    const penaltyIds = new Set(penaltyHorses.map(h => h.id));
    const perPayerShare = penaltyHorses.length > 0 ? Math.round(totalAmount / penaltyHorses.length) : 0;

    finalRankings.forEach((horse, idx) => {
      const name = String(horse.name || '').trim();
      if (!name) return;

      if (!state.players[name]) {
        state.players[name] = {
          name,
          races: 0,
          wins: 0,
          penalties: 0,
          totalSpent: 0,
          lastPlayedAt: timestamp
        };
      }

      const p = state.players[name];
      p.races += 1;
      if (idx === 0 || horse.rank === 1) {
        p.wins += 1;
      }
      if (penaltyIds.has(horse.id)) {
        p.penalties += 1;
        p.totalSpent += perPayerShare;
      }
      p.lastPlayedAt = timestamp;
    });

    const winner = finalRankings[0];
    const historyItem = {
      id: `race_${Date.now()}_${state.totalRaces}`,
      timestamp,
      winnerName: winner ? winner.name : '-',
      payerNames: penaltyHorses.map(h => h.name),
      participantCount: finalRankings.length,
      totalAmount,
      ruleDesc,
      seedCode,
      gameMode,
      distance
    };

    state.history = [historyItem, ...(state.history || [])].slice(0, 20);
    return state;
  }

  /**
   * 결제왕(지갑 오픈 랭킹) 및 우승왕 랭킹 산출
   */
  static getRankings(state) {
    const players = Object.values(state?.players || {});

    const topPayers = [...players]
      .filter(p => p.penalties > 0 || p.races > 0)
      .sort((a, b) => {
        if (b.totalSpent !== a.totalSpent) return b.totalSpent - a.totalSpent;
        if (b.penalties !== a.penalties) return b.penalties - a.penalties;
        return b.races - a.races;
      });

    const topWinners = [...players]
      .filter(p => p.wins > 0 || p.races > 0)
      .sort((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins;
        const rateB = b.races > 0 ? b.wins / b.races : 0;
        const rateA = a.races > 0 ? a.wins / a.races : 0;
        return rateB - rateA;
      });

    return {
      topPayers,
      topWinners
    };
  }
}
