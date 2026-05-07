export type UserRole = "listener" | "artist" | "admin";

export interface CurrentUser {
  id: string;
  email: string;
  username: string;
  bio: string | null;
  profileImageAssetId: string | null;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
}
