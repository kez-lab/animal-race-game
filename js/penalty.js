/**
 * penalty.js - 커피내기 벌칙 계산, 개별 음료 영수증 정산 및 경기 MVP 산출 순수 로직 모듈 (테스터블 모듈)
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
 * @param {boolean} includeCoffeeMenu - 추천 메뉴 포함 여부
 * @param {Object} [customMenu] - 지정 메뉴 (없을 시 자동 선택/기본값)
 * @param {Object} [options] - 추가 옵션 (rng 등)
 * @returns {{ menu: Object, unitPrice: number, totalAmount: number }}
 */
export function calculateEstimatedPrice(totalCount, includeCoffeeMenu = true, customMenu = null, options = {}) {
  const count = Math.max(1, totalCount);

  if (includeCoffeeMenu) {
    let menu = customMenu;
    if (!menu) {
      if (typeof options.rng === 'function') {
        const idx = Math.floor(options.rng() * COFFEE_MENUS.length);
        menu = COFFEE_MENUS[idx] || COFFEE_MENUS[0];
      } else {
        menu = COFFEE_MENUS[0];
      }
    }
    const unitPrice = menu.numericPrice || parseInt(String(menu.price).replace(/[^0-9]/g, ''), 10) || 4500;
    return {
      menu,
      unitPrice,
      totalAmount: unitPrice * count
    };
  }

  const defaultMenu = { id: 'americano', shortName: '아아', name: '☕️ 아이스 아메리카노 외', price: '4,500원', numericPrice: 4500, note: '가장 무난하고 빠른 선택!' };
  const unitPrice = 4500;
  return {
    menu: defaultMenu,
    unitPrice,
    totalAmount: unitPrice * count
  };
}

/**
 * 참가자별 지정 음료(또는 랜덤 추천 음료)를 집계하여 실물 카페 영수증용 주문 내역을 생성
 * @param {Array} participants - 참가자/완주 말 배열
 * @param {boolean} includeCoffeeMenu - 랜덤/지정 메뉴 활성화 여부
 * @param {() => number} [rng] - 시드 난수 함수
 */
export function calculateDetailedOrder(participants = [], includeCoffeeMenu = true, rng = Math.random) {
  if (!Array.isArray(participants) || participants.length === 0) {
    return {
      items: [],
      individualOrders: [],
      totalAmount: 0,
      averagePrice: 4500,
      primaryMenu: COFFEE_MENUS[0]
    };
  }

  if (!includeCoffeeMenu) {
    const unitPrice = 4500;
    const totalAmount = unitPrice * participants.length;
    const defaultMenu = { id: 'americano', shortName: '아아', name: '☕️ 아이스 아메리카노 통일', price: '4,500원', numericPrice: 4500, note: '빠른 주문을 위한 아아 통일!' };
    return {
      items: [{ menu: defaultMenu, count: participants.length, subtotal: totalAmount, names: participants.map(p => p.name) }],
      individualOrders: participants.map(p => ({ name: p.name, menu: defaultMenu, price: unitPrice })),
      totalAmount,
      averagePrice: unitPrice,
      primaryMenu: defaultMenu
    };
  }

  // 참가자 중 개별 음료를 지정한 사람이 있는지 확인
  const hasCustomDrink = participants.some(p => p.drinkId && p.drinkId !== 'random');

  // 전원 랜덤 모드일 때: 단일 대표 추천 메뉴 또는 각자 랜덤 메뉴
  const grouped = new Map();
  const individualOrders = [];
  let totalAmount = 0;

  // 대표 추천 메뉴 1종 추첨 (기본용)
  const fallbackIdx = Math.floor(rng() * COFFEE_MENUS.length);
  const pickedPrimary = COFFEE_MENUS[fallbackIdx] || COFFEE_MENUS[0];

  participants.forEach(p => {
    let menu = null;
    if (p.drinkId && p.drinkId !== 'random') {
      menu = COFFEE_MENUS.find(m => m.id === p.drinkId) || null;
    }
    if (!menu) {
      menu = hasCustomDrink
        ? (COFFEE_MENUS[Math.floor(rng() * COFFEE_MENUS.length)] || pickedPrimary)
        : pickedPrimary;
    }

    const price = menu.numericPrice || parseInt(String(menu.price).replace(/[^0-9]/g, ''), 10) || 4500;
    totalAmount += price;
    individualOrders.push({ name: p.name, menu, price });

    if (!grouped.has(menu.id)) {
      grouped.set(menu.id, { menu, count: 0, subtotal: 0, names: [] });
    }
    const entry = grouped.get(menu.id);
    entry.count += 1;
    entry.subtotal += price;
    entry.names.push(p.name);
  });

  const items = Array.from(grouped.values());
  const averagePrice = Math.round(totalAmount / participants.length);

  return {
    items,
    individualOrders,
    totalAmount,
    averagePrice,
    primaryMenu: items[0]?.menu || pickedPrimary
  };
}

/**
 * 경기 텔레메트리 데이터를 분석하여 재미있는 사내 경기 MVP 배지 산출
 * @param {Array} finalRankings
 * @returns {Array<{ badge: string, title: string, horseName: string, desc: string }>}
 */
export function computeRaceMVPs(finalRankings = []) {
  if (!Array.isArray(finalRankings) || finalRankings.length === 0) return [];

  const awards = [];
  const winner = finalRankings[0];
  if (winner) {
    const climb = (winner.worstRank || 1) - 1;
    if (climb >= 2) {
      awards.push({
        badge: '🔥 대역전 드라마',
        title: `${winner.name}`,
        desc: `${winner.worstRank}위에서 1위로 기적의 역전 우승!`
      });
    } else {
      awards.push({
        badge: '👑 칼퇴의 제왕',
        title: `${winner.name}`,
        desc: `${winner.finishTime ? winner.finishTime.toFixed(2) : '-'}초 기록으로 압도적 1위 골인!`
      });
    }
  }

  // 최다 추월왕
  const topOvertaker = [...finalRankings].sort((a, b) => (b.overtakes || 0) - (a.overtakes || 0))[0];
  if (topOvertaker && (topOvertaker.overtakes || 0) >= 2) {
    awards.push({
      badge: '⚡ 추월의 지배자',
      title: `${topOvertaker.name}`,
      desc: `경기 중 총 ${topOvertaker.overtakes}회 앞지르기 성공`
    });
  }

  // 최다 피격 동네북
  const topVictim = [...finalRankings].sort((a, b) => (b.hitsTaken || 0) - (a.hitsTaken || 0))[0];
  if (topVictim && (topVictim.hitsTaken || 0) >= 1) {
    awards.push({
      badge: '💥 오늘의 동네북',
      title: `${topVictim.name}`,
      desc: `집중 견제 ${topVictim.hitsTaken}회 피격에도 완주 성공`
    });
  }

  // 철벽 방어왕
  const topDefender = [...finalRankings].sort((a, b) => (b.shieldsBlocked || 0) - (a.shieldsBlocked || 0))[0];
  if (topDefender && (topDefender.shieldsBlocked || 0) >= 1) {
    awards.push({
      badge: '🛡️ 철벽 수호신',
      title: `${topDefender.name}`,
      desc: `결정적 공격 ${topDefender.shieldsBlocked}회 쉴드 완벽 방어`
    });
  }

  return awards.slice(0, 3);
}
