function initProductGallery(root: HTMLElement) {
  const mainImg = root.querySelector<HTMLImageElement>(
    ".product-page__gallery-main-img",
  );
  const thumbs = [
    ...root.querySelectorAll<HTMLButtonElement>(".product-page__gallery-thumb"),
  ];
  if (!mainImg || thumbs.length === 0) return;

  let index = thumbs.findIndex((t) => t.classList.contains("is-active"));
  if (index < 0) index = 0;

  const setIndex = (next: number) => {
    const n = thumbs.length;
    if (n === 0) return;
    index = ((next % n) + n) % n;
    const btn = thumbs[index];
    const src = btn.dataset.fullSrc;
    const alt = btn.dataset.fullAlt ?? "";
    if (src) {
      mainImg.src = src;
      mainImg.alt = alt;
    }
    thumbs.forEach((t, j) => {
      const on = j === index;
      t.classList.toggle("is-active", on);
      t.setAttribute("aria-pressed", String(on));
    });
  };

  thumbs.forEach((btn, i) => {
    btn.addEventListener("click", () => setIndex(i));
  });

  root
    .querySelector("[data-gallery-prev]")
    ?.addEventListener("click", () => setIndex(index - 1));
  root
    .querySelector("[data-gallery-next]")
    ?.addEventListener("click", () => setIndex(index + 1));
}

document
  .querySelectorAll<HTMLElement>("[data-product-gallery]")
  .forEach((root) => {
    initProductGallery(root);
  });
