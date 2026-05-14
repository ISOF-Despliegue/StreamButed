import type { ReactNode } from "react";
import { AuthProvider } from "../context/AuthContext";
import { LiveProvider } from "../context/LiveContext";

interface AppProvidersProps {
  children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <AuthProvider>
      <LiveProvider>{children}</LiveProvider>
    </AuthProvider>
  );
}
