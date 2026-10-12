# 픽셀 스트라이크

```
node server.js   →  http://localhost:8230
```

## 구글 로그인 설정 (필수)

게임은 구글 로그인을 해야 이용할 수 있고, 레벨 · 코인 · 스킨은 계정별로 서버의 `data/users.json` 에 저장돼요.

1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → **사용자 인증 정보 만들기 → OAuth 클라이언트 ID** → 애플리케이션 유형 **웹 애플리케이션**
2. **승인된 JavaScript 원본**에 게임 주소를 넣어요. 예: `http://localhost:8230`, `https://내도메인.com`
   - 구글은 `http://localhost` 와 `https://` 주소만 허용해요. `http://192.168.x.x` 같은 LAN 주소로는 로그인이 안 돼요.
3. 발급된 클라이언트 ID를 둘 중 한 곳에 넣어요.
   - 환경변수: `GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com node server.js`
   - 또는 `data/config.json`: `{ "googleClientId": "xxxx.apps.googleusercontent.com" }`

테스트용으로 `DEV_LOGIN=1 node server.js` 를 실행하면 구글 없이 아이디만 넣는 **개발자 로그인**이 생겨요. 공개 서버에서는 켜지 마세요.
