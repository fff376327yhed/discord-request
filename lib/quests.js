// 쿨다운 제거됨 — 의뢰 완료 즉시 다음 단계가 열립니다

// type: "quest"(기존 수락→완료 방식) | "choice"(버튼 선택 한 방으로 분기)
// flagKey가 있는 choice 단계는 선택값을 user.flags[flagKey]에 저장한다.
// 모든 단계를 마치면(stage >= STEPS.length) endings.js의 resolveEnding(flags)로 최종 엔딩이 정해진다.
export const STEPS = [
  {
    type: "quest",
    title: "첫 번째 의뢰: 후원자 전단",
    description:
      "나비재단 전단을 돌리던 봉사자가 실종됐다.\n마지막 동선은 재단의 '무료 재활 프로그램' 천막이다.",
    clearText: "천막까지 동선을 쫓아냈다. 재단 쪽은 협조적이지만 뭔가 석연치 않다.",
  },
  {
    type: "choice",
    flagKey: "approach",
    title: "두 번째 의뢰: 재활원 견학",
    description:
      "공식 견학 프로그램에 잠입했다.\n깨끗한 전시 구역뿐이지만, 환자 몇몇의 눈빛이 비어 있다.\n어떻게 움직일 것인가?",
    options: [
      { value: "P", label: "조용히 관찰만 한다", resultText: "소란 없이 동선만 눈에 담는다. 뒷문으로 이어지는 통로를 발견했다." },
      { value: "Q", label: "직원에게 말을 걸어본다", resultText: "자연스레 말을 붙이다 뒷문 통로의 단서를 얻는다. 다만 직원 하나가 당신 얼굴을 기억해버렸다." },
      { value: "R", label: "몰래 자료를 찍는다", resultText: "위험을 무릅쓰고 내부를 기록한다. 뒷문 통로를 확인하며, 나중에 쓸 증거도 하나 챙겼다." },
    ],
  },
  {
    type: "quest",
    title: "세 번째 의뢰: 고치 명단",
    description:
      "입소자 명단을 몰래 빼냈다.\n전부 '연고자 없음', '채무 불이행'. 오빠의 이름도 있다 — 신분은 이미 '자진 퇴소'.",
    clearText: "명단을 확보했다. 뭔가가 명백히 숨겨지고 있다.",
  },
  {
    type: "quest",
    title: "네 번째 의뢰: 첫 번째 목격자",
    description:
      "재단 간호조무사가 몰래 접촉해 왔다.\n\"애벌레 단계에서 반 이상이 폐기돼요. 서류상으론 자진 퇴소로 처리되고요.\"",
    clearText: "사무실로 돌아가니 — 의뢰인이었던 여동생마저 연락이 끊겨 있었다.",
  },
  {
    type: "choice",
    flagKey: "trust",
    title: "다섯 번째 의뢰: 경비대장",
    description:
      "경비대장의 사원증 뒤에서 낡은 코드명을 발견했다. 그는 원래 내부고발 요원이었다가 기억 일부를 지우고 재단 편이 됐다.\n그를 어떻게 대할 것인가?",
    options: [
      { value: "A", label: "믿고 함께 간다", resultText: "그의 기억을 함께 되짚어준다. 그가 조심스레 돕기 시작한다." },
      { value: "B", label: "정보만 이용한다", resultText: "필요한 정보만 뽑아내고 선을 긋는다. 그는 거리를 둔 채 협조한다." },
      { value: "C", label: "믿지 않고 배제한다", resultText: "힘으로 그를 제압하고 혼자 움직이기로 한다." },
    ],
  },
  {
    type: "choice",
    flagKey: "risk",
    title: "여섯 번째 의뢰: 해커의 제안",
    description:
      "내부 서버 접근 경로를 쥔 해커와 접촉했다.\n\"서버를 날리면 지하 냉각·산소 시스템도 같이 꺼져요.\"\n어떻게 할 것인가?",
    options: [
      { value: "S", label: "서버만 조용히 복제한다", resultText: "시간은 걸리지만 데이터만 조용히 빼낸다. 아무도 다치지 않는다." },
      { value: "T", label: "서버를 통째로 날린다", resultText: "증거는 확실히 지우겠지만, 지하 냉각·산소 시스템이 함께 멈출 것이다." },
    ],
  },
  {
    type: "quest",
    title: "일곱 번째 의뢰: 고치의 증언",
    description:
      "구출 직전까지 간 피험자가 말한다. \"나는 계약서에 서명했어요.\"\n서명 당시 그는 빚에 쫓겨 제정신이 아니었다.",
    clearText: "형식적 동의와 진짜 동의는 다르다는 게 명백해졌다.",
  },
  {
    type: "choice",
    flagKey: "method",
    title: "여덟 번째 의뢰: 연구원과 재단의 제안",
    description:
      "붙잡은 수석 연구원이 거래를 제안한다. 동시에 재단 명의로 '공식 자문' 전환 제안서가 도착했다.\n어떤 길을 택할 것인가?",
    options: [
      { value: "D", label: "증언 확보", resultText: "연구원에게 법적 책임을 묻는 대가로 증언을 받아낸다." },
      { value: "E", label: "연구원과 거래", resultText: "\"기술을 올바르게 쓰자\"는 제안을 받아들인다. 위험한 동맹이 시작된다." },
      { value: "F", label: "위장 잠입", resultText: "재단의 자문 제안을 받아들여 이중첩자로 들어간다." },
      { value: "G", label: "정면 돌파", resultText: "모든 제안을 거절하고 그대로 밀고 들어간다." },
    ],
  },
  {
    type: "quest",
    title: "아홉 번째 의뢰: 지하 깊은 곳",
    description: "'고치' 단계 명단 최하층에서 — 실종된 여동생의 이름을 발견했다.",
    clearText: "사건이 순식간에 개인적인 일이 되었다. 재단이 움직임을 눈치챈 듯하다.",
  },
  {
    type: "choice",
    flagKey: "final",
    title: "열 번째 의뢰: 마지막 선택",
    description: "재단장과 마주했다. 서버(증거)와 지하 생존자 중 하나만 먼저 손쓸 수 있다.",
    options: [
      { value: "H", label: "생존자 우선", resultText: "사람을 먼저 택한다. 재단은 증거를 인멸할 여지가 남는다." },
      { value: "I", label: "증거 우선", resultText: "서버를 먼저 확보한다. 지하의 몇몇은 끝내 구하지 못한다." },
      { value: "J", label: "동시에 시도", resultText: "무리하게 둘 다 노린다. 실패 확률이 치솟는다." },
    ],
  },
];
