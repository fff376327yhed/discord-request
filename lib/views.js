import { STEPS, CLUES, text, availableOptions } from "./quests.js";
import { resolveEnding, buildEpilogue } from "./endings.js";

// 64 = EPHEMERAL(나에게만 보임), 4096 = SUPPRESS_NOTIFICATIONS(사일런트 메시지)
export const FLAGS = 64 | 4096;

const button = (label, custom_id, style = 1) => ({ type: 2, label, custom_id, style });
const row = (...components) => ({ type: 1, components });

// 결과 화면 아래에 붙는 "다음 장면으로" 버튼. 마지막 단계 뒤에는 엔딩 확인 버튼이 된다.
const nextButton = (user) =>
  row(
    button(
      user.stage >= STEPS.length ? "사건의 결말을 확인한다" : "다음 의뢰서를 펼친다",
      `next:${user.stage}`,
      1
    )
  );

// 세계관 + 해결사(나)에 대한 소개. 최초 1회만 노출.
// ※ 장부 첫 장의 서명, 서랍 속 봉투는 뒤에서 회수되는 복선이다. 문구를 바꿀 때 7번·5번 장면과 맞춰 주세요.
export function introView() {
  return {
    embeds: [
      {
        title: "🦋 나비재단 사건부",
        description:
          "도시 외곽, ‘완전한 재활·재탄생’을 내세우는 복합단지 — 나비재단.\n" +
          "표면적으론 화상·장애 재활 전문기관이다.\n\n" +
          "**당신은 누구인가**\n" +
          "이 거리 변두리에서 의뢰소를 하는 해결사. 간판엔 이름도, 지나온 사연도 적혀 있지 않다.\n" +
          "다만 책상 위 접수 장부의 첫 장엔 8년 전 당신이 직접 쓴 서명이 끼워져 있고, 서랍 맨 아래엔 같은 해에 도착한 뜯지 않은 봉투가 하나 있다. 당신은 둘 다 들여다본 적이 없다.\n\n" +
          "한 번 맡은 의뢰는, 그게 아무리 깊은 곳까지 이어지더라도 끝까지 쫓는다.\n" +
          "오늘 아침, 첫 의뢰인이 문을 두드렸다.",
        color: 0x2c3e50,
      },
    ],
    components: [row(button("의뢰서 펼치기", "intro:start", 1))],
  };
}

// /의뢰 화면 — stage에 따라 quest / choice / ending으로 분기
export function stepView(user) {
  if (user.stage >= STEPS.length) {
    return endingView(user);
  }

  const step = STEPS[user.stage];

  if (step.type === "choice") {
    return choiceView(step, user);
  }

  // 수락/완료 구분 없이, 해결사의 행동 버튼 하나로 진행
  return {
    embeds: [
      {
        title: step.title,
        description: text(step.description, user),
        footer: { text: `진행 ${user.stage + 1} / ${STEPS.length}` },
        color: 0x3498db,
      },
    ],
    components: [row(button(step.actionLabel ?? "조사를 시작한다", `complete:${user.stage}`, 2))],
  };
}

function choiceView(step, user) {
  return {
    embeds: [
      {
        title: step.title,
        description: text(step.description, user),
        footer: { text: `진행 ${user.stage + 1} / ${STEPS.length}` },
        color: 0x3498db,
      },
    ],
    components: [
      row(
        ...availableOptions(step, user).map((opt, i) =>
          button(opt.label, `choose:${user.stage}:${opt.value}`, (i % 4) + 1)
        )
      ),
    ],
  };
}

// 행동 직후 결과 화면 (quest 타입)
export function clearedView(step, user) {
  return {
    embeds: [
      {
        title: `📖 ${step.title.replace(/^.*?: /, "")}`,
        description: text(step.clearText, user),
        footer: { text: `${Math.min(user.stage, STEPS.length)} / ${STEPS.length} 의뢰 종결` },
        color: 0x34495e,
      },
    ],
    components: [nextButton(user)],
  };
}

// 선택 직후 화면 (choice 타입)
export function choiceResultView(option, user) {
  return {
    embeds: [
      {
        title: `📌 선택: ${option.label}`,
        description: text(option.resultText, user),
        color: 0x7f8c8d,
      },
    ],
    components: [nextButton(user)],
  };
}

// 엔딩 화면 — 엔딩 본문 + 내가 걸어온 길(후일담)
function endingView(user) {
  const ending = resolveEnding(user);
  const epilogue = buildEpilogue(user);
  const description = epilogue.length
    ? `${ending.description}\n\n**당신이 걸어온 길**\n${epilogue.map((l) => `· ${l}`).join("\n")}`
    : ending.description;
  return {
    embeds: [{ title: ending.title, description, color: ending.color }],
    components: [],
  };
}

// /내정보 화면
export function profileView(user, username) {
  const cleared = Math.min(user.stage, STEPS.length);
  const statusText = user.stage >= STEPS.length ? "사건 종결" : "조사 중";
  const clues = (user.clues ?? []).map((id) => CLUES[id]).filter(Boolean);

  return {
    embeds: [
      {
        title: `🪪 ${username}의 정보`,
        fields: [
          { name: "진행 단계", value: `${cleared} / ${STEPS.length}`, inline: true },
          { name: "상태", value: statusText, inline: true },
          {
            name: "단서와 상황",
            value: clues.length ? clues.map((c) => `· ${c}`).join("\n") : "아직 없음",
          },
        ],
        color: 0x9b59b6,
      },
    ],
    components: [],
  };
}

export const messageOnly = (content) => ({ content, embeds: [], components: [] });
