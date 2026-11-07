// interactions.js와 같은 폴더에 두세요 (예: api/admin.js)
// 접속: https://<도메인>/api/admin  (쿼리에 키 안 붙여도 됨 — 로그인 폼으로 들어감)
import crypto from "node:crypto";
import { getUser, saveUser, listUsers, resetUser } from "../lib/db.js";
import { STEPS } from "../lib/quests.js";

const COOKIE_NAME = "admin_token";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30일 — 이게 "로그인 유지" 역할

function hashSecret(secret) {
  return crypto.createHash("sha256").update(secret).digest("hex");
}

function parseCookies(request) {
  const header = request.headers.get("cookie") || "";
  return Object.fromEntries(
    header
      .split(";")
      .map((c) => c.trim())
      .filter(Boolean)
      .map((c) => {
        const idx = c.indexOf("=");
        return [c.slice(0, idx), c.slice(idx + 1)];
      })
  );
}

function isLoggedIn(request) {
  if (!process.env.ADMIN_SECRET) return false;
  const cookies = parseCookies(request);
  return cookies[COOKIE_NAME] === hashSecret(process.env.ADMIN_SECRET);
}

function setCookieHeader(value, maxAge) {
  return `${COOKIE_NAME}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

function escapeHtml(str) {
  return String(str).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

// ── 로그인 화면 ──────────────────────────────
function renderLoginPage(error) {
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>관리자 로그인</title>
<style>
  body { font-family: -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #fafafa; }
  .box { background: #fff; padding: 32px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.08); width: 280px; }
  h1 { font-size: 18px; margin: 0 0 16px; }
  input { width: 100%; box-sizing: border-box; padding: 8px; margin-bottom: 8px; border: 1px solid #ccc; border-radius: 4px; }
  button { width: 100%; padding: 8px; border: none; background: #2c3e50; color: #fff; border-radius: 4px; cursor: pointer; }
  .error { color: #c0392b; font-size: 13px; margin-bottom: 8px; }
  .forgot { font-size: 12px; margin-top: 12px; color: #888; cursor: pointer; text-decoration: underline; }
  .forgot-text { display: none; font-size: 12px; color: #888; margin-top: 8px; line-height: 1.5; }
</style>
</head>
<body>
  <div class="box">
    <h1>🦋 나비재단 사건부 — 관리자</h1>
    ${error ? `<div class="error">비밀번호가 틀렸어요.</div>` : ""}
    <form method="POST" action="/api/admin">
      <input type="hidden" name="formAction" value="login">
      <input type="text" name="username" value="admin" autocomplete="username" style="display:none">
      <input type="password" name="password" placeholder="비밀번호" autocomplete="current-password" required autofocus>
      <button type="submit">로그인</button>
    </form>
    <div class="forgot" onclick="document.getElementById('forgotText').style.display='block'">비밀번호를 잊으셨나요?</div>
    <div class="forgot-text" id="forgotText">
      이 비밀번호는 서버 환경변수 <code>ADMIN_SECRET</code>에 저장돼 있어요.
      Vercel 대시보드 → 프로젝트 → Settings → Environment Variables 에서
      직접 확인하거나 새 값으로 바꿀 수 있어요. (이메일 재설정 같은 기능은 없어요)
    </div>
  </div>
</body>
</html>`;
}

// ── 대시보드 화면 ──────────────────────────────
function renderDashboard(users) {
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
  h1 { margin-bottom: 4px; display: flex; justify-content: space-between; align-items: center; font-size: 22px; }
  table { border-collapse: collapse; width: 100%; margin-top: 16px; background: #fff; }
  th, td { border: 1px solid #ddd; padding: 8px; font-size: 13px; vertical-align: top; text-align: left; }
  th { background: #f0f0f0; }
  .actions { display: flex; gap: 4px; flex-wrap: wrap; align-items: center; }
  input[type="number"] { width: 50px; }
  button { cursor: pointer; border: 1px solid #ccc; background: #fff; border-radius: 4px; padding: 4px 8px; }
  button:hover { background: #f0f0f0; }
  .danger { color: #c0392b; border-color: #c0392b; }
  .logout { font-size: 13px; color: #888; border: none; background: none; text-decoration: underline; cursor: pointer; }
</style>
</head>
<body>
  <h1>
    🦋 나비재단 사건부 — 관리자 페이지
    <form method="POST" action="/api/admin" style="margin:0">
      <input type="hidden" name="formAction" value="logout">
      <button class="logout" type="submit">로그아웃</button>
    </form>
  </h1>
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
  async function act(userId, action, extra) {
    await fetch('/api/admin', {
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
  if (!isLoggedIn(request)) {
    return new Response(renderLoginPage(false), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  const users = await listUsers();
  return new Response(renderDashboard(users), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

// 로그인 / 로그아웃 폼 제출 + (fetch로 오는) 유저 조작 액션을 한 파일에서 같이 처리
export async function POST(request) {
  const contentType = request.headers.get("content-type") || "";

  // 로그인/로그아웃 폼은 일반 form submit (application/x-www-form-urlencoded)
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const body = new URLSearchParams(await request.text());
    const formAction = body.get("formAction");

    if (formAction === "login") {
      const password = body.get("password") || "";
      if (process.env.ADMIN_SECRET && password === process.env.ADMIN_SECRET) {
        return new Response(null, {
          status: 303,
          headers: {
            Location: "/api/admin",
            "Set-Cookie": setCookieHeader(hashSecret(password), COOKIE_MAX_AGE),
          },
        });
      }
      return new Response(renderLoginPage(true), {
        status: 401,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    if (formAction === "logout") {
      return new Response(null, {
        status: 303,
        headers: {
          Location: "/api/admin",
          "Set-Cookie": setCookieHeader("", 0),
        },
      });
    }

    return new Response("unknown form action", { status: 400 });
  }

  // 그 외(JSON)는 대시보드 버튼에서 fetch로 보내는 유저 조작 — 로그인 쿠키 필요
  if (!isLoggedIn(request)) {
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