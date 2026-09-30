<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Repository layout

`next-app/` is the live application. `mern-app/` is superseded and unmaintained —
ignore it.

## Branch workflow

Work on `dev`. Before shipping, fast-forward `main` and push both:

```bash
git checkout main && git merge dev --ff-only
git push origin dev main
```

The repo has a single remote, `origin`. There is no second remote to push to.

## Verification gate

Run all four before pushing. `npm run build` is slow (~2 min) but catches errors
the other three miss.

```bash
npx tsc --noEmit   # types
npm run lint        # biome check — reports, does not fix
npm test            # vitest run
npm run build        # must pass too
```

Biome will not autofix under `npm run lint`. To apply its formatting and import
ordering, run `npx biome check --write src/` first, then re-run the gate —
formatting is the usual cause of a lint failure after a large edit.

## API conventions

- `apiErrorMessage()` in `src/lib/api.ts` converts thrown responses to display
  strings. Use it for `error` state rather than rendering `Error.message`.
- Route handlers validate with the zod schemas in `src/server/validation/`.
  Check those before building a payload: `updateUserSchema` deliberately
  excludes `email`, so a user edit cannot change an address.
- Destructive lifecycle (soft delete → restore → purge) is shared in
  `src/server/services/deletion.service.ts`; `Admin` may soft-delete and restore,
  only `Super Admin` may purge.
