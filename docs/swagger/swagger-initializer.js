const serviceCards = Array.from(document.querySelectorAll("[data-service-card]"));
const searchInput = document.getElementById("service-search");
const filterButtons = Array.from(document.querySelectorAll("[data-filter]"));
const visibleCount = document.getElementById("visible-count");
const emptyState = document.getElementById("empty-state");

let activeFilter = "all";

function normalize(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function matchesSearch(card, term) {
  if (!term) {
    return true;
  }

  const searchableText = normalize(`${card.dataset.search || ""} ${card.textContent}`);
  return searchableText.includes(term);
}

function matchesFilter(card) {
  return activeFilter === "all" || card.dataset.domain === activeFilter;
}

function updateVisibleCount(count) {
  visibleCount.textContent = count === 1 ? "1 servicio" : `${count} servicios`;
}

function applyFilters() {
  const term = normalize(searchInput.value);
  let count = 0;

  serviceCards.forEach((card) => {
    const visible = matchesSearch(card, term) && matchesFilter(card);
    card.hidden = !visible;
    if (visible) {
      count += 1;
    }
  });

  updateVisibleCount(count);
  emptyState.hidden = count > 0;
}

filterButtons.forEach((button) => {
  button.setAttribute("aria-pressed", String(button.classList.contains("is-active")));

  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;

    filterButtons.forEach((nextButton) => {
      const isActive = nextButton === button;
      nextButton.classList.toggle("is-active", isActive);
      nextButton.setAttribute("aria-pressed", String(isActive));
    });

    applyFilters();
  });
});

searchInput.addEventListener("input", applyFilters);
applyFilters();
