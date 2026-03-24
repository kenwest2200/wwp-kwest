| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `npm install`             | Installs dependencies                            |
| `npm run dev`             | Starts local dev server at `localhost:4321`      |
| `npm run build`           | Build your production site to `./dist/`          |
| `npm run preview`         | Preview your build locally, before deploying     |
| `npm run astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `npm run astro -- --help` | Get help using the Astro CLI                     |

## GraphQL

1. Copy `.env.example` to `.env`.
2. Set `PUBLIC_GRAPHQL_URL`; optionally `GRAPHQL_BASIC_USER` / `GRAPHQL_BASIC_PASSWORD` (defaults: `api` / `apiwaterway`).
3. Adjust the header query in `src/lib/queries/layout-header.ts` to your schema (loaded once from `Layout.astro`).
4. Page-specific data: fetch in `src/pages/<page>.astro` and pass props to section components (e.g. home hero: `src/lib/queries/home-hero.ts` → `index.astro` → `Hero.astro`).

Client helpers: `src/lib/graphql.ts` (`getGraphQLClient`, `requestGraphql`).

ESLint uses `typescript-eslint` so `.astro` frontmatter can use TypeScript (`interface Props`, `import type`, generics on `requestGraphql<...>`).
