/**
 * presets.js - 오피스 경마 게임용 기본 프리셋 데이터
 */

export const HORSE_COLORS = [
  { id: 1, name: '루비 레드', body: '#E53E3E', silk: '#FFF5F5', num: '#9B2C2C', border: '#FEB2B2' },
  { id: 2, name: '사파이어 블루', body: '#3182CE', silk: '#EBF8FF', num: '#2B6CB0', border: '#BEE3F8' },
  { id: 3, name: '에메랄드 그린', body: '#38A169', silk: '#F0FFF4', num: '#276749', border: '#C6F6D5' },
  { id: 4, name: '골든 옐로우', body: '#D69E2E', silk: '#FFFFF0', num: '#975A16', border: '#FEFCBF' },
  { id: 5, name: '퍼플 헤이즈', body: '#805AD5', silk: '#FAF5FF', num: '#553C9A', border: '#E9D8FD' },
  { id: 6, name: '핫 핑크', body: '#D53F8C', silk: '#FFF5F7', num: '#97266D', border: '#FED7E2' },
  { id: 7, name: '오렌지 썬더', body: '#DD6B20', silk: '#FFFAF0', num: '#9C4221', border: '#FEEBC8' },
  { id: 8, name: '청록 사이언', body: '#319795', silk: '#E6FFFA', num: '#234E52', border: '#B2F5EA' },
  { id: 9, name: '네이비 블랙', body: '#2D3748', silk: '#EDF2F7', num: '#1A202C', border: '#CBD5E0' },
  { id: 10, name: '라임 스트라이크', body: '#68D391', silk: '#F0FFF4', num: '#22543D', border: '#9AE6B4' },
  { id: 11, name: '브라운 스피릿', body: '#8D5B4C', silk: '#FDF8F6', num: '#5C382A', border: '#E0C7B8' },
  { id: 12, name: '플래티넘 화이트', body: '#4A5568', silk: '#FFFFFF', num: '#1A202C', border: '#E2E8F0' }
];

export const OFFICE_NICKNAMES = [
  '칼퇴요정', '야근의제왕', '카페인중독', '월급루팡', '회의지옥',
  '슬랙봇', '코드의신', '버그제조기', '법카수호자', '단축키장인',
  '판교질주마', '강남급행', '오후의식곤증', '탕비실킬러', '비타민C충전',
  '에스프레소샷', '영양제과다', '모니터3대', '마우스광클', '출근길러너'
];

// 보편적인 레이싱 아이템 정의 (아이템전 모드용)
export const ITEM_TYPES = {
  BOOSTER: {
    id: 'booster',
    name: '부스터',
    icon: '🚀',
    desc: '순간 폭발적인 초고속 가속!',
    duration: 2.2,
    speedMultiplier: 1.55
  },
  BANANA: {
    id: 'banana',
    name: '바나나',
    icon: '🍌',
    desc: '트랙에 바나나를 투척하여 뒤따르는 말을 미끄러뜨림!',
    stunDuration: 1.4
  },
  SHIELD: {
    id: 'shield',
    name: '방어막',
    icon: '🛡️',
    desc: '모든 공격과 방해를 1회 완벽 방어!',
    duration: 6.0
  },
  LIGHTNING: {
    id: 'lightning',
    name: '번개',
    icon: '⚡️',
    desc: '앞서 달리는 모든 선두권 말들을 감전 둔화시킴!',
    stunDuration: 1.6
  },
  MISSILE: {
    id: 'missile',
    name: '유도 미사일',
    icon: '🎯',
    desc: '현재 1등 말을 정밀 추적하여 폭파 일시 정지시킴!',
    stunDuration: 1.8
  },
  MAGNET: {
    id: 'magnet',
    name: '자석',
    icon: '🧲',
    desc: '1등 말의 뒤를 향해 강하게 끌어당겨지며 급가속!',
    duration: 2.5,
    speedMultiplier: 1.45
  }
};

// 온디바이스 AI 성향 & 전략 아키타입 (On-Device AI Strategies)
export const AI_STRATEGIES = [
  {
    id: 'sniper',
    name: '저격수',
    icon: '🎯',
    tag: '결정타 노림수',
    desc: '미사일/번개를 아껴두었다가 선두가 결승선에 다가올 때 결정적 카운터 저격!',
    color: '#E53E3E'
  },
  {
    id: 'speedster',
    name: '돌진형',
    icon: '⚡️',
    tag: '초반 선두 장악',
    desc: '가속/자석 아이템 획득 즉시 폭풍 발동! 초반부터 압도적 거리 차이를 벌림.',
    color: '#D97706'
  },
  {
    id: 'guardian',
    name: '철벽 수호자',
    icon: '🛡️',
    tag: '0.1초 반응 방어',
    desc: '쉴드를 보유하고 있다가 미사일/번개 공격 감지 시 0.1초 만에 자동 전개!',
    color: '#0284C7'
  },
  {
    id: 'trickster',
    name: '트릭스터',
    icon: '🍌',
    tag: '지능형 바나나 함정',
    desc: '후속 추격자가 20m 이내로 바짝 붙었을 때 완벽한 타이밍에 바나나 기습 투척!',
    color: '#CA8A04'
  },
  {
    id: 'wildcard',
    name: '승부사',
    icon: '🎲',
    tag: '꼴찌 반등 폭발',
    desc: '순위가 하위권으로 밀릴수록 아이템 위력 1.3배 폭발! 대역전극을 노리는 이변형 AI.',
    color: '#7C3AED'
  }
];

export const DEFAULT_PRESETS = [];

export const COFFEE_MENUS = [
  { name: '☕️ 갓 내린 아이스 아메리카노', price: '4,500원', note: '가장 무난하고 빠른 선택!' },
  { name: '🥛 고소한 아이스 카페라떼', price: '5,000원', note: '부드러운 우유의 풍미' },
  { name: '🍯 달달한 바닐라빈 라떼', price: '5,800원', note: '오후 당충전 필수템' },
  { name: '🍫 진한 자바칩 프라푸치노', price: '6,500원', note: '결제자의 눈물 한 스푼' },
  { name: '🍋 상큼한 자몽 허니 블랙티', price: '5,700원', note: '카페인 취약자를 위한 음료' },
  { name: '🍵 제주 말차 크림 프라푸치노', price: '6,300원', note: '오늘 지갑 제대로 털리는 날!' }
];

export const COMMENTARY_MESSAGES = {
  start: [
    '출발 게이트가 열렸습니다! 힘찬 출발을 알립니다!',
    '탕! 모든 말들이 일제히 뛰쳐나옵니다!',
    '오늘의 커피값을 건 숙명의 질주가 시작되었습니다!'
  ],
  boost: [
    '⚡️ {name}님, 카페인 도핑 발동! 무서운 속도로 치고 올라옵니다!',
    '🚀 {name}마, "오늘 칼퇴는 내 것!"이라 외치며 부스터 폭발!',
    '🔥 {name}선수, 광기의 스퍼트로 앞선 말들을 추월합니다!'
  ],
  slip: [
    '💦 앗! {name}님, 월요병인가요? 발을 헛디디며 속도가 줄어듭니다!',
    '⚠️ {name}마, 갑작스러운 체력 방전! 뒤로 밀려납니다!',
    '😱 {name}선수, 긴급 슬랙 알림을 확인하다가 페이스를 잃습니다!'
  ],
  battle: [
    '⚔️ 선두권에서 {lead1}님과 {lead2}님의 팽팽한 접전이 이어집니다!',
    '👀 후방 {tail1}님과 {tail2}님의 치열한 꼴찌 탈출 싸움! 지갑이 걸려있습니다!',
    '🔥 중위권 말들이 엎치락뒤치락 한 치 앞을 알 수 없습니다!'
  ],
  lastSpurt: [
    '🏁 결승선까지 남은 거리 200m! 전원 마지막 혼신의 스퍼트!',
    '💥 이제 승부의 순간! 누가 지갑을 지키고 누가 커피를 살 것인가?!',
    '🚨 결승선이 코앞입니다! 숨 막히는 막판 스퍼트!'
  ],
  photoFinish: [
    '📸 초접전! 육안으로 구분이 어렵습니다! 결승선 통과!',
    '🎯 결승선 돌파! 판독에 들어갑니다!'
  ]
};

export const FUNNY_RECEIPT_NOTES = [
  '* 본 영수증은 법적 효력이... 있을지도 모릅니다.',
  '* 법인카드 결제 시 인사팀 경고 주의 (개인카드 권장)',
  '* 샷 추가 및 디저트 주문은 당첨자의 표정을 보고 결정하세요.',
  '* 승패에 승복하고 쿨하게 결제하는 멋진 직장인이 됩시다.',
  '* 다음 판 복수전(Rematch) 신청은 10분 뒤에 가능합니다.'
];
