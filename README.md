# 픽셀 스트라이크

**지금 하러 가기: https://pixel-fps.onrender.com** (GitHub Pages 주소 https://mingom01.github.io/pixel-fps/ 로 들어와도 이 주소로 이동해요)

```
node server.js   →  http://localhost:8230
```

게임은 구글 로그인을 해야 이용할 수 있어요. 레벨 · 코인 · 스킨 · 설정은 구글 계정별로 저장돼요.

- Supabase 키가 있으면 → Supabase DB (`accounts` 표)에 저장 (배포용, 서버가 재시작돼도 유지)
- 없으면 → 이 컴퓨터의 `data/users.json` 에 저장

## 인터넷에 올리기 (Render + Supabase, 무료)

친구들이 어디서든 `https://….onrender.com` 주소로 접속해서 구글 로그인하고 같이 할 수 있게 하는 방법이에요.

### 1. Supabase (계정 저장용 DB)
1. https://supabase.com 로그인 → **New project** (이름: `pixel-fps`, 지역: Northeast Asia (Seoul), DB 비밀번호는 아무거나)
2. 왼쪽 **SQL Editor** → 이 저장소의 `supabase.sql` 내용을 붙여넣고 **Run**
3. **Project Settings → API Keys** 에서 두 값을 복사
   - **Project URL** (`https://xxxx.supabase.co`) — Project Settings → Data API 에 있을 수도 있어요
   - **secret 키** (`sb_secret_...`, 예전 화면이면 `service_role` 키) — 절대 공개하지 마세요

### 2. 구글 클라이언트 ID
1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → 새 프로젝트
2. **OAuth 동의 화면**: 외부 → 앱 이름·이메일 입력 → **앱 게시**(프로덕션) 로 바꾸기 (테스트 상태면 등록한 사람만 로그인돼요)
3. **사용자 인증 정보 만들기 → OAuth 클라이언트 ID** → 웹 애플리케이션
   - **승인된 JavaScript 원본**: `http://localhost:8230` (Render 주소는 3번 끝나고 추가)
4. 나온 ID (`xxxx.apps.googleusercontent.com`) 복사

### 3. Render (게임 서버)
1. https://render.com 에 GitHub 로 가입 → **New → Blueprint** → 이 저장소 선택 (`render.yaml` 대로 만들어짐)
2. 환경변수 입력: `GOOGLE_CLIENT_ID`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY` (`SESSION_SECRET` 은 자동 생성)
3. 배포가 끝나면 `https://pixel-fps-xxxx.onrender.com` 같은 주소가 생겨요
4. 그 주소를 구글 콘솔의 **승인된 JavaScript 원본**에 추가 → 끝! 친구에게 주소를 공유하세요
   - 무료 서버는 15분 동안 아무도 없으면 잠들어서, 처음 접속할 때 1분쯤 걸려요

> GitHub 에 push 하면 Render 가 자동으로 다시 배포해요. 계정은 Supabase 에 있으니 재배포해도 레벨·코인·스킨이 그대로예요.
> 서버 로그에 `계정 저장소: Supabase (DB)` 가 보이면 제대로 연결된 거예요.

## 내 컴퓨터에서만 돌릴 때

`data/config.json` 에 클라이언트 ID 를 넣거나 환경변수로 주면 돼요.

```json
{ "googleClientId": "xxxx.apps.googleusercontent.com" }
```

- 구글은 `http://localhost` 와 `https://` 주소만 허용해요. `http://192.168.x.x` 같은 LAN 주소로는 로그인이 안 돼요 (친구와 하려면 위의 Render 를 쓰세요)
- 테스트용으로 `DEV_LOGIN=1 node server.js` 를 실행하면 구글 없이 아이디만 넣는 **개발자 로그인**이 생겨요. 공개 서버에서는 켜지 마세요

## 환경변수

| 이름 | 설명 |
|---|---|
| `GOOGLE_CLIENT_ID` | 구글 OAuth 클라이언트 ID |
| `SUPABASE_URL` | Supabase Project URL (없으면 파일 저장) |
| `SUPABASE_SECRET_KEY` | Supabase secret 키 |
| `SESSION_SECRET` | 로그인 토큰 서명용 (없으면 자동으로 만들어요) |
| `PORT` | 포트 (기본 8230, Render 는 자동) |
