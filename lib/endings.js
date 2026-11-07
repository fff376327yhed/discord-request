// user.flags = { trust: "A"|"B"|"C", method: "D"|"E"|"F"|"G", final: "H"|"I"|"J" }
// 우선순위대로 위에서부터 조건을 검사한다. 어떤 조합도 최소 하나(표류)에는 걸리도록 설계됨.
const ENDINGS = {
  gochi: {
    title: "🦋 엔딩: 고치",
    description:
      "힘으로만 밀어붙인 대가로, 해결사 자신이 재단의 새 '애벌레' 명단에 이름을 올리고 만다.",
    color: 0x2c3e50,
  },
  mayday: {
    title: "🦋 엔딩: 메이데이",
    description:
      "무리한 동시 작전이 실패로 돌아간다. 다수가 희생되지만, 마지막 순간 동료의 희생으로 일부는 구해낸다.",
    color: 0xc0392b,
  },
  noExit: {
    title: "🦋 엔딩: 탈출구 없음",
    description:
      "믿을 동료 없이 홀로 위장 잠입을 시도하다 정체가 발각된다. 작전은 전면 실패로 끝난다.",
    color: 0x7f8c8d,
  },
  accomplice: {
    title: "🦋 엔딩: 공범",
    description:
      "연구원과 손잡은 대가로 기술은 '접수'됐지만, 그 과정에서 스스로도 가해자의 논리에 물들어 있었다.",
    color: 0x8e44ad,
  },
  butterflyEffect: {
    title: "🦋 엔딩: 나비효과",
    description:
      "준비된 신뢰와 정직한 증언이 맞물려, 다수를 구출하고 재단 핵심 책임자들에게 법적 책임을 묻는다.",
    color: 0x27ae60,
  },
  witness: {
    title: "🦋 엔딩: 증인",
    description:
      "증거를 먼저 확보해 재단은 완전히 와해되지만, 지하의 몇몇은 끝내 구하지 못했다.",
    color: 0x2980b9,
  },
  adrift: {
    title: "🦋 엔딩: 표류",
    description:
      "확실한 승리도, 완전한 패배도 아니다. 몇은 구했고 몇은 놓쳤다 — 결과는 끝내 모호하게 남는다.",
    color: 0x95a5a6,
  },
  silence: {
    title: "🦋 엔딩: 침묵의 대가",
    description:
      "증언도 동료도 없이 서버부터 날려버린 대가는 컸다. 지하의 비명은 끝내 세상 밖으로 나오지 못했다.",
    color: 0x1a1a2e,
  },
  fullRescue: {
    title: "🦋 엔딩: 완전한 구원",
    description:
      "쌓아온 신뢰와 몰래 모은 증거, 그리고 사람을 먼저 택한 선택이 맞물려 — 단 한 명도 잃지 않고 모두를 구해낸다.",
    color: 0xf1c40f,
  },
};

export function resolveEnding(flags) {
  const { trust, method, final, approach, risk } = flags;

  if (final === "J" && trust === "C") return ENDINGS.gochi;
  if (final === "J") return ENDINGS.mayday;
  if (risk === "T" && method === "G") return ENDINGS.silence;
  if (trust === "C" && method === "F") return ENDINGS.noExit;
  if (method === "E") return ENDINGS.accomplice;
  if (trust === "A" && final === "H" && approach === "R") return ENDINGS.fullRescue;
  if (trust === "A" && final === "H") return ENDINGS.butterflyEffect;
  if (final === "I") return ENDINGS.witness;
  return ENDINGS.adrift;
}
