// 지금 스토리에 필요한 이미지 목록을 뽑고, public/story/ 에 파일이 있는지 확인합니다.
// 실행: node scripts/check-images.js
// CI(배포 전 자동 검사)용: node scripts/check-images.js --ci  (있는 파일은 조용히 넘기고, 부족하면 종료 코드 1을 돌려줌)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  STORIES,
  ENDINGS,
  IMAGE_EXT,
} from "../lib/game.js";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "story");
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
  const ok = fs.existsSync(path.join(dir, `${id}.${IMAGE_EXT}`));
  if (!ok) missing += 1;
  if (!ok || !ciMode) console.log(`${ok ? "✅" : "❌"} ${id}.${IMAGE_EXT}  —  ${where}`);
}
console.log(`\n필요한 이미지 ${wanted.size}장 중 ${wanted.size - missing}장 있음, ${missing}장 부족`);

// 배포 전 자동 검사(CI)에서 이 스크립트를 게이트로 쓸 수 있게, 부족한 이미지가 있으면 비정상 종료한다.
if (missing > 0) {
  console.error(`\n이미지 ${missing}장이 빠져 있어 배포를 막습니다. public/story/ 에 채워 넣어 주세요.`);
  process.exit(1);
}
