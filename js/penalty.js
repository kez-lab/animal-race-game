/**
 * penalty.js - 커피내기 벌칙 계산 및 영수증 정산 순수 로직 모듈 (테스터블 모듈)
 */

import { COFFEE_MENUS } from './presets.js';

export const PENALTY_RULES = {
  LAST1: 'last1',
  LAST2: 'last2',
  WINNER_SAFE: 'winnerSafe',
  RANDOM_TARGET: 'randomTarget'
};

export const RULE_DESCRIPTIONS = {
  last1: '☕️ 꼴찌 1명 전원 커피 몰빵',
  last2: '👥 하위 2명 균등 뿜빠이',
  winnerSafe: '👑 1등 제외 전원 균등 분담',
  randomTarget: '🎯 지정 순위(4등) 깜짝 벌칙'
};

/**
 * 최종 순위 목록과 선택된 룰을 기반으로 결제 대상자(벌칙자)를 계산하는 순수 함수
 * @param {Array} finalRankings - rank 속성이 오름차순으로 정렬된 말 목록
 * @param {string} rule - 'last1' | 'last2' | 'winnerSafe' | 'randomTarget'
 * @returns {Array} 벌칙 대상 말 목록
 */
export function calculatePenaltyHorses(finalRankings, rule = PENALTY_RULES.LAST1) {
  if (!Array.isArray(finalRankings) || finalRankings.length === 0) {
    return [];
  }

  const total = finalRankings.length;

  switch (rule) {
    case PENALTY_RULES.LAST1:
      return [finalRankings[total - 1]];

    case PENALTY_RULES.LAST2:
      if (total <= 1) return [finalRankings[0]];
      return [finalRankings[total - 1], finalRankings[total - 2]];

    case PENALTY_RULES.WINNER_SAFE:
      if (total <= 1) return [];
      return finalRankings.slice(1);

    case PENALTY_RULES.RANDOM_TARGET: {
      // 4인 이상이면 4등, 그 미만이면 중간 순위
      const targetRank = total >= 4 ? 4 : Math.ceil(total / 2);
      return [finalRankings[targetRank - 1]];
    }

    default:
      return [finalRankings[total - 1]];
  }
}

/**
 * 커피 잔수 및 메뉴 추천 여부에 따른 예상 총 결제 금액 계산
 * @param {number} totalCount - 참가자 수 (잔 수)
 * @param {boolean} includeCoffeeMenu - 랜덤 추천 메뉴 포함 여부
 * @param {Object} [customMenu] - 지정 메뉴 (없을 시 자동 선택/기본값)
 * @returns {{ menu: Object, unitPrice: number, totalAmount: number }}
 */
export function calculateEstimatedPrice(totalCount, includeCoffeeMenu = true, customMenu = null) {
  const count = Math.max(1, totalCount);

  if (includeCoffeeMenu) {
    const menu = customMenu || COFFEE_MENUS[0];
    const unitPrice = parseInt(menu.price.replace(/[^0-9]/g, ''), 10) || 4500;
    return {
      menu,
      unitPrice,
      totalAmount: unitPrice * count
    };
  }

  const defaultMenu = { name: '☕️ 아이스 아메리카노 외', price: '4,500원', note: '가장 무난하고 빠른 선택!' };
  const unitPrice = 4500;
  return {
    menu: defaultMenu,
    unitPrice,
    totalAmount: unitPrice * count
  };
}
