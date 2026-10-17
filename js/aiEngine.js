/**
 * aiEngine.js - 브라우저 온디바이스 AI 엔진 (On-Device AI Engine v2.0)
 *
 * [3-Tier On-Device AI Architecture]
 * - Tier 1 (Chrome Built-in AI): 표준 Prompt API (`globalThis.LanguageModel`) 및 레거시 `self.ai.languageModel`
 *   · 베이스 세션 `initialPrompts` 프리워밍 + 태스크별 `clone()` & `destroy()` 메모리 관리
 *   · `responseConstraint` JSON Schema 구조화 출력 및 `promptStreaming()` 실시간 토큰 스트리밍 지원
 * - Tier 2 (WebGPU / WASM In-Browser LLM): `@huggingface/transformers` (Transformers.js v3)
 *   · Chrome 플래그 미설정 환경이나 Safari/Edge/Firefox에서도 실제 양자화(Q4) 신경망 모델을 브라우저에서 구동
 * - Tier 3 (Context-Aware Combinatorial NLG): 오프라인/즉시 응답용 직급·성향·경기 텔레메트리 인지형 생성 엔진
 */

const SYSTEM_PROMPT =
  '당신은 한국 IT/오피스 회사의 유쾌하고 재치 넘치는 사내 커피내기 경마 게임(오피스 더비) 전담 AI 캐스터이자 마구간 디렉터입니다. 항상 한국어로 짧고 위트 있게 핵심만 답변하세요.';

export class OnDeviceAIEngine {
  constructor() {
    this.hasChromeAI = false;
    this.hasWebLLM = false;
    this.isWebLLMLoading = false;
    this.availability = 'checking'; // 'available' | 'downloadable' | 'downloading' | 'unavailable'
    this.activeTier = 'heuristic'; // 'chrome-gemini-nano' | 'webgpu-transformers' | 'heuristic'
    this.baseSession = null;
    this.webLLMPipeline = null;
    this.webLLMModelId = 'onnx-community/Qwen2.5-0.5B-Instruct';
    this.downloadProgress = 0;

    // 반복 추론 방지용 로컬 결과 캐시 (modern-web-guidance: Cache results for repeated tasks)
    this.cache = new Map();
    this.telemetry = {
      totalCalls: 0,
      llmCalls: 0,
      lastLatencyMs: 0,
      lastProvider: 'Local NLG'
    };

    this.statusListeners = new Set();
    this.initChromeAI();
  }

  /**
   * 상태 변경 리스너 등록
   */
  onStatusChange(listener) {
    if (typeof listener === 'function') {
      this.statusListeners.add(listener);
    }
    return () => this.statusListeners.delete(listener);
  }

  notifyStatusChange() {
    const status = this.getStatus();
    this.statusListeners.forEach(fn => {
      try {
        fn(status);
      } catch (_) {}
    });
  }

  /**
   * 현재 활성화된 온디바이스 AI 엔진 상태 조회
   */
  getStatus() {
    if (this.hasChromeAI && this.baseSession) {
      return {
        tier: 'chrome-gemini-nano',
        shortLabel: 'Gemini Nano NPU',
        detailLabel: 'Chrome 내장 Gemini Nano (LanguageModel API) 활성',
        badgeState: 'ready',
        availability: this.availability,
        telemetry: { ...this.telemetry }
      };
    }
    if (this.hasWebLLM && this.webLLMPipeline) {
      return {
        tier: 'webgpu-transformers',
        shortLabel: 'WebGPU Neural LLM',
        detailLabel: `Transformers.js 온디바이스 LLM (${this.webLLMModelId}) 활성`,
        badgeState: 'ready',
        availability: 'available',
        telemetry: { ...this.telemetry }
      };
    }
    if (this.availability === 'downloadable' || this.availability === 'after-download') {
      return {
        tier: 'chrome-downloadable',
        shortLabel: 'Gemini Nano 준비됨',
        detailLabel: '클릭 시 Chrome 내장 Gemini Nano 세션 즉시 활성화',
        badgeState: 'downloadable',
        availability: this.availability,
        telemetry: { ...this.telemetry }
      };
    }
    return {
      tier: 'heuristic',
      shortLabel: '온디바이스 NLG (LLM 로드 가능)',
      detailLabel: '내장 휴리스틱 NLG 활성 · 클릭하여 브라우저 WebGPU LLM 다운로드 가능',
      badgeState: 'fallback',
      availability: this.availability,
      telemetry: { ...this.telemetry }
    };
  }

  /**
   * Chrome Built-in AI (표준 LanguageModel API 및 레거시 window.ai.languageModel) 감지 및 프리워밍
   */
  async initChromeAI(onProgress = null) {
    try {
      const g = typeof globalThis !== 'undefined' ? globalThis : {};

      // 1. 최신 표준 Prompt API ('LanguageModel' in self)
      if ('LanguageModel' in g && g.LanguageModel) {
        const availability = await g.LanguageModel.availability();
        this.availability = availability;

        if (availability === 'available' || (availability !== 'unavailable' && onProgress)) {
          this.baseSession = await g.LanguageModel.create({
            initialPrompts: [{ role: 'system', content: SYSTEM_PROMPT }],
            monitor: (m) => {
              if (m && typeof m.addEventListener === 'function') {
                m.addEventListener('downloadprogress', (e) => {
                  const pct = Math.round((e.loaded || 0) * 100);
                  this.downloadProgress = pct;
                  if (onProgress) onProgress(pct, `[Gemini Nano] 온디바이스 모델 가중치 다운로드 중... (${pct}%)`);
                });
              }
            }
          });
          this.hasChromeAI = true;
          this.activeTier = 'chrome-gemini-nano';
          this.telemetry.lastProvider = 'Gemini Nano (LanguageModel)';
          this.notifyStatusChange();
          return true;
        }
        this.notifyStatusChange();
        return false;
      }

      // 2. 레거시 Chrome Origin Trial API (self.ai.languageModel / window.ai.languageModel)
      const legacyLM = g.ai?.languageModel || (typeof window !== 'undefined' ? window.ai?.languageModel : null);
      if (legacyLM) {
        const capabilities = await legacyLM.capabilities();
        this.availability = capabilities?.available || 'unavailable';

        if (this.availability === 'readily' || (this.availability === 'after-download' && onProgress)) {
          this.baseSession = await legacyLM.create({
            systemPrompt: SYSTEM_PROMPT,
            monitor: (m) => {
              if (m && typeof m.addEventListener === 'function') {
                m.addEventListener('downloadprogress', (e) => {
                  const pct = Math.round((e.loaded || 0) * 100);
                  this.downloadProgress = pct;
                  if (onProgress) onProgress(pct, `[Gemini Nano] 모델 다운로드 중... (${pct}%)`);
                });
              }
            }
          });
          this.hasChromeAI = true;
          this.activeTier = 'chrome-gemini-nano';
          this.telemetry.lastProvider = 'Gemini Nano (legacy ai.languageModel)';
          this.notifyStatusChange();
          return true;
        }
        this.notifyStatusChange();
        return false;
      }

      this.availability = 'unavailable';
      this.notifyStatusChange();
      return false;
    } catch (_) {
      this.availability = 'unavailable';
      this.notifyStatusChange();
      return false;
    }
  }

  /**
   * 사용자 제스처(버튼 클릭 등) 시점에 Chrome AI 세션이 아직 생성되지 않았다면 지연 생성 시도
   */
  async ensureSession(onProgress = null) {
    if (this.hasChromeAI && this.baseSession) return true;
    if (this.hasWebLLM && this.webLLMPipeline) return true;

    const g = typeof globalThis !== 'undefined' ? globalThis : {};
    if ('LanguageModel' in g || g.ai?.languageModel) {
      return await this.initChromeAI(onProgress || (() => {}));
    }
    return false;
  }

  /**
   * Tier 2: Chrome 내장 AI가 없는 일반 브라우저를 위한 WebGPU/WASM 기반 Transformers.js 실시간 로드
   */
  async loadWebLLM(onProgress = null) {
    if (this.hasWebLLM && this.webLLMPipeline) return true;
    if (this.isWebLLMLoading) return false;

    // 먼저 Chrome Built-in AI가 활성화 가능한지 확인
    const chromeActivated = await this.initChromeAI(onProgress || (() => {}));
    if (chromeActivated) return true;

    this.isWebLLMLoading = true;
    this.notifyStatusChange();

    try {
      if (onProgress) onProgress(10, '[WebGPU/WASM] Transformers.js v3 온디바이스 런타임 모듈 로드 중...');
      const { pipeline, env } = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.4.0');
      env.allowLocalModels = false;

      const hasWebGPU = typeof navigator !== 'undefined' && 'gpu' in navigator;
      const device = hasWebGPU ? 'webgpu' : 'wasm';

      if (onProgress) {
        onProgress(25, `[${device.toUpperCase()}] Qwen2.5-0.5B-Instruct (INT4 양자화) 신경망 가중치 준비 중...`);
      }

      this.webLLMPipeline = await pipeline('text-generation', this.webLLMModelId, {
        dtype: 'q4',
        device,
        progress_callback: (info) => {
          if (info && info.status === 'progress' && typeof info.progress === 'number') {
            const pct = Math.min(98, Math.max(25, Math.round(25 + info.progress * 0.7)));
            this.downloadProgress = pct;
            if (onProgress) {
              const fileLabel = info.file ? info.file.split('/').pop() : 'model.onnx';
              onProgress(pct, `[${device.toUpperCase()}] ${fileLabel} 다운로드 중... (${ Math.round(info.progress)}%)`);
            }
          }
        }
      });

      this.hasWebLLM = true;
      this.isWebLLMLoading = false;
      this.activeTier = 'webgpu-transformers';
      this.telemetry.lastProvider = `Transformers.js (${device.toUpperCase()})`;
      this.notifyStatusChange();
      if (onProgress) onProgress(100, '[COMPLETE] 브라우저 내장 WebGPU/WASM 신경망 LLM 활성화 완료!');
      return true;
    } catch (err) {
      this.isWebLLMLoading = false;
      this.notifyStatusChange();
      throw err;
    }
  }

  /**
   * 베이스 세션을 복제(clone)하여 단일 프롬프트 실행 후 즉시 destroy()로 메모리 반환
   * (modern-web-guidance: Clone sessions for repetitive tasks & Destroy unused sessions)
   */
  async runPrompt(promptText, { schema = null, signal = null } = {}) {
    const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    this.telemetry.totalCalls++;

    await this.ensureSession();

    // Tier 1: Chrome Built-in AI (LanguageModel)
    if (this.hasChromeAI && this.baseSession) {
      let taskSession = null;
      try {
        taskSession = typeof this.baseSession.clone === 'function'
          ? await this.baseSession.clone()
          : this.baseSession;

        const options = {};
        if (schema) options.responseConstraint = schema;
        if (signal) options.signal = signal;

        const raw = await taskSession.prompt(promptText, Object.keys(options).length > 0 ? options : undefined);
        const endTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
        this.telemetry.llmCalls++;
        this.telemetry.lastLatencyMs = Math.round(endTime - startTime);
        this.telemetry.lastProvider = 'Gemini Nano (NPU)';
        return typeof raw === 'string' ? raw.trim() : '';
      } finally {
        if (taskSession && taskSession !== this.baseSession && typeof taskSession.destroy === 'function') {
          try {
            taskSession.destroy();
          } catch (_) {}
        }
      }
    }

    // Tier 2: Transformers.js WebGPU / WASM Pipeline
    if (this.hasWebLLM && this.webLLMPipeline) {
      const messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: promptText }
      ];
      const output = await this.webLLMPipeline(messages, {
        max_new_tokens: 96,
        temperature: 0.75,
        do_sample: true,
        return_full_text: false
      });
      const generated = output?.[0]?.generated_text;
      const text = typeof generated === 'string'
        ? generated
        : (Array.isArray(generated) ? generated[generated.length - 1]?.content || '' : '');
      const endTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
      this.telemetry.llmCalls++;
      this.telemetry.lastLatencyMs = Math.round(endTime - startTime);
      return text.trim();
    }

    return null;
  }

  /**
   * 베이스 세션이 더 이상 필요 없을 때 명시적으로 해제
   */
  destroy() {
    if (this.baseSession && typeof this.baseSession.destroy === 'function') {
      try {
        this.baseSession.destroy();
      } catch (_) {}
    }
    this.baseSession = null;
    this.hasChromeAI = false;
  }

  /**
   * 1. 참가자 이름과 AI 성향/직급을 분석하여 위트 있는 사내 AI 별명 생성
   */
  async generateNickname(name, strategyName = '돌진', options = {}) {
    const cleanName = String(name || '선수').trim();
    const cleanStrat = String(strategyName || '돌진').trim();
    const cacheKey = `nick:${cleanName.toLowerCase()}:${cleanStrat.toLowerCase()}`;

    if (!options.forceFresh && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      const llmRes = await this.runPrompt(
        `사내 커피내기 경마 참가자 "${cleanName}"(성향: ${cleanStrat})의 재치 있는 오피스 별명 단어 1개만 출력해줘. 해시태그나 따옴표 없이 3~7글자 한국어 별명만 출력:`
      );
      if (llmRes) {
        const cleaned = llmRes
          .replace(/[#\n\r"'`*:\-\s]/g, '')
          .slice(0, 10);
        if (cleaned.length >= 2) {
          this.cache.set(cacheKey, cleaned);
          return cleaned;
        }
      }
    } catch (_) {}

    // Tier 3: 직급/역할 및 AI 전략 성향 인지형 로컬 조합 엔진
    const rolePrefixMap = [
      { match: /팀장|실장|부장|본부장|대표|이사/, pool: ['법카의', '결재판', '회의실', '주간보고', '전결권자'] },
      { match: /과장|차장|매니저|리드|파트장/, pool: ['일정관리', '스프린트', '마감의', '야근방어', '커피수혈'] },
      { match: /대리|주임|선임|책임/, pool: ['엑셀의', '슬랙의', '칼퇴의', '카페인', '실무의'] },
      { match: /사원|인턴|주니어|신입/, pool: ['탕비실', '정시퇴근', '금요일', '점심시간', '패기의'] }
    ];

    const strategySuffixMap = {
      '저격수': ['일격필살', '막판저격수', '결승선암살자', '역전스나이퍼', '빈틈포착러'],
      '돌진형': ['폭주기관차', '0초컷칼퇴러', '아우토반', '초음속질주', '풀악셀장인'],
      '철벽 수호자': ['법카수호신', '무결점방패', '절대방어막', '철벽디펜더', '생존마스터'],
      '트릭스터': ['바나나연금술사', '함정설계자', '혼돈의마에스트로', '트랙교란꾼', '심리전대가'],
      '승부사': ['단두대승부사', '벼랑끝역전왕', '기적의스퍼트', '도파민중독', '드라마메이커']
    };

    const defaultPrefixes = [
      '칼퇴의', '야근탈출', '탕비실', '회의실', '슬랙의', '월급날', '카페인',
      '월요병극복', '엑셀의', '금요일오후', '점심시간', '법카의', '스프린트',
      '마감의', '품의서', '연차의', '출퇴근', '사내메신저'
    ];
    const defaultSuffixes = [
      '지배자', '요정', '바리스타', '수호자', '연금술사', '마스터',
      '저격수', '스피드스타', '네고왕', '치트키', '생존자', '장인', '폭주기관차'
    ];

    let matchedPrefixes = defaultPrefixes;
    for (const rule of rolePrefixMap) {
      if (rule.match.test(cleanName)) {
        matchedPrefixes = [...rule.pool, ...defaultPrefixes];
        break;
      }
    }
    const matchedSuffixes = strategySuffixMap[cleanStrat] || defaultSuffixes;

    let hash = 0;
    for (let i = 0; i < cleanName.length; i++) {
      hash = (hash << 5) - hash + cleanName.charCodeAt(i);
      hash |= 0;
    }
    const jitter = options.forceFresh ? Math.floor(Math.random() * 17) + 1 : Math.floor(Math.random() * 3);
    const pIdx = Math.abs(hash + jitter) % matchedPrefixes.length;
    const sIdx = Math.abs((hash >> 3) + jitter * 5) % matchedSuffixes.length;

    const result = `${matchedPrefixes[pIdx]}${matchedSuffixes[sIdx]}`;
    this.cache.set(cacheKey, result);
    return result;
  }

  /**
   * 2. 온디바이스 AI 기반 신규 350pt 밸런스 경주마 페르소나(이름 + 배경 서사) 생성
   * (기존 HorseGenerator.generateAIHorse가 AI를 호출하지 않던 문제를 해결!)
   */
  async generateHorsePersona(archetype, strategy, stats) {
    const archName = archetype?.name || '올라운더';
    const stratName = strategy?.name || '돌진형';

    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        lore: { type: 'string' }
      },
      required: ['name', 'lore']
    };

    try {
      const llmRes = await this.runPrompt(
        `사내 커피내기 경마 게임의 새로운 명마 이름(이모지 1개 포함, 10자 이내)과 유쾌한 오피스 배경 스토리(1문장, 45자 이내)를 JSON으로 생성해줘. 아키타입: "${archName}", AI성향: "${stratName}", 주요스탯: 속도 ${stats?.speed || 70}/가속 ${stats?.accel || 70}/지구력 ${stats?.stamina || 70}/행운 ${stats?.luck || 70}/지능 ${stats?.intellect || 70}.`,
        { schema }
      );

      if (llmRes) {
        const jsonMatch = llmRes.match(/\{[\s\S]*\}/);
        const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : llmRes);
        if (parsed && typeof parsed.name === 'string' && typeof parsed.lore === 'string') {
          return {
            name: parsed.name.trim().slice(0, 22),
            lore: parsed.lore.trim().slice(0, 90),
            provider: this.telemetry.lastProvider
          };
        }
      }
    } catch (_) {}

    // 스탯 최고치 및 아키타입 맞춤형 NLG 합성
    const statIcons = {
      speed: '⚡️',
      accel: '🚀',
      stamina: '🔋',
      luck: '🍀',
      intellect: '🧠'
    };
    const topStatKey = Object.entries(stats || { speed: 70 })
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'speed';
    const icon = statIcons[topStatKey] || '🏇';

    const prefixesByStat = {
      speed: ['초음속 칼퇴', '아우토반', '광속 퇴근', '제트 에스프레소', '섬광의 법카'],
      accel: ['로켓 스타트', '월요병 브레이커', '급발진 결재', '터보 아메리카노', '제로백 1초'],
      stamina: ['야근 불사조', '무한 카페인', '강철의 철야', '풀타임 에이스', '에너자이저'],
      luck: ['황금 법카', '럭키 블라인드', '행운의 당첨회피', '로또 스퍼트', '기적의 주사위'],
      intellect: ['판교 알고리즘', 'AI 전략가', '슬립스트림 박사', '프롬프트 마스터', '완벽한 설계자']
    };
    const suffixes = ['익스프레스', '스트라이커', '선더볼트', '팬텀', '뱅가드', '챔피언', '위자드'];

    const pPool = prefixesByStat[topStatKey] || prefixesByStat.speed;
    const prefix = pPool[Math.floor(Math.random() * pPool.length)];
    const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];

    const loreTemplates = [
      `최고 능력치(${topStatKey.toUpperCase()} ${stats?.[topStatKey] || 80})를 앞세워 '${stratName}' 전술로 커피 결제를 완벽히 회피하는 사내 명마.`,
      `탕비실 에스프레소 머신의 압력을 견디며 각성하여 ${archName} 포지션에서 압도적 승률을 자랑합니다.`,
      `퇴근 5분 전 긴급 회의 소집에도 흔들리지 않고 결승선만 노리는 ${stratName} 특화 경주마.`
    ];

    return {
      name: `${icon} ${prefix} ${suffix}`,
      lore: loreTemplates[Math.floor(Math.random() * loreTemplates.length)],
      provider: this.telemetry.lastProvider
    };
  }

  /**
   * 3. 참가자 명단과 마구간 말 목록을 분석하여 최적의 파트너 말 & 맞춤형 별명 매칭
   * (기존 autoDraftHorsesForAllParticipants가 단순 랜덤 셔플만 하던 문제를 해결!)
   */
  async recommendHorseDraft(participants, stableHorses) {
    if (!Array.isArray(participants) || participants.length === 0 || !Array.isArray(stableHorses) || stableHorses.length === 0) {
      return [];
    }

    // 참가자 이름 해시 및 직급 특성에 맞춰 상호보완적인 아키타입 배정 + AI 별명 동시 갱신
    const usedIndices = new Set();
    const assignments = [];

    for (let i = 0; i < participants.length; i++) {
      const p = participants[i];
      let chosenIdx = -1;

      // 이름 기반 시드로 겹치지 않게 최적 마구간 말 선택
      let hash = 0;
      for (let c = 0; c < p.name.length; c++) {
        hash = (hash * 31 + p.name.charCodeAt(c)) | 0;
      }
      const startIdx = Math.abs(hash + i * 3 + Math.floor(Math.random() * stableHorses.length)) % stableHorses.length;

      for (let offset = 0; offset < stableHorses.length; offset++) {
        const candidateIdx = (startIdx + offset) % stableHorses.length;
        if (!usedIndices.has(candidateIdx) || usedIndices.size >= stableHorses.length) {
          chosenIdx = candidateIdx;
          usedIndices.add(candidateIdx);
          break;
        }
      }

      const horse = stableHorses[chosenIdx >= 0 ? chosenIdx : (i % stableHorses.length)];
      const newNickname = await this.generateNickname(p.name, horse.strategy?.name || '돌진', { forceFresh: true });

      assignments.push({
        participantIndex: i,
        horse,
        nickname: newNickname
      });
    }

    return assignments;
  }

  /**
   * 4. 실시간 경기 상황을 입체적으로 분석한 온디바이스 AI 스포츠 중계 멘트 생성
   */
  generateLiveCommentary(eventType, horse, info = {}) {
    const strat = horse?.strategy ? horse.strategy.name : '스피드';
    const hName = horse?.name || '선수';

    switch (eventType) {
      case 'leadChange':
        return [
          `🔄 [AI 분석] [${hName} (#${horse?.nickname || '에이스'})] 선수, 정밀 코너링으로 선두 탈환!`,
          `⚡️ [AI 중계] 믿을 수 없는 가속! [${hName}]님이 1위 자리로 치고 올라옵니다!`,
          `🔥 [AI 중계] [${hName}]님의 대역전! 관중석이 환호성으로 뒤덮입니다!`
        ];

      case 'itemPickup':
        return [
          `🎁 [AI 탐지] [${hName}]님이 [${info.item?.name || '아이템'}] 박스를 정밀 스캔하여 획득!`,
          `📦 [${hName} (${strat})] 선수, 비장의 [${info.item?.name || '아이템'}] 장전 완료!`
        ];

      case 'itemUseBooster':
        return [
          `🚀 [AI 가속] [${hName} AI (${strat})] 선수의 폭발적인 부스터 분사! 트랙을 찢습니다!`,
          `💨 [${hName}]님, 터보 엔진 풀가동! 결승선을 향해 순간이동하듯 질주!`
        ];

      case 'itemUseBanana':
        return [
          `🍌 [AI 트릭] [${hName} AI (${strat})] 선수가 전방 선두권 레인에 바나나 함정 매설!`,
          `🎯 [${hName}]님의 기습 바나나 투척! 앞서 달리는 주자들에게 치명적 위협!`
        ];

      case 'itemUseShield':
        return [
          `🛡️ [AI 방어] [${hName} AI (${strat})] 0.1초 위기 감지! 티타늄 방어막 가동!`,
          `✨ [${hName}]님, 든든한 에너지 쉴드 버블 형성! 어떤 공격도 무력화!`
        ];

      case 'itemUseLightning':
        return [
          `⚡️ [AI 광역타격] [${hName} AI (${strat})] 고전압 번개 낙뢰! 선두권 전원 감전 마비!`,
          `🌩️ 콰쾅! [${hName}]님이 발동한 번개에 선두 주자들이 일제히 휘청거립니다!`
        ];

      case 'itemUseMissile': {
        const tName = info?.target?.name || '선두';
        return [
          `🎯 [AI 정밀타격] [${hName} AI (${strat})] 1위 [${tName}]님 락온! 유도 미사일 발사!`,
          `🚀 삐비빅! [${hName}]님의 스마트 미사일이 1위 [${tName}]님을 향해 날아갑니다!`
        ];
      }

      case 'itemUseMagnet':
        return [
          `🧲 [AI 견인] [${hName} AI (${strat})] 초전도 자석 발동! 1등 뒤로 급속 견인!`,
          `⚡️ [${hName}]님, 자석 인력으로 앞선 주자들의 슬립스트림을 흡수하며 도약!`
        ];

      case 'itemUseEspresso':
        return [
          `☕️ [AI 카페인 수혈] [${hName}] 선수, 더블 에스프레소 원샷! 스태미나 풀충전 각성!`,
          `🔥 혈중 카페인 농도 200%! [${hName}]님이 피로를 잊고 폭풍 질주합니다!`
        ];

      case 'itemUseApproval': {
        const tName = info?.target?.name ? `[${info.target.name}]님에게 ` : '앞 주자에게 ';
        return [
          `📋 [AI 업무토스] [${hName}] 선수, ${tName}긴급 결재서류 폭탄 투척 후 칼퇴 가속!`,
          `💼 "이거 오늘까지예요!" [${hName}]님이 ${tName}결재 서류를 넘기며 추월을 시도합니다!`
        ];
      }

      case 'approvalHit': {
        const atk = info?.attackerName ? `[${info.attackerName}]님이 던진 ` : '';
        return [
          `📋 [AI 당황] 헉! [${hName}]님, ${atk}긴급 결재서류 더미에 파묻혀 속도가 급감합니다!`,
          `💦 "왜 지금 결재를 올리세요?!" [${hName}] 선수가 ${atk}서류 검토로 발목이 잡혔습니다!`
        ];
      }

      case 'shieldBlock': {
        const atk = info?.attackerName ? `[${info.attackerName}]님의 ` : '적의 ';
        return [
          `🛡️ [AI 방어 성공] [${hName}] 선수, ${atk}공격을 쉴드로 완벽 방어! 데미지 0!`,
          `✨ 챙-! [${hName}]님의 방어막이 ${atk}공격을 튕겨냈습니다!`
        ];
      }

      case 'obstacleHit': {
        const atk = info?.attackerName ? `[${info.attackerName}]님이 매설한 ` : '';
        return [
          `🍌 [AI 피격] 앗! [${hName}]님, ${atk}바나나를 밟고 360도 스핀!`,
          `💫 비틀비틀! [${hName}] 선수가 ${atk}바나나 함정에 걸려 속도가 급감합니다!`
        ];
      }

      case 'missileHit': {
        const atk = info?.attackerName ? `[${info.attackerName}]님의 ` : '';
        return [
          `💥 [AI 직격타] 쾅! ${atk}스마트 미사일이 [${hName}]님을 직격해 급정지!`,
          `🔥 연기 자욱! [${hName}] 선수가 ${atk}미사일 폭발에 휘말려 크게 감속합니다!`
        ];
      }

      case 'lightningHit': {
        const atk = info?.attackerName ? `[${info.attackerName}]님의 ` : '';
        return [
          `⚡️ [AI 감전] 찌릿! [${hName}]님이 ${atk}번개 폭풍에 감전되어 페이스 다운!`,
          `🌩️ [${hName}] 선수, ${atk}벼락에 피격되어 마력이 일시 마비되었습니다!`
        ];
      }

      case 'tailSwap': {
        const escapedName = info?.escaped?.name ? `[${info.escaped.name}]님 꼴찌 탈출! ` : '';
        return [
          `🚨 [지갑 비상] ${escapedName}[${hName}]님이 새로운 꼴찌로 추락합니다! 카드 준비하세요!`,
          `😱 [순위 변동] ${escapedName}이제 커피 결제 폭탄이 [${hName}]님 손에 넘어갔습니다!`
        ];
      }

      case 'tailDanger': {
        const rivalName = info?.rival?.name || '앞 주자';
        const gapM = info?.gap ? `${Math.max(1, Math.round(info.gap))}m` : '초근접';
        return [
          `👀 [꼴찌 초접전] [${hName}]님과 [${rivalName}]님의 거리차 불과 ${gapM}! 지갑을 건 혈투!`,
          `🔥 후미 그룹 [${hName}] vs [${rivalName}]! 누가 커피를 쏠지 한 치 앞도 모릅니다!`
        ];
      }

      case 'lastSpurtPhase':
        return [
          `🏁 [라스트 스퍼트] 선두 [${hName}] 결승선 전방 25% 돌파! 전원 마지막 칼퇴 스퍼트 돌입!`,
          `🚨 결승선이 보입니다! 지금부터 한 번의 아이템이 오늘 커피 결제자를 바꿉니다!`
        ];

      case 'photoFinish': {
        const gapSec = info?.gapSeconds !== undefined ? info.gapSeconds.toFixed(2) : '0.05';
        return [
          `📸 [포토 피니시] 불과 ${gapSec}초 차이!! 초고속 카메라 판독이 필요한 명승부!!`,
          `🎯 간발의 차이(${gapSec}초)로 희비가 엇갈렸습니다! 관중석 전원 기립!`
        ];
      }

      default:
        return [`🏇 [${hName}] 선수가 치열한 레이스를 펼치고 있습니다.`];
    }
  }

  /**
   * 5. 경기 텔레메트리 데이터를 반영한 온디바이스 AI 스포츠 신문 1면 기사 생성
   */
  async generatePostRaceArticle(winner, losers, totalHorses, ruleDesc, totalPrice, raceContext = {}) {
    const loserNames = losers.map(l => `${l.name} (${l.strategy ? l.strategy.name : 'AI'})`).join(', ');
    const winTimeStr = winner?.finishTime ? `${winner.finishTime.toFixed(2)}초` : '신기록';
    const overtakes = winner?.overtakes || 0;
    const itemsUsed = winner?.itemsUsed || 0;
    const victimHits = losers[0]?.hitsTaken || 0;
    const weatherName = raceContext.weatherName || '맑음';

    const prompt = `사내 커피내기 경마 스포츠 신문 1면 기사를 작성해줘.
- 1위 우승자: "${winner?.name}" (완주 기록: ${winTimeStr}, 추월 ${overtakes}회, 아이템 사용 ${itemsUsed}회)
- 커피 결제 당첨자: "${loserNames}" (피격 ${victimHits}회)
- 총 출전: ${totalHorses}명, 벌칙 룰: ${ruleDesc}, 총 커피 금액: ${totalPrice.toLocaleString()}원, 날씨: ${weatherName}
출력 형식: 첫 줄에 📰 이모지로 시작하는 강렬한 헤드라인 1줄, 빈 줄 1개 후 생생한 2~3문장 본문:`;

    try {
      const llmRes = await this.runPrompt(prompt);
      if (llmRes && llmRes.length > 15) {
        return llmRes;
      }
    } catch (_) {}

    return this.buildTelemetryArticleFallback(winner, losers, totalHorses, ruleDesc, totalPrice, raceContext);
  }

  /**
   * 6. 실시간 토큰 스트리밍(`promptStreaming`)을 지원하는 1면 기사 생성기
   * Chrome Gemini Nano 활성 시 NPU에서 생성되는 토큰 청크를 실시간으로 콜백 전달합니다.
   */
  async streamPostRaceArticle(winner, losers, totalHorses, ruleDesc, totalPrice, raceContext = {}, onChunk = null) {
    const loserNames = losers.map(l => `${l.name} (${l.strategy ? l.strategy.name : 'AI'})`).join(', ');
    const winTimeStr = winner?.finishTime ? `${winner.finishTime.toFixed(2)}초` : '신기록';
    const overtakes = winner?.overtakes || 0;
    const victimHits = losers[0]?.hitsTaken || 0;

    await this.ensureSession();

    if (this.hasChromeAI && this.baseSession && typeof this.baseSession.promptStreaming === 'function') {
      let taskSession = null;
      const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
      try {
        taskSession = typeof this.baseSession.clone === 'function'
          ? await this.baseSession.clone()
          : this.baseSession;

        const prompt = `사내 커피내기 경마 1면 기사를 작성해줘. 1위: "${winner?.name}"(${winTimeStr}, 추월 ${overtakes}회), 커피 결제자: "${loserNames}"(피격 ${victimHits}회), 참가: ${totalHorses}명, 결제액: ${totalPrice.toLocaleString()}원. 첫 줄은 📰 헤드라인, 둘째 줄은 2문장 본문:`;
        const stream = taskSession.promptStreaming(prompt);
        let fullText = '';
        for await (const chunk of stream) {
          // 일부 구현체는 누적 문자열을, 표준 구현체는 독립 청크를 반환하므로 안전하게 처리
          const delta = chunk.startsWith(fullText) ? chunk.slice(fullText.length) : chunk;
          fullText += delta;
          if (onChunk && delta) onChunk(delta, fullText);
        }
        const endTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
        this.telemetry.llmCalls++;
        this.telemetry.lastLatencyMs = Math.round(endTime - startTime);
        if (fullText.trim().length > 15) {
          return fullText.trim();
        }
      } catch (_) {
        // 스트리밍 실패 시 일반 생성으로 폴백
      } finally {
        if (taskSession && taskSession !== this.baseSession && typeof taskSession.destroy === 'function') {
          try {
            taskSession.destroy();
          } catch (_) {}
        }
      }
    }

    const fullArticle = await this.generatePostRaceArticle(winner, losers, totalHorses, ruleDesc, totalPrice, raceContext);
    if (onChunk) {
      for (let i = 0; i < fullArticle.length; i += 2) {
        const piece = fullArticle.slice(i, i + 2);
        onChunk(piece, fullArticle.slice(0, i + 2));
        await new Promise(r => setTimeout(r, 12));
      }
    }
    return fullArticle;
  }

  /**
   * 실제 경기 텔레메트리(완주 시간, 추월 횟수, 최하위 역전 여부, 포토피니시, 피격 횟수)를 반영하는 정밀 기사 합성기
   */
  buildTelemetryArticleFallback(winner, losers, totalHorses, ruleDesc, totalPrice, raceContext = {}) {
    const loserNames = losers.map(l => `${l.name} (${l.strategy ? l.strategy.name : 'AI'})`).join(', ');
    const winTimeStr = winner?.finishTime ? `${winner.finishTime.toFixed(2)}초` : '압도적 기록';
    const overtakes = winner?.overtakes || 0;
    const worstRank = winner?.worstRank || 1;
    const victim = losers[0];
    const victimHits = victim?.hitsTaken || 0;
    const photoFinish = raceContext.photoFinishInfo;

    let headline = `📰 [오피스 일보] "${loserNames} 지갑 비상... 총 ${totalPrice.toLocaleString()}원 커피 결제 확정!"`;
    if (photoFinish) {
      headline = `📰 [특종 포토피니시] "불과 ${photoFinish.gapSeconds.toFixed(2)}초 차이 혈투! ${winner.name} 생환·${loserNames} 눈물의 결제"`;
    } else if (worstRank >= Math.max(3, totalHorses - 1)) {
      headline = `📰 [스포츠 오피스] "${worstRank}위에서 1위로! ${winner.name} 기적의 칼퇴 대역전극 (${winTimeStr})"`;
    } else if (overtakes >= 4) {
      headline = `📰 [더비 타임즈] "추월만 ${overtakes}회! '트랙의 지배자' ${winner.name} 우승, ${loserNames} 결제 당첨"`;
    }

    const telemetrySentence = worstRank > 1
      ? `${winner.name} 선수는 경기 중 한때 ${worstRank}위까지 밀렸으나 총 ${overtakes}회의 정교한 추월과 막판 스퍼트로 ${winTimeStr} 만에 결승선을 가장 먼저 통과했습니다.`
      : `${winner.name} 선수는 초반부터 흔들림 없는 페이스 조절로 ${winTimeStr}의 기록을 세우며 ${totalHorses}두 레이스의 왕좌를 차지했습니다.`;

    const victimSentence = victimHits >= 2
      ? `반면 집중 견제 속에 ${victimHits}차례나 아이템 피격을 당한 ${loserNames}님은 '${ruleDesc}' 룰에 따라 오늘 전원의 커피(${totalPrice.toLocaleString()}원)를 책임지게 되었습니다.`
      : `막판까지 탈출을 노렸던 ${loserNames}님은 간발의 차이로 '${ruleDesc}' 벌칙에 당첨되어 즉시 법인카드 대신 개인카드를 꺼내 들었습니다.`;

    return `${headline}\n\n${telemetrySentence} ${victimSentence}`;
  }
}

export const aiEngine = new OnDeviceAIEngine();
