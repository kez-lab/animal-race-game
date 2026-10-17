/**
 * canvasRenderer.js - 60FPS 고해상도 2D 캔버스 경마 렌더러
 * 다중 카메라 디렉터(선두/꼴찌/전체), 날씨 이펙트(맑음/폭우/돌풍/야간), 스태미나 HUD, 전광판, 낙뢰/잔상 연출 지원
 */

export class CanvasRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = window.devicePixelRatio || 1;

    this.width = 0;
    this.height = 0;
    this.cameraX = 0;
    this.targetCameraX = 0;
    this.cameraMode = 'lead'; // 'lead' | 'tail' | 'pack'

    // 파티클 및 특수효과 시스템
    this.particles = [];
    this.confetti = [];
    this.shockwaves = [];
    this.floatingPopups = [];
    this.lightningBolts = [];
    this.screenFlashAlpha = 0;

    // 애니메이션 틱
    this.animTime = 0;

    // 트랙 레이아웃 파라미터
    this.trackPixelLength = 3200; // 가상 트랙 총 픽셀 길이
    this.laneHeight = 64;
    this.trackTop = 96;

    this.initResize();
  }

  initResize() {
    const handleResize = () => {
      if (!this.canvas || !this.canvas.parentElement) return;
      const rect = this.canvas.parentElement.getBoundingClientRect();
      this.width = rect.width || 800;
      this.height = Math.max(420, rect.height || 460);

      this.canvas.width = this.width * this.dpr;
      this.canvas.height = this.height * this.dpr;
      this.canvas.style.width = `${this.width}px`;
      this.canvas.style.height = `${this.height}px`;

      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    };

    window.addEventListener('resize', handleResize);
    handleResize();
  }

  setCameraMode(mode) {
    if (['lead', 'tail', 'pack'].includes(mode)) {
      this.cameraMode = mode;
    }
  }

  setHorseCount(count) {
    const minHeight = 420;
    const requiredHeight = this.trackTop + (count * this.laneHeight) + 60;
    const targetHeight = Math.max(minHeight, requiredHeight);

    if (this.canvas && this.canvas.parentElement) {
      this.canvas.parentElement.style.minHeight = `${targetHeight}px`;
      const rect = this.canvas.parentElement.getBoundingClientRect();
      this.width = rect.width || 800;
      this.height = targetHeight;

      this.canvas.width = this.width * this.dpr;
      this.canvas.height = this.height * this.dpr;
      this.canvas.style.width = `${this.width}px`;
      this.canvas.style.height = `${this.height}px`;
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    }
  }

  reset() {
    this.cameraX = 0;
    this.targetCameraX = 0;
    this.particles = [];
    this.confetti = [];
    this.shockwaves = [];
    this.floatingPopups = [];
    this.lightningBolts = [];
    this.screenFlashAlpha = 0;
    this.animTime = 0;
  }

  render(engine, dt = 0.016) {
    this.animTime += dt;
    this.updateParticles(dt);

    const horses = engine.horses;
    if (!horses || horses.length === 0) return;

    const startX = 140;
    const finishX = this.trackPixelLength - 220;
    const trackWidthSpan = finishX - startX;

    // 카메라 타겟 계산 (선두 캠 / 꼴찌 캠 / 전체 팩 캠)
    const activeHorses = horses.filter(h => !h.finished);
    const pool = activeHorses.length > 0 ? activeHorses : horses;

    let maxProgress = 0;
    let minProgress = 1;
    horses.forEach(h => {
      if (h.progress > maxProgress) maxProgress = h.progress;
      if (h.progress < minProgress) minProgress = h.progress;
    });

    let activeMinProgress = 1;
    pool.forEach(h => {
      if (h.progress < activeMinProgress) activeMinProgress = h.progress;
    });

    if (this.cameraMode === 'tail') {
      const tailWorldX = startX + activeMinProgress * trackWidthSpan;
      this.targetCameraX = Math.max(0, tailWorldX - this.width * 0.42);
    } else if (this.cameraMode === 'pack') {
      const midProgress = (maxProgress + activeMinProgress) * 0.5;
      const midWorldX = startX + midProgress * trackWidthSpan;
      this.targetCameraX = Math.max(0, midWorldX - this.width * 0.5);
    } else {
      const leaderWorldX = startX + maxProgress * trackWidthSpan;
      this.targetCameraX = Math.max(0, leaderWorldX - this.width * 0.65);
    }

    const maxCameraX = Math.max(0, this.trackPixelLength - this.width + 40);
    this.targetCameraX = Math.min(maxCameraX, this.targetCameraX);

    // 부드러운 카메라 이동 (Lerp)
    this.cameraX += (this.targetCameraX - this.cameraX) * Math.min(1, dt * 6.5);

    const weather = engine.weather || 'sunny';

    // 캔버스 클리어
    this.ctx.clearRect(0, 0, this.width, this.height);

    this.ctx.save();
    this.ctx.translate(-this.cameraX, 0);

    // 1. 관중석 & 배경 & 전광판 렌더링
    this.renderBackground(weather, engine);

    // 2. 트랙 및 레인 렌더링
    this.renderTrack(horses.length, startX, finishX, weather);

    // 3. 거리 마커 및 게이트/결승선 렌더링
    this.renderMarkers(engine.totalDistance, startX, finishX, horses.length);

    // 3.5. 아이템 박스 및 트랙 장애물(바나나) 렌더링
    if (engine.gameMode === 'item') {
      this.renderItemBoxes(engine.itemBoxes, startX, trackWidthSpan, engine.totalDistance);
      this.renderObstacles(engine.obstacles, startX, trackWidthSpan, engine.totalDistance);
      this.renderProjectiles(engine.projectiles, startX, trackWidthSpan, engine.totalDistance);
    }

    // 4. 파티클 및 번개 낙뢰 렌더링
    this.renderParticles();

    // 5. 말 및 기수 렌더링 (레인 순서대로)
    horses.forEach((horse, index) => {
      const horseX = startX + horse.progress * trackWidthSpan;
      const horseY = this.trackTop + index * this.laneHeight + this.laneHeight * 0.55;

      // 달릴 때 먼지/물보라 생성
      if (engine.isRunning && !horse.finished && Math.random() < 0.35) {
        this.addDustParticle(horseX - 25, horseY + 12, weather);
      }
      // 부스터 시 불꽃/스파크 생성
      if (horse.state === 'boost' && engine.isRunning && !horse.finished) {
        this.addSparkParticle(horseX - 20, horseY + 5, '#F6AD55');
      }

      this.renderHorse(horse, horseX, horseY, engine);
    });

    // 6. 폭죽/컨페티 렌더링
    this.renderConfetti();

    this.ctx.restore();

    // 7. 뷰포트 고정 오버레이 (비/바람 기상 이펙트, 라스트 스퍼트 집중선, 카메라 모드 HUD, 번개 플래시)
    this.renderViewportOverlays(engine, weather);
  }

  renderBackground(weather, engine) {
    // 상단 하늘 / 스타디움 벽 (날씨별 테마)
    const skyGrad = this.ctx.createLinearGradient(0, 0, 0, this.trackTop);
    if (weather === 'night') {
      skyGrad.addColorStop(0, '#090D16');
      skyGrad.addColorStop(1, '#1E1B4B');
    } else if (weather === 'rain') {
      skyGrad.addColorStop(0, '#0F172A');
      skyGrad.addColorStop(1, '#1E293B');
    } else {
      skyGrad.addColorStop(0, '#1A202C');
      skyGrad.addColorStop(1, '#2D3748');
    }
    this.ctx.fillStyle = skyGrad;
    this.ctx.fillRect(this.cameraX, 0, this.width, this.trackTop);

    // 야간 스타디움 서치라이트 조명 기둥
    if (weather === 'night') {
      for (let lx = 250; lx < this.trackPixelLength; lx += 550) {
        const coneGrad = this.ctx.createLinearGradient(lx, 0, lx, this.trackTop + 180);
        coneGrad.addColorStop(0, 'rgba(56, 189, 248, 0.22)');
        coneGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
        this.ctx.fillStyle = coneGrad;
        this.ctx.beginPath();
        this.ctx.moveTo(lx - 15, 0);
        this.ctx.lineTo(lx + 15, 0);
        this.ctx.lineTo(lx + 110, this.trackTop + 180);
        this.ctx.lineTo(lx - 110, this.trackTop + 180);
        this.ctx.closePath();
        this.ctx.fill();
      }
    }

    // 관중석 펜스 & 관중 실루엣
    this.ctx.fillStyle = weather === 'night' ? '#312E81' : '#4A5568';
    this.ctx.fillRect(0, this.trackTop - 24, this.trackPixelLength, 24);

    // 환호하는 관중 도트 애니메이션
    const crowdSpacing = 18;
    const crowdCount = Math.ceil(this.trackPixelLength / crowdSpacing);
    for (let i = 0; i < crowdCount; i++) {
      const cx = i * crowdSpacing;
      if (cx < this.cameraX - 40 || cx > this.cameraX + this.width + 40) continue;
      const jump = Math.sin(this.animTime * 6 + i * 1.5) > 0.4 ? -4 : 0;
      const color = (i % 3 === 0) ? '#CBD5E0' : ((i % 3 === 1) ? '#A0AEC0' : '#718096');

      this.ctx.fillStyle = color;
      this.ctx.beginPath();
      this.ctx.arc(cx, this.trackTop - 28 + jump, 4, 0, Math.PI * 2);
      this.ctx.fill();
    }

    // 경기장 만국기 플래그
    for (let i = 0; i < crowdCount; i += 4) {
      const fx = i * crowdSpacing;
      if (fx < this.cameraX - 40 || fx > this.cameraX + this.width + 40) continue;
      const flagColors = ['#E53E3E', '#3182CE', '#D69E2E', '#38A169', '#805AD5'];
      const windFlutter = weather === 'wind' ? Math.sin(this.animTime * 18 + i) * 3 : 0;
      this.ctx.fillStyle = flagColors[(i / 4) % flagColors.length];
      this.ctx.beginPath();
      this.ctx.moveTo(fx, this.trackTop - 45);
      this.ctx.lineTo(fx + 12 + windFlutter, this.trackTop - 38);
      this.ctx.lineTo(fx, this.trackTop - 31);
      this.ctx.fill();
    }

    // 스타디움 대형 전광판 (800px 간격으로 배치)
    const leadName = engine.leadHorse ? engine.leadHorse.name : '-';
    const tailName = engine.tailHorse ? engine.tailHorse.name : '-';
    for (let bx = 420; bx < this.trackPixelLength - 300; bx += 750) {
      if (bx < this.cameraX - 220 || bx > this.cameraX + this.width + 220) continue;
      this.ctx.save();
      this.ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
      this.ctx.strokeStyle = weather === 'night' ? '#38BDF8' : '#F59E0B';
      this.ctx.lineWidth = 1.5;
      const bw = 210;
      const bh = 28;
      this.ctx.beginPath();
      this.ctx.roundRect ? this.ctx.roundRect(bx - bw / 2, 10, bw, bh, 6) : this.ctx.fillRect(bx - bw / 2, 10, bw, bh);
      this.ctx.fill();
      this.ctx.stroke();

      this.ctx.font = 'bold 10.5px Pretendard, sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillStyle = '#F8FAFC';
      this.ctx.fillText(`👑 1위: ${leadName}  |  ☕️ 위기: ${tailName}`, bx, 24);
      this.ctx.restore();
    }
  }

  renderTrack(horseCount, startX, finishX, weather) {
    const totalTrackHeight = horseCount * this.laneHeight;

    // 잔디 트랙 배경 (날씨별 색감)
    const turfGrad = this.ctx.createLinearGradient(0, this.trackTop, 0, this.trackTop + totalTrackHeight);
    if (weather === 'rain') {
      turfGrad.addColorStop(0, '#1A3636');
      turfGrad.addColorStop(0.5, '#1F453B');
      turfGrad.addColorStop(1, '#132A26');
    } else if (weather === 'night') {
      turfGrad.addColorStop(0, '#132A3E');
      turfGrad.addColorStop(0.5, '#1A3B47');
      turfGrad.addColorStop(1, '#0F2231');
    } else {
      turfGrad.addColorStop(0, '#22543D');
      turfGrad.addColorStop(0.5, '#276749');
      turfGrad.addColorStop(1, '#1C4532');
    }
    this.ctx.fillStyle = turfGrad;
    this.ctx.fillRect(0, this.trackTop, this.trackPixelLength, totalTrackHeight);

    // 미세 잔디 줄무늬 패턴
    for (let x = 0; x < this.trackPixelLength; x += 80) {
      if (x < this.cameraX - 80 || x > this.cameraX + this.width + 80) continue;
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.028)';
      this.ctx.fillRect(x, this.trackTop, 40, totalTrackHeight);
    }

    // 레인 번호 워터마크 (출발선 부근 및 중간 트랙)
    this.ctx.font = '900 18px Pretendard, sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    for (let lane = 0; lane < horseCount; lane++) {
      const ly = this.trackTop + lane * this.laneHeight + this.laneHeight * 0.5;
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      this.ctx.fillText(`${lane + 1}`, startX - 30, ly);
    }

    // 레인 구분선 (점선)
    for (let i = 0; i <= horseCount; i++) {
      const y = this.trackTop + i * this.laneHeight;

      const isOuter = i === 0 || i === horseCount;
      this.ctx.strokeStyle = isOuter
        ? (weather === 'night' ? '#38BDF8' : '#FFFFFF')
        : 'rgba(255, 255, 255, 0.25)';
      this.ctx.lineWidth = isOuter ? 3 : 1.5;

      if (!isOuter) {
        this.ctx.setLineDash([12, 8]);
      } else {
        this.ctx.setLineDash([]);
      }

      this.ctx.beginPath();
      this.ctx.moveTo(this.cameraX, y);
      this.ctx.lineTo(this.cameraX + this.width, y);
      this.ctx.stroke();
    }
    this.ctx.setLineDash([]);

    // 하단 펜스 및 바닥 그림자
    this.ctx.fillStyle = '#0F172A';
    this.ctx.fillRect(this.cameraX, this.trackTop + totalTrackHeight, this.width, 45);
  }

  renderMarkers(totalDistance, startX, finishX, horseCount) {
    const trackHeight = horseCount * this.laneHeight;
    const totalSpan = finishX - startX;

    // 1. 출발선 (START GATE)
    this.ctx.fillStyle = '#E2E8F0';
    this.ctx.fillRect(startX - 6, this.trackTop, 8, trackHeight);

    this.ctx.fillStyle = '#E53E3E';
    this.ctx.font = 'bold 12px Pretendard, sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('START', startX - 2, this.trackTop - 8);

    // 2. 구간별 거리 표지판 (남은 거리)
    const intervals = [
      { ratio: 0.25, label: `${Math.round(totalDistance * 0.75)}m 남음` },
      { ratio: 0.50, label: `${Math.round(totalDistance * 0.50)}m 남음` },
      { ratio: 0.75, label: `🔥 남은거리 ${Math.round(totalDistance * 0.25)}m!` },
      { ratio: 0.90, label: `⚡️ 라스트 스퍼트!` }
    ];

    intervals.forEach(item => {
      const mx = startX + totalSpan * item.ratio;
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      this.ctx.lineWidth = 1;
      this.ctx.setLineDash([4, 4]);
      this.ctx.beginPath();
      this.ctx.moveTo(mx, this.trackTop);
      this.ctx.lineTo(mx, this.trackTop + trackHeight);
      this.ctx.stroke();
      this.ctx.setLineDash([]);

      // 표지판 배지
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
      this.ctx.beginPath();
      this.ctx.roundRect ? this.ctx.roundRect(mx - 48, this.trackTop - 24, 96, 20, 4) : this.ctx.fillRect(mx - 48, this.trackTop - 24, 96, 20);
      this.ctx.fill();

      this.ctx.fillStyle = item.ratio >= 0.75 ? '#FEFCBF' : '#E2E8F0';
      this.ctx.font = 'bold 10px Pretendard, sans-serif';
      this.ctx.fillText(item.label, mx, this.trackTop - 10);
    });

    // 3. 결승선 (FINISH BANNER & CHECKERED LINE)
    const checkSize = 10;
    const cols = 3;
    const rows = Math.ceil(trackHeight / checkSize);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const isBlack = (r + c) % 2 === 0;
        this.ctx.fillStyle = isBlack ? '#1A202C' : '#FFFFFF';
        this.ctx.fillRect(finishX + c * checkSize, this.trackTop + r * checkSize, checkSize, checkSize);
      }
    }

    // 결승선 아치 기둥 & 배너
    this.ctx.fillStyle = '#F59E0B';
    this.ctx.beginPath();
    this.ctx.roundRect ? this.ctx.roundRect(finishX - 8, this.trackTop - 36, 46, 30, 5) : this.ctx.fillRect(finishX - 8, this.trackTop - 36, 46, 30);
    this.ctx.fill();
    this.ctx.fillStyle = '#0F172A';
    this.ctx.font = '900 11px Pretendard, sans-serif';
    this.ctx.fillText('FINISH', finishX + 15, this.trackTop - 17);
  }

  renderItemBoxes(boxes, startX, trackWidthSpan, totalDistance) {
    boxes.forEach(box => {
      if (box.collected) return;
      const actualX = startX + (box.distance / totalDistance) * trackWidthSpan;
      if (actualX < this.cameraX - 40 || actualX > this.cameraX + this.width + 40) return;
      const by = this.trackTop + box.lane * this.laneHeight + this.laneHeight * 0.55;

      const bob = Math.sin(this.animTime * 6 + box.lane) * 3;

      this.ctx.save();
      this.ctx.translate(actualX, by + bob);

      // 박스 외곽 발광
      this.ctx.fillStyle = 'rgba(245, 158, 11, 0.3)';
      this.ctx.beginPath();
      this.ctx.arc(0, 0, 18, 0, Math.PI * 2);
      this.ctx.fill();

      // 박스 본체 (큐브/선물상자)
      this.ctx.fillStyle = '#D97706';
      this.ctx.strokeStyle = '#FEF3C7';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.roundRect ? this.ctx.roundRect(-11, -11, 22, 22, 5) : this.ctx.fillRect(-11, -11, 22, 22);
      this.ctx.fill();
      this.ctx.stroke();

      // 물음표 아이콘
      this.ctx.fillStyle = '#FFFFFF';
      this.ctx.font = 'bold 13px Pretendard, sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText('?', 0, 1);

      this.ctx.restore();
    });
  }

  renderObstacles(obstacles, startX, trackWidthSpan, totalDistance) {
    obstacles.forEach(obs => {
      const ox = startX + (obs.distance / totalDistance) * trackWidthSpan;
      const oy = this.trackTop + obs.lane * this.laneHeight + this.laneHeight * 0.55;

      this.ctx.save();
      this.ctx.translate(ox, oy);

      // 위험 경고 바닥 원
      this.ctx.fillStyle = 'rgba(234, 179, 8, 0.25)';
      this.ctx.beginPath();
      this.ctx.arc(0, 2, 13, 0, Math.PI * 2);
      this.ctx.fill();

      // 바나나 이모지 렌더링
      this.ctx.font = '16px serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText('🍌', 0, 2);

      this.ctx.restore();
    });
  }

  renderProjectiles(projectiles, startX, trackWidthSpan, totalDistance) {
    projectiles.forEach(proj => {
      const px = startX + (proj.x / totalDistance) * trackWidthSpan;
      const fromL = proj.fromLane !== undefined ? proj.fromLane : (proj.targetHorse ? proj.targetHorse.lane : 0);
      const toL = proj.targetLane !== undefined ? proj.targetLane : (proj.targetHorse ? proj.targetHorse.lane : 0);

      const startDist = proj.fromHorse ? proj.fromHorse.distance : 0;
      const targetDist = proj.targetHorse ? proj.targetHorse.distance : totalDistance;
      const flyProgress = Math.min(1.0, Math.max(0, (proj.x - startDist) / Math.max(1, targetDist - startDist)));
      const currentLane = fromL + (toL - fromL) * flyProgress;

      const py = this.trackTop + currentLane * this.laneHeight + this.laneHeight * 0.55;

      this.ctx.save();
      this.ctx.translate(px, py);

      // 미사일 후방 연기 및 화염 이펙트
      this.ctx.fillStyle = 'rgba(239, 68, 68, 0.65)';
      this.ctx.beginPath();
      this.ctx.arc(-12, 0, 8, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.fillStyle = 'rgba(245, 158, 11, 0.85)';
      this.ctx.beginPath();
      this.ctx.arc(-6, 0, 5, 0, Math.PI * 2);
      this.ctx.fill();

      // 미사일 아이콘
      this.ctx.font = '18px serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText('🎯', 0, 0);

      this.ctx.restore();
    });
  }

  renderHorse(horse, x, y, engine) {
    this.ctx.save();
    this.ctx.translate(x, y);

    // 0. 부스터 질주 시 잔상(Afterimage) 효과
    if (horse.state === 'boost' && !horse.finished) {
      for (let g = 1; g <= 2; g++) {
        this.ctx.save();
        this.ctx.translate(-g * 16, 0);
        this.ctx.globalAlpha = 0.22 / g;
        this.ctx.fillStyle = horse.color.body || '#F59E0B';
        this.ctx.beginPath();
        this.ctx.ellipse(0, 0, 20, 11, 0, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();
      }
    }

    // 1. 말 그림자
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    this.ctx.beginPath();
    this.ctx.ellipse(0, 16, 26, 7, 0, 0, Math.PI * 2);
    this.ctx.fill();

    // 1.5. 말 하단 미니 스태미나 게이지 바 (완주 전 표시)
    if (!horse.finished) {
      const stamRatio = Math.max(0, Math.min(1, (horse.stamina || 0) / (horse.maxStamina || 100)));
      const barW = 36;
      const barH = 3.5;
      this.ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
      this.ctx.fillRect(-barW / 2, 21, barW, barH);
      this.ctx.fillStyle = stamRatio > 0.5 ? '#10B981' : (stamRatio > 0.22 ? '#F59E0B' : '#EF4444');
      this.ctx.fillRect(-barW / 2, 21, barW * stamRatio, barH);
    }

    // 2. 쉴드 방어막 효과
    if (horse.shieldActive) {
      const shieldPulse = Math.sin(this.animTime * 8) * 2;
      const shieldGrad = this.ctx.createRadialGradient(0, 0, 15, 0, 0, 36 + shieldPulse);
      shieldGrad.addColorStop(0, 'rgba(56, 189, 248, 0.1)');
      shieldGrad.addColorStop(0.8, 'rgba(56, 189, 248, 0.35)');
      shieldGrad.addColorStop(1, 'rgba(14, 165, 233, 0.7)');

      this.ctx.fillStyle = shieldGrad;
      this.ctx.strokeStyle = '#38BDF8';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(0, 0, 36 + shieldPulse, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.stroke();
    }

    // 3. 부스터 오라 효과
    if (horse.state === 'boost') {
      const auraGrad = this.ctx.createRadialGradient(0, 0, 10, 0, 0, 45);
      auraGrad.addColorStop(0, 'rgba(237, 137, 54, 0.45)');
      auraGrad.addColorStop(0.7, 'rgba(246, 224, 94, 0.18)');
      auraGrad.addColorStop(1, 'rgba(246, 224, 94, 0)');
      this.ctx.fillStyle = auraGrad;
      this.ctx.beginPath();
      this.ctx.arc(0, 0, 45, 0, Math.PI * 2);
      this.ctx.fill();
    }

    // 4. 회전 스핀 (바나나 미끄러짐 시)
    if (horse.spinAngle) {
      this.ctx.rotate(horse.spinAngle);
    }

    // 말 달리기 애니메이션 각도 계산 (다그닥 움직임)
    const gallopSpeed = engine.isRunning && !horse.finished ? (horse.speed / 15) : 0;
    const gallopPhase = this.animTime * 14 * (gallopSpeed > 0 ? gallopSpeed : 1) + horse.lane;
    const bodyBob = Math.sin(gallopPhase * 2) * (gallopSpeed > 0 ? 3 : 0);
    const bodyTilt = Math.sin(gallopPhase) * 0.08;

    this.ctx.translate(0, bodyBob);
    this.ctx.rotate(bodyTilt);

    const horseColor = horse.color?.body || '#E53E3E';
    const silkColor = horse.color?.silk || '#FFFFFF';

    // 뒷다리 2개
    this.renderLeg(-14, 8, Math.sin(gallopPhase) * 0.8 + 0.3, horseColor);
    this.renderLeg(-8, 8, Math.sin(gallopPhase + 0.5) * 0.8 + 0.3, horseColor);

    // 꼬리 (살랑거림)
    const tailWag = Math.sin(gallopPhase * 2) * 0.3;
    this.ctx.strokeStyle = '#2D3748';
    this.ctx.lineWidth = 3.5;
    this.ctx.beginPath();
    this.ctx.moveTo(-18, -2);
    this.ctx.quadraticCurveTo(-28, -6 + tailWag * 10, -32, 4 + tailWag * 15);
    this.ctx.stroke();

    // 몸통 (Body)
    this.ctx.fillStyle = horseColor;
    this.ctx.beginPath();
    this.ctx.ellipse(0, 0, 20, 11, 0, 0, Math.PI * 2);
    this.ctx.fill();

    // 앞다리 2개
    this.renderLeg(10, 8, Math.sin(gallopPhase + Math.PI) * 0.8 - 0.2, horseColor);
    this.renderLeg(16, 8, Math.sin(gallopPhase + Math.PI + 0.5) * 0.8 - 0.2, horseColor);

    // 목 & 머리 (Neck & Head)
    this.ctx.fillStyle = horseColor;
    this.ctx.beginPath();
    this.ctx.moveTo(10, -5);
    this.ctx.lineTo(24, -18);
    this.ctx.lineTo(30, -14);
    this.ctx.lineTo(24, -2);
    this.ctx.closePath();
    this.ctx.fill();

    // 머리 주둥이
    this.ctx.beginPath();
    this.ctx.ellipse(26, -16, 7, 5, 0.3, 0, Math.PI * 2);
    this.ctx.fill();

    // 갈기 (Mane)
    this.ctx.fillStyle = '#1A202C';
    this.ctx.beginPath();
    this.ctx.ellipse(16, -13, 6, 2, -0.6, 0, Math.PI * 2);
    this.ctx.fill();

    // 눈 (Eye)
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.beginPath();
    this.ctx.arc(26, -17, 2, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.fillStyle = '#000000';
    this.ctx.beginPath();
    this.ctx.arc(27, -17, 1, 0, Math.PI * 2);
    this.ctx.fill();

    // 안장 & 기수 (Jockey in Racing Silks)
    this.ctx.fillStyle = '#2D3748';
    this.ctx.fillRect(-6, -12, 14, 4);

    this.ctx.fillStyle = silkColor;
    this.ctx.beginPath();
    this.ctx.ellipse(0, -16, 7, 6, 0.4, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.fillStyle = horseColor;
    this.ctx.beginPath();
    this.ctx.arc(5, -23, 5, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.fillRect(7, -22, 5, 2);

    this.ctx.restore(); // 말 변형 복원

    // 상단 이름표 및 실시간 순위/보유아이템 배지 렌더링 (흔들림 없이 고정)
    this.renderHorseBadge(horse, x, y, engine.horses.length);
  }

  renderLeg(ox, oy, angle, color) {
    this.ctx.save();
    this.ctx.translate(ox, oy);
    this.ctx.rotate(angle);

    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 4;
    this.ctx.lineCap = 'round';

    this.ctx.beginPath();
    this.ctx.moveTo(0, 0);
    this.ctx.lineTo(0, 10);
    this.ctx.lineTo(Math.sin(angle) * 4, 18);
    this.ctx.stroke();

    this.ctx.fillStyle = '#1A202C';
    this.ctx.fillRect(Math.sin(angle) * 4 - 2, 16, 4, 3);

    this.ctx.restore();
  }

  renderHorseBadge(horse, x, y, totalHorses = 1) {
    this.ctx.save();
    this.ctx.translate(x, y - 36);

    const isLeader = horse.rank === 1;
    const isTail = totalHorses > 1 && horse.rank === totalHorses;
    const nameText = horse.name || '참가자';
    const nickText = horse.nickname ? `#${horse.nickname}` : '';

    this.ctx.font = 'bold 11.5px Pretendard, sans-serif';
    const nameWidth = this.ctx.measureText(nameText).width;

    this.ctx.font = '10px Pretendard, sans-serif';
    const nickWidth = nickText ? this.ctx.measureText(nickText).width + 6 : 0;

    const badgeWidth = Math.max(88, nameWidth + nickWidth + 34);
    const badgeHeight = 22;

    // 배지 배경 (1위는 골드 테두리, 꼴찌는 로즈 경고 테두리)
    this.ctx.fillStyle = isTail ? 'rgba(69, 10, 10, 0.92)' : 'rgba(15, 23, 42, 0.92)';
    this.ctx.strokeStyle = isLeader ? '#F59E0B' : (isTail ? '#F43F5E' : (horse.color?.border || '#94A3B8'));
    this.ctx.lineWidth = (isLeader || isTail) ? 2 : 1.5;

    this.ctx.beginPath();
    this.ctx.roundRect ? this.ctx.roundRect(-badgeWidth / 2, -badgeHeight / 2, badgeWidth, badgeHeight, 6) : this.ctx.fillRect(-badgeWidth / 2, -badgeHeight / 2, badgeWidth, badgeHeight);
    this.ctx.fill();
    this.ctx.stroke();

    // 순위 동그라미
    const rankColors = { 1: '#F59E0B', 2: '#CBD5E1', 3: '#F97316' };
    const rColor = isTail ? '#F43F5E' : (rankColors[horse.rank] || '#475569');

    this.ctx.fillStyle = rColor;
    this.ctx.beginPath();
    this.ctx.arc(-badgeWidth / 2 + 12, 0, 7, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.fillStyle = (horse.rank <= 3 && !isTail) ? '#0F172A' : '#FFFFFF';
    this.ctx.font = 'bold 9px Pretendard, sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(`${horse.rank}`, -badgeWidth / 2 + 12, 0);

    // 이름 (Name) 렌더링
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.font = 'bold 11.5px Pretendard, sans-serif';
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(nameText, -badgeWidth / 2 + 24, 0);

    // 별명 (Nickname) 렌더링
    if (nickText) {
      this.ctx.fillStyle = isTail ? '#FDA4AF' : '#94A3B8';
      this.ctx.font = '10px Pretendard, sans-serif';
      this.ctx.fillText(nickText, -badgeWidth / 2 + 24 + nameWidth + 5, 0);
    }

    // 보유 아이템 버블 표시 (우측 상단)
    if (horse.heldItem && !horse.finished) {
      const bubbleX = badgeWidth / 2 + 12;
      this.ctx.fillStyle = 'rgba(245, 158, 11, 0.95)';
      this.ctx.strokeStyle = '#FEF3C7';
      this.ctx.lineWidth = 1.5;
      this.ctx.beginPath();
      this.ctx.arc(bubbleX, 0, 10, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.stroke();

      this.ctx.font = '11px serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(horse.heldItem.icon || '🎁', bubbleX, 1);
    }

    // 꼴찌 위험 미니 태그 (좌측 상단)
    if (isTail && !horse.finished) {
      this.ctx.font = 'bold 9px Pretendard, sans-serif';
      this.ctx.fillStyle = '#FECDD3';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('☕️결제위기', 0, -16);
    } else if (isLeader && !horse.finished) {
      this.ctx.font = '11px serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('👑', -badgeWidth / 2 + 12, -16);
    }

    this.ctx.restore();
  }

  renderViewportOverlays(engine, weather) {
    this.ctx.save();

    // 1. 폭우(rain) 빗줄기 이펙트
    if (weather === 'rain') {
      this.ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
      this.ctx.lineWidth = 1.2;
      const dropCount = 45;
      for (let i = 0; i < dropCount; i++) {
        const rx = ((i * 73 + this.animTime * 420) % (this.width + 100)) - 50;
        const ry = ((i * 59 + this.animTime * 680) % (this.height + 60)) - 30;
        this.ctx.beginPath();
        this.ctx.moveTo(rx, ry);
        this.ctx.lineTo(rx - 8, ry + 18);
        this.ctx.stroke();
      }
    }

    // 2. 돌풍(wind) 바람 궤적 라인
    if (weather === 'wind') {
      this.ctx.strokeStyle = 'rgba(226, 232, 240, 0.22)';
      this.ctx.lineWidth = 1.5;
      for (let i = 0; i < 14; i++) {
        const wx = ((i * 130 + this.animTime * 550) % (this.width + 200)) - 100;
        const wy = this.trackTop + ((i * 47) % Math.max(100, this.height - this.trackTop - 40));
        this.ctx.beginPath();
        this.ctx.moveTo(wx, wy);
        this.ctx.lineTo(wx + 55, wy);
        this.ctx.stroke();
      }
    }

    // 3. 라스트 스퍼트 구간 진입 시 집중선/비네팅 연출
    if (engine.lastSpurtAnnounced && engine.isRunning && !engine.isFinished) {
      const pulse = 0.12 + Math.sin(this.animTime * 10) * 0.05;
      const borderGrad = this.ctx.createRadialGradient(
        this.width / 2, this.height / 2, this.width * 0.32,
        this.width / 2, this.height / 2, this.width * 0.65
      );
      borderGrad.addColorStop(0, 'rgba(245, 158, 11, 0)');
      borderGrad.addColorStop(1, `rgba(239, 68, 68, ${pulse})`);
      this.ctx.fillStyle = borderGrad;
      this.ctx.fillRect(0, 0, this.width, this.height);
    }

    // 4. 번개 플래시 효과
    if (this.screenFlashAlpha > 0) {
      this.ctx.fillStyle = `rgba(254, 240, 138, ${this.screenFlashAlpha})`;
      this.ctx.fillRect(0, 0, this.width, this.height);
    }

    this.ctx.restore();
  }

  triggerItemUseEffect(horse, item, x, y) {
    if (!item) return;

    let themeColor = '#F59E0B';
    let label = `✨ ${item.name || '아이템'} 사용!`;
    let particleColors = ['#F59E0B', '#FDE68A', '#FFFFFF'];

    switch (item.id) {
      case 'booster':
        themeColor = '#F59E0B';
        label = '🚀 부스터 발동!';
        particleColors = ['#F59E0B', '#F97316', '#FDE68A', '#FFFFFF'];
        break;
      case 'shield':
        themeColor = '#06B6D4';
        label = '🛡️ 쉴드 방어막 전개!';
        particleColors = ['#06B6D4', '#67E8F9', '#3B82F6', '#FFFFFF'];
        break;
      case 'lightning':
        themeColor = '#FACC15';
        label = '⚡️ 번개 폭풍 작렬!';
        particleColors = ['#FACC15', '#FEF08A', '#38BDF8', '#FFFFFF'];
        this.screenFlashAlpha = 0.45;
        break;
      case 'missile':
        themeColor = '#EF4444';
        label = '🎯 선두 저격 미사일 발사!';
        particleColors = ['#EF4444', '#F97316', '#FDE047', '#FFFFFF'];
        break;
      case 'banana':
        themeColor = '#EAB308';
        label = '🍌 바나나 함정 매설!';
        particleColors = ['#EAB308', '#FEF08A', '#84CC16', '#FFFFFF'];
        break;
      case 'magnet':
        themeColor = '#A855F7';
        label = '🧲 초전도 자석 발동!';
        particleColors = ['#A855F7', '#C084FC', '#38BDF8', '#FFFFFF'];
        break;
      case 'espresso':
        themeColor = '#10B981';
        label = '☕️ 더블 에스프레소 각성!';
        particleColors = ['#10B981', '#6EE7B7', '#FDE68A', '#FFFFFF'];
        break;
      case 'approval':
        themeColor = '#EC4899';
        label = '📋 긴급 결재서류 투척!';
        particleColors = ['#EC4899', '#F472B6', '#FDE047', '#FFFFFF'];
        break;
    }

    // 1. 쇼크웨이브 링 파동 (2중 링)
    this.shockwaves.push({
      x, y,
      radius: 12,
      maxRadius: 80,
      color: themeColor,
      alpha: 1.0,
      life: 0.55,
      maxLife: 0.55,
      lineWidth: 4.5
    });
    this.shockwaves.push({
      x, y,
      radius: 6,
      maxRadius: 50,
      color: '#FFFFFF',
      alpha: 0.9,
      life: 0.4,
      maxLife: 0.4,
      lineWidth: 2.5
    });

    // 2. 위로 솟아오르는 플로팅 텍스트 팝업
    this.floatingPopups.push({
      x,
      y: y - 32,
      vy: -60,
      text: label,
      bg: themeColor,
      alpha: 1.0,
      life: 0.9,
      maxLife: 0.9
    });

    // 3. 방사형 파티클 버스트 (24개)
    for (let i = 0; i < 24; i++) {
      const angle = (Math.PI * 2 / 24) * i + (Math.random() - 0.5) * 0.4;
      const speed = 4 + Math.random() * 5.5;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.2,
        size: 3.5 + Math.random() * 4,
        alpha: 1.0,
        color: particleColors[Math.floor(Math.random() * particleColors.length)],
        life: 0.55
      });
    }
  }

  triggerItemHitEffect(victimHorse, itemType, attackerName, x, y) {
    let label = '';
    let bg = '#EF4444';
    let border = '#F87171';
    let particleColors = ['#EF4444', '#F59E0B', '#FFFFFF'];

    const attacker = attackerName ? `[${attackerName}]의 ` : '';

    if (itemType === 'banana') {
      label = `🍌 ${attacker}바나나 밟음! (스핀 & 감속)`;
      bg = 'rgba(217, 119, 6, 0.95)';
      border = '#FCD34D';
      particleColors = ['#F59E0B', '#FEF08A', '#84CC16', '#FFFFFF'];
    } else if (itemType === 'missile') {
      label = `💥 ${attacker}미사일 직격타! (스핀 & 급정지)`;
      bg = 'rgba(220, 38, 38, 0.95)';
      border = '#FCA5A5';
      particleColors = ['#EF4444', '#F97316', '#FDE047', '#FFFFFF'];
    } else if (itemType === 'lightning') {
      label = `⚡️ ${attacker}번개 감전! (페이스 다운)`;
      bg = 'rgba(202, 138, 4, 0.95)';
      border = '#FEF08A';
      particleColors = ['#FACC15', '#FEF08A', '#38BDF8', '#FFFFFF'];
      // 하늘에서 내리꽂히는 낙뢰 광선 추가
      this.lightningBolts.push({
        x,
        y,
        life: 0.35,
        maxLife: 0.35
      });
    } else if (itemType === 'approval') {
      label = `📋 ${attacker}긴급 결재 폭탄! (서류 검토 감속)`;
      bg = 'rgba(190, 24, 93, 0.95)';
      border = '#F9A8D4';
      particleColors = ['#EC4899', '#F472B6', '#FFFFFF'];
    } else if (itemType === 'shieldBlock') {
      label = `🛡️ ${attacker}공격 쉴드로 완벽 방어!`;
      bg = 'rgba(13, 148, 136, 0.95)';
      border = '#67E8F9';
      particleColors = ['#06B6D4', '#67E8F9', '#10B981', '#FFFFFF'];
    } else {
      label = `⚠️ ${attacker}피격 발생!`;
    }

    // 1. 피격 알림 플로팅 배지
    this.floatingPopups.push({
      x,
      y: y - 46,
      vy: -25,
      text: label,
      bg: bg,
      border: border,
      alpha: 1.0,
      life: 1.8,
      maxLife: 1.8,
      isHitAlert: true
    });

    // 2. 피격 충격파 링 파동
    this.shockwaves.push({
      x, y,
      radius: 12,
      maxRadius: 75,
      color: border,
      alpha: 1.0,
      life: 0.5,
      maxLife: 0.5,
      lineWidth: 3.5
    });

    // 3. 충격 스파크 및 파티클 폭발
    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 3.5 + Math.random() * 5.5;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.2,
        size: 3.5 + Math.random() * 3.5,
        alpha: 1.0,
        color: particleColors[Math.floor(Math.random() * particleColors.length)],
        life: 0.55
      });
    }
  }

  addItemPopParticle(x, y) {
    const colors = ['#F59E0B', '#FDE68A', '#38BDF8', '#FFFFFF'];
    for (let i = 0; i < 16; i++) {
      this.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 7,
        vy: (Math.random() - 0.5) * 7,
        size: 3.5 + Math.random() * 3.5,
        alpha: 1.0,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 0.5
      });
    }
  }

  addDustParticle(x, y, weather = 'sunny') {
    const isRain = weather === 'rain';
    this.particles.push({
      x, y,
      vx: -(1.5 + Math.random() * 2),
      vy: -(Math.random() * 1.5 - 0.5),
      size: 3 + Math.random() * 4,
      alpha: 0.6,
      color: isRain ? 'rgba(148, 163, 184, 0.65)' : 'rgba(214, 158, 46, 0.6)',
      life: 0.5
    });
  }

  addSparkParticle(x, y, color) {
    this.particles.push({
      x, y,
      vx: -(3 + Math.random() * 4),
      vy: (Math.random() - 0.5) * 4,
      size: 2 + Math.random() * 3,
      alpha: 1.0,
      color: color || '#ECC94B',
      life: 0.4
    });
  }

  triggerFinishConfetti(x, y) {
    const colors = ['#E53E3E', '#3182CE', '#38A169', '#D69E2E', '#805AD5', '#ED64A6', '#FFFFFF'];
    for (let i = 0; i < 45; i++) {
      this.confetti.push({
        x: x + (Math.random() * 40 - 20),
        y: y + (Math.random() * 60 - 30),
        vx: (Math.random() - 0.3) * 8,
        vy: - (4 + Math.random() * 7),
        size: 4 + Math.random() * 5,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 0.2,
        alpha: 1.0,
        life: 2.2
      });
    }
  }

  updateParticles(dt) {
    if (this.screenFlashAlpha > 0) {
      this.screenFlashAlpha = Math.max(0, this.screenFlashAlpha - dt * 1.8);
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= dt;
      p.alpha = Math.max(0, p.life / 0.55);
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }

    if (this.lightningBolts) {
      for (let i = this.lightningBolts.length - 1; i >= 0; i--) {
        this.lightningBolts[i].life -= dt;
        if (this.lightningBolts[i].life <= 0) {
          this.lightningBolts.splice(i, 1);
        }
      }
    }

    if (this.shockwaves) {
      for (let i = this.shockwaves.length - 1; i >= 0; i--) {
        const sw = this.shockwaves[i];
        sw.radius += (sw.maxRadius - sw.radius) * (dt * 9);
        sw.life -= dt;
        sw.alpha = Math.max(0, sw.life / sw.maxLife);
        if (sw.life <= 0) {
          this.shockwaves.splice(i, 1);
        }
      }
    }

    if (this.floatingPopups) {
      for (let i = this.floatingPopups.length - 1; i >= 0; i--) {
        const pop = this.floatingPopups[i];
        pop.y += pop.vy * dt;
        pop.life -= dt;
        pop.alpha = Math.max(0, Math.min(1.0, pop.life / (pop.maxLife * 0.25)));
        if (pop.life <= 0) {
          this.floatingPopups.splice(i, 1);
        }
      }
    }

    for (let i = this.confetti.length - 1; i >= 0; i--) {
      const c = this.confetti[i];
      c.x += c.vx;
      c.y += c.vy;
      c.vy += 9.8 * dt * 0.8;
      c.rotation += c.vRot;
      c.life -= dt;
      c.alpha = Math.max(0, c.life / 2.2);
      if (c.life <= 0) {
        this.confetti.splice(i, 1);
      }
    }
  }

  renderParticles() {
    // 0. 번개 낙뢰 볼트
    if (this.lightningBolts) {
      this.lightningBolts.forEach(bolt => {
        this.ctx.save();
        this.ctx.globalAlpha = Math.max(0, bolt.life / bolt.maxLife);
        this.ctx.strokeStyle = '#FEF08A';
        this.ctx.shadowColor = '#38BDF8';
        this.ctx.shadowBlur = 12;
        this.ctx.lineWidth = 3.5;
        this.ctx.beginPath();
        this.ctx.moveTo(bolt.x - 10, 0);
        this.ctx.lineTo(bolt.x + 12, bolt.y * 0.35);
        this.ctx.lineTo(bolt.x - 8, bolt.y * 0.65);
        this.ctx.lineTo(bolt.x, bolt.y);
        this.ctx.stroke();
        this.ctx.restore();
      });
    }

    // 1. 쇼크웨이브 링
    if (this.shockwaves) {
      this.shockwaves.forEach(sw => {
        this.ctx.save();
        this.ctx.globalAlpha = sw.alpha;
        this.ctx.strokeStyle = sw.color;
        this.ctx.lineWidth = sw.lineWidth;
        this.ctx.beginPath();
        this.ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.restore();
      });
    }

    // 2. 스파크/버스트 파티클
    this.particles.forEach(p => {
      this.ctx.save();
      this.ctx.globalAlpha = p.alpha;
      this.ctx.fillStyle = p.color;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    });

    // 3. 플로팅 텍스트 팝업
    if (this.floatingPopups) {
      this.floatingPopups.forEach(pop => {
        this.ctx.save();
        this.ctx.globalAlpha = pop.alpha;

        const isHit = pop.isHitAlert;
        this.ctx.font = isHit ? 'bold 12px Pretendard, sans-serif' : 'bold 11px Pretendard, sans-serif';
        const tw = this.ctx.measureText(pop.text).width + (isHit ? 20 : 14);
        const th = isHit ? 24 : 20;

        this.ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
        this.ctx.shadowBlur = 10;
        this.ctx.fillStyle = pop.bg;
        this.ctx.beginPath();
        this.ctx.roundRect ? this.ctx.roundRect(pop.x - tw / 2, pop.y - th / 2, tw, th, 6) : this.ctx.fillRect(pop.x - tw / 2, pop.y - th / 2, tw, th);
        this.ctx.fill();

        if (pop.border) {
          this.ctx.strokeStyle = pop.border;
          this.ctx.lineWidth = 1.5;
          this.ctx.stroke();
        }

        this.ctx.shadowBlur = 0;
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(pop.text, pop.x, pop.y);
        this.ctx.restore();
      });
    }
  }

  renderConfetti() {
    this.confetti.forEach(c => {
      this.ctx.save();
      this.ctx.globalAlpha = c.alpha;
      this.ctx.translate(c.x, c.y);
      this.ctx.rotate(c.rotation);
      this.ctx.fillStyle = c.color;
      this.ctx.fillRect(-c.size / 2, -c.size / 2, c.size, c.size * 0.6);
      this.ctx.restore();
    });
  }
}
