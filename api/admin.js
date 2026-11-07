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
  computeChoiceStats,
  computeEndingStats,
} from "../lib/game.js";

// 분기(flags)로 저장될 수 있는 값들. 스토리 본문(REST, quests.js 규칙 엔진)과 맞춰서 관리한다.
// 여기 없는 키/값 조합이 생기면 — 즉 스토리에 flagKey 나 option.value 를 추가하면 — 여기도 같이 늘려줘야 flags 편집 UI에 나타난다.
const FLAG_CHOICES = {
  approach: ["P", "Q", "R"],
  trust: ["A", "B", "C"],
  risk: ["S", "T", "U"],
  self: ["W", "X"],
  method: ["D", "E", "F", "G"],
  final: ["H", "I", "J", "K"],
};

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
  // maxAge 가 null 이면 브라우저를 닫을 때 사라지는 세션 쿠키
  const age = maxAge == null ? "" : `; Max-Age=${maxAge}`;
  return `${COOKIE_NAME}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax${age}`;
}

function escapeHtml(str) {
  return String(str).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

// ── 다크모드 (모든 관리자 화면 공용) ──────────────────────────────
// 처음엔 기기 설정(밝게/어둡게)을 따르고, 🌙 버튼으로 바꾸면 이 브라우저에 기억한다.
const THEME_HEAD = `
<script>
  (function () {
    try {
      var t = localStorage.getItem('admin_theme');
      if (!t) t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      document.documentElement.dataset.theme = t;
    } catch (e) {}
  })();
  function toggleTheme() {
    var next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('admin_theme', next); } catch (e) {}
    var b = document.getElementById('themeBtn');
    if (b) b.textContent = next === 'dark' ? '☀️' : '🌙';
  }
  document.addEventListener('DOMContentLoaded', function () {
    var b = document.getElementById('themeBtn');
    if (b) b.textContent = document.documentElement.dataset.theme === 'dark' ? '☀️' : '🌙';
  });
</script>
<style>
  :root {
    color-scheme: light;
    --bg: #fafafa; --fg: #222; --card: #fff; --border: #ddd; --th: #f0f0f0;
    --muted: #888; --btn-bg: #fff; --btn-hover: #f0f0f0; --btn-border: #ccc;
    --input-bg: #fff; --primary: #2c3e50; --danger: #c0392b; --link: #2980b9;
    --shadow: rgba(0,0,0,0.08);
  }
  :root[data-theme="dark"] {
    color-scheme: dark;
    --bg: #1e1f22; --fg: #e3e5e8; --card: #2b2d31; --border: #3f4147; --th: #313338;
    --muted: #9a9ea5; --btn-bg: #383a40; --btn-hover: #43464d; --btn-border: #4e5058;
    --input-bg: #1e1f22; --primary: #5865f2; --danger: #ff6b5e; --link: #8ab4f8;
    --shadow: rgba(0,0,0,0.5);
  }
  body { background: var(--bg); color: var(--fg); }
  .theme-btn { cursor: pointer; border: 1px solid var(--btn-border); background: var(--btn-bg); color: var(--fg); border-radius: 4px; padding: 4px 8px; font-size: 14px; }
  .theme-btn:hover { background: var(--btn-hover); }
</style>`;

const THEME_BUTTON = `<button type="button" id="themeBtn" class="theme-btn" onclick="toggleTheme()" title="다크모드 전환">🌙</button>`;

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

// flags 편집 폼에 쓸 <select> 한 줄. 지금 값이 목록에 없는 값(예: 예전 스토리의 흔적)이어도 깨지지 않게 옵션으로 끼워 넣는다.
function flagSelect(key, current) {
  const choices = FLAG_CHOICES[key] ?? [];
  const options = [
    `<option value="">(미지정)</option>`,
    ...choices.map((v) => `<option value="${v}" ${v === current ? "selected" : ""}>${v}</option>`),
  ];
  if (current && !choices.includes(current)) {
    options.push(`<option value="${escapeHtml(current)}" selected>${escapeHtml(current)} (알 수 없는 값)</option>`);
  }
  return `<label class="flag-field">${key}<select id="flag-${key}">${options.join("")}</select></label>`;
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
  const flagsHtml = Object.keys(FLAG_CHOICES)
    .map((key) => flagSelect(key, user.flags?.[key] ?? null))
    .join("");

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>플레이 테스트 — ${escapeHtml(id)}</title>
${THEME_HEAD}
<style>
  body { font-family: -apple-system, sans-serif; display: flex; justify-content: center; padding: 24px; margin: 0; }
  .wrap { width: 420px; max-width: 100%; }
  .topbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; font-size: 13px; }
  .topbar a { color: var(--link); text-decoration: none; }
  .meta { font-size: 12px; color: var(--muted); margin-bottom: 12px; word-break: break-all; }
  .embed { background: var(--card); border: 1px solid var(--border); border-left: 4px solid #3498db; border-radius: 4px; padding: 12px 16px; margin-bottom: 12px; }
  .embed-title { font-weight: 700; margin-bottom: 6px; }
  .embed-desc { font-size: 14px; white-space: pre-wrap; line-height: 1.5; }
  .field { margin-top: 8px; font-size: 13px; }
  .footer { margin-top: 10px; font-size: 11px; color: var(--muted); }
  .btn-row { display: flex; gap: 8px; margin-bottom: 8px; flex-wrap: wrap; }
  button:not(.theme-btn) { padding: 8px 14px; border: none; border-radius: 4px; cursor: pointer; background: #4f545c; color: #fff; font-size: 13px; }
  button:not(.theme-btn):hover { opacity: 0.85; }
  .style-3 { background: #2ecc71 !important; }
  .style-4 { background: #e74c3c !important; }
  .admin-controls { margin-top: 20px; border-top: 1px solid var(--border); padding-top: 12px; display: flex; gap: 8px; flex-wrap: wrap; }
  .admin-controls button { background: #7f8c8d !important; }
  .flags-box { margin-top: 20px; border-top: 1px solid var(--border); padding-top: 12px; }
  .flags-box h3 { font-size: 13px; margin: 0 0 8px; color: var(--muted); font-weight: 600; }
  .flags-grid { display: flex; flex-wrap: wrap; gap: 8px; align-items: flex-end; }
  .flag-field { display: flex; flex-direction: column; font-size: 11px; color: var(--muted); gap: 2px; }
  .flag-field select { background: var(--input-bg); color: var(--fg); border: 1px solid var(--btn-border); border-radius: 4px; padding: 4px; font-size: 13px; }
  .flags-grid .save-flags { background: var(--primary) !important; color: #fff !important; align-self: flex-end; }
</style>
</head>
<body>
<div class="wrap">
  <div class="topbar">
    <a href="/api/admin">← 대시보드로</a>
    <span>🧪 플레이 테스트 ${THEME_BUTTON}</span>
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
  <div class="flags-box">
    <h3>분기(flags) 직접 설정 — 디버깅용. 스토리 흐름과 안 맞는 조합을 넣으면 화면이 이상해질 수 있어요.</h3>
    <div class="flags-grid">
      ${flagsHtml}
      <button class="save-flags" onclick="saveFlags()">저장</button>
    </div>
  </div>
</div>
<script>
  const PLAY_ID = ${JSON.stringify(id)};
  const FLAG_KEYS = ${JSON.stringify(Object.keys(FLAG_CHOICES))};

  async function postAdmin(body) {
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      alert('요청이 실패했어요 (' + res.status + ')' + (text ? '\\n' + text : ''));
      return false;
    }
    return true;
  }

  async function playAct(action, stage, value) {
    if (await postAdmin({ userId: PLAY_ID, action, stage, value })) location.reload();
  }

  async function saveFlags() {
    const flags = {};
    for (const key of FLAG_KEYS) {
      const v = document.getElementById('flag-' + key).value;
      flags[key] = v === '' ? null : v;
    }
    if (await postAdmin({ userId: PLAY_ID, action: 'setFlags', flags })) location.reload();
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
${THEME_HEAD}
<style>
  body { font-family: -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
  .box { position: relative; background: var(--card); padding: 32px; border-radius: 8px; box-shadow: 0 2px 10px var(--shadow); width: 280px; }
  .theme-corner { position: fixed; top: 16px; right: 16px; }
  h1 { font-size: 18px; margin: 0 0 16px; }
  input[type="password"] { width: 100%; box-sizing: border-box; padding: 8px; margin-bottom: 8px; border: 1px solid var(--btn-border); border-radius: 4px; background: var(--input-bg); color: var(--fg); }
  .login-btn { width: 100%; padding: 8px; border: none; background: var(--primary); color: #fff; border-radius: 4px; cursor: pointer; }
  .remember { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--muted); margin-bottom: 10px; }
  .error { color: var(--danger); font-size: 13px; margin-bottom: 8px; }
  .link-btn { background: none; border: none; padding: 0; font-size: 12px; margin-top: 12px; color: var(--muted); cursor: pointer; text-decoration: underline; display: block; }
  .forgot-text { display: none; font-size: 12px; color: var(--muted); margin-top: 8px; line-height: 1.5; }
</style>
</head>
<body>
  <div class="theme-corner">${THEME_BUTTON}</div>
  <div class="box">
    <h1>📋 새빛재단 사건부 — 관리자</h1>
    ${error ? `<div class="error">비밀번호가 틀렸어요.</div>` : ""}
    <form method="POST" action="/api/admin">
      <input type="hidden" name="formAction" value="login">
      <!-- 브라우저 비밀번호 관리자가 저장할 수 있도록 사용자명 칸을 (보이지 않게) 둔다. display:none 이면 저장을 제안하지 않는 브라우저가 있다 -->
      <input type="text" name="username" value="admin" autocomplete="username" tabindex="-1" aria-hidden="true" style="position:absolute;opacity:0;height:0;width:0;pointer-events:none">
      <input type="password" name="password" placeholder="비밀번호" autocomplete="current-password" required autofocus>
      <label class="remember"><input type="checkbox" name="remember" value="1" checked> 이 기기에서 30일간 로그인 유지</label>
      <button type="submit" class="login-btn">로그인</button>
    </form>
    <form method="POST" action="/api/admin" style="margin:0">
      <input type="hidden" name="formAction" value="logout">
      <button type="submit" class="link-btn">이 기기의 저장된 로그인 잊기</button>
    </form>
    <button type="button" class="link-btn" onclick="document.getElementById('forgotText').style.display='block'">비밀번호를 잊으셨나요?</button>
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
      // data-* 는 검색/정렬을 서버를 다시 안 타고 브라우저에서만 처리하기 위한 값
      return `
      <tr data-id="${escapeHtml(u.id.toLowerCase())}" data-stage="${u.stage}" data-ended="${ended || u.dead ? 1 : 0}">
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
${THEME_HEAD}
<style>
  body { font-family: -apple-system, sans-serif; padding: 24px; }
  h1 { margin-bottom: 4px; display: flex; justify-content: space-between; align-items: center; font-size: 22px; }
  table { border-collapse: collapse; width: 100%; margin-top: 16px; background: var(--card); }
  th, td { border: 1px solid var(--border); padding: 8px; font-size: 13px; vertical-align: top; text-align: left; }
  th { background: var(--th); cursor: pointer; user-select: none; }
  th.sortable:hover { background: var(--btn-hover); }
  code { background: var(--th); padding: 1px 4px; border-radius: 3px; }
  .actions { display: flex; gap: 4px; flex-wrap: wrap; align-items: center; }
  input[type="number"] { width: 50px; background: var(--input-bg); color: var(--fg); border: 1px solid var(--btn-border); border-radius: 4px; }
  button { cursor: pointer; border: 1px solid var(--btn-border); background: var(--btn-bg); color: var(--fg); border-radius: 4px; padding: 4px 8px; }
  button:hover { background: var(--btn-hover); }
  .danger { color: var(--danger); border-color: var(--danger); }
  .play { color: var(--link); border-color: var(--link); }
  .stats-link { color: var(--link); border-color: var(--link); text-decoration: none; display: inline-block; }
  .logout { font-size: 13px; color: var(--muted); border: none; background: none; text-decoration: underline; cursor: pointer; }
  .header-actions { display: flex; gap: 8px; align-items: center; }
  .new-test { background: var(--primary); color: #fff; border-color: var(--primary); }
  .new-test:hover { background: var(--primary); opacity: 0.85; }
  .toolbar { display: flex; gap: 8px; align-items: center; margin-top: 8px; flex-wrap: wrap; }
  .toolbar input[type="search"] { padding: 6px 10px; border: 1px solid var(--btn-border); border-radius: 4px; background: var(--input-bg); color: var(--fg); min-width: 200px; }
  .toolbar select { padding: 6px; border: 1px solid var(--btn-border); border-radius: 4px; background: var(--input-bg); color: var(--fg); }
  .toolbar .count { font-size: 12px; color: var(--muted); margin-left: auto; }
  tr.hidden-row { display: none; }
</style>
</head>
<body>
  <h1>
    📋 새빛재단 사건부 — 관리자 페이지
    <div class="header-actions">
      <a href="/api/admin?stats=1"><button type="button" class="stats-link">📊 통계</button></a>
      <button class="new-test" onclick="createTestUser()">🧪 테스트 유저 생성</button>
      ${THEME_BUTTON}
      <form method="POST" action="/api/admin" style="margin:0">
        <input type="hidden" name="formAction" value="logout">
        <button class="logout" type="submit" title="이 기기에 저장된 로그인을 지웁니다">로그아웃 · 저장된 로그인 잊기</button>
      </form>
    </div>
  </h1>
  <p>전체 단계 수: <b>${STEPS.length}</b> · 접속 유저 수: <b>${users.length}</b></p>
  <div class="toolbar">
    <input type="search" id="search" placeholder="유저 ID 검색" oninput="applyFilter()">
    <select id="sortKey" onchange="applySort()">
      <option value="stage-desc">진행 많은 순</option>
      <option value="stage-asc">진행 적은 순</option>
      <option value="id-asc">유저 ID순</option>
    </select>
    <select id="statusFilter" onchange="applyFilter()">
      <option value="all">전체</option>
      <option value="active">진행 중만</option>
      <option value="ended">사망/종결만</option>
    </select>
    <span class="count" id="rowCount"></span>
  </div>
  <table>
    <thead>
      <tr>
        <th>유저 ID</th><th>단계</th><th>상태</th><th>flags</th><th>관리</th>
      </tr>
    </thead>
    <tbody id="userRows">${rows || `<tr><td colspan="5">아직 아무도 시작하지 않았어요.</td></tr>`}</tbody>
  </table>

<script>
  async function postAdmin(body) {
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      alert('요청이 실패했어요 (' + res.status + ')' + (text ? '\\n' + text : ''));
      return null;
    }
    return res;
  }

  async function act(userId, action, extra) {
    if (await postAdmin(Object.assign({ userId, action }, extra || {}))) location.reload();
  }

  function setStage(userId) {
    const stage = Number(document.getElementById('stage-' + userId).value);
    act(userId, 'setStage', { stage });
  }

  async function createTestUser() {
    const res = await postAdmin({ action: 'createTestUser' });
    if (!res) return;
    const data = await res.json();
    if (data.id) location.href = '/api/admin?play=' + encodeURIComponent(data.id);
  }

  // ── 검색 / 정렬 (서버 왕복 없이 브라우저에서만 처리) ──
  function applyFilter() {
    const q = document.getElementById('search').value.trim().toLowerCase();
    const status = document.getElementById('statusFilter').value;
    const rows = Array.from(document.querySelectorAll('#userRows tr[data-id]'));
    let shown = 0;
    for (const row of rows) {
      const matchesQuery = !q || row.dataset.id.includes(q);
      const ended = row.dataset.ended === '1';
      const matchesStatus = status === 'all' || (status === 'ended') === ended;
      const visible = matchesQuery && matchesStatus;
      row.classList.toggle('hidden-row', !visible);
      if (visible) shown += 1;
    }
    document.getElementById('rowCount').textContent = shown + ' / ' + rows.length + '명 표시 중';
  }

  function applySort() {
    const key = document.getElementById('sortKey').value;
    const tbody = document.getElementById('userRows');
    const rows = Array.from(tbody.querySelectorAll('tr[data-id]'));
    rows.sort((a, b) => {
      if (key === 'id-asc') return a.dataset.id.localeCompare(b.dataset.id);
      const diff = Number(a.dataset.stage) - Number(b.dataset.stage);
      return key === 'stage-asc' ? diff : -diff;
    });
    for (const row of rows) tbody.appendChild(row);
  }

  applyFilter();
</script>
</body>
</html>`;
}

// ── 통계 화면 ──────────────────────────────
// 글자로 그린 막대그래프. 외부 차트 라이브러리 없이 가볍게.
function bar(count, max, color) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return `<div class="bar-row">
    <div class="bar-track"><div class="bar-fill" style="width:${pct}%; background:${color}"></div></div>
    <span class="bar-label">${count} (${pct}%)</span>
  </div>`;
}

function renderStatsPage(users) {
  const totalUsers = users.length;
  const endingStats = computeEndingStats(users);
  const endingTotal = endingStats.reduce((sum, e) => sum + e.count, 0) || 1;
  const choiceStats = computeChoiceStats(users);

  const endingRows = endingStats
    .map((e) => `<tr><td>${escapeHtml(e.title)}</td><td>${bar(e.count, endingTotal, "#9b59b6")}</td></tr>`)
    .join("");

  const choiceBlocks = choiceStats
    .map((s) => {
      const optionRows = s.options
        .map((o) => `<tr><td>${escapeHtml(o.label)}</td><td>${bar(o.count, s.total, "#3498db")}</td></tr>`)
        .join("");
      return `
      <div class="choice-block">
        <h3>${escapeHtml(s.title)}${s.flagKey ? ` <small>(flag: ${s.flagKey})</small>` : ""} — 총 ${s.total}명</h3>
        <table><tbody>${optionRows}</tbody></table>
      </div>`;
    })
    .join("");

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>통계 — 새빛재단 사건부</title>
${THEME_HEAD}
<style>
  body { font-family: -apple-system, sans-serif; padding: 24px; max-width: 760px; margin: 0 auto; }
  h1 { font-size: 20px; display: flex; justify-content: space-between; align-items: center; }
  h1 a { font-size: 13px; color: var(--link); text-decoration: none; }
  h2 { font-size: 15px; margin-top: 28px; border-bottom: 1px solid var(--border); padding-bottom: 6px; }
  h3 { font-size: 13px; margin: 18px 0 6px; }
  h3 small { color: var(--muted); font-weight: 400; }
  table { border-collapse: collapse; width: 100%; background: var(--card); }
  td { padding: 4px 8px; font-size: 13px; border-bottom: 1px solid var(--border); vertical-align: middle; }
  td:first-child { width: 42%; }
  .bar-row { display: flex; align-items: center; gap: 8px; }
  .bar-track { flex: 1; height: 10px; background: var(--th); border-radius: 5px; overflow: hidden; }
  .bar-fill { height: 100%; border-radius: 5px; }
  .bar-label { font-size: 11px; color: var(--muted); white-space: nowrap; width: 70px; text-align: right; }
  .choice-block { margin-bottom: 8px; }
  .empty { color: var(--muted); font-size: 13px; margin-top: 8px; }
</style>
</head>
<body>
  <h1>📊 통계 ${THEME_BUTTON}<a href="/api/admin">대시보드로 →</a></h1>
  <p style="color:var(--muted); font-size:13px;">전체 유저 ${totalUsers}명 기준.</p>

  <h2>엔딩 분포</h2>
  ${endingTotal > 1 || endingStats.some((e) => e.count > 0)
    ? `<table><tbody>${endingRows}</tbody></table>`
    : `<p class="empty">아직 아무도 엔딩을 보지 못했어요.</p>`}

  <h2>선택 분포 (진행 순)</h2>
  ${choiceBlocks || `<p class="empty">아직 선택지를 고른 유저가 없어요.</p>`}
</body>
</html>`;
}

// DB 쪽 문제일 때 보여줄 간단한 에러 페이지. 관리자 본인만 보는 화면이라 에러 내용을 그대로 보여줘도 괜찮다.
function renderErrorPage(err) {
  const isRedis = Boolean(err?.isRedisError);
  return `<!doctype html>
<html lang="ko">
<head><meta charset="utf-8"><title>오류 — 새빛재단 사건부</title>${THEME_HEAD}
<style>body{font-family:-apple-system,sans-serif;padding:40px;max-width:560px;margin:0 auto;}
.box{background:var(--card);border:1px solid var(--border);border-radius:8px;padding:20px;}
pre{white-space:pre-wrap;word-break:break-all;font-size:12px;color:var(--muted);}</style>
</head><body><div class="box">
<h2>${isRedis ? "⚠️ 저장소(Upstash) 연결에 문제가 있어요" : "⚠️ 오류가 발생했어요"}</h2>
<p>${isRedis ? "환경변수(UPSTASH_REDIS_REST_URL/TOKEN 또는 KV_REST_API_*)와 Upstash 대시보드 상태를 확인해 주세요." : "잠시 후 새로고침해 보세요."}</p>
<pre>${escapeHtml(err?.message ?? String(err))}</pre>
<p><a href="/api/admin">← 대시보드로 돌아가기</a></p>
</div></body></html>`;
}

export async function GET(request) {
  try {
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

    if (url.searchParams.get("stats")) {
      const users = await listUsers();
      return new Response(renderStatsPage(users), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    const users = await listUsers();
    return new Response(renderDashboard(users), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (err) {
    console.error("[admin:GET]", err);
    return new Response(renderErrorPage(err), {
      status: 500,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
}

// 로그인 / 로그아웃 폼 제출 + (fetch로 오는) 유저 조작 액션을 한 파일에서 같이 처리
export async function POST(request) {
  try {
    return await handlePost(request);
  } catch (err) {
    console.error("[admin:POST]", err);
    const isRedis = Boolean(err?.isRedisError);
    const message = isRedis
      ? "저장소(Upstash) 연결에 문제가 있어요. 잠시 후 다시 시도해 주세요."
      : "요청을 처리하는 중 오류가 발생했어요.";
    return Response.json({ ok: false, error: message, detail: err?.message }, { status: isRedis ? 503 : 500 });
  }
}

async function handlePost(request) {
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
            "Set-Cookie": setCookieHeader(
              hashSecret(password),
              body.get("remember") ? COOKIE_MAX_AGE : null
            ),
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