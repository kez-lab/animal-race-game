/**
 * tests/aiEngine.test.js - 온디바이스 AI 엔진 단위 테스트
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { OnDeviceAIEngine } from '../js/aiEngine.js';

describe('OnDeviceAIEngine', () => {
  const aiEngine = new OnDeviceAIEngine();

  it('generateNickname: 유효한 한국어 별명을 생성해야 한다', async () => {
    const nick1 = await aiEngine.generateNickname('김팀장', '저격수');
    const nick2 = await aiEngine.generateNickname('이대리', '돌진형');

    assert.ok(typeof nick1 === 'string' && nick1.length >= 2);
    assert.ok(typeof nick2 === 'string' && nick2.length >= 2);
  });

  it('generateLiveCommentary: 이벤트 타입별로 말 이름과 전략이 포함된 해설 멘트 배열을 생성해야 한다', () => {
    const mockHorse = {
      name: '홍길동',
      nickname: '칼퇴요정',
      strategy: { name: '저격수' },
      rank: 2
    };

    const missileComments = aiEngine.generateLiveCommentary('itemUseMissile', mockHorse, { target: { name: '김팀장' } });
    assert.ok(Array.isArray(missileComments) && missileComments.length > 0);
    assert.ok(missileComments[0].includes('홍길동'));

    const shieldComments = aiEngine.generateLiveCommentary('shieldBlock', mockHorse);
    assert.ok(Array.isArray(shieldComments) && shieldComments.length > 0);
    assert.ok(shieldComments[0].includes('홍길동'));
  });

  it('generatePostRaceArticle: 경기 결과를 반영한 1면 기사를 생성해야 한다', async () => {
    const winner = { name: '우승자', strategy: { name: '돌진형' } };
    const losers = [{ name: '결제자', strategy: { name: '승부사' } }];

    const article = await aiEngine.generatePostRaceArticle(winner, losers, 4, '꼴찌 1명 몰빵', 25000);
    assert.ok(typeof article === 'string');
    assert.ok(article.includes('우승자'));
    assert.ok(article.includes('결제자'));
  });
});
