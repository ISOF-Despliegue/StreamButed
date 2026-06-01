import { contextBridge, ipcRenderer } from "electron";

type AuthResponse = {
  accessToken: string;
  role: string;
  expiresIn: number;
};

type LoginRequest = {
  email: string;
  password: string;
};

type UpdateStatus = {
  state: "idle" | "checking" | "available" | "not-available" | "downloading" | "downloaded" | "error";
  message: string;
  version?: string;
  percent?: number;
};

const electronApi = Object.freeze({
  isElectron: true,
  platform: process.platform,
  auth: Object.freeze({
    login(request: LoginRequest): Promise<AuthResponse> {
      return ipcRenderer.invoke("auth:login", request);
    },
    refresh(): Promise<AuthResponse> {
      return ipcRenderer.invoke("auth:refresh");
    },
    logout(): Promise<void> {
      return ipcRenderer.invoke("auth:logout");
    },
    startGoogleOAuth(): Promise<void> {
      return ipcRenderer.invoke("auth:start-google-oauth");
    },
    onOAuthResult(listener: (response: AuthResponse) => void): () => void {
      const handler = (_event: Electron.IpcRendererEvent, response: AuthResponse) => {
        listener(response);
      };
      ipcRenderer.on("auth:oauth-result", handler);
      return () => {
        ipcRenderer.removeListener("auth:oauth-result", handler);
      };
    },
    onOAuthError(listener: (message: string) => void): () => void {
      const handler = (_event: Electron.IpcRendererEvent, message: string) => {
        listener(message);
      };
      ipcRenderer.on("auth:oauth-error", handler);
      return () => {
        ipcRenderer.removeListener("auth:oauth-error", handler);
      };
    },
  }),
  updates: Object.freeze({
    check(): Promise<UpdateStatus> {
      return ipcRenderer.invoke("updates:check");
    },
    install(): Promise<UpdateStatus> {
      return ipcRenderer.invoke("updates:install");
    },
    onStatus(listener: (status: UpdateStatus) => void): () => void {
      const handler = (_event: Electron.IpcRendererEvent, status: UpdateStatus) => {
        listener(status);
      };
      ipcRenderer.on("updates:status", handler);
      return () => {
        ipcRenderer.removeListener("updates:status", handler);
      };
    },
  }),
  versions: Object.freeze({
    chrome: process.versions.chrome,
    electron: process.versions.electron,
    node: process.versions.node,
  }),
});

contextBridge.exposeInMainWorld("streambuted", electronApi);
