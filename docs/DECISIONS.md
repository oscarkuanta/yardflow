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

## 2026-09-30, Phase 1

- **The seed fills the yard to 65% TEU occupancy, which is about 900 containers, not about 320.** Reason: spec section 12 asks for both, but the six blocks hold 1,994 TEU, so 320 containers would only be about 25%. The owner chose 65% so the yard map and the KPIs look like the approved mockups.
- **Each block is filled to 65% of its slots, so the size mix in the yard follows the block capacity** (about 56% 20 ft, 38% 40 ft, 6% 45 ft; 12% empty; 4% DG). Reason: the 60/30/10 mix in section 12 does not fit into blocks A and D, which are large and 20 ft only. Empty containers are always 40 ft or 45 ft and DG containers are always 20 ft, because the only EMPTY block is LARGE and the only DG block is SMALL.
- **Prisma is pinned to 6.19.** Reason: the schema in section 5 uses `prisma-client-js` and `url = env("DATABASE_URL")`, which Prisma 7 removed. Prisma 6 prints a warning that the `package.json#prisma` seed setting is deprecated. We accept that warning.
- **`npm audit` reports a high advisory in `deepmerge-ts`.** It is only used by the Prisma CLI config loader, never by the running API. It goes away when we move to a Prisma version with a fixed dependency.
- **`dotenv-cli` loads the root `.env` for the Prisma CLI and the seed script.** Reason: Prisma only looks for `.env` next to the schema, but the monorepo keeps one `.env` at the root. Tests load it with Node's built-in `process.loadEnvFile`.
- **Tests always run against `DATABASE_URL_TEST`, and the database name must contain `test`.** Reason: this prevents a test from ever clearing the development database.
- **The seed builds all rows in memory first with explicit IDs, then writes them with `createMany` in one transaction after deleting old rows in dependency order.** Reason: it is fast (about 5,000 rows in a few seconds), easy to test without a database, and running it twice gives the same result.
- **Seed times are relative to the moment the seed runs.** The demo pickup and delivery bookings go into the current slot, or the next one if the gate is closed. Other active bookings go into the next two operating days that still have open slots. Reason: the gate only accepts a truck inside its slot window. "Today and tomorrow" does not work on a Saturday evening, because Sunday has no slots.
- **Imports arrive by vessel and leave by truck; exports arrive by truck and leave by vessel.** Reason: this is how a real terminal works, and it gives the gate history and the vessel lists a consistent story.
- **Every historic gate transaction has its own `USED` pre-advice**, because `GateTransaction.preAdviceId` is required. All of these share the bcrypt hash of one retired PIN. Reason: hashing about 850 different PINs would make the seed slow for no benefit.
- **Pending discharge items and active delivery pre-advices get a `Container` row in state `EXPECTED`.** Reason: section 6.2 says `EXPECTED` means "known from a discharge list or delivery pre-advice", and the customer portal shows expected containers.
- **Baltic Wren has 40 discharge and 30 load items.** Reason: the spec gives no numbers for this visit.
- **`mapX` and `mapY` are metres from the top-left of the yard plan, with the gate on the left edge.** A block's drawn width is bays times the bay length (7 m or 13 m), and its depth is rows times 3 m.
- **The seed also creates notifications** for holds, invoices, today's discharges and recent gate-outs. Reason: the customer portal and its unread badge are empty otherwise.
- **`storage-fee.js` and its section 8.4 tests were built in Phase 1 instead of Phase 7.** Reason: the seed invoices must use the same fee rules as the API.
- **`packages/shared` gained `enums.js`, `position.js` and `stacking.js`.** Reason: the web app cannot import Prisma. A test checks that the shared enums match the Prisma schema exactly.
- **Terminal time uses `Intl.DateTimeFormat` with `Europe/Berlin` instead of a date library.** Reason: we only need a few conversions, and the tests cover both daylight saving time switches.
- **A `db:studio` script opens Prisma Studio.** Reason: it lets the owner browse the seeded data in the browser before the web app exists.
