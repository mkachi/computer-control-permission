# Computer Control Permission (CCP)

CCP는 에이전트와 사용자가 실제 마우스·키보드를 동시에 조작하지 않도록 하는
Agent Skill입니다. 네이티브 제어 직전 최근 30초 이내 입력이 있으면 화면 중앙에서
Yes/No 승인을 받고, 30초 넘게 유휴 상태이면 알림 없이 진행합니다.

호스트 마우스·키보드·포커스에 영향을 주지 않는 브라우저 DOM/CDP/Playwright 작업과
인앱·가상 브라우저 입력은 알림 대상이 아닙니다. 창이 보인다는 이유만으로 승인을
요청하지 않습니다. 활동 감지에 실패하면 기존 네이티브 앱은 승인 창을 표시합니다.

## 설치

```bash
npx skills add mkachi/computer-control-permission --skill ccp -g -a codex -y
```

`npx skills`는 작은 `ccp` 스킬만 설치합니다. 최초 사용 시 스킬에 포함된
부트스트랩이 현재 운영체제와 CPU에 맞는 GitHub Release 파일 하나만 다운로드하고
SHA-256 체크섬을 검증합니다. 추가 npm 패키지는 설치하지 않습니다.

## 업데이트

이미 설치한 전역 `ccp` 스킬만 최신 저장소 내용으로 업데이트합니다.

```bash
pnpm dlx skills@latest update ccp -g -y
```

mise로 pnpm을 관리한다면 현재 선택된 pnpm을 그대로 사용하면 됩니다.
설치 기록이 없어 업데이트되지 않는 경우에는 설치 명령을 다시 실행합니다.

```bash
pnpm dlx skills@latest add mkachi/computer-control-permission --skill ccp -g -a codex -y
```

## 승인 결과 처리

스킬은 `node scripts/request.js "<실행 파일 경로>" ...`로 한 번 실행합니다.
래퍼가 `if-active` 모드를 지정하고 승인 프로그램이 종료될 때까지 기다린 뒤,
검증된 JSON 결과와 종료 코드를 반환합니다. 결과 파일은 래퍼 내부에서만 관리하므로
에이전트가 파일 생성 시점을 추측하거나 같은 승인을 다시 요청할 필요가 없습니다.
도구가 실행 중 세션 ID를 반환하면 새 요청을 만들지 않고 같은 실행을 계속 기다립니다.

연속된 한 작업 안에서는 클릭이나 앱 전환마다 재승인하지 않습니다. 사용자에게 제어가
돌아오거나 작업이 끝나면 다음 네이티브 제어 전에 활동을 다시 확인합니다. 활동 감지는
시작 시점의 유휴 시간 확인이며, 작업 중 사용자 입력을 상시 감시하지는 않습니다.

래퍼는 이미 공개된 `v0.4.0` 실행 파일과 호환되므로 스킬 업데이트만으로 적용됩니다.

## 지원 대상

| 운영체제 | x86_64 | ARM64 |
| --- | --- | --- |
| Windows | portable EXE | portable EXE |
| Linux | AppImage | AppImage |
| macOS | `.app` bundle | `.app` bundle |

현재 공개 빌드는 코드 서명 및 macOS 공증을 적용하지 않습니다. Windows
SmartScreen 또는 macOS Gatekeeper 경고가 나타날 수 있습니다.

## 저장소 구조

```text
skills/ccp/                  npx skills로 설치되는 스킬
computer-control-overlay/    TypeScript/Electron 앱과 빌드 도구
test/                        테스트 코드와 생성 데이터
```

## 개발

```bash
cd computer-control-overlay
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm build:skill
```

`pnpm build:skill`은 현재 호스트의 네이티브 앱과 부트스트랩을 빌드합니다.
`v*` 태그를 푸시하면 GitHub Actions가 지원 플랫폼 전체를 빌드해 Release에
게시합니다.
