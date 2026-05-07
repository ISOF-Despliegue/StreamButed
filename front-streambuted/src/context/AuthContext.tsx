import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AuthContext } from "./authContextValue";
import { authService } from "../services/authService";
import { authTokenStore } from "../services/authTokenStore";
import { userService } from "../services/userService";
import type {
  AuthContextValue,
  LoginRequest,
  RegisterRequest,
  UpdateProfileRequest,
} from "../types/auth.types";
import type { CurrentUser } from "../types/user.types";

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);

  const commitSession = useCallback(async (token: string): Promise<CurrentUser> => {
    authTokenStore.setAccessToken(token);
    setAccessToken(token);

    const currentUser = await userService.getCurrentUser();
    setUser(currentUser);
    return currentUser;
  }, []);

  const clearSession = useCallback(() => {
    authTokenStore.clear();
    setAccessToken(null);
    setUser(null);
  }, []);

  const refreshSession = useCallback(async (): Promise<CurrentUser | null> => {
    setIsLoadingSession(true);

    try {
      const response = await authService.refresh();
      return await commitSession(response.accessToken);
    } catch {
      clearSession();
      return null;
    } finally {
      setIsLoadingSession(false);
    }
  }, [clearSession, commitSession]);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const login = useCallback(
    async (request: LoginRequest): Promise<CurrentUser> => {
      const response = await authService.login(request);
      return commitSession(response.accessToken);
    },
    [commitSession]
  );

  const register = useCallback(
    async (request: RegisterRequest): Promise<CurrentUser> => {
      await authService.register(request);

      return login({
        email: request.email,
        password: request.password,
      });
    },
    [login]
  );

  const logout = useCallback(async (): Promise<void> => {
    try {
      await authService.logout();
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const updateProfile = useCallback(
    async (request: UpdateProfileRequest): Promise<CurrentUser> => {
      const updated = await userService.updateProfile(request);
      setUser(updated);
      return updated;
    },
    []
  );

  const promoteToArtist = useCallback(async (): Promise<CurrentUser> => {
    await userService.promoteToArtist();
    const refreshed = await userService.getCurrentUser();
    setUser(refreshed);
    return refreshed;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      accessToken,
      isAuthenticated: Boolean(user && accessToken),
      isLoadingSession,
      login,
      register,
      refreshSession,
      logout,
      updateProfile,
      promoteToArtist,
    }),
    [
      accessToken,
      isLoadingSession,
      login,
      logout,
      promoteToArtist,
      refreshSession,
      register,
      updateProfile,
      user,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
