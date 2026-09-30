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

## 2026-09-30, Phase 2

- **The session table is a Prisma model (`Session`, mapped to `sessions`), and `express-mysql-session` runs with `createDatabaseTable: false`.** Reason: if the store created the table itself, `prisma migrate dev` would report it as drift and ask to reset the database. The seed also clears sessions, so a demo reset logs everyone out.
- **Every successful response puts its payload under `data`**, for example `{ "data": { ...user } }`. Lists will add `page`, `pageSize` and `total` (section 6.15). Reason: one shape for single items and lists is easier for the web client.
- **Unexpected errors become `500 INTERNAL_ERROR` without internal details, and are logged.** Client errors from Express itself (for example a body over 100 kB) keep their 4xx status with the code `BAD_REQUEST`. Invalid JSON is `400 MALFORMED_REQUEST`.
- **Modules are built with factory functions** such as `createApp`, `createAuthRouter` and `createAuthService`, which receive `prisma` and other services as arguments. Reason: tests can pass a test database, a fake Prisma client or a different rate limit without mocking imports. It works like Laravel's service container, but by hand.
- **`requireAuth` loads the user from the database on every request.** If the user is gone or inactive, it destroys the session and answers 401. Reason: this is the simplest way to meet "existing sessions are destroyed when they are deactivated" in section 3, at the cost of one small indexed query per request.
- **Login answers the same `401 INVALID_CREDENTIALS` for an unknown email, a wrong password and an inactive user**, and compares against a dummy bcrypt hash when the email is unknown. Reason: an attacker cannot find out which emails exist. The audit row `LOGIN_FAILED` stores the real reason for the admin. For an unknown email, the `entityId` is the email that was tried.
- **Login regenerates the session.** Reason: this prevents session fixation. The cookie is `yardflow.sid`, httpOnly, `SameSite=Lax`, and lasts 8 hours, renewed on every request. It is `Secure` only in production.
- **Validated input is stored on `request.validated`.** Reason: in Express 5 `request.query` is read-only, so the parsed and converted values cannot be written back.
- **The health module has only a routes file.** Reason: it is one query with no business rules, so a controller, service and schema file would be empty.
- **Helmet's `upgrade-insecure-requests` CSP directive is only sent in production.** Reason: Safari applies it to `http://localhost` and breaks local development.
- **Request logs are one line per request (method, URL, status, time).** Swagger UI's static files are not logged. In development the output goes through `pino-pretty`; in production it stays JSON.
- **The login rate limiter keeps its counters in memory.** Reason: the demo runs as a single API instance. Several instances would need a shared store.
- **`.env.example` also lists `NODE_ENV` and `LOG_LEVEL`.**
- **Swagger UI is served at `/api/docs`, and the raw OpenAPI document at `/api/docs/openapi.json`.** A test checks that every documented operation is routed. The full route coverage test from section 9 follows in Phase 8.

## 2026-09-30, Phase 3

- **Every list endpoint uses one helper** for `page` (default 1), `pageSize` (default 25, maximum 100) and `sort=field:asc|desc`. Each list defines its own allowed sort fields. `GET /time-slots?date=` is the one exception: it returns the at most 9 slots of one day as `{ data }` without paging.
- **Boolean query parameters accept only `true` or `false`.** Reason: `z.coerce.boolean()` would turn the string `"false"` into `true`.
- **PATCH bodies are strict.** Unknown fields, including fields that may not change such as a company `code` or a block `code`, answer 422. Reason: a silent ignore would hide mistakes. Codes are not editable because container number prefixes and stored position codes depend on them.
- **An admin cannot deactivate their own account or remove their own admin role** (`409 OWN_ACCESS_PROTECTED`). Reason: without this guard the only admin could lock everyone out of user management.
- **Deactivating a user deletes their session rows at once.** A session row is found by its `"userId":N` text and confirmed by parsing the JSON, so user 1 never matches user 12. `requireAuth` still checks on every request as a second line of defence.
- **A customer of a deactivated company counts as inactive:** they cannot log in (`LOGIN_FAILED` reason `INACTIVE_COMPANY`), and deactivating the company ends their sessions. Reason: `Company.isActive` exists in the schema, and this is the simplest meaning for it.
- **`PATCH /tariffs` identifies the tariff by `size` and `isDangerous` in the body**, because the spec lists `PATCH /tariffs` without an id. Changes only affect invoices issued afterwards.
- **A block's type and size class can only change while it is empty (`409 BLOCK_NOT_EMPTY`).** Reason: otherwise existing stacks could break the stacking rules. Shrinking is refused with `409 BLOCK_SHRINK_CUTS_STACKS` and lists every position that would be cut.
- **Block limits: rows and bays 1 to 99, maximum tier 1 to 9.** Reason: position codes use two digits for row and bay and one for the tier.
- **Time slots are created on the first read of a day from today up to 14 days ahead**, with `createMany(skipDuplicates)`, so two requests at once cannot create duplicates. Past days are only read, never created. Dates more than 14 days ahead answer 422.
- **"Active bookings" for the capacity rule means `ACTIVE` plus `USED` pre-advices**, the same count that makes a slot full (section 6.6). Changing capacity locks the slot rows with `SELECT ... FOR UPDATE` inside the transaction, so a booking cannot slip in between the check and the update. A whole-day change is all or nothing.
- **Services get the current time from an injected `clock`.** Reason: tests can use a fixed time.
- **Audit `action` names so far: `CREATE`, `UPDATE`, `UPDATE_CAPACITY`, `LOGIN`, `LOGOUT`, `LOGIN_FAILED`.** Business actions from later phases add their own names, such as `GATE_OUT_DENIED`.

## 2026-09-30, Phase 4

- **`WorkOrder` has a new required field `targetContainerId`** (relation `RelocationTarget`), with an index on `(targetContainerId, status)`. The existing relation to the moved container is now named `MovedContainer`. Reason: section 6.5 refuses a gate-out or load "while any work order in its group is OPEN", but the schema had no link from a group to the container it clears the way for.
- **Asking for relocation work orders for a container that already has an open group returns that group** instead of creating a second one. Reason: the gate-out check (Phase 6) can run several times for the same truck.
- **Every write that changes positions locks the affected `Block` rows** (`SELECT ... FOR UPDATE`, in id order) and runs with `READ COMMITTED` isolation. Reason: a test with two moves into the same empty stack found two problems. Locking only the empty stack range caused a MySQL deadlock (both transactions take a shared gap lock). And with the default `REPEATABLE READ`, the second move kept reading its old snapshot after the lock was released. Block locks serialise moves within a block, which is fine for one terminal. The unique index on position is still the last line of defence (`409 SLOT_TAKEN`).
- **A move target may be a stack (`B-02-05`) or a full position (`B-02-05-2`).** The tier is always the stack height plus one. A given tier that does not match answers `409 STACKING_RULE_BROKEN` with the TIER rule.
- **A broken stacking rule answers `409 STACKING_RULE_BROKEN`.** The message joins the English rule texts, and `details` lists each rule with a code (`BLOCK_TYPE`, `SIZE_CLASS`, `OUT_OF_BLOCK`, `STACK_FULL`, `SIZE_ON_TOP`, `TIER`). An unknown block in a move answers 422, because it is an input error, not a business rule.
- **The blocked message uses correct English for one blocker:** "Container is blocked by 1 container above it".
- **A planned relocation slot counts as no longer valid** when its stack now breaks a stacking rule or its next free tier differs from the planned tier. The next best slot then comes from the suggestion algorithm, excluding the source stack. The audit entry `COMPLETE` stores `plannedTo`, `toPosition`, `replanned` and the reason.
- **Slot suggestions from the API add `maxTier`** to the fields from section 8.2, so the web can draw the stack indicator without another request. The pure algorithm returns exactly the section 8.2 fields.
- **`POST /yard/suggestions` takes `size`, `loadStatus`, `isDangerous` and an optional `ownerCompanyId`.** Without an owner, the "same owner below" bonus never applies.
- **Customers see container detail without staff details:** no user names on holds or history, and no work orders. Another company's container answers 404.
- **Container lists and details add `displayNumber` (`HNFU 204571 1`) and `dwellDays`.** Dwell days are rounded up from gate-in to now, with a minimum of 1, and are null when the container is not in the yard.
- **Services publish `yard:changed` and `workorder:changed` on an in-process event bus after the transaction commits.** Phase 7 connects Socket.IO to this bus, so services never know about sockets.
- **`packages/shared` now depends on `zod`** and exports `containerNumberSchema`, so the API and the web validate container numbers with the same code and the same messages.

## 2026-09-30, Phase 5

- **The CSV import takes the file content as the request body with `Content-Type: text/csv`** (up to 1 MB), not as a multipart upload. Reason: no upload library is needed, Swagger UI can send it, and the web can read the file and post its text. `csv-parse` reads the file; it comes from the same project as `csv-stringify`, which the spec names.
- **CSV columns may come in any order.** Booleans accept `true/false`, `yes/no` or `1/0`, and empty `imoClass` or `grossWeightKg` means none. Every problem is reported as `{ line, field, message }`, with the header on line 1. If any line fails, whether on format, duplicates in the file or database checks, nothing is imported.
- **The same row rules apply to the form (`POST /items`) and the CSV import.** A dangerous item needs an IMO class like `3` or `2.1`, and a non-dangerous item must not have one. Gross weight is 1,000 to 60,000 kg when given. The owner company must exist and be active. The same container cannot be twice on one list of a visit. A discharge item cannot be a container that is already in the yard.
- **Adding a discharge item creates its container as `EXPECTED`** (section 6.2). A departed container is reused and reset to `EXPECTED` with the new data. A load item is linked to its container if it exists; the container must be `IN_YARD` only when the load is confirmed.
- **Cargo can be confirmed only while the visit is `ARRIVED` or `WORKING`.** The first confirmation moves `ARRIVED` to `WORKING`. `WORKING` cannot be set by hand. The only manual changes are `PLANNED` → `ARRIVED` and `ARRIVED`/`WORKING` → `DEPARTED`. After departure, the visit and its lists cannot change.
- **"Depart with open items" is the flag `departWithOpenItems: true` on `PATCH` with `status: DEPARTED`.** It writes an extra audit entry `DEPART_WITH_OPEN_ITEMS` with the number of pending load items. Only pending load items block departure, as section 6.12 says.
- **Discharge accepts any stack or position that passes the stacking rules, not only one of the current top 3.** Reason: the top 3 can change between showing and confirming. The web shows the suggestions from `POST /yard/suggestions`, and the stacking rules still protect the yard.
- **A blocked load answers `409 RELOCATION_PENDING` ("Waiting for 2 relocations") with the work orders in `details`.** The work orders are committed before the answer, and asking again returns the same group. The load succeeds once the group is done.
- **A discharge notification (`CONTAINER_IN_YARD`) is stored in the same transaction as the discharge**, and `notification:new` is published after the commit. Listing and reading notifications follow in Phase 7.
- **The discharge movement has no `fromPosition` and the load movement has no `toPosition`**, because the other end is the vessel, not a yard position.

## 2026-09-30, Phase 6

- **Only customers create pre-advices and regenerate PINs; Admin and Customer can list and cancel.** Reason: section 3 says "Create pre-advice and book time slot: Customer only", which is more specific than the `A C` in the section 9 table.
- **Truck plates are stored and compared normalised** (trimmed, uppercase, single spaces), and driver names are compared trimmed and case-insensitively. The helpers live in `packages/shared`.
- **A delivery pre-advice creates or reuses its container as `EXPECTED` with the company as owner.** A container already `EXPECTED` for another company answers `409 CONTAINER_NOT_AVAILABLE` without naming that company. A pickup of another company's container answers 404.
- **Booking locks the slot row (`SELECT ... FOR UPDATE`, `READ COMMITTED`) before counting `ACTIVE` plus `USED` bookings.** Two customers can therefore never take the last place at the same time. The rules are the pure function `bookingProblem` (section 8.6).
- **Reference and invoice numbers (`PA-YYYYMMDD-NNNN`, `INV-YYYY-NNNNN`) are the count for the day or year plus one.** The unique index catches the rare case of two bookings at the same moment, and the whole transaction is retried up to 3 times.
- **The PIN comes from `crypto.randomInt`, is stored only as a bcrypt hash, is returned once in the create or regenerate response, and never appears in an audit entry.**
- **Truck verification is remembered in the session for 30 minutes**, per pre-advice. `/gate/in`, `/gate/out/check` and `/gate/out` refuse a pre-advice that this session has not verified (`409 TRUCK_NOT_VERIFIED`). Reason: the PIN cannot be skipped by calling the later steps directly, and the client never has to resend it.
- **Wrong PINs:** each wrong PIN answers `409 PIN_MISMATCH` with the attempts left and is audit logged (`GATE_PIN_FAILED`, without the PIN). The fifth within 15 minutes locks the plate for 15 minutes (`429 PLATE_LOCKED`). Like the login limiter, the counter is in memory. `/gate/verify-truck` also has an IP rate limit of 60 checks per 15 minutes.
- **Gate lanes are 1 and 2**, as drawn on the map in `docs/DESIGN.md`.
- **The gate-out check always answers 200 with the four check results**, because a denied truck is a normal outcome, not a request error. A failed check writes `GATE_OUT_DENIED` and emits a `DENIED` gate event. Completing a gate-out runs the checks again and answers `409 GATE_OUT_DENIED` or `409 RELOCATION_PENDING` if something changed.
- **A truck later than its paid period (check 4):** an outdated `UNPAID` invoice is voided and a new invoice is issued for the whole stay. For an outdated `PAID` invoice, an extra invoice is issued from its `periodTo` for the extra chargeable days only (`calculateExtensionFee`). In both cases the new invoice runs to the end of the gate window (slot end plus tolerance), and it is paid at once when the amount is 0.
- **Pre-advices expire when slot end plus tolerance has passed.** This runs every 5 minutes in `server.js`, and before reading pre-advices or verifying a truck. Expired pickups cancel their open relocation work orders, notify the company (`PRE_ADVICE_EXPIRED`), and write an audit entry `EXPIRE` without a user.
- **Cancelling a pickup cancels its open relocation work orders** (section 6.5). Its storage invoice stays as it is, because the spec does not say otherwise.
- **The gate-in movement and the gate transaction share the same timestamp**, so the EIR finds the position of the transaction without a new column.
- **The EIR is built as a plain data model (`buildEirModel`) and then drawn with pdfkit.** The model is unit tested field by field. The PDF test checks that a valid PDF comes back. The six sides are drawn as an unfolded box, with damaged sides filled in light red.
- **Gate events published so far: `IN`, `OUT`, `DENIED` and `WAITING`.** Socket.IO delivers them in Phase 7.
