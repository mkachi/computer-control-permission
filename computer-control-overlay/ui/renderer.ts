interface PermissionContext {
  agent: string;
  reason: string;
  sessionLabel: string;
  recentActivity: boolean;
}

interface PermissionOverlayApi {
  getContext(): Promise<PermissionContext>;
  respond(decision: "yes" | "no"): Promise<boolean>;
}

interface Window {
  permissionOverlay: PermissionOverlayApi;
}

function requiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`missing required element: ${selector}`);
  return element;
}

async function initialize(): Promise<void> {
  const context = await window.permissionOverlay.getContext();

  requiredElement("#agent-name").textContent = context.agent || "Codex";
  requiredElement("#session-label").textContent =
    context.sessionLabel || "현재 Codex 세션";
  requiredElement("#request-reason").textContent =
    context.reason || "네이티브 마우스 및 키보드 제어";
  requiredElement("#activity-copy").textContent = context.recentActivity
    ? "최근 사용자 입력이 감지되었습니다"
    : "사용자 선택을 기다리는 중입니다";

  let submitting = false;

  async function respond(decision: "yes" | "no"): Promise<void> {
    if (submitting) return;
    submitting = true;
    document.querySelectorAll<HTMLButtonElement>(".actions button").forEach(
      (button) => {
        button.disabled = true;
      },
    );
    const accepted = await window.permissionOverlay.respond(decision);
    if (!accepted) {
      submitting = false;
      document.querySelectorAll<HTMLButtonElement>(".actions button").forEach(
        (button) => {
          button.disabled = false;
        },
      );
    }
  }

  requiredElement("#allow").addEventListener("click", () => {
    void respond("yes");
  });
  requiredElement("#deny").addEventListener("click", () => {
    void respond("no");
  });
}

void initialize();
