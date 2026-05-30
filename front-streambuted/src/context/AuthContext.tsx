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
import { SESSION_TERMINATED_EVENT } from "../services/apiClient";
import { userService } from "../services/userService";
import { browserLogger } from "../utils/browserLogger";
import type {
  AuthContextValue,
  CompletePasswordResetRequest,
  LoginRequest,
  PasswordResetActionRequest,
  RegistrationVerificationActionRequest,
  RegistrationVerificationResponse,
  RegisterRequest,
  SetupPasswordRequest,
  StartPasswordResetRequest,
  UpdateProfileRequest,
  VerifyPasswordResetCodeRequest,
  VerifyRegistrationRequest,
} from "../types/auth.types";
import type { CurrentUser } from "../types/user.types";

type AuthProviderProps = Readonly<{
  children: ReactNode;
}>;

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
    } catch (error) {
      browserLogger.warn("Session refresh failed. Clearing local session state.", error);
      clearSession();
      return null;
    } finally {
      setIsLoadingSession(false);
    }
  }, [clearSession, commitSession]);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  useEffect(() => {
    const desktopAuth = window.streambuted?.isElectron ? window.streambuted.auth : undefined;
    if (!desktopAuth) {
      return undefined;
    }

    const unsubscribeResult = desktopAuth.onOAuthResult((response) => {
      void commitSession(response.accessToken);
    });
    const unsubscribeError = desktopAuth.onOAuthError((message) => {
      browserLogger.warn("Desktop OAuth failed.", message);
    });

    return () => {
      unsubscribeResult();
      unsubscribeError();
    };
  }, [commitSession]);

  useEffect(() => {
    return authTokenStore.subscribe(setAccessToken);
  }, []);

  useEffect(() => {
    const handleSessionTerminated = () => {
      clearSession();
    };

    window.addEventListener(SESSION_TERMINATED_EVENT, handleSessionTerminated);
    return () => {
      window.removeEventListener(SESSION_TERMINATED_EVENT, handleSessionTerminated);
    };
  }, [clearSession]);

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

  const startPasswordReset = useCallback(
    async (request: StartPasswordResetRequest): Promise<RegistrationVerificationResponse> => {
      return authService.startPasswordReset(request);
    },
    []
  );

  const resendPasswordResetCode = useCallback(
    async (request: PasswordResetActionRequest): Promise<RegistrationVerificationResponse> => {
      return authService.resendPasswordResetCode(request);
    },
    []
  );

  const verifyPasswordResetCode = useCallback(
    async (request: VerifyPasswordResetCodeRequest): Promise<void> => {
      await authService.verifyPasswordResetCode(request);
    },
    []
  );

  const completePasswordReset = useCallback(
    async (request: CompletePasswordResetRequest): Promise<void> => {
      await authService.completePasswordReset(request);
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
      startPasswordReset,
      resendPasswordResetCode,
      verifyPasswordResetCode,
      completePasswordReset,
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
      startPasswordReset,
      resendPasswordResetCode,
      verifyPasswordResetCode,
      completePasswordReset,
      completeGooglePasswordSetup,
      updateProfile,
      user,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
