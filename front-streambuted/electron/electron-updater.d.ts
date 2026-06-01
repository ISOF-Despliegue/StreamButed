declare module "electron-updater" {
  export type UpdateInfo = {
    version: string;
  };

  export type ProgressInfo = {
    percent: number;
  };

  export const autoUpdater: {
    autoDownload: boolean;
    on(event: "checking-for-update", listener: () => void): void;
    on(event: "update-available", listener: (info: UpdateInfo) => void): void;
    on(event: "update-not-available", listener: (info: UpdateInfo) => void): void;
    on(event: "download-progress", listener: (progress: ProgressInfo) => void): void;
    on(event: "update-downloaded", listener: (info: UpdateInfo) => void): void;
    on(event: "error", listener: (error: unknown) => void): void;
    checkForUpdates(): Promise<unknown>;
    quitAndInstall(): void;
  };
}
