export const browserNavigation = {
  reloadImpl() {
    window.location.reload();
  },
  reload() {
    this.reloadImpl();
  },
};

export function reloadCurrentPage() {
  browserNavigation.reload();
}
