// 실제 경로 예상: app/api/admin/route.js
// 접속: https://<도메인>/api/admin?key=<ADMIN_SECRET 환경변수 값>
// (프로젝트 구조에 맞게 아래 import 경로의 "../../lib/..." 깊이만 조정하세요)
import { getUser, saveUser, listUsers, resetUser } from "../lib/db.js";
import { STEPS } from "../lib/quests.js";

function isAuthorized(key) {
  return Boolean(process.env.ADMIN_SECRET) && key === process.env.ADMIN_SECRET;
}

function escapeHtml(str) {
  return String(str).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

function renderPage(users, key) {
  const rows = users
    .map((u) => {
      const ended = u.stage >= STEPS.length;
      const title = ended ? "— 사건 종결 —" : STEPS[u.stage]?.title ?? "-";
      return `
      <tr>
        <td>${escapeHtml(u.id)}</td>
        <td>${u.stage} / ${STEPS.length}<br><small>${escapeHtml(title)}</small></td>
        <td>${u.status}</td>
        <td>${u.gold}</td>
        <td>${u.titles?.length ? escapeHtml(u.titles.join(", ")) : "-"}</td>
        <td><code>${escapeHtml(JSON.stringify(u.flags))}</code></td>
        <td>${u.nextAt ? new Date(u.nextAt).toLocaleString("ko-KR") : "-"}</td>
        <td>
          <div class="actions">
            <button onclick="act('${u.id}','rewind')">◀ 이전</button>
            <button onclick="act('${u.id}','advance')">다음 ▶</button>
            <input type="number" id="stage-${u.id}" value="${u.stage}">
            <button onclick="setStage('${u.id}')">지정</button>
            <button onclick="act('${u.id}','clearCooldown')">쿨다운 해제</button>
            <button class="danger" onclick="if(confirm('정말 초기화할까요?')) act('${u.id}','reset')">초기화</button>
          </div>
        </td>
      </tr>`;
    })
    .join("");

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>나비재단 사건부 — 관리자</title>
<style>
  body { font-family: -apple-system, sans-serif; padding: 24px; background: #fafafa; color: #222; }
  h1 { margin-bottom: 4px; }
  table { border-collapse: collapse; width: 100%; margin-top: 16px; background: #fff; }
  th, td { border: 1px solid #ddd; padding: 8px; font-size: 13px; vertical-align: top; text-align: left; }
  th { background: #f0f0f0; }
  .actions { display: flex; gap: 4px; flex-wrap: wrap; align-items: center; }
  input[type="number"] { width: 50px; }
  button { cursor: pointer; border: 1px solid #ccc; background: #fff; border-radius: 4px; padding: 4px 8px; }
  button:hover { background: #f0f0f0; }
  .danger { color: #c0392b; border-color: #c0392b; }
</style>
</head>
<body>
  <h1>🦋 나비재단 사건부 — 관리자 페이지</h1>
  <p>전체 단계 수: <b>${STEPS.length}</b> · 접속 유저 수: <b>${users.length}</b></p>
  <table>
    <thead>
      <tr>
        <th>유저 ID</th><th>단계</th><th>상태</th><th>골드</th><th>칭호</th><th>flags</th><th>다음 가능 시각</th><th>관리</th>
      </tr>
    </thead>
    <tbody>${rows || `<tr><td colspan="8">아직 아무도 시작하지 않았어요.</td></tr>`}</tbody>
  </table>

<script>
  const KEY = ${JSON.stringify(key)};

  async function act(userId, action, extra) {
    await fetch('/api/admin?key=' + encodeURIComponent(KEY), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({ userId, action }, extra || {})),
    });
    location.reload();
  }

  function setStage(userId) {
    const stage = Number(document.getElementById('stage-' + userId).value);
    act(userId, 'setStage', { stage });
  }
</script>
</body>
</html>`;
}

export async function GET(request) {
  const url = new URL(request.url);
  const key = url.searchParams.get("key");

  if (!isAuthorized(key)) {
    return new Response("🔒 접근 권한이 없어요. 주소 끝에 ?key=관리자키 를 붙여서 접속해 주세요.", {
      status: 401,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const users = await listUsers();
  return new Response(renderPage(users, key), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export async function POST(request) {
  const url = new URL(request.url);
  const key = url.searchParams.get("key");

  if (!isAuthorized(key)) {
    return new Response("unauthorized", { status: 401 });
  }

  const { userId, action, stage, flags } = await request.json();

  if (!userId) return new Response("userId 누락", { status: 400 });

  if (action === "reset") {
    await resetUser(userId);
    return Response.json({ ok: true });
  }

  const user = await getUser(userId);

  switch (action) {
    case "advance":
      user.stage = Math.min(user.stage + 1, STEPS.length);
      user.status = "ready";
      user.nextAt = 0;
      break;
    case "rewind":
      user.stage = Math.max(user.stage - 1, 0);
      user.status = "ready";
      user.nextAt = 0;
      break;
    case "setStage":
      user.stage = Math.max(0, Math.min(Number(stage), STEPS.length));
      user.status = "ready";
      user.nextAt = 0;
      break;
    case "clearCooldown":
      user.nextAt = 0;
      break;
    case "setFlags":
      user.flags = { ...user.flags, ...flags };
      break;
    default:
      return new Response("unknown action", { status: 400 });
  }

  await saveUser(userId, user);
  return Response.json(user);
}
