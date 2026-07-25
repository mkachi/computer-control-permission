# Computer Control Overlay

TypeScript와 Electron으로 작성한 화면 승인 오버레이 프로그램입니다. 프로그램
프로젝트와 실제 스킬은 분리되어 있습니다. 스킬의 최초 바이너리 다운로드에는
Node.js를 사용하지만 npm 패키지는 추가로 설치하지 않습니다.

## 개발

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm build:skill
```

`pnpm build:skill`은 현재 운영체제용 앱을 빌드해
`../skills/ccp/bin/<platform-arch>/`에 복사하고 임시 `dist/`를
삭제합니다.

- Windows: portable 단일 EXE
- Linux: AppImage 단일 파일
- macOS: 운영체제 규칙에 맞는 `.app` 번들

실행 UI는 Chromium과 함께 패키징되므로 플랫폼별 시스템 WebView 버전에 영향을
받지 않습니다.
