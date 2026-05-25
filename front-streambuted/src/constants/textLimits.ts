export const TEXT_LIMITS = {
  albumTitle: 100,
  artistDisplayName: 100,
  banReason: 500,
  biography: 1000,
  email: 320,
  liveRoomTitle: 100,
  passwordMax: 15,
  passwordMin: 8,
  searchTerm: 100,
  trackGenre: 80,
  trackTitle: 100,
  usernameMax: 100,
  usernameMin: 3,
} as const;

export const SEARCH_BEHAVIOR = {
  autoDebounceMs: 400,
  manualCooldownMs: 800,
  minAutoLength: 3,
} as const;
