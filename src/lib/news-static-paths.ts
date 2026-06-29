import fs from "node:fs";
import path from "node:path";
import {
  fetchAllNewsPostsForBuild,
  type NewsPostSingle,
} from "./queries/news-post";
import { fetchNewsPage, newsSlugFromPost } from "./queries/news-page";

export type NewsPostPageProps = {
  post: NewsPostSingle;
  archiveTitle: string;
};

function normalizeRedirectKey(uri: string): string {
  const trimmed = uri.trim();
  if (!trimmed) return "/";
  const withSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withSlash.endsWith("/") ? withSlash : `${withSlash}/`;
}

function buildNewsRedirects(posts: NewsPostSingle[]): Record<string, string> {
  const redirects: Record<string, string> = {};

  for (const post of posts) {
    const target = normalizeRedirectKey(post.href);
    const source = normalizeRedirectKey(post.uri);
    if (source !== target) {
      redirects[source] = target;
      redirects[source.replace(/\/$/, "")] = target;
    }
  }

  return redirects;
}

function writeNewsRedirectsFile(redirects: Record<string, string>): void {
  const dir = path.join(process.cwd(), "public", "data");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "news-redirects.json"),
    `${JSON.stringify(redirects, null, 2)}\n`,
    "utf8",
  );
}

export async function getStaticPaths(): Promise<
  { params: { slug: string }; props: NewsPostPageProps }[]
> {
  const [archive, posts] = await Promise.all([
    fetchNewsPage(),
    fetchAllNewsPostsForBuild(),
  ]);

  writeNewsRedirectsFile(buildNewsRedirects(posts));

  const archiveTitle = archive?.title?.trim() || "News";
  const paths: { params: { slug: string }; props: NewsPostPageProps }[] = [];

  for (const post of posts) {
    const slug = newsSlugFromPost(post);
    if (!slug) continue;
    paths.push({
      params: { slug },
      props: { post, archiveTitle },
    });
  }

  return paths;
}
