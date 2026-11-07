// interactions.js와 같은 폴더에 두세요 (예: api/admin.js)
// 접속: https://<도메인>/api/admin  (쿼리에 키 안 붙여도 됨 — 로그인 폼으로 들어감)
import crypto from "node:crypto";
import {
  getUser,
  saveUser,
  listUsers,
  resetUser,
  deleteUser,
  newUser,
  STEPS,
  applyQuestClear,
  applyChoice,
  availableOptions,
  introView,
  stepView,
  reviveUser,
  restartUser,
} from "../lib/game.js";

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

function colorHex(color) {
  return "#" + (color ?? 0x2c3e50).toString(16).padStart(6, "0");
}

// Discord embed 1개를 관리자 페이지에서 보여줄 HTML 카드로 변환
function embedToHtml(view) {
  const embed = view.embeds?.[0];
  if (!embed) return "";
  const fieldsHtml = (embed.fields || [])
    .map(
      (f) =>
        `<div class="field"><b>${escapeHtml(f.name)}</b><br>${escapeHtml(f.value).replace(/\n/g, "<br>")}</div>`
    )
    .join("");
  const footerHtml = embed.footer ? `<div class="footer">${escapeHtml(embed.footer.text)}</div>` : "";
  return `
    <div class="embed" style="border-left-color:${colorHex(embed.color)}">
      <div class="embed-title">${escapeHtml(embed.title || "")}</div>
      <div class="embed-desc">${escapeHtml(embed.description || "").replace(/\n/g, "<br>")}</div>
      ${fieldsHtml}
      ${footerHtml}
    </div>`;
}

// custom_id("complete:0", "choose:4:A", "intro:start")를 실제 관리자 액션으로 변환해 버튼 렌더링
function buttonsToHtml(view) {
  const rows = view.components || [];
  return rows
    .map((r) => {
      const buttons = r.components
        .map((btn) => {
          const [kind, part1, part2] = btn.custom_id.split(":");
          let realAction = kind;
          let stage = "";
          let value = "";
          if (kind === "intro") {
            realAction = "introStart";
          } else if (kind === "choose") {
            stage = part1;
            value = part2;
          } else {
            stage = part1; // complete / next
          }
          return `<button class="style-${btn.style}" onclick='playAct(${JSON.stringify(
            realAction
          )}, ${JSON.stringify(stage)}, ${JSON.stringify(value)})'>${escapeHtml(btn.label)}</button>`;
        })
        .join("");
      return `<div class="btn-row">${buttons}</div>`;
    })
    .join("");
}

// ── 플레이 테스트 화면 ──────────────────────────────
function renderPlayPage(id, user) {
  const view = !user.introSeen ? introView(0, true) : stepView(user, { full: true });
  const stageInfo =
    user.dead
      ? `💀 사망 (${user.dead}) · 체력 ${user.hp}`
      : user.stage >= STEPS.length
      ? "사건 종결"
      : `${user.stage + 1} / ${STEPS.length} 단계 · ${user.status === "active" ? "진행 중" : "대기"}`;

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>플레이 테스트 — ${escapeHtml(id)}</title>
<style>
  body { font-family: -apple-system, sans-serif; background: #36393f; color: #dcddde; display: flex; justify-content: center; padding: 24px; margin: 0; }
  .wrap { width: 420px; max-width: 100%; }
  .topbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; font-size: 13px; }
  .topbar a { color: #8ab4f8; text-decoration: none; }
  .meta { font-size: 12px; color: #aaa; margin-bottom: 12px; word-break: break-all; }
  .embed { background: #2f3136; border-left: 4px solid #3498db; border-radius: 4px; padding: 12px 16px; margin-bottom: 12px; }
  .embed-title { font-weight: 700; margin-bottom: 6px; }
  .embed-desc { font-size: 14px; white-space: pre-wrap; line-height: 1.5; }
  .field { margin-top: 8px; font-size: 13px; }
  .footer { margin-top: 10px; font-size: 11px; color: #999; }
  .btn-row { display: flex; gap: 8px; margin-bottom: 8px; flex-wrap: wrap; }
  button { padding: 8px 14px; border: none; border-radius: 4px; cursor: pointer; background: #4f545c; color: #fff; font-size: 13px; }
  button:hover { opacity: 0.85; }
  .style-3 { background: #2ecc71; }
  .style-4 { background: #e74c3c; }
  .admin-controls { margin-top: 20px; border-top: 1px solid #444; padding-top: 12px; display: flex; gap: 8px; flex-wrap: wrap; }
  .admin-controls button { background: #7f8c8d; }
</style>
</head>
<body>
<div class="wrap">
  <div class="topbar">
    <a href="/api/admin">← 대시보드로</a>
    <span>🧪 플레이 테스트</span>
  </div>
  <div class="meta">유저 ID: <code>${escapeHtml(id)}</code> · ${stageInfo}</div>
  ${embedToHtml(view)}
  ${buttonsToHtml(view)}
  <div class="admin-controls">
    <button onclick="playAct('rewind')">◀ 강제 이전</button>
    <button onclick="playAct('advance')">강제 다음 ▶</button>
    <button onclick="playAct('revive')">💀 부활</button>
    <button onclick="if(confirm('정말 초기화할까요?')) playAct('reset')">초기화</button>
  </div>
</div>
<script>
  const PLAY_ID = ${JSON.stringify(id)};
  async function playAct(action, stage, value) {
    await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: PLAY_ID, action, stage, value }),
    });
    location.reload();
  }
</script>
</body>
</html>`;
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
    <h1>📋 새빛재단 사건부 — 관리자</h1>
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
      const title = u.dead
        ? `— 💀 사망: ${u.dead} (체력 ${u.hp}) —`
        : ended
          ? "— 사건 종결 —"
          : `${STEPS[u.stage]?.title ?? "-"} (체력 ${u.hp ?? 10})`;
      return `
      <tr>
        <td>${escapeHtml(u.id)}</td>
        <td>${u.stage} / ${STEPS.length}<br><small>${escapeHtml(title)}</small></td>
        <td>${u.status}</td>
        <td><code>${escapeHtml(JSON.stringify(u.flags))}</code><br><small>단서: ${escapeHtml((u.clues ?? []).join(", ") || "-")}</small></td>
        <td>
          <div class="actions">
            <a href="/api/admin?play=${encodeURIComponent(u.id)}" target="_blank"><button type="button" class="play">▶ 플레이</button></a>
            <button onclick="act('${u.id}','rewind')">◀ 이전</button>
            <button onclick="act('${u.id}','advance')">다음 ▶</button>
            ${u.dead ? `<button onclick="act('${u.id}','revive')">💀 부활</button>` : ""}
            <input type="number" id="stage-${u.id}" value="${u.stage}">
            <button onclick="setStage('${u.id}')">지정</button>
            <button class="danger" onclick="if(confirm('정말 초기화할까요?')) act('${u.id}','reset')">초기화</button>
            <button class="danger" onclick="if(confirm('유저 데이터를 완전히 삭제할까요?')) act('${u.id}','deleteUser')">삭제</button>
          </div>
        </td>
      </tr>`;
    })
    .join("");

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>새빛재단 사건부 — 관리자</title>
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
  .play { color: #2980b9; border-color: #2980b9; }
  .logout { font-size: 13px; color: #888; border: none; background: none; text-decoration: underline; cursor: pointer; }
  .header-actions { display: flex; gap: 8px; align-items: center; }
  .new-test { background: #2c3e50; color: #fff; }
</style>
</head>
<body>
  <h1>
    📋 새빛재단 사건부 — 관리자 페이지
    <div class="header-actions">
      <button class="new-test" onclick="createTestUser()">🧪 테스트 유저 생성</button>
      <form method="POST" action="/api/admin" style="margin:0">
        <input type="hidden" name="formAction" value="logout">
        <button class="logout" type="submit">로그아웃</button>
      </form>
    </div>
  </h1>
  <p>전체 단계 수: <b>${STEPS.length}</b> · 접속 유저 수: <b>${users.length}</b></p>
  <table>
    <thead>
      <tr>
        <th>유저 ID</th><th>단계</th><th>상태</th><th>flags</th><th>관리</th>
      </tr>
    </thead>
    <tbody>${rows || `<tr><td colspan="5">아직 아무도 시작하지 않았어요.</td></tr>`}</tbody>
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

  async function createTestUser() {
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'createTestUser' }),
    });
    const data = await res.json();
    if (data.id) location.href = '/api/admin?play=' + encodeURIComponent(data.id);
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

  const url = new URL(request.url);
  const playId = url.searchParams.get("play");
  if (playId) {
    const user = await getUser(playId);
    return new Response(renderPlayPage(playId, user), {
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

  const { userId, action, stage, flags, value } = await request.json();

  // 유저 없이 호출되는 액션 (테스트 유저 생성)
  if (action === "createTestUser") {
    const id = `test_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    await saveUser(id, newUser());
    return Response.json({ ok: true, id });
  }

  if (!userId) return new Response("userId 누락", { status: 400 });

  if (action === "reset") {
    await resetUser(userId);
    return Response.json({ ok: true });
  }

  if (action === "deleteUser") {
    await deleteUser(userId);
    return Response.json({ ok: true });
  }

  const user = await getUser(userId);

  switch (action) {
    case "restart":
      Object.assign(user, restartUser(user));
      break;
    case "revive":
      reviveUser(user);
      break;
    case "advance":
      if (user.dead) reviveUser(user); // 사망 상태에서 단계를 옮기면 엔딩 화면에 갇히므로 함께 풀어준다
      user.stage = Math.min(user.stage + 1, STEPS.length);
      user.status = "ready";
      break;
    case "rewind":
      if (user.dead) reviveUser(user);
      user.stage = Math.max(user.stage - 1, 0);
      user.status = "ready";
      break;
    case "setStage":
      if (user.dead) reviveUser(user);
      user.stage = Math.max(0, Math.min(Number(stage), STEPS.length));
      user.status = "ready";
      break;
    case "setFlags":
      user.flags = { ...user.flags, ...flags };
      break;

    // ── 여기부터는 실제 디스코드 상호작용(interactions.js)과 동일한 로직 — 관리자 페이지에서 "직접 플레이"하기 위한 것 ──
    case "introStart":
      user.introSeen = true;
      break;
    case "next":
      break;
    case "complete": {
      const step = STEPS[user.stage];
      if (step?.type === "quest") applyQuestClear(user, step);
      break;
    }
    case "choose": {
      const step = STEPS[user.stage];
      if (step?.type === "choice") {
        const option = availableOptions(step, user).find((o) => o.value === value);
        if (option) applyChoice(user, step, option);
      }
      break;
    }
    default:
      return new Response("unknown action", { status: 400 });
  }

  await saveUser(userId, user);
  return Response.json(user);
}