import { Redis } from "@upstash/redis";
import { DAY1 } from "./story/day1.js";

// Vercel Marketplace의 Upstash를 연결하면 KV_REST_API_* 로, 직접 만들면 UPSTASH_REDIS_REST_* 로 들어옵니다.
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN,
});

const userKey = (id) => `quest:user:${id}`;
const lockKey = (id) => `quest:lock:${id}`;
const usersSetKey = "quest:users"; // 전체 유저 id를 모아두는 Redis Set (관리자 페이지 목록용)

// 스토리 구조가 바뀔 때 올리는 번호.
//   1 = 12단계 시절 (1번 장면이 한 장면짜리였음)
//   2 = 1일차가 7개 장면으로 늘어남 + 호감도(affinity) 추가
export const STORY_VERSION = 2;

export const newUser = () => ({
  storyVersion: STORY_VERSION,
  introSeen: false, // 세계관 인트로를 본 적 있는지
  stage: 0, // 현재 진행할 단계 번호 (STEPS 배열 index)
  status: "ready", // 하위호환용 (이제 수락 단계가 없어 항상 ready)
  nextAt: 0, // 하루가 끝난 뒤 다음 날이 열리는 시각(ms). 0이면 바로 진행 가능
  flags: { approach: null, trust: null, risk: null, self: null, method: null, final: null }, // choice 단계에서 저장되는 분기 값
  clues: [], // 모은 단서/상황 id (quests.js 의 CLUES 참고, m_ 로 시작하는 건 숨은 기억)
  affinity: { haeun: 0, miran: 0, guard: 0, pin: 0 }, // 인물별 호감도
});

// 예전 형식으로 저장된 유저를 지금 형식으로 맞춰준다. (저장은 다음에 진행할 때 자동으로 됨)
function migrate(saved) {
  if (saved.storyVersion === STORY_VERSION) return saved;

  const fresh = newUser();
  const user = { ...fresh, ...saved, affinity: { ...fresh.affinity, ...(saved.affinity ?? {}) } };

  // 1 → 2: 예전 0번 장면이 DAY1(여러 장면)으로 바뀌었으니, 1번 이상 진행한 유저는 그만큼 뒤로 밀어준다.
  if ((saved.storyVersion ?? 1) < 2 && saved.stage >= 1) {
    user.stage = saved.stage + (DAY1.length - 1);
  }
  user.storyVersion = STORY_VERSION;
  return user;
}

export async function getUser(id) {
  const saved = await redis.get(userKey(id));
  return saved ? migrate(saved) : newUser();
}

export async function saveUser(id, user) {
  await redis.set(userKey(id), user);
  await redis.sadd(usersSetKey, id); // 저장될 때마다 유저 목록에도 등록
}

// 버튼 연타로 처리가 중복되는 것을 막는 짧은 잠금 (5초)
export async function acquireLock(id) {
  const result = await redis.set(lockKey(id), "1", { nx: true, ex: 5 });
  return result === "OK";
}

export async function releaseLock(id) {
  await redis.del(lockKey(id));
}

// ── 관리자 페이지용 ──────────────────────────────

// 지금까지 한 번이라도 저장된 적 있는 모든 유저를 가져온다.
export async function listUsers() {
  const ids = await redis.smembers(usersSetKey);
  if (!ids.length) return [];

  const keys = ids.map(userKey);
  const users = await redis.mget(...keys);

  return ids
    .map((id, i) => ({ id, ...(users[i] ? migrate(users[i]) : newUser()) }))
    .sort((a, b) => b.stage - a.stage); // 많이 진행한 유저부터
}

// 관리자가 특정 유저 데이터를 직접 덮어쓸 때 사용.
export async function adminSetUser(id, partial) {
  const user = await getUser(id);
  const merged = { ...user, ...partial };
  await saveUser(id, merged);
  return merged;
}

export async function resetUser(id) {
  const fresh = newUser();
  await saveUser(id, fresh);
  return fresh;
}

// 관리자 페이지에서 (주로 테스트용) 유저를 완전히 지울 때 사용.
export async function deleteUser(id) {
  await redis.del(userKey(id));
  await redis.srem(usersSetKey, id);
}
