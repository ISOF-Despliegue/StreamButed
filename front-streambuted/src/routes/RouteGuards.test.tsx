import { render, screen } from "@testing-library/react";
import { AuthContext } from "../context/authContextValue";
import { ProtectedRoute } from "./ProtectedRoute";
import { RoleRoute } from "./RoleRoute";
import type { AuthContextValue } from "../types/auth.types";

const baseContext: AuthContextValue = {
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isLoadingSession: false,
  login: jest.fn(),
  register: jest.fn(),
  refreshSession: jest.fn(),
  logout: jest.fn(),
  updateProfile: jest.fn(),
  promoteToArtist: jest.fn(),
};

describe("route guards", () => {
  it("blocks protected content without a session", () => {
    render(
      <AuthContext.Provider value={baseContext}>
        <ProtectedRoute fallback={<div>login</div>}><div>private</div></ProtectedRoute>
      </AuthContext.Provider>
    );

    expect(screen.getByText("login")).toBeInTheDocument();
  });

  it("blocks roles that are not allowed", () => {
    render(
      <AuthContext.Provider
        value={{
          ...baseContext,
          isAuthenticated: true,
          accessToken: "token",
          user: {
            id: "user-1",
            email: "listener@example.com",
            username: "listener",
            bio: null,
            profileImageAssetId: null,
            role: "listener",
            isActive: true,
            createdAt: "2026-05-06T00:00:00Z",
          },
        }}
      >
        <RoleRoute allowedRoles={["admin"]}><div>admin</div></RoleRoute>
      </AuthContext.Provider>
    );

    expect(screen.getByText("No tienes permisos para esta vista.")).toBeInTheDocument();
  });
});
