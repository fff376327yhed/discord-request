import { verifyKey } from "discord-interactions";
import { STEPS } from "../lib/quests.js";
import { getUser, saveUser, acquireLock, releaseLock } from "../lib/db.js";
import {
  FLAGS,
  introView,
  stepView,
  clearedView,
  choiceResultView,
  profileView,
  messageOnly,
} from "../lib/views.js";

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
          // 최초 1회: 세계관 + 해결사 소개부터 보여준다
          if (!user.introSeen) return reply(introView());
          return reply(stepView(user));
        case "내정보":
          return reply(profileView(user, discordUser.global_name ?? discordUser.username));
        default:
          return reply(messageOnly("알 수 없는 명령어예요."));
      }
    }

    // 4) 버튼 클릭
    if (interaction.type === 3) {
      const [action, stageStr, value] = interaction.data.custom_id.split(":");

      // 연타 방지
      if (!(await acquireLock(userId))) {
        return update(messageOnly("처리 중이에요. 잠시 후 다시 시도해 주세요."));
      }

      try {
        const user = await getUser(userId);

        // 인트로 화면의 "의뢰서 펼치기" 버튼
        if (action === "intro") {
          if (user.introSeen) return update(stepView(user));
          user.introSeen = true;
          await saveUser(userId, user);
          return update(stepView(user));
        }

        const stage = Number(stageStr);

        // 오래된 메시지의 버튼을 눌렀을 때 (이미 진행된 단계)
        if (user.stage !== stage) return update(stepView(user));

        // 의뢰 수락
        if (action === "accept") {
          if (user.status !== "ready") return update(stepView(user));
          user.status = "active";
          await saveUser(userId, user);
          return update(stepView(user));
        }

        // 의뢰 완료 → 보상 지급 → 바로 다음 의뢰 오픈 (쿨다운 없음)
        if (action === "complete") {
          if (user.status !== "active") return update(stepView(user));
          const step = STEPS[user.stage];

          user.gold += step.reward.gold;
          if (step.reward.title && !user.titles.includes(step.reward.title)) {
            user.titles.push(step.reward.title);
          }
          user.stage += 1;
          user.status = "ready";

          await saveUser(userId, user);
          return update(clearedView(step, user));
        }

        // 분기 선택 → flag 저장 → 바로 다음 단계로 (쿨다운 없음)
        if (action === "choose") {
          const step = STEPS[user.stage];
          if (!step || step.type !== "choice") return update(stepView(user));

          const option = step.options.find((o) => o.value === value);
          if (!option) return update(stepView(user));

          user.flags[step.flagKey] = value;
          user.stage += 1;
          user.status = "ready";
          user.nextAt = Date.now();

          await saveUser(userId, user);
          return update(choiceResultView(option));
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
