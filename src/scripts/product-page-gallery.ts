export {};

const FADE_MS = 280;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true
  );
}

function waitOpacityTransition(
  el: HTMLElement,
  fallbackMs: number,
): Promise<void> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(resolve, fallbackMs);
    const onEnd = (e: TransitionEvent) => {
      if (e.target !== el || e.propertyName !== "opacity") return;
      window.clearTimeout(timer);
      el.removeEventListener("transitionend", onEnd);
      resolve();
    };
    el.addEventListener("transitionend", onEnd);
  });
}

function initProductGallery(root: HTMLElement) {
  const mainImg = root.querySelector<HTMLImageElement>(
    ".product-page__gallery-main-img",
  );
  const thumbs = [
    ...root.querySelectorAll<HTMLButtonElement>(".product-page__gallery-thumb"),
  ];
  const thumbsStrip = root.querySelector<HTMLElement>(
    ".product-page__gallery-thumbs",
  );
  if (!mainImg || thumbs.length === 0) return;

  const prevBtns = [
    ...root.querySelectorAll<HTMLButtonElement>("[data-gallery-prev]"),
  ];
  const nextBtns = [
    ...root.querySelectorAll<HTMLButtonElement>("[data-gallery-next]"),
  ];
  const currentEl = root.querySelector<HTMLElement>("[data-gallery-current]");
  const captionEl = root.querySelector<HTMLElement>("[data-gallery-caption]");

  let index = thumbs.findIndex((t) => t.classList.contains("is-active"));
  if (index < 0) index = 0;

  /** Scroll only the horizontal thumb strip — avoids moving the page on load. */
  const scrollActiveThumbIntoStrip = () => {
    const el = thumbs[index];
    if (!el || !thumbsStrip) return;
    const elRect = el.getBoundingClientRect();
    const stripRect = thumbsStrip.getBoundingClientRect();
    const delta =
      elRect.left +
      elRect.width / 2 -
      (stripRect.left + stripRect.width / 2);
    thumbsStrip.scrollBy({
      left: delta,
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  };

  let busy = false;
  let pending: number | null = null;

  const updateControlsAndThumbs = () => {
    const n = thumbs.length;
    thumbs.forEach((t, j) => {
      const on = j === index;
      t.classList.toggle("is-active", on);
      t.setAttribute("aria-pressed", String(on));
    });

    scrollActiveThumbIntoStrip();

    const atStart = index <= 0;
    const atEnd = index >= n - 1;
    for (const b of prevBtns) {
      b.classList.toggle("is-disabled", atStart);
      b.setAttribute("aria-disabled", String(atStart));
    }
    for (const b of nextBtns) {
      b.classList.toggle("is-disabled", atEnd);
      b.setAttribute("aria-disabled", String(atEnd));
    }

    if (currentEl) {
      currentEl.textContent = String(index + 1);
    }
  };

  const applyMainFromThumb = (i: number) => {
    const btn = thumbs[i];
    if (!btn) return;
    const src = (btn.getAttribute("data-full-src") ?? "").trim();
    const alt = (btn.getAttribute("data-full-alt") ?? "").trim();
    const cap = (btn.getAttribute("data-full-title") ?? "").trim();
    if (src) {
      mainImg.src = src;
      mainImg.alt = alt;
    }
    if (captionEl) {
      captionEl.textContent = cap;
      if (cap) captionEl.removeAttribute("hidden");
      else captionEl.setAttribute("hidden", "");
    }
  };

  const waitMainImageDecoded = async () => {
    if (typeof mainImg.decode !== "function") return;
    try {
      await mainImg.decode();
    } catch {
      /* ignore: broken URL or unsupported type */
    }
  };

  const swapWithoutFade = async (clamped: number) => {
    index = clamped;
    applyMainFromThumb(index);
    updateControlsAndThumbs();
    await waitMainImageDecoded();
  };

  const runFade = async (clamped: number) => {
    mainImg.classList.add("is-fading-out");
    await waitOpacityTransition(mainImg, FADE_MS + 60);

    index = clamped;
    applyMainFromThumb(index);
    updateControlsAndThumbs();
    await waitMainImageDecoded();

    mainImg.classList.remove("is-fading-out");
    void mainImg.offsetWidth;
    await waitOpacityTransition(mainImg, FADE_MS + 60);
  };

  const goToIndex = async (next: number) => {
    const n = thumbs.length;
    if (n === 0) return;
    const clamped = Math.max(0, Math.min(n - 1, next));

    if (busy) {
      pending = clamped;
      return;
    }

    if (clamped === index) {
      applyMainFromThumb(index);
      updateControlsAndThumbs();
      await waitMainImageDecoded();
      return;
    }

    if (prefersReducedMotion()) {
      await swapWithoutFade(clamped);
      return;
    }

    busy = true;
    try {
      await runFade(clamped);
    } finally {
      busy = false;
      mainImg.classList.remove("is-fading-out");
      if (pending !== null && pending !== index) {
        const nextIndex = pending;
        pending = null;
        void goToIndex(nextIndex);
      } else {
        pending = null;
      }
    }
  };

  applyMainFromThumb(index);
  updateControlsAndThumbs();

  thumbs.forEach((btn, i) => {
    btn.addEventListener("click", () => {
      void goToIndex(i);
    });
  });

  for (const b of prevBtns) {
    b.addEventListener("click", () => {
      void goToIndex(index - 1);
    });
  }
  for (const b of nextBtns) {
    b.addEventListener("click", () => {
      void goToIndex(index + 1);
    });
  }
}

document
  .querySelectorAll<HTMLElement>("[data-product-gallery]")
  .forEach((root) => {
    initProductGallery(root);
  });
