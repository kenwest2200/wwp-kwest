/** Align with `$grid-breakpoints` `xsm` / `md` / `lg` in `src/styles/breakpoints.scss`. */
export const PICTURE_VIEWPORT_MIN_PX = {
  sm375: 375,
  md768: 768,
  lg1024: 1024,
} as const;

export const pictureMinWidthMedia = {
  lg: `(min-width: ${PICTURE_VIEWPORT_MIN_PX.lg1024}px)`,
  md: `(min-width: ${PICTURE_VIEWPORT_MIN_PX.md768}px)`,
  sm: `(min-width: ${PICTURE_VIEWPORT_MIN_PX.sm375}px)`,
} as const;
