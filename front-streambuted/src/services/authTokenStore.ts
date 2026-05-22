let accessToken: string | null = null;
const listeners = new Set<(token: string | null) => void>();

function notifyListeners(): void {
  listeners.forEach((listener) => listener(accessToken));
}

export const authTokenStore = {
  getAccessToken(): string | null {
    return accessToken;
  },

  setAccessToken(token: string | null): void {
    accessToken = token;
    notifyListeners();
  },

  clear(): void {
    accessToken = null;
    notifyListeners();
  },

  subscribe(listener: (token: string | null) => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
