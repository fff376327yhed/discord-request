// 다음 의뢰가 열리기까지의 대기 시간 (테스트할 땐 환경변수 COOLDOWN_MINUTES=1 로 줄이세요)
export const COOLDOWN_MS = Number(process.env.COOLDOWN_MINUTES ?? 10) * 60 * 1000;

// 의뢰는 배열 순서대로 하나씩만 진행됩니다. (index 0 → 1 → 2 ...)
// 의뢰를 추가/수정하려면 이 배열만 고치면 됩니다.
export const QUESTS = [
  {
    title: "첫 번째 의뢰: 길 잃은 편지",
    description: "의뢰소 앞에서 주인을 잃은 편지가 발견되었다.\n편지를 주인에게 전달해 주면 된다.",
    clearText: "편지는 무사히 주인의 손에 전해졌다. 의뢰인이 고개를 숙여 감사를 표한다.",
    reward: { gold: 100, title: "신입 해결사" },
  },
  {
    title: "두 번째 의뢰: 수상한 소문",
    description: "시장에 이상한 소문이 돌고 있다.\n소문의 출처를 알아봐 달라는 의뢰다.",
    clearText: "소문의 출처를 찾아냈다. 의뢰인은 조용히 보수를 건넸다.",
    reward: { gold: 150 },
  },
  {
    title: "세 번째 의뢰: 사라진 물건",
    description: "창고에서 물건 하나가 사라졌다.\n흔적을 따라 물건을 되찾아 오자.",
    clearText: "물건을 되찾았다. 창고지기가 안도의 한숨을 내쉰다.",
    reward: { gold: 250 },
  },
  {
    title: "네 번째 의뢰: 밤의 호위",
    description: "한 상인이 밤길 호위를 요청했다.\n무사히 목적지까지 데려다 주자.",
    clearText: "상인은 무사히 도착했다. 두둑한 사례가 기다리고 있었다.",
    reward: { gold: 400, title: "믿음직한 해결사" },
  },
  {
    title: "다섯 번째 의뢰: 마지막 부탁",
    description: "의뢰소 주인이 직접 맡기는 의뢰다.\n지금까지의 실력을 증명할 때다.",
    clearText: "의뢰소 주인이 만족스럽게 고개를 끄덕인다. 이제 당신은 인정받은 해결사다.",
    reward: { gold: 700, title: "의뢰소의 간판" },
  },
];
