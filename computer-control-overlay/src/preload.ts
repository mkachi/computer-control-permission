import { contextBridge, ipcRenderer } from "electron";

export interface PermissionContext {
  agent: string;
  reason: string;
  sessionLabel: string;
  recentActivity: boolean;
}

export interface PermissionOverlayApi {
  getContext(): Promise<PermissionContext>;
  respond(decision: "yes" | "no"): Promise<boolean>;
}

const api: PermissionOverlayApi = Object.freeze({
  getContext: () => ipcRenderer.invoke("permission:get-context"),
  respond: (decision: "yes" | "no") =>
    ipcRenderer.invoke("permission:respond", decision),
});

contextBridge.exposeInMainWorld("permissionOverlay", api);
