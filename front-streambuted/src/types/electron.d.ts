export {};

import type { AuthResponse, LoginRequest } from "./auth.types";

type UpdateStatus = {
  state: "idle" | "checking" | "available" | "not-available" | "downloading" | "downloaded" | "error";
  message: string;
  version?: string;
  percent?: number;
};

declare global {
  interface Window {
    streambuted?: {
      isElectron: boolean;
      platform: NodeJS.Platform;
      auth?: {
        login: (request: LoginRequest) => Promise<AuthResponse>;
        refresh: () => Promise<AuthResponse>;
        logout: () => Promise<void>;
        startGoogleOAuth: () => Promise<void>;
        onOAuthResult: (listener: (response: AuthResponse) => void) => () => void;
        onOAuthError: (listener: (message: string) => void) => () => void;
      };
      updates?: {
        check: () => Promise<UpdateStatus>;
        install: () => Promise<UpdateStatus>;
        onStatus: (listener: (status: UpdateStatus) => void) => () => void;
      };
      versions: {
        chrome: string;
        electron: string;
        node: string;
      };
    };
  }
}
