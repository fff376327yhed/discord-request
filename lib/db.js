import { Redis } from "@upstash/redis";

// Vercel Marketplace의 Upstash를 연결하면 KV_REST_API_* 로, 직접 만들면 UPSTASH_REDIS_REST_* 로 들어옵니다.
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN,
});

const userKey = (id) => `quest:user:${id}`;
const lockKey = (id) => `quest:lock:${id}`;

export const newUser = () => ({
  introSeen: false, // 세계관 인트로를 본 적 있는지
  stage: 0, // 현재 진행할 단계 번호 (STEPS 배열 index)
  status: "ready", // ready(수락 전) | active(진행 중)
  nextAt: 0, // 이 시각(ms) 이전에는 의뢰를 수락할 수 없음
  gold: 0,
  titles: [],
  flags: { trust: null, method: null, final: null }, // choice 단계에서 저장되는 분기 값
});

export async function getUser(id) {
  return (await redis.get(userKey(id))) ?? newUser();
}

export async function saveUser(id, user) {
  await redis.set(userKey(id), user);
}

// 버튼 연타로 보상이 중복 지급되는 것을 막는 짧은 잠금 (5초)
export async function acquireLock(id) {
  const result = await redis.set(lockKey(id), "1", { nx: true, ex: 5 });
  return result === "OK";
}

export async function releaseLock(id) {
  await redis.del(lockKey(id));
}
