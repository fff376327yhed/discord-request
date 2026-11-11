// 지금 스토리에 필요한 이미지 목록을 뽑고, public/story/ 에 파일이 있는지 확인합니다.
// png / jpg / jpeg / webp / gif 가 모두 됩니다. 그림마다 확장자가 달라도 괜찮아요.
// 확인이 끝나면 어떤 그림이 어떤 확장자인지 lib/image-manifest.js 에 자동으로 적어 둡니다.
// 실행: node scripts/check-images.js
// CI(배포 전 자동 검사)용: node scripts/check-images.js --ci  (있는 파일은 조용히 넘기고, 부족하면 종료 코드 1을 돌려줌)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { STORIES, ENDINGS, IMAGE_EXTS } from "../lib/game.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "public", "story");
const manifestPath = path.join(root, "lib", "image-manifest.js");

// ── 1) public/story/ 안의 그림 파일을 읽어서 "id → 파일 이름" 표를 만든다 ──
const found = new Map(); // id -> 파일 이름 (예: "p1-01" -> "p1-01.jpg")
const duplicates = [];
const files = fs.existsSync(dir) ? fs.readdirSync(dir).sort() : [];
for (const file of files) {
  const ext = path.extname(file).slice(1).toLowerCase();
  if (!IMAGE_EXTS.includes(ext)) continue;
  const id = path.basename(file, path.extname(file));
  const prev = found.get(id);
  if (!prev) {
    found.set(id, file);
  } else {
    // 같은 id 가 png 와 jpg 로 둘 다 있으면 IMAGE_EXTS 앞쪽 확장자를 쓴다
    const rank = (f) => IMAGE_EXTS.indexOf(path.extname(f).slice(1).toLowerCase());
    const keep = rank(file) < rank(prev) ? file : prev;
    duplicates.push(`${id}: ${prev}, ${file} → ${keep} 사용`);
    found.set(id, keep);
  }
}

// ── 2) 스토리에서 필요한 그림 목록을 뽑는다 ──
const wanted = new Map(); // id -> 어디에 쓰이는지

const add = (id, where) => {
  if (id && !wanted.has(id)) wanted.set(id, where);
};

add("intro", "인트로 화면");
for (const e of Object.values(ENDINGS)) add(e.image, `엔딩 · ${e.title}`);
for (const story of Object.values(STORIES)) {
  story.steps.forEach((step, i) => {
    const label = `[${story.title}] ${i + 1}번 · ${step.title}`;
    add(step.image, `${label} (장면)`);
    add(step.clearImage, `${label} (결과)`);
    if (step.portrait) add(`portrait-${step.portrait}`, `${step.portrait} 얼굴`);
    for (const o of step.options ?? []) add(o.image, `${label} · ${o.label}`);
  });
}

const ciMode = process.argv.includes("--ci");

let missing = 0;
for (const [id, where] of wanted) {
  const file = found.get(id);
  if (!file) missing += 1;
  if (!file || !ciMode) console.log(`${file ? "✅" : "❌"} ${file ?? `${id}.(png/jpg/webp)`}  —  ${where}`);
}
for (const d of duplicates) console.log(`⚠️ 같은 이름의 그림이 여러 개예요 — ${d}`);
console.log(`\n필요한 이미지 ${wanted.size}장 중 ${wanted.size - missing}장 있음, ${missing}장 부족`);

// ── 3) lib/image-manifest.js 를 다시 만든다 (내용이 바뀐 때만 파일을 건드린다) ──
const body = Object.fromEntries([...found].sort(([a], [b]) => (a < b ? -1 : 1)));
const manifest =
  `// 자동 생성 파일 — 직접 고치지 마세요.\n` +
  `// 그림을 public/story/ 에 넣은 뒤 \`node scripts/check-images.js\` 를 실행하면 이 파일이 다시 만들어집니다.\n` +
  `export const IMAGE_FILES = ${JSON.stringify(body, null, 2)};\n`;
const before = fs.existsSync(manifestPath) ? fs.readFileSync(manifestPath, "utf8") : "";
if (before !== manifest) {
  fs.writeFileSync(manifestPath, manifest);
  console.log(`📝 lib/image-manifest.js 를 새로 적었어요 (그림 ${found.size}장의 확장자 기록). 이 파일도 같이 배포하세요.`);
}

// 배포 전 자동 검사(CI)에서 이 스크립트를 게이트로 쓸 수 있게, 부족한 이미지가 있으면 비정상 종료한다.
if (missing > 0) {
  console.error(`\n이미지 ${missing}장이 빠져 있어 배포를 막습니다. public/story/ 에 채워 넣어 주세요.`);
  process.exit(1);
}