/**
 * rng.js - 시드 기반 결정적 난수 생성기 (Deterministic Seeded PRNG)
 *
 * 같은 시드 + 같은 참가자 + 같은 설정이면 어느 기기에서든 100% 동일한 경기가 재현됩니다.
 * (고정 타임스텝 엔진과 함께 사용해야 결정성이 보장됨 — raceEngine.js 참고)
 */

/**
 * mulberry32: 32비트 시드 기반의 빠르고 분포가 고른 PRNG
 * @param {number} seed - 32비트 정수 시드
 * @returns {() => number} [0, 1) 범위의 난수를 반환하는 함수
 */
export function createRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 새로운 무작위 32비트 시드 생성 (가능하면 crypto 사용)
 */
export function randomSeed() {
  const c = globalThis.crypto;
  if (c && typeof c.getRandomValues === 'function') {
    return c.getRandomValues(new Uint32Array(1))[0] >>> 0;
  }
  return Math.floor(Math.random() * 4294967296) >>> 0;
}

/**
 * 시드를 사람이 읽기 쉬운 코드로 변환 (예: 3735928559 -> "1TJ3JK")
 */
export function seedToCode(seed) {
  return (seed >>> 0).toString(36).toUpperCase().padStart(6, '0');
}

/**
 * 시드 코드를 다시 숫자 시드로 변환. 잘못된 코드면 null 반환
 */
export function codeToSeed(code) {
  if (typeof code !== 'string' || !/^[0-9a-zA-Z]{1,7}$/.test(code)) return null;
  const n = parseInt(code, 36);
  if (!Number.isFinite(n) || n < 0 || n > 0xFFFFFFFF) return null;
  return n >>> 0;
}

/**
 * 하나의 마스터 시드에서 용도별 독립 시드를 파생 (예: 경기용 / 커피 메뉴 추첨용)
 */
export function deriveSeed(seed, salt) {
  let h = (seed ^ Math.imul(salt + 0x9E3779B9, 0x85EBCA6B)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7FEB352D) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x846CA68B) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}
