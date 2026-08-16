/**
 * app.js - 오피스 더비 메인 애플리케이션 라이프사이클 및 UI 제어
 * 아이템전 모드 및 로컬 스토리지 기반 커스텀 프리셋 관리 지원
 */

import { HORSE_COLORS, OFFICE_NICKNAMES, DEFAULT_PRESETS, AI_STRATEGIES, COFFEE_MENUS, FUNNY_RECEIPT_NOTES } from './presets.js';
import { sound } from './sound.js';
import { aiEngine } from './aiEngine.js';
import { calculatePenaltyHorses, calculateEstimatedPrice, RULE_DESCRIPTIONS } from './penalty.js';
import { PresetManager, STORAGE_KEYS } from './presetManager.js';
import { HorseGenerator } from './horseGenerator.js';
import { RaceEngine } from './raceEngine.js';
import { CanvasRenderer } from './canvasRenderer.js';
import { Commentator } from './commentator.js';

class OfficeDerbyApp {
  constructor() {
    this.participants = [];
    this.customPresets = [];
    this.stableHorses = HorseGenerator.getDefaultStable();
    this.currentDraftingIndex = null;
    this.selectedDistance = 1600;
    this.selectedGameMode = 'item'; // 'item' | 'speed'
    this.selectedRule = 'last1';
    this.includeCoffeeMenu = true;
    this.isMuted = false;

    // 엔진 & 렌더러
    this.engine = null;
    this.renderer = null;
    this.commentator = null;
    this.animFrameId = null;
    this.lastFrameTime = 0;
    this.timeScale = 1.0;

    this.initDOMElements();
    this.loadInitialData();
    this.bindEvents();
  }

  initDOMElements() {
    // 뷰 섹션
    this.setupView = document.getElementById('setupView');
    this.raceView = document.getElementById('raceView');
    this.resultModal = document.getElementById('resultModal');
    this.helpModal = document.getElementById('helpModal');

    // 설정 화면 요소
    this.presetChipsContainer = document.getElementById('presetChipsContainer');
    this.saveCurrentPresetBtn = document.getElementById('saveCurrentPresetBtn');
    this.participantInput = document.getElementById('participantInput');
    this.addParticipantForm = document.getElementById('addParticipantForm');
    this.bulkInput = document.getElementById('bulkInput');
    this.bulkAddBtn = document.getElementById('bulkAddBtn');
    this.participantListEl = document.getElementById('participantList');
    this.participantCountEl = document.getElementById('participantCount');
    this.clearAllBtn = document.getElementById('clearAllBtn');
    this.aiRerollNicknamesBtn = document.getElementById('aiRerollNicknamesBtn');
    this.aiAutoDraftHorsesBtn = document.getElementById('aiAutoDraftHorsesBtn');
    this.startRaceBtn = document.getElementById('startRaceBtn');
    this.randomCoffeeMenuCheck = document.getElementById('randomCoffeeMenuCheck');

    // 마구간 드래프트 모달
    this.horseDraftModal = document.getElementById('horseDraftModal');
    this.draftModalSubtitle = document.getElementById('draftModalSubtitle');
    this.generateNewAIHorseBtn = document.getElementById('generateNewAIHorseBtn');
    this.stableHorseGrid = document.getElementById('stableHorseGrid');
    this.closeDraftModalBtn = document.getElementById('closeDraftModalBtn');

    // 레이스 화면 요소
    this.raceCanvas = document.getElementById('raceCanvas');
    this.raceDistanceBadge = document.getElementById('raceDistanceBadge');
    this.raceTimerDisplay = document.getElementById('raceTimerDisplay');
    this.pauseRaceBtn = document.getElementById('pauseRaceBtn');
    this.speedRaceBtn = document.getElementById('speedRaceBtn');
    this.skipRaceBtn = document.getElementById('skipRaceBtn');
    this.miniTrack = document.getElementById('miniTrack');
    this.commentList = document.getElementById('commentList');
    this.liveRankList = document.getElementById('liveRankList');

    // 결과 모달 요소
    this.podiumName1 = document.getElementById('podiumName1');
    this.podiumName2 = document.getElementById('podiumName2');
    this.podiumName3 = document.getElementById('podiumName3');
    this.aiArticleContent = document.getElementById('aiArticleContent');
    this.receiptPayerName = document.getElementById('receiptPayerName');
    this.receiptRuleDesc = document.getElementById('receiptRuleDesc');
    this.receiptDate = document.getElementById('receiptDate');
    this.receiptMenuItems = document.getElementById('receiptMenuItems');
    this.receiptTotalAmount = document.getElementById('receiptTotalAmount');
    this.receiptFooterNotes = document.getElementById('receiptFooterNotes');
    this.modalRankList = document.getElementById('modalRankList');
    this.copyResultBtn = document.getElementById('copyResultBtn');
    this.rematchBtn = document.getElementById('rematchBtn');
    this.backToSetupBtn = document.getElementById('backToSetupBtn');

    // 헤더 및 모달 버튼
    this.soundToggleBtn = document.getElementById('soundToggleBtn');
    this.helpBtn = document.getElementById('helpBtn');
    this.closeHelpBtn = document.getElementById('closeHelpBtn');
    this.toast = document.getElementById('toast');
    this.toastText = document.getElementById('toastText');
  }

  loadInitialData() {
    // 1. 프리셋 로드 (로컬 스토리지 우선)
    this.customPresets = PresetManager.loadPresets();
    this.renderPresetChips();

    // 2. 참가자 목록 로드
    const savedParticipants = localStorage.getItem(STORAGE_KEYS.PARTICIPANTS);
    if (savedParticipants) {
      try {
        const parsed = JSON.parse(savedParticipants);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.participants = parsed.map((p, idx) => ({
            ...p,
            strategy: p.strategy || AI_STRATEGIES[idx % AI_STRATEGIES.length]
          }));
        }
      } catch (e) {
        console.warn('Failed to parse saved participants', e);
      }
    }

    if (this.participants.length === 0) {
      if (this.customPresets.length > 0) {
        this.applyPreset(this.customPresets[0]);
      }
    } else {
      this.renderParticipantList();
    }

    // 엔진 & 렌더러 생성
    this.commentator = new Commentator(this.commentList);
    this.renderer = new CanvasRenderer(this.raceCanvas);
    this.engine = new RaceEngine({
      gameMode: this.selectedGameMode,
      onTick: (data) => this.onEngineTick(data),
      onEvent: (type, horse, info) => this.onEngineEvent(type, horse, info),
      onLeadChange: (newLeader, oldLeader) => this.onEngineLeadChange(newLeader, oldLeader),
      onHorseFinished: (horse, rank) => this.onEngineHorseFinished(horse, rank),
      onAllFinished: (horses) => this.onEngineAllFinished(horses)
    });
  }

  saveParticipants() {
    try {
      localStorage.setItem(STORAGE_KEYS.PARTICIPANTS, JSON.stringify(this.participants));
    } catch (e) {}
  }

  savePresets() {
    PresetManager.savePresets(this.customPresets);
    this.renderPresetChips();
  }

  renderPresetChips() {
    if (!this.presetChipsContainer) return;

    if (this.customPresets.length === 0) {
      this.presetChipsContainer.innerHTML = `
        <span style="font-size: 11px; color: var(--text-muted);">저장된 프리셋이 없습니다.</span>
      `;
      return;
    }

    this.presetChipsContainer.innerHTML = this.customPresets.map((preset, idx) => `
      <div class="preset-chip" data-id="${preset.id || idx}">
        <span class="preset-chip-title" data-index="${idx}">${preset.name}</span>
        <button type="button" class="preset-chip-del" data-index="${idx}" title="프리셋 삭제">✕</button>
      </div>
    `).join('');

    this.presetChipsContainer.querySelectorAll('.preset-chip-title').forEach(el => {
      el.addEventListener('click', (e) => {
        const index = parseInt(e.currentTarget.dataset.index, 10);
        this.applyPreset(this.customPresets[index]);
      });
    });

    this.presetChipsContainer.querySelectorAll('.preset-chip-del').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const index = parseInt(e.currentTarget.dataset.index, 10);
        const target = this.customPresets[index];
        if (confirm(`'${target.name}' 프리셋을 삭제하시겠습니까?`)) {
          this.customPresets.splice(index, 1);
          this.savePresets();
          this.showToast('프리셋이 삭제되었습니다.');
        }
      });
    });
  }

  applyPreset(preset) {
    if (!preset || !preset.members) return;

    this.participants = preset.members.map((name, idx) => {
      const color = HORSE_COLORS[idx % HORSE_COLORS.length];
      const nickname = OFFICE_NICKNAMES[idx % OFFICE_NICKNAMES.length];
      const defaultHorse = this.stableHorses[idx % this.stableHorses.length];
      const strategy = defaultHorse ? defaultHorse.strategy : AI_STRATEGIES[idx % AI_STRATEGIES.length];
      const horseName = defaultHorse ? defaultHorse.name : `${name}의 명마`;
      const stats = defaultHorse ? { ...defaultHorse.stats } : HorseGenerator.generateBalancedStats();

      return {
        id: idx + 1,
        name,
        nickname,
        horseName,
        color,
        strategy,
        stats
      };
    });

    this.renderParticipantList();
    this.saveParticipants();
    this.showToast(`'${preset.name}' 명단 및 경주마가 불러와졌습니다.`);
    sound.playClick();
  }

  bindEvents() {
    // 1. 현재 명단 프리셋으로 저장
    this.saveCurrentPresetBtn.addEventListener('click', () => {
      if (this.participants.length === 0) {
        alert('저장할 참가자가 없습니다. 팀원 이름을 먼저 추가해주세요!');
        return;
      }

      const defaultName = `내 팀 (${this.participants.length}인)`;
      const presetName = prompt('저장할 프리셋 이름을 입력하세요:', defaultName);
      if (!presetName || !presetName.trim()) return;

      const newPreset = {
        id: `custom_${Date.now()}`,
        name: presetName.trim(),
        members: this.participants.map(p => p.name)
      };

      this.customPresets.push(newPreset);
      this.savePresets();
      this.showToast(`'${newPreset.name}' 프리셋이 저장되었습니다! 💾`);
      sound.playClick();
    });

    // 2. 단일 참가자 추가
    this.addParticipantForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = this.participantInput.value.trim();
      if (!name) return;
      this.addSingleParticipant(name);
      this.participantInput.value = '';
      this.participantInput.focus();
    });

    // 3. 대량 붙여넣기 추가
    this.bulkAddBtn.addEventListener('click', () => {
      const text = this.bulkInput.value.trim();
      if (!text) return;
      const names = text.split(/[\n,]+/).map(n => n.trim()).filter(n => n.length > 0);
      names.forEach(name => this.addSingleParticipant(name));
      this.bulkInput.value = '';
      this.showToast(`${names.length}명의 참가자가 추가되었습니다.`);
    });

    // 4. 전체 삭제
    this.clearAllBtn.addEventListener('click', () => {
      if (this.participants.length === 0) return;
      if (confirm('참가자 목록을 모두 삭제하시겠습니까?')) {
        this.participants = [];
        this.renderParticipantList();
        this.saveParticipants();
      }
    });

    // 4.5. 온디바이스 AI 별명 일괄 생성
    this.aiRerollNicknamesBtn.addEventListener('click', () => {
      this.rerollAllAINicknames();
    });

    // 4.6. 온디바이스 AI 밸런스마 전원 자동 배정
    this.aiAutoDraftHorsesBtn.addEventListener('click', () => {
      this.autoDraftHorsesForAllParticipants();
    });

    // 4.7. 마구간 모달 제어
    this.generateNewAIHorseBtn.addEventListener('click', () => {
      this.generateNewAIHorseForStable();
    });
    this.closeDraftModalBtn.addEventListener('click', () => {
      this.horseDraftModal.classList.remove('active');
    });
    this.horseDraftModal.addEventListener('click', (e) => {
      if (e.target === this.horseDraftModal) this.horseDraftModal.classList.remove('active');
    });

    // 5. 게임 모드 라디오 카드 (아이템전 vs 스피드전)
    document.querySelectorAll('input[name="gameMode"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        this.selectedGameMode = e.target.value;
        const parentRuleGroup = e.target.closest('.rule-group');
        parentRuleGroup.querySelectorAll('.radio-card').forEach(card => card.classList.remove('active'));
        e.target.closest('.radio-card').classList.add('active');
        sound.playClick();
      });
    });

    // 6. 벌칙 룰 선택 라디오 카드
    document.querySelectorAll('input[name="penaltyRule"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        this.selectedRule = e.target.value;
        const parentRuleGroup = e.target.closest('.rule-group');
        parentRuleGroup.querySelectorAll('.radio-card').forEach(card => card.classList.remove('active'));
        e.target.closest('.radio-card').classList.add('active');
        sound.playClick();
      });
    });

    // 7. 거리 선택 버튼
    document.querySelectorAll('.distance-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.distance-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.selectedDistance = parseInt(btn.dataset.distance, 10);
        sound.playClick();
      });
    });

    // 8. 커피 메뉴 체크박스
    this.randomCoffeeMenuCheck.addEventListener('change', (e) => {
      this.includeCoffeeMenu = e.target.checked;
    });

    // 9. 레이스 시작 버튼
    this.startRaceBtn.addEventListener('click', () => {
      if (this.participants.length < 2) {
        alert('경기를 진행하려면 최소 2명 이상의 참가자가 필요합니다!');
        this.participantInput.focus();
        return;
      }
      this.startRace();
    });

    // 10. 레이스 컨트롤
    this.pauseRaceBtn.addEventListener('click', () => {
      if (!this.engine) return;
      if (this.engine.isPaused) {
        this.engine.resume();
        this.pauseRaceBtn.innerHTML = '⏸️ 일시정지';
        this.pauseRaceBtn.classList.remove('active');
      } else {
        this.engine.pause();
        this.pauseRaceBtn.innerHTML = '▶️ 재개';
        this.pauseRaceBtn.classList.add('active');
      }
      sound.playClick();
    });

    this.speedRaceBtn.addEventListener('click', () => {
      if (this.timeScale === 1.0) {
        this.timeScale = 1.5;
        this.speedRaceBtn.innerHTML = '⏩ 1.5x';
        this.speedRaceBtn.classList.add('active');
      } else if (this.timeScale === 1.5) {
        this.timeScale = 2.0;
        this.speedRaceBtn.innerHTML = '⚡️ 2.0x';
        this.speedRaceBtn.classList.add('active');
      } else {
        this.timeScale = 1.0;
        this.speedRaceBtn.innerHTML = '⏩ 1.0x';
        this.speedRaceBtn.classList.remove('active');
      }
      if (this.engine) this.engine.setTimeScale(this.timeScale);
      sound.playClick();
    });

    this.skipRaceBtn.addEventListener('click', () => {
      if (this.engine && this.engine.isRunning) {
        this.engine.fastForwardToEnd();
        sound.playClick();
      }
    });

    // 11. 사운드 토글
    this.soundToggleBtn.addEventListener('click', () => {
      this.isMuted = !this.isMuted;
      sound.setMute(this.isMuted);
      this.soundToggleBtn.innerHTML = this.isMuted ? '🔇' : '🔊';
      this.soundToggleBtn.classList.toggle('active', this.isMuted);
    });

    // 12. 도움말 모달
    this.helpBtn.addEventListener('click', () => {
      this.helpModal.classList.add('active');
    });
    this.closeHelpBtn.addEventListener('click', () => {
      this.helpModal.classList.remove('active');
    });
    this.helpModal.addEventListener('click', (e) => {
      if (e.target === this.helpModal) this.helpModal.classList.remove('active');
    });

    // 13. 결과 모달 액션들
    this.copyResultBtn.addEventListener('click', () => {
      this.copyFormattedResultToClipboard();
    });

    this.rematchBtn.addEventListener('click', () => {
      this.resultModal.classList.remove('active');
      this.startRace();
    });

    this.backToSetupBtn.addEventListener('click', () => {
      this.resultModal.classList.remove('active');
      this.switchView('setup');
      sound.stopGallopRhythm();
    });
  }

  async rerollAllAINicknames() {
    if (this.participants.length === 0) {
      alert('참가자를 먼저 추가해주세요!');
      return;
    }
    this.showToast('🧠 온디바이스 AI가 참가자 맞춤형 별명을 생성 중입니다...');
    for (let i = 0; i < this.participants.length; i++) {
      const p = this.participants[i];
      const stratName = p.strategy ? p.strategy.name : '돌진';
      p.nickname = await aiEngine.generateNickname(p.name, stratName);
    }
    this.renderParticipantList();
    this.saveParticipants();
    this.showToast('✨ 모든 참가자의 AI 별명이 생성되었습니다!');
    sound.playClick();
  }

  async addSingleParticipant(name) {
    if (this.participants.length >= 12) {
      alert('참가자는 최대 12명까지 등록 가능합니다.');
      return;
    }

    const idx = this.participants.length;
    const color = HORSE_COLORS[idx % HORSE_COLORS.length];
    const defaultHorse = this.stableHorses[idx % this.stableHorses.length];
    const strategy = defaultHorse ? defaultHorse.strategy : AI_STRATEGIES[idx % AI_STRATEGIES.length];
    const aiNick = await aiEngine.generateNickname(name, strategy.name);

    this.participants.push({
      id: Date.now() + Math.floor(Math.random() * 1000),
      name: name.slice(0, 12),
      nickname: aiNick,
      horseName: defaultHorse ? defaultHorse.name : `${name}의 명마`,
      color: color,
      strategy: strategy,
      stats: defaultHorse ? { ...defaultHorse.stats } : HorseGenerator.generateBalancedStats()
    });

    this.renderParticipantList();
    this.saveParticipants();
    sound.playClick();
  }

  cycleHorseAIStrategy(index) {
    const horse = this.participants[index];
    if (!horse) return;

    const currentStratId = horse.strategy ? horse.strategy.id : 'speedster';
    const currentIdx = AI_STRATEGIES.findIndex(s => s.id === currentStratId);
    const nextStrat = AI_STRATEGIES[(currentIdx + 1) % AI_STRATEGIES.length];

    horse.strategy = nextStrat;
    this.renderParticipantList();
    this.saveParticipants();
    this.showToast(`🧠 [${horse.name}] AI 성향: '${nextStrat.icon} ${nextStrat.name}' (${nextStrat.tag})`);
    sound.playClick();
  }

  removeParticipant(index) {
    this.participants.splice(index, 1);
    this.participants.forEach((p, idx) => {
      p.color = HORSE_COLORS[idx % HORSE_COLORS.length];
    });
    this.renderParticipantList();
    this.saveParticipants();
    sound.playClick();
  }

  renderParticipantList() {
    this.participantCountEl.textContent = `${this.participants.length}명`;

    if (this.participants.length === 0) {
      this.participantListEl.innerHTML = `
        <div style="text-align: center; padding: 28px 10px; color: var(--text-muted); font-size: 13px;">
          등록된 참가자가 없습니다.<br>팀원 이름을 입력하거나 상단 프리셋을 선택해보세요!
        </div>
      `;
      return;
    }

    this.participantListEl.innerHTML = this.participants.map((p, idx) => {
      const strat = p.strategy || AI_STRATEGIES[idx % AI_STRATEGIES.length];
      const stats = p.stats || { speed: 70, accel: 70, stamina: 70, luck: 70, intellect: 70 };
      const horseName = p.horseName || `${p.name}의 말`;

      return `
        <div class="participant-item">
          <div class="horse-info">
            <div class="horse-number-badge" style="background: ${p.color.body}; border: 2px solid ${p.color.border};">
              ${idx + 1}
            </div>
            <div class="horse-meta">
              <div class="horse-name-row">
                <span class="horse-name">${p.name}</span>
                <button type="button" class="horse-draft-badge" data-index="${idx}" title="전용 경주마 선택 및 능력치 보기" style="background: rgba(6, 182, 212, 0.12); border: 1px solid rgba(6, 182, 212, 0.35); color: var(--accent-cyan); font-size: 11px; padding: 2px 7px; border-radius: 12px; cursor: pointer; display: flex; align-items: center; gap: 4px; font-weight: 600;">
                  🏇 ${horseName} <span style="font-size: 10px; color: var(--text-muted);">(⚡️${stats.speed} 🚀${stats.accel} 🔋${stats.stamina})</span>
                </button>
                <button type="button" class="horse-ai-btn" data-index="${idx}" title="${strat.desc}">
                  ${strat.icon} ${strat.name}
                </button>
              </div>
              <div class="horse-sub-row">
                <span class="horse-nick">#${p.nickname}</span>
              </div>
            </div>
          </div>
          <button class="delete-btn" data-index="${idx}" title="삭제">✕</button>
        </div>
      `;
    }).join('');

    // 이벤트 바인딩
    this.participantListEl.querySelectorAll('.horse-draft-badge').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.currentTarget.dataset.index, 10);
        this.openHorseDraftModal(index);
      });
    });

    this.participantListEl.querySelectorAll('.horse-ai-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.currentTarget.dataset.index, 10);
        this.cycleHorseAIStrategy(index);
      });
    });

    this.participantListEl.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.currentTarget.dataset.index, 10);
        this.removeParticipant(index);
      });
    });
  }

  openHorseDraftModal(participantIndex) {
    this.currentDraftingIndex = participantIndex;
    const participant = this.participants[participantIndex];
    if (!participant) return;

    this.draftModalSubtitle.innerHTML = `<strong>[${participant.name}]</strong> 님의 전용 경주마를 선택하거나 새 AI 밸런스마를 분양받으세요.`;
    this.renderStableGrid();
    this.horseDraftModal.classList.add('active');
    sound.playClick();
  }

  renderStableGrid() {
    const currentParticipant = this.participants[this.currentDraftingIndex];
    const currentHorseName = currentParticipant ? currentParticipant.horseName : '';

    this.stableHorseGrid.innerHTML = this.stableHorses.map((horse, idx) => {
      const isSelected = currentHorseName === horse.name;
      const stats = horse.stats;
      const strat = horse.strategy || AI_STRATEGIES[0];

      return `
        <div class="stable-horse-card ${isSelected ? 'selected' : ''}">
          <div class="horse-card-header">
            <div class="horse-silk-badge" style="background: ${horse.color.body}; border-color: ${horse.color.border}; color: ${horse.color.num};">
              🏇
            </div>
            <div class="horse-card-info">
              <div class="horse-card-name" title="${horse.name}">${horse.name}</div>
              <div class="horse-card-title">${horse.title} | ${strat.icon} ${strat.name}</div>
            </div>
          </div>

          <div class="horse-card-lore">
            "${horse.lore}"
          </div>

          <div class="stat-bars-container">
            <div class="stat-row">
              <span class="stat-label">⚡️ 최고속도</span>
              <div class="stat-bar-track"><div class="stat-bar-fill" style="width: ${(stats.speed / 100) * 100}%; background: #EF4444;"></div></div>
              <span class="stat-val">${stats.speed}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">🚀 가속력</span>
              <div class="stat-bar-track"><div class="stat-bar-fill" style="width: ${(stats.accel / 100) * 100}%; background: #F59E0B;"></div></div>
              <span class="stat-val">${stats.accel}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">🔋 지구력</span>
              <div class="stat-bar-track"><div class="stat-bar-fill" style="width: ${(stats.stamina / 100) * 100}%; background: #10B981;"></div></div>
              <span class="stat-val">${stats.stamina}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">🍀 행운</span>
              <div class="stat-bar-track"><div class="stat-bar-fill" style="width: ${(stats.luck / 100) * 100}%; background: #8B5CF6;"></div></div>
              <span class="stat-val">${stats.luck}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">🧠 지능</span>
              <div class="stat-bar-track"><div class="stat-bar-fill" style="width: ${(stats.intellect / 100) * 100}%; background: #06B6D4;"></div></div>
              <span class="stat-val">${stats.intellect}</span>
            </div>
          </div>

          <button type="button" class="horse-select-btn" data-index="${idx}">
            ${isSelected ? '✅ 현재 선택됨' : '🏇 이 말로 출전하기'}
          </button>
        </div>
      `;
    }).join('');

    this.stableHorseGrid.querySelectorAll('.horse-select-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const hIdx = parseInt(e.currentTarget.dataset.index, 10);
        this.selectHorseForParticipant(this.stableHorses[hIdx]);
      });
    });
  }

  selectHorseForParticipant(horse) {
    if (this.currentDraftingIndex === null) return;
    const participant = this.participants[this.currentDraftingIndex];
    if (!participant) return;

    participant.horseName = horse.name;
    participant.strategy = horse.strategy;
    participant.stats = { ...horse.stats };
    if (horse.color) participant.color = horse.color;

    this.horseDraftModal.classList.remove('active');
    this.renderParticipantList();
    this.saveParticipants();
    this.showToast(`🏇 [${participant.name}] 님의 경주마가 '${horse.name}' (으)로 변경되었습니다!`);
    sound.playClick();
  }

  async generateNewAIHorseForStable() {
    this.showToast('🧠 온디바이스 AI가 350pt 밸런스 경주마를 창조 중입니다...');
    const newHorse = await HorseGenerator.generateAIHorse();
    this.stableHorses.unshift(newHorse);
    this.renderStableGrid();
    this.showToast(`✨ 새 명마 '${newHorse.name}' 이(가) 마구간에 입사했습니다!`);
    sound.playClick();
  }

  autoDraftHorsesForAllParticipants() {
    if (this.participants.length === 0) {
      alert('참가자를 먼저 추가해주세요!');
      return;
    }

    // 셔플된 마구간 말들을 각 참가자에게 배정
    const shuffled = [...this.stableHorses].sort(() => Math.random() - 0.5);
    this.participants.forEach((p, idx) => {
      const horse = shuffled[idx % shuffled.length];
      p.horseName = horse.name;
      p.strategy = horse.strategy;
      p.stats = { ...horse.stats };
      p.color = HORSE_COLORS[idx % HORSE_COLORS.length];
    });

    this.renderParticipantList();
    this.saveParticipants();
    this.showToast('🎲 모든 참가자에게 밸런스 경주마가 자동 배정되었습니다!');
    sound.playClick();
  }

  switchView(viewName) {
    if (viewName === 'setup') {
      this.setupView.classList.add('active');
      this.raceView.classList.remove('active');
    } else if (viewName === 'race') {
      this.setupView.classList.remove('active');
      this.raceView.classList.add('active');
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  startRace() {
    this.switchView('race');
    this.timeScale = 1.0;
    this.speedRaceBtn.innerHTML = '⏩ 1.0x';
    this.speedRaceBtn.classList.remove('active');
    this.pauseRaceBtn.innerHTML = '⏸️ 일시정지';
    this.pauseRaceBtn.classList.remove('active');

    const modeText = this.selectedGameMode === 'item' ? '🎁 아이템전' : '🏇 스피드전';
    const distText = this.selectedDistance <= 1000 ? '1000m' : (this.selectedDistance <= 1600 ? '1600m' : '2400m');
    this.raceDistanceBadge.textContent = `${modeText} (${distText})`;

    this.initMiniTrack();
    this.renderer.setHorseCount(this.participants.length);
    this.renderer.reset();
    this.commentator.reset();

    this.engine.setup(this.participants, this.selectedDistance, this.selectedGameMode);
    this.engine.start();

    sound.playGunshot();
    sound.startGallopRhythm();
    this.commentator.onRaceStart(this.participants.length);

    this.lastFrameTime = performance.now();
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    this.raceLoop();
  }

  initMiniTrack() {
    const dotsHtml = this.participants.map((p, idx) => `
      <div id="miniDot_${p.id}" class="mini-horse-dot" style="background: ${p.color.body}; left: 20px;">
        ${idx + 1}
      </div>
    `).join('');

    this.miniTrack.innerHTML = `
      <div class="mini-track-marker" style="left: 25%;"></div>
      <div class="mini-track-marker" style="left: 50%;"></div>
      <div class="mini-track-marker" style="left: 75%;"></div>
      <div class="mini-track-finish">🏁</div>
      ${dotsHtml}
    `;
  }

  raceLoop() {
    const now = performance.now();
    const dt = (now - this.lastFrameTime) / 1000;
    this.lastFrameTime = now;

    this.engine.update(dt);
    this.renderer.render(this.engine, dt);

    if (this.engine.isRunning || !this.engine.isFinished) {
      this.animFrameId = requestAnimationFrame(() => this.raceLoop());
    }
  }

  onEngineTick(data) {
    const secs = Math.floor(data.elapsedTime);
    const ms = Math.floor((data.elapsedTime - secs) * 10);
    const formatted = `⏱️ ${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}.${ms}`;
    this.raceTimerDisplay.textContent = formatted;

    const minLeft = 14;
    const maxLeft = this.miniTrack.clientWidth - 30;
    const trackSpan = maxLeft - minLeft;

    data.horses.forEach(horse => {
      const dot = document.getElementById(`miniDot_${horse.id}`);
      if (dot) {
        const leftPos = minLeft + horse.progress * trackSpan;
        dot.style.left = `${leftPos}px`;
      }
    });

    this.renderLiveLeaderboard(data.horses);
  }

  renderLiveLeaderboard(horses) {
    const sorted = [...horses].sort((a, b) => a.rank - b.rank);

    this.liveRankList.innerHTML = sorted.map((h, idx) => {
      let badgeClass = '';
      if (h.rank === 1) badgeClass = 'gold';
      else if (h.rank === 2) badgeClass = 'silver';
      else if (h.rank === 3) badgeClass = 'bronze';
      else if (h.rank === horses.length) badgeClass = 'tail';

      const isLead = h.rank === 1;
      const isTail = h.rank === horses.length;
      const distPercent = Math.round(h.progress * 100);
      const aiIcon = h.strategy ? `<span style="font-size: 11px;" title="${h.strategy.name} (${h.strategy.tag})">${h.strategy.icon}</span>` : '';

      return `
        <div class="live-rank-item ${isLead ? 'is-lead' : ''} ${isTail ? 'is-tail' : ''}">
          <div class="rank-horse-tag">
            <span class="rank-badge-num ${badgeClass}">#${h.rank}</span>
            <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${h.color.body};"></span>
            <span>${h.name}</span>
            ${aiIcon}
            ${h.shieldActive ? '<span style="font-size: 11px;">🛡️</span>' : ''}
          </div>
          <div class="rank-meter-val">
            ${h.finished ? '🏁 골인!' : `${distPercent}% (${Math.round(h.distance)}m)`}
          </div>
        </div>
      `;
    }).join('');
  }

  onEngineEvent(type, horse, info) {
    this.commentator.onEvent(type, horse, info);

    if (type === 'boost' || type === 'itemUseBooster' || type === 'itemUseMagnet') {
      sound.playBoost();
    } else if (type === 'slip' || type === 'obstacleHit') {
      sound.playSlip();
    } else if (type === 'itemPickup') {
      sound.playItemPickup();
      const startX = 140;
      const finishX = this.renderer.trackPixelLength - 220;
      const trackWidthSpan = finishX - startX;
      const horseX = startX + horse.progress * trackWidthSpan;
      const horseY = this.renderer.trackTop + horse.lane * this.renderer.laneHeight + this.renderer.laneHeight * 0.55;
      this.renderer.addItemPopParticle(horseX, horseY);
    } else if (type === 'itemUseShield' || type === 'shieldBlock') {
      sound.playShield();
    } else if (type === 'itemUseLightning') {
      sound.playLightning();
    } else if (type === 'missileHit') {
      sound.playMissileHit();
    }
  }

  onEngineLeadChange(newLeader, oldLeader) {
    this.commentator.onLeadChange(newLeader, oldLeader);
  }

  onEngineHorseFinished(horse, rank) {
    this.commentator.onHorseFinish(horse, rank);
    if (rank === 1) {
      sound.playFanfare();
      const finishX = this.renderer.trackPixelLength - 220;
      const horseY = this.renderer.trackTop + horse.lane * this.renderer.laneHeight + 30;
      this.renderer.triggerFinishConfetti(finishX, horseY);
    }
  }

  onEngineAllFinished(horses) {
    sound.stopGallopRhythm();

    const finalRankings = [...horses].sort((a, b) => (a.finishTime || 999) - (b.finishTime || 999));
    finalRankings.forEach((h, idx) => { h.rank = idx + 1; });

    const penaltyHorses = this.calculatePenaltyHorses(finalRankings);
    const winner = finalRankings[0];

    this.commentator.onAllFinish(winner, penaltyHorses, this.selectedRule);

    setTimeout(() => {
      sound.playPenaltySound();
    }, 600);

    setTimeout(() => {
      this.showResultModal(finalRankings, penaltyHorses);
    }, 1200);
  }

  calculatePenaltyHorses(finalRankings) {
    return calculatePenaltyHorses(finalRankings, this.selectedRule);
  }

  showResultModal(finalRankings, penaltyHorses) {
    const winner = finalRankings[0];
    const second = finalRankings[1] || null;
    const third = finalRankings[2] || null;

    this.podiumName1.textContent = winner ? `${winner.name}` : '-';
    this.podiumName2.textContent = second ? `${second.name}` : '-';
    this.podiumName3.textContent = third ? `${third.name}` : '-';

    const penaltyNames = penaltyHorses.map(h => `${h.name}님`).join(', ');
    this.receiptPayerName.textContent = `${penaltyNames} (결제 확정)`;

    this.receiptRuleDesc.textContent = RULE_DESCRIPTIONS[this.selectedRule] || '커피내기 벌칙';

    const now = new Date();
    const dateStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    this.receiptDate.textContent = `${dateStr} | 주문번호: #${Math.floor(1000 + Math.random() * 9000)}`;

    const totalCount = finalRankings.length;
    const priceCalculation = calculateEstimatedPrice(totalCount, this.includeCoffeeMenu);
    const totalEstimatedPrice = priceCalculation.totalAmount;
    const pickedMenu = priceCalculation.menu;

    let menuHtml = '';
    if (this.includeCoffeeMenu) {
      menuHtml = `
        <div class="receipt-row">
          <span>${pickedMenu.name}</span>
          <span>${totalCount}잔</span>
        </div>
        <div class="receipt-row" style="font-size: 11px; color: #64748B;">
          <span>* 추천 이유: ${pickedMenu.note}</span>
          <span>${pickedMenu.price}/잔</span>
        </div>
      `;
    } else {
      menuHtml = `
        <div class="receipt-row">
          <span>${pickedMenu.name}</span>
          <span>총 ${totalCount}잔</span>
        </div>
      `;
    }

    this.receiptMenuItems.innerHTML = menuHtml;
    this.receiptTotalAmount.textContent = `${totalEstimatedPrice.toLocaleString()}원`;

    // 온디바이스 AI 특종 기사 1면 비동기 생성
    if (this.aiArticleContent) {
      this.aiArticleContent.textContent = '🧠 온디바이스 AI가 경기 분석 기사를 작성 중입니다...';
      aiEngine.generatePostRaceArticle(winner, penaltyHorses, totalCount, this.receiptRuleDesc.textContent, totalEstimatedPrice).then(article => {
        if (this.aiArticleContent) {
          this.aiArticleContent.textContent = article;
        }
      });
    }

    const randomFootnote = FUNNY_RECEIPT_NOTES[Math.floor(Math.random() * FUNNY_RECEIPT_NOTES.length)];
    this.receiptFooterNotes.innerHTML = `
      ${randomFootnote}<br>
      * 승패에 승복하고 쿨하게 결제하는 멋진 팀원이 됩시다 ☕️
    `;

    this.modalRankList.innerHTML = finalRankings.map(h => {
      const isWinner = h.rank === 1;
      const isPenalty = penaltyHorses.some(ph => ph.id === h.id);
      const timeStr = `${h.finishTime ? h.finishTime.toFixed(1) : '-'}초`;
      const stratTag = h.strategy ? `<span style="font-size: 10px; background: rgba(255,255,255,0.08); padding: 1px 5px; border-radius: 10px; color: var(--text-secondary);">${h.strategy.icon} ${h.strategy.name}</span>` : '';

      let badgeIcon = `#${h.rank}`;
      if (h.rank === 1) badgeIcon = '🥇 1위';
      else if (h.rank === 2) badgeIcon = '🥈 2위';
      else if (h.rank === 3) badgeIcon = '🥉 3위';
      else if (isPenalty) badgeIcon = `☕️ ${h.rank}위 (당첨)`;

      return `
        <div class="modal-rank-row ${isWinner ? 'winner' : ''} ${isPenalty ? 'loser' : ''}">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-weight: 700; font-size: 12px; color: ${isWinner ? 'var(--accent-gold)' : (isPenalty ? 'var(--accent-rose)' : 'inherit')}">${badgeIcon}</span>
            <span style="font-weight: 600;">${h.name}</span>
            ${stratTag}
            <span style="font-size: 11px; color: var(--text-muted);">(${h.nickname})</span>
          </div>
          <div style="font-family: monospace; font-size: 12px; font-weight: 600;">
            ${timeStr}
          </div>
        </div>
      `;
    }).join('');

    this.resultModal.classList.add('active');
    this.cachedResultData = { finalRankings, penaltyHorses, totalEstimatedPrice };
  }

  copyFormattedResultToClipboard() {
    if (!this.cachedResultData) return;

    const rankingText = finalRankings.map(h => {
      const isPenalty = penaltyHorses.some(ph => ph.id === h.id);
      const mark = h.rank === 1 ? '👑' : (isPenalty ? '☕️' : '▫️');
      const strat = h.strategy ? ` [AI:${h.strategy.name}]` : '';
      return `${mark} ${h.rank}위: ${h.name} (#${h.nickname})${strat} (${h.finishTime ? h.finishTime.toFixed(1) : '-'}초)`;
    }).join('\n');

    const aiArticleSnippet = this.aiArticleContent && this.aiArticleContent.textContent
      ? `\n📰 ${this.aiArticleContent.textContent.split('\n')[0]}\n`
      : '';

    const formattedMessage = `
[오피스 더비] 오늘의 커피내기 경마 결과 발표! 🏇☕️
==========================================
${aiArticleSnippet}
👑 1위 (명예의 전당): ${winner.name}님!
🎯 커피 결제자 (당첨): ${penaltyNames} ☕️
📌 벌칙 룰: ${this.receiptRuleDesc.textContent}
💰 예상 결제 금액: 약 ${totalEstimatedPrice.toLocaleString()}원 (${finalRankings.length}잔)
==========================================
📊 전체 순위:
${rankingText}
------------------------------------------
* ${penaltyNames} 영수증 지참하여 카페로 출발해주세요! 🏃‍♂️💨
    `.trim();

    navigator.clipboard.writeText(formattedMessage).then(() => {
      this.showToast('📋 슬랙/카톡 공유용 결과가 복사되었습니다!');
    }).catch(err => {
      console.warn('Clipboard write failed, using fallback', err);
      const textarea = document.createElement('textarea');
      textarea.value = formattedMessage;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      this.showToast('📋 슬랙/카톡 공유용 결과가 복사되었습니다!');
    });
  }

  showToast(message) {
    this.toastText.textContent = message;
    this.toast.classList.add('show');
    setTimeout(() => {
      this.toast.classList.remove('show');
    }, 2800);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.app = new OfficeDerbyApp();
});
