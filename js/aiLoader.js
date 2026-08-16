/**
 * aiLoader.js - 온디바이스 AI 연산 시각화 HUD 및 로딩 컨트롤러 (On-Device AI Loading HUD)
 */

export class AILoader {
  /**
   * 온디바이스 AI 연산 HUD 모달 실행
   * @param {Object} options
   * @param {string} options.title - 메인 태스크 타이틀
   * @param {string} [options.subtitle] - 서브타이틀
   * @param {Array<{ progress: number, text: string }>} [options.logs] - 터미널 로그 스텝
   * @param {number} [options.duration] - 총 소요 시간 (ms, 기본 800ms)
   * @param {Function} [options.onComplete] - 완료 후 콜백
   * @returns {Promise<void>}
   */
  static async run({
    title = '온디바이스 AI 신경망 연산 중...',
    subtitle = '브라우저 내장 NPU 및 온디바이스 생성 모델 가동 중',
    logs = [],
    duration = 850,
    onComplete = null
  } = {}) {
    const doc = (typeof document !== 'undefined') ? document : null;
    if (!doc) {
      if (onComplete) await onComplete();
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
      if (onComplete) await onComplete();
      return;
    }

    if (titleEl) titleEl.textContent = title;
    if (subEl) subEl.textContent = subtitle;
    if (logsEl) logsEl.innerHTML = '';
    if (progressFill) progressFill.style.width = '0%';
    if (progressPercent) progressPercent.textContent = '0%';
    if (progressStatus) progressStatus.textContent = '로컬 NPU 텐서 코어 초기화...';

    modal.classList.add('active');

    const defaultLogs = logs.length > 0 ? logs : [
      { progress: 20, text: '[NPU] Local Neural Core initialized (INT4 Quantized)' },
      { progress: 50, text: '[ANALYSIS] Participant persona & race attribute tensor computed' },
      { progress: 80, text: '[SYNTHESIS] 350pt stat matrix balance synthesized' },
      { progress: 100, text: '[COMPLETE] On-Device AI Generation finished successfully' }
    ];

    const stepTime = duration / defaultLogs.length;

    for (let i = 0; i < defaultLogs.length; i++) {
      const step = defaultLogs[i];
      await new Promise(r => setTimeout(r, stepTime));

      if (progressFill) progressFill.style.width = `${step.progress}%`;
      if (progressPercent) progressPercent.textContent = `${step.progress}%`;
      if (progressStatus) progressStatus.textContent = step.text.replace(/\[\w+\]\s*/, '');

      if (logsEl) {
        const line = document.createElement('div');
        line.className = 'console-line';
        line.innerHTML = `<span class="log-prefix">&gt;</span> ${step.text}`;
        logsEl.appendChild(line);
        logsEl.scrollTop = logsEl.scrollHeight;
      }
    }

    if (onComplete) {
      await onComplete();
    }

    await new Promise(r => setTimeout(r, 200));
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
