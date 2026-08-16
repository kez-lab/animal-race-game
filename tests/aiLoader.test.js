/**
 * tests/aiLoader.test.js - AILoader 로딩 컨트롤러 및 상태 관리 단위 테스트
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AILoader } from '../js/aiLoader.js';

describe('AILoader', () => {
  it('AILoader.run: DOM 요소가 없는 환경(Node.js 등)에서도 onComplete 콜백을 정상 실행해야 한다', async () => {
    let completed = false;
    await AILoader.run({
      title: '테스트 연산',
      duration: 10,
      onComplete: async () => {
        completed = true;
      }
    });

    assert.equal(completed, true);
  });

  it('setButtonLoading: 버튼의 로딩 상태 토글 및 원본 텍스트 복원이 정상 작동해야 한다', () => {
    const mockButton = {
      innerHTML: '<span>🎲 AI 말 자동 배정</span>',
      disabled: false,
      classList: {
        classes: new Set(),
        add(cls) { this.classes.add(cls); },
        remove(cls) { this.classes.delete(cls); },
        contains(cls) { return this.classes.has(cls); }
      },
      dataset: {}
    };

    // 1. 로딩 시작
    AILoader.setButtonLoading(mockButton, true, 'AI 연산 중...');
    assert.equal(mockButton.disabled, true);
    assert.equal(mockButton.classList.contains('btn-loading'), true);
    assert.ok(mockButton.innerHTML.includes('AI 연산 중...'));
    assert.equal(mockButton.dataset.originalHtml, '<span>🎲 AI 말 자동 배정</span>');

    // 2. 로딩 완료 및 복원
    AILoader.setButtonLoading(mockButton, false);
    assert.equal(mockButton.disabled, false);
    assert.equal(mockButton.classList.contains('btn-loading'), false);
    assert.equal(mockButton.innerHTML, '<span>🎲 AI 말 자동 배정</span>');
  });
});
