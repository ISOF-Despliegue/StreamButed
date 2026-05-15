export const browserNavigation = {
  reloadImpl() {
    globalThis.location.reload();
  },
  reload() {
    this.reloadImpl();
  },
};

export function reloadCurrentPage() {
  browserNavigation.reload();
}
