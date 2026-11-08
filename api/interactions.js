import { verifyKey } from "discord-interactions";
import { waitUntil } from "@vercel/functions"; // Next.js 없이도 쓸 수 있는, 응답을 보낸 "뒤에" 코드를 계속 실행하는 Vercel API
import {
  STEPS,
  applyQuestClear,
  applyChoice,
  availableOptions,
  matchFreeText,
  FREE_TEXT_MAX_LEN,
  getUser,
  saveUser,
  acquireLock,
  releaseLock,
  FLAGS,
  introView,
  stepView,
  clearedView,
  choiceResultView,
  profileView,
  messageOnly,
  pageView,
  restartUser,
} from "../lib/game.js";

// Discord 응답 타입
const PONG = 1;
const CHANNEL_MESSAGE = 4; // 새 메시지 (바로 응답할 때만 사용)
const DEFERRED_CHANNEL_MESSAGE = 5; // 슬래시 명령어용 "생각 중..." — 뒤에서 메시지를 채워 넣는다
const UPDATE_MESSAGE = 7; // 버튼이 달린 기존 메시지 수정 (바로 응답할 때만 사용 — 지금은 "free" 외엔 안 씀)
const DEFERRED_UPDATE = 6; // 버튼/모달용 "처리 중..." — 뒤에서 메시지를 채워 넣는다
const MODAL = 9; // 입력창(모달)을 띄움. 디스코드 제약상 지연 응답으로는 띄울 수 없어 반드시 즉시 응답해야 한다.

const json = (body) =>
  new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });

// 슬래시 명령어 응답(즉시): 항상 나에게만 보이는(ephemeral) + 사일런트 메시지
const reply = (data) => json({ type: CHANNEL_MESSAGE, data: { ...data, flags: FLAGS } });
// 버튼 클릭 응답(즉시, "free" 전용): 기존(ephemeral) 메시지를 그 자리에서 갱신
const update = (data) => json({ type: UPDATE_MESSAGE, data });
// 버튼 클릭에 대한 응답으로 입력창(모달)을 띄운다
const modal = (data) => json({ type: MODAL, data });
const row = (...components) => ({ type: 1, components });

// ── 지연 응답(defer) 뒤의 실제 작업 ──────────────────────────────
// 콜드 스타트나 Redis 왕복이 느려서 3초를 넘길 수 있는 모든 처리는
// 먼저 DEFERRED_* 로 즉시 ack한 다음, waitUntil()로 연장된 시간 안에서 이 함수로 실제 내용을 채운다.
// workFn이 null/undefined를 반환하면(= 연타로 잠금 실패 등) 화면을 그대로 둔다.
async function runDeferred(token, workFn) {
  try {
    const payload = await workFn();
    if (payload) await editOriginal(token, payload);
  } catch (err) {
    console.error(err);
    // DB(Upstash) 쪽 문제인지 게임 로직 문제인지 구분해서 다른 안내를 준다.
    const message = err?.isRedisError
      ? "저장소 연결이 불안정해요. 잠시 후 다시 시도해 주세요. (방금 누른 버튼은 반영되지 않았을 수 있어요)"
      : "오류가 발생했어요. 잠시 후 다시 시도해 주세요.";
    await editOriginal(token, messageOnly(message)).catch(() => {});
  }
}

// 지연 응답으로 만들어진 "원본 메시지"를 실제 내용으로 덮어쓴다.
// DISCORD_APP_ID 환경변수가 필요하다 (register.js 에서 쓰는 것과 동일).
async function editOriginal(token, payload) {
  const res = await fetch(
    `https://discord.com/api/v10/webhooks/${process.env.DISCORD_APP_ID}/${token}/messages/@original`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
  if (!res.ok) {
    console.error("[discord:editOriginal] 실패", res.status, await res.text().catch(() => ""));
  }
}

export async function POST(request) {
  // 1) Discord 서명 검증 (필수). 원본 body 문자열이 필요하므로 text()로 읽습니다.
  const signature = request.headers.get("x-signature-ed25519");
  const timestamp = request.headers.get("x-signature-timestamp");
  const rawBody = await request.text();

  // 5분 넘게 지난(또는 미래의) 요청은 가로챈 요청을 다시 보낸 것일 수 있어 거절한다.
  const ageSec = Math.abs(Date.now() / 1000 - Number(timestamp));
  const isValid =
    signature &&
    timestamp &&
    ageSec <= 300 &&
    (await verifyKey(rawBody, signature, timestamp, process.env.DISCORD_PUBLIC_KEY));
  if (!isValid) return new Response("invalid request signature", { status: 401 });

  const interaction = JSON.parse(rawBody);

  // 2) Discord가 엔드포인트 확인용으로 보내는 PING
  if (interaction.type === 1) return json({ type: PONG });

  const discordUser = interaction.member?.user ?? interaction.user;
  const userId = discordUser.id;
  const discordName = discordUser.global_name ?? discordUser.username;

  try {
    // 3) 슬래시 명령어 — 일단 "생각 중"만 즉시 ack하고, 실제 내용은 뒤에서 채운다.
    if (interaction.type === 2) {
      waitUntil(
        runDeferred(interaction.token, async () => {
          const user = await getUser(userId);
          switch (interaction.data.name) {
            case "의뢰":
              // 최초 1회: 세계관 + 해결사 소개부터 보여준다
              return !user.introSeen ? introView() : stepView(user);
            case "내정보":
              return profileView(user, discordName);
            default:
              return messageOnly("알 수 없는 명령어예요.");
          }
        })
      );
      return json({ type: DEFERRED_CHANNEL_MESSAGE, data: { flags: FLAGS } });
    }

    // 4) 버튼 클릭
    if (interaction.type === 3) {
      const [action, stageStr, value] = interaction.data.custom_id.split(":");

      // "✍️ 직접 입력" 버튼: 모달을 띄워야 해서 디스코드 제약상 지연 응답을 쓸 수 없다 — 반드시 그 자리에서 바로 응답.
      if (action === "free") {
        const user = await getUser(userId);
        const stage = Number(stageStr);
        if (user.stage !== stage) return update(stepView(user));

        const step = STEPS[stage];
        if (!step || step.type !== "choice" || !step.freeText) return update(stepView(user));

        return modal({
          title: step.title.replace(/^.*?: /, "").slice(0, 45),
          custom_id: `freeform:${stage}`,
          components: [
            row({
              type: 4, // TEXT_INPUT
              custom_id: "text",
              style: 2, // PARAGRAPH
              label: (step.freeText.prompt ?? "직접 답해보세요").slice(0, 45),
              placeholder: step.freeText.placeholder?.slice(0, 100),
              min_length: 1,
              max_length: FREE_TEXT_MAX_LEN,
              required: true,
            }),
          ],
        });
      }

      // 그 외 모든 버튼(pg 포함): 콜드 스타트·Redis 지연으로 3초를 넘길 수 있으니
      // 먼저 "처리 중"만 즉시 ack하고, 실제 화면은 뒤에서 채운다.
      waitUntil(
        runDeferred(interaction.token, async () => {
          // 긴 글의 "다음 ▶ / ◀ 이전 쪽" 버튼: 진행 상태를 바꾸지 않으니 잠금 없이 화면만 다시 그린다.
          if (action === "pg") {
            const user = await getUser(userId);
            if (user.stage !== Number(stageStr)) return stepView(user);
            return pageView(user, value);
          }

          // 연타 방지. 실패하면 화면을 그대로 둔다(= null 반환, editOriginal 호출 안 함).
          if (!(await acquireLock(userId))) return null;

          try {
            const user = await getUser(userId);

            // 인트로 화면의 "의뢰서 펼치기" 버튼
            if (action === "intro") {
              if (user.introSeen) return stepView(user);
              user.introSeen = true;
              user.discordName = discordName;
              await saveUser(userId, user);
              return stepView(user);
            }

            const stage = Number(stageStr);

            // 오래된 메시지의 버튼을 눌렀을 때 (이미 진행된 단계)
            if (user.stage !== stage) return stepView(user);

            // 엔딩 화면의 "처음부터 다시 시작한다" (결말에 닿은 유저만)
            if (action === "restart") {
              if (!user.dead && user.stage < STEPS.length) return stepView(user);
              const fresh = restartUser(user);
              fresh.discordName = discordName;
              await saveUser(userId, fresh);
              return stepView(fresh);
            }

            // 다음 장면으로 (결과 화면의 "다음 의뢰서를 펼친다" 버튼)
            if (action === "next") return stepView(user);

            // 행동 버튼 → 단서 획득 + 결과 서술 화면 (쿨다운 없음, 보상 없음)
            if (action === "complete") {
              const step = STEPS[user.stage];
              if (!step || step.type !== "quest") return stepView(user);

              applyQuestClear(user, step);

              user.discordName = discordName;
              await saveUser(userId, user);
              return clearedView(step, user);
            }

            // 분기 선택 → flag/단서 저장 → 결과 서술 화면 (쿨다운 없음)
            // 조건(requires)을 만족하지 못한 선택지는 availableOptions 에서 걸러진다.
            if (action === "choose") {
              const step = STEPS[user.stage];
              if (!step || step.type !== "choice") return stepView(user);

              const option = availableOptions(step, user).find((o) => o.value === value);
              if (!option) return stepView(user);

              applyChoice(user, step, option);

              user.discordName = discordName;
              await saveUser(userId, user);
              return choiceResultView(option, user);
            }

            return null;
          } finally {
            await releaseLock(userId);
          }
        })
      );
      return json({ type: DEFERRED_UPDATE });
    }

    // 5) 모달("✍️ 직접 입력") 제출 — 버튼과 동일하게 지연 응답으로 처리.
    if (interaction.type === 5) {
      const [kind, stageStr] = interaction.data.custom_id.split(":");
      if (kind !== "freeform") return reply(messageOnly("처리할 수 없는 요청이에요."));

      waitUntil(
        runDeferred(interaction.token, async () => {
          // 연타 방지 (버튼 클릭과 동일한 잠금을 공유)
          if (!(await acquireLock(userId))) return null;

          try {
            const user = await getUser(userId);
            const stage = Number(stageStr);

            // 오래된 모달 제출 (그 사이 다른 버튼으로 이미 진행된 경우)
            if (user.stage !== stage) return stepView(user);

            const step = STEPS[stage];
            if (!step || step.type !== "choice" || !step.freeText) return stepView(user);

            const rawText = (interaction.data.components[0]?.components[0]?.value ?? "")
              .trim()
              .slice(0, FREE_TEXT_MAX_LEN);
            if (!rawText) return stepView(user);

            const option = matchFreeText(step, rawText);
            if (!option) return stepView(user);

            // 결과 화면에서 입력한 글을 인용해 보여줄 수 있도록 stage/text 를 함께 기록해 둔다.
            user.freeTextEcho = { stage: user.stage, text: rawText };

            applyChoice(user, step, option);

            user.discordName = discordName;
            await saveUser(userId, user);
            return choiceResultView(option, user);
          } finally {
            await releaseLock(userId);
          }
        })
      );
      return json({ type: DEFERRED_UPDATE });
    }

    return reply(messageOnly("처리할 수 없는 요청이에요."));
  } catch (err) {
    console.error(err);
    // 여기 걸리는 건 ack를 보내기도 전(지연 응답 세팅 중)에 터진 동기 에러들 뿐 —
    // 예: "free" 모달 조립 중 에러. 지연 응답 이후의 에러는 runDeferred 안에서 처리된다.
    const message = err?.isRedisError
      ? "저장소 연결이 불안정해요. 잠시 후 다시 `/의뢰` 를 눌러주세요."
      : "오류가 발생했어요. 잠시 후 다시 시도해 주세요.";
    return reply(messageOnly(message));
  }
}