# Contributing to Unstructured-to-Ops Action Agent

Thanks for considering a contribution. This is a solo-maintained project, but it's built and documented as if it weren't — issues, PRs, and questions are genuinely welcome.

## Getting set up

Follow [Getting Started in the README](README.md#️-getting-started) to install dependencies, configure environment variables, and run both apps locally. The short version:

```bash
pnpm install
pnpm dev
```

## Before opening a PR

Run these from the repo root — all three are wired through Turborepo and are the same commands CI runs on every push:

```bash
pnpm run typecheck   # tsc --noEmit across every workspace
pnpm test            # backend unit tests (Jest)
pnpm run lint         # eslint per app
```

A PR that fails any of these won't be merged as-is — please get them green first (or explain in the PR description why not, if there's a good reason).

## What to work on

- Check [open issues](https://github.com/m-ahmedbashir/opp-agent/issues) first. If nothing's filed for what you want to do, open one before sending a large PR, so we can agree on approach before you invest the time.
- The README's [Roadmap](README.md#-roadmap) section lists concrete, scoped next steps — each one there is deliberately sized to be a single PR, not an epic. Good starting points if you're looking for something approachable:
  - Add a `typecheck`/`test` GitHub Actions status badge once CI has run a few times (cosmetic, low-risk, good first PR).
  - `generateObject`/`streamObject` in place of the manual `JSON.parse` in `extraction.service.ts`.
  - A provider-agnostic model registry so extraction isn't hard-wired to Groq.
- Found a bug that isn't in [Known Limitations history](README.md) or the Roadmap? Open an issue with repro steps — a failing test that demonstrates it is even better.

## Code style

- TypeScript everywhere; keep new code typed as strictly as the surrounding file already is — avoid introducing new `any` where the existing code has real types.
- Match the existing pattern in a file rather than introducing a new one (e.g. NestJS services stay thin, Zod schemas stay `.strict()`, React components stay in the existing feature-folder structure).
- Prettier handles formatting (`pnpm --filter frontend format`, `pnpm --filter backend format`) — don't hand-format around it.
- No enforced commit message convention yet — just write a message that explains *why*, not just *what*.

## Reporting a security issue

Please don't open a public issue for anything that looks like a real vulnerability (auth bypass, PII leak, secret exposure). Email the maintainer directly instead — contact details are on the [GitHub profile](https://github.com/m-ahmedbashir).

## Code of Conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). Be respectful; disagreements about code are fine, disrespect toward people isn't.
