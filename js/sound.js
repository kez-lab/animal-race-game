/**
 * sound.js - Web Audio API 기반 오디오 신디사이저 엔진
 * 외부 MP3 의존 없이 브라우저 내장 Web Audio API로 100% 실감 사운드 생성
 */

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.masterGain = null;
    this.gallopInterval = null;
    this.bgmGain = null;
    this.initialized = false;
  }

  init() {
    if (this.initialized && this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.7, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
      this.initialized = true;
    } catch (e) {
      console.warn('Web Audio API not supported', e);
    }
  }

  resume() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setMute(mute) {
    this.isMuted = mute;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.masterGain.gain.setValueAtTime(mute ? 0 : 0.7, this.ctx.currentTime);
    }
  }

  setVolume(val) {
    if (this.masterGain && this.ctx && !this.isMuted) {
      this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.masterGain.gain.setValueAtTime(Math.max(0, Math.min(1, val)), this.ctx.currentTime);
    }
  }

  // 출발 총성 (Gunshot/Buzzer)
  playGunshot() {
    this.resume();
    if (!this.ctx || this.isMuted) return;

    const t = this.ctx.currentTime;

    // 1. Noise Burst
    const bufferSize = this.ctx.sampleRate * 0.4;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1200, t);
    filter.frequency.exponentialRampToValueAtTime(100, t + 0.35);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(1.0, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

    whiteNoise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    whiteNoise.start(t);

    // 2. Low Thump
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + 0.25);

    oscGain.gain.setValueAtTime(0.8, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

    osc.connect(oscGain);
    oscGain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.3);
  }

  // 말발굽 단일 비트 소리 (Clip-clop)
  playSingleHoof(pitchMod = 1.0, pan = 0.0) {
    if (!this.ctx || this.isMuted) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180 * pitchMod, t);
    osc.frequency.exponentialRampToValueAtTime(70 * pitchMod, t + 0.04);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(800 * pitchMod, t);
    filter.Q.setValueAtTime(2.5, t);

    gain.gain.setValueAtTime(0.22, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

    osc.connect(filter);
    filter.connect(gain);

    if (this.ctx.createStereoPanner) {
      const panner = this.ctx.createStereoPanner();
      panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), t);
      gain.connect(panner);
      panner.connect(this.masterGain);
    } else {
      gain.connect(this.masterGain);
    }

    osc.start(t);
    osc.stop(t + 0.06);
  }

  // 레이스 중 다그닥다그닥 말발굽 루프 시작
  startGallopRhythm() {
    this.stopGallopRhythm();
    this.resume();

    let step = 0;
    this.gallopInterval = setInterval(() => {
      if (this.isMuted || !this.ctx) return;
      const pitch = step % 2 === 0 ? 1.0 : 0.88;
      const pan = Math.sin(step * 0.4) * 0.4;
      this.playSingleHoof(pitch, pan);
      step++;
    }, 110);
  }

  // 말발굽 루프 정지
  stopGallopRhythm() {
    if (this.gallopInterval) {
      clearInterval(this.gallopInterval);
      this.gallopInterval = null;
    }
  }

  // 부스터 효과음 (Swoosh & Chime)
  playBoost() {
    this.resume();
    if (!this.ctx || this.isMuted) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(880, t + 0.35);

    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.42);

    // 높은 화음 딩동
    const bell = this.ctx.createOscillator();
    const bellGain = this.ctx.createGain();
    bell.type = 'sine';
    bell.frequency.setValueAtTime(1046.5, t + 0.1); // C6
    bell.frequency.setValueAtTime(1318.5, t + 0.2); // E6
    bellGain.gain.setValueAtTime(0.2, t + 0.1);
    bellGain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

    bell.connect(bellGain);
    bellGain.connect(this.masterGain);
    bell.start(t + 0.1);
    bell.stop(t + 0.5);
  }

  // 아이템 획득 사운드 (Item Box Pickup)
  playItemPickup() {
    this.resume();
    if (!this.ctx || this.isMuted) return;
    const t = this.ctx.currentTime;

    const freqs = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    freqs.forEach((f, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t + i * 0.05);
      gain.gain.setValueAtTime(0.2, t + i * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.05 + 0.15);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t + i * 0.05);
      osc.stop(t + i * 0.05 + 0.18);
    });
  }

  // 번개 공격 사운드 (Lightning Zap)
  playLightning() {
    this.resume();
    if (!this.ctx || this.isMuted) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1200, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.25);

    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.32);
  }

  // 미사일 폭발음 (Missile Explosion)
  playMissileHit() {
    this.resume();
    if (!this.ctx || this.isMuted) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(20, t + 0.35);

    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.4);
  }

  // 방어막 생성/방어 사운드 (Shield)
  playShield() {
    this.resume();
    if (!this.ctx || this.isMuted) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(400, t);
    osc.frequency.linearRampToValueAtTime(800, t + 0.15);
    osc.frequency.linearRampToValueAtTime(600, t + 0.3);

    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.38);
  }

  // 미끄러짐/피격 효과음 (Cartoon Slip / Slide)
  playSlip() {
    this.resume();
    if (!this.ctx || this.isMuted) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, t);
    osc.frequency.linearRampToValueAtTime(200, t + 0.2);
    osc.frequency.linearRampToValueAtTime(120, t + 0.35);

    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.4);
  }

  // 결승선 통과 / 승리 팡파르 (Victory Fanfare)
  playFanfare() {
    this.resume();
    if (!this.ctx || this.isMuted) return;

    const notes = [
      { f: 523.25, time: 0, dur: 0.15 },    // C5
      { f: 523.25, time: 0.15, dur: 0.15 }, // C5
      { f: 523.25, time: 0.30, dur: 0.15 }, // C5
      { f: 659.25, time: 0.45, dur: 0.4 },  // E5
      { f: 587.33, time: 0.85, dur: 0.15 }, // D5
      { f: 659.25, time: 1.00, dur: 0.15 }, // E5
      { f: 783.99, time: 1.15, dur: 0.7 }   // G5
    ];

    const baseT = this.ctx.currentTime;

    notes.forEach(n => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(n.f, baseT + n.time);

      gain.gain.setValueAtTime(0.35, baseT + n.time);
      gain.gain.exponentialRampToValueAtTime(0.001, baseT + n.time + n.dur);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(baseT + n.time);
      osc.stop(baseT + n.time + n.dur + 0.05);
    });
  }

  // 꼴찌 / 벌칙 호각/우울한 효과음 (Sad trombone / Penalty horn)
  playPenaltySound() {
    this.resume();
    if (!this.ctx || this.isMuted) return;

    const notes = [
      { f: 311.13, time: 0.0, dur: 0.35 },  // Eb4
      { f: 293.66, time: 0.35, dur: 0.35 }, // D4
      { f: 277.18, time: 0.70, dur: 0.35 }, // Db4
      { f: 261.63, time: 1.05, dur: 0.7 }   // C4 (슬라이드 다운)
    ];

    const baseT = this.ctx.currentTime;

    notes.forEach((n, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(n.f, baseT + n.time);
      if (idx === notes.length - 1) {
        osc.frequency.linearRampToValueAtTime(220, baseT + n.time + n.dur);
      }

      gain.gain.setValueAtTime(0.25, baseT + n.time);
      gain.gain.exponentialRampToValueAtTime(0.001, baseT + n.time + n.dur);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(baseT + n.time);
      osc.stop(baseT + n.time + n.dur + 0.05);
    });
  }

  // 버튼 클릭음
  playClick() {
    this.resume();
    if (!this.ctx || this.isMuted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.exponentialRampToValueAtTime(400, t + 0.05);

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.06);
  }
}

export const sound = new SoundEngine();
