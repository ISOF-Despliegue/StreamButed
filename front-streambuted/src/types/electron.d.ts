export {};

declare global {
  interface Window {
    streambuted?: {
      isElectron: boolean;
      platform: NodeJS.Platform;
      versions: {
        chrome: string;
        electron: string;
        node: string;
      };
    };
  }
}
