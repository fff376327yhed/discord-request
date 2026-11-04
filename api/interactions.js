import { verifyKey } from "discord-interactions";
import { QUESTS, COOLDOWN_MS } from "../lib/quests.js";
import { getUser, saveUser, acquireLock, releaseLock } from "../lib/db.js";
import { FLAGS, questView, clearedView, profileView, messageOnly } from "../lib/views.js";

// Discord 응답 타입
const PONG = 1;
const CHANNEL_MESSAGE = 4; // 새 메시지
const UPDATE_MESSAGE = 7; // 버튼이 달린 기존 메시지 수정

const json = (body) =>
  new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });

// 슬래시 명령어 응답: 항상 나에게만 보이는(ephemeral) + 사일런트 메시지
const reply = (data) => json({ type: CHANNEL_MESSAGE, data: { ...data, flags: FLAGS } });
// 버튼 클릭 응답: 기존(ephemeral) 메시지를 그 자리에서 갱신
const update = (data) => json({ type: UPDATE_MESSAGE, data });

export async function POST(request) {
  // 1) Discord 서명 검증 (필수). 원본 body 문자열이 필요하므로 text()로 읽습니다.
  const signature = request.headers.get("x-signature-ed25519");
  const timestamp = request.headers.get("x-signature-timestamp");
  const rawBody = await request.text();

  const isValid =
    signature &&
    timestamp &&
    (await verifyKey(rawBody, signature, timestamp, process.env.DISCORD_PUBLIC_KEY));
  if (!isValid) return new Response("invalid request signature", { status: 401 });

  const interaction = JSON.parse(rawBody);

  // 2) Discord가 엔드포인트 확인용으로 보내는 PING
  if (interaction.type === 1) return json({ type: PONG });

  const discordUser = interaction.member?.user ?? interaction.user;
  const userId = discordUser.id;

  try {
    // 3) 슬래시 명령어
    if (interaction.type === 2) {
      const user = await getUser(userId);
      switch (interaction.data.name) {
        case "의뢰":
          return reply(questView(user));
        case "내정보":
          return reply(profileView(user, discordUser.global_name ?? discordUser.username));
        default:
          return reply(messageOnly("알 수 없는 명령어예요."));
      }
    }

    // 4) 버튼 클릭
    if (interaction.type === 3) {
      const [action, stageStr] = interaction.data.custom_id.split(":");
      const stage = Number(stageStr);

      // 연타 방지
      if (!(await acquireLock(userId))) {
        return update(messageOnly("처리 중이에요. 잠시 후 다시 시도해 주세요."));
      }

      try {
        const user = await getUser(userId);

        // 오래된 메시지의 버튼을 눌렀을 때 (이미 진행된 의뢰)
        if (user.stage !== stage) return update(questView(user));

        // 의뢰 수락
        if (action === "accept") {
          if (user.status !== "ready" || Date.now() < user.nextAt) return update(questView(user));
          user.status = "active";
          await saveUser(userId, user);
          return update(questView(user));
        }

        // 의뢰 완료 → 보상 지급 → 10분 대기 시작
        if (action === "complete") {
          if (user.status !== "active") return update(questView(user));
          const quest = QUESTS[user.stage];

          user.gold += quest.reward.gold;
          if (quest.reward.title && !user.titles.includes(quest.reward.title)) {
            user.titles.push(quest.reward.title);
          }
          user.stage += 1;
          user.status = "ready";
          user.nextAt = Date.now() + COOLDOWN_MS;

          await saveUser(userId, user);
          return update(clearedView(quest, user));
        }
      } finally {
        await releaseLock(userId);
      }
    }

    return reply(messageOnly("처리할 수 없는 요청이에요."));
  } catch (err) {
    console.error(err);
    return reply(messageOnly("오류가 발생했어요. 잠시 후 다시 시도해 주세요."));
  }
}
