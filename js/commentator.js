/**
 * commentator.js - 실시간 아나운서 중계 멘트 생성 시스템
 */

import { COMMENTARY_MESSAGES } from './presets.js';
import { aiEngine } from './aiEngine.js';

export class Commentator {
  constructor(containerElement) {
    this.container = containerElement;
    this.messages = [];
    this.maxMessages = 40;
    this.lastLeadChangeTime = 0;
  }

  reset() {
    this.messages = [];
    if (this.container) {
      this.container.innerHTML = '';
    }
  }

  addMessage(text, type = 'normal') {
    const timestamp = new Date();
    const timeStr = `${String(timestamp.getSeconds()).padStart(2, '0')}.${Math.floor(timestamp.getMilliseconds() / 100)}`;
    
    this.messages.push({ text, type, time: timeStr });
    if (this.messages.length > this.maxMessages) {
      this.messages.shift();
    }
    this.render();
  }

  render() {
    if (!this.container) return;

    const icons = {
      normal: '💬',
      boost: '⚡️',
      slip: '💦',
      danger: '🚨',
      spurt: '🔥',
      finish: '🏁',
      penalty: '☕️'
    };

    this.container.innerHTML = this.messages.map(m => {
      const icon = icons[m.type] || '💬';
      return `<div class="comment-item ${m.type} animate-in">
        <span class="comment-icon">${icon}</span>
        <span class="comment-text">${m.text}</span>
      </div>`;
    }).join('');

    // 자동 아래로 스크롤
    this.container.scrollTop = this.container.scrollHeight;
  }

  onRaceStart(horseCount) {
    const randomStart = COMMENTARY_MESSAGES.start[Math.floor(Math.random() * COMMENTARY_MESSAGES.start.length)];
    this.addMessage(`${randomStart} (총 ${horseCount}두 출전)`, 'spurt');
  }

  onEvent(type, horse, info) {
    const aiComments = aiEngine.generateLiveCommentary(type, horse, info);
    const chosen = aiComments[Math.floor(Math.random() * aiComments.length)];

    let msgType = 'normal';
    if (type === 'boost' || type === 'itemUseBooster' || type === 'itemUseMagnet') msgType = 'boost';
    else if (type === 'slip' || type === 'obstacleHit') msgType = 'slip';
    else if (type === 'itemUseLightning' || type === 'missileHit') msgType = 'danger';
    else if (type === 'itemUseMissile') msgType = 'spurt';
    else if (type === 'shieldBlock') msgType = 'finish';

    this.addMessage(chosen, msgType);
  }

  onLeadChange(newLeader, oldLeader) {
    if (Math.random() < 0.7) {
      const aiComments = aiEngine.generateLiveCommentary('leadChange', newLeader);
      const chosen = aiComments[Math.floor(Math.random() * aiComments.length)];
      this.addMessage(chosen, 'boost');
    }
  }

  onTailDanger(tailHorse, secondTail) {
    if (tailHorse && Math.random() < 0.4) {
      this.addMessage(`🚨 비상! [${tailHorse.name}]님 지갑에 빨간불! 꼴찌 탈출이 시급합니다!`, 'danger');
    }
  }

  onLastSpurt() {
    const templates = COMMENTARY_MESSAGES.lastSpurt;
    const tpl = templates[Math.floor(Math.random() * templates.length)];
    this.addMessage(tpl, 'spurt');
  }

  onHorseFinish(horse, rank) {
    if (rank === 1) {
      this.addMessage(`🏆 1위 골인!! 영광의 우승자는 [${horse.name}]님!!`, 'finish');
    } else if (rank === 2) {
      this.addMessage(`🥈 2위 [${horse.name}]님 결승선 통과!`, 'normal');
    }
  }

  onAllFinish(winner, penaltyHorses, ruleMode) {
    const penaltyNames = penaltyHorses.map(h => `[${h.name}]`).join(', ');
    this.addMessage(`🏁 경기 종료! 오늘의 커피 결제자: ${penaltyNames} 당첨! ☕️`, 'penalty');
  }
}
