export {};

import type { AuthResponse, LoginRequest } from "./auth.types";

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
      versions: {
        chrome: string;
        electron: string;
        node: string;
      };
    };
  }
}
