# Decisions

Record every decision that is not fixed by docs/SPEC.md: date, decision, reason.

## 2026-09-30, Phase 0

- **Local MySQL runs on host port 3307, not 3306.** Reason: many PHP developers already run a local MySQL (XAMPP, Laragon) on 3306. The port can be changed with `DB_PORT` in `.env`.
- **The `yardflow` database user has all privileges in the local Docker database, and `docker/mysql/init.sql` creates `yardflow_test`.** Reason: Prisma Migrate needs to create a shadow database, and integration tests need a separate test database. This is only for local and CI use.
- **Root scripts delegate to workspaces with `--workspaces --if-present`.** Reason: every script from `CLAUDE.md` exists from Phase 0, and each app adds its own implementation in later phases without changing the root file. `npm run dev` will be switched to run API and web in parallel when the web app exists.
- **Jest runs native ES modules with `NODE_OPTIONS=--experimental-vm-modules` through `cross-env`.** Reason: no Babel transform is needed, and `cross-env` makes the script work on Windows and Linux. Test files import `describe`, `test` and `expect` from `@jest/globals`.
- **A small local ESLint rule `yardflow/no-comments` fails lint on any comment in JavaScript files.** Reason: it enforces the "no code comments" rule automatically instead of relying on review.
- **`packages/shared/src/iso6346.js` exports two helpers beyond the list in section 8.1: `computeWeightedSum` and `getContainerNumberError`.** Reason: the spec tests name the weighted sums, and the API and web need to tell a format error from a check digit error with the exact messages from section 6.1.
- **Prettier ignores Markdown files.** Reason: the spec and design documents are written by hand and should not be reformatted.
- **`.gitattributes` forces LF line endings.** Reason: the owner works on Windows with `core.autocrlf=true`, and Prettier checks for LF.
