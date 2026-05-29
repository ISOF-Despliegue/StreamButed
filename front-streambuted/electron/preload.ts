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
  versions: Object.freeze({
    chrome: process.versions.chrome,
    electron: process.versions.electron,
    node: process.versions.node,
  }),
});

contextBridge.exposeInMainWorld("streambuted", electronApi);
