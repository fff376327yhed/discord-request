# 의뢰소 봇

고정된 순서의 의뢰를 하나씩 클리어하는 디스코드 봇입니다.

- 의뢰는 `lib/quests.js` 순서대로만 진행 (이전 의뢰를 클리어해야 다음 의뢰 오픈)
- 의뢰 완료 시 보상 지급, 다음 의뢰까지 10분 대기
- 모든 응답은 **나에게만 보임(ephemeral) + 사일런트(알림 없음)**

## 구조

```
api/interactions.js   디스코드 요청을 받는 Vercel 함수 (봇 본체)
lib/quests.js         의뢰 목록 / 대기 시간  ← 의뢰를 추가하려면 여기만 수정
lib/db.js             Upstash Redis 저장
lib/views.js          메시지(임베드/버튼) 모양
scripts/register.js   슬래시 명령어 등록
```

## 설치 순서

### 1. 디스코드 봇 만들기
1. https://discord.com/developers/applications → New Application
2. General Information에서 **Application ID**, **Public Key** 복사
3. Bot 탭에서 **Token** 발급 (Reset Token) → 복사
4. 초대 링크: OAuth2 → URL Generator → scope **`applications.commands`** 만 선택 → 생성된 링크로 서버에 초대
   (HTTP 방식이라 `bot` scope나 별도 권한은 필요 없어요)

### 2. GitHub + Vercel 배포
1. 이 폴더를 GitHub 저장소로 올리기
2. https://vercel.com → Add New → Project → 저장소 Import
3. Vercel 프로젝트의 **Storage** 탭 → Upstash Redis 연결 (무료 플랜 가능)
4. **Settings → Environment Variables** 에 아래 추가
   - `DISCORD_PUBLIC_KEY`
   - (Upstash 연결 시 `KV_REST_API_URL`, `KV_REST_API_TOKEN` 은 자동 추가됨)
   - (선택) `COOLDOWN_MINUTES`
5. Deploy

### 3. 디스코드와 연결
1. 개발자 포털 → General Information → **Interactions Endpoint URL** 에
   `https://내프로젝트.vercel.app/api/interactions` 입력 → Save
   (저장 시 디스코드가 확인 요청을 보내고, 통과해야 저장됩니다)
2. 로컬에서 `.env.example` 을 `.env` 로 복사해 값 채우기
3. `npm install` → `npm run register` 로 슬래시 명령어 등록

### 4. 사용
- `/의뢰` : 현재 의뢰 확인, [의뢰 수락] → [의뢰 완료]
- `/내정보` : 골드, 칭호, 진행 상황

## 테스트 팁
- `COOLDOWN_MINUTES=1` 로 두면 대기 시간이 1분이라 빠르게 확인 가능
- 진행 상황을 처음부터 다시 하려면 Upstash 콘솔에서 `quest:user:<유저ID>` 키 삭제

## 참고
- GitHub Pages는 서버 코드를 실행할 수 없어서 봇 본체는 Vercel에서 돌아가요.
  Pages는 의뢰 목록/세계관을 소개하는 정적 안내 페이지 용도로 쓸 수 있습니다.
