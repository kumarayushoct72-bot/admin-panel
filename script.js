const searchForm = document.querySelector("#artist-search");
const locationInput = document.querySelector("#location-input");
const searchNote = document.querySelector("#search-note");

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const location = locationInput.value.trim();
  searchNote.textContent = location ? `Showing trusted artists near ${location}.` : "Please enter your city to find nearby artists.";
  if (location) document.querySelector("#artists").scrollIntoView({ behavior: "smooth" });
});

document.querySelectorAll(".favorite").forEach((button) => button.addEventListener("click", () => {
  button.classList.toggle("selected");
  button.textContent = button.classList.contains("selected") ? "♥" : "♡";
}));

const priceFilter = document.querySelector("#price-filter-form");
const priceToggle = document.querySelector(".price-filter-toggle");

if (priceFilter && priceToggle) {
  const priceMenu = priceFilter.closest(".price-filter-menu");
  const minPriceInput = document.querySelector("#min-price");
  const maxPriceInput = document.querySelector("#max-price");
  const minRange = document.querySelector("#min-range");
  const maxRange = document.querySelector("#max-range");
  const closeFilter = document.querySelector(".filter-close");

  priceToggle.addEventListener("click", () => {
    const isOpen = priceMenu.classList.toggle("open");
    priceToggle.setAttribute("aria-expanded", String(isOpen));
  });

  closeFilter?.addEventListener("click", () => {
    priceMenu.classList.remove("open");
    priceToggle.setAttribute("aria-expanded", "false");
  });

  minRange?.addEventListener("input", () => {
    minPriceInput.value = Math.min(Number(minRange.value), Number(maxRange.value) - 500);
  });
  maxRange?.addEventListener("input", () => {
    maxPriceInput.value = Math.max(Number(maxRange.value), Number(minRange.value) + 500);
  });
  minPriceInput?.addEventListener("input", () => {
    minRange.value = Math.min(Number(minPriceInput.value) || 1000, Number(maxRange.value) - 500);
  });
  maxPriceInput?.addEventListener("input", () => {
    maxRange.value = Math.max(Number(maxPriceInput.value) || 40000, Number(minRange.value) + 500);
  });

  priceFilter.addEventListener("submit", (event) => {
    event.preventDefault();
    const minPrice = Number(document.querySelector("#min-price").value) || 1000;
    const maxPrice = Number(document.querySelector("#max-price").value) || 40000;
    const makeupFilter = document.querySelector("#makeup-filter").value;
    const note = document.querySelector("#price-filter-note");

    if (minPrice < 1000 || maxPrice > 40000 || minPrice > maxPrice) {
      note.textContent = "Choose a valid range from ₹1,000 to ₹40,000.";
      return;
    }

    let visibleArtists = 0;
    document.querySelectorAll(".artist-card").forEach((card) => {
      const matches = Number(card.dataset.price) >= minPrice
        && Number(card.dataset.price) <= maxPrice
        && (makeupFilter === "all" || card.dataset.service === makeupFilter);
      card.hidden = !matches;
      if (matches) visibleArtists += 1;
    });
    note.textContent = `${visibleArtists} artist${visibleArtists === 1 ? "" : "s"} found.`;
    document.querySelector("#artists").scrollIntoView({ behavior: "smooth" });
  });
}

const slider = document.querySelector("#hero-slider");

if (slider) {
  const slides = slider.querySelectorAll(".hero-slide");
  const dots = slider.querySelectorAll(".slider-dot");
  let currentSlide = 0;

  const showSlide = (index) => {
    currentSlide = index;
    slides.forEach((slide, slideIndex) => slide.classList.toggle("active", slideIndex === currentSlide));
    dots.forEach((dot, dotIndex) => dot.classList.toggle("active", dotIndex === currentSlide));
  };

  dots.forEach((dot, index) => dot.addEventListener("click", () => showSlide(index)));
  if (slides.length > 1) {
    setInterval(() => showSlide((currentSlide + 1) % slides.length), 4500);
  }
}
