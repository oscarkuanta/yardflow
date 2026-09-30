# YardFlow: Working Rules for Claude Code

YardFlow is a container yard management system for one container terminal. It is a portfolio project for a German IT apprenticeship application (Fachinformatiker Anwendungsentwicklung). The owner is a junior developer who knows PHP Laravel and MySQL well and is learning Node.js with this project.

The full specification is in `docs/SPEC.md`. The visual design is in `docs/DESIGN.md`. Read both before you start any phase. When the spec and your own idea disagree, follow the spec. When the spec is silent, choose the simplest solution that a junior developer can explain in an interview, and write the decision into `docs/DECISIONS.md`.

## Hard rules

1. **English only.** All UI text, code, identifiers, commit messages, API messages, seed data and docs are in English. No German, no Indonesian, except in `LEARNING.md`.
2. **No code comments.** Do not write `//`, `/* */`, `{/* */}` or JSDoc comments in any source file. Make the code explain itself with clear names and small functions. Config files that require comments to work are the only exception.
3. **JavaScript, not TypeScript.** Use modern ES modules (`"type": "module"`).
4. **Work in phases.** Build exactly one phase from `docs/SPEC.md` section 14 per session prompt. At the end of a phase: run lint and all tests, fix failures, update `LEARNING.md`, update `docs/DECISIONS.md` if you made decisions, make one git commit, then stop and print a short summary plus the exact command to try the result. Do not start the next phase until the owner says so.
5. **Tests are part of the work.** Every business rule in the spec gets a test. Overall coverage stays at or above 80% for `apps/api` and `packages/shared`.
6. **Never skip the algorithm tests** listed in `docs/SPEC.md` section 8. They are the proof that the domain logic works.
7. **Security basics are required**, not optional: bcrypt for passwords and PINs, httpOnly session cookies, Zod validation on every request body and query, role checks on every route, customers scoped to their own company on every query.
8. **Do not invent features** that are not in the spec. Do not add payment gateways, email sending, or German translations.
9. **Keep dependencies lean.** Prefer the libraries named in the spec. Ask before adding a large new dependency.

## LEARNING.md

`LEARNING.md` sits in the repo root and is listed in `.gitignore`. It is the owner's private study guide. After each phase, append a section in simple Indonesian:

- Apa yang dibuat di phase ini
- Penjelasan tiap file penting, satu atau dua kalimat per file
- Konsep baru yang dipakai, dibandingkan dengan padanannya di Laravel jika ada
- 3 sampai 5 pertanyaan interview yang mungkin ditanyakan tentang phase ini, beserta jawaban singkatnya

## Commands the owner expects to work

```
npm install
npm run db:up          # start MySQL in Docker
npm run db:migrate     # apply Prisma migrations
npm run db:seed        # load demo data
npm run db:reset       # drop, migrate and seed again
npm run dev            # API on :4000 and web on :5173 together
npm run lint
npm test               # all unit and integration tests
npm run test:coverage
npm run test:e2e       # Playwright
docker compose up --build   # full stack
```

## Git

- Conventional commits, for example `feat(gate): add gate-out checks`.
- One commit per phase at minimum. Never commit `.env`, `LEARNING.md`, or `node_modules`.
