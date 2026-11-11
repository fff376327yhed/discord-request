// 슬래시 명령어를 디스코드에 등록하는 스크립트 (명령어를 바꿀 때만 다시 실행)
// 실행: npm run register   (.env 파일 필요)

const { DISCORD_APP_ID, DISCORD_BOT_TOKEN, DISCORD_GUILD_ID } = process.env;

if (!DISCORD_APP_ID || !DISCORD_BOT_TOKEN) {
  console.error("DISCORD_APP_ID, DISCORD_BOT_TOKEN 을 .env 에 설정해 주세요.");
  process.exit(1);
}

const commands = [
  { name: "의뢰", description: "의뢰소에서 현재 의뢰를 확인하고 진행합니다", type: 1 },
  { name: "내정보", description: "내 의뢰 진행 상황과 모은 단서를 확인합니다", type: 1 },
  { name: "이야기", description: "플레이할 이야기를 고르거나 다른 이야기로 갈아탑니다", type: 1 },
];

// 길드 ID를 넣으면 해당 서버에 즉시 반영, 없으면 전역 등록(반영까지 시간이 걸릴 수 있음)
const url = DISCORD_GUILD_ID
  ? `https://discord.com/api/v10/applications/${DISCORD_APP_ID}/guilds/${DISCORD_GUILD_ID}/commands`
  : `https://discord.com/api/v10/applications/${DISCORD_APP_ID}/commands`;

const res = await fetch(url, {
  method: "PUT",
  headers: {
    Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(commands),
});

if (res.ok) {
  console.log(`✅ 명령어 ${commands.length}개 등록 완료`);
} else {
  console.error("❌ 등록 실패:", res.status, await res.text());
  process.exit(1);
}
