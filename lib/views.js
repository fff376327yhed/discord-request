import { STEPS } from "./quests.js";
import { resolveEnding } from "./endings.js";

// 64 = EPHEMERAL(나에게만 보임), 4096 = SUPPRESS_NOTIFICATIONS(사일런트 메시지)
export const FLAGS = 64 | 4096;

const unix = (ms) => Math.floor(ms / 1000);
const button = (label, custom_id, style = 1) => ({ type: 2, label, custom_id, style });
const row = (...components) => ({ type: 1, components });

// 세계관 + 해결사(나)에 대한 소개. 최초 1회만 노출.
export function introView() {
  return {
    embeds: [
      {
        title: "🦋 나비재단 사건부",
        description:
          "도시 외곽, '완전한 재활·재탄생'을 내세우는 복합단지 — 나비재단.\n" +
          "표면적으론 화상·장애 재활 전문기관이지만, 당신이 몸담은 의뢰소엔 이상한 실종 신고가 하나 접수됐다.\n\n" +
          "**당신은 누구인가**\n" +
          "이름도, 지나온 사연도 알려진 바 없는 이 거리의 해결사. 다만 한 가지는 분명하다 —\n" +
          "한 번 맡은 의뢰는, 그게 아무리 깊은 곳까지 이어지더라도 끝까지 쫓는다는 것.\n\n" +
          "이제, 첫 번째 의뢰서가 당신 앞에 놓여 있다.",
        color: 0x2c3e50,
      },
    ],
    components: [row(button("의뢰서 펼치기", "intro:start", 1))],
  };
}

// /의뢰 화면 — stage에 따라 quest / choice / ending으로 분기
export function stepView(user) {
  if (user.stage >= STEPS.length) {
    return endingView(resolveEnding(user.flags));
  }

  const step = STEPS[user.stage];

  if (step.type === "choice") {
    return choiceView(step, user);
  }

  const progress = `진행 ${user.stage + 1} / ${STEPS.length}`;

  // 수락 전
  if (user.status === "ready") {
    return {
      embeds: [
        {
          title: step.title,
          description: step.description,
          footer: { text: progress },
          color: 0x3498db,
        },
      ],
      components: [row(button("의뢰 수락", `accept:${user.stage}`, 1))],
    };
  }

  // 진행 중
  return {
    embeds: [
      {
        title: `${step.title} (진행 중)`,
        description: step.description,
        footer: { text: progress },
        color: 0xe67e22,
      },
    ],
    components: [row(button("의뢰 완료", `complete:${user.stage}`, 3))],
  };
}

function choiceView(step, user) {
  return {
    embeds: [
      {
        title: step.title,
        description: step.description,
        footer: { text: `진행 ${user.stage + 1} / ${STEPS.length}` },
        color: 0x3498db,
      },
    ],
    components: [
      row(
        ...step.options.map((opt, i) =>
          button(opt.label, `choose:${user.stage}:${opt.value}`, (i % 4) + 1)
        )
      ),
    ],
  };
}

// 완료 직후 화면 (quest 타입)
export function clearedView(step, user) {
  const lines = [step.clearText];
  if (user.stage < STEPS.length) {
    lines.push("", "다음 의뢰가 바로 열렸어요! 이어서 /의뢰 를 눌러주세요.");
  }
  return {
    embeds: [{ title: "✅ 의뢰 완료!", description: lines.join("\n"), color: 0x2ecc71 }],
    components: [],
  };
}

// 선택 직후 화면 (choice 타입)
export function choiceResultView(option) {
  return {
    embeds: [
      {
        title: `📌 선택: ${option.label}`,
        description: option.resultText,
        color: 0x7f8c8d,
      },
    ],
    components: [],
  };
}

// 엔딩 화면
function endingView(ending) {
  return {
    embeds: [{ title: ending.title, description: ending.description, color: ending.color }],
    components: [],
  };
}

// /내정보 화면
export function profileView(user, username) {
  const cleared = Math.min(user.stage, STEPS.length);
  const statusText =
    user.stage >= STEPS.length
      ? "사건 종결"
      : user.status === "active"
        ? "의뢰 진행 중"
        : Date.now() < user.nextAt
          ? `다음 의뢰 <t:${unix(user.nextAt)}:R>`
          : "의뢰 수락 가능";

  return {
    embeds: [
      {
        title: `🪪 ${username}의 정보`,
        fields: [
          { name: "진행 단계", value: `${cleared} / ${STEPS.length}`, inline: true },
          { name: "상태", value: statusText },
        ],
        color: 0x9b59b6,
      },
    ],
    components: [],
  };
}

export const messageOnly = (content) => ({ content, embeds: [], components: [] });
