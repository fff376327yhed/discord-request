// 장면 이미지 주소를 만드는 곳.
//
// 이미지는 프로젝트의 public/story/ 폴더에 넣어두면 Vercel이 그대로 보여줍니다.
//   public/story/d1-01.webp  →  https://내도메인/story/d1-01.webp
//
// 환경변수 (Vercel > Settings > Environment Variables)
//   IMAGE_BASE_URL   이미지가 올라간 주소. 예: https://my-bot.vercel.app   (없으면 Vercel 기본 도메인을 자동으로 씀)
//   IMAGE_EXT        파일 확장자. 기본 webp  (png / jpg 도 가능)
//   IMAGE_VERSION    이미지를 바꿨는데 디스코드에 옛날 그림이 보일 때 숫자를 올려주세요 (캐시 무효화)
//
// 이미지 주소를 못 만들면(환경변수 없음 등) 그냥 이미지 없이 글만 나옵니다. 게임이 멈추지는 않아요.

export const IMAGE_EXT = process.env.IMAGE_EXT ?? "webp";

function baseUrl() {
  if (process.env.IMAGE_BASE_URL) return process.env.IMAGE_BASE_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return null;
}

// id 예: "d1-01"  →  https://.../story/d1-01.webp?v=1
export function imageUrl(id) {
  if (!id) return null;
  const base = baseUrl();
  if (!base) return null;
  const version = process.env.IMAGE_VERSION ?? "1";
  return `${base}/story/${id}.${IMAGE_EXT}?v=${version}`;
}
