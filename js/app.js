/**
 * app.js - 오피스 더비 메인 애플리케이션 라이프사이클 및 UI 제어 (v2.0 고도화)
 * - 8종 아이템전 & 스피드전, 공정 추첨(fair) vs 350pt 능력치전(stats)
 * - 기상 시스템(맑음/수중전/돌풍/야간), 카메라 디렉터(선두/꼴찌/전체), 시드(Seed) 재현 및 URL 공유
 * - 개별 희망 음료 지정, 실물 감열지 영수증 PNG 이미지 발급, 사내 명예의 전당(누적 통계) 지원
 */

import { HORSE_COLORS, OFFICE_NICKNAMES, AI_STRATEGIES, COFFEE_MENUS, WEATHER_TYPES, FUNNY_RECEIPT_NOTES } from './presets.js';
import { sound } from './sound.js';
import { aiEngine } from './aiEngine.js';
import { calculatePenaltyHorses, calculateDetailedOrder, computeRaceMVPs, RULE_DESCRIPTIONS } from './penalty.js';
import { PresetManager, STORAGE_KEYS } from './presetManager.js';
import { HorseGenerator } from './horseGenerator.js';
import { RaceEngine, STAT_MODES } from './raceEngine.js';
import { CanvasRenderer } from './canvasRenderer.js';
import { Commentator } from './commentator.js';
import { AILoader } from './aiLoader.js';
import { StatsManager } from './statsManager.js';
import { ReceiptExporter } from './receiptExporter.js';
import { createRng, seedToCode, codeToSeed, deriveSeed } from './rng.js';
import { escapeHtml } from './utils.js';

class OfficeDerbyApp {
  constructor() {
    this.participants = [];
    this.customPresets = [];
    this.stableHorses = HorseGenerator.getDefaultStable();
    this.hallOfFameStats = StatsManager.loadStats();
    this.currentDraftingIndex = null;

    this.selectedDistance = 1600;
    this.selectedGameMode = 'item'; // 'item' | 'speed'
    this.selectedStatMode = STAT_MODES.FAIR; // 'fair' | 'stats'
    this.selectedWeather = 'sunny'; // 'sunny' | 'rain' | 'wind' | 'night' | 'random'
    this.selectedRule = 'last1';
    this.includeCoffeeMenu = true;
    this.isMuted = false;
    this.cameraMode = 'lead'; // 'lead' | 'tail' | 'pack'

    // 엔진 & 렌더러
    this.engine = null;
    this.renderer = null;
    this.commentator = null;
    this.animFrameId = null;
    this.lastFrameTime = 0;
    this.timeScale = 1.0;
    this.cachedResultData = null;

    this.initDOMElements();
    this.loadInitialData();
    this.applyUrlParamsIfPresent();
    this.bindEvents();
    this.updateHallOfFameBadge();
    this.updateAIEngineBadge();
    aiEngine.onStatusChange(() => this.updateAIEngineBadge());
  }

  initDOMElements() {
    // 뷰 섹션 및 모달
    this.setupView = document.getElementById('setupView');
    this.raceView = document.getElementById('raceView');
    this.resultModal = document.getElementById('resultModal');
    this.helpModal = document.getElementById('helpModal');
    this.hallOfFameModal = document.getElementById('hallOfFameModal');

    // 설정 화면 요소
    this.presetChipsContainer = document.getElementById('presetChipsContainer');
    this.saveCurrentPresetBtn = document.getElementById('saveCurrentPresetBtn');
    this.participantInput = document.getElementById('participantInput');
    this.addParticipantForm = document.getElementById('addParticipantForm');
    this.addParticipantBtn = document.getElementById('addParticipantBtn');
    this.gateSlotVisualBar = document.getElementById('gateSlotVisualBar');
    this.gateStatusHint = document.getElementById('gateStatusHint');
    this.quickRoleAddBar = document.getElementById('quickRoleAddBar');
    this.inlineAiGeneratingBanner = document.getElementById('inlineAiGeneratingBanner');
    this.inlineAiBannerText = document.getElementById('inlineAiBannerText');
    this.bulkInput = document.getElementById('bulkInput');
    this.bulkAddBtn = document.getElementById('bulkAddBtn');
    this.participantListEl = document.getElementById('participantList');
    this.participantCountEl = document.getElementById('participantCount');
    this.clearAllBtn = document.getElementById('clearAllBtn');
    this.aiRerollNicknamesBtn = document.getElementById('aiRerollNicknamesBtn');
    this.aiAutoDraftHorsesBtn = document.getElementById('aiAutoDraftHorsesBtn');
    this.startRaceBtn = document.getElementById('startRaceBtn');
    this.randomCoffeeMenuCheck = document.getElementById('randomCoffeeMenuCheck');
    this.customSeedInput = document.getElementById('customSeedInput');
    this.lastAddedIds = new Set();

    // 마구간 드래프트 모달
    this.horseDraftModal = document.getElementById('horseDraftModal');
    this.draftModalSubtitle = document.getElementById('draftModalSubtitle');
    this.generateNewAIHorseBtn = document.getElementById('generateNewAIHorseBtn');
    this.stableHorseGrid = document.getElementById('stableHorseGrid');
    this.closeDraftModalBtn = document.getElementById('closeDraftModalBtn');

    // 레이스 화면 요소
    this.raceCanvas = document.getElementById('raceCanvas');
    this.raceDistanceBadge = document.getElementById('raceDistanceBadge');
    this.raceWeatherBadge = document.getElementById('raceWeatherBadge');
    this.raceSeedBadge = document.getElementById('raceSeedBadge');
    this.raceTimerDisplay = document.getElementById('raceTimerDisplay');
    this.pauseRaceBtn = document.getElementById('pauseRaceBtn');
    this.speedRaceBtn = document.getElementById('speedRaceBtn');
    this.skipRaceBtn = document.getElementById('skipRaceBtn');
    this.miniTrack = document.getElementById('miniTrack');
    this.commentList = document.getElementById('commentList');
    this.liveRankList = document.getElementById('liveRankList');
    this.liveDangerSummary = document.getElementById('liveDangerSummary');

    // 결과 모달 요소
    this.photoFinishBanner = document.getElementById('photoFinishBanner');
    this.spotlightWinnerName = document.getElementById('spotlightWinnerName');
    this.spotlightWinnerMeta = document.getElementById('spotlightWinnerMeta');
    this.spotlightPayerName = document.getElementById('spotlightPayerName');
    this.spotlightPayerMeta = document.getElementById('spotlightPayerMeta');
    this.podiumAvatar1 = document.getElementById('podiumAvatar1');
    this.podiumAvatar2 = document.getElementById('podiumAvatar2');
    this.podiumAvatar3 = document.getElementById('podiumAvatar3');
    this.podiumName1 = document.getElementById('podiumName1');
    this.podiumName2 = document.getElementById('podiumName2');
    this.podiumName3 = document.getElementById('podiumName3');
    this.podiumMeta1 = document.getElementById('podiumMeta1');
    this.podiumMeta2 = document.getElementById('podiumMeta2');
    this.podiumMeta3 = document.getElementById('podiumMeta3');
    this.mvpAwardsContainer = document.getElementById('mvpAwardsContainer');
    this.aiArticleContent = document.getElementById('aiArticleContent');
    this.receiptPayerName = document.getElementById('receiptPayerName');
    this.receiptRuleDesc = document.getElementById('receiptRuleDesc');
    this.receiptDate = document.getElementById('receiptDate');
    this.receiptMenuItems = document.getElementById('receiptMenuItems');
    this.receiptTotalAmount = document.getElementById('receiptTotalAmount');
    this.receiptPerPersonRow = document.getElementById('receiptPerPersonRow');
    this.receiptPerPersonAmount = document.getElementById('receiptPerPersonAmount');
    this.receiptFooterNotes = document.getElementById('receiptFooterNotes');
    this.modalRankList = document.getElementById('modalRankList');
    this.copyResultBtn = document.getElementById('copyResultBtn');
    this.downloadReceiptBtn = document.getElementById('downloadReceiptBtn');
    this.replaySameSeedBtn = document.getElementById('replaySameSeedBtn');
    this.rematchBtn = document.getElementById('rematchBtn');
    this.backToSetupBtn = document.getElementById('backToSetupBtn');

    // 명예의 전당 모달 요소
    this.hallOfFameBtn = document.getElementById('hallOfFameBtn');
    this.hallOfFameCountBadge = document.getElementById('hallOfFameCountBadge');
    this.hofTotalRaces = document.getElementById('hofTotalRaces');
    this.hofTotalCups = document.getElementById('hofTotalCups');
    this.hofTotalSpent = document.getElementById('hofTotalSpent');
    this.hofPayerList = document.getElementById('hofPayerList');
    this.hofWinnerList = document.getElementById('hofWinnerList');
    this.hofHistoryList = document.getElementById('hofHistoryList');
    this.clearHallOfFameBtn = document.getElementById('clearHallOfFameBtn');
    this.closeHallOfFameBtn = document.getElementById('closeHallOfFameBtn');

    // 헤더 및 모달 버튼
    this.aiEngineStatusBtn = document.getElementById('aiEngineStatusBtn');
    this.aiEngineStatusDot = document.getElementById('aiEngineStatusDot');
    this.aiEngineStatusText = document.getElementById('aiEngineStatusText');
    this.shareSetupBtn = document.getElementById('shareSetupBtn');
    this.soundToggleBtn = document.getElementById('soundToggleBtn');
    this.helpBtn = document.getElementById('helpBtn');
    this.closeHelpBtn = document.getElementById('closeHelpBtn');
    this.toast = document.getElementById('toast');
    this.toastText = document.getElementById('toastText');
  }

  loadInitialData() {
    this.customPresets = PresetManager.loadPresets();
    this.renderPresetChips();

    const savedParticipants = localStorage.getItem(STORAGE_KEYS.PARTICIPANTS);
    if (savedParticipants) {
      try {
        const parsed = JSON.parse(savedParticipants);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.participants = parsed.map((p, idx) => ({
            ...p,
            drinkId: p.drinkId || 'random',
            strategy: p.strategy || AI_STRATEGIES[idx % AI_STRATEGIES.length]
          }));
        }
      } catch (e) {
        console.warn('Failed to parse saved participants', e);
      }
    }

    this.renderParticipantList();

    this.commentator = new Commentator(this.commentList);
    this.renderer = new CanvasRenderer(this.raceCanvas);
    this.engine = new RaceEngine({
      gameMode: this.selectedGameMode,
      statMode: this.selectedStatMode,
      onTick: (data) => this.onEngineTick(data),
      onEvent: (type, horse, info) => this.onEngineEvent(type, horse, info),
      onLeadChange: (newLeader, oldLeader) => this.onEngineLeadChange(newLeader, oldLeader),
      onHorseFinished: (horse, rank) => this.onEngineHorseFinished(horse, rank),
      onAllFinished: (horses) => this.onEngineAllFinished(horses)
    });
  }

  applyUrlParamsIfPresent() {
    try {
      const params = new URLSearchParams(window.location.search);
      const membersStr = params.get('members');
      if (membersStr) {
        const names = membersStr.split(',').map(s => s.trim()).filter(Boolean).slice(0, 12);
        if (names.length >= 2) {
          this.participants = names.map((name, idx) => {
            const defaultHorse = this.stableHorses[idx % this.stableHorses.length];
            return {
              id: idx + 1,
              name: name.slice(0, 12),
              nickname: OFFICE_NICKNAMES[idx % OFFICE_NICKNAMES.length],
              horseName: defaultHorse ? defaultHorse.name : `${name}의 명마`,
              drinkId: 'random',
              color: HORSE_COLORS[idx % HORSE_COLORS.length],
              strategy: defaultHorse ? defaultHorse.strategy : AI_STRATEGIES[idx % AI_STRATEGIES.length],
              stats: defaultHorse ? { ...defaultHorse.stats } : HorseGenerator.generateBalancedStats()
            };
          });
          this.renderParticipantList();
          this.saveParticipants();
        }
      }

      const mode = params.get('mode');
      if (mode === 'item' || mode === 'speed') {
        this.selectedGameMode = mode;
        const radio = document.querySelector(`input[name="gameMode"][value="${mode}"]`);
        if (radio) {
          radio.checked = true;
          radio.closest('.rule-group')?.querySelectorAll('.radio-card').forEach(c => c.classList.remove('active'));
          radio.closest('.radio-card')?.classList.add('active');
        }
      }

      const stat = params.get('stat');
      if (stat === 'fair' || stat === 'stats') {
        this.selectedStatMode = stat;
        const radio = document.querySelector(`input[name="statMode"][value="${stat}"]`);
        if (radio) {
          radio.checked = true;
          radio.closest('.rule-group')?.querySelectorAll('.radio-card').forEach(c => c.classList.remove('active'));
          radio.closest('.radio-card')?.classList.add('active');
        }
      }

      const rule = params.get('rule');
      if (rule && RULE_DESCRIPTIONS[rule]) {
        this.selectedRule = rule;
        const radio = document.querySelector(`input[name="penaltyRule"][value="${rule}"]`);
        if (radio) {
          radio.checked = true;
          radio.closest('.rule-group')?.querySelectorAll('.radio-card').forEach(c => c.classList.remove('active'));
          radio.closest('.radio-card')?.classList.add('active');
        }
      }

      const dist = parseInt(params.get('dist'), 10);
      if ([1000, 1600, 2400].includes(dist)) {
        this.selectedDistance = dist;
        document.querySelectorAll('.distance-btn').forEach(btn => {
          btn.classList.toggle('active', parseInt(btn.dataset.distance, 10) === dist);
        });
      }

      const seedParam = params.get('seed');
      if (seedParam && this.customSeedInput) {
        this.customSeedInput.value = seedParam.slice(0, 7).toUpperCase();
      }

      this.updateCostEstimate();
    } catch (e) {}
  }

  shareCurrentSetupUrl() {
    const url = new URL(window.location.href);
    url.search = '';
    if (this.participants.length > 0) {
      url.searchParams.set('members', this.participants.map(p => p.name).join(','));
    }
    url.searchParams.set('mode', this.selectedGameMode);
    url.searchParams.set('stat', this.selectedStatMode);
    url.searchParams.set('rule', this.selectedRule);
    url.searchParams.set('dist', String(this.selectedDistance));
    if (this.customSeedInput && this.customSeedInput.value.trim()) {
      url.searchParams.set('seed', this.customSeedInput.value.trim().toUpperCase());
    }

    const shareUrl = url.toString();
    navigator.clipboard.writeText(shareUrl).then(() => {
      this.showToast('🔗 현재 참가자 명단 & 룰 설정 링크가 클립보드에 복사되었습니다!');
    }).catch(() => {
      prompt('아래 링크를 복사하여 동료들에게 공유하세요:', shareUrl);
    });
    sound.playClick();
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
        <span class="preset-empty-hint">저장된 팀 프리셋이 없습니다</span>
      `;
      return;
    }

    this.presetChipsContainer.innerHTML = this.customPresets.map((preset, idx) => `
      <div class="preset-chip" data-id="${escapeHtml(preset.id || idx)}">
        <span class="preset-chip-title" data-index="${idx}">${escapeHtml(preset.name)}</span>
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

  async applyPreset(preset) {
    if (!preset || !preset.members) return;
    this.participants = [];
    await this.addMultipleParticipants(preset.members.slice(0, 12), `'${preset.name}' 프리셋`);
  }

  async populateSampleTeam() {
    const sampleMembers = ['김팀장', '이책임', '박선임', '최대리', '정사원', '강인턴'];
    this.participants = [];
    await this.addMultipleParticipants(sampleMembers, '오피스 샘플 6인');
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
    this.addParticipantForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = this.participantInput.value.trim();
      if (!name) return;
      this.participantInput.value = '';
      this.participantInput.focus();
      await this.addSingleParticipant(name);
    });

    // 2.5. 1초 직급 빠른 추가 칩
    if (this.quickRoleAddBar) {
      this.quickRoleAddBar.querySelectorAll('.quick-role-chip').forEach(chip => {
        chip.addEventListener('click', async () => {
          const roleName = chip.dataset.roleName;
          if (!roleName) return;
          // 이미 동일 이름이 있으면 번호 부여 (예: 김팀장2)
          let candidate = roleName;
          let suffix = 2;
          while (this.participants.some(p => p.name === candidate) && suffix <= 12) {
            candidate = `${roleName}${suffix}`;
            suffix++;
          }
          await this.addSingleParticipant(candidate, chip);
        });
      });
    }

    // 3. 대량 붙여넣기 추가
    this.bulkAddBtn.addEventListener('click', async () => {
      const text = this.bulkInput.value.trim();
      if (!text) return;
      const names = text.split(/[\n,]+/).map(n => n.trim()).filter(n => n.length > 0);
      this.bulkInput.value = '';
      await this.addMultipleParticipants(names, '대량 명단');
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

    // 5.5. 능력치 밸런스 모드 (공정 추첨 vs 능력치 전략전)
    document.querySelectorAll('input[name="statMode"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        this.selectedStatMode = e.target.value;
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
        this.updateCostEstimate();
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

    // 7.5. 기상 컨디션 선택 버튼
    document.querySelectorAll('.weather-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.weather-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.selectedWeather = btn.dataset.weather || 'sunny';
        sound.playClick();
      });
    });

    // 8. 커피 메뉴 체크박스
    this.randomCoffeeMenuCheck.addEventListener('change', (e) => {
      this.includeCoffeeMenu = e.target.checked;
      this.updateCostEstimate();
    });

    // 9. 레이스 시작 버튼
    this.startRaceBtn.addEventListener('click', () => {
      if (this.participants.length < 2) {
        alert('경기를 진행하려면 최소 2명 이상의 참가자가 필요합니다!');
        this.participantInput.focus();
        return;
      }
      const customCode = this.customSeedInput ? this.customSeedInput.value.trim() : '';
      const parsedSeed = customCode ? codeToSeed(customCode) : null;
      this.startRace(parsedSeed);
    });

    // 10. 레이스 카메라 & 재생 컨트롤
    document.querySelectorAll('.cam-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.cam || 'lead';
        this.setCameraMode(mode);
        sound.playClick();
      });
    });

    this.pauseRaceBtn.addEventListener('click', () => {
      this.togglePauseRace();
    });

    this.speedRaceBtn.addEventListener('click', () => {
      this.cycleRaceSpeed();
    });

    this.skipRaceBtn.addEventListener('click', () => {
      if (this.engine && this.engine.isRunning) {
        this.engine.fastForwardToEnd();
        sound.playClick();
      }
    });

    // 11. 사운드 토글 & AI 엔진 상태 & 설정 공유 & 명예의 전당
    if (this.aiEngineStatusBtn) {
      this.aiEngineStatusBtn.addEventListener('click', () => {
        this.handleAIEngineStatusClick();
      });
    }

    this.soundToggleBtn.addEventListener('click', () => {
      this.toggleMute();
    });

    if (this.shareSetupBtn) {
      this.shareSetupBtn.addEventListener('click', () => {
        this.shareCurrentSetupUrl();
      });
    }

    if (this.hallOfFameBtn) {
      this.hallOfFameBtn.addEventListener('click', () => {
        this.openHallOfFameModal();
      });
    }
    if (this.closeHallOfFameBtn) {
      this.closeHallOfFameBtn.addEventListener('click', () => {
        this.hallOfFameModal.classList.remove('active');
      });
    }
    if (this.clearHallOfFameBtn) {
      this.clearHallOfFameBtn.addEventListener('click', () => {
        if (confirm('누적된 명예의 전당 전적과 커피 결제 기록을 모두 초기화하시겠습니까?')) {
          this.hallOfFameStats = StatsManager.clearStats();
          this.updateHallOfFameBadge();
          this.renderHallOfFameContent();
          this.showToast('전적 기록이 초기화되었습니다.');
        }
      });
    }
    if (this.hallOfFameModal) {
      this.hallOfFameModal.addEventListener('click', (e) => {
        if (e.target === this.hallOfFameModal) this.hallOfFameModal.classList.remove('active');
      });
    }

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

    if (this.downloadReceiptBtn) {
      this.downloadReceiptBtn.addEventListener('click', () => {
        if (!this.cachedResultData) return;
        ReceiptExporter.exportAsPNG(this.cachedResultData.receiptExportPayload);
        this.showToast('🖼️ 고해상도 감열지 영수증 PNG 이미지가 저장되었습니다!');
        sound.playClick();
      });
    }

    if (this.replaySameSeedBtn) {
      this.replaySameSeedBtn.addEventListener('click', () => {
        const lastSeed = this.cachedResultData ? this.cachedResultData.seed : null;
        this.resultModal.classList.remove('active');
        this.startRace(lastSeed);
      });
    }

    this.rematchBtn.addEventListener('click', () => {
      this.resultModal.classList.remove('active');
      this.startRace(null);
    });

    this.backToSetupBtn.addEventListener('click', () => {
      this.resultModal.classList.remove('active');
      this.switchView('setup');
      sound.stopGallopRhythm();
    });

    // 14. 글로벌 키보드 단축키 (레이스 화면 및 모달 제어)
    window.addEventListener('keydown', (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.key === 'Escape') {
        this.helpModal?.classList.remove('active');
        this.horseDraftModal?.classList.remove('active');
        this.hallOfFameModal?.classList.remove('active');
        return;
      }

      if (e.key.toLowerCase() === 'm') {
        this.toggleMute();
        return;
      }

      // 레이스 진행 중 단축키
      if (!this.raceView.classList.contains('active') || !this.engine) return;

      if (e.code === 'Space') {
        e.preventDefault();
        this.togglePauseRace();
      } else if (e.key.toLowerCase() === 'c') {
        const order = ['lead', 'tail', 'pack'];
        const nextCam = order[(order.indexOf(this.cameraMode) + 1) % order.length];
        this.setCameraMode(nextCam);
        sound.playClick();
      } else if (e.key === '1') {
        this.setRaceSpeed(1.0);
      } else if (e.key === '2') {
        this.setRaceSpeed(1.5);
      } else if (e.key === '3') {
        this.setRaceSpeed(2.0);
      } else if (e.key.toLowerCase() === 's') {
        if (this.engine.isRunning && !this.engine.isFinished) {
          this.engine.fastForwardToEnd();
          sound.playClick();
        }
      }
    });
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    sound.setMute(this.isMuted);
    this.soundToggleBtn.innerHTML = this.isMuted ? '🔇' : '🔊';
    this.soundToggleBtn.classList.toggle('active', this.isMuted);
  }

  setCameraMode(mode) {
    this.cameraMode = mode;
    if (this.renderer) this.renderer.setCameraMode(mode);
    document.querySelectorAll('.cam-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.cam === mode);
    });
  }

  togglePauseRace() {
    if (!this.engine || this.engine.isFinished) return;
    if (this.engine.isPaused) {
      this.engine.resume();
      this.pauseRaceBtn.innerHTML = '⏸️ 일시정지';
      this.pauseRaceBtn.classList.remove('active');
      sound.startGallopRhythm();
    } else {
      this.engine.pause();
      this.pauseRaceBtn.innerHTML = '▶️ 재개';
      this.pauseRaceBtn.classList.add('active');
      sound.stopGallopRhythm();
    }
    sound.playClick();
  }

  cycleRaceSpeed() {
    if (this.timeScale === 1.0) this.setRaceSpeed(1.5);
    else if (this.timeScale === 1.5) this.setRaceSpeed(2.0);
    else this.setRaceSpeed(1.0);
    sound.playClick();
  }

  setRaceSpeed(scale) {
    this.timeScale = scale;
    if (scale === 1.0) {
      this.speedRaceBtn.innerHTML = '⏩ 1.0x';
      this.speedRaceBtn.classList.remove('active');
    } else if (scale === 1.5) {
      this.speedRaceBtn.innerHTML = '⏩ 1.5x';
      this.speedRaceBtn.classList.add('active');
    } else {
      this.speedRaceBtn.innerHTML = '⚡️ 2.0x';
      this.speedRaceBtn.classList.add('active');
    }
    if (this.engine) this.engine.setTimeScale(this.timeScale);
  }

  updateAIEngineBadge() {
    if (!this.aiEngineStatusBtn) return;
    const status = aiEngine.getStatus();
    if (this.aiEngineStatusText) {
      this.aiEngineStatusText.textContent = status.shortLabel;
    }
    if (this.aiEngineStatusDot) {
      this.aiEngineStatusDot.textContent = status.badgeState === 'ready' ? '🟢' : '🧠';
    }
    this.aiEngineStatusBtn.classList.toggle('ready', status.badgeState === 'ready');
    this.aiEngineStatusBtn.title = status.detailLabel;
  }

  async handleAIEngineStatusClick() {
    const status = aiEngine.getStatus();
    if (status.badgeState === 'ready') {
      this.showToast(`🟢 ${status.detailLabel} (추론 ${status.telemetry.llmCalls}회 · 최근 지연 ${status.telemetry.lastLatencyMs}ms)`);
      sound.playClick();
      return;
    }

    await AILoader.run({
      title: '브라우저 온디바이스 LLM 신경망 활성화 중...',
      subtitle: 'Chrome Built-in Gemini Nano (LanguageModel) 또는 WebGPU Qwen2.5-0.5B-Instruct 로드',
      duration: 500,
      logs: [
        { progress: 15, text: '[DETECT] Checking globalThis.LanguageModel (Gemini Nano) availability...' },
        { progress: 100, text: '[READY] On-Device AI Engine synchronized' }
      ],
      onComplete: async ({ onProgress }) => {
        try {
          await aiEngine.loadWebLLM(onProgress);
          const updated = aiEngine.getStatus();
          this.updateAIEngineBadge();
          this.showToast(`🚀 ${updated.detailLabel} 가동 완료!`);
        } catch (_) {
          this.updateAIEngineBadge();
          this.showToast('💡 오프라인/보안 환경 감지: 초고속 온디바이스 NLG 엔진으로 작동합니다.');
        }
      }
    });
    sound.playClick();
  }

  async rerollAllAINicknames() {
    if (this.participants.length === 0) {
      alert('참가자를 먼저 추가해주세요!');
      return;
    }

    AILoader.setButtonLoading(this.aiRerollNicknamesBtn, true, 'AI 별명 생성 중...');

    const participantNames = this.participants.map(p => p.name).join(', ');
    await AILoader.run({
      title: '온디바이스 AI 사내 별명 신경망 생성 중...',
      subtitle: `참가자 [${participantNames}] 맞춤형 페르소나 및 별명 합성 (${aiEngine.getStatus().shortLabel})`,
      duration: 600,
      logs: [
        { progress: 20, text: `[AI] Engine: ${aiEngine.getStatus().detailLabel}` },
        { progress: 45, text: `[ANALYSIS] Analyzing office persona for ${this.participants.length} racers...` },
        { progress: 100, text: `[COMPLETE] Successfully generated ${this.participants.length} AI nicknames` }
      ],
      onComplete: async ({ onProgress }) => {
        await aiEngine.ensureSession(onProgress);
        for (let i = 0; i < this.participants.length; i++) {
          const p = this.participants[i];
          const stratName = p.strategy ? p.strategy.name : '돌진';
          p.nickname = await aiEngine.generateNickname(p.name, stratName, { forceFresh: true });
          const pct = Math.round(50 + ((i + 1) / this.participants.length) * 45);
          onProgress(pct, `[SYNTHESIS] ${p.name} (${stratName}) ➔ #${p.nickname}`);
        }
        this.renderParticipantList();
        this.saveParticipants();
        this.updateAIEngineBadge();
      }
    });

    AILoader.setButtonLoading(this.aiRerollNicknamesBtn, false);
    this.showToast('✨ 모든 참가자의 AI 별명이 새롭게 생성되었습니다!');
    sound.playClick();
  }

  showInlineAiBanner(text) {
    if (!this.inlineAiGeneratingBanner) return;
    if (this.inlineAiBannerText) {
      this.inlineAiBannerText.textContent = text;
    }
    this.inlineAiGeneratingBanner.style.display = 'flex';
  }

  hideInlineAiBanner() {
    if (!this.inlineAiGeneratingBanner) return;
    this.inlineAiGeneratingBanner.style.display = 'none';
  }

  appendSkeletonParticipantCard(name, gateNumber, color) {
    if (!this.participantListEl) return null;
    const emptyState = this.participantListEl.querySelector('.empty-entry-state');
    if (emptyState) emptyState.remove();

    const skel = document.createElement('div');
    skel.className = 'participant-skeleton-card';
    skel.innerHTML = `
      <div class="skeleton-badge-circle" style="background: ${color.body}; border-color: ${color.border};">
        <span class="ai-spinner"></span>
      </div>
      <div class="skeleton-body">
        <div class="skeleton-title-row">
          <span class="skeleton-name">G${gateNumber} · ${escapeHtml(name)}</span>
          <span class="skeleton-ai-chip">🧠 온디바이스 AI 별명·전용마 합성 중...</span>
        </div>
        <div class="skeleton-bar-shimmer"></div>
      </div>
    `;
    this.participantListEl.appendChild(skel);
    this.participantListEl.scrollTop = this.participantListEl.scrollHeight;
    return skel;
  }

  async addSingleParticipant(name, sourceBtn = null) {
    if (this.participants.length >= 12) {
      alert('참가자는 최대 12명까지 등록 가능합니다.');
      return;
    }

    const cleanName = String(name).trim().slice(0, 12);
    if (!cleanName) return;

    const idx = this.participants.length;
    const color = HORSE_COLORS[idx % HORSE_COLORS.length];
    const defaultHorse = this.stableHorses[idx % this.stableHorses.length];
    const strategy = defaultHorse ? defaultHorse.strategy : AI_STRATEGIES[idx % AI_STRATEGIES.length];

    // 1. 버튼 및 인라인 AI 로딩 배너 + 스켈레톤 카드 즉시 표시
    const targetBtn = sourceBtn || this.addParticipantBtn;
    AILoader.setButtonLoading(targetBtn, true, 'AI 생성 중...');
    this.showInlineAiBanner(`🧠 온디바이스 AI가 [${cleanName}] 기수의 사내 별명 & 주행 전술을 합성하고 있습니다...`);
    const skelEl = this.appendSkeletonParticipantCard(cleanName, idx + 1, color);

    // 2. 온디바이스 AI 별명 생성 (초고속 폴백일 때도 최소 280ms의 시각적 피드백 보장)
    const [aiNick] = await Promise.all([
      aiEngine.generateNickname(cleanName, strategy.name, { forceFresh: true }),
      new Promise(r => setTimeout(r, 280))
    ]);

    if (skelEl) skelEl.remove();
    AILoader.setButtonLoading(targetBtn, false);
    this.hideInlineAiBanner();

    if (this.participants.length >= 12) return;

    const newId = Date.now() + Math.floor(Math.random() * 10000);
    this.lastAddedIds.add(newId);

    this.participants.push({
      id: newId,
      name: cleanName,
      nickname: aiNick,
      horseName: defaultHorse ? defaultHorse.name : `${cleanName}의 명마`,
      drinkId: 'random',
      color: HORSE_COLORS[this.participants.length % HORSE_COLORS.length],
      strategy: strategy,
      stats: defaultHorse ? { ...defaultHorse.stats } : HorseGenerator.generateBalancedStats()
    });

    this.renderParticipantList();
    if (this.participantListEl) {
      this.participantListEl.scrollTop = this.participantListEl.scrollHeight;
    }
    this.saveParticipants();
    this.updateAIEngineBadge();
    this.showToast(`✨ [${cleanName}] 기수 등록 완료! (#${aiNick})`);
    sound.playClick();
  }

  async addMultipleParticipants(names, sourceLabel = '명단') {
    const availableSlots = 12 - this.participants.length;
    if (availableSlots <= 0) {
      alert('참가자는 최대 12명까지 등록 가능합니다.');
      return;
    }

    const validNames = names
      .map(n => String(n).trim().slice(0, 12))
      .filter(Boolean)
      .slice(0, availableSlots);

    if (validNames.length === 0) return;

    AILoader.setButtonLoading(this.bulkAddBtn, true, `AI 일괄 생성 중 (0/${validNames.length})...`);
    this.showInlineAiBanner(`🧠 온디바이스 AI가 ${sourceLabel} (${validNames.length}명)의 별명과 경주마를 차례대로 생성 중입니다...`);

    for (let i = 0; i < validNames.length; i++) {
      const cleanName = validNames[i];
      const idx = this.participants.length;
      const color = HORSE_COLORS[idx % HORSE_COLORS.length];
      const defaultHorse = this.stableHorses[idx % this.stableHorses.length];
      const strategy = defaultHorse ? defaultHorse.strategy : AI_STRATEGIES[idx % AI_STRATEGIES.length];

      this.showInlineAiBanner(`🧠 [${i + 1}/${validNames.length}] '${cleanName}' 기수의 AI 별명 & 밸런스마 합성 중...`);
      const skelEl = this.appendSkeletonParticipantCard(cleanName, idx + 1, color);

      const [aiNick] = await Promise.all([
        aiEngine.generateNickname(cleanName, strategy.name, { forceFresh: true }),
        new Promise(r => setTimeout(r, 110))
      ]);

      if (skelEl) skelEl.remove();

      const newId = Date.now() + i * 17 + Math.floor(Math.random() * 1000);
      this.lastAddedIds.add(newId);

      this.participants.push({
        id: newId,
        name: cleanName,
        nickname: aiNick,
        horseName: defaultHorse ? defaultHorse.name : `${cleanName}의 명마`,
        drinkId: 'random',
        color,
        strategy,
        stats: defaultHorse ? { ...defaultHorse.stats } : HorseGenerator.generateBalancedStats()
      });

      this.renderParticipantList();
    }

    if (this.participantListEl) {
      this.participantListEl.scrollTop = 0;
    }
    AILoader.setButtonLoading(this.bulkAddBtn, false);
    this.hideInlineAiBanner();
    this.saveParticipants();
    this.updateAIEngineBadge();
    this.showToast(`⚡️ ${sourceLabel} ${validNames.length}명의 AI 기수 등록이 완료되었습니다!`);
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

  cycleParticipantDrink(index) {
    const p = this.participants[index];
    if (!p) return;

    const drinkOptions = ['random', ...COFFEE_MENUS.map(m => m.id)];
    const curIdx = drinkOptions.indexOf(p.drinkId || 'random');
    const nextId = drinkOptions[(curIdx + 1) % drinkOptions.length];
    p.drinkId = nextId;

    this.renderParticipantList();
    this.saveParticipants();
    const menuObj = COFFEE_MENUS.find(m => m.id === nextId);
    const label = menuObj ? `${menuObj.shortName} (${menuObj.price})` : '🎲 랜덤 메뉴';
    this.showToast(`☕️ [${p.name}] 희망 음료: ${label}`);
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

  renderGateSlotBar() {
    const count = this.participants.length;
    if (this.participantCountEl) {
      this.participantCountEl.textContent = `${count} / 12두`;
      this.participantCountEl.classList.toggle('ready', count >= 2);
    }

    if (this.gateStatusHint) {
      if (count === 0) {
        this.gateStatusHint.textContent = '최소 2명 이상 등록해주세요';
        this.gateStatusHint.className = 'gate-status-hint';
      } else if (count === 1) {
        this.gateStatusHint.textContent = '1명 더 등록하면 레이스 출발 가능!';
        this.gateStatusHint.className = 'gate-status-hint warn';
      } else {
        this.gateStatusHint.textContent = `🟢 ${count}두 출전 준비 완료!`;
        this.gateStatusHint.className = 'gate-status-hint ready';
      }
    }

    if (this.gateSlotVisualBar) {
      const slots = [];
      for (let i = 0; i < 12; i++) {
        const p = this.participants[i];
        if (p) {
          slots.push(`
            <div class="gate-slot-seg filled" style="--slot-color: ${p.color.body}; background: ${p.color.body}; border-color: ${p.color.border};" title="${i + 1}번 게이트: ${escapeHtml(p.name)}">
              <span>G${i + 1}</span>
            </div>
          `);
        } else {
          slots.push(`
            <div class="gate-slot-seg" title="${i + 1}번 빈 게이트">
              <span>G${i + 1}</span>
            </div>
          `);
        }
      }
      this.gateSlotVisualBar.innerHTML = slots.join('');
    }
  }

  renderParticipantList() {
    this.renderGateSlotBar();

    if (this.participants.length === 0) {
      this.participantListEl.innerHTML = `
        <div class="empty-entry-state">
          <div class="empty-entry-icon-wrap">🏇</div>
          <div class="empty-entry-title">스타팅 게이트가 비어 있습니다</div>
          <div class="empty-entry-desc">
            위 입력창에 팀원 이름을 입력하거나, <strong>⚡️ 1초 추가</strong> 칩 또는 아래 샘플 팀 버튼으로 즉시 시작하세요!
          </div>
          <button type="button" id="emptySampleTeamBtn" class="empty-sample-btn">
            ⚡️ 오피스 샘플 6인 (김팀장~강인턴) AI 즉시 투입
          </button>
        </div>
      `;
      const sampleBtn = document.getElementById('emptySampleTeamBtn');
      if (sampleBtn) {
        sampleBtn.addEventListener('click', () => this.populateSampleTeam());
      }
      this.updateCostEstimate();
      return;
    }

    this.participantListEl.innerHTML = this.participants.map((p, idx) => {
      const strat = p.strategy || AI_STRATEGIES[idx % AI_STRATEGIES.length];
      const stats = p.stats || { speed: 70, accel: 70, stamina: 70, luck: 70, intellect: 70 };
      const horseName = p.horseName || `${p.name}의 말`;
      const compactHorseName = horseName.replace(/\s*\([^)]*\)/g, '').trim();
      const displayHorseName = /^[\p{Emoji}\u2600-\u27BF]/u.test(compactHorseName)
        ? compactHorseName
        : `🏇 ${compactHorseName}`;
      const menuObj = COFFEE_MENUS.find(m => m.id === p.drinkId);
      const drinkLabel = menuObj ? `☕️ ${menuObj.shortName} (${menuObj.price})` : '🎲 랜덤 음료';
      const isJustAdded = this.lastAddedIds && this.lastAddedIds.has(p.id);

      return `
        <div class="participant-item ${isJustAdded ? 'just-added' : ''}" style="--jockey-color: ${p.color.body};">
          <div class="horse-number-badge" style="background: ${p.color.body}; border: 2px solid ${p.color.border};">
            <span class="gate-num-label">G${idx + 1}</span>
          </div>
          <div class="horse-meta">
            <div class="horse-identity-top">
              <div class="horse-identity-left">
                <span class="horse-name">${escapeHtml(p.name)}</span>
                <span class="horse-nick">✨ #${escapeHtml(p.nickname)}</span>
              </div>
            </div>
            <div class="jockey-control-pills">
              <button type="button" class="horse-draft-badge" data-index="${idx}" title="전용 경주마 변경 및 350pt 능력치 상세 보기: ${escapeHtml(horseName)}">
                <span class="pill-main">${escapeHtml(displayHorseName)}</span>
                <span class="pill-stats">⚡️${stats.speed} 🚀${stats.accel} 🔋${stats.stamina}</span>
              </button>
              <button type="button" class="horse-ai-btn" data-index="${idx}" title="클릭하여 AI 주행 성향 변경: ${escapeHtml(strat.desc)}">
                ${strat.icon} ${escapeHtml(strat.name)}
              </button>
              <button type="button" class="horse-drink-btn" data-index="${idx}" title="클릭하여 희망 음료 변경 (영수증 정산에 반영)">
                ${escapeHtml(drinkLabel)}
              </button>
            </div>
          </div>
          <button type="button" class="delete-btn" data-index="${idx}" title="기수 제외">✕</button>
        </div>
      `;
    }).join('');

    if (this.lastAddedIds && this.lastAddedIds.size > 0) {
      setTimeout(() => {
        this.lastAddedIds.clear();
        if (this.participantListEl) {
          this.participantListEl.querySelectorAll('.participant-item.just-added').forEach(el => {
            el.classList.remove('just-added');
          });
        }
      }, 650);
    }

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

    this.participantListEl.querySelectorAll('.horse-drink-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.currentTarget.dataset.index, 10);
        this.cycleParticipantDrink(index);
      });
    });

    this.participantListEl.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.currentTarget.dataset.index, 10);
        this.removeParticipant(index);
      });
    });

    this.updateCostEstimate();
  }

  updateCostEstimate() {
    const costTextEl = document.getElementById('costCalculationText');
    if (!costTextEl) return;

    const count = this.participants.length;
    if (count === 0) {
      costTextEl.textContent = '참가자를 2명 이상 등록하면 예상 결제 금액이 계산됩니다.';
      return;
    }

    const includeMenu = this.randomCoffeeMenuCheck ? this.randomCoffeeMenuCheck.checked : true;
    const orderPreview = calculateDetailedOrder(this.participants, includeMenu);
    const estimatedTotal = orderPreview.totalAmount || 0;
    const unitPrice = orderPreview.averagePrice || 4500;

    let perPersonDesc = '';
    if (this.selectedRule === 'last1') {
      perPersonDesc = `(꼴찌 1인 전액 ~${estimatedTotal.toLocaleString()}원)`;
    } else if (this.selectedRule === 'last2') {
      const half = Math.round(estimatedTotal / 2);
      perPersonDesc = `(하위 2인 각 ~${half.toLocaleString()}원씩)`;
    } else if (this.selectedRule === 'winnerSafe') {
      const share = count > 1 ? Math.round(estimatedTotal / (count - 1)) : estimatedTotal;
      perPersonDesc = `(1등 제외 각 ~${share.toLocaleString()}원씩)`;
    } else {
      perPersonDesc = `(4등 당첨자 ~${estimatedTotal.toLocaleString()}원)`;
    }

    costTextEl.textContent = `참가 ${count}명 × 평균 ${unitPrice.toLocaleString()}원 = 총 예상 결제액 ~${estimatedTotal.toLocaleString()}원 ${perPersonDesc}`;
  }

  openHorseDraftModal(participantIndex) {
    this.currentDraftingIndex = participantIndex;
    const participant = this.participants[participantIndex];
    if (!participant) return;

    this.draftModalSubtitle.innerHTML = `<strong>[${escapeHtml(participant.name)}]</strong> 님의 전용 경주마를 선택하거나 새 AI 밸런스마를 분양받으세요.`;
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
              <div class="horse-card-name" title="${escapeHtml(horse.name)}">${escapeHtml(horse.name)}</div>
              <div class="horse-card-title">${escapeHtml(horse.title)} | ${strat.icon} ${escapeHtml(strat.name)}</div>
            </div>
          </div>

          <div class="horse-card-lore">
            "${escapeHtml(horse.lore)}"
          </div>

          <div class="stat-bars-container">
            <div class="stat-row">
              <span class="stat-label">⚡️ 최고속도</span>
              <div class="stat-bar-track"><div class="stat-bar-fill" style="width: ${stats.speed}%; background: #EF4444;"></div></div>
              <span class="stat-val">${stats.speed}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">🚀 가속력</span>
              <div class="stat-bar-track"><div class="stat-bar-fill" style="width: ${stats.accel}%; background: #F59E0B;"></div></div>
              <span class="stat-val">${stats.accel}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">🔋 지구력</span>
              <div class="stat-bar-track"><div class="stat-bar-fill" style="width: ${stats.stamina}%; background: #10B981;"></div></div>
              <span class="stat-val">${stats.stamina}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">🍀 행운</span>
              <div class="stat-bar-track"><div class="stat-bar-fill" style="width: ${stats.luck}%; background: #8B5CF6;"></div></div>
              <span class="stat-val">${stats.luck}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">🧠 지능</span>
              <div class="stat-bar-track"><div class="stat-bar-fill" style="width: ${stats.intellect}%; background: #06B6D4;"></div></div>
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
    AILoader.setButtonLoading(this.generateNewAIHorseBtn, true, 'AI 명마 창조 중...');

    await AILoader.run({
      title: '온디바이스 AI 350pt 밸런스 경주마 창조 중...',
      subtitle: `350pt 스탯 예산 최적화 & JSON Schema 페르소나 합성 (${aiEngine.getStatus().shortLabel})`,
      duration: 600,
      logs: [
        { progress: 20, text: `[AI] Engine: ${aiEngine.getStatus().detailLabel}` },
        { progress: 50, text: '[BUDGET] Distributing exactly 350 points across 5 stats (Speed/Accel/Stamina/Luck/Intellect)...' },
        { progress: 100, text: '[COMPLETE] High-performance balanced racehorse created' }
      ],
      onComplete: async ({ onProgress }) => {
        await aiEngine.ensureSession(onProgress);
        const newHorse = await HorseGenerator.generateAIHorse();
        onProgress(88, `[SYNTHESIS] Created '${newHorse.name}' (${newHorse.title})`);
        this.stableHorses.unshift(newHorse);
        this.renderStableGrid();
        this.updateAIEngineBadge();
        this.showToast(`✨ 새 명마 '${newHorse.name}' 이(가) 마구간에 입사했습니다!`);
      }
    });

    AILoader.setButtonLoading(this.generateNewAIHorseBtn, false);
    sound.playClick();
  }

  async autoDraftHorsesForAllParticipants() {
    if (this.participants.length === 0) {
      alert('참가자를 먼저 추가해주세요!');
      return;
    }

    AILoader.setButtonLoading(this.aiAutoDraftHorsesBtn, true, 'AI 말 배정 중...');

    await AILoader.run({
      title: '온디바이스 AI 경주마 자동 매칭 & 별명 동기화 중...',
      subtitle: `참가자 ${this.participants.length}인을 위한 최적 350pt 경주마 & 맞춤 페르소나 매칭`,
      duration: 600,
      logs: [
        { progress: 25, text: `[AI] Engine: ${aiEngine.getStatus().detailLabel}` },
        { progress: 55, text: `[PAIRING] Analyzing ${this.participants.length} participants & matching complementary 350pt horses...` },
        { progress: 100, text: '[COMPLETE] All participants matched with balanced racehorses & AI personas' }
      ],
      onComplete: async ({ onProgress }) => {
        await aiEngine.ensureSession(onProgress);
        const assignments = await aiEngine.recommendHorseDraft(this.participants, this.stableHorses);
        assignments.forEach((item, idx) => {
          const p = this.participants[item.participantIndex];
          if (!p || !item.horse) return;
          p.horseName = item.horse.name;
          p.strategy = item.horse.strategy;
          p.stats = { ...item.horse.stats };
          p.nickname = item.nickname || p.nickname;
          p.color = HORSE_COLORS[idx % HORSE_COLORS.length];
          onProgress(
            Math.round(60 + ((idx + 1) / assignments.length) * 35),
            `[MATCH] ${p.name} ➔ ${p.horseName} (#${p.nickname})`
          );
        });

        this.renderParticipantList();
        this.saveParticipants();
        this.updateAIEngineBadge();
      }
    });

    AILoader.setButtonLoading(this.aiAutoDraftHorsesBtn, false);
    this.showToast('🎲 모든 참가자에게 AI 맞춤 경주마와 신규 별명이 배정되었습니다!');
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

  startRace(overrideSeed = null) {
    this.switchView('race');
    this.setRaceSpeed(1.0);
    this.pauseRaceBtn.innerHTML = '⏸️ 일시정지';
    this.pauseRaceBtn.classList.remove('active');
    this.setCameraMode('lead');

    this.initMiniTrack();
    this.renderer.setHorseCount(this.participants.length);
    this.renderer.reset();
    this.commentator.reset();

    this.engine.setup(this.participants, this.selectedDistance, this.selectedGameMode, {
      seed: overrideSeed,
      statMode: this.selectedStatMode,
      weather: this.selectedWeather
    });
    this.engine.start();

    const modeText = this.selectedGameMode === 'item' ? '🎁 아이템전' : '🏇 스피드전';
    const statText = this.selectedStatMode === STAT_MODES.STATS ? '🔥능력치전' : '⚖️공정추첨';
    const distText = this.selectedDistance <= 1000 ? '1000m' : (this.selectedDistance <= 1600 ? '1600m' : '2400m');
    this.raceDistanceBadge.textContent = `${modeText} · ${statText} (${distText})`;

    const wObj = WEATHER_TYPES[this.engine.weather] || WEATHER_TYPES.sunny;
    if (this.raceWeatherBadge) {
      this.raceWeatherBadge.textContent = `${wObj.icon} ${wObj.name}`;
    }
    const seedCode = seedToCode(this.engine.seed);
    if (this.raceSeedBadge) {
      this.raceSeedBadge.textContent = `SEED #${seedCode}`;
    }

    sound.playGunshot();
    sound.startGallopRhythm();
    this.commentator.onRaceStart(this.participants.length, `${wObj.icon} ${wObj.name}`);

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
    const currentPenaltyTargets = calculatePenaltyHorses(sorted, this.selectedRule);
    const penaltyIdSet = new Set(currentPenaltyTargets.map(h => h.id));

    if (this.liveDangerSummary && currentPenaltyTargets.length > 0) {
      const names = currentPenaltyTargets.map(h => h.name).join(', ');
      this.liveDangerSummary.textContent = `☕️ 현재 당첨위기: ${names}`;
    }

    this.liveRankList.innerHTML = sorted.map((h) => {
      let badgeClass = '';
      if (h.rank === 1) badgeClass = 'gold';
      else if (h.rank === 2) badgeClass = 'silver';
      else if (h.rank === 3) badgeClass = 'bronze';
      else if (penaltyIdSet.has(h.id)) badgeClass = 'tail';

      const isLead = h.rank === 1;
      const isTail = penaltyIdSet.has(h.id);
      const distPercent = Math.round(h.progress * 100);
      const aiIcon = h.strategy ? `<span style="font-size: 11px;" title="${escapeHtml(h.strategy.name)} (${escapeHtml(h.strategy.tag)})">${h.strategy.icon}</span>` : '';
      const heldItemBadge = h.heldItem ? `<span class="held-item-badge" title="보유 중: ${escapeHtml(h.heldItem.name)}">${h.heldItem.icon}</span>` : '';

      return `
        <div class="live-rank-item ${isLead ? 'is-lead' : ''} ${isTail ? 'is-tail' : ''}">
          <div class="rank-horse-tag">
            <span class="rank-badge-num ${badgeClass}">#${h.rank}</span>
            <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${h.color.body};"></span>
            <span>${escapeHtml(h.name)}</span>
            ${aiIcon}
            ${heldItemBadge}
            ${h.shieldActive ? '<span style="font-size: 11px;">🛡️</span>' : ''}
            ${isTail ? '<span style="font-size: 10px; color: #FDA4AF; font-weight: 800;">☕️위기</span>' : ''}
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

    const startX = 140;
    const finishX = this.renderer.trackPixelLength - 220;
    const trackWidthSpan = finishX - startX;
    const horseX = startX + (horse ? horse.progress : 0.5) * trackWidthSpan;
    const horseY = this.renderer.trackTop + (horse ? horse.lane : 0) * this.renderer.laneHeight + this.renderer.laneHeight * 0.5;

    // 1. 아이템 사용 시 발동 효과
    if (type.startsWith('itemUse')) {
      const item = info?.item || horse?.heldItem || { id: 'booster', name: '아이템', icon: '✨' };
      this.renderer.triggerItemUseEffect(horse, item, horseX, horseY);
    }

    // 2. 피격 시 플로팅 피격 배지 & 스파크 발생
    if (type === 'obstacleHit') {
      this.renderer.triggerItemHitEffect(horse, 'banana', info?.attackerName, horseX, horseY);
    } else if (type === 'missileHit') {
      this.renderer.triggerItemHitEffect(horse, 'missile', info?.attackerName || info?.attacker?.name, horseX, horseY);
    } else if (type === 'lightningHit') {
      this.renderer.triggerItemHitEffect(horse, 'lightning', info?.attackerName || info?.attacker?.name, horseX, horseY);
    } else if (type === 'approvalHit') {
      this.renderer.triggerItemHitEffect(horse, 'approval', info?.attackerName || info?.attacker?.name, horseX, horseY);
    } else if (type === 'shieldBlock') {
      this.renderer.triggerItemHitEffect(horse, 'shieldBlock', info?.attackerName || info?.attacker?.name, horseX, horseY);
    }

    // 3. 라스트 스퍼트 구간 진입 시 BGM 템포/키 업!
    if (type === 'lastSpurtPhase') {
      sound.setSpurtMode(true);
    } else if (type === 'photoFinish') {
      sound.playPhotoFinish();
    }

    // 4. 사운드 이펙트
    if (type === 'boost' || type === 'itemUseBooster' || type === 'itemUseMagnet') {
      sound.playBoost();
    } else if (type === 'itemUseEspresso') {
      sound.playEspresso();
    } else if (type === 'itemUseApproval') {
      sound.playApproval();
    } else if (type === 'slip' || type === 'obstacleHit' || type === 'approvalHit') {
      sound.playSlip();
    } else if (type === 'itemPickup') {
      sound.playItemPickup();
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
    }, 550);

    setTimeout(() => {
      this.showResultModal(finalRankings, penaltyHorses);
    }, 1150);
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

    if (this.podiumMeta1) {
      this.podiumMeta1.textContent = winner ? `${winner.finishTime ? winner.finishTime.toFixed(2) : '-'}초 · #${winner.nickname}` : '-';
    }
    if (this.podiumMeta2) {
      this.podiumMeta2.textContent = second ? `${second.finishTime ? second.finishTime.toFixed(2) : '-'}초 · #${second.nickname}` : '-';
    }
    if (this.podiumMeta3) {
      this.podiumMeta3.textContent = third ? `${third.finishTime ? third.finishTime.toFixed(2) : '-'}초 · #${third.nickname}` : '-';
    }

    if (this.podiumAvatar1 && winner?.color) {
      this.podiumAvatar1.style.background = winner.color.body;
      this.podiumAvatar1.style.border = `2px solid ${winner.color.border}`;
    }
    if (this.podiumAvatar2 && second?.color) {
      this.podiumAvatar2.style.background = second.color.body;
      this.podiumAvatar2.style.border = `2px solid ${second.color.border}`;
    }
    if (this.podiumAvatar3 && third?.color) {
      this.podiumAvatar3.style.background = third.color.body;
      this.podiumAvatar3.style.border = `2px solid ${third.color.border}`;
    }

    // 포토 피니시 배너 표시
    if (this.photoFinishBanner) {
      const pf = this.engine.photoFinishInfo;
      if (pf) {
        this.photoFinishBanner.style.display = 'inline-flex';
        const gapStr = pf.gapSeconds.toFixed(2);
        if (pf.type === 'tail') {
          this.photoFinishBanner.textContent = `📸 꼴찌 초접전 포토 피니시! (${pf.survivor.name} vs ${pf.victim.name} · 불과 ${gapStr}초 차이!)`;
        } else {
          this.photoFinishBanner.textContent = `📸 1위 결승 초접전 포토 피니시! (${pf.winner.name} vs ${pf.runnerUp.name} · ${gapStr}초 차이!)`;
        }
      } else {
        this.photoFinishBanner.style.display = 'none';
      }
    }

    // 경기 MVP 하이라이트 배지 렌더링
    if (this.mvpAwardsContainer) {
      const awards = computeRaceMVPs(finalRankings);
      this.mvpAwardsContainer.innerHTML = awards.map(a => `
        <div class="mvp-award-card">
          <span class="mvp-badge-tag">${escapeHtml(a.badge)}</span>
          <span class="mvp-player-name">${escapeHtml(a.title)}님</span>
          <span class="mvp-award-desc">${escapeHtml(a.desc)}</span>
        </div>
      `).join('');
    }

    const penaltyNames = penaltyHorses.map(h => `${h.name}님`).join(', ');
    this.receiptPayerName.textContent = `${penaltyNames} (결제 확정)`;

    const ruleText = RULE_DESCRIPTIONS[this.selectedRule] || '커피내기 벌칙';
    this.receiptRuleDesc.textContent = ruleText;

    const seedCode = seedToCode(this.engine.seed);
    const now = new Date();
    const dateStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    this.receiptDate.textContent = `${dateStr} | SEED: #${seedCode}`;

    // 시드 파생 난수로 커피 메뉴 결정 (같은 시드면 추천 메뉴도 동일!)
    const menuRng = createRng(deriveSeed(this.engine.seed, 777));
    const detailedOrder = calculateDetailedOrder(finalRankings, this.includeCoffeeMenu, menuRng);
    const totalEstimatedPrice = detailedOrder.totalAmount;
    const perPayerAmount = penaltyHorses.length > 0 ? Math.round(totalEstimatedPrice / penaltyHorses.length) : totalEstimatedPrice;

    // 상단 스포트라이트 배너 (우승자 vs 커피 결제자) 업데이트
    if (this.spotlightWinnerName) {
      this.spotlightWinnerName.textContent = winner ? `${winner.name}님` : '-';
    }
    if (this.spotlightWinnerMeta) {
      const winTime = winner?.finishTime ? `${winner.finishTime.toFixed(2)}초` : '-';
      const rawHorse = winner?.horseName || '전용마';
      const horseLabel = /^[\p{Emoji}\u2600-\u27BF]/u.test(rawHorse) ? rawHorse : `🏇 ${rawHorse}`;
      this.spotlightWinnerMeta.textContent = `${horseLabel} · 완주 ${winTime} (추월 ${winner?.overtakes || 0}회)`;
    }
    if (this.spotlightPayerName) {
      this.spotlightPayerName.textContent = penaltyNames || '-';
    }
    if (this.spotlightPayerMeta) {
      const splitLabel = penaltyHorses.length > 1
        ? `1인당 약 ${perPayerAmount.toLocaleString()}원 (${penaltyHorses.length}인 분담)`
        : `총 ${finalRankings.length}잔 전액 (${ruleText})`;
      this.spotlightPayerMeta.textContent = `💰 예상 결제액 ${totalEstimatedPrice.toLocaleString()}원 · ${splitLabel}`;
    }

    this.receiptMenuItems.innerHTML = detailedOrder.items.map(item => `
      <div class="receipt-row">
        <span>${escapeHtml(item.menu.name)}</span>
        <span>${item.count}잔 / ${item.subtotal.toLocaleString()}원</span>
      </div>
      <div class="receipt-row" style="font-size: 11px; color: #64748B;">
        <span>└ 주문: ${escapeHtml(item.names.join(', '))}</span>
        <span>${escapeHtml(item.menu.price)}/잔</span>
      </div>
    `).join('');

    this.receiptTotalAmount.textContent = `${totalEstimatedPrice.toLocaleString()}원`;

    if (this.receiptPerPersonRow && this.receiptPerPersonAmount) {
      if (penaltyHorses.length > 1) {
        this.receiptPerPersonRow.style.display = 'flex';
        this.receiptPerPersonAmount.textContent = `1인당 약 ${perPayerAmount.toLocaleString()}원 (${penaltyHorses.length}인 분담)`;
      } else {
        this.receiptPerPersonRow.style.display = 'none';
      }
    }

    // 명예의 전당 누적 전적 기록 저장
    this.hallOfFameStats = StatsManager.recordRaceResult(this.hallOfFameStats, {
      finalRankings,
      penaltyHorses,
      totalAmount: totalEstimatedPrice,
      ruleDesc: ruleText,
      seedCode,
      gameMode: this.selectedGameMode,
      distance: this.selectedDistance
    });
    StatsManager.saveStats(this.hallOfFameStats);
    this.updateHallOfFameBadge();

    // 온디바이스 AI 특종 기사 1면 실시간 스트리밍 생성 (LanguageModel.promptStreaming 지원)
    if (this.aiArticleContent) {
      const aiStatus = aiEngine.getStatus();
      this.aiArticleContent.innerHTML = `
        <div class="ai-reporter-loading">
          <div class="ai-reporter-badge">
            <span class="ai-live-dot"></span> 🧠 온디바이스 AI 특파원(${escapeHtml(aiStatus.shortLabel)})이 경기 텔레메트리를 분석 중...
          </div>
          <div class="ai-skeleton-lines">
            <div class="ai-skeleton-line" style="width: 95%;"></div>
            <div class="ai-skeleton-line" style="width: 80%;"></div>
            <div class="ai-skeleton-line" style="width: 88%;"></div>
          </div>
        </div>
      `;

      const wObj = WEATHER_TYPES[this.engine.weather] || WEATHER_TYPES.sunny;
      const raceContext = {
        photoFinishInfo: this.engine.photoFinishInfo,
        weatherName: wObj.name
      };

      let streamStarted = false;
      let textSpan = null;

      aiEngine.streamPostRaceArticle(
        winner,
        penaltyHorses,
        finalRankings.length,
        ruleText,
        totalEstimatedPrice,
        raceContext,
        (delta) => {
          if (!this.aiArticleContent) return;
          if (!streamStarted) {
            streamStarted = true;
            this.aiArticleContent.textContent = '';
            textSpan = document.createElement('span');
            textSpan.className = 'ai-article-text';
            const cursorSpan = document.createElement('span');
            cursorSpan.className = 'ai-cursor';
            cursorSpan.textContent = '▌';
            this.aiArticleContent.appendChild(textSpan);
            this.aiArticleContent.appendChild(cursorSpan);
          }
          if (textSpan) {
            textSpan.textContent += delta;
          }
        }
      ).then((finalText) => {
        if (!this.aiArticleContent) return;
        if (!streamStarted) {
          this.aiArticleContent.textContent = finalText;
        } else {
          const cursor = this.aiArticleContent.querySelector('.ai-cursor');
          if (cursor) cursor.remove();
        }
        this.updateAIEngineBadge();
      });
    }

    const randomFootnote = FUNNY_RECEIPT_NOTES[Math.floor(menuRng() * FUNNY_RECEIPT_NOTES.length)];
    this.receiptFooterNotes.innerHTML = `
      ${escapeHtml(randomFootnote)}<br>
      * 검증 시드 코드: <strong>#${escapeHtml(seedCode)}</strong>
    `;

    this.modalRankList.innerHTML = finalRankings.map(h => {
      const isWinner = h.rank === 1;
      const isPenalty = penaltyHorses.some(ph => ph.id === h.id);
      const timeStr = `${h.finishTime ? h.finishTime.toFixed(2) : '-'}초`;
      const stratTag = h.strategy ? `<span class="rank-strat-chip">${h.strategy.icon} ${escapeHtml(h.strategy.name)}</span>` : '';
      const telemetryTag = `<span class="rank-telemetry-chip">⚡추월 ${h.overtakes || 0} · 🎁아이템 ${h.itemsUsed || 0}</span>`;

      let badgeIcon = `#${h.rank}`;
      if (h.rank === 1) badgeIcon = '🥇 1위';
      else if (h.rank === 2) badgeIcon = '🥈 2위';
      else if (h.rank === 3) badgeIcon = '🥉 3위';
      else if (isPenalty) badgeIcon = `☕️ ${h.rank}위 (결제)`;

      return `
        <div class="modal-rank-row ${isWinner ? 'winner' : ''} ${isPenalty ? 'loser' : ''}">
          <div class="modal-rank-left">
            <span class="modal-rank-badge ${isWinner ? 'gold' : (isPenalty ? 'rose' : '')}">${badgeIcon}</span>
            <span class="modal-rank-dot" style="background: ${h.color?.body || '#F59E0B'};"></span>
            <span class="modal-rank-name">${escapeHtml(h.name)}</span>
            <span class="modal-rank-nick">#${escapeHtml(h.nickname)}</span>
            ${stratTag}
            ${telemetryTag}
          </div>
          <div class="modal-rank-time">
            ${timeStr}
          </div>
        </div>
      `;
    }).join('');

    this.resultModal.classList.add('active');
    this.cachedResultData = {
      finalRankings,
      penaltyHorses,
      winner,
      penaltyNames,
      totalEstimatedPrice,
      perPayerAmount,
      seed: this.engine.seed,
      seedCode,
      detailedOrder,
      receiptExportPayload: {
        payerNames: penaltyNames,
        ruleDesc: ruleText,
        dateStr,
        seedCode,
        orderItems: detailedOrder.items,
        totalAmount: totalEstimatedPrice,
        perPayerAmount,
        payerCount: penaltyHorses.length,
        totalCount: finalRankings.length,
        winnerName: winner ? winner.name : '-',
        footnote: randomFootnote
      }
    };
  }

  copyFormattedResultToClipboard() {
    if (!this.cachedResultData) return;

    const {
      finalRankings,
      penaltyHorses,
      winner,
      penaltyNames,
      totalEstimatedPrice,
      perPayerAmount,
      seedCode,
      detailedOrder
    } = this.cachedResultData;

    const rankingText = finalRankings.map(h => {
      const isPenalty = penaltyHorses.some(ph => ph.id === h.id);
      const mark = h.rank === 1 ? '👑' : (isPenalty ? '☕️' : '▫️');
      const strat = h.strategy ? ` [AI:${h.strategy.name}]` : '';
      return `${mark} ${h.rank}위: ${h.name} (#${h.nickname})${strat} (${h.finishTime ? h.finishTime.toFixed(2) : '-'}초)`;
    }).join('\n');

    const orderText = detailedOrder?.items
      ? detailedOrder.items.map(it => `- ${it.menu.name}: ${it.count}잔 (${it.names.join(', ')})`).join('\n')
      : '';

    const shareSplitNote = penaltyHorses.length > 1
      ? ` (1인당 약 ${perPayerAmount.toLocaleString()}원씩)`
      : '';

    const aiArticleSnippet = this.aiArticleContent && this.aiArticleContent.textContent
      ? `\n${this.aiArticleContent.textContent.split('\n')[0]}\n`
      : '';

    const formattedMessage = `
[오피스 더비] 오늘의 커피내기 경마 결과 발표! 🏇☕️
==========================================${aiArticleSnippet}
👑 1위 (명예의 전당): ${winner ? winner.name : '-'}님!
🎯 커피 결제자 (당첨): ${penaltyNames} ☕️
📌 벌칙 룰: ${this.receiptRuleDesc.textContent}
💰 예상 결제 금액: 약 ${totalEstimatedPrice.toLocaleString()}원 (${finalRankings.length}잔)${shareSplitNote}
🔐 공정성 검증 시드: #${seedCode}
==========================================
☕️ 주문 음료 내역:
${orderText}
------------------------------------------
📊 전체 완주 순위:
${rankingText}
------------------------------------------
* ${penaltyNames} 영수증 지참하여 카페로 출발해주세요! 🏃‍♂️💨
    `.trim();

    navigator.clipboard.writeText(formattedMessage).then(() => {
      this.showToast('📋 슬랙/카톡 공유용 결과가 클립보드에 복사되었습니다!');
    }).catch(() => {
      const textarea = document.createElement('textarea');
      textarea.value = formattedMessage;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      this.showToast('📋 슬랙/카톡 공유용 결과가 클립보드에 복사되었습니다!');
    });
  }

  updateHallOfFameBadge() {
    if (this.hallOfFameCountBadge && this.hallOfFameStats) {
      this.hallOfFameCountBadge.textContent = `${this.hallOfFameStats.totalRaces || 0}`;
    }
  }

  openHallOfFameModal() {
    this.renderHallOfFameContent();
    this.hallOfFameModal.classList.add('active');
    sound.playClick();
  }

  renderHallOfFameContent() {
    const s = this.hallOfFameStats || StatsManager.createEmptyState();
    if (this.hofTotalRaces) this.hofTotalRaces.textContent = `${s.totalRaces}회`;
    if (this.hofTotalCups) this.hofTotalCups.textContent = `${s.totalCoffeeCups}잔`;
    if (this.hofTotalSpent) this.hofTotalSpent.textContent = `${(s.totalMoneySpent || 0).toLocaleString()}원`;

    const { topPayers, topWinners } = StatsManager.getRankings(s);

    if (this.hofPayerList) {
      if (topPayers.length === 0) {
        this.hofPayerList.innerHTML = `<div style="color: var(--text-muted); font-size: 12px; padding: 12px; text-align: center;">아직 기록된 레이스가 없습니다.</div>`;
      } else {
        this.hofPayerList.innerHTML = topPayers.slice(0, 8).map((p, idx) => `
          <div class="hof-row">
            <div>
              <strong style="color: ${idx === 0 ? 'var(--accent-rose)' : '#F8FAFC'};">#${idx + 1} ${escapeHtml(p.name)}</strong>
              <span style="font-size: 11px; color: var(--text-muted);"> (${p.penalties}회 당첨 / ${p.races}전)</span>
            </div>
            <span style="font-family: monospace; font-weight: 800; color: #FDA4AF;">${p.totalSpent.toLocaleString()}원</span>
          </div>
        `).join('');
      }
    }

    if (this.hofWinnerList) {
      if (topWinners.length === 0) {
        this.hofWinnerList.innerHTML = `<div style="color: var(--text-muted); font-size: 12px; padding: 12px; text-align: center;">아직 기록된 레이스가 없습니다.</div>`;
      } else {
        this.hofWinnerList.innerHTML = topWinners.slice(0, 8).map((p, idx) => {
          const winRate = p.races > 0 ? Math.round((p.wins / p.races) * 100) : 0;
          return `
            <div class="hof-row">
              <div>
                <strong style="color: ${idx === 0 ? 'var(--accent-gold)' : '#F8FAFC'};">#${idx + 1} ${escapeHtml(p.name)}</strong>
                <span style="font-size: 11px; color: var(--text-muted);"> (승률 ${winRate}%)</span>
              </div>
              <span style="font-family: monospace; font-weight: 800; color: var(--accent-gold);">${p.wins}승 / ${p.races}전</span>
            </div>
          `;
        }).join('');
      }
    }

    if (this.hofHistoryList) {
      const history = s.history || [];
      if (history.length === 0) {
        this.hofHistoryList.innerHTML = `<div style="color: var(--text-muted); font-size: 12px; padding: 12px; text-align: center;">최근 경기 기록이 없습니다.</div>`;
      } else {
        this.hofHistoryList.innerHTML = history.map(item => `
          <div class="hof-history-item">
            <div>
              <span style="color: var(--accent-gold); font-weight: 700;">👑 ${escapeHtml(item.winnerName)}</span>
              <span style="color: var(--text-muted); margin: 0 4px;">|</span>
              <span style="color: #FDA4AF; font-weight: 700;">☕️ 결제: ${escapeHtml((item.payerNames || []).join(', '))}</span>
              <span style="font-size: 11px; color: var(--text-muted);"> (${(item.totalAmount || 0).toLocaleString()}원)</span>
            </div>
            <div style="font-family: monospace; font-size: 11px; color: var(--text-secondary);">
              SEED #${escapeHtml(item.seedCode || '-')}
            </div>
          </div>
        `).join('');
      }
    }
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
