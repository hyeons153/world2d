# 픽셀 공터

친구 20명까지 로그인 없이 같은 공간에서 뛰어노는 작은 2D 웹 놀이터입니다. 384×216 픽셀 공터 하나를 PC, 모바일, PiP에서 동일하게 표시합니다.

## 실행

Node.js 22 이상에서 실행합니다. 프로젝트에는 설치할 npm 의존성이 없습니다.

```sh
npm run dev
```

PC에서 `http://localhost:3000`에 접속합니다. 같은 Wi-Fi의 다른 PC·휴대폰에서는 서버 PC의 LAN IP와 같은 포트로 접속합니다. Windows 방화벽과 Wi-Fi의 기기 간 통신 설정에 따라 접속 허용이 필요합니다. Document PiP 검증에는 데스크톱 Chrome에서 `localhost` 또는 HTTPS를 사용합니다.

- 좌우 방향키로 이동하고 **C / Space**로 점프, **Z / Ctrl**로 공격합니다. 모바일에서는 화면의 이동·점프·공격 버튼을 사용합니다.
- 공격할 때 팔을 뻗습니다. 주먹이 닿은 캐릭터에 타격 효과가 뜨고 뒤로 밀립니다. 바닥에 닿기 전까지 서로 다른 캐릭터를 차례로 밟을 수 있고, 밟힌 상대는 잠시 납작해집니다.
- **1** 기쁨, **2** 화남, **3** 사랑, **4** 슬픔 이모지를 잠깐 표시합니다. 같은 방의 다른 플레이어에게도 보입니다.
- 공터 왼쪽의 낮은 발판에서 30m 점프타워가 시작됩니다. 발판은 위에서만 밟을 수 있고, 위쪽에는 가시와 새가 나옵니다.
- 카메라는 자기 캐릭터가 올라갈 때 따라갑니다. 떨어질 때는 그 높이에 머물고, 캐릭터가 화면 아래로 완전히 벗어나면 0m 공터로 돌아옵니다.
- 게임 화면 왼쪽 위에는 현재 1위, 오른쪽 위에는 내 높이가 표시됩니다. 화면 밖에 있는 친구는 상하 방향과 거리로 표시됩니다.
- 상단에서 **기본**, **화이트**, **블랙** 버튼으로 배경을 고를 수 있습니다. 배경은 내 화면과 PiP에 적용됩니다. PiP 창을 클릭하면 조작할 수 있고, 포커스가 벗어나면 키 입력을 초기화합니다.
- 닉네임과 캐릭터 선택은 브라우저에 저장됩니다. 동일 닉네임을 허용합니다. 같은 브라우저에서 새 탭으로 입장하면 기존 탭은 입장 화면으로 돌아갑니다. 한 PC에서 두 명을 검증할 때는 시크릿 창이나 별도 브라우저 프로필을 이용합니다.
- PNG와 GIF는 10MB 미만으로 등록할 수 있습니다. 브라우저는 원본을 보관하거나 공유하지 않고 32×32픽셀로 변환한 결과를 저장해 입장할 때 공유합니다. PNG 4컷은 대기, 걷기 1, 걷기 2, 점프 순서의 가로 스프라이트입니다. GIF는 최대 12프레임으로 줄여 재생합니다.
- 입장 후 상단의 **캐릭터 선택** 버튼으로 돌아갈 수 있습니다. 등록한 캐릭터는 카드 오른쪽 위의 **×**로 삭제합니다.

## 배포

1. Cloudflare에서 **Workers Free**를 사용하는 계정으로 Wrangler에 로그인합니다. 새 프로젝트라면 계정의 `workers.dev` 서브도메인을 활성화합니다.
2. `wrangler.toml`의 `ALLOWED_ORIGINS`를 실제 Vercel 프로덕션 주소로 설정합니다. 여러 주소는 쉼표로 구분합니다. Vercel Preview를 쓰려면 해당 프리뷰의 정확한 주소도 추가합니다.
3. Cloudflare Workers Builds에 GitHub 저장소를 연결하고 `wrangler.toml`과 같은 이름인 `world2d` Worker로 배포합니다. 로컬에서 배포할 때는 `npm run deploy:room`을 실행합니다.
4. Vercel Hobby에서 GitHub 저장소를 연결하고 Framework Preset은 **Other**를 선택합니다. 루트를 그대로 사용합니다. `vercel.json`의 빌드 명령은 공개 Worker 주소를 `--room-url`로 전달하고 `dist`를 배포합니다.
5. Worker 주소가 바뀌면 `vercel.json`의 `--room-url` 뒤에 발급된 `wss://…/ws` 주소를 넣고 재배포합니다. 프런트엔드 주소가 바뀌면 `wrangler.toml`의 `ALLOWED_ORIGINS`도 수정합니다.

| 설정 | 위치 | 용도 |
| --- | --- | --- |
| `--room-url` | `vercel.json`의 빌드 명령 | 공개 WebSocket 주소. 정적 파일로 생성됩니다. |
| `ROOM_WS_URL` | 빌드 환경 | `--room-url` 인수 없이 빌드할 때 사용하는 공개 WebSocket 주소입니다. |
| `ALLOWED_ORIGINS` | Cloudflare Worker | 연결을 허용할 프런트엔드 Origin의 목록 |
| `PRACTICE_NPC` | Cloudflare Worker, 로컬 환경 | 테스트용 연습 NPC. 기본값은 `0`이며 `1`일 때 표시됩니다. |
| `PORT` | 선택 사항, 로컬 | 기본 `3000` |

## 실시간 서버와 무료 한도

Vercel은 정적 웹을 제공하고, Cloudflare Durable Object 한 개가 이동, 착지, 장애물 충돌, 카메라 상승, 추락 복귀와 현재 1위를 계산합니다. 스냅샷은 약 100ms마다 전송되며 20명 기준 184바이트, 사용자당 약 1.84KB/s입니다. 가시와 새는 스냅샷에 포함된 공통 시계로 그립니다. 닉네임과 스프라이트는 입장 시 따로 보냅니다. 브라우저는 스냅샷 사이를 보간하고, 추락으로 위치가 초기화되면 즉시 공터를 표시합니다. 짧은 재접속에는 기존 위치와 카메라를 복구하고, 연결이 오래 끊기면 캐릭터를 정리합니다. 재배포나 인스턴스 재시작 후에는 공유 공간의 위치가 초기화됩니다. 사용자가 등록한 캐릭터는 등록한 브라우저에 남으며 다음 입장 때 다시 공유합니다.

점프타워부터 웹과 Worker가 새 WebSocket 형식을 사용합니다. 두 배포를 같은 커밋으로 맞춘 뒤 게임 탭을 새로고침합니다.

Vercel WebSocket 베타는 Hobby에서 함수 실행 시간과 인스턴스 제약을 받습니다. Cloudflare Workers Free의 Durable Objects 한도는 일 100,000개 요청과 일 13,000 GB-s입니다. 플레이어가 접속한 동안 한 객체가 계속 움직임을 계산하며, 128MB 객체 하나가 24시간 활성 상태인 경우의 이론적인 사용량은 약 10,800 GB-s입니다. 요청·연결 급증과 같은 계정의 다른 객체 사용량이 한도에 합산됩니다. Free 한도를 넘으면 해당 동작은 UTC 자정 초기화까지 실패할 수 있습니다. Neon이나 별도 영구 DB는 사용하지 않습니다.

- [Vercel WebSockets](https://vercel.com/docs/functions/websockets)
- [Vercel Functions Limits](https://vercel.com/docs/functions/limitations)
- [Cloudflare Durable Objects 요금과 한도](https://developers.cloudflare.com/durable-objects/platform/pricing/)
- [Chrome Document Picture-in-Picture](https://developer.chrome.com/docs/web-platform/document-picture-in-picture/)

## 검증

`npm test`로 발판 20개를 밟는 정상 도달 경로, 장애물 충돌, 카메라와 추락 복귀, 현재 1위와 화면 밖 표시, 실제 로컬 WebSocket을 통한 입장·PNG 동기화·이동·재접속·20명 수용을 확인합니다. 웹과 Worker를 함께 띄운 뒤 데스크톱 Chrome의 PiP 포커스 이동과 Android Chrome·iPhone Safari의 터치 입력을 확인합니다.
