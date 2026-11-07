// 스토리 파일들이 함께 쓰는 작은 도구 모음.
// (quests.js ↔ story/*.js 가 서로를 불러오는 꼬임을 막으려고 따로 뺐습니다.)

// 여러 줄을 \n 으로 이어 붙인다. 빈 문자열/false 는 자동으로 건너뜀.
export const lines = (...parts) => parts.filter(Boolean).join("\n");

// 단서(clue) 가지고 있는지 / 선택(flag) 값 읽기
export const has = (user, id) => (user.clues ?? []).includes(id);
export const flag = (user, key) => user.flags?.[key] ?? null;

// 호감도 읽기 (없으면 0). 예: aff(u, "haeun") >= 3
export const aff = (user, key) => user.affinity?.[key] ?? 0;

// 문자열 또는 (user) => 문자열 둘 다 받는다
export const text = (value, user) => (typeof value === "function" ? value(user) : value);

// 호감도 더하기. delta 예: { haeun: 2, miran: -1 }  (범위 -3 ~ 10)
export function addAffinity(user, delta) {
  if (!delta) return;
  user.affinity = user.affinity ?? {};
  for (const [who, amount] of Object.entries(delta)) {
    const next = (user.affinity[who] ?? 0) + amount;
    user.affinity[who] = Math.max(-3, Math.min(10, next));
  }
}

// 증거를 한 가지라도 쥐고 있는가 (사진 / 연구원 증언 / 서버 복제)
export const hasEvidence = (user) =>
  has(user, "photo") || has(user, "testimony") || flag(user, "risk") === "S";

// 마지막 선택지 K(모두를 구하는 길)를 열 수 있는 조건
export const canSplitRescue = (u) =>
  flag(u, "trust") === "A" && has(u, "plan") && hasEvidence(u);
