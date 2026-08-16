# Contributing

## Getting set up

```bash
npm install
npm run dev
```

Node 20.19+ or 22.12+. There is no backend and no environment configuration required to run the app.

## Before you open a PR

```bash
npm run lint
npm run format:check
npm run typecheck
npm test
npm run build
```

All five must pass. CI runs exactly these, in this order, so a green local run is a good predictor. `npm run format` fixes formatting in place.

Linting is [oxlint](https://oxc.rs), with the React, TypeScript, import, jsx-a11y and Vitest plugins on. `react-hooks/rules-of-hooks` and `react-hooks/exhaustive-deps` are errors — the stale-closure bugs they catch are the kind this codebase is prone to, since the previews are effects driving an imperative renderer.

## Commits

This repo uses [Conventional Commits](https://www.conventionalcommits.org/):

```
feat:     a user-facing capability
fix:      a bug fix
refactor: behaviour-preserving change
docs:     documentation only
test:     tests only
chore:    tooling, dependencies, config
ci:       workflow changes
```

One logical change per commit. Explain _why_ in the body when the change is not self-evident — the diff already covers the what. Reference issues where relevant (`closes #4`).

## Branches and review

Work on a feature branch and open a PR. PRs are squash-merged to keep `main` readable. Do not force-push to `main`.

## Code conventions

- TypeScript is strict; `noUnusedLocals` and `noUnusedParameters` are on.
- Keep pure logic in `src/lib/` so it stays testable without a DOM. Components should render state, not compute it.
- Match the surrounding style. Comments explain intent, not mechanics.

## Design system

The interface follows a fixed specification, and it is deliberately narrow. Before changing anything visual, read `src/index.css` — the tokens are defined there and the rules are enforced by convention, not by a linter:

- The palette is six colours. Do not add a seventh.
- `--signal` is the accent. It marks focus and the primary action, and appears at most three times on screen. Severity in the risk panel is expressed as brightness, not colour, for this reason.
- `--edge` is the only border colour at rest. Borders shift to `--ash` on hover and `--signal` on focus.
- No gradients, no glows. One shadow only: `inset 0 1px 0 rgba(255,255,255,0.03)` as a top edge on panels.
- No border radius above 4px.
- Transitions are 150ms ease-out, on colour and border only. Nothing moves or scales on hover.
- Labels are 11px, uppercase, 0.12em tracking, `--ash`. Values and numbers are JetBrains Mono.
- `--ash` is the floor for readable text and carries most of the secondary copy, so it has to clear 4.5:1 against both `--void` and `--panel`. It was lightened from the original `#6B6D76` for exactly this reason. If you darken it, check both surfaces first.

If a section feels cramped, remove an element rather than shrinking the padding.

## Reporting bugs

For a scanning failure, include the input text, the error-correction level, whether a logo was attached and at what size, the two colours, and the reader you tested with. The combination matters more than any single setting.
