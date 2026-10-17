/**
 * aiLoader.js - 온디바이스 AI 연산 시각화 HUD 및 실시간 추론 진행률 컨트롤러 (On-Device AI Loading HUD)
 */

export class AILoader {
  /**
   * 온디바이스 AI 연산 HUD 모달 실행 (실시간 다운로드/추론 콜백 연동 지원)
   * @param {Object} options
   * @param {string} options.title - 메인 태스크 타이틀
   * @param {string} [options.subtitle] - 서브타이틀
   * @param {Array<{ progress: number, text: string }>} [options.logs] - 기본 단계별 로그 스텝
   * @param {number} [options.duration] - 최소 시각적 피드백 시간 (ms, 기본 650ms)
   * @param {Function} [options.onComplete] - 실제 비동기 AI 추론 실행 콜백 `({ onProgress }) => Promise<void>`
   * @returns {Promise<void>}
   */
  static async run({
    title = '온디바이스 AI 신경망 연산 중...',
    subtitle = '브라우저 내장 NPU 및 온디바이스 생성 모델 가동 중',
    logs = [],
    duration = 650,
    onComplete = null
  } = {}) {
    const doc = (typeof document !== 'undefined') ? document : null;
    if (!doc) {
      if (onComplete) await onComplete({ onProgress: () => {} });
      return;
    }

    const modal = doc.getElementById('aiLoadingModal');
    const titleEl = doc.getElementById('aiLoadingTitle');
    const subEl = doc.getElementById('aiLoadingSubtitle');
    const logsEl = doc.getElementById('aiConsoleLogs');
    const progressFill = doc.getElementById('aiProgressBarFill');
    const progressPercent = doc.getElementById('aiProgressPercent');
    const progressStatus = doc.getElementById('aiProgressStatusText');

    if (!modal) {
      if (onComplete) await onComplete({ onProgress: () => {} });
      return;
    }

    if (titleEl) titleEl.textContent = title;
    if (subEl) subEl.textContent = subtitle;
    if (logsEl) logsEl.textContent = '';
    if (progressFill) progressFill.style.width = '0%';
    if (progressPercent) progressPercent.textContent = '0%';
    if (progressStatus) progressStatus.textContent = '온디바이스 AI 세션 초기화 중...';

    modal.classList.add('active');

    const appendLog = (progress, text) => {
      const clamped = Math.max(0, Math.min(100, Math.round(progress)));
      if (progressFill) progressFill.style.width = `${clamped}%`;
      if (progressPercent) progressPercent.textContent = `${clamped}%`;
      if (progressStatus) progressStatus.textContent = String(text).replace(/^\[\w+\]\s*/, '');

      if (logsEl) {
        const line = doc.createElement('div');
        line.className = 'console-line';
        const prefix = doc.createElement('span');
        prefix.className = 'log-prefix';
        prefix.textContent = '>';
        const msg = doc.createElement('span');
        msg.textContent = ` ${text}`;
        line.appendChild(prefix);
        line.appendChild(msg);
        logsEl.appendChild(line);
        logsEl.scrollTop = logsEl.scrollHeight;
      }
    };

    const defaultLogs = logs.length > 0 ? logs : [
      { progress: 20, text: '[AI] Checking Chrome Built-in LanguageModel / WebGPU runtime...' },
      { progress: 55, text: '[INFERENCE] Running on-device neural inference & persona synthesis...' },
      { progress: 85, text: '[BALANCE] Verifying 350pt stat budget & structured schema...' }
    ];

    const stepTime = Math.max(80, duration / (defaultLogs.length + 1));

    // 초반 진행 단계 표시
    for (let i = 0; i < defaultLogs.length - 1; i++) {
      appendLog(defaultLogs[i].progress, defaultLogs[i].text);
      await new Promise(r => setTimeout(r, stepTime));
    }

    // 실제 온디바이스 AI 추론 실행 (다운로드/실시간 로그 콜백 주입)
    if (onComplete) {
      await onComplete({ onProgress: appendLog });
    }

    // 완료 로그 표시
    const lastStep = defaultLogs[defaultLogs.length - 1];
    if (lastStep) {
      appendLog(lastStep.progress, lastStep.text);
    }

    await new Promise(r => setTimeout(r, 160));
    modal.classList.remove('active');
  }

  /**
   * 버튼에 로딩 스피너 및 텍스트 적용/해제
   */
  static setButtonLoading(button, isLoading, loadingText = 'AI 연산 중...') {
    if (!button) return;
    if (isLoading) {
      if (!button.dataset.originalHtml) {
        button.dataset.originalHtml = button.innerHTML;
      }
      button.disabled = true;
      button.classList.add('btn-loading');
      button.innerHTML = `<span class="ai-spinner"></span> ${loadingText}`;
    } else {
      button.disabled = false;
      button.classList.remove('btn-loading');
      if (button.dataset.originalHtml) {
        button.innerHTML = button.dataset.originalHtml;
      }
    }
  }
}
