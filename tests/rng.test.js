/**
 * tests/rng.test.js - 결정적 시드 기반 PRNG 및 시드 코드 변환 단위 테스트
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRng, seedToCode, codeToSeed, deriveSeed } from '../js/rng.js';

describe('Deterministic RNG (rng.js)', () => {
  it('동일한 시드로 생성한 두 PRNG는 완벽히 동일한 난수 시퀀스를 반환해야 한다', () => {
    const rng1 = createRng(123456789);
    const rng2 = createRng(123456789);

    for (let i = 0; i < 50; i++) {
      assert.equal(rng1(), rng2());
    }
  });

  it('seedToCode & codeToSeed: 32비트 시드와 문자열 코드가 양방향으로 정확히 복원되어야 한다', () => {
    const originalSeed = 0xDEADBEEF >>> 0;
    const code = seedToCode(originalSeed);
    const restored = codeToSeed(code);

    assert.equal(restored, originalSeed);
    assert.equal(codeToSeed('invalid_code_!!!'), null);
  });

  it('deriveSeed: 같은 마스터 시드와 솔트 조합은 항상 동일한 파생 시드를 반환해야 한다', () => {
    const s1 = deriveSeed(99999, 1);
    const s2 = deriveSeed(99999, 1);
    const s3 = deriveSeed(99999, 2);

    assert.equal(s1, s2);
    assert.notEqual(s1, s3);
  });
});
