/**
 * canvasRenderer.js - 60FPS 고해상도 2D 캔버스 경마 렌더러
 * 미려한 잔디 트랙, 부드러운 말/기수 애니메이션, 파티클 및 카메라 추적
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

    // 파티클 시스템
    this.particles = [];
    this.confetti = [];

    // 애니메이션 틱
    this.animTime = 0;

    // 트랙 레이아웃 파라미터
    this.trackPixelLength = 3200; // 가상 트랙 총 픽셀 길이
    this.laneHeight = 64;
    this.trackTop = 90;

    this.initResize();
  }

  initResize() {
    const handleResize = () => {
      const rect = this.canvas.parentElement.getBoundingClientRect();
      this.width = rect.width;
      this.height = Math.max(420, rect.height || 460);

      this.canvas.width = this.width * this.dpr;
      this.canvas.height = this.height * this.dpr;
      this.canvas.style.width = `${this.width}px`;
      this.canvas.style.height = `${this.height}px`;

      this.ctx.scale(this.dpr, this.dpr);
    };

    window.addEventListener('resize', handleResize);
    handleResize();
  }

  setHorseCount(count) {
    // 말 수에 따라 레인 높이 및 캔버스 높이 조절
    const minHeight = 420;
    const requiredHeight = this.trackTop + (count * this.laneHeight) + 60;
    const targetHeight = Math.max(minHeight, requiredHeight);

    this.canvas.parentElement.style.minHeight = `${targetHeight}px`;
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.width = rect.width;
    this.height = targetHeight;

    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.ctx.scale(this.dpr, this.dpr);
  }

  reset() {
    this.cameraX = 0;
    this.targetCameraX = 0;
    this.particles = [];
    this.confetti = [];
    this.shockwaves = [];
    this.floatingPopups = [];
    this.animTime = 0;
  }

  render(engine, dt = 0.016) {
    this.animTime += dt;
    this.updateParticles(dt);

    const horses = engine.horses;
    if (!horses || horses.length === 0) return;

    // 카메라 추적: 선두와 후미의 중간 지점을 부드럽게 추적하거나 선두 우선 추적
    const startX = 140;
    const finishX = this.trackPixelLength - 220;
    const trackWidthSpan = finishX - startX;

    let maxProgress = 0;
    let minProgress = 1;
    horses.forEach(h => {
      if (h.progress > maxProgress) maxProgress = h.progress;
      if (h.progress < minProgress) minProgress = h.progress;
    });

    const leaderWorldX = startX + maxProgress * trackWidthSpan;
    // 카메라가 선두를 화면 65% 위치에 두도록 설정
    this.targetCameraX = Math.max(0, leaderWorldX - this.width * 0.65);
    // 트랙 끝을 벗어나지 않도록
    const maxCameraX = Math.max(0, this.trackPixelLength - this.width + 40);
    this.targetCameraX = Math.min(maxCameraX, this.targetCameraX);

    // 부드러운 카메라 이동 (Lerp)
    this.cameraX += (this.targetCameraX - this.cameraX) * Math.min(1, dt * 6);

    // 캔버스 클리어
    this.ctx.clearRect(0, 0, this.width, this.height);

    this.ctx.save();
    // 카메라 이동 적용
    this.ctx.translate(-this.cameraX, 0);

    // 1. 관중석 & 배경 렌더링
    this.renderBackground();

    // 2. 트랙 및 레인 렌더링
    this.renderTrack(horses.length, startX, finishX);

    // 3. 거리 마커 및 게이트/결승선 렌더링
    this.renderMarkers(engine.totalDistance, startX, finishX, horses.length);

    // 3.5. 아이템 박스 및 트랙 장애물(바나나) 렌더링
    if (engine.gameMode === 'item') {
      this.renderItemBoxes(engine.itemBoxes, startX, trackWidthSpan, engine.totalDistance);
      this.renderObstacles(engine.obstacles, startX, trackWidthSpan, engine.totalDistance);
      this.renderProjectiles(engine.projectiles, startX, trackWidthSpan, engine.totalDistance);
    }

    // 4. 파티클 렌더링 (말 뒤 먼지 등)
    this.renderParticles();

    // 5. 말 및 기수 렌더링 (레인 순서대로)
    horses.forEach((horse, index) => {
      const horseX = startX + horse.progress * trackWidthSpan;
      const horseY = this.trackTop + index * this.laneHeight + this.laneHeight * 0.55;

      // 달릴 때 먼지 생성
      if (engine.isRunning && !horse.finished && Math.random() < 0.35) {
        this.addDustParticle(horseX - 25, horseY + 12, horse.color.body);
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
  }

  renderBackground() {
    // 상단 하늘 / 스타디움 벽
    const skyGrad = this.ctx.createLinearGradient(0, 0, 0, this.trackTop);
    skyGrad.addColorStop(0, '#1A202C');
    skyGrad.addColorStop(1, '#2D3748');
    this.ctx.fillStyle = skyGrad;
    this.ctx.fillRect(this.cameraX, 0, this.width, this.trackTop);

    // 관중석 펜스 & 관중 실루엣
    this.ctx.fillStyle = '#4A5568';
    this.ctx.fillRect(0, this.trackTop - 24, this.trackPixelLength, 24);

    // 환호하는 관중 도트 애니메이션
    const crowdSpacing = 18;
    const crowdCount = Math.ceil(this.trackPixelLength / crowdSpacing);
    for (let i = 0; i < crowdCount; i++) {
      const cx = i * crowdSpacing;
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
      const flagColors = ['#E53E3E', '#3182CE', '#D69E2E', '#38A169', '#805AD5'];
      this.ctx.fillStyle = flagColors[(i / 4) % flagColors.length];
      this.ctx.beginPath();
      this.ctx.moveTo(fx, this.trackTop - 45);
      this.ctx.lineTo(fx + 12, this.trackTop - 38);
      this.ctx.lineTo(fx, this.trackTop - 31);
      this.ctx.fill();
    }
  }

  renderTrack(horseCount, startX, finishX) {
    const totalTrackHeight = horseCount * this.laneHeight;

    // 잔디 트랙 배경
    const turfGrad = this.ctx.createLinearGradient(0, this.trackTop, 0, this.trackTop + totalTrackHeight);
    turfGrad.addColorStop(0, '#22543D');
    turfGrad.addColorStop(0.5, '#276749');
    turfGrad.addColorStop(1, '#1C4532');
    this.ctx.fillStyle = turfGrad;
    this.ctx.fillRect(0, this.trackTop, this.trackPixelLength, totalTrackHeight);

    // 미세 잔디 줄무늬 패턴
    for (let x = 0; x < this.trackPixelLength; x += 80) {
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.025)';
      this.ctx.fillRect(x, this.trackTop, 40, totalTrackHeight);
    }

    // 레인 구분선 (점선)
    for (let i = 0; i <= horseCount; i++) {
      const y = this.trackTop + i * this.laneHeight;

      this.ctx.strokeStyle = i === 0 || i === horseCount ? '#FFFFFF' : 'rgba(255, 255, 255, 0.25)';
      this.ctx.lineWidth = i === 0 || i === horseCount ? 3 : 1.5;

      if (i > 0 && i < horseCount) {
        this.ctx.setLineDash([12, 8]);
      } else {
        this.ctx.setLineDash([]);
      }

      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.trackPixelLength, y);
      this.ctx.stroke();
    }
    this.ctx.setLineDash([]);

    // 하단 펜스 및 바닥 그림자
    this.ctx.fillStyle = '#1A202C';
    this.ctx.fillRect(0, this.trackTop + totalTrackHeight, this.trackPixelLength, 40);
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
      { ratio: 0.90, label: `⚡️ 라스트 100m!` }
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
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      this.ctx.roundRect ? this.ctx.roundRect(mx - 45, this.trackTop - 24, 90, 20, 4) : this.ctx.fillRect(mx - 45, this.trackTop - 24, 90, 20);
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
    this.ctx.fillStyle = '#D69E2E';
    this.ctx.fillRect(finishX - 4, this.trackTop - 35, 38, 35);
    this.ctx.fillStyle = '#1A202C';
    this.ctx.font = 'bold 12px Pretendard, sans-serif';
    this.ctx.fillText('FINISH', finishX + 15, this.trackTop - 14);
  }

  renderItemBoxes(boxes, startX, trackWidthSpan, totalDistance) {
    boxes.forEach(box => {
      if (box.collected) return;
      const actualX = startX + (box.distance / totalDistance) * trackWidthSpan;
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
      this.ctx.fillStyle = 'rgba(239, 68, 68, 0.6)';
      this.ctx.beginPath();
      this.ctx.arc(-10, 0, 7, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.fillStyle = 'rgba(245, 158, 11, 0.8)';
      this.ctx.beginPath();
      this.ctx.arc(-6, 0, 4, 0, Math.PI * 2);
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

    // 1. 말 그림자
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    this.ctx.beginPath();
    this.ctx.ellipse(0, 16, 26, 7, 0, 0, Math.PI * 2);
    this.ctx.fill();

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
      auraGrad.addColorStop(0, 'rgba(237, 137, 54, 0.4)');
      auraGrad.addColorStop(0.7, 'rgba(246, 224, 94, 0.15)');
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

    // 3. 말 달리기 애니메이션 각도 계산 (다그닥 움직임)
    const gallopSpeed = engine.isRunning && !horse.finished ? (horse.speed / 15) : 0;
    const gallopPhase = this.animTime * 14 * (gallopSpeed > 0 ? gallopSpeed : 1) + horse.lane;
    const bodyBob = Math.sin(gallopPhase * 2) * (gallopSpeed > 0 ? 3 : 0);
    const bodyTilt = Math.sin(gallopPhase) * 0.08;

    this.ctx.translate(0, bodyBob);
    this.ctx.rotate(bodyTilt);

    // 말 몸통 색상
    const horseColor = horse.color.body || '#E53E3E';
    const silkColor = horse.color.silk || '#FFFFFF';

    // 4. 뒷다리 2개
    this.renderLeg(-14, 8, Math.sin(gallopPhase) * 0.8 + 0.3, horseColor);
    this.renderLeg(-8, 8, Math.sin(gallopPhase + 0.5) * 0.8 + 0.3, horseColor);

    // 5. 꼬리 (살랑거림)
    const tailWag = Math.sin(gallopPhase * 2) * 0.3;
    this.ctx.strokeStyle = '#2D3748';
    this.ctx.lineWidth = 3.5;
    this.ctx.beginPath();
    this.ctx.moveTo(-18, -2);
    this.ctx.quadraticCurveTo(-28, -6 + tailWag * 10, -32, 4 + tailWag * 15);
    this.ctx.stroke();

    // 6. 몸통 (Body)
    this.ctx.fillStyle = horseColor;
    this.ctx.beginPath();
    this.ctx.ellipse(0, 0, 20, 11, 0, 0, Math.PI * 2);
    this.ctx.fill();

    // 7. 앞다리 2개
    this.renderLeg(10, 8, Math.sin(gallopPhase + Math.PI) * 0.8 - 0.2, horseColor);
    this.renderLeg(16, 8, Math.sin(gallopPhase + Math.PI + 0.5) * 0.8 - 0.2, horseColor);

    // 8. 목 & 머리 (Neck & Head)
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

    // 9. 안장 & 기수 (Jockey in Racing Silks)
    // 안장
    this.ctx.fillStyle = '#2D3748';
    this.ctx.fillRect(-6, -12, 14, 4);

    // 기수 몸체
    this.ctx.fillStyle = silkColor;
    this.ctx.beginPath();
    this.ctx.ellipse(0, -16, 7, 6, 0.4, 0, Math.PI * 2);
    this.ctx.fill();

    // 기수 헬멧/모자
    this.ctx.fillStyle = horseColor;
    this.ctx.beginPath();
    this.ctx.arc(5, -23, 5, 0, Math.PI * 2);
    this.ctx.fill();
    // 모자 챙
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.fillRect(7, -22, 5, 2);

    this.ctx.restore(); // 말 변형 복원

    // 10. 상단 이름표 및 실시간 순위/상태 배지 렌더링 (흔들림 없이 고정)
    this.renderHorseBadge(horse, x, y);
  }

  renderLeg(ox, oy, angle, color) {
    this.ctx.save();
    this.ctx.translate(ox, oy);
    this.ctx.rotate(angle);

    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 4;
    this.ctx.lineCap = 'round';

    // 허벅지 -> 무릎
    this.ctx.beginPath();
    this.ctx.moveTo(0, 0);
    this.ctx.lineTo(0, 10);
    // 발목 -> 발굽
    this.ctx.lineTo(Math.sin(angle) * 4, 18);
    this.ctx.stroke();

    // 발굽 (말굽 블랙)
    this.ctx.fillStyle = '#1A202C';
    this.ctx.fillRect(Math.sin(angle) * 4 - 2, 16, 4, 3);

    this.ctx.restore();
  }

  renderHorseBadge(horse, x, y) {
    this.ctx.save();
    this.ctx.translate(x, y - 36);

    const aiIcon = horse.strategy ? horse.strategy.icon : '';
    const displayName = aiIcon ? `${horse.name} ${aiIcon}` : horse.name;
    this.ctx.font = 'bold 12px Pretendard, sans-serif';
    const textWidth = this.ctx.measureText(displayName).width;
    const badgeWidth = Math.max(78, textWidth + 36);
    const badgeHeight = 22;

    // 배지 배경
    this.ctx.fillStyle = 'rgba(26, 32, 44, 0.88)';
    this.ctx.strokeStyle = horse.color.border || '#A0AEC0';
    this.ctx.lineWidth = 1.5;

    this.ctx.beginPath();
    this.ctx.roundRect ? this.ctx.roundRect(-badgeWidth / 2, -badgeHeight / 2, badgeWidth, badgeHeight, 6) : this.ctx.fillRect(-badgeWidth / 2, -badgeHeight / 2, badgeWidth, badgeHeight);
    this.ctx.fill();
    this.ctx.stroke();

    // 순위 동그라미
    const rankColors = { 1: '#ECC94B', 2: '#CBD5E0', 3: '#ED8936' };
    const rColor = rankColors[horse.rank] || '#4A5568';

    this.ctx.fillStyle = rColor;
    this.ctx.beginPath();
    this.ctx.arc(-badgeWidth / 2 + 12, 0, 7, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.fillStyle = horse.rank <= 3 ? '#1A202C' : '#FFFFFF';
    this.ctx.font = 'bold 9px Pretendard, sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(`${horse.rank}`, -badgeWidth / 2 + 12, 0);

    // 이름 + AI 아이콘
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.font = 'bold 11px Pretendard, sans-serif';
    this.ctx.textAlign = 'left';
    this.ctx.fillText(displayName, -badgeWidth / 2 + 23, 0);

    // 상태 아이콘 / 말풍선
    if (horse.heldItem) {
      this.renderStateBubble(0, -18, `${horse.heldItem.icon} ${horse.heldItem.name}`, '#D97706');
    } else if (horse.stateMessage) {
      const bg = horse.state === 'boost' ? '#DD6B20' : (horse.state === 'slip' ? '#3182CE' : '#4A5568');
      this.renderStateBubble(0, -18, horse.stateMessage, bg);
    } else if (horse.state === 'boost') {
      this.renderStateBubble(0, -18, '⚡️ 부스터!', '#DD6B20');
    } else if (horse.state === 'slip') {
      this.renderStateBubble(0, -18, '💦 미끄러짐!', '#3182CE');
    } else if (horse.state === 'tired') {
      this.renderStateBubble(0, -18, '😫 방전!', '#718096');
    } else if (horse.finished) {
      this.renderStateBubble(0, -18, `🏁 ${horse.rank}등 골인`, '#38A169');
    }

    this.ctx.restore();
  }

  renderStateBubble(bx, by, text, bg) {
    this.ctx.save();
    this.ctx.font = 'bold 10px Pretendard, sans-serif';
    const tw = this.ctx.measureText(text).width + 12;

    this.ctx.fillStyle = bg;
    this.ctx.beginPath();
    this.ctx.roundRect ? this.ctx.roundRect(bx - tw / 2, by - 8, tw, 16, 4) : this.ctx.fillRect(bx - tw / 2, by - 8, tw, 16);
    this.ctx.fill();

    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(text, bx, by);
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

  addDustParticle(x, y, color) {
    this.particles.push({
      x, y,
      vx: -(1.5 + Math.random() * 2),
      vy: -(Math.random() * 1.5 - 0.5),
      size: 3 + Math.random() * 4,
      alpha: 0.6,
      color: 'rgba(214, 158, 46, 0.6)',
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
    // 먼지/스파크/버스트 업데이트
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

    // 쇼크웨이브 링 업데이트
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

    // 플로팅 텍스트 팝업 업데이트
    if (this.floatingPopups) {
      for (let i = this.floatingPopups.length - 1; i >= 0; i--) {
        const pop = this.floatingPopups[i];
        pop.y += pop.vy * dt;
        pop.life -= dt;
        pop.alpha = Math.max(0, Math.min(1.0, pop.life / (pop.maxLife * 0.35)));
        if (pop.life <= 0) {
          this.floatingPopups.splice(i, 1);
        }
      }
    }

    // 폭죽 업데이트
    for (let i = this.confetti.length - 1; i >= 0; i--) {
      const c = this.confetti[i];
      c.x += c.vx;
      c.y += c.vy;
      c.vy += 9.8 * dt * 0.8; // 중력
      c.rotation += c.vRot;
      c.life -= dt;
      c.alpha = Math.max(0, c.life / 2.2);
      if (c.life <= 0) {
        this.confetti.splice(i, 1);
      }
    }
  }

  renderParticles() {
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
        this.ctx.font = 'bold 12px Pretendard, sans-serif';
        const tw = this.ctx.measureText(pop.text).width + 16;
        const th = 22;

        // 배지 배경 그림자 & 박스
        this.ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
        this.ctx.shadowBlur = 8;
        this.ctx.fillStyle = pop.bg;
        this.ctx.beginPath();
        this.ctx.roundRect ? this.ctx.roundRect(pop.x - tw / 2, pop.y - th / 2, tw, th, 6) : this.ctx.fillRect(pop.x - tw / 2, pop.y - th / 2, tw, th);
        this.ctx.fill();

        // 텍스트
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
