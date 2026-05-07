let accessToken: string | null = null;

export const authTokenStore = {
  getAccessToken(): string | null {
    return accessToken;
  },

  setAccessToken(token: string | null): void {
    accessToken = token;
  },

  clear(): void {
    accessToken = null;
  },
};
