# 픽셀 공터

친구 20명까지 로그인 없이 같은 공간에서 뛰어노는 작은 2D 웹 놀이터입니다. 384×216 픽셀 공터 하나를 PC, 모바일, PiP에서 동일하게 표시합니다.

## 실행

Node.js 22 이상에서 실행합니다. 프로젝트에는 설치할 npm 의존성이 없습니다.

```sh
npm run dev
```

PC에서 `http://localhost:3000`에 접속합니다. 같은 Wi-Fi의 다른 PC·휴대폰에서는 서버 PC의 LAN IP와 같은 포트로 접속합니다. Windows 방화벽과 Wi-Fi의 기기 간 통신 설정에 따라 접속 허용이 필요합니다. Document PiP 검증에는 데스크톱 Chrome에서 `localhost` 또는 HTTPS를 사용합니다.

- 좌우 방향키 또는 A/D로 이동합니다. Space, ↑, W로 점프합니다. 모바일에서는 화면의 이동·점프 버튼을 사용합니다.
- PiP를 열면 같은 캐릭터와 공간이 표시됩니다. PiP 창을 클릭하면 조작할 수 있습니다. 창에서 포커스가 벗어나면 키 입력을 초기화하고 서버가 자동 행동을 이어갑니다.
- 닉네임과 캐릭터 선택은 브라우저에 저장됩니다. 동일 닉네임을 허용합니다. 같은 브라우저에서 새 탭으로 입장하면 기존 탭은 입장 화면으로 돌아갑니다. 한 PC에서 두 명을 검증할 때는 시크릿 창이나 별도 브라우저 프로필을 이용합니다.
- PNG는 512KB와 512×512픽셀 이하입니다. 4컷은 동일한 정사각형을 가로로 배치한 대기, 걷기 1, 걷기 2, 점프 순서입니다. 캐릭터는 브라우저에서 32×32 픽셀 단위로 정규화해 공간에 입장할 때 공유합니다.

## 배포

1. Cloudflare에서 **Workers Free**를 사용하는 계정으로 Wrangler에 로그인합니다. 새 프로젝트라면 계정의 `workers.dev` 서브도메인을 활성화합니다.
2. `wrangler.toml`의 `ALLOWED_ORIGINS`를 실제 Vercel 프로덕션 주소로 설정합니다. 여러 주소는 쉼표로 구분합니다. Vercel Preview를 쓰려면 해당 프리뷰의 정확한 주소도 추가합니다.
3. `npm run deploy:room`으로 실시간 서버를 배포하고 발급된 Worker 주소에서 `wss://<worker-address>/ws`를 확인합니다.
4. Vercel Hobby에서 GitHub 저장소를 연결하고 Framework Preset은 **Other**를 선택합니다. 루트를 그대로 사용합니다. 빌드 명령 `npm run build`와 출력 디렉터리 `dist`는 `vercel.json`에 들어 있습니다.
5. Vercel 프로젝트 Production 환경변수 `ROOM_WS_URL`에 3번의 `wss://…/ws` 주소를 설정하고 재배포합니다. 실제 프런트엔드 주소가 2번의 값과 다르면 Worker의 허용 출처를 수정해 재배포합니다.

| 설정 | 위치 | 용도 |
| --- | --- | --- |
| `ROOM_WS_URL` | Vercel 빌드 환경 | 공개 WebSocket 주소. 정적 파일로 생성됩니다. |
| `ALLOWED_ORIGINS` | Cloudflare Worker | 연결을 허용할 프런트엔드 Origin의 목록 |
| `PORT` | 선택 사항, 로컬 | 기본 `3000` |

## 실시간 서버와 무료 한도

Vercel은 정적 웹을 제공하고, Cloudflare Durable Object 한 개가 공용 공간의 이동과 자동 행동을 계산합니다. 약 100ms마다 플레이어당 5바이트의 위치·방향·동작을 보내며 20명 기준 순수 스냅샷은 사용자당 약 1KB/s입니다. 닉네임과 PNG 픽셀은 입장 시 따로 보냅니다. 브라우저는 스냅샷 사이를 보간합니다. 짧은 재접속에는 기존 위치를 복구하고, 연결이 오래 끊기면 캐릭터를 정리합니다. 재배포나 인스턴스 재시작 후에는 공유 공간의 위치가 초기화됩니다. 사용자가 등록한 캐릭터는 등록한 브라우저에 남으며 다음 입장 때 다시 공유합니다.

Vercel WebSocket 베타는 Hobby에서 함수 실행 시간과 인스턴스 제약을 받습니다. Cloudflare Workers Free의 Durable Objects 한도는 일 100,000개 요청과 일 13,000 GB-s입니다. 플레이어가 접속한 동안 한 객체가 계속 움직임을 계산하며, 128MB 객체 하나가 24시간 활성 상태인 경우의 이론적인 사용량은 약 10,800 GB-s입니다. 요청·연결 급증과 같은 계정의 다른 객체 사용량이 한도에 합산됩니다. Free 한도를 넘으면 해당 동작은 UTC 자정 초기화까지 실패할 수 있습니다. Neon이나 별도 영구 DB는 사용하지 않습니다.

- [Vercel WebSockets](https://vercel.com/docs/functions/websockets)
- [Vercel Functions Limits](https://vercel.com/docs/functions/limitations)
- [Cloudflare Durable Objects 요금과 한도](https://developers.cloudflare.com/durable-objects/platform/pricing/)
- [Chrome Document Picture-in-Picture](https://developer.chrome.com/docs/web-platform/document-picture-in-picture/)

## 검증

`npm test`로 실제 로컬 WebSocket을 통한 입장·PNG 동기화·이동·재접속·20명 수용 시나리오를 실행합니다. 운영 주소를 연결한 뒤 서로 다른 기기에서 입장하고, 데스크톱 Chrome의 PiP 포커스 이동과 Android Chrome·iPhone Safari의 터치 입력을 확인합니다.
