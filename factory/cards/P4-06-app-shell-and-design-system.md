---
id: P4-06
title: App shell and design system
phase: P4
order: 401
dependsOn: [P0-02]
estimate: 4
station: backlog
status: planned
owner: -
updated: 2026-11-03T08:29:22Z
history:
---

# P4-06 App shell and design system

## Spec

Work package (E2 row): App shell and design system: routes.ts route table with mode resolution (403 reasons wired when P4-01 ships), top bar, banner slot, per-mode rails, context header, command palette; tokens.json pipeline to tokens.css, tokens.ts and viz-palette.json with the stylelint rule; packages/ui core components (ProvenanceLabel, EvidenceRow, EvidenceTable, DcrMeter, ClauseChip, GateBanner, DataTable, FormSection, Toast, InlineAlert, ModeBanner, EmptyState, Skeleton) with states and axe tests

After: P0-02. Size: 4 engineer-weeks. Split into sub-cards at the spec station per E1.

### Draft for the owner's approval (2026-11-17, not approved)

Drafted by a read-only agent (owner's decision of 2026-11-17, `docs/decisions/log.md:39`). Nothing below is approved and no sub-card exists yet. Short names for the sources: RM = `docs/plan/roadmap.md`, UX = `docs/ux/ux-spec.md`, DS = `docs/ux/surfaces/design-system-and-visual-language.md`, IA = `docs/ux/surfaces/information-architecture-and-navigation.md`, LJ = `docs/ux/surfaces/learner-journey.md`, ARCH = `docs/architecture/architecture.md`, I18N = `docs/ops/i18n.md`. UX:5 says the spec's routes, names and vocabulary supersede the surface designs, so DS, IA and LJ are cited only where UX is silent. ADR 0001 and ADR 0002 say nothing on the shell, the tokens, `packages/ui`, the test tooling or the Next.js version (a search of both files for those words returns no line); they bear on this row only through UX (R16 parity, R11 release, and A9, which makes the Teach rail's Integrity item v1.1, UX:38).

What exists today (`git ls-files apps/web packages e2e`): `apps/web` with one page `/`, a health route, `src/i18n.ts` and `src/sha.ts`; `packages/i18n` (catalog, `t()`, pseudo-locale, string lint); `packages/units`; `e2e/smoke.spec.ts`. There is no `packages/ui`, no stylesheet, no `routes.ts`. `apps/web` has no `test` script. `docs/ux/tokens.css` (38 lines, "v1.1") holds the token values and names its source as `packages/ui/tokens/tokens.json` (`docs/ux/tokens.css:2`), a file that does not exist yet.

#### 1. Row acceptance criteria

Each criterion quotes the phrase of the E2 row it covers (RM:317). Package name `@bridle/ui` is assumed, after `@bridle/i18n`. The commands depend on open question Q3 (test tooling); they are written for its recommended option.

1. "routes.ts route table": `apps/web/src/routes.ts` (the path IA:18 proposes) holds one entry for every route UX:44-49 marks MVP, each with its mode (Learn, Teach, Author, Admin, Operate or global), its scope requirement, an MVP flag and a title message id, and is the one source for breadcrumbs, the palette's Navigate group, deep-link mode resolution and 403 reasons (UX:9). Test: `pnpm --filter web test` runs `src/routes.test.ts`, which holds the route list of UX:44-49 as literal fixture data and fails on a missing, extra or duplicate entry; every v1.x route of UX:44-49 resolves to "not found".
2. "with mode resolution": a pure function resolves a path to `{mode, org, params, breadcrumb}`; "Deep links set the mode from the URL" (UX:51). The same test asserts one path per mode, the `/ops` paths (UX:49) and the two links of UX:51 (a review link resolves to Teach, a grade link to Learn). Which modes a user holds is an input of the function, supplied by a fixture in this row.
3. "(403 reasons wired when P4-01 ships)": each route entry carries its scope requirement and the table exposes one typed seam `denyReason(route, caller)` returning a message id; the `/403` page (UX:44) renders the reason it is given and links to the user's own home (UX:285, IA:119). The seam is driven by fixtures here; calling the real `authorize()` is not in this row (Q11). Test: the routes test, plus the `/403` case of the shell e2e.
4. "top bar": hamburger, product mark, mode switcher "listing only held modes", organization switcher, breadcrumb, search field opening the palette, help, bell, account menu (UX:36); a single-mode user sees a static label (IA:111). Help, bell and account menu are buttons without their panels (Q12). Test: `pnpm --filter web test` (render tests with fixtures for one-mode and five-mode users) and the shell e2e.
5. "banner slot": one 40 px slot showing "one at a time by priority" (UX:19, UX:36) a `ModeBanner` from a fixture list of active conditions, in the order of DS:552; the conditions that order does not place are Q8. Test: `pnpm --filter web test` asserts the chosen banner for each pair of conditions in the fixture.
6. "per-mode rails": five rails with the items of UX:38 (Learn, Teach with the TA variant, Author) and of IA's rail list for Admin and Operate (UX:38 defers to "section 8", which lists tiles, not rail items: Q9); 240 px, 56 px icon rail at 1024-1279, drawer below 1024 (UX:36); every item's href comes from `routes.ts`. Test: render tests per mode, and the shell e2e at 1280, 1100 and 800 px widths.
7. "context header": entity name, term, scope badge, pinned pack and units, primary action and entity navigation as "a `nav` of links styled as tabs with `aria-current=\"page\"`" (UX:36), from fixture data. Test: render test asserting the `nav`, the links and no `role=tablist`.
8. "command palette": opens on Ctrl/Cmd+K and from the search field (UX:36, UX:51), lists a Navigate group built from `routes.ts` filtered by held modes (UX:9), Enter navigates, Esc closes and returns focus. Other groups (IA:987) need data of later rows and are out (Q10). Test: render test and the shell e2e keyboard walk.
9. The shell frame around parts 4 to 8 (the row's title, "App shell"): landmarks and a skip link, "main with the h1 focused on route change" with a polite title announcement, footer with the educational-use notice (UX:36, UX:266). Test: the shell e2e asserts focus on the h1 after a navigation and the landmark set.
10. "tokens.json pipeline to tokens.css, tokens.ts and viz-palette.json": `packages/ui/tokens/tokens.json` is the only editable source (DS:84); one command writes the three outputs, which are committed; a drift test fails when an output is older than its source. The generated `tokens.css` declares the same custom properties with the same values, per selector, as `docs/ux/tokens.css` (Q5). `viz-palette.json` holds the `--viz-*` values and the palette version (`docs/ux/tokens.css:6-10`, DS:84). Test: `pnpm --filter @bridle/ui test` (`tokens.test.ts`).
11. "with the stylelint rule": "stylelint forbids raw hex and primitives" (UX:250) in component styles of `packages/ui` and `apps/web`; the rule has one failing and one passing fixture, and `pnpm lint` (so `pnpm check` step 1) fails on a raw hex or a primitive token such as `var(--gray-500)`. Test: `pnpm --filter @bridle/ui test` (`stylelint-rule.test.ts`) and `pnpm lint`.
12. "packages/ui core components (ProvenanceLabel, EvidenceRow, EvidenceTable, DcrMeter, ClauseChip, GateBanner, DataTable, FormSection, Toast, InlineAlert, ModeBanner, EmptyState, Skeleton)": all thirteen are exported from `@bridle/ui`, style only through semantic, canvas, viz, density and component tokens (UX:250), and take every user-facing string from `packages/i18n` (I18N, "every user-facing string"). Test: `pnpm --filter @bridle/ui test` holds the thirteen names as a literal list and fails when one is not exported.
13. "with states": each component has a states file listing its variants and states, and one test case per listed state. The list per component is in section 3 with its source line; where UX:258 and the component tables disagree or are silent it is Q7. Test: `pnpm --filter @bridle/ui test` fails when a listed state has no test case.
14. "and axe tests": every listed state of every component, rendered in light and dark themes, passes axe-core with zero violations of impact serious or critical (the bar of UX:266, "axe zero serious or critical"). Test: `pnpm --filter @bridle/ui test`; a second pass in a real browser over the gallery page (sub-card .22) covers colour contrast, which jsdom cannot compute.
15. Strings: `pnpm lint` passes with the string lint also reading `packages/ui/src` and with `apps/web/i18n-allowlist.json` still `{ "allow": [] }` unless an entry carries its reason (I18N, "The allowlist"); the pseudo-locale run of the shell e2e (`NEXT_PUBLIC_LOCALE=en-XA`, I18N) shows no plain-English string.
16. The row closes on: `pnpm check` 7/7, `pnpm e2e:smoke` green with the new shell spec and screenshots attached under `## Test` (RM:367, cards touching apps/web), and the proof M-B needs from this row being in place: a shell that P3-01 can mount a workspace route in (RM:311, RM:349).

#### 2. The split

24 sub-cards, 20.4 engineer-days against the row's 4 engineer-weeks (20 days). "Changes" is the one package or app; "Lane" is from `factory/lanes.json`. "Group" marks file-disjoint sets: sub-cards in different groups share no source file except the two message catalogs and the lockfile (risks 2 and 3). Under RM:276 at most one card runs per lane, so groups U and W (both lane web) can run at the same time only if the owner allows two web worktrees (Q14); C and P can always run beside web.

| Sub-card | Title | Changes | Lane | Depends on | Days | Test command | Row criteria | Group |
|---|---|---|---|---|---|---|---|---|
| P4-06.1 | Dependencies and root wiring for the row | root workspace files | core (Q1) | P0-02 | 0.5 | `pnpm install --frozen-lockfile && pnpm check` | enables 10-14 | C |
| P4-06.2 | Retire the "deliberately plain" case of the web test | `tools/test` | platform | P0-02 | 0.2 | `bash tools/test/web.test.sh` | enables 4-9 | P |
| P4-06.3 | tokens.json and its generator | `packages/ui` | web | .1 | 1 | `pnpm --filter @bridle/ui test` | 10 | U |
| P4-06.4 | routes.ts: route table, mode resolution, 403 seam | `apps/web` | web | .1 | 1 | `pnpm --filter web test` | 1, 2, 3 | W |
| P4-06.5 | Stylelint rule and token contrast test | `packages/ui` | web | .3 | 1 | `pnpm --filter @bridle/ui test` | 11 | U |
| P4-06.6 | String lint: the five carried findings, and `packages/ui` in scope | `packages/i18n` | web | .1 | 0.8 | `pnpm --filter @bridle/i18n test` | 15 | I |
| P4-06.7 | Component harness, base styles, Skeleton, EmptyState | `packages/ui` | web | .5, .6 | 0.8 | `pnpm --filter @bridle/ui test` | 12-14 | U |
| P4-06.8 | InlineAlert and ModeBanner | `packages/ui` | web | .7 | 0.8 | same | 12-14 | U |
| P4-06.9 | Toast and its region | `packages/ui` | web | .7 | 1 | same | 12-14 | U |
| P4-06.10 | ProvenanceLabel and ClauseChip | `packages/ui` | web | .7 | 0.8 | same | 12-14 | U |
| P4-06.11 | DcrMeter and GateBanner | `packages/ui` | web | .8 | 1 | same | 12-14 | U |
| P4-06.12 | EvidenceRow | `packages/ui` | web | .10, .11 | 0.8 | same | 12-14 | U |
| P4-06.13 | EvidenceTable | `packages/ui` | web | .12 | 1 | same | 12-14 | U |
| P4-06.14 | DataTable: table pattern | `packages/ui` | web | .7 | 1 | same | 12-14 | U |
| P4-06.15 | DataTable: grid contract and virtualization | `packages/ui` | web | .14 | 1 | same | 12-14 | U |
| P4-06.16 | FormSection | `packages/ui` | web | .8 | 0.7 | same | 12-14 | U |
| P4-06.17 | Shell frame: landmarks, skip link, focus, footer, 403 and 404 | `apps/web` | web | .2, .4, .7 | 1 | `pnpm --filter web test` | 9, 3 | W |
| P4-06.18 | Top bar with mode and organization switchers | `apps/web` | web | .17 | 1 | same | 4 | W |
| P4-06.19 | Per-mode rails | `apps/web` | web | .17 | 1 | same | 6 | W |
| P4-06.20 | Banner slot and context header | `apps/web` | web | .17, .8 | 1 | same | 5, 7 | W |
| P4-06.21 | Command palette (Navigate group) | `apps/web` | web | .18 | 1 | same | 8 | W |
| P4-06.22 | Component gallery page and the browser axe pass | `apps/web` (with `e2e/`) | web | .16, .13, .15, .9 | 0.8 | `pnpm e2e:smoke` | 14 | W |
| P4-06.23 | Documents: tokens, components, i18n limits, pins | `docs/` | core | .22 | 0.5 | `bash tools/test/docs.test.sh` | supports 10, 11, 15 | C |
| P4-06.24 | Shell e2e and the row's acceptance | `e2e/` | web | all | 0.7 | `pnpm e2e:smoke` | 16, and re-runs 1-15 | last |

Order on a single line: as numbered (tokens .3 and the route table .4 right after the two enabling cards). Longest chain: .1, .3, .5, .7, .8, .11, .12, .13, .22, .23, .24.

#### 3. Per sub-card

**P4-06.1 Dependencies and root wiring.** What: creates the manifests `packages/ui/package.json` and the new entries of `apps/web/package.json` with every dependency the row needs (exact pins, chosen at the plan station: the vitest already used by `packages/i18n`, a DOM environment, a React testing library, axe-core and its Playwright binding, stylelint), regenerates `pnpm-lock.yaml`, and adds to the root `lint` script a step that runs each package's `lint:css` script when it has one (a no-op until .5). Accept: `pnpm install --frozen-lockfile` and `pnpm check` 7/7; no later sub-card of the row changes `package.json`, `pnpm-lock.yaml` or `turbo.json`; the TypeScript pin of `packages/ui` follows Q6. Files: `package.json`, `pnpm-lock.yaml`, `packages/ui/package.json` and `tsconfig.json`, `apps/web/package.json`. Out: any source file. This card writes two web-lane manifests from the core lane: Q1.

**P4-06.2 Retire the "deliberately plain" case.** What: `tools/test/web.test.sh` has a `plain` case (lines 467-496) that fails when `apps/web` holds a stylesheet, a `.module.*` file or a `components` directory, or when `/` holds `<nav`, `<header`, `<footer`, `<button` or `<a `; it was P0-02.5's criterion 3 ("No design-system work (P4-06) and no shell"). Accept: the case is removed or narrowed to what stays true, its header and usage line agree, the other three cases pass. Files: `tools/test/web.test.sh`, `README.md` only if the label of `tools/test` changes (then core: say so at plan). Out: the smoke spec.

**P4-06.3 tokens.json and its generator.** What: `packages/ui/tokens/tokens.json` authored from `docs/ux/tokens.css`, a generator script, the three committed outputs. Accept: criterion 10; a viz value change without a `--viz-palette-version` bump fails the test (DS:1033, `docs/ux/tokens.css:6`). Files: `packages/ui/tokens/*`, `packages/ui/scripts/tokens.*`, `packages/ui/src/tokens.ts`, `tokens.test.ts`. Out: the renderer that reads `viz-palette.json` (P3-02), the token sheet page (DS:26, Q13), `docs/ux/tokens.css` itself (core lane).

**P4-06.4 routes.ts.** What and accept: criteria 1 to 3; adds the `test` script of `apps/web`. Files: `apps/web/src/routes.ts`, `routes.test.ts`, `apps/web/package.json` scripts only if .1 did not add it. Out: page files, the permission matrix and `authorize()` (P4-01, RM:318), the tenant prefix decision (Q15).

**P4-06.5 Stylelint rule and token contrast test.** What: the stylelint configuration with the rule of criterion 11 and its two fixtures, the `lint:css` script; a test computing contrast for the pairs of DS:835 in both themes (4.5:1 text, 3:1 large text and glyphs, UX:266). Accept: criterion 11; the contrast test passes or lists failing pairs for the owner (Q16). Files: `packages/ui/stylelint.config.*`, `packages/ui/lint/*`, `packages/ui/src/contrast.test.ts`. Out: CVD simulation and visual regression (DS:1032; not in the row text).

**P4-06.6 String lint.** What: picks up what P0-02.6's `## Ship` left "for the app-shell row (P4-06), before the first real screens": the three ways past the lint (a one-word constant through a named property; a string in a JSX attribute outside the nine names; the first argument of any call named `t`) and the two false positives (entity-only JSX text; an element-access key); adds `packages/ui/src` to what the lint reads (I18N "Limits": strings from another package "are not scanned"); adds the non-empty guard of advisory A3. Also applies the owner's answer on whether "Bridle" stays untranslated (Q17). Accept: one failing fixture per closed gap, one passing fixture per false positive, `pnpm lint` green. Files: `packages/i18n/lint/*`, `packages/i18n/src/*`. Out: `docs/ops/i18n.md` (core lane, sub-card .23; Q2).

**P4-06.7 Harness, base styles, Skeleton, EmptyState.** What: the test setup (render, axe helper, the states-file convention of criterion 13), base stylesheet with the focus ring, theme and density attributes of `docs/ux/tokens.css`, how a component gets `t()` (plan decides: a bound import or a provider), and the two smallest components. States: Skeleton row, card, canvas, "shimmer disabled under reduced motion" (DS:1078); EmptyState "one sentence plus one action" (UX:285). Accept: criteria 12 to 14 for these two. Files: `packages/ui/src/{test,styles,Skeleton,EmptyState}/*`, `src/index.ts`, catalog. Out: Button and the other components of UX:256 that the row does not name.

**P4-06.8 InlineAlert and ModeBanner.** States: InlineAlert info, success, warning, danger, with and without actions (DS:1063); ModeBanner exam, preview-as-learner, view-as, impersonation with countdown and End session, offline, degraded AI, staff live view, read-only tenant (DS:1064), plus the pure priority function of DS:552. Out: the slot (.20), the countdown's server sync (P5-06, RM:329).

**P4-06.9 Toast.** States: info, success, warning, danger; single action; "8 s with an action, 5 s informational, paused on hover and focus, maximum three; danger toasts persist" (UX:260); role status, danger role alert, Esc closes (DS:565). Accept: timers tested with a fake clock. Out: F6 region cycling (F6 is on the denylist of UX:103; DS:565 contradicts it: Q7).

**P4-06.10 ProvenanceLabel and ClauseChip.** States: ProvenanceLabel, one per string of UX:273 including the dense-cell form; ClauseChip validated, link-out only, unverified, inline-in-prose (DS:1046) with the text form of UX:276. Out: the help panel the chip opens (P7-03, RM:341): the chip takes an `onOpen` handler.

**P4-06.11 DcrMeter and GateBanner.** States: DcrMeter cell and card; pass, tolerance 1.00-1.02, over, over beyond 1.20, unverified, not applicable, stale (DS:1049), 2 decimals with the third-decimal rule (UX:275); GateBanner cap 50, cap 75, fail task, none (LJ:1354) with the copy of UX:280. Out: live data.

**P4-06.12 EvidenceRow.** States: pass, warn, fail, error, not applicable, entity missing (LJ:1352); content order of UX:109 (status word first, subject, metric with unit against limit, governing combination, ClauseChip, Show, Why?, Fix). Accept: props are a local view type, not the GradeEvidence schema (Q18). Out: disclosure levels (P3-04).

**P4-06.13 EvidenceTable.** States: compact and default; loading, empty, error, partial (judged pending), unverified rows, stale header, selected row (DS:1051). Out: virtualization above 200 rows unless .15 has shipped; canvas selection sync (P3-04).

**P4-06.14 DataTable, table pattern.** States: loading skeleton, empty, error, sort, sticky header, selection with counts in the button label (IA:1430). Out: CSV export, row drawer, filters backed by a server.

**P4-06.15 DataTable, grid contract.** What: the one grid contract of UX:117 and UX:266 ("arrows move cells, Tab and Shift+Tab leave the composite, Enter or F2 edits, Esc cancels, Ctrl+Enter adds a row, Space selects, Delete removes with confirmation"), virtualized above 200 rows (`--table-virtualize-rows`, `docs/ux/tokens.css:38`). Accept: a keyboard test per key. Out: the workspace's TabularEditorGrid (P3-01).

**P4-06.16 FormSection.** States: complete, incomplete, invalid with count, not applicable (DS:1060). Out: ValidationRail and InlineValidation (named in UX:256, not in the row).

**P4-06.17 Shell frame.** What and accept: criterion 9; a catch-all under `/o/[org]` and `/ops` that resolves through `routes.ts` and renders a placeholder (EmptyState) or 404; `/403` and `/404` pages. The page at `/` stays as it is (Q17). Files: `apps/web/src/app/**` layouts, `apps/web/src/shell/AppShell.*`. Out: any real screen.

**P4-06.18 Top bar.** Criterion 4. Files: `apps/web/src/shell/{TopBar,ModeSwitcher,OrgSwitcher,Breadcrumb}.*`. Out: help panel, notification tray, account settings, the workspace's own task header (UX:36 last sentence; P3-01).

**P4-06.19 Per-mode rails.** Criterion 6; collapse state kept per user in local storage (IA:95 says "persisted per user"; server-side preference is silent, so local only). Out: counts from live data (fixtures here).

**P4-06.20 Banner slot and context header.** Criteria 5 and 7. Out: the sources of the conditions (incidents P7-01, exam P5-06, read-only tenant P4-01).

**P4-06.21 Command palette.** Criterion 8. Out: the groups of IA:987 other than navigation, `/search?q=`, workspace commands and the shortcut registry `commandBus.ts` (Q10).

**P4-06.22 Gallery and browser axe pass.** What: one page in `apps/web` rendering every state of the thirteen components from their states files, and an e2e spec running axe on it in light and dark and once in `en-XA`. Accept: zero serious or critical; screenshots under `.bridle/screenshots/`. Out: the design-system reference site (Q13).

**P4-06.23 Documents.** What: `docs/ops/i18n.md` (its "Limits" and scope after .6), a short `docs/ops/ui.md` (tokens command, the stylelint rule, the states-file convention), `docs/ops/toolchain.md` if a pin is typed in a new place, and the list for the owner of what the architecture's section 16 lacks (`packages/i18n`, carried from P0-02.6). Out: edits to `docs/ux` and `docs/architecture`.

**P4-06.24 Shell e2e and the row's acceptance.** What: `e2e/shell.spec.ts`: a deep link per mode, the keyboard walk (skip link, palette, rail), widths 1280x720, 1100 and 800, axe on the shell, the `en-XA` run, screenshots. Accept: criterion 16 and a table in `## Ship` of the row card mapping each quoted deliverable to its sub-card. Out: anything a later row owns.

#### 4. Manual gates

The documents require none for this row: UX:266 puts the manual NVDA and VoiceOver passes at the release gate (P7-05, RM:343), and RM:375 has the owner look at the rendered UI once per phase close, not per row. Proposed, for the owner to accept or strike:
- P4-06.24: `owner-look` : the owner has looked at the shell screenshots (five modes, light and dark) and the gallery page. Reason: this row fixes the look every later screen inherits, and no command judges it.
- No accessibility sign-off gate here; a keyboard-only pass is automated in .24. If the owner wants a screen-reader pass on the shell before screens are built on it, it is a second gate on .24 (about one hour by hand).

#### 5. Open questions for the owner

Q1. Dependencies against lane ownership. `factory/lanes.json` gives `package.json` and `pnpm-lock.yaml` to core and `apps/web/`, `packages/ui/` to web; `tools/factory/lane-check.sh` has no exception for the lockfile; RM:276 says both "a card needing another lane's files splitting that change into a sub-card in that lane which ships first" and "lock files regenerated at ship and never hand-merged". A dependency needs the manifest (web) and the lockfile (core) in one commit. Options: (a) one core sub-card per row writes all manifests and the lockfile, with the web manifests named as an allowed exception (this draft, .1); (b) lane-check allows `pnpm-lock.yaml` in any lane when it is regenerated; (c) dependency cards run in the main checkout outside lanes. Recommendation: (a) now, (b) as a P0-08 follow-up. With (b), .1 shrinks to the root `lint` step and each sub-card adds its own dependency.
Q2. Documents against lane ownership. `docs/` is core; I18N says a wider exemption in the lint script "changes this document with it", and the script is web. Options: (a) one core documents sub-card near the end (.23), accepting that `docs/ops/i18n.md` is behind the script between .6 and .23; (b) allow a web card to change `docs/ops/`. Recommendation: (a). With (b), .23 disappears and its half day spreads over .3, .5 and .6.
Q3. Test tooling for components and axe. The documents name axe-core in CI (DS:849, UX:266) and nothing else; ARCH is silent. Options: (a) vitest with a DOM environment, a React testing library and axe-core, inside `pnpm check`; (b) Playwright only, against a gallery page; (c) both: (a) for every state on every card, (b) once in .22 for what a DOM emulation cannot compute (contrast, focus visibility, layout). Recommendation: (c). Actions does not run Playwright today (P0-02.5 `## Ship`, open question 3; P0-09 brings browsers, RM:291), so under (b) alone no criterion of the components would be held in CI. With (a) alone, .22 drops (0.8 day) and contrast is held only by the token test of .5.
Q4. Styling technology and the stylelint rule. The row and UX:250 name stylelint; the repository lints with Biome (`package.json` `lint`); no document names how components are styled. Options: (a) CSS Modules (built into Next.js, no dependency) with stylelint and a small custom rule; (b) a utility framework mapped to the tokens; (c) a script in the style of `lint-strings.mjs` instead of stylelint. Recommendation: (a), stylelint as the row says. (b) adds a dependency and changes every component card; (c) departs from the row text.
Q5. Token generator and what `docs/ux/tokens.css` is. Options for the generator: (a) a small Node script in `packages/ui` with a drift test, as `packages/i18n/scripts/pseudo.mjs` does; (b) Style Dictionary. Recommendation: (a): three outputs of one flat file do not need a framework. For the document: (a) `docs/ux/tokens.css` is the fixture the generated file must equal in declarations (this draft); (b) it is replaced by a pointer to the generated file (a core-lane edit in .23). Recommendation: (a) for this row.
Q6. Next.js 15 with TypeScript 6.0.3 against Next.js 16 with one TypeScript (carried from P0-02.5 and P0-02.6 `## Ship`). ARCH:65, ARCH:85 and ARCH:329 say Next.js 15; `apps/web` and `packages/i18n` pin TypeScript 6.0.3 and `packages/units` 7.0.2. `packages/ui` is compiled by Next.js as source, so it becomes a third 6.0.3 pin. Options: (a) stay, pin `packages/ui` at 6.0.3 in .1; (b) move to Next.js 16 and one TypeScript in a core sub-card before .1 (about 0.5 day, plus an architecture amendment). Recommendation: decide now, because every card of this row adds code under the pin; (a) unless the owner wants the amendment. I could not check Next.js 16 against this code. Picked up by .1.
Q7. Component states. UX:258 says "Every component defines default, hover, focus-visible (double ring), disabled with reason, loading, empty, error; data components add stale, pending, unverified and changed-since-graded", but does not say which components are data components, and most of the seven base states have no meaning for some of the thirteen (a Skeleton has no error state; a ProvenanceLabel has no hover). UX gives no per-component table; DS:1046-1078 gives one for ten of the thirteen, LJ:1352 and LJ:1354 for EvidenceRow and GateBanner, IA:1430 for DataTable. Also: DS:1053's ProvenanceLabel strings differ from UX:273 (UX wins by UX:5); DS:1063 makes the gate message a variant of InlineAlert while the row and UX:256 name GateBanner as a component; DS:565 gives toasts F6, which UX:103 puts on the denylist. Options: (a) the lists in section 3, with the UX:258 states applied only where they have a meaning, written per component in its states file and approved with the plan; (b) every component implements all eleven states. Recommendation: (a), with EvidenceRow, EvidenceTable, DcrMeter and ProvenanceLabel as the data components. (b) adds roughly three days.
Q8. Banner priority. DS:552 orders exam, impersonation, view-as, offline, degraded, preview, live view. UX:19 also names read-only tenant and incident; IA:94 adds change freeze and quarantine; `docs/ux/tokens.css:15` has `--mode-readonly-*` and `--mode-incident-*`. No document places those four. UX:19 sends the rest to "status-bar chips", and a status bar is defined only for the workspace (UX:74). Recommendation: the owner places the four (suggested: exam, impersonation, view-as, incident, read-only, offline, degraded, preview, live view; change freeze and quarantine out of this row), and on LMS pages the banner shows a "+n" count that opens the list. Changes only .8 and .20.
Q9. Admin and Operate rails. UX:38 says "as in section 8"; UX:246 lists home tiles, not rail items. IA's rail block (IA:82-85) lists them. Recommendation: use IA's lists, checked against the routes of UX:48-49. Also UX:9 puts all five modes "under `/o/:org`" while UX:49 gives Operate `/ops`: recommendation `/ops`, as ARCH:78 says.
Q10. Palette scope and the shortcut registry. The row lists "command palette"; so does P3-05 (RM:315). UX:103 puts every shortcut in `commandBus.ts` with a denylist and a CI collision test; ARCH:101 gives the command bus to the workspace (P3-01, RM:311); UX:256 lists CommandPalette in the workspace kit while IA:18 puts it in `apps/web/src/shell`. Options: (a) this row builds the overlay with the Navigate group and a way to register groups; the registry, the denylist and the workspace commands come with P3-01 and P3-05; (b) this row also builds the registry and its collision test (one more sub-card, about 1 day). Recommendation: (a).
Q11. Who wires the 403 reasons. The row says "wired when P4-01 ships" and its After is P0-02 only. Options: (a) P4-01 gets a sub-card that connects `denyReason` to `authorize()`; (b) a P4-06 sub-card parked on P4-01, which keeps this row open and M-B waits on it (RM:349). Recommendation: (a).
Q12. Top bar parts that belong to later rows: help panel (P7-03), bell and tray (P4-03), account menu and organization list (P4-01). Recommendation: buttons with accessible names and fixture data, no panels. The alternative (leave them out until their rows) changes criterion 4 and .18 only.
Q13. Design-system reference site. `docs/ux/screen-inventory.md:85` lists it as screen 79, MVP yes, and DS:26 and DS:1033 describe a token sheet; UX:44-49 has no `/design` route and the row does not name it. Recommendation: this row ships only the gallery page of .22, outside the route table; the reference site needs its own row or an explicit drop.
Q14. One card per lane (RM:276) means groups U and W cannot overlap although they share no source file. Options: (a) keep the rule, 21 web sub-cards in sequence; (b) a second web worktree for this row. Recommendation: (a) until the catalog hotspot (risk 2) has been seen in practice.
Q15. UX:295 (open question 7): `/o/:org` or per-institution subdomains, "decide before routes freeze". This row freezes them. Recommendation: `/o/:org`, the spec's default.
Q16. Token contrast test. UX:266 asks for it "in CI for every fg/bg pair in both themes"; the row text does not list it, and P3-05 lists "contrast tests" for the workspace (RM:315). Recommendation: include the token-pair test in .5 (about 0.3 day, already counted), because the DOM axe run cannot see contrast.
Q17. The `/` page and the name. UX:44 marks `/` v1.x; today it is the smoke page (`e2e/smoke.spec.ts`). Recommendation: leave `/` and the smoke as they are in this row. "Bridle" untranslated (P0-02.6 ruling 2): options (a) stays a catalog message, pseudo-localized as now; (b) stays in the catalog but the pseudo generator leaves it as written. Recommendation: (b), a brand name; it changes .6 and the fixtures of two hand-run platform files (`tools/test/i18n.test.sh`, `tools/test/web.test.sh`), which .2 would then also touch.
Q18. EvidenceRow and EvidenceTable show GradeEvidence records (UX:10), a schema that P1-01 delivers (RM:293) and this row does not depend on. Recommendation: local view types now, mapped from the schema type when P3-04 uses the components. The alternative, P4-06.12 and .13 after P1-01, moves about two days behind another row.

#### 6. Risks and guards

1. Lane ownership stops the row at its first dependency (Q1). Guard: .1 front-loads every dependency; the plan of each later sub-card states "no manifest or lockfile change" and the reviewer checks the diff.
2. Every component and shell card adds messages to `packages/i18n/messages/en.json` and `en-XA.json`, and exports to `packages/ui/src/index.ts`: three files shared by about twenty cards. Guard: sequential web cards (Q14); `en-XA.json` is regenerated by `pnpm i18n:pseudo`, never merged by hand; message ids prefixed per component (`ui.toast.*`, `shell.rail.*`).
3. The hand-run test `tools/test/web.test.sh` forbids exactly what this row builds. Guard: .2 ships before .3 and .17.
4. The axe tests pass in a DOM emulation while real contrast or focus fails. Guard: the token contrast test (.5) and the browser pass (.22); Actions gains them only with P0-09 (RM:291).
5. Components are built before their first consumer (EvidenceRow, EvidenceTable, FormSection have no screen until P3-04, P5-04, P6-01) and may not fit. Guard: states come from the cited lines only, props stay minimal, and the gallery is the one consumer in this row; a misfit is repaired by the consuming row.
6. Size. DataTable, the palette and the token generator are the cards most likely to exceed a day. Guard: DataTable is already two cards; the palette is cut to navigation (Q10); the plan station splits again rather than the builder overrunning.
7. `routes.ts` freezes every MVP path before the screens exist; a later rename touches breadcrumbs, palette and links. Guard: hrefs are built only through the table (a test greps `apps/web/src` for string paths beginning `/o/`), so a rename is one line.
8. A third TypeScript 6.0.3 pin (Q6) and new pins typed in new places (the lesson of P0-02.5's four test passes over `docs/ops/toolchain.md`). Guard: .1 and .23 sweep for typed pins.


## Plan


## Build


## Test


## Review


## Ship

