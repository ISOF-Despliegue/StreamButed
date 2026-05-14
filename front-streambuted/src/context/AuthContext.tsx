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
  RegistrationVerificationActionRequest,
  RegistrationVerificationResponse,
  RegisterRequest,
  SetupPasswordRequest,
  UpdateProfileRequest,
  VerifyRegistrationRequest,
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

  const startRegistration = useCallback(
    async (request: RegisterRequest): Promise<RegistrationVerificationResponse> => {
      return authService.register(request);
    },
    []
  );

  const verifyRegistration = useCallback(
    async (request: VerifyRegistrationRequest): Promise<CurrentUser> => {
      const response = await authService.verifyRegistration(request);
      return commitSession(response.accessToken);
    },
    [commitSession]
  );

  const resendRegistrationCode = useCallback(
    async (
      request: RegistrationVerificationActionRequest
    ): Promise<RegistrationVerificationResponse> => {
      return authService.resendRegistrationCode(request);
    },
    []
  );

  const cancelRegistration = useCallback(
    async (request: RegistrationVerificationActionRequest): Promise<void> => {
      await authService.cancelRegistration(request);
    },
    []
  );

  const completeGooglePasswordSetup = useCallback(
    async (request: SetupPasswordRequest): Promise<CurrentUser> => {
      await authService.setupPassword(request);
      const refreshed = await userService.getCurrentUser();
      setUser(refreshed);
      return refreshed;
    },
    []
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

    const refreshedSession = await refreshSession();
    if (!refreshedSession) {
      throw new Error("Session refresh failed after enabling artist mode.");
    }

    return refreshedSession;
  }, [refreshSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      accessToken,
      isAuthenticated: Boolean(user && accessToken),
      isLoadingSession,
      login,
      startRegistration,
      verifyRegistration,
      resendRegistrationCode,
      cancelRegistration,
      completeGooglePasswordSetup,
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
      startRegistration,
      verifyRegistration,
      resendRegistrationCode,
      cancelRegistration,
      completeGooglePasswordSetup,
      updateProfile,
      user,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
