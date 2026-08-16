/**
 * commentator.js - 실시간 아나운서 중계 멘트 생성 시스템
 */

import { COMMENTARY_MESSAGES } from './presets.js';

export class Commentator {
  constructor(containerElement) {
    this.container = containerElement;
    this.messages = [];
    this.maxMessages = 4;
    this.lastLeadHorseId = null;
    this.lastCommentTime = 0;
    this.minInterval = 1.6; // 최소 멘트 간격(초)
  }

  reset() {
    this.messages = [];
    this.lastLeadHorseId = null;
    this.lastCommentTime = 0;
    if (this.container) {
      this.container.innerHTML = '<div class="comment-item init">🎙️ 출발 준비 중... 중계석 대기 완료!</div>';
    }
  }

  addMessage(text, type = 'normal') {
    const timeStr = new Date().toTimeString().slice(3, 8);
    const msgObj = { text, type, time: timeStr, id: Date.now() + Math.random() };

    this.messages.push(msgObj);
    if (this.messages.length > this.maxMessages) {
      this.messages.shift();
    }

    this.render();
  }

  render() {
    if (!this.container) return;

    this.container.innerHTML = this.messages.map(m => {
      let icon = '📢';
      if (m.type === 'boost') icon = '⚡️';
      else if (m.type === 'slip') icon = '💦';
      else if (m.type === 'danger') icon = '🚨';
      else if (m.type === 'spurt') icon = '🔥';
      else if (m.type === 'finish') icon = '🏁';
      else if (m.type === 'penalty') icon = '☕️';

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
    if (type === 'boost') {
      const templates = COMMENTARY_MESSAGES.boost;
      const tpl = templates[Math.floor(Math.random() * templates.length)];
      this.addMessage(tpl.replace('{name}', horse.name), 'boost');
    } else if (type === 'slip') {
      const templates = COMMENTARY_MESSAGES.slip;
      const tpl = templates[Math.floor(Math.random() * templates.length)];
      this.addMessage(tpl.replace('{name}', horse.name), 'slip');
    } else if (type === 'itemPickup') {
      this.addMessage(`🎁 [${horse.name}]님, [${info.item.name}] 획득!`, 'normal');
    } else if (type === 'itemUseBooster') {
      this.addMessage(`🚀 [${horse.name}]님, 부스터 발동! 폭풍 질주!`, 'boost');
    } else if (type === 'itemUseBanana') {
      this.addMessage(`🍌 [${horse.name}]님, 트랙에 바나나 투척!`, 'normal');
    } else if (type === 'itemUseShield') {
      this.addMessage(`🛡️ [${horse.name}]님, 방어막 생성!`, 'normal');
    } else if (type === 'itemUseLightning') {
      this.addMessage(`⚡️ [${horse.name}]님, 번개 발동! 선두권 전원 감전!`, 'danger');
    } else if (type === 'itemUseMissile') {
      this.addMessage(`🎯 [${horse.name}]님, 선두 [${info.target.name}]님을 향해 미사일 발사!`, 'spurt');
    } else if (type === 'itemUseMagnet') {
      this.addMessage(`🧲 [${horse.name}]님, 자석으로 선두를 향해 견인 질주!`, 'boost');
    } else if (type === 'shieldBlock') {
      this.addMessage(`🛡️ [${horse.name}]님, 방어막으로 공격 완벽 방어!`, 'finish');
    } else if (type === 'obstacleHit') {
      this.addMessage(`🍌 앗! [${horse.name}]님, 바나나 밟고 빙글빙글 스핀!`, 'slip');
    } else if (type === 'missileHit') {
      this.addMessage(`💥 쾅! [${horse.name}]님, 미사일 직격타로 일시 정지!`, 'danger');
    }
  }

  onLeadChange(newLeader, oldLeader) {
    if (Math.random() < 0.6) {
      this.addMessage(`🔄 역전! [${newLeader.name}]님이 선두로 치고 나옵니다!`, 'boost');
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
