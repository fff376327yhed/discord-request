import { Redis } from "@upstash/redis";

// Vercel Marketplace의 Upstash를 연결하면 KV_REST_API_* 로, 직접 만들면 UPSTASH_REDIS_REST_* 로 들어옵니다.
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN,
});

const userKey = (id) => `quest:user:${id}`;
const lockKey = (id) => `quest:lock:${id}`;
const usersSetKey = "quest:users"; // 전체 유저 id를 모아두는 Redis Set (관리자 페이지 목록용)

export const newUser = () => ({
  introSeen: false, // 세계관 인트로를 본 적 있는지
  stage: 0, // 현재 진행할 단계 번호 (STEPS 배열 index)
  status: "ready", // 하위호환용 (이제 수락 단계가 없어 항상 ready)
  nextAt: 0, // 더 이상 쿨다운에 쓰이지 않음 (항상 0, 하위호환용)
  flags: { approach: null, trust: null, risk: null, self: null, method: null, final: null }, // choice 단계에서 저장되는 분기 값
  clues: [], // 모은 단서/상황 id (quests.js 의 CLUES 참고)
});

export async function getUser(id) {
  return (await redis.get(userKey(id))) ?? newUser();
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
    .map((id, i) => ({ id, ...(users[i] ?? newUser()) }))
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
