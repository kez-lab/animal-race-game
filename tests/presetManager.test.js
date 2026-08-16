/**
 * tests/presetManager.test.js - 프리셋 저장, 불러오기 및 직렬화 단위 테스트
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PresetManager, STORAGE_KEYS } from '../js/presetManager.js';

describe('PresetManager', () => {
  const createMockStorage = (initialData = {}) => {
    const store = { ...initialData };
    return {
      getItem: (key) => store[key] || null,
      setItem: (key, val) => { store[key] = String(val); },
      removeItem: (key) => { delete store[key]; }
    };
  };

  it('loadPresets: 스토리지에 데이터가 없으면 빈 프리셋 배열([])을 반환해야 한다', () => {
    const storage = createMockStorage();
    const presets = PresetManager.loadPresets(storage);
    assert.ok(Array.isArray(presets));
    assert.equal(presets.length, 0);
  });

  it('addPreset & savePresets: 새 프리셋을 추가하고 스토리지에 정상 저장할 수 있어야 한다', () => {
    const storage = createMockStorage();
    const presets = PresetManager.loadPresets(storage);

    const { newPreset, updated } = PresetManager.addPreset(presets, '디자인팀 (3인)', ['디자이너A', '디자이너B', '디자이너C']);
    assert.equal(newPreset.name, '디자인팀 (3인)');
    assert.equal(updated.length, presets.length + 1);

    const saveOk = PresetManager.savePresets(updated, storage);
    assert.equal(saveOk, true);

    const reloaded = PresetManager.loadPresets(storage);
    assert.equal(reloaded.length, presets.length + 1);
    assert.equal(reloaded[reloaded.length - 1].name, '디자인팀 (3인)');
  });

  it('deletePreset: 인덱스 또는 ID로 프리셋을 삭제할 수 있어야 한다', () => {
    const presets = [
      { id: 'p1', name: '팀1', members: ['A', 'B'] },
      { id: 'p2', name: '팀2', members: ['C', 'D'] }
    ];

    const afterDeleteId = PresetManager.deletePreset(presets, 'p1');
    assert.equal(afterDeleteId.length, 1);
    assert.equal(afterDeleteId[0].id, 'p2');

    const afterDeleteIdx = PresetManager.deletePreset(presets, 0);
    assert.equal(afterDeleteIdx.length, 1);
    assert.equal(afterDeleteIdx[0].id, 'p2');
  });

  it('createParticipantsFromPreset: 프리셋 멤버를 색상/닉네임/AI전략이 포함된 참가자 객체로 변환해야 한다', () => {
    const preset = {
      id: 'test_p',
      name: '테스트팀',
      members: ['김철수', '이영희']
    };

    const participants = PresetManager.createParticipantsFromPreset(preset);
    assert.equal(participants.length, 2);
    assert.equal(participants[0].name, '김철수');
    assert.ok(participants[0].color);
    assert.ok(participants[0].nickname);
    assert.ok(participants[0].strategy);
  });
});
