export type UserRole = "listener" | "artist" | "admin";

export interface CurrentUser {
  id: string;
  email: string;
  username: string;
  bio: string | null;
  profileImageAssetId: string | null;
  role: UserRole;
  isActive: boolean;
  passwordSetupRequired: boolean;
  createdAt: string;
}

export type BanStatus = "ACTIVE" | "TEMPORARY" | "PERMANENT" | "EXPIRED" | "INACTIVE";
export type BanType = "TEMPORARY" | "PERMANENT";
export type BanDurationUnit = "HOURS" | "DAYS" | "WEEKS";

export interface AdminUser extends CurrentUser {
  bannedAt: string | null;
  bannedUntil: string | null;
  banReason: string | null;
  banStatus: BanStatus;
}

export interface AdminUserListResponse {
  data: AdminUser[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
  };
}

export interface BanUserRequest {
  banType: BanType;
  durationAmount?: number;
  durationUnit?: BanDurationUnit;
  reason?: string;
}
