import { QUESTS } from "./quests.js";

// 64 = EPHEMERAL(나에게만 보임), 4096 = SUPPRESS_NOTIFICATIONS(사일런트 메시지)
export const FLAGS = 64 | 4096;

const unix = (ms) => Math.floor(ms / 1000);
const button = (label, custom_id, style = 1) => ({ type: 2, label, custom_id, style });
const row = (...components) => ({ type: 1, components });

const rewardText = (reward) =>
  `💰 ${reward.gold} 골드` + (reward.title ? `\n🏷️ 칭호 [${reward.title}]` : "");

// /의뢰 화면 (상태에 따라 4가지 중 하나)
export function questView(user, now = Date.now()) {
  // 1) 모든 의뢰 완료
  if (user.stage >= QUESTS.length) {
    return {
      embeds: [
        {
          title: "📜 모든 의뢰를 완료했습니다",
          description: "지금 열려 있는 의뢰는 더 없어요. 새 의뢰가 추가되면 다시 찾아와 주세요!",
          color: 0xf1c40f,
        },
      ],
      components: [],
    };
  }

  // 2) 다음 의뢰 대기 중
  if (user.status === "ready" && now < user.nextAt) {
    return {
      embeds: [
        {
          title: "⏳ 다음 의뢰를 준비하고 있어요",
          description: `<t:${unix(user.nextAt)}:R> 열립니다. (<t:${unix(user.nextAt)}:t>)`,
          color: 0x95a5a6,
        },
      ],
      components: [],
    };
  }

  const quest = QUESTS[user.stage];
  const progress = `의뢰 ${user.stage + 1} / ${QUESTS.length}`;

  // 3) 수락 전
  if (user.status === "ready") {
    return {
      embeds: [
        {
          title: quest.title,
          description: quest.description,
          fields: [{ name: "보상", value: rewardText(quest.reward) }],
          footer: { text: progress },
          color: 0x3498db,
        },
      ],
      components: [row(button("의뢰 수락", `accept:${user.stage}`, 1))],
    };
  }

  // 4) 진행 중
  return {
    embeds: [
      {
        title: `${quest.title} (진행 중)`,
        description: quest.description,
        fields: [{ name: "보상", value: rewardText(quest.reward) }],
        footer: { text: progress },
        color: 0xe67e22,
      },
    ],
    components: [row(button("의뢰 완료", `complete:${user.stage}`, 3))],
  };
}

// 완료 직후 화면
export function clearedView(quest, user) {
  const lines = [quest.clearText, "", `**획득 보상**\n${rewardText(quest.reward)}`];
  if (user.stage < QUESTS.length) {
    lines.push("", `다음 의뢰는 <t:${unix(user.nextAt)}:R> 열립니다.`);
  } else {
    lines.push("", "모든 의뢰를 완료했습니다! 🎉");
  }
  return {
    embeds: [{ title: "✅ 의뢰 완료!", description: lines.join("\n"), color: 0x2ecc71 }],
    components: [],
  };
}

// /내정보 화면
export function profileView(user, username) {
  const cleared = Math.min(user.stage, QUESTS.length);
  const statusText =
    user.stage >= QUESTS.length
      ? "모든 의뢰 완료"
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
          { name: "골드", value: `${user.gold}`, inline: true },
          { name: "완료한 의뢰", value: `${cleared} / ${QUESTS.length}`, inline: true },
          { name: "상태", value: statusText },
          { name: "칭호", value: user.titles.length ? user.titles.map((t) => `[${t}]`).join(" ") : "없음" },
        ],
        color: 0x9b59b6,
      },
    ],
    components: [],
  };
}

export const messageOnly = (content) => ({ content, embeds: [], components: [] });
