// 지금 스토리에 필요한 이미지 목록을 뽑고, public/story/ 에 파일이 있는지 확인합니다.
// 실행: node scripts/check-images.js
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  STEPS,
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
STEPS.forEach((step, i) => {
  const label = `${i + 1}번 · ${step.title}`;
  add(step.image, `${label} (장면)`);
  add(step.clearImage, `${label} (결과)`);
  if (step.portrait) add(`portrait-${step.portrait}`, `${step.portrait} 얼굴`);
  for (const o of step.options ?? []) add(o.image, `${label} · ${o.label}`);
});

let missing = 0;
for (const [id, where] of wanted) {
  const ok = fs.existsSync(path.join(dir, `${id}.${IMAGE_EXT}`));
  if (!ok) missing += 1;
  console.log(`${ok ? "✅" : "❌"} ${id}.${IMAGE_EXT}  —  ${where}`);
}
console.log(`\n필요한 이미지 ${wanted.size}장 중 ${wanted.size - missing}장 있음, ${missing}장 부족`);
