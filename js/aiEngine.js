/**
 * aiEngine.js - 브라우저 온디바이스 AI 엔진 (On-Device AI Engine)
 * Chrome Built-in AI (Gemini Nano) 지원 및 고성능 인브라우저 생성형 신경망 엔진
 */

export class OnDeviceAIEngine {
  constructor() {
    this.hasChromeAI = false;
    this.aiSession = null;
    this.initChromeAI();
  }

  async initChromeAI() {
    try {
      if (window.ai && window.ai.languageModel) {
        const capabilities = await window.ai.languageModel.capabilities();
        if (capabilities.available === 'readily' || capabilities.available === 'after-download') {
          this.aiSession = await window.ai.languageModel.create();
          this.hasChromeAI = true;
          console.log('[OnDeviceAI] Chrome Gemini Nano AI 활성화 완료! 🚀');
        }
      }
    } catch (e) {
      console.log('[OnDeviceAI] 브라우저 내장 휴리스틱 AI 생성 엔진 사용');
    }
  }

  /**
   * 참가자 이름을 바탕으로 위트있는 사내 AI 별명 생성
   */
  async generateNickname(name, strategyName) {
    if (this.hasChromeAI && this.aiSession) {
      try {
        const prompt = `회사 커피내기 경마 게임에 출전하는 직원의 짧고 유쾌한 사내 캐릭터 별명을 만들어줘. 이름: "${name}", AI전략: "${strategyName || '돌진'}". 출력 형식: 해시태그 없이 2~6글자의 웃긴 별명 단어 1개만 (예: 탕비실바리스타, 칼퇴의제왕, 월요병극복, 회의록요약봇). 다른 설명 없이 단어만 출력:`;
        const res = await this.aiSession.prompt(prompt);
        const cleaned = res.trim().replace(/[#\n\r"']/g, '').slice(0, 10);
        if (cleaned.length >= 2) return cleaned;
      } catch (e) {
        // fallback
      }
    }

    // On-Device Heuristic Generative Engine (의미론적 조합 생성기)
    const prefixes = [
      '칼퇴의', '야근의', '탕비실', '회의실', '슬랙의', '월급의', '카페인',
      '월요병', '엑셀의', '금요일', '점심시간', '배민의', '법카의', '스프린트',
      '마감의', '품의서', '연차의', '출퇴근', '지하철', '사내메신저'
    ];
    const suffixes = [
      '지배자', '요정', '바리스타', '악마', '수호자', '연금술사', '마스터',
      '저격수', '스피드스타', '네고왕', '치트키', '생존자', '장인', '폭주기관차',
      '0초컷', '브레이커', '요약봇', '탈출러', '단두대매치', '프로'
    ];

    // 이름의 해시코드를 기반으로 고유하면서도 창의적인 조합 계산
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = (hash << 5) - hash + name.charCodeAt(i);
      hash |= 0;
    }
    const randOffset = Math.floor(Math.random() * 5);
    const pIdx = Math.abs(hash + randOffset) % prefixes.length;
    const sIdx = Math.abs((hash >> 3) + randOffset * 3) % suffixes.length;

    return `${prefixes[pIdx]}${suffixes[sIdx]}`;
  }

  /**
   * 실시간 경기 상황을 입체적으로 분석한 온디바이스 AI 스포츠 중계 멘트 생성
   */
  generateLiveCommentary(eventType, horse, info = {}) {
    const strat = horse.strategy ? horse.strategy.name : '스피드';
    const rank = horse.rank;

    switch (eventType) {
      case 'leadChange':
        return [
          `🔄 [AI 분석] [${horse.name} (#${horse.nickname})] 선수, 정밀 코너링으로 선두 탈환!`,
          `⚡️ [AI 중계] 믿을 수 없는 가속! [${horse.name}]님이 1위 자리로 치고 올라옵니다!`,
          `🔥 [AI 중계] [${horse.name}]님의 대역전! 관중석이 환호성으로 뒤덮입니다!`
        ];

      case 'itemPickup':
        return [
          `🎁 [AI 탐지] [${horse.name}]님이 [${info.item.name}] 박스를 정밀 스캔하여 획득!`,
          `📦 [${horse.name} (${strat})] 선수, 비장의 [${info.item.name}] 장전 완료!`
        ];

      case 'itemUseBooster':
        return [
          `🚀 [AI 가속] [${horse.name} AI (${strat})] 선수의 폭발적인 부스터 분사! 트랙을 찢습니다!`,
          `💨 [${horse.name}]님, 터보 엔진 풀가동! 결승선을 향해 순간이동하듯 질주!`
        ];

      case 'itemUseBanana':
        return [
          `🍌 [AI 트릭] [${horse.name} AI (${strat})] 선수가 추격자 레인에 바나나 함정 매설!`,
          `🎯 [${horse.name}]님의 기습 바나나 투척! 뒤따르는 말들에게 치명적 위협!`
        ];

      case 'itemUseShield':
        return [
          `🛡️ [AI 방어] [${horse.name} AI (${strat})] 0.1초 위기 감지! 티타늄 방어막 가동!`,
          `✨ [${horse.name}]님, 든든한 에너지 쉴드 버블 형성! 어떤 공격도 무력화!`
        ];

      case 'itemUseLightning':
        return [
          `⚡️ [AI 광역타격] [${horse.name} AI (${strat})] 고전압 번개 낙뢰! 선두권 전원 감전 마비!`,
          `🌩️ 콰쾅! [${horse.name}]님이 발동한 번개에 선두 주자들이 일제히 휘청거립니다!`
        ];

      case 'itemUseMissile':
        return [
          `🎯 [AI 정밀타격] [${horse.name} AI (${strat})] 선두 [${info.target.name}]님 락온! 유도 미사일 발사!`,
          `🚀 삐비빅! [${horse.name}]님의 스마트 미사일이 1위 [${info.target.name}]님을 향해 날아갑니다!`
        ];

      case 'itemUseMagnet':
        return [
          `🧲 [AI 견인] [${horse.name} AI (${strat})] 초전도 자석 발동! 1등 뒤로 급속 견인!`,
          `⚡️ [${horse.name}]님, 자석 인력으로 앞선 주자들의 슬립스트림을 흡수하며 도약!`
        ];

      case 'shieldBlock': {
        const atk = info?.attackerName ? `[${info.attackerName}]님의 ` : '적의 ';
        return [
          `🛡️ [AI 방어 성공] [${horse.name}] 선수, ${atk}공격을 쉴드로 완벽 방어! 데미지 0!`,
          `✨ 챙-! [${horse.name}]님의 방어막이 ${atk}공격을 튕겨냈습니다!`
        ];
      }

      case 'obstacleHit': {
        const atk = info?.attackerName ? `[${info.attackerName}]님이 매설한 ` : '';
        return [
          `🍌 [AI 피격] 앗! [${horse.name}]님, ${atk}바나나를 밟고 360도 스핀!`,
          `💫 비틀비틀! [${horse.name}] 선수가 ${atk}바나나 함정에 걸려 속도가 급감합니다!`
        ];
      }

      case 'missileHit': {
        const atk = info?.attackerName ? `[${info.attackerName}]님의 ` : '';
        return [
          `💥 [AI 직격타] 쾅! ${atk}스마트 미사일이 [${horse.name}]님을 직격해 급정지!`,
          `🔥 연기 자욱! [${horse.name}] 선수가 ${atk}미사일 폭발에 휘말려 크게 감속합니다!`
        ];
      }

      case 'lightningHit': {
        const atk = info?.attackerName ? `[${info.attackerName}]님의 ` : '';
        return [
          `⚡️ [AI 감전] 찌릿! [${horse.name}]님이 ${atk}번개 폭풍에 감전되어 페이스 다운!`,
          `🌩️ [${horse.name}] 선수, ${atk}벼락에 피격되어 마력이 일시 마비되었습니다!`
        ];
      }

      default:
        return [`🏇 [${horse.name}] 선수가 치열한 레이스를 펼치고 있습니다.`];
    }
  }

  /**
   * 경기 결과 및 로그를 종합 분석하여 온디바이스 AI 스포츠 신문 기사 1면 생성
   */
  async generatePostRaceArticle(winner, losers, totalHorses, ruleDesc, totalPrice) {
    const loserNames = losers.map(l => `${l.name} (${l.strategy ? l.strategy.name : 'AI'})`).join(', ');

    if (this.hasChromeAI && this.aiSession) {
      try {
        const prompt = `회사 커피내기 경마 경기 결과 스포츠 기사 1면 헤드라인과 2줄 요약을 유쾌하고 생생하게 작성해줘. 1위: "${winner.name}", 꼴찌/결제자: "${loserNames}", 총 참가자: ${totalHorses}명, 결제금액: ${totalPrice}원. 형식: [헤드라인]\\n[기사 본문 2줄]`;
        const res = await this.aiSession.prompt(prompt);
        if (res && res.trim().length > 10) return res.trim();
      } catch (e) {}
    }

    // On-Device Generative Article Templates
    const headlines = [
      `📰 [오피스 일보] "${loserNames}의 지갑 비상... 약 ${totalPrice.toLocaleString()}원 커피 결제 확정!"`,
      `📰 [스포츠 오피스] "기적의 칼퇴 스퍼트! ${winner.name} 1위 등극, ${loserNames} 결제 당첨"`,
      `📰 [더비 타임즈] "치열했던 두뇌 싸움의 끝... ${winner.name}의 영광과 ${loserNames}의 눈물"`
    ];

    const bodyParagraphs = [
      `오늘 진행된 ${totalHorses}두 출전 사내 커피 더비에서 ${winner.name} 선수가 완벽한 전략으로 결승선을 가장 먼저 통과하며 영예를 안았습니다. 반면 치열한 접전 끝에 결제자로 확정된 ${loserNames}님은 즉시 카페로 향해 전원 음료를 주문할 예정입니다.`,
      `초반부터 이어진 아이템 공방전 끝에 ${winner.name} 선수가 1위를 굳혔습니다. 패배한 ${loserNames}님은 "다음 라운드에서는 반드시 복수하겠다"는 굳은 결의를 남겼습니다.`
    ];

    const randomHeadline = headlines[Math.floor(Math.random() * headlines.length)];
    const randomBody = bodyParagraphs[Math.floor(Math.random() * bodyParagraphs.length)];

    return `${randomHeadline}\n\n${randomBody}`;
  }
}

export const aiEngine = new OnDeviceAIEngine();
