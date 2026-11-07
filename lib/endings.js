// 엔딩 판정 + 후일담(당신이 걸어온 길)
// resolveEnding(user)  — 위에서부터 조건을 검사한다. 어떤 조합도 최소 하나(표류)에는 걸린다.
// buildEpilogue(user)  — 앞에서 한 선택이 결말에 어떤 흔적을 남겼는지 한 줄씩 되돌려준다.
import { has, flag, aff } from "./quests.js";

const ENDINGS = {
  gochi: {
    title: "🦋 엔딩: 고치",
    description:
      "힘으로 그를 밀어낸 대가는 컸다. 동시 작전은 어긋났고, 해결사 자신이 재단의 새 ‘애벌레’ 명단에 이름을 올린다.\n서명란엔 당신의 글씨가 이미 적혀 있다. ‘자진’이라는 두 글자와 함께.",
    color: 0x2c3e50,
  },
  mayday: {
    title: "🦋 엔딩: 메이데이",
    description:
      "두 곳을 동시에 노린 작전은 어긋난다. 다수가 희생되고, 마지막 순간 누군가 문을 붙잡아 일부를 내보낸다.\n하준은 나왔다. 하은은 끝내 나오지 못했다.",
    color: 0xc0392b,
  },
  noExit: {
    title: "🦋 엔딩: 탈출구 없음",
    description:
      "믿을 사람 없이, 혹은 이미 얼굴이 알려진 채 위장 잠입을 시도하다 정체가 발각된다. 작전은 전면 실패로 끝난다.\n이중첩자 노릇의 대가는 ‘자진 입소’ 서류 한 장이었다.",
    color: 0x7f8c8d,
  },
  accomplice: {
    title: "🦋 엔딩: 공범",
    description:
      "연구원과 손잡은 대가로 기술은 ‘접수’됐고, 하준과 하은도 걸어 나왔다. 다만 가해자의 논리를 빌린 다음이었다.\n당신은 이제 그 논리의 공범이다.",
    color: 0x8e44ad,
  },
  fullRescue: {
    title: "🦋 엔딩: 완전한 구원",
    description:
      "경비대장은 지하로, 당신은 송출로. 8년 전 하지 못한 일을 이번엔 함께 해낸다.\n단 한 명도 잃지 않았다. 하은과 하준은 구조대 담요를 두른 채 새벽 하늘을 올려다본다.",
    color: 0xf1c40f,
  },
  butterflyEffect: {
    title: "🦋 엔딩: 나비효과",
    description:
      "서명한 사람의 정직한 증언과 준비된 신뢰가 맞물려, 다수를 구출하고 재단 핵심 책임자들에게 법적 책임을 묻는다.\n하은과 하준은 살아 나왔다. 몇몇의 자리는 끝내 이름만 남았다.",
    color: 0x27ae60,
  },
  selfDischarge: {
    title: "🦋 엔딩: 자진 퇴소",
    description:
      "다수를 구했다. 하은과 하준도 돌아왔다. 하지만 재단은 ‘자진 동의’라는 방패 뒤로 책임을 나눠 빠져나갔다.\n동의가 강요였음을 가장 잘 증명할 증인은 끝내 입을 열지 못했다. 서명한 사람, 바로 당신이었다.",
    color: 0x16a085,
  },
  witness: {
    title: "🦋 엔딩: 증인",
    description:
      "증거를 먼저 확보해 재단은 완전히 와해되지만, 지하의 몇몇은 끝내 구하지 못했다.\n하은은 살아 나왔고, 하준의 이름 옆엔 ‘퇴소’ 두 글자가 끝내 남았다.",
    color: 0x2980b9,
  },
  adrift: {
    title: "🦋 엔딩: 표류",
    description:
      "확실한 승리도, 완전한 패배도 아니다. 몇은 구했고 몇은 놓쳤다.\n결과는 끝내 모호하게 남는다.",
    color: 0x95a5a6,
  },
  silence: {
    title: "🦋 엔딩: 침묵의 대가",
    description:
      "증언도 동료도 없이 서버부터 날려버린 대가는 컸다.\n지하의 비명은 끝내 세상 밖으로 나오지 못했다.",
    color: 0x1a1a2e,
  },
};

export function resolveEnding(user) {
  const { trust, method, final, risk, self } = user.flags ?? {};
  const exposed = has(user, "exposed");

  if (final === "J" && trust === "C") return ENDINGS.gochi;
  if (final === "J") return ENDINGS.mayday;
  if (risk === "T" && method === "G") return ENDINGS.silence;
  if (method === "F" && (trust === "C" || exposed)) return ENDINGS.noExit;
  if (method === "E") return ENDINGS.accomplice;
  if (final === "K") return ENDINGS.fullRescue;
  if (trust === "A" && final === "H" && self === "W") return ENDINGS.butterflyEffect;
  if (trust === "A" && final === "H") return ENDINGS.selfDischarge;
  if (final === "I") return ENDINGS.witness;
  return ENDINGS.adrift;
}

// 선택별 후일담. 값이 없는 flag는 건너뛴다.
const EPILOGUE = {
  approach: {
    P: "견학 복도에서 눈에 담은 뒷문과 표지판은, 끝내 지하로 가는 가장 조용한 길이 되었다.",
    Q: "오미란은 떨리는 손을 숨기지 않고 증언했다. 당신이 먼저 말을 걸어준 사람이었다.",
    R: "당신이 몰래 찍은 사진은 어느 자리에서나 가장 먼저 열렸다.",
  },
  trust: {
    A: "경비대장은 8년 늦은 답장을 자신의 목소리로 완성했다.",
    B: "경비대장은 끝까지 선을 지켰다. 도움도 배신도 아닌 거리에서.",
    C: "당신에게 제압당한 경비대장은 끝내 한마디도 하지 않았다. 나방 문양은 사원증 뒤에서 마저 지워졌다.",
  },
  risk: {
    S: "복제한 서버는 말없이 모든 것을 말했다.",
    T: "서버와 함께 지하의 냉각이 꺼진 밤을 당신은 잊지 못한다.",
    U: "냉각을 분리하고 날린 서버. 증거는 사라졌지만 지하의 숨소리는 남았다.",
  },
  method: {
    D: "문채원의 증언이 서류의 빈틈을 하나씩 메웠다.",
    E: "문채원의 기술은 이제 당신의 이름 아래에서 쓰인다. 당신은 그 이름을 더는 부르지 않는다.",
    F: "재단 안에서 보낸 며칠은 당신에게 ‘자진’이라는 말의 무게를 가르쳤다.",
    G: "아무에게도 기대지 않은 돌파였다. 흉터는 전부 당신 몫이다.",
  },
  self: {
    W: "당신은 증인석에서 8년 전 서명이 담긴 사본을 직접 들어 올렸다. 서명한 사람이 말하는 “이건 동의가 아니었다”는 문장은 법정을 오래 울렸다.",
    X: "장부 첫 장은 아직도 서랍 속에 있다. 당신은 그 서랍을 열 이유를 아직 찾지 못했다.",
  },
};

export function buildEpilogue(user) {
  const out = [];
  for (const key of ["approach", "trust", "risk", "method", "self"]) {
    const line = EPILOGUE[key]?.[flag(user, key)];
    if (line) out.push(line);
  }

  // 1일차부터 쌓아온 하은과의 거리. 하은이 돌아왔든 아니든 어울리는 문장으로 쓴다.
  const bond = aff(user, "haeun");
  if (bond >= 6) {
    out.push("의뢰소 소파 위의 담요는 아직 개지 않았다. 당신은 라면을 끓일 때마다 컵을 하나 더 꺼낸다.");
  } else if (bond <= 1) {
    out.push("하은의 이름은 장부의 한 줄로 남았다. 그 줄 아래에 더 적을 말이, 당신에겐 없었다.");
  }
  return out;
}
