import { pictureMinWidthMedia } from "./picture-breakpoints";
import type {
  PictureImg,
  PictureSource,
} from "../components/Picture/Picture.astro";

/** WPGraphQL `MediaItem` fields for responsive `<picture>` (`MEDIUM` / `MEDIUM_LARGE` / `LARGE` and/or PRODUCT_* + `sourceUrl`). */
export type WpResponsiveMediaNode = {
  sourceUrl?: string | null;
  thumb?: string | null;
  medium?: string | null;
  medium_large?: string | null;
  large?: string | null;
  altText?: string | null;
  mediaDetails?: {
    width?: number | null;
    height?: number | null;
  } | null;
};

export type ResponsivePictureData = {
  alt: string;
  sources: PictureSource[];
  img: PictureImg;
};

function firstUrl(
  ...candidates: Array<string | null | undefined>
): string | null {
  for (const c of candidates) {
    const u = typeof c === "string" ? c.trim() : "";
    if (u) return u;
  }
  return null;
}

export function pictureFromWpMediaNode(
  node: WpResponsiveMediaNode | null | undefined,
  fallbackAlt: string,
): ResponsivePictureData | null {
  if (!node) return null;

  const imgSrc = firstUrl(
    node.thumb,
    node.medium,
    node.medium_large,
    node.sourceUrl,
  );
  if (!imgSrc) return null;

  const u1024 = firstUrl(node.large, node.medium_large, node.sourceUrl);
  const u768 = firstUrl(node.medium_large, node.medium, node.sourceUrl);
  const u375 = firstUrl(node.medium, node.medium_large, node.sourceUrl);

  const tiers: { media: string; url: string }[] = [
    { media: pictureMinWidthMedia.lg, url: u1024 ?? "" },
    { media: pictureMinWidthMedia.md, url: u768 ?? "" },
    { media: pictureMinWidthMedia.sm, url: u375 ?? "" },
  ];

  const sources: PictureSource[] = [];
  const seen = new Set<string>();
  seen.add(imgSrc);

  for (const { media, url } of tiers) {
    const u = url.trim();
    if (!u || seen.has(u)) continue;
    sources.push({ media, srcset: u });
    seen.add(u);
  }

  const width = node.mediaDetails?.width ?? undefined;
  const height = node.mediaDetails?.height ?? undefined;

  return {
    alt: (node.altText ?? "").trim() || fallbackAlt,
    sources,
    img: {
      src: imgSrc,
      width: width ?? undefined,
      height: height ?? undefined,
    },
  };
}
