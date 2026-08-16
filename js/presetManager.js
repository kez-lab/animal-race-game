/**
 * presetManager.js - 참가자 프리셋 관리 및 로컬 스토리지 직렬화 순수 로직 모듈 (테스터블 모듈)
 */

import { DEFAULT_PRESETS, HORSE_COLORS, OFFICE_NICKNAMES, AI_STRATEGIES } from './presets.js';

export const STORAGE_KEYS = {
  PARTICIPANTS: 'office_derby_participants',
  PRESETS: 'office_derby_custom_presets'
};

export class PresetManager {
  /**
   * 스토리지에서 프리셋 목록 로드 (실패 시 기본값 반환)
   */
  static loadPresets(storage = globalThis.localStorage) {
    if (!storage) return [...DEFAULT_PRESETS];
    try {
      const data = storage.getItem(STORAGE_KEYS.PRESETS);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to load presets from storage', e);
    }
    return [...DEFAULT_PRESETS];
  }

  /**
   * 프리셋 목록을 스토리지에 저장
   */
  static savePresets(presets, storage = globalThis.localStorage) {
    if (!storage || !Array.isArray(presets)) return false;
    try {
      storage.setItem(STORAGE_KEYS.PRESETS, JSON.stringify(presets));
      return true;
    } catch (e) {
      console.warn('Failed to save presets to storage', e);
      return false;
    }
  }

  /**
   * 새 커스텀 프리셋 추가
   */
  static addPreset(presets, name, members) {
    if (!name || !name.trim() || !Array.isArray(members) || members.length === 0) {
      throw new Error('유효한 프리셋 이름과 1명 이상의 멤버가 필요합니다.');
    }

    const newPreset = {
      id: `custom_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      name: name.trim(),
      members: members.map(m => (typeof m === 'string' ? m : m.name)).filter(Boolean)
    };

    const updated = [...presets, newPreset];
    return { newPreset, updated };
  }

  /**
   * 프리셋 삭제
   */
  static deletePreset(presets, indexOrId) {
    if (typeof indexOrId === 'number') {
      return presets.filter((_, idx) => idx !== indexOrId);
    }
    return presets.filter(p => p.id !== indexOrId);
  }

  /**
   * 프리셋 멤버 목록을 레이스 참가자 데이터 객체 배열로 변환
   */
  static createParticipantsFromPreset(preset) {
    if (!preset || !Array.isArray(preset.members)) return [];

    return preset.members.map((name, idx) => {
      const color = HORSE_COLORS[idx % HORSE_COLORS.length];
      const nickname = OFFICE_NICKNAMES[idx % OFFICE_NICKNAMES.length];
      const strategy = AI_STRATEGIES[idx % AI_STRATEGIES.length];
      return {
        id: idx + 1,
        name: typeof name === 'string' ? name : name.name,
        nickname,
        color,
        strategy
      };
    });
  }
}
