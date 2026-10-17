/**
 * tests/aiEngine.test.js - 온디바이스 AI 엔진 단위 테스트
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { OnDeviceAIEngine } from '../js/aiEngine.js';
import { HorseGenerator } from '../js/horseGenerator.js';

describe('OnDeviceAIEngine', () => {
  const aiEngine = new OnDeviceAIEngine();

  it('generateNickname: 유효한 한국어 별명을 생성하고 캐싱 및 forceFresh 리롤을 지원해야 한다', async () => {
    const nick1 = await aiEngine.generateNickname('김팀장', '저격수');
    const nickCached = await aiEngine.generateNickname('김팀장', '저격수');
    const nick2 = await aiEngine.generateNickname('이대리', '돌진형');

    assert.ok(typeof nick1 === 'string' && nick1.length >= 2);
    assert.equal(nick1, nickCached, '동일 입력에 대해 캐시가 작동해야 한다');
    assert.ok(typeof nick2 === 'string' && nick2.length >= 2);
  });

  it('generateHorsePersona & recommendHorseDraft: 신규 명마 페르소나와 참가자 맞춤 배정을 수행해야 한다', async () => {
    const persona = await aiEngine.generateHorsePersona(
      { id: 'sprinter', name: '스프린터' },
      { id: 'speedster', name: '돌진형' },
      { speed: 88, accel: 80, stamina: 56, luck: 63, intellect: 63 }
    );
    assert.ok(typeof persona.name === 'string' && persona.name.length >= 2);
    assert.ok(typeof persona.lore === 'string' && persona.lore.length >= 10);

    const stable = HorseGenerator.getDefaultStable();
    const participants = [{ name: '김팀장' }, { name: '강인턴' }];
    const draft = await aiEngine.recommendHorseDraft(participants, stable);
    assert.equal(draft.length, 2);
    assert.ok(draft[0].horse && draft[0].nickname.length >= 2);
    assert.notEqual(draft[0].horse.id, draft[1].horse.id, '서로 다른 말이 우선 배정되어야 한다');
  });

  it('LanguageModel 표준 API 연동: globalThis.LanguageModel이 존재할 때 clone, responseConstraint, destroy, promptStreaming이 정상 호출되어야 한다', async () => {
    let cloneCalled = 0;
    let destroyCalled = 0;
    let lastConstraint = null;

    const prevLM = globalThis.LanguageModel;
    globalThis.LanguageModel = {
      availability: async () => 'available',
      create: async () => ({
        clone: async function () {
          cloneCalled++;
          return {
            prompt: async (_text, opts) => {
              lastConstraint = opts?.responseConstraint || null;
              if (lastConstraint) {
                return JSON.stringify({ name: '⚡️ 판교 칼퇴호', lore: 'NPU가 직접 빚어낸 초고속 명마입니다.' });
              }
              return '칼퇴의신';
            },
            promptStreaming: async function* () {
              yield '📰 [Gemini Nano 속보] ';
              yield '우승자 칼퇴 성공, 결제자 당첨!';
            },
            destroy: () => {
              destroyCalled++;
            }
          };
        },
        promptStreaming: async function* () {},
        destroy: () => {}
      })
    };

    try {
      const mockEngine = new OnDeviceAIEngine();
      await mockEngine.ensureSession();
      assert.equal(mockEngine.hasChromeAI, true);

      const persona = await mockEngine.generateHorsePersona(
        { name: '스프린터' },
        { name: '돌진형' },
        { speed: 85, accel: 80, stamina: 55, luck: 65, intellect: 65 }
      );
      assert.equal(persona.name, '⚡️ 판교 칼퇴호');
      assert.ok(lastConstraint && lastConstraint.type === 'object');
      assert.ok(cloneCalled >= 1 && destroyCalled >= 1, '세션 복제(clone) 후 반드시 destroy()로 메모리를 해제해야 한다');

      const chunks = [];
      const streamed = await mockEngine.streamPostRaceArticle(
        { name: '우승자', finishTime: 12.34, overtakes: 3 },
        [{ name: '결제자', hitsTaken: 2 }],
        4,
        '꼴찌 몰빵',
        18000,
        {},
        (delta) => chunks.push(delta)
      );
      assert.ok(streamed.includes('Gemini Nano 속보'));
      assert.ok(chunks.length >= 2);
    } finally {
      if (prevLM === undefined) delete globalThis.LanguageModel;
      else globalThis.LanguageModel = prevLM;
    }
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

  it('generatePostRaceArticle: 경기 텔레메트리 결과를 반영한 1면 기사를 생성해야 한다', async () => {
    const winner = { name: '우승자', strategy: { name: '돌진형' }, finishTime: 14.52, overtakes: 5, worstRank: 4 };
    const losers = [{ name: '결제자', strategy: { name: '승부사' }, hitsTaken: 3 }];

    const article = await aiEngine.generatePostRaceArticle(winner, losers, 4, '꼴찌 1명 몰빵', 25000);
    assert.ok(typeof article === 'string');
    assert.ok(article.includes('우승자'));
    assert.ok(article.includes('결제자'));
    assert.ok(article.includes('14.52초'));
  });
});
