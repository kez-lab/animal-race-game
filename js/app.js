/**
 * app.js - 오피스 더비 메인 애플리케이션 라이프사이클 및 UI 제어
 * 아이템전 모드 및 로컬 스토리지 기반 커스텀 프리셋 관리 지원
 */

import { HORSE_COLORS, OFFICE_NICKNAMES, DEFAULT_PRESETS, COFFEE_MENUS, FUNNY_RECEIPT_NOTES } from './presets.js';
import { sound } from './sound.js';
import { RaceEngine } from './raceEngine.js';
import { CanvasRenderer } from './canvasRenderer.js';
import { Commentator } from './commentator.js';

class OfficeDerbyApp {
  constructor() {
    this.participants = [];
    this.customPresets = [];
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
    this.startRaceBtn = document.getElementById('startRaceBtn');
    this.randomCoffeeMenuCheck = document.getElementById('randomCoffeeMenuCheck');

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
    const savedPresets = localStorage.getItem('office_derby_custom_presets');
    if (savedPresets) {
      try {
        this.customPresets = JSON.parse(savedPresets);
      } catch (e) {
        this.customPresets = [...DEFAULT_PRESETS];
      }
    } else {
      this.customPresets = [...DEFAULT_PRESETS];
    }
    this.renderPresetChips();

    // 2. 참가자 목록 로드
    const savedParticipants = localStorage.getItem('office_derby_participants');
    if (savedParticipants) {
      try {
        const parsed = JSON.parse(savedParticipants);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.participants = parsed;
        }
      } catch (e) {
        console.warn('Failed to parse saved participants', e);
      }
    }

    if (this.participants.length === 0) {
      // 첫 프리셋 적용
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
      localStorage.setItem('office_derby_participants', JSON.stringify(this.participants));
    } catch (e) {}
  }

  savePresets() {
    try {
      localStorage.setItem('office_derby_custom_presets', JSON.stringify(this.customPresets));
    } catch (e) {}
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

    // 클릭 시 프리셋 적용
    this.presetChipsContainer.querySelectorAll('.preset-chip-title').forEach(el => {
      el.addEventListener('click', (e) => {
        const index = parseInt(e.currentTarget.dataset.index, 10);
        this.applyPreset(this.customPresets[index]);
      });
    });

    // 삭제 버튼
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
      return { id: idx + 1, name, nickname, color };
    });

    this.renderParticipantList();
    this.saveParticipants();
    this.showToast(`'${preset.name}' 명단이 불러와졌습니다.`);
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

  addSingleParticipant(name) {
    if (this.participants.length >= 12) {
      alert('참가자는 최대 12명까지 등록 가능합니다.');
      return;
    }

    const idx = this.participants.length;
    const color = HORSE_COLORS[idx % HORSE_COLORS.length];
    const randomNick = OFFICE_NICKNAMES[Math.floor(Math.random() * OFFICE_NICKNAMES.length)];

    this.participants.push({
      id: Date.now() + Math.floor(Math.random() * 1000),
      name: name.slice(0, 12),
      nickname: randomNick,
      color: color
    });

    this.renderParticipantList();
    this.saveParticipants();
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

    this.participantListEl.innerHTML = this.participants.map((p, idx) => `
      <div class="participant-item">
        <div class="horse-info">
          <div class="horse-number-badge" style="background: ${p.color.body}; border: 2px solid ${p.color.border};">
            ${idx + 1}
          </div>
          <div class="horse-meta">
            <span class="horse-name">${p.name}</span>
            <span class="horse-nick">#${p.nickname}</span>
          </div>
        </div>
        <button class="delete-btn" data-index="${idx}" title="삭제">✕</button>
      </div>
    `).join('');

    this.participantListEl.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.currentTarget.dataset.index, 10);
        this.removeParticipant(index);
      });
    });
  }

  switchView(viewName) {
    if (viewName === 'setup') {
      this.setupView.classList.add('active');
      this.raceView.classList.remove('active');
    } else if (viewName === 'race') {
      this.setupView.classList.remove('active');
      this.raceView.classList.add('active');
    }
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

      return `
        <div class="live-rank-item ${isLead ? 'is-lead' : ''} ${isTail ? 'is-tail' : ''}">
          <div class="rank-horse-tag">
            <span class="rank-badge-num ${badgeClass}">#${h.rank}</span>
            <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${h.color.body};"></span>
            <span>${h.name}</span>
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
    const total = finalRankings.length;
    let penaltyHorses = [];

    if (this.selectedRule === 'last1') {
      penaltyHorses = [finalRankings[total - 1]];
    } else if (this.selectedRule === 'last2') {
      penaltyHorses = [finalRankings[total - 1], finalRankings[total - 2]].filter(Boolean);
    } else if (this.selectedRule === 'winnerSafe') {
      penaltyHorses = finalRankings.slice(1);
    } else if (this.selectedRule === 'randomTarget') {
      const targetRank = total >= 4 ? 4 : Math.ceil(total / 2);
      penaltyHorses = [finalRankings[targetRank - 1]];
    } else {
      penaltyHorses = [finalRankings[total - 1]];
    }

    return penaltyHorses;
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

    const ruleDescriptions = {
      last1: '☕️ 꼴찌 1명 전원 커피 몰빵',
      last2: '👥 하위 2명 균등 뿜빠이',
      winnerSafe: '👑 1등 제외 전원 균등 분담',
      randomTarget: '🎯 지정 순위(4등) 깜짝 벌칙'
    };
    this.receiptRuleDesc.textContent = ruleDescriptions[this.selectedRule] || '커피내기 벌칙';

    const now = new Date();
    const dateStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    this.receiptDate.textContent = `${dateStr} | 주문번호: #${Math.floor(1000 + Math.random() * 9000)}`;

    const totalCount = finalRankings.length;
    let menuHtml = '';
    let totalEstimatedPrice = 0;

    if (this.includeCoffeeMenu) {
      const pickedMenu = COFFEE_MENUS[Math.floor(Math.random() * COFFEE_MENUS.length)];
      const basePrice = parseInt(pickedMenu.price.replace(/[^0-9]/g, ''), 10);
      totalEstimatedPrice = basePrice * totalCount;

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
      totalEstimatedPrice = 4500 * totalCount;
      menuHtml = `
        <div class="receipt-row">
          <span>☕️ 아이스 아메리카노 외 음료</span>
          <span>총 ${totalCount}잔</span>
        </div>
      `;
    }

    this.receiptMenuItems.innerHTML = menuHtml;
    this.receiptTotalAmount.textContent = `${totalEstimatedPrice.toLocaleString()}원`;

    const randomFootnote = FUNNY_RECEIPT_NOTES[Math.floor(Math.random() * FUNNY_RECEIPT_NOTES.length)];
    this.receiptFooterNotes.innerHTML = `
      ${randomFootnote}<br>
      * 승패에 승복하고 쿨하게 결제하는 멋진 팀원이 됩시다 ☕️
    `;

    this.modalRankList.innerHTML = finalRankings.map(h => {
      const isWinner = h.rank === 1;
      const isPenalty = penaltyHorses.some(ph => ph.id === h.id);
      const timeStr = `${h.finishTime ? h.finishTime.toFixed(1) : '-'}초`;

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

    const { finalRankings, penaltyHorses, totalEstimatedPrice } = this.cachedResultData;
    const winner = finalRankings[0];
    const penaltyNames = penaltyHorses.map(h => `${h.name}님`).join(', ');

    const rankingText = finalRankings.map(h => {
      const isPenalty = penaltyHorses.some(ph => ph.id === h.id);
      const mark = h.rank === 1 ? '👑' : (isPenalty ? '☕️' : '▫️');
      return `${mark} ${h.rank}위: ${h.name} (${h.finishTime ? h.finishTime.toFixed(1) : '-'}초)`;
    }).join('\n');

    const formattedMessage = `
[오피스 더비] 오늘의 커피내기 경마 결과 발표! 🏇☕️
==========================================
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
