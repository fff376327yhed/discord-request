import { STEPS, CLUES, CHARACTERS, text, aff, affinityLabel, availableOptions } from "./quests.js";
import { resolveEnding, buildEpilogue } from "./endings.js";
import { imageUrl } from "./images.js";

// 64 = EPHEMERAL(나에게만 보임), 4096 = SUPPRESS_NOTIFICATIONS(사일런트 메시지)
export const FLAGS = 64 | 4096;

const button = (label, custom_id, style = 1) => ({ type: 2, label, custom_id, style });
const row = (...components) => ({ type: 1, components });

// ── 쪽 나누기 ────────────────────────────────────────────────
// 한 화면에 들어가는 글자 수. 더 짧게/길게 하고 싶으면 환경변수 PAGE_MAX_CHARS 로 바꾸세요.
const PAGE_MAX = Number(process.env.PAGE_MAX_CHARS ?? 220);

// 긴 글을 줄 단위로 모아서 쪽으로 나눈다. (줄 중간에서는 자르지 않고, 너무 긴 줄만 문장 단위로 자름)
export function splitPages(str, max = PAGE_MAX) {
  const units = [];
  for (const line of String(str ?? "").split("\n")) {
    if (line.length <= max) {
      units.push(line);
      continue;
    }
    let cur = "";
    for (const sentence of line.split(/(?<=[.!?”」])\s+/)) {
      if (cur && (cur + " " + sentence).length > max) {
        units.push(cur);
        cur = sentence;
      } else {
        cur = cur ? `${cur} ${sentence}` : sentence;
      }
    }
    if (cur) units.push(cur);
  }

  const pages = [];
  let cur = "";
  for (const unit of units) {
    const joined = cur ? `${cur}\n${unit}` : unit;
    if (cur && joined.length > max) {
      pages.push(cur);
      cur = unit;
    } else {
      cur = joined;
    }
  }
  if (cur) pages.push(cur);

  const cleaned = pages.map((p) => p.trim()).filter(Boolean);
  // 마지막 쪽이 한두 줄로 너무 짧으면 앞쪽에 붙인다
  if (cleaned.length > 1 && cleaned.at(-1).length < 50) {
    const last = cleaned.pop();
    if (`${cleaned.at(-1)}\n${last}`.length <= max * 1.25) cleaned[cleaned.length - 1] += `\n${last}`;
    else cleaned.push(last);
  }
  return cleaned.length ? cleaned : [""];
}

// embed 에 "일차 제목 / 큰 그림 / 인물 얼굴"을 붙여준다. 이미지 id 가 없거나 주소를 못 만들면 그냥 건너뜀.
function decorate(embed, { image, portrait, dayTitle } = {}) {
  const big = imageUrl(image);
  if (big) embed.image = { url: big };
  const face = imageUrl(portrait ? `portrait-${portrait}` : null);
  if (face) embed.thumbnail = { url: face };
  if (dayTitle) embed.author = { name: dayTitle };
  return embed;
}

// 글 하나를 쪽으로 나눠서 보여주는 공통 틀.
//   kind  : 어떤 화면인지 (s 장면 / c 행동결과 / o-<선택값> 선택결과 / i 인트로 / e 엔딩)
//   stage : 쪽 버튼을 누를 때 "그 사이에 진행이 바뀌지 않았는지" 확인하는 용도
//   마지막 쪽에서만 진짜 버튼(finalComponents)이 나온다.
function paged({ embed, decor, body, page, full, kind, stage, finalComponents }) {
  const pages = full ? [body] : splitPages(body);
  const i = Math.max(0, Math.min(page, pages.length - 1));
  const out = decorate({ ...embed, description: pages[i] }, decor);

  if (pages.length > 1) {
    const base = embed.footer?.text ? `${embed.footer.text} · ` : "";
    out.footer = { text: `${base}${i + 1}/${pages.length}쪽` };
  }

  const isLast = i === pages.length - 1;
  const prev = i > 0 ? button("◀ 이전 쪽", `pg:${stage}:${kind}.${i - 1}`, 2) : null;

  if (!isLast) {
    const buttons = [prev, button("다음 ▶", `pg:${stage}:${kind}.${i + 1}`, 1)].filter(Boolean);
    return { embeds: [out], components: [row(...buttons)] };
  }
  const components = [...finalComponents];
  if (prev) components.push(row(prev));
  return { embeds: [out], components };
}

// 장면 아래쪽 글씨: 일차가 있으면 "1일차 · 진행 3 / 18"
function footerOf(step, user) {
  const progress = `진행 ${user.stage + 1} / ${STEPS.length}`;
  return { text: step.day ? `${step.day}일차 · ${progress}` : progress };
}

// 결과 화면 아래에 붙는 "다음 장면으로" 버튼. 마지막 단계 뒤에는 엔딩 확인 버튼이 된다.
const nextButton = (user) => {
  const prev = STEPS[user.stage - 1];
  const label =
    user.stage >= STEPS.length
      ? "사건의 결말을 확인한다"
      : prev?.endOfDay
        ? "하루를 마무리한다"
        : "다음 장면으로";
  return row(button(label, `next:${user.stage}`, 1));
};

// 세계관 + 해결사(나)에 대한 소개. 최초 1회만 노출.
// ※ 장부 첫 장의 서명, 서랍 속 봉투는 뒤에서 회수되는 복선이다. 문구를 바꿀 때 7번·5번 장면과 맞춰 주세요.
export function introView(page = 0, full = false) {
  return paged({
    embed: { title: "🦋 나비재단 사건부", color: 0x2c3e50 },
    decor: { image: "intro" },
    body:
      "도시 외곽, ‘완전한 재활·재탄생’을 내세우는 복합단지 — 나비재단.\n" +
      "표면적으론 화상·장애 재활 전문기관이다.\n\n" +
      "**당신은 누구인가**\n" +
      "이 거리 변두리에서 의뢰소를 하는 해결사. 간판엔 이름도, 지나온 사연도 적혀 있지 않다.\n" +
      "다만 책상 위 접수 장부의 첫 장엔 8년 전 당신이 직접 쓴 서명이 끼워져 있고, 서랍 맨 아래엔 같은 해에 도착한 뜯지 않은 봉투가 하나 있다. 당신은 둘 다 들여다본 적이 없다.\n\n" +
      "한 번 맡은 의뢰는, 그게 아무리 깊은 곳까지 이어지더라도 끝까지 쫓는다.\n" +
      "오늘 아침, 첫 의뢰인이 문을 두드렸다.",
    page,
    full,
    kind: "i",
    stage: 0,
    finalComponents: [row(button("의뢰서 펼치기", "intro:start", 1))],
  });
}

// 하루가 끝나고 다음 날이 열리기를 기다리는 화면 (DAY_COOLDOWN_MINUTES 를 켰을 때만 보인다)
function waitingView(user) {
  const prev = STEPS[user.stage - 1];
  const when = Math.ceil(user.nextAt / 1000);
  return {
    embeds: [
      {
        title: "🌙 하루가 저문다",
        description:
          `${prev?.day ? `${prev.day}일차가 끝났다.` : "오늘의 의뢰는 여기까지다."}\n` +
          `다음 이야기는 <t:${when}:R> 이어진다.\n` +
          "그때 다시 `/의뢰` 를 열어주세요.",
        color: 0x1a1a2e,
      },
    ],
    components: [],
  };
}

// /의뢰 화면 — stage에 따라 quest / choice / ending / (하루 대기)로 분기
//   page: 몇 번째 쪽인지(0부터)   full: true 면 쪽 나누기 없이 전체를 보여줌 (관리자 플레이 테스트용)
export function stepView(user, { page = 0, full = false } = {}) {
  if (user.stage >= STEPS.length) {
    return endingView(user, page, full);
  }
  if (user.nextAt && user.nextAt > Date.now()) {
    return waitingView(user);
  }

  const step = STEPS[user.stage];

  // 마지막 쪽에서 나올 진짜 버튼
  const finalComponents =
    step.type === "choice"
      ? [
          row(
            ...availableOptions(step, user).map((opt, i) =>
              button(opt.label, `choose:${user.stage}:${opt.value}`, (i % 4) + 1)
            )
          ),
        ]
      : [row(button(step.actionLabel ?? "조사를 시작한다", `complete:${user.stage}`, 2))];

  return paged({
    embed: { title: step.title, footer: footerOf(step, user), color: 0x3498db },
    decor: step,
    body: text(step.description, user),
    page,
    full,
    kind: "s",
    stage: user.stage,
    finalComponents,
  });
}

// 행동 직후 결과 화면 (quest 타입)
export function clearedView(step, user, page = 0) {
  return paged({
    embed: {
      title: `📖 ${step.title.replace(/^.*?: /, "")}`,
      footer: { text: `${Math.min(user.stage, STEPS.length)} / ${STEPS.length} 장면 완료` },
      color: 0x34495e,
    },
    decor: { image: step.clearImage, portrait: step.portrait },
    body: text(step.clearText, user),
    page,
    full: false,
    kind: "c",
    stage: user.stage,
    finalComponents: [nextButton(user)],
  });
}

// 선택 직후 화면 (choice 타입)
export function choiceResultView(option, user, page = 0) {
  return paged({
    embed: { title: `📌 선택: ${option.label}`, color: 0x7f8c8d },
    decor: { image: option.image, portrait: option.portrait },
    body: text(option.resultText, user),
    page,
    full: false,
    kind: `o-${option.value}`,
    stage: user.stage,
    finalComponents: [nextButton(user)],
  });
}

// 엔딩 화면 — 엔딩 본문 + 내가 걸어온 길(후일담)
function endingView(user, page = 0, full = false) {
  const ending = resolveEnding(user);
  const epilogue = buildEpilogue(user);
  const body = epilogue.length
    ? `${ending.description}\n\n**당신이 걸어온 길**\n${epilogue.map((l) => `· ${l}`).join("\n")}`
    : ending.description;
  return paged({
    embed: { title: ending.title, color: ending.color },
    decor: { image: ending.image },
    body,
    page,
    full,
    kind: "e",
    stage: user.stage,
    finalComponents: [],
  });
}

// "다음 ▶ / ◀ 이전 쪽" 버튼을 눌렀을 때 — 진행 상태는 건드리지 않고 화면만 다시 그린다.
// value 예: "s.1" (장면 2쪽), "c.0", "o-tea.1", "i.1", "e.2"
export function pageView(user, value) {
  const [kind, pageStr] = String(value ?? "").split(".");
  const page = Number(pageStr) || 0;

  if (kind === "i") return introView(page);
  if (kind === "e") return endingView(user, page);
  if (kind === "s") return stepView(user, { page });

  // 결과 화면은 이미 stage 가 한 칸 넘어간 상태라서, 방금 끝낸 장면은 stage - 1
  const step = STEPS[user.stage - 1];
  if (step && kind === "c") return clearedView(step, user, page);
  if (step && kind.startsWith("o-")) {
    const option = (step.options ?? []).find((o) => o.value === kind.slice(2));
    if (option) return choiceResultView(option, user, page);
  }
  return stepView(user);
}

// /내정보 화면
export function profileView(user, username) {
  const cleared = Math.min(user.stage, STEPS.length);
  const statusText = user.stage >= STEPS.length ? "사건 종결" : "조사 중";
  const clues = (user.clues ?? []).map((id) => CLUES[id]).filter(Boolean);

  // 마음의 거리: 숫자는 숨기고 말로만. 0이 아닌 사람만 보여준다.
  const bonds = Object.entries(CHARACTERS)
    .filter(([key]) => aff(user, key) !== 0)
    .map(([key, name]) => `· ${name} — ${affinityLabel(aff(user, key))}`);

  const fields = [
    { name: "진행 단계", value: `${cleared} / ${STEPS.length}`, inline: true },
    { name: "상태", value: statusText, inline: true },
    {
      name: "단서와 상황",
      value: clues.length ? clues.map((c) => `· ${c}`).join("\n") : "아직 없음",
    },
  ];
  if (bonds.length) fields.push({ name: "마음의 거리", value: bonds.join("\n") });

  return {
    embeds: [{ title: `🪪 ${username}의 정보`, fields, color: 0x9b59b6 }],
    components: [],
  };
}

export const messageOnly = (content) => ({ content, embeds: [], components: [] });
