// ─────────────────────────────────────────────────────────────
// 나비재단 사건부 — 규칙(엔진) 파일
//
// 스토리 본문은 lib/story/ 폴더에 있습니다.
//   story/day1.js  1일차 (새로 쓴 일상 장면 7개)
//   story/rest.js  기존 2~12번 장면 (앞으로 2일차, 3일차… 로 풀어서 늘려갈 자리)
//
// 단계 필드
//   type: "quest"  행동 버튼 한 번으로 진행. actionLabel이 버튼 이름.
//   type: "choice" 선택지. flagKey 가 있으면 고른 값이 flags 에 저장된다(분기).
//                  flagKey 가 없으면 "일상 선택" — 호감도/기억 태그만 쌓인다.
//   description / clearText / resultText 는 문자열 또는 (user) => 문자열.
//   gain: 단서 id 배열 또는 (user) => 배열.
//   affinity: { haeun: 1 } 처럼 호감도 변화 (quest 단계, option 모두 가능)
//   option.requires: (user) => boolean — 조건을 만족할 때만 선택지가 나타난다.
//   day / dayTitle / endOfDay / image / clearImage / portrait → story/day1.js 맨 위 설명 참고
//
// 하루 대기(선택): 환경변수 DAY_COOLDOWN_MINUTES 를 0보다 크게 두면,
//   endOfDay 장면을 끝낸 뒤 그 시간만큼 지나야 다음 날이 열립니다. (기본 0 = 꺼짐)
// ─────────────────────────────────────────────────────────────
import { DAY1 } from "./story/day1.js";
import { REST } from "./story/rest.js";
import { has, flag, aff, text, lines, hasEvidence, canSplitRescue, addAffinity } from "./helpers.js";

// endings.js / views.js / admin.js 가 예전처럼 quests.js 에서 가져다 쓸 수 있게 다시 내보낸다.
export { has, flag, aff, text, lines, hasEvidence, canSplitRescue };

export const DAY_COOLDOWN_MS = Number(process.env.DAY_COOLDOWN_MINUTES ?? 0) * 60 * 1000;

// 단서/상황 사전 (/내정보 에 표시됨)
// ※ 여기에 없는 id(예: "m_tea")는 숨은 기억 태그라서 화면에는 안 나온다.
export const CLUES = {
  call: "재단이 하은에게 먼저 걸어온 전화",
  form: "동의서 서식 N-0417 (어디서 본 서식이다)",
  moth: "내 명함을 보고 멈춰 섰던 경비대장",
  door: "서리 낀 철문과 ‘B3 — 냉각 관리’ 표지판",
  backdoor: "직원 통로의 뒷문",
  contact: "조무사 오미란과 튼 안면",
  exposed: "내 얼굴을 기억하는 재단 보안팀",
  photo: "견학 중 몰래 찍은 내부 사진",
  list: "‘고치’ 명단",
  sigstyle: "‘자진 퇴소’ 서명란의 똑같은 필체",
  schedule: "오미란이 알려준 이송 일정",
  reserve: "하은의 재단 상담 예약증",
  letter: "8년 만에 뜯은 ‘나방’의 편지",
  plan: "B3 구조도 (완전본)",
  planHalf: "B3 구조도 (반쪽)",
  testimony: "수석 연구원의 증언",
  ownsign: "증거 1번이 된 내 서명 사본",
};

// 호감도를 쌓는 인물들 (/내정보 에 "마음의 거리"로 표시됨). 숫자는 보여주지 않고 말로만 보여준다.
export const CHARACTERS = {
  haeun: "윤하은",
  miran: "오미란",
  guard: "경비대장",
  pin: "핀",
};

export function affinityLabel(value) {
  if (value >= 6) return "깊이 믿고 있다";
  if (value >= 3) return "마음을 열기 시작했다";
  if (value >= 1) return "조금 경계를 풀었다";
  if (value <= -1) return "틈이 벌어졌다";
  return "아직 서먹하다";
}

// ── 스토리 ──────────────────────────────────────────────────
export const STEPS = [...DAY1, ...REST];

// 선택지의 기본 그림/얼굴은 그 단계의 것을 따른다 (선택지마다 따로 지정하면 그게 우선)
for (const step of STEPS) {
  for (const option of step.options ?? []) {
    option.image ??= step.clearImage;
    option.portrait ??= step.portrait;
  }
}

// 지금 화면에 보여줄 수 있는 선택지만 걸러낸다
export function availableOptions(step, user) {
  return step.options.filter((o) => !o.requires || o.requires(user));
}

function addClues(user, ids) {
  user.clues = user.clues ?? [];
  for (const id of ids ?? []) {
    if (!user.clues.includes(id)) user.clues.push(id);
  }
}

// 한 장면을 끝내고 다음으로 넘길 때 공통 처리
function advance(user, step) {
  user.stage += 1;
  user.status = "ready";
  // 하루의 마지막 장면이고 대기 시간이 켜져 있으면, 다음 날이 열릴 시각을 기록
  user.nextAt = step.endOfDay && DAY_COOLDOWN_MS > 0 ? Date.now() + DAY_COOLDOWN_MS : 0;
}

// 의뢰(quest) 행동 버튼을 눌렀을 때의 상태 변화 — interactions.js / admin.js 공용
export function applyQuestClear(user, step) {
  addClues(user, text(step.gain, user));
  addAffinity(user, step.affinity);
  advance(user, step);
}

// 선택(choice) 버튼을 눌렀을 때의 상태 변화 — interactions.js / admin.js 공용
export function applyChoice(user, step, option) {
  if (step.flagKey) {
    user.flags = user.flags ?? {};
    user.flags[step.flagKey] = option.value;
  }
  addClues(user, text(option.gain, user));
  addAffinity(user, option.affinity);
  advance(user, step);
}
