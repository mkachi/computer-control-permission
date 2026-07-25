# Computer Control Permission (CCP)

CCP는 에이전트가 실제 마우스나 키보드를 제어하기 직전에 화면 중앙에서 명시적인
Yes/No 승인을 받도록 하는 Agent Skill입니다.

## 설치

```bash
npx skills add mkachi/computer-control-permission --skill ccp -g -a codex -y
```

`npx skills`는 작은 `ccp` 스킬만 설치합니다. 최초 사용 시 스킬에 포함된
부트스트랩이 현재 운영체제와 CPU에 맞는 GitHub Release 파일 하나만 다운로드하고
SHA-256 체크섬을 검증합니다. 추가 npm 패키지는 설치하지 않습니다.

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
