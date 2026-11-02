# Design system and visual language

_Surface design from the UI/UX workflow (designer agent), 2026-11-03. 12 screens, 7 flows, 38 components._

## Summary

Bridle's visual language has three separate color jobs that are never mixed: an indigo accent for interaction and selection, a semantic status set (pass green, warn amber, fail red, info blue, not-checked gray, pending accent-tinted) for the state of checks and the UI, and theme-invariant data encodings for the canvas (a cividis(10) utilization ramp with a hatched amber 1.00-1.02 tolerance band and a hatched, outlined red over-1.02 band; a blue-to-orange diverging ramp for signed forces and stresses; the Okabe-Ito categorical palette for load cases with letter tags; per-component diagram hues with sign shown by side and fill; grader-overlay severity by line pattern). Chrome adapts to light and dark themes, data colors do not; the canvas has its own light/dark/print theme and every export renders in the print theme so screenshots are deterministic and comparable. Colormapped members always carry a 1.5 px halo in the inverse canvas color because the darkest cividis band is invisible on a dark canvas and the brightest on a light one. Numbers are treated as the product: tabular figures, right alignment, units after a thin space, 3 significant figures (4 in tables and probes), true minus, comparisons in SI before formatting, and an extra digit whenever a rounded display would contradict the pass/fail status. The same DCR meter, evidence row and clause chip appear in the live self-check, the released feedback and the instructor review so the learner sees exactly what the grader found. Density has three modes (compact in workspace panels, default on LMS pages, comfortable for touch), the workspace keeps at least 60% canvas width at 1280x720 with the exam banner (40 px), toolbar (44 px) and status bar (28 px) budgeted, and accessibility is built in: double-ring focus, 4.5:1 text and 3:1 glyph contrast, a textual canvas summary, forced-colors pattern-only results, reduced-motion substitutes, and a keyboard map shared with the command palette. The deliverable is twelve component sheets with wireframes, seven cross-screen flows, 38 components, 24 copy rules, and the full token set as CSS custom properties (key_data of the token sheet). Critical files for implementation (greenfield, proposed): packages/ui/tokens/tokens.json (single source generating tokens.css, tokens.ts and viz-palette.json for the renderer); packages/ui/src/components/engineering/{DcrMeter,ClauseChip,CombinationChip,EvidenceTable,ColormapLegend,UnitInput}.tsx; apps/web/src/workspace/chrome/{Hud,StatusBar,LiveStatePill,ModeBanner,ProbeCard}.tsx; packages/ui/a11y/{contrast.test.ts,cvd.test.ts}; docs/design-system/*.mdx.

## Principles

- Three color jobs, never mixed: accent (interaction, selection, links) is one hue; status semantics (pass/warn/fail/info/not-checked/pending) are another set; data encodings (utilization ramp, diverging ramp, load cases, diagram components, axes) are a third. Selection is never a status color and red appears only for Fail, over-utilization and destructive actions.
- Color is never the only channel: every engineering state has a shape, pattern or word twin (hatch for utilization at or above 1.00, solid/dashed/dotted outlines for overlay severity, letter tags on load cases, icon plus word on every status chip, numbered pins for findings).
- Numbers are the product: tabular figures, right alignment, unit after a thin space, documented significant figures per quantity, true minus sign, SI comparison before formatting, and never a number without its unit, its load combination and (for checks) its clause.
- Theme-variant chrome, theme-invariant data: UI tokens flip between light and dark, viz tokens do not; the canvas has light, dark and print themes and every screenshot or export renders in print so submissions are comparable and printable.
- One evidence component everywhere: the DCR meter, the evidence row and the clause chip render the same GradeEvidence record in the live self-check, the released feedback, the review screen and the help page, so what the learner sees before submitting is what the grader found.
- Dense by default, never cramped: compact density in workspace panels, default on LMS pages, comfortable only for touch; 24 px minimum targets, 44 px touch; the canvas keeps at least 60% width at 1280 px with one panel open.
- Live state is legible within one frame: stale overlays desaturate to 40% and the status pill changes before the solver is even asked; fresh, solving, stale, paused, unstable and offline are six explicit states with words.
- Honest about provenance and limits: AI labels (pending review / confirmed by), unverified-check badges, 'changed since graded' banners, gate reasons spelled out, and the D1-D5 disclaimer strings placed by rule, not by taste.
- Parity before heroics: everything drawn on the canvas has an HTML twin (legend, HUD, probe cards, evidence table, textual model summary) and a keyboard path; reduced motion and forced colors are first-class modes, not exceptions.
- One source, machine-checked: tokens live in one JSON that generates CSS, TypeScript and the renderer palette; CI blocks contrast failures, colour-vision-deficiency band collisions, raw hex in components and viz changes without a palette version bump.

## Screen: Foundations: token sheet and themes

**Roles:** Design-system consumers (product engineers, designers, content authors); the tokens serve every persona surface (learner, instructor/TA, author, institution admin, operator) · **Route:** `/design/foundations/tokens`

Single page of truth for every CSS custom property in both themes, with live contrast checks and a preview strip so a token change is seen and validated before it ships.

```
+----------------------------------------------------------------------------------+
| Bridle Design System   [Foundations] Encodings  Components  Patterns             |
| Theme (o)System ( )Light ( )Dark   Density [Compact|Default|Comfortable]          |
| Canvas preview [Auto v]                                   tokens.json v1.0 #a91f  |
+-------------+--------------------------------------------------------------------+
| Neutrals    | TOKEN SHEET  search [__________]            [Copy CSS] [Copy JSON]  |
| Accent      | +----------------------------------------------------------------+ |
| Status      | | Token             | Light     | Dark      | Role      | Contrast | |
| Modes       | |-------------------+-----------+-----------+-----------+----------| |
| Canvas      | | --bg-page         | [#FAFBFC] | [#0C0F13] | page      |    -     | |
| Viz         | | --fg-primary      | [#151920] | [#F3F5F7] | text      | 16.9 ok  | |
| Typography  | | --fg-muted        | [#5F6977] | [#8A94A3] | text      |  5.6 ok  | |
| Spacing     | | --accent-bg       | [#5B66E6] | [#7480F5] | button bg |  4.7 ok  | |
| Motion      | | --status-fail-fg  | [#C2282E] | [#FF8A8E] | text      |  5.8 ok  | |
| Density     | | --viz-util-10     | [#FFEA46] | same      | data      | halo rule| |
| Z-index     | | ... 212 tokens                                                  | |
| Component   | +----------------------------------------------------------------+ |
|             | PREVIEW STRIP (live in chosen theme + density)                      |
|             | [Primary] [Secondary] [Danger]  (o) radio  [x] check  [12.5 | kN v] |
|             | (v)Pass (!)Warn (x)Fail (-)N/A (o)Pending   DCR [=====|=  ] 0.87    |
|             | [book AISC 360-22 §F2.2]  [1.2D + 1.6L + 0.5S  governing]           |
+-------------+--------------------------------------------------------------------+
```

**Regions:**
- Top bar: section navigation, theme radio group (System/Light/Dark), density segmented control, canvas-theme select for the preview, build hash of tokens.json
- Left rail: token groups (Neutrals, Accent, Status, Modes, Canvas, Viz, Typography, Spacing, Motion, Density, Z-index, Component)
- Token table: name, light value, dark value, role, contrast result against the token's declared background pair
- Preview strip: buttons, inputs, status chips, DCR meter, clause and combination chips rendered live with the chosen theme and density
- Footer: links to the CI reports (contrast, colour-vision simulation, visual regression) for the current build

**Key data:**
- :root{--gray-0:#FFFFFF;--gray-25:#FAFBFC;--gray-50:#F3F5F7;--gray-100:#E8ECF0;--gray-200:#D3D9E0;--gray-300:#B4BCC7;--gray-400:#8A94A3;--gray-500:#5F6977;--gray-600:#4A5462;--gray-700:#353D48;--gray-800:#232931;--gray-900:#151920;--gray-950:#0C0F13}
- :root{--accent-50:#EEF0FF;--accent-100:#DDE1FF;--accent-200:#BCC3FF;--accent-300:#96A0FF;--accent-400:#7480F5;--accent-500:#5B66E6;--accent-600:#4A53CC;--accent-700:#3B43A8;--accent-800:#2D3480;--accent-900:#20255C}
- :root{--green-100:#DDF5E8;--green-300:#5FD39A;--green-500:#21A366;--green-600:#1A7F4B;--green-900:#11331F;--amber-100:#FFF1D6;--amber-300:#FFC04D;--amber-500:#C77700;--amber-600:#8A5200;--amber-900:#3A2A0A;--red-100:#FDE3E4;--red-300:#FF8A8E;--red-500:#E03A40;--red-600:#C2282E;--red-900:#3D1517;--blue-100:#DDEBFC;--blue-300:#7FB4F5;--blue-500:#2F7FE0;--blue-600:#1F67C6;--blue-900:#10263F;--plum-100:#F4E8F6;--plum-300:#E7B8F0;--plum-600:#6D2E7A;--plum-900:#3A1842}
- :root{--viz-util-01:#00204D;--viz-util-02:#00336F;--viz-util-03:#39486B;--viz-util-04:#575C6D;--viz-util-05:#707173;--viz-util-06:#8A8779;--viz-util-07:#A69D75;--viz-util-08:#C4B56C;--viz-util-09:#E4CF5B;--viz-util-10:#FFEA46;--viz-util-tol:#C77700;--viz-util-over:#E03A40;--viz-util-over-outline:#7A1216;--viz-hatch-pitch:4px;--viz-hatch-tol:repeating-linear-gradient(45deg,transparent 0 4px,rgba(0,0,0,.35) 4px 6px);--viz-hatch-over:repeating-linear-gradient(45deg,rgba(0,0,0,.45) 0 2px,transparent 2px 5px);--viz-palette-version:1}
- :root{--viz-div-n3:#1F4E99;--viz-div-n2:#4C7FC4;--viz-div-n1:#A6C3E6;--viz-div-0:#E9E9E6;--viz-div-p1:#F2C48C;--viz-div-p2:#D98B2B;--viz-div-p3:#8F4E05;--viz-div-zero-band:.02}
- :root{--viz-case-D:#6F7A89;--viz-case-L:#E69F00;--viz-case-Lr:#0072B2;--viz-case-S:#56B4E9;--viz-case-W:#009E73;--viz-case-E:#D55E00;--viz-case-T:#CC79A7;--viz-case-other:#F0E442;--viz-case-other-outline:#8A7A00;--viz-case-dim-alpha:.3}
- :root{--viz-diag-N:#5B66E6;--viz-diag-V2:#009E73;--viz-diag-V3:#56B4E9;--viz-diag-M2:#D55E00;--viz-diag-M3:#E69F00;--viz-diag-T:#CC79A7;--viz-diag-pos-alpha:.55;--viz-diag-neg-alpha:.25;--viz-diag-outline:1px;--viz-axis-x:#D55E00;--viz-axis-y:#009E73;--viz-axis-z:#0072B2}
- :root{--viz-overlay-fail:#E03A40;--viz-overlay-fail-width:3px;--viz-overlay-warn:#C77700;--viz-overlay-warn-width:3px;--viz-overlay-warn-dash:8 4;--viz-overlay-note:#2F7FE0;--viz-overlay-note-width:2px;--viz-overlay-note-dash:2 3;--viz-diagnostic-error:#E03A40;--viz-diagnostic-warning:#C77700;--viz-lock-alpha:.7;--results-render-mode:color}
- :root,[data-theme=light]{color-scheme:light;--bg-page:var(--gray-25);--bg-surface:var(--gray-0);--bg-raised:var(--gray-0);--bg-sunken:var(--gray-50);--bg-inverse:var(--gray-900);--bg-overlay:rgba(12,15,19,.45);--fg-primary:var(--gray-900);--fg-secondary:var(--gray-600);--fg-muted:var(--gray-500);--fg-disabled:var(--gray-400);--fg-inverse:var(--gray-50);--fg-on-accent:#FFFFFF;--border-subtle:var(--gray-200);--border-strong:var(--gray-300);--border-focus:var(--accent-500);--accent-fg:var(--accent-600);--accent-bg:var(--accent-500);--accent-bg-hover:var(--accent-600);--accent-bg-active:var(--accent-700);--accent-soft:var(--accent-50);--accent-soft-fg:var(--accent-800)}
- :root,[data-theme=light]{--status-pass-fg:var(--green-600);--status-pass-fill:var(--green-500);--status-pass-bg:var(--green-100);--status-warn-fg:var(--amber-600);--status-warn-fill:var(--amber-500);--status-warn-bg:var(--amber-100);--status-fail-fg:var(--red-600);--status-fail-fill:var(--red-500);--status-fail-bg:var(--red-100);--status-info-fg:var(--blue-600);--status-info-fill:var(--blue-500);--status-info-bg:var(--blue-100);--status-na-fg:var(--gray-500);--status-na-fill:var(--gray-400);--status-na-bg:var(--gray-100);--status-error-fg:var(--gray-800);--status-error-fill:var(--gray-700);--status-error-bg:var(--gray-100);--status-pending-fg:var(--accent-700);--status-pending-fill:var(--accent-300);--status-pending-bg:var(--accent-50)}
- :root,[data-theme=light]{--mode-exam-bg:var(--plum-600);--mode-exam-fg:#FFFFFF;--mode-exam-border:var(--plum-900);--mode-preview-bg:var(--accent-50);--mode-preview-fg:var(--accent-800);--mode-viewas-bg:var(--amber-100);--mode-viewas-fg:var(--amber-600);--mode-impersonate-bg:var(--red-600);--mode-impersonate-fg:#FFFFFF;--mode-offline-bg:var(--gray-800);--mode-offline-fg:var(--gray-50);--mode-degraded-bg:var(--amber-100);--mode-degraded-fg:var(--amber-600);--mode-liveview-bg:var(--blue-100);--mode-liveview-fg:var(--blue-600);--focus-ring:0 0 0 2px var(--bg-surface),0 0 0 4px var(--accent-500);--shadow-1:0 1px 2px rgba(12,15,19,.06),0 2px 8px rgba(12,15,19,.10);--shadow-2:0 8px 24px rgba(12,15,19,.18)}
- [data-theme=dark]{color-scheme:dark;--bg-page:var(--gray-950);--bg-surface:var(--gray-900);--bg-raised:var(--gray-800);--bg-sunken:#101317;--bg-inverse:var(--gray-50);--bg-overlay:rgba(0,0,0,.6);--fg-primary:var(--gray-50);--fg-secondary:var(--gray-300);--fg-muted:var(--gray-400);--fg-disabled:var(--gray-600);--fg-inverse:var(--gray-900);--fg-on-accent:var(--gray-950);--border-subtle:var(--gray-700);--border-strong:var(--gray-600);--border-focus:var(--accent-300);--accent-fg:var(--accent-300);--accent-bg:var(--accent-400);--accent-bg-hover:var(--accent-300);--accent-bg-active:var(--accent-500);--accent-soft:#1E2140;--accent-soft-fg:var(--accent-200)}
- [data-theme=dark]{--status-pass-fg:var(--green-300);--status-pass-fill:var(--green-500);--status-pass-bg:var(--green-900);--status-warn-fg:var(--amber-300);--status-warn-fill:var(--amber-500);--status-warn-bg:var(--amber-900);--status-fail-fg:var(--red-300);--status-fail-fill:var(--red-500);--status-fail-bg:var(--red-900);--status-info-fg:var(--blue-300);--status-info-fill:var(--blue-500);--status-info-bg:var(--blue-900);--status-na-fg:var(--gray-400);--status-na-fill:var(--gray-500);--status-na-bg:var(--gray-800);--status-error-fg:var(--gray-100);--status-error-fill:var(--gray-300);--status-error-bg:var(--gray-800);--status-pending-fg:var(--accent-200);--status-pending-fill:var(--accent-400);--status-pending-bg:#1E2140}
- [data-theme=dark]{--mode-exam-bg:var(--plum-600);--mode-exam-fg:#FFFFFF;--mode-exam-border:var(--plum-300);--mode-preview-bg:#1E2140;--mode-preview-fg:var(--accent-200);--mode-viewas-bg:var(--amber-900);--mode-viewas-fg:var(--amber-300);--mode-impersonate-bg:var(--red-600);--mode-impersonate-fg:#FFFFFF;--mode-offline-bg:var(--gray-100);--mode-offline-fg:var(--gray-900);--mode-degraded-bg:var(--amber-900);--mode-degraded-fg:var(--amber-300);--mode-liveview-bg:var(--blue-900);--mode-liveview-fg:var(--blue-300);--focus-ring:0 0 0 2px var(--bg-surface),0 0 0 4px var(--accent-300);--shadow-1:0 1px 2px rgba(0,0,0,.4),0 2px 8px rgba(0,0,0,.5);--shadow-2:0 8px 24px rgba(0,0,0,.6)}
- :root,[data-canvas-theme=light]{--canvas-bg:#EEF1F5;--canvas-grid-major:#C9D0D9;--canvas-grid-minor:#DEE3E9;--canvas-plane-tint:rgba(91,102,230,.06);--canvas-member:#353D48;--canvas-member-width:1.5px;--canvas-node:#5F6977;--canvas-support:#232931;--canvas-release:#232931;--canvas-ghost:rgba(138,148,163,.5);--canvas-ghost-dash:6 4;--canvas-halo:rgba(21,25,32,.55);--canvas-halo-width:1.5px;--canvas-selection:#5B66E6;--canvas-selection-fill:rgba(91,102,230,.18);--canvas-selection-width:3px;--canvas-hover:#96A0FF;--canvas-hover-width:1.5px;--canvas-reaction:#151920;--canvas-label-bg:rgba(255,255,255,.85);--canvas-label-fg:#151920;--canvas-hud-bg:rgba(255,255,255,.92);--canvas-hud-border:var(--gray-200);--canvas-stale-saturation:.4;--canvas-glyph-min:24px;--canvas-glyph-max:40px}
- [data-canvas-theme=dark]{--canvas-bg:#1C2027;--canvas-grid-major:#343B45;--canvas-grid-minor:#262C34;--canvas-plane-tint:rgba(150,160,255,.08);--canvas-member:#D3D9E0;--canvas-node:#8A94A3;--canvas-support:#E8ECF0;--canvas-release:#E8ECF0;--canvas-ghost:rgba(138,148,163,.45);--canvas-halo:rgba(255,255,255,.45);--canvas-selection:#96A0FF;--canvas-selection-fill:rgba(150,160,255,.2);--canvas-hover:#BCC3FF;--canvas-reaction:#F3F5F7;--canvas-label-bg:rgba(21,25,32,.85);--canvas-label-fg:#F3F5F7;--canvas-hud-bg:rgba(21,25,32,.92);--canvas-hud-border:var(--gray-700)}
- [data-canvas-theme=print]{--canvas-bg:#FFFFFF;--canvas-grid-major:#D3D9E0;--canvas-grid-minor:#E8ECF0;--canvas-plane-tint:transparent;--canvas-member:#151920;--canvas-node:#4A5462;--canvas-support:#151920;--canvas-release:#151920;--canvas-ghost:rgba(74,84,98,.5);--canvas-halo:rgba(21,25,32,.6);--canvas-selection:transparent;--canvas-selection-fill:transparent;--canvas-hover:transparent;--canvas-reaction:#151920;--canvas-label-bg:#FFFFFF;--canvas-label-fg:#151920;--canvas-hud-bg:#FFFFFF;--canvas-hud-border:#B4BCC7}
- :root{--font-sans:'Inter Variable','Inter',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;--font-mono:'JetBrains Mono','SFMono-Regular',Menlo,Consolas,monospace;--font-math:'KaTeX_Main','Times New Roman',serif;--text-2xs:11px;--text-xs:12px;--text-sm:13px;--text-md:14px;--text-lg:16px;--text-xl:20px;--text-2xl:24px;--text-3xl:30px;--leading-tight:1.25;--leading-data:1.35;--leading-body:1.5;--weight-regular:400;--weight-medium:500;--weight-semibold:600;--tracking-heading:-0.01em;--tracking-caps:0.04em;--numeric-features:'tnum' 1,'lnum' 1}
- :root{--space-0:0;--space-1:4px;--space-2:8px;--space-3:12px;--space-4:16px;--space-5:20px;--space-6:24px;--space-8:32px;--space-10:40px;--space-12:48px;--space-16:64px;--radius-sm:4px;--radius-md:6px;--radius-lg:10px;--radius-full:999px;--border-1:1px;--border-2:2px;--z-hud:10;--z-panel:20;--z-sticky:30;--z-banner:40;--z-popover:50;--z-toast:60;--z-dialog:70;--z-exam:80;--size-target-min:24px;--size-target-touch:44px;--size-icon-sm:16px;--size-icon-md:20px;--size-icon-lg:24px;--stroke-icon:1.5px;--layout-page-max:1280px;--layout-gutter:24px;--layout-toolbar-h:44px;--layout-statusbar-h:28px;--layout-banner-h:40px;--layout-panel-w:320px;--layout-panel-w-min:280px;--layout-panel-w-max:480px;--layout-rail-w:40px;--layout-canvas-min-pct:60;--bp-sm:640px;--bp-md:1024px;--bp-lg:1280px;--bp-xl:1600px;--bp-2xl:1920px}
- [data-density=compact]{--density-row-h:28px;--density-control-h:28px;--density-pad-x:8px;--density-pad-y:4px;--density-gap:4px;--density-text:var(--text-sm)} :root,[data-density=default]{--density-row-h:36px;--density-control-h:32px;--density-pad-x:12px;--density-pad-y:6px;--density-gap:8px;--density-text:var(--text-md)} [data-density=comfortable]{--density-row-h:44px;--density-control-h:40px;--density-pad-x:16px;--density-pad-y:10px;--density-gap:12px;--density-text:var(--text-md)}
- :root{--motion-fast:100ms;--motion-base:180ms;--motion-slow:300ms;--motion-camera:300ms;--motion-deform-period:2000ms;--motion-stale-pulse:1200ms;--ease-standard:cubic-bezier(.2,0,0,1);--ease-exit:cubic-bezier(.4,0,1,1)} @media (prefers-reduced-motion:reduce){:root{--motion-fast:0ms;--motion-base:0ms;--motion-slow:0ms;--motion-camera:0ms;--motion-deform-period:0ms;--motion-stale-pulse:0ms}}
- @media (forced-colors:active){:root{--results-render-mode:pattern;--viz-hatch-pitch:3px;--focus-ring:0 0 0 3px Highlight} [data-canvas-theme]{--canvas-bg:Canvas;--canvas-member:CanvasText;--canvas-node:CanvasText;--canvas-support:CanvasText;--canvas-selection:Highlight;--canvas-hover:Highlight;--canvas-reaction:CanvasText;--canvas-label-bg:Canvas;--canvas-label-fg:CanvasText}}
- :root{--dcr-meter-h:8px;--dcr-meter-max:1.2;--dcr-meter-limit-color:var(--fg-primary);--dcr-meter-track:var(--bg-sunken);--chip-h:22px;--chip-radius:var(--radius-sm);--chip-pad-x:6px;--legend-band-w:160px;--legend-band-h:14px;--legend-band-count:10;--toast-w:360px;--toast-timeout:5000ms;--toast-max:3;--probe-max:10;--label-declutter-count:500;--table-virtualize-rows:200}
- Rules: tokens.json is the only editable source; the build emits tokens.css, tokens.ts (typed names) and viz-palette.json read by the WebGL renderer so canvas colors equal legend colors. Components may reference semantic, canvas, viz, density and component tokens only; primitives and raw hex are forbidden in component code (stylelint). Tenant branding (v1.x) may replace the logo only; accent, status and viz tokens are platform-fixed.

**States:**
- Loading: skeleton rows (no shimmer under reduced motion)
- Error: a token failing its contrast target shows a Fail badge in the Contrast column and the header reads 'N tokens fail contrast'; the same check fails CI
- Partial: generated tokens.css older than tokens.json shows a warning banner 'Generated output is out of date; run the tokens build'
- Success: every row passes and Copy CSS copies the full :root and [data-theme] blocks below
- Empty: a search with no match shows 'No token matches <query>' with a link to the naming guide

**Interactions:**
- Theme radio switches data-theme on the preview and emphasizes the matching value column
- Hover or focus a swatch: popover with hex, OKLCH, usage rule and the paired background it is tested against
- Density control changes the --density-* variables and re-renders the preview strip
- Copy CSS, Copy JSON and Copy TS copy the generated artifacts; the sheet never allows editing (tokens change only through tokens.json)
- Search filters by token name or role; group links scroll with scroll-margin so the sticky header never covers the target

**Keyboard and accessibility:**
- Token table is a semantic HTML table with scoped column headers; swatches carry aria-label '<token> <hex>'
- Theme and density controls are radio groups operable with arrow keys; the canvas preview select is a native select
- Copy actions confirm through an aria-live polite region ('Copied 212 tokens as CSS')
- The sheet itself passes WCAG 2.2 AA in both themes and at 200% zoom (dogfooding the system)

**Requirements:**
- NFR ACC-01
- LMS A11Y-01
- LMS TEN-01
- WS NFR-3D-09
- PRD-04
- ADR R16

## Screen: Typography and numeric formatting

**Roles:** Design-system consumers; rules apply to every persona surface, especially result tables, probes, gradebook and feedback · **Route:** `/design/foundations/typography`

Fix the type scale, the three font roles and the rules that make engineering numbers readable and comparable (tabular figures, units, significant figures, alignment).

```
+----------------------------------------------------------------------------------+
| TYPE SCALE (Inter Variable)             | NUMERIC FORMAT SAMPLES   Units [SI|US]  |
| 3xl 30/1.25 600  Page title             | force       12.3 kN       2.77 kip      |
| 2xl 24/1.25 600  Section title          | moment      45.6 kN·m     33.6 kip·ft   |
| xl  20/1.25 600  Card / dialog title    | stress       213 MPa      30.9 ksi      |
| lg  16/1.5  500  Panel title, lead      | deflection  12.3 mm       0.48 in       |
| md  14/1.5  400  Body (default)         | DCR          0.87         1.004 (fail)  |
| sm  13/1.35 400  Data rows, panels      | ratio       L/412         limit L/240   |
| xs  12/1.35 500  Labels, chips, meta    | combination 1.2D + 1.6L + 0.5S          |
| 2xs 11/1.25 500  Legend ticks only      | receipt     sha256:3f9a...c21e  [copy]  |
|-----------------------------------------+-----------------------------------------|
| FONTS                                   | ALIGNMENT AND NUMERALS                  |
| Sans  Inter Variable  tnum lnum         | right-align numbers; unit after thin    |
| Mono  JetBrains Mono: hashes, coords,   |   space in fg-secondary weight 400      |
|       command line, JSON, op ids        | true minus U+2212; en dash ranges       |
| Math  KaTeX: memos, clause pages        | 3 s.f. default, 4 in tables and probes  |
|                                         | never animate or proportional-space     |
|                                         |   numbers in tables, meters, totals     |
+----------------------------------------------------------------------------------+
```

**Regions:**
- Type scale ladder: size/line-height/weight and the allowed usage per step (2xs is legend ticks only, never body)
- Numeric format samples with an SI/US unit toggle showing the same SI-stored value in both display sets
- Font roles: sans (UI, data), mono (hashes, coordinates HUD, command line, JSON, op ids), math (KaTeX in memos and clause pages)
- Alignment and numeral rules: tabular and lining figures everywhere numbers appear, right alignment in tables, unit styling

**Key data:**
- Significant figures: forces, moments, stresses, pressures 3 s.f. (4 in tables, probes, exports); deflections 0.1 mm or 0.01 in; coordinates 0.001 m or 0.01 ft; DCR 2 decimals (3 when the rounded value equals the limit); L/x integer; percent 0 decimals (1 below 10%); angles 0.1 degree; mass 3 s.f.; cost integer currency
- Units: SI-engineering kN, kN·m, MPa, mm/m, kN/m², kN/m; US customary kip, kip·ft, ksi, in/ft, psf, kip/ft; thin space U+2009 before the unit; middle dot U+00B7; superscripts ² ³
- Hashes: 'sha256:' prefix, first 4 and last 4 hex with an ellipsis, mono, copy button

**States:**
- Success: web fonts loaded (self-hosted, subset latin plus math and engineering symbols)
- Partial: font not yet loaded, fallback metrics (size-adjust) prevent layout shift; samples show a 'fallback metrics' note
- Error: KaTeX fonts missing on a memo page falls back to serif with a console warning; equations still render

**Interactions:**
- Unit toggle switches the samples between SI-engineering and US customary without changing stored values
- Density toggle shows the same table at compact (13 px) and default (14 px) row text
- Hover a scale step shows where it is used (components list)

**Keyboard and accessibility:**
- Minimum body size 14 px; 13 px allowed only in data rows and panels; 11 px only for legend tick labels that duplicate numbers available elsewhere
- Line height at least 1.5 for body text, 1.35 for data rows; text reflows at 200% zoom and 320 px equivalent width on LMS pages (WCAG 1.4.10)
- Uppercase labels use tracking-caps and keep the source text sentence case for screen readers
- Numbers use font-variant-numeric tabular-nums so sorting and scanning columns work for low-vision users

**Requirements:**
- LMS I18N-02
- SIM-UNT-01
- NFR-DOM-07
- WS RES-07
- DLV GAP3-DLV-05
- NFR PERF-02

## Screen: Engineering color encodings

**Roles:** Design-system consumers; encodings are seen by learners, instructors and authors on every canvas, legend, table and feedback view · **Route:** `/design/encodings`

Define and validate the data encodings the workspace and grader share: utilization colormap with legend bands, diverging ramp for signed quantities, load-case palette, diagram ribbon colors, grader overlay severities, check status and severity glyphs, with colour-vision-deficiency previews.

```
+----------------------------------------------------------------------------------+
| UTILIZATION (DCR) COLORMAP  cividis(10)      CVD preview [Normal|Deuter|Protan|Tri]|
| 0.00 [01][02][03][04][05][06][07][08][09][10] 1.00 [////] 1.02 [XXXX] >1.02      |
|      .1  .2  .3  .4  .5  .6  .7  .8  .9  1.0   tolerance    fail (red, 2px line) |
| Design/Optimize target bracket:               [------- 0.70 to 1.00 -------]     |
| (o) banded 10 ( ) banded 20 ( ) smooth   min [0.00] max [1.00]  [ ] pattern-only |
|----------------------------------------------+-----------------------------------|
| DIVERGING (signed N, M, stress)              | LOAD CASES (Okabe-Ito + letter)   |
|  -  [n3][n2][n1][ 0 ][p1][p2][p3]  +         | D gray   L orange  Lr blue        |
|  compression / hogging | tension / sagging   | S sky    W green   E vermilion    |
|  zero band = +/-2% of max, neutral           | T purple Other yellow (outlined)  |
|------------------------+---------------------+-----------------------------------|
| DIAGRAM RIBBONS        | GRADER OVERLAY      | CHECK STATUS      | SEVERITY      |
| N V2 V3 M2 M3 T hues   | fail ==== 3px solid | (v) Pass  green   | Advisory  .   |
| [+] solid alpha .55    | warn - -  3px dash  | (!) Warn  amber   | Minor     o   |
| [-] hatched alpha .25  | note .... 2px dot   | (x) Fail  red     | Major     oo  |
| drawn on tension side  | pin markers 1 2 3   | (-) N/A   gray    | Critical  ooo |
| loads dim to 30% when  | halo on every       | (?) Error dk gray |  + word always|
|   any ribbon is on     |   colored member    | (o) Pending accent|               |
+----------------------------------------------------------------------------------+
```

**Regions:**
- Utilization colormap: ten cividis bands 0.00 to 1.00, hatched amber tolerance band 1.00 to 1.02 (GRD-03 numeric-tolerance advisory), hatched and outlined red band above 1.02; target bracket 0.70 to 1.00 for Design and Optimize tasks; banded/smooth and min/max controls; pattern-only toggle
- Diverging ramp for signed quantities (axial, moment, stress): seven stops blue to neutral to orange, neutral zero band, convention labels
- Load-case categorical palette: Okabe-Ito hues mapped to D, L, Lr, S, W, E, T plus Other, each with its letter tag
- Diagram ribbon colors per component (N, V2, V3, M2, M3, T), sign by side and fill, interaction rule with load arrows
- Grader overlay severities by line pattern (fail solid, warn dashed, note dotted) with numbered pins
- Check status glyphs (pass, warn, fail, not applicable, error, pending) and severity glyphs (advisory, minor, major, critical) always paired with the word
- Colour-vision-deficiency preview switch that re-renders every swatch through deuteranopia, protanopia and tritanopia simulation

**Key data:**
- Bands: 1 0.00-0.10 #00204D; 2 0.10-0.20 #00336F; 3 0.20-0.30 #39486B; 4 0.30-0.40 #575C6D; 5 0.40-0.50 #707173; 6 0.50-0.60 #8A8779; 7 0.60-0.70 #A69D75; 8 0.70-0.80 #C4B56C; 9 0.80-0.90 #E4CF5B; 10 0.90-1.00 #FFEA46; tolerance 1.00-1.02 #C77700 with 45-degree hatch at 4 px pitch; over above 1.02 #E03A40 with 45-degree hatch (2 px on, 3 px off) and a 2 px #7A1216 outline
- Halo rule: every colormapped member is stroked with a 1.5 px halo in --canvas-halo (inverse of the canvas) so band 1 reads on a dark canvas and band 10 on a light one
- Smooth mode interpolates between the ten stops in OKLab; banded is the default (RES-03 default 10 bands)
- Diverging: n3 #1F4E99, n2 #4C7FC4, n1 #A6C3E6, 0 #E9E9E6, p1 #F2C48C, p2 #D98B2B, p3 #8F4E05; tension and sagging positive by default; the legend always prints the convention
- Load cases: D #6F7A89, L #E69F00, Lr #0072B2, S #56B4E9, W #009E73, E #D55E00, T #CC79A7, Other #F0E442 with #8A7A00 outline; arrows scale with magnitude; case letter rendered when labels are on
- Diagram components: N #5B66E6, V2 #009E73, V3 #56B4E9, M2 #D55E00, M3 #E69F00, T #CC79A7; positive fill alpha .55, negative alpha .25 plus hatch; load arrows dim to 30% while any ribbon overlay is on
- Axis triad and gizmo handles: X #D55E00, Y #009E73, Z #0072B2 with letters on every handle
- Status glyphs: pass circle-check, warn triangle-alert, fail octagon-x, not applicable circle-minus, error square-alert, pending clock; severity: advisory dot, minor one bar, major two bars, critical three bars, always with the word

**States:**
- Normal: color mode; every band separated by at least a 3:1 luminance step from its neighbours' extremes and a measurable chroma step under simulation
- Pattern-only: forced-colors or user toggle; bands become hatch pitches from 10 px (low) to 2 px (high) plus isolines at band edges; overlay severity stays dash-coded
- Stale: all encodings desaturated to 40% with a 'Stale' badge in the legend
- Unverified check: gray with dashed outline, excluded from the score, badge 'Unverified check'
- Hidden by exam profile: colormap, legend and overlay toggles not rendered; tools show 'Off' badges

**Interactions:**
- CVD preview switches re-render swatches and the embedded reference scene; the sheet lists the minimum adjacent-band contrast per mode
- Band count control (5/10/20) and min/max fields update the legend; min/max are per-view state and recorded in screenshot sidecars
- Hover a load-case swatch shows its letter tag and the glyph shapes used for its load types
- Clicking a status glyph lists every component that uses it

**Keyboard and accessibility:**
- Every encoding has a non-color twin: hatch for at or above 1.00, dash pattern for overlay severity, letter tags for load cases, icon plus word for status and severity
- Legend swatches carry a 1 px border-strong edge and numeric labels; the legend is HTML with a text description ('10 bands from 0 to 1.00; hatched 1.00 to 1.02 tolerance; red hatched above 1.02')
- Red is used only for Fail, over-utilization and destructive actions; no red-green pairs anywhere
- Pattern-only mode is reachable from the legend menu, not only from the OS setting

**Requirements:**
- WS RES-02
- WS RES-03
- WS RES-06
- WS RES-08
- NFR ACC-02
- STR QUAL-01
- STR GRD-03
- AIG CHK-05
- AIG XPL-02
- ADR C6

## Screen: 3D canvas chrome and HUD kit

**Roles:** Learners (edit), instructors/TAs and authors (author mode, snapshot and live view), tablet users (read-only); defined here as a kit consumed by the workspace design · **Route:** `/design/components/canvas-chrome`

Specify the chrome around the WebGL viewport: banner slot, toolbar, four HUD corners, legend, probe cards, diagnostics tray, status bar and the live-state pill, all built in HTML so they are themeable, screenshot-deterministic and accessible.

```
+----------------------------------------------------------------------------------+
| EXAM MODE  Steel portal frame  Remaining 01:12:30  Hints off  Self-check off  z80 |
+----------------------------------------------------------------------------------+
| Select Node Member Support Load | Measure Probe | Undo Redo | Units kN,m | ? Cmd+K |
+----------------------------------------------------------------------------------+
| [1.2D + 1.6L + 0.5S v] [Deformed x25] [Util] [N][M]          [cube]  Top Iso Fit |
|                                                                                  |
|          ghost - - - - - - -                                                      |
|        N3 o======= B12 ===XXXXX=== o N4   <- hatched >1.02 + halo                 |
|          |  probe: B12 | 1.03 | Flexure (LTB) | AISC 360-22 §F2.2 | [x]  |       |
|          |                                                                       |
|   pin  ^^^                                   roller o                            |
|  [plane XZ] [snap: node] x 3.000  y 0.000  z 4.000   +--- Legend --------------+ |
|                                                      | Utilization, combined   | |
|  diagnostics (1)  (x) VAL-NO-SUPPORT: N6 ... [Fly]   | 1.2D + 1.6L + 0.5S      | |
|                                                      | [01..10] 0 ... 1.00     | |
|                                                      | [////] 1.00-1.02 tol    | |
|                                                      | [XXXX] >1.02 fail       | |
+------------------------------------------------------+-------------------------+-+
| 2 members selected | Tier S  41 members | (*) Live 38 ms | kN, m | Educational use |
+----------------------------------------------------------------------------------+
```

**Regions:**
- Banner slot (40 px, z 80, fixed): exam, preview, view-as, impersonation, offline, degraded or live-view banner; never hidden by panels or full-screen canvas
- Toolbar (44 px): tool modes, measure/probe, undo/redo, units menu, help '?', command palette hint; tools carrying data show 'Off' badges in exam mode
- HUD top-left: load case/combination switcher with the formula and type tag, overlay toggles (deformed with scale, utilization, diagrams N/V/M/T, reactions)
- HUD top-right: navigation cube, view presets, fit
- HUD bottom-left: working plane chooser, snap indicator glyph with name, coordinate readout in mono
- HUD bottom-right: colormap legend (title = quantity and active combination, bands, tolerance, over band, target bracket), collapses to a horizontal strip below 1440 px
- Probe cards: pinned readouts anchored to entities, up to 10, stale state
- Diagnostics tray above the status bar: severity glyph, rule code, message naming the entity and the fix, Fly-to and Fix actions
- Status bar (28 px): selection summary, model tier and counts, live-state pill, display units, educational-use badge (D1), server-sync indicator

**Key data:**
- Vertical budget at 720 px: banner 40 + toolbar 44 + status 28 leaves 608 px of canvas; HUD panels never cover more than 25% of canvas height; the canvas keeps at least 60% of width with one 320 px panel open
- HUD panels are solid surfaces (--canvas-hud-bg at 92% opacity, 1 px border, no blur) so screenshots are deterministic across GPUs
- Screenshot and export always use data-canvas-theme=print with selection and hover suppressed; the sidecar records overlay, case, legend min/max and --viz-palette-version

**States:**
- Fresh: overlays at full saturation; pill 'Live 38 ms'
- Stale: overlays at 40% saturation plus badge within one frame of an edit; pill 'Stale'
- Solving: pill 'Solving…' with an indeterminate bar (static under reduced motion)
- Paused: Tier M over budget; pill 'Live paused' with Run button (Ctrl+Enter)
- Unstable/error: overlays cleared to ghost; pill names the node and DOF; diagnostics tray opens; entity outlined in error style
- Exam mode: banner present, data-bearing tools with 'Off' badges, no legend, snapshots include the banner
- Read-only (snapshot, tablet, peer-review copy): 'Read-only' chip in the status bar, edit tools hidden, probe and camera active
- Context lost: canvas shows --canvas-bg and a 'Restoring graphics' pill for up to 2 s; HUD remains interactive
- Offline: offline banner, local autosave continues, sync indicator shows queued saves
- Label declutter: above 500 visible labels, labels on hover and selection only with an 'auto' chip the user can override

**Interactions:**
- Switching the case/combination repaints overlays and updates the legend title and screenshot metadata without re-running analysis
- Overlay toggles are HTML toggle buttons with pressed state and single-letter shortcuts; enabling any diagram dims load arrows to 30%
- Legend min/max fields repaint within one frame; the legend is captured in screenshots when enabled
- Probe tool click pins a card; cards follow their entity and update when the case changes; close with the x or Delete when focused
- Diagnostics entries fly to and select the entity with the error or warning outline; Fix applies the suggested auto-fix as one undo step
- Status bar units menu switches display units for every value on screen

**Keyboard and accessibility:**
- Tab order: banner actions, toolbar, canvas container, HUD controls, panels, status bar; focus never trapped in the canvas
- Canvas container: focusable, role application with aria-roledescription '3D model viewport', accessible name and description from the model summary template; arrow keys orbit, Shift+arrows pan, +/- zoom, F frame, Home fit, 1-7 presets, 5 ortho toggle
- All HUD, legend, probe and status elements are HTML, not drawn in WebGL, so they are readable by assistive technology and themeable
- Live-state changes are announced through a polite live region in the status bar ('Results updated', 'Results stale, solving', 'Live paused')
- Glyphs stay 24 to 40 px on screen at any zoom; pick tolerance 6 px mouse and 14 px touch
- The educational-use badge expands to the full D1 text on hover and focus; it is present in every screenshot title block

**Requirements:**
- WS INP-02
- WS EDIT-06
- WS MOD-01
- WS MOD-09
- WS RES-04
- WS RES-07
- WS CAP-01
- WS A11Y-01
- INTG GAP5-EXAM-03
- LIC GAP2-DIS-01
- NFR SBX-01
- NFR AVL-03
- ADR R14
- ADR R16

## Screen: Data display kit: evidence table, DCR meter, chips

**Roles:** Learners (self-check, results dock, feedback), instructors/TAs (review screen), authors (calibration reports); operators reuse the table for job inspection · **Route:** `/design/components/data`

The components that turn GradeEvidence records into readable, traceable numbers: the evidence table, the DCR meter in cell and card forms, and the clause, combination and load-case chips.

```
+----------------------------------------------------------------------------------+
| EVIDENCE TABLE  [Status v] [Check type v] [Subject v]  search [______]  [CSV]    |
| +------+---------+---------------+-----------+--------+-------+--------------+-+ |
| |Status| Subject | Check         |     Value |  Limit | Margin| Governing    | | |
| +------+---------+---------------+-----------+--------+-------+--------------+-+ |
| |(x)Fail| B12 mbr| Flexure (LTB) |  1.03 DCR |   1.00 |   -3% | 1.2D+1.6L+.. |>| |
| |      |         | [AISC 360-22 §F2.2]  EV-STR-0007                           | | |
| |(!)Warn| B7  mbr| Deflection    |     L/228 |  L/240 |   -5% | D + L (serv) |>| |
| |(v)Pass| C3  col| Combined H1   |  0.74 DCR |   1.00 |  +26% | 1.2D+Ev+Eh   |>| |
| |(-)N/A | T2  trs| Flexure       |        -- |     -- |    -- | --           | | |
| +------+---------+---------------+-----------+--------+-------+--------------+-+ |
| 4 of 41 rows  sorted: status, margin           row click = fly-to + select       |
|----------------------------------------------------------------------------------|
| DCR METER card                              | DCR METER cell variants            |
| B12  Flexure (LTB)         1.03   FAIL      | 0.87 [=======|   ]  pass           |
| [=========|XX]  0        1.00      1.20     | 1.01 [=========|/]  tolerance       |
| Mu 128 kN·m   phiMn 124 kN·m   Lb 6.00 m    | 1.03 [=========|X]  over            |
| Cb 1.14   governing 1.2D + 1.6L + 0.5S      | 1.37 [=========|XX>] over, >1.20    |
| [AISC 360-22 §F2.2] [Explain] [Source ^]    |  --  [- - - - - - ]  unverified     |
|---------------------------------------------+------------------------------------|
| CLAUSE CHIP [book AISC 360-22 §F2.2] tip: 'Lateral-torsional buckling, compact   |
|   I-shapes' (Bridle paraphrase) [Open explanation] [Official source ^]  pack 1.3 |
| COMBO CHIP [1.2D + 1.6L + 0.5S  governing]   CASE CHIP [o L Live] [o W Wind]     |
+----------------------------------------------------------------------------------+
```

**Regions:**
- Evidence table: filter bar (status, check type, subject kind), search, CSV export; columns Status, Subject (label plus kind icon), Check, Value with unit, Limit, Margin %, Governing combination, clause chip row, actions
- DCR meter card: subject, check, value, status word, 0 to 1.20 track with the 1.00 limit line, hatched overflow, named values (demand, capacity, Lb, Cb), governing combination, clause chip, Explain and Official source actions
- DCR meter cell variants: pass, tolerance, over, over beyond 1.20 with an arrow, unverified, not applicable, stale
- Clause chip with tooltip (paraphrased title, pack version) and actions
- Combination chip with type tag and the word 'governing'; load-case chip with colored dot and letter

**Key data:**
- Meter geometry: 8 px track, scale 0 to 1.20 with the 1.00 limit at 83% of the track, fill color from the utilization band of the value, hatched amber between 1.00 and 1.02, hatched red with outline above 1.02, values above 1.20 clamp with an arrow and the numeric label
- Row order encodes severity (fail first) so colour is never the only cue
- Every displayed number maps to an evidence id (XPL-01 acceptance) and the pack version line appears under the table

**States:**
- Loading: skeleton rows; counts hidden until loaded
- Empty: 'No checks match these filters' with a reset action; 'No checks yet: run the analysis' when no results exist
- Error: 'Checks unavailable: analysis error (ENG-SINGULAR at N4)' with a link to diagnostics
- Partial: judged entries pending show the pending glyph and 'AI feedback pending'
- Unverified: rows for checks without a verification record are gray, dashed, excluded from totals and badged 'Unverified check'
- Stale: table header shows 'Results stale' and values are dimmed until the solver returns
- Selected: the row synced with canvas selection is highlighted with the accent-soft background and a left accent bar

**Interactions:**
- Row click or Enter flies to the subject, selects it and switches the active combination to the governing one; selecting in the canvas highlights the row
- Column headers sort; default sort is status (fail, warn, pass, n/a) then margin ascending
- Clause chip hover shows the tooltip; click opens a menu with Open explanation (help panel with the learner's own values) and Official source (link-out)
- Expanding a row lists every named value in the evidence record with units and the evidence id (copy)
- CSV export includes units in headers, the combination label and the D1 disclaimer header line

**Keyboard and accessibility:**
- Real HTML table with column headers; virtualized above 200 rows while keeping row semantics
- Arrow keys move between rows, Enter flies to the entity, Space toggles selection, C copies the evidence id
- Status cells contain the icon plus visible word; margin sign is read as 'minus 3 percent'
- DCR meter exposes its value, limit and status in text (aria-valuenow, aria-valuemax 1.00 context) and the hatched overflow is also described in words
- Chips are buttons when they act and plain spans when they only label; tooltips open on focus as well as hover

**Requirements:**
- AIG XPL-01
- AIG XPL-02
- AIG XPL-03
- AIG CHK-01
- AIG CHK-05
- STR CODE-01
- STR GRD-04
- LIC GAP2-LIC-02
- LIC GAP2-TXT-02
- LIC GAP2-VER-02
- OPS GAP4-HELP-02
- WS RES-07

## Screen: Forms and inputs kit

**Roles:** Learners (property panel, deliverables, memo), authors (task builder), instructors (overrides, extensions), admins (settings) · **Route:** `/design/components/forms`

Form controls tuned for engineering data entry: unit-aware numeric input with expressions and dimension checks, mixed-value editing, section picker, slider with numeric twin, and builder sections with completion state.

```
+----------------------------------------------------------------------------------+
| UNIT-AWARE NUMERIC INPUT                                                         |
| Distributed load w   [ 2*3.5            ] [kN/m v]  = 7.00 kN/m  (0.480 kip/ft)  |
| Reaction at A, Fz    [ 12.5 kN·m        ] [kN   v]  (x) Expected a force; kN·m   |
|                                                         is a moment.             |
| Floor live load      [ 240              ] [kPa  v]  (!) Unusually large. Looks   |
|                                                   like psf entered as kPa (x47.88)|
|                                                   [Use 5.03 kPa]                  |
| Lb (unbraced length) [ Varies (3 values)] [m    v]  typing applies to all 3      |
| Material E           [ 200 GPa   (lock) ]           locked by the task            |
|----------------------------------------------------------------------------------|
| SECTION PICKER   [W14x30            v]  Family [W v]  Depth [<= 18 in v]  [*]    |
|   W14x30  A 8.85 in2  Ix 291 in4  Zx 47.3 in3  ry 1.49 in  30 lb/ft   [Select]   |
|   W14x34  A 10.0 in2  Ix 340 in4  Zx 54.6 in3  ry 1.53 in  34 lb/ft   [Select]   |
|   library aisc-shapes-v16@1.0.0                                                  |
|----------------------------------------------------------------------------------|
| SLIDER + INPUT  Deformation scale  [-------o--------] [ 25.0 ] x   log 0.01..100 |
| SEGMENTED [LRFD|ASD]   TOGGLE Live analysis [on ]   CHECKBOX [-] 2 of 3 released |
| BUILDER SECTIONS  (v) Basics  (v) Code & Units  ( ) Site  (!) Rubric: sum 95/100 |
| VALIDATION under field: icon + text, linked by aria-describedby; never color only|
+----------------------------------------------------------------------------------+
```

**Regions:**
- Unit-aware numeric input: label, value field accepting numbers and expressions, unit select filtered to the field's dimension, computed value and secondary unit, inline validation
- Mixed-value (varies) and locked states of the property panel
- Section picker: combobox with family, depth and weight filters, favorites, property preview rows, library version chip
- Slider with synced numeric field (linear and logarithmic)
- Segmented control, toggle, checkbox with indeterminate, builder section list with completion ticks and error counts
- Validation message anatomy

**Key data:**
- Conversion fingerprints offered as fixes: x12, x25.4, x47.88, x1000, x4.448, x9.80665 (ERR-04, GAP3-DLV-06)
- Plausibility bands applied at entry: E 190-210 GPa steel, 15-45 GPa concrete; densities 7850 and 2400 kg/m³; live loads 0.5-15 kPa; member lengths 0.3-60 m; delta T up to 60 C
- Secondary unit shown only when the task allows conversions (I18N-02 locked tasks show the working unit prominently and the converted value secondary)

**States:**
- Default, hover, focus (double ring), disabled, read-only (snapshot mode)
- Invalid dimension: error icon and message, value not committed, field keeps the typed text
- Implausible magnitude (ERR-04): warning with the conversion fingerprint and a one-click correction that is recorded as the learner's own edit
- Locked by task (CAT-04, TB-06): lock icon, tooltip 'Fixed by the task', control disabled and the API rejects edits
- Varies: placeholder 'Varies (n values)'; typing applies to all; a clear action restores per-entity values
- Pending: value committed, analysis re-running (field shows a subtle progress bar under the input)
- Builder section states: complete, incomplete, invalid with count, not applicable

**Interactions:**
- Expressions such as '2*3.5 m' or '12.5 kN·m' are parsed; units typed inline override the unit select
- Blur or Enter commits; Escape reverts; committing re-runs analysis within the live budget
- Unit select lists only compatible units; switching units converts the displayed value, never the stored SI value
- Section picker filters narrow as you type; Enter selects; favorites are per task
- Slider arrows step by 1% of range (Shift 10%); the numeric twin accepts exact values beyond the slider range up to the hard limits

**Keyboard and accessibility:**
- Every input has a visible label; units are part of the accessible name ('Distributed load w, kilonewton per metre')
- Validation messages are linked with aria-describedby and announced on blur; errors also set aria-invalid
- Sliders always have a numeric twin (WCAG 2.5.7 dragging alternative); gizmo drags on the canvas have the same twin in the property panel
- Indeterminate checkboxes expose aria-checked mixed; segmented controls are radio groups
- Targets at least 24 px, 44 px in touch density; focus order matches visual order in the property panel (EDIT-02)

**Requirements:**
- WS EDIT-02
- WS MOD-02
- WS MOD-07
- LMS CNT-02
- LMS I18N-02
- DLV GAP3-DLV-05
- STR ERR-04
- STR CAT-04
- AUT TB-01
- AUT TB-06
- AUT LIB-01
- NFR ACC-01

## Screen: Notifications, toasts and mode banners

**Roles:** All personas; mode banners are seen by learners (exam, offline), instructors (preview, degraded AI, live view), admins and operators (view-as, impersonation) · **Route:** `/design/components/notifications`

One vocabulary for transient and persistent messaging: toasts for completed or failed actions, inline alerts for page state, fixed mode banners that cannot be dismissed, the grading status timeline, inbox items and the mandatory-reason dialog.

```
+----------------------------------------------------------------------------------+
| MODE BANNERS  fixed, persistent, not dismissable, one at a time by priority      |
| [EXAM MODE  Remaining 01:12:30  Hints off  Self-check off  Code checks off] plum |
| [PREVIEW AS LEARNER  seed 1842  nothing is recorded]             accent-soft     |
| [VIEW AS  jane@u.edu  read-only]  amber   [IMPERSONATING  ends in 42 min]  red   |
| [OFFLINE  saving locally; will sync]  inverse   [AI FEEDBACK DELAYED] amber      |
|----------------------------------------------------------------------------------|
| TOASTS  workspace: bottom-center above status bar; LMS: bottom-right; max 3      |
|   (i) 2 nodes merged: N4 into N3                              [Undo]   [x]       |
|   (v) Snapshot saved: Moment diagram, 1.2D + 1.6L                      [x]       |
|   (!) Live analysis paused: model above live tier.            [Run]    [x]       |
|   (x) Could not save to server. Changes are kept locally.     [Retry]  [x]  stays|
|----------------------------------------------------------------------------------|
| INLINE ALERT  (!) Score capped at 50% due to: mechanism (Critical)               |
| GRADING STATUS  (v)Submitted 14:02 - (v)Analyzed 14:02 - (v)Checked 14:03        |
|                 - (o)AI feedback pending - ( )Instructor review - ( )Released    |
| INBOX ROW   [grade] Grade released: Steel portal frame     2 h ago   (*) unread  |
| REASON DIALOG  Override 'Strength' 75 -> 60   Reason (required) [___________]    |
|                before/after shown; [Cancel] [Save override]                      |
+----------------------------------------------------------------------------------+
```

**Regions:**
- Mode banners: exam (plum, fixed in both themes), preview-as-learner, view-as-learner, impersonation with countdown, offline, degraded AI, staff live view, read-only tenant
- Toasts: type icon, one-sentence message naming the entity, optional single action (Undo, Retry, Run), close; placement rules per surface
- Inline alerts: page-level info/success/warning/danger with optional title and actions; gate variant for score caps
- Grading status timeline: submitted, analyzed, checked, AI feedback, instructor review, released, with timestamps in the offering timezone
- Inbox item: category icon (grade, due, review, discussion, announcement, extension), title, meta, unread dot
- Reason dialog: before/after summary, mandatory reason textarea, cancel and confirm (destructive variant in red)

**Key data:**
- Toast width 360 px, timeout 5000 ms, max 3 stacked; danger toasts persist until actioned
- Toasts are never used for grading outcomes; grades arrive through inbox notifications, the timeline and the feedback page
- Learner backlog message template (OPS-12): 'We received your submission for <task> at <time> (receipt <hash8>). Feedback is taking longer than usual; no action is needed. Next update at <time>.'

**States:**
- Toast: entering (180 ms, fade only under reduced motion), visible (5 s, paused on hover or focus), persistent (danger with action), stacked (max 3, oldest collapses)
- Banner: single active banner chosen by priority exam > impersonation > view-as > offline > degraded > preview > live view; others queue into the status bar as chips
- Timeline: done, current, pending, skipped (deterministic-only task), failed with retry note, degraded ('AI feedback delayed')
- Inbox: unread, read, grouped by day; empty 'No notifications yet'
- Dialog: reason too short (minimum 10 characters) disables confirm with a message

**Interactions:**
- Undo on a merge toast reverts the merge as one undo step (MOD-02)
- Retry on a save-failure toast re-attempts sync; the offline banner takes over if connectivity is lost
- Banner actions: exam shows nothing dismissable; impersonation has End session; preview has Change seed and Exit preview; degraded AI links to the manual grading path for instructors
- Timeline stages link to the receipt (hash) and, for instructors, to the job inspector
- Dialog confirm writes the audit event; the resulting provenance label updates in place

**Keyboard and accessibility:**
- Toasts use role status (polite) except danger which uses role alert; they never steal focus; F6 cycles to the toast region; Escape closes the focused toast
- Mode banners are landmarks (region with a label) at the top of the tab order and are never hidden by layout; the exam banner contrast is at least 4.5:1 and includes the lock icon plus text
- Timeline is an ordered list with the stage state in text ('Checked, done 14:03')
- Dialogs trap focus, return focus on close, and label the reason field as required
- Countdowns announce at 30, 10, 5 and 1 minutes (polite; assertive at 1 minute); the visible number never animates

**Requirements:**
- LMS NTF-01
- NFR AVL-03
- NFR PERF-05
- OPS GAP4-OPS-07
- OPS GAP4-OPS-08
- OPS GAP4-OPS-12
- AUT PV-01
- INTG GAP5-EXAM-02
- INTG GAP5-EXAM-03
- WS MOD-02
- NFR SBX-01
- AIG REV-02

## Screen: Grading feedback kit

**Roles:** Learners after release (formative: immediately with AI-provisional label); instructors and TAs in the review screen (adds confidence, flags, override controls) · **Route:** `/design/components/feedback`

The visual grammar of an explainable, contestable grade: total with pass mark, provenance and disclaimer labels, gate reasons, criterion cards with evidence, prioritized issues tied to evidence ids and clauses, and the one-tap usefulness prompt.

```
+----------------------------------------------------------------------------------+
| FEEDBACK  Steel portal frame   Version 2 of 3        Total 72 / 100   pass 60 |  |
| [AI-generated, confirmed by Dr. Ruiz on Nov 12]                                  |
| Automated feedback - not professional engineering advice.    Checks: us-aisc360  |
| (!) Score capped at 75% due to: Major - missing combination 0.9D + 1.0W          |
|----------------------------------------------------------------------------------|
| CRITERIA                       weight  score  provenance                         |
| (x) Strength                     25     15    AI proposed -> confirmed    [v]    |
|      B12 1.03 Flexure (LTB) [=========|X]  [AISC 360-22 §F2.2] [Show in model]   |
| (!) Loads and combinations       15      9    overridden by Dr. Ruiz  [reason v] |
| (v) Serviceability               10     10    deterministic check                |
| (o) Engineering judgment (memo)  15     --    AI feedback pending                |
|----------------------------------------------------------------------------------|
| ISSUES                                                                           |
| 1 [HIGH] Member B12 flexural utilization 1.03 under 1.2D + 1.6L + 0.5S           |
|   Action: increase section depth or add a brace at midspan to reduce Lb          |
|   [AISC 360-22 §F2.2]  EV-STR-0007          [Show in model] [Open explanation]   |
| 2 [MED]  Deflection L/228 exceeds L/240 at B7 under D + L                        |
| STRENGTHS (2)   NEXT STEPS (3)                                                   |
| Was this feedback useful?  [Yes] [No]      instructor variant: confidence 0.64   |
|                                              flags [near threshold] [override]   |
+----------------------------------------------------------------------------------+
```

**Regions:**
- Header: task, version n of N, total as a large tabular number with the pass mark tick on a thin bar, provenance label, D2 disclaimer line, checks pack line
- Gate alert: every cap or fail-task gate listed with severity and cause
- Criteria list: status glyph, title, weight, score, provenance (deterministic / AI proposed / confirmed by / overridden by / pending / carried), expandable evidence rows with DCR meters and clause chips
- Issues: numbered, priority chip (High/Med/Low), problem sentence with the entity, combination and value, action sentence, clause chip, evidence id, Show in model and Open explanation
- Strengths and next steps lists
- Usefulness prompt (one tap, shown once per release)
- Instructor-only strip: confidence bar with threshold tick, flag chips, override control opening the reason dialog, before/after values

**Key data:**
- Priority chips: High = fail-severity evidence or gate, Med = warn or major without gate, Low = advisory; the chip word is always printed
- Provenance vocabulary: 'Deterministic check', 'AI proposed', 'AI-generated, pending instructor review', 'AI-generated, confirmed by <name> on <date>', 'Overridden by <name>', 'Carried from version n', 'Manual grade'
- Total display: integer out of 100 with rubric rounding; pass threshold from the rubric; never animate the number

**States:**
- Provisional (formative): label 'AI-generated, pending instructor review'; judged criteria show scores with the provisional style (dashed border)
- Released (summative): label 'AI-generated, confirmed by <name> on <date>' or 'Overridden by <name>' per criterion
- Judged pending (LLM degraded, refusal, non-allowed language): criterion shows the pending glyph and 'AI feedback pending' or 'Awaiting instructor review'; never a 0
- Gated: cap alert at top; the capped total shows the uncapped value in a tooltip
- Changed since graded: banner 'Your working model differs from the graded version; showing the graded snapshot'
- Archetype variants: Analyze shows the per-field table (submitted, own model, reference when revealed, status, diagnosis); Check shows the key-versus-report matrix with misses, false positives and unsafe approvals; Diagnose lists seeded errors with found/fixed/missed and collateral changes; Design/Optimize as drawn
- Appeal state: 'Regrade requested, under review' chip in the header

**Interactions:**
- Show in model switches the workspace to feedback mode with the overlay, governing combination and numbered pin for that evidence record
- Expanding a criterion reveals the evidence rows using the same evidence table and DCR meter components
- Clause chips open the explanation page with the learner's own values
- Instructor override: reason dialog, total recomputes from rows, provenance updates, audit event written; bulk-accept is offered only for unflagged submissions
- Usefulness Yes/No posts the feedback_rated event and collapses with 'Thanks'

**Keyboard and accessibility:**
- Issues and criteria are real lists; each item's text includes severity, entity, reason and action so screen readers get the full finding without the canvas
- Pins on the canvas are decorative; the list is the accessible twin
- Provenance and disclaimer text are visible text, never only color or icon
- Confidence and flags are instructor-only and absent from learner markup (contract-tested)

**Requirements:**
- AIG LLM-04
- AIG XPL-01
- AIG REV-01
- AIG REV-02
- AIG AGG-02
- AIG LLM-06
- PRD-02
- PRD-03
- LMS GRD-03
- DLV GAP3-DLV-21
- DLV GAP3-DLV-22
- LIC GAP2-DIS-01
- MET-04
- ADR R11

## Screen: Motion and live-state rules

**Roles:** Design-system consumers; the live-state pill and stale treatment are seen by every workspace user · **Route:** `/design/patterns/motion`

Define durations, easing, the live analysis state machine and what reduced motion replaces, so motion carries state and never decorates numbers.

```
+----------------------------------------------------------------------------------+
| LIVE-STATE PILL   (*) Live 38 ms | (~) Solving... | (!) Stale | (||) Live paused |
|                   (x) Unstable: N4 free rotation | (o) Offline, saving locally   |
| edit --1 frame--> stale --debounce 30..100 ms--> solving --> fresh               |
|                                                      '--> error --> diagnostics  |
|----------------------------------------------------------------------------------|
| DURATIONS  fast 100 ms hover/focus | base 180 ms panels, toasts | slow 300 ms    |
|            camera frame-to-selection 300 ms eased | deformed loop 2000 ms period |
|            stale pulse 1200 ms (outline only) | toast auto-dismiss 5000 ms       |
| EASING     standard cubic-bezier(.2,0,0,1)  exit cubic-bezier(.4,0,1,1)          |
|----------------------------------------------------------------------------------|
| REDUCED MOTION (prefers-reduced-motion: reduce)                                  |
|  camera jumps | deformed shape static at max amplitude | no pulses or shimmer    |
|  toasts fade 100 ms | gizmo drag feedback unchanged (user-driven motion is fine) |
|----------------------------------------------------------------------------------|
| NEVER ANIMATE  numbers, DCR bars, legend bands, grade totals, countdowns         |
| ALWAYS SIGNAL  stale overlays desaturate to 40% + badge within one frame         |
+----------------------------------------------------------------------------------+
```

**Regions:**
- Live-state pill variants and the state machine from edit to fresh or error
- Duration and easing tokens with their single allowed use
- Reduced-motion substitutions per animation
- Never-animate and always-signal lists

**Key data:**
- Drag re-solve cadence at most every 100 ms; debounce 30 ms for commits; superseded requests never flip the pill to fresh in between
- Toast auto-dismiss 5000 ms, paused while hovered or focused

**States:**
- Fresh, stale, solving, paused, unstable/error, offline for the pill
- Normal motion and reduced motion for every animated element
- Deformed-shape animation: playing, paused, static-max (reduced motion), stopped (results stale)

**Interactions:**
- Animation play/pause and speed controls for the deformed shape; speed is a numeric field as well as a slider
- Clicking the pill opens the analysis details (timings, tier, DOF, warnings) or the diagnostics tray when in error
- Camera frame-to-selection (F) uses motion-camera; Home fit uses the same

**Keyboard and accessibility:**
- prefers-reduced-motion is honored by tokens, not per component; the deformed loop stops and shows the static maximum (RES-01)
- State changes are announced through text in the pill and a polite live region, never only by motion
- No flashing above 3 times per second anywhere; the stale pulse is a slow outline change and is disabled under reduced motion
- Users can disable the deformed animation and the stale pulse independently of the OS setting in Appearance settings

**Requirements:**
- WS EDIT-06
- WS EDIT-01
- WS RES-01
- WS VIEW-01
- WS NFR-3D-02
- NFR SBX-01
- NFR ACC-01
- SIM-ARCH-06

## Screen: Density and responsive layout

**Roles:** Design-system consumers; rules govern laptops in lecture halls (primary), tablets (read-only), phones (reading only) · **Route:** `/design/patterns/layout`

Set the three density modes and the breakpoint behaviour so the workspace keeps a usable canvas at 1280x720 and the LMS stays complete down to 1024 px.

```
+----------------------------------------------------------------------------------+
| DENSITY   compact row 28 / control 28  |  default 36 / 32  |  comfortable 44 / 40 |
| auto: workspace panels compact; LMS pages default; coarse pointer -> comfortable |
|----------------------------------------------------------------------------------|
| >= 1600 xl  | tools | left panel 320 |      canvas >= 60%       | right dock 320 | |
| 1280-1599 lg| tools | one panel 320  |      canvas >= 60%       | rail 40        | |
| 1024-1279 md| banner: 'Window is below 1280 px; panels open as drawers'          |
|             | LMS pages: full features, 12-col grid, max 1280, 24 px gutters     |
| 640-1023 sm | tablet: read-only workspace (orbit, probe, results, feedback);     |
|             | 44 px targets; LMS single column                                   |
| < 640       | phone: content, grades, feedback text, notifications; workspace    |
|             | shows 'Open this task on a laptop' card                            |
|----------------------------------------------------------------------------------|
| WORKSPACE VERTICAL BUDGET at 720 px: exam banner 40 + toolbar 44 + status 28     |
|   -> canvas 608 px; HUD panels never exceed 25% of canvas height                 |
| PANELS resizable 280..480, collapse to 40 px icon rail, state persisted per user |
+----------------------------------------------------------------------------------+
```

**Regions:**
- Density table with row and control heights and the automatic selection rule
- Breakpoint table: xl two panels, lg one panel plus rail, md banner and drawers, sm tablet read-only, phone reading only
- Vertical budget at the minimum viewport
- Panel sizing and persistence rules

**Key data:**
- Grid: 12 columns, 24 px gutters, page max 1280 px on LMS pages; the workspace is full-bleed
- PRD-01 above-the-fold check: on a 1366x768 task page the scenario summary, constraints, rubric summary, attempts remaining and deadline fit above 768 px at default density

**States:**
- Workspace at or above 1280: full layout; below 1280: banner plus drawers; no horizontal scrolling at any width
- Tablet: read-only workspace with comfortable density; edit tools hidden rather than disabled
- Phone: LMS reading surfaces only; workspace replaced by a card with the task summary and a 'send link to my laptop' action
- Panels: open, collapsed to rail, resized; layout reset from the view menu

**Interactions:**
- Density is a user setting (Auto/Compact/Default/Comfortable); Auto follows surface and pointer type
- Panel edges drag between 280 and 480 px; double-click resets; the canvas never drops below 60% width while one panel is open
- Drawers at md slide over the canvas and close on Escape or outside click

**Keyboard and accessibility:**
- Reflow without loss at 200% zoom on LMS pages (treated as the md breakpoint)
- Drawer open/close is reachable from the toolbar with the same shortcuts as panels; focus moves into the drawer and returns on close
- Touch density guarantees 44 px targets and enlarged gizmo handles; pointer-type detection switches pick tolerances

**Requirements:**
- WS INP-02
- WS NFR-3D-07
- LMS NFR-10
- NFR BRW-01
- PRD-04
- PRD NFP-04
- PRD-01
- WS INP-01

## Screen: Accessibility rules sheet

**Roles:** Design-system consumers; enforces WCAG 2.2 AA for all non-canvas UI and the parity path for the canvas · **Route:** `/design/patterns/accessibility`

Make focus, contrast, screen-reader text for canvas state, forced-colors behaviour, target sizes and the keyboard map concrete and testable.

```
+----------------------------------------------------------------------------------+
| FOCUS   [ Run analysis ]  double ring: 2 px surface + 2 px accent (any bg)       |
|         canvas container focused: 2 px dashed accent inset; focus never trapped  |
|         sticky headers use scroll-margin so focus is never obscured (2.4.11)     |
| CONTRAST text >= 4.5:1 | large >= 3:1 | icons, borders, legend swatches >= 3:1   |
|         colored members: 1.5 px halo in inverse canvas color (both themes)       |
|----------------------------------------------------------------------------------|
| SCREEN READER TEXT FOR THE CANVAS                                                |
|  name  '3D model viewport: Steel portal frame'                                   |
|  desc  '24 nodes, 41 members, 3 supports, 4 load cases. Active combination       |
|        1.2D + 1.6L + 0.5S. Overlay: utilization. Max displacement 12.3 mm at N7; |
|        max utilization 1.03 in B12 (flexure, AISC 360-22 §F2.2); 1 member over   |
|        1.00.'                                                                    |
|  status (polite)  'Results updated' | 'Results stale, solving' | 'Live paused'   |
|  selection (status bar now, live region v1.x) 'Selected member B12, W14x30,      |
|        6.00 m, N3 to N4'                                                         |
|----------------------------------------------------------------------------------|
| FORCED COLORS  chrome in system colors; results in pattern-only mode: bands by   |
|   hatch pitch 10..2 px and isolines; overlay severity by dash pattern            |
| TARGETS >= 24 x 24 px; touch 44; every drag has a numeric twin (2.5.7)           |
| KEYBOARD  Tab toolbar > canvas > panels | arrows orbit | Shift+arrows pan        |
|   + / - zoom | F frame | Home fit | 1-7 views | 5 ortho | Esc select | ? help    |
|   Ctrl/Cmd+K palette | Ctrl+Enter run | tables: arrows, Enter fly-to, Space pick |
+----------------------------------------------------------------------------------+
```

**Regions:**
- Focus rules: double ring on any background, dashed inset ring on the canvas container, focus-not-obscured handling
- Contrast rules per element class and the halo rule for colormapped geometry
- Screen-reader text templates for the canvas name, description, status and selection
- Forced-colors behaviour and the pattern-only results mode
- Target sizes and dragging alternatives
- Global keyboard map shared with the command palette

**Key data:**
- Contrast pairs tested in CI: every --fg-* on every --bg-*, every --status-*-fg on --status-*-bg and on --bg-surface, --fg-on-accent on --accent-bg, mode banner fg on bg, in both themes
- CVD tests: adjacent utilization bands and all categorical pairs must remain distinguishable under deuteranopia, protanopia and tritanopia simulation (minimum luminance step or pattern difference)

**States:**
- Normal, high-contrast (forced colors), reduced motion, 200% zoom, touch
- Canvas unfocused: name and description only; focused: keyboard camera active and status announcements enabled
- Pattern-only results: on (forced colors or user), off

**Interactions:**
- '?' opens contextual help for the focused tool; Ctrl/Cmd+K opens the palette with every toolbar action and its shortcut
- Pattern-only mode can be toggled from the legend menu; the choice persists per user
- The textual model summary is also available as a panel (Model summary) for sighted users who prefer it

**Keyboard and accessibility:**
- axe-core in CI with zero serious or critical issues; manual NVDA+Chrome and VoiceOver+Safari passes per release on learner and instructor flows
- Keyboard-only completion of the reference 2D truss task through the tabular editor, command palette and results tables (R16 parity path)
- Live-region narration of every canvas change is v1.x; at MVP the status bar text and the model summary panel carry the same strings
- Shortcuts never conflict with browser defaults on macOS, Windows or Linux and are suppressed while text inputs have focus

**Requirements:**
- WS A11Y-01
- WS A11Y-02
- NFR ACC-01
- NFR ACC-02
- LMS A11Y-01
- LMS A11Y-02
- INTG GAP5-EXAM-03
- ADR R16
- WS EDIT-04

## Screen: Copy, units and citations sheet

**Roles:** Writers, engineers, content authors; rules apply to UI strings, generated feedback, help pages and exports · **Route:** `/design/patterns/copy`

The copy contract: unit display sets and precision, clause citation format, combination formatting, status vocabulary, AI labels, disclaimer placement and voice.

```
+----------------------------------------------------------------------------------+
| UNITS    quantity   | SI display | US display | precision                        |
|          force      | kN         | kip        | 3 s.f. (4 in tables/exports)     |
|          moment     | kN·m       | kip·ft     | 3 s.f.                           |
|          stress     | MPa        | ksi        | 3 s.f.                           |
|          length     | m, mm      | ft, in     | 0.001 m / 0.1 mm / 0.01 in       |
|          area load  | kN/m²      | psf        | 3 s.f.                           |
|          line load  | kN/m       | kip/ft     | 3 s.f.                           |
|          DCR        | 0.00       | 0.00       | 2 dec; 3 when rounding hits 1.00 |
|          span ratio | L/412      | L/412      | integer                          |
|----------------------------------------------------------------------------------|
| CLAUSES  '<Code> <edition> §<clause>'   AISC 360-22 §F2.2 | ASCE 7-22 §2.3.1     |
|          ACI 318-19 §9.6.1.2 | IBC 2024 Table 1604.3 | EN 1993-1-1:2005 §6.3.2.2 |
|          equations 'AISC 360-22 Eq. F2-1'; never quote text; always link out     |
| COMBOS   1.2D + 1.6L + 0.5S   0.9D − Ev + Eh   (spaces, true minus, 'governing') |
| STATUS   Pass | Warn | Fail | Not checked | Error | Pending review               |
| SEVERITY Advisory | Minor | Major | Critical                                     |
| AI       'AI-generated, pending instructor review' / 'confirmed by <name>'       |
| D1-D5    workspace badge + export footers | AI panels | certificates | API | Credits|
| VOICE    direct, second person, sentence case, name the entity and the fix       |
+----------------------------------------------------------------------------------+
```

**Regions:**
- Units and precision table per quantity and display set
- Clause citation format with examples per code family and the no-verbatim rule
- Load combination formatting
- Status and severity vocabulary
- AI labels and disclaimer placement map (D1-D5)
- Voice and sentence patterns for errors, empty states and buttons

**Key data:**
- D1 (workspace, exports): 'Educational use only. Not for construction, permitting, or professional engineering use. Results are not a substitute for analysis and design by a licensed engineer.'
- D2 (AI feedback): 'This feedback was generated automatically by an AI grader and is not professional engineering advice.' plus 'Reviewed by <instructor> on <date>' or 'Not yet reviewed by an instructor'
- D3 (certificates): 'This certificate recognizes completion of educational activities on Bridle. It is not a professional license, credential, or certification of engineering competency and does not by itself confer PDH/CEU credit.'
- D4 (API): envelope field disclaimer {code: EDU_ONLY_V1, text: D1} plus code_pack_version and verification_status; header X-Bridle-Disclaimer: EDU_ONLY_V1
- D5 (Credits): 'Bridle is not affiliated with or endorsed by ASCE, AISC, ACI, CEN, or ASEP. Clause references are provided for study; consult the official standards.'
- Sandbox watermark: 'Bridle free sandbox - educational use only - not for construction'
- Pack provenance line under evidence and feedback: 'Checks: us-aisc360-22@1.3.0 · verified <date>' and 'Clause references validated against pack us-asce7-22@1.3.0'

**States:**
- Locked unit task: working unit shown first, converted value secondary and dimmed
- Clause explanation disabled (takedown flag): chip shows the id and link-out only
- Degraded AI: judged text replaced by 'AI feedback pending' with the reason for instructors
- Sandbox tenant: watermark string on every export

**Interactions:**
- Copy rules are enforced by lint on string resources (units regex, forbidden words for the grader, missing timezone on deadline strings)
- The sheet links each rule to the components that implement it

**Keyboard and accessibility:**
- Every status icon has sr-only text equal to the status word
- Units are expanded in accessible names (kN read as kilonewton) while the visible text stays abbreviated
- Deadline strings always carry the timezone label; countdowns carry the absolute time in a tooltip and in the accessible name

**Requirements:**
- LMS I18N-02
- SIM-UNT-01
- AIG XPL-03
- AIG LLM-04
- LIC GAP2-TXT-01
- LIC GAP2-TXT-02
- LIC GAP2-DIS-01
- PRD-02
- LMS SCH-01
- DM GAP1-DM-05
- STR GRD-02
- STR GRD-03
- NFR-DOM-09

## Flow: Theme, density and canvas-theme resolution (Any user; the export pipeline for screenshots)

1. Before first paint an inline script reads prefers-color-scheme and the stored preference and sets data-theme on the html element so there is no theme flash
2. Settings > Appearance offers Theme (System/Light/Dark), Density (Auto/Compact/Default/Comfortable) and Canvas background (Auto/Light/Dark); Auto density resolves to compact inside workspace panels, default elsewhere and comfortable when the primary pointer is coarse
3. The workspace mounts with data-canvas-theme resolved from the canvas setting, independent of the UI theme; the renderer reads viz-palette.json so canvas colors equal legend colors
4. Screenshots and exports (CAP-01) render with data-canvas-theme=print, legend and title block on, selection and hover suppressed; the sidecar records overlay, case, legend min/max and the palette version
5. Mode banners use fixed mode tokens; the exam banner is identical in light and dark so required snapshots look the same for every learner
6. Tenant branding (v1.x) may swap the logo only; accent, status and viz tokens remain platform-fixed

Failure paths:
- prefers-color-scheme unavailable or storage blocked: default to light
- forced-colors active: the theme choice is ignored; chrome uses system colors and results switch to pattern-only mode
- WebGL context lost: the canvas shows --canvas-bg with a 'Restoring graphics' pill while the HUD stays interactive; recovered within 2 s without data loss
- A branding payload tries to set a status or viz color: rejected by the branding schema

## Flow: From a colored member to a cited number (Learner in the workspace (same path for an instructor in the review screen))

1. Learner enables the Utilization overlay; the legend appears bottom-right titled 'Utilization, combined · 1.2D + 1.6L + 0.5S' with ten bands, the hatched tolerance band and the hatched over band
2. Hovering member B12 shows a readout chip 'B12 · 1.03 · Flexure (LTB) · 1.2D + 1.6L + 0.5S' and the hover outline
3. Clicking with the Probe tool pins a probe card with the value, governing check and clause chip; the card follows the entity
4. Opening the results dock shows the evidence table with row B12: status Fail, DCR meter 1.03 with hatched overflow, limit 1.00, margin −3%, governing combination chip, clause chip AISC 360-22 §F2.2
5. Clicking the clause chip and Open explanation shows the help page generated from the clause library with the learner's own Mu, φMn, Lb and Cb beside the paraphrased explanation and an Official source link-out
6. Show in model frames B12 in 300 ms (instant under reduced motion) and switches the active combination to the governing one

Failure paths:
- Results stale: the readout shows the previous value with a Stale badge and desaturated overlay; probe cards show 'updating'
- Check unverified (VER-02): status 'Not scored', dashed gray meter, badge 'Unverified check'; excluded from totals
- Clause explanation disabled by a takedown flag: the chip renders the id and link-out only with the tooltip 'Explanation temporarily unavailable'
- Exam profile hides code checks: the overlay toggle shows an Off badge, no legend renders and the client never requests check data
- The display rounds to the limit (1.004 shows as 1.00) while the SI comparison fails: the display switches to three decimals and the status stays Fail

## Flow: Grader feedback overlay linkage (Learner after release; instructor or TA in review)

1. The feedback panel lists issues with priority chips, each carrying an evidence id, an action sentence and a clause chip
2. Show in model switches the workspace to feedback mode: overlay toggles reflect the evidence visual payload (utilization or deflected shape at the governing combination) and the active combination is set from the evidence record
3. The subject entity receives the severity outline (fail solid 3 px red, warn dashed amber, note dotted blue) and a numbered pin matching the list; the camera frames it
4. The DCR meter card in the dock shows the same evidence record (same evidence id) as the feedback issue
5. If the working model's hash differs from the graded snapshot, a banner 'Model changed since graded; showing the graded snapshot (read-only)' appears and the overlay renders on the snapshot
6. In the instructor variant the confidence bar, flag chips and override control appear; after an override the provenance label changes to 'Overridden by <name>' and the total recomputes from rows

Failure paths:
- Entity no longer exists: the issue row reads 'Entity N7 no longer exists' with a 'View as of submission' action that opens the snapshot
- Different archetype: Analyze, Check and Diagnose lists swap in field rows, the findings matrix or seeded errors but keep the same pin, outline and chip language
- Screen reader: the issues list is a real list with severity, entity, reason and action in text; canvas pins are aria-hidden

## Flow: Unit-aware entry and display-unit switching (Learner (property panel, deliverables) or author (task builder))

1. The field shows its label, expected dimension and the task's working unit; a locked unit shows a lock icon with the tooltip 'Working units fixed by the task'
2. The learner types '2*3.5 kN/m'; the parser evaluates the expression, converts to SI for validation and storage, and shows '= 7.00 kN/m' with the secondary unit '(0.480 kip/ft)'
3. Blur or Enter commits; the property panel re-runs analysis within the live budget; the value renders with three significant figures and tabular digits
4. Switching display units from the status bar converts every visible value, including historical feedback and tables, without re-analysis; thresholds are compared in SI

Failure paths:
- Dimension mismatch ('12.5 kN·m' in a force field): inline error 'Expected a force; kN·m is a moment', value not committed
- Implausible magnitude (ERR-04): warning 'Unusually large. Looks like psf entered as kPa (x47.88)?' with a one-click correction recorded as the learner's own edit
- Expression parse error: 'Could not read 2x3.5; use 2*3.5 m'
- Locked material or geometry (CAT-04): control disabled with the lock tooltip; the API rejects the edit if bypassed

## Flow: Live analysis states and diagnostics (Learner editing a model)

1. An edit commits: within one frame result overlays desaturate to 40% and the live-state pill shows 'Stale'; diagrams keep the last values dimmed
2. After the 30 to 100 ms debounce the pill shows 'Solving…' with an indeterminate bar (static under reduced motion)
3. Fresh results repaint at full saturation; the pill shows 'Live 38 ms' and the status bar live region announces 'Results updated'
4. On ENG-SINGULAR the overlays clear to ghost, the pill reads 'Unstable: N4 free rotation', the diagnostics tray opens with the entry and the entity receives the error outline; clicking flies to it and Fix applies the auto-fix as one undo step
5. A Tier M model over budget switches the pill to 'Live paused' with a Run button (Ctrl+Enter); overlays stay in the stale style until run

Failure paths:
- Worker crash: toast 'Analysis restarted; last results kept' and automatic restart
- Offline: offline banner; edits and local autosave continue; the status bar shows queued saves
- Cancellation storms during a drag: the pill stays on 'Solving…' and never flickers to fresh between superseded requests

## Flow: Exam mode visual transition (Learner (instructor in preview-as-learner))

1. A pre-start screen generated from the exam profile lists the window and duration, the disabled tools with Off badges, the recorded fields, the collaboration and AI-use policy and the pledge; the learner takes an explicit Start action
2. On start the fixed exam banner (40 px, plum background, white text, z 80) shows the task title, countdown and 'Hints off · Self-check off · Code checks off' chips; it sits above dialogs and full-screen canvas
3. Toolbar tools that carry data are disabled with Off badges and tooltips naming the policy; the utilization overlay toggle is removed from the HUD and the legend never renders
4. The countdown resyncs to server time every 30 s; polite announcements at 30, 10 and 5 minutes and an assertive one at 1 minute
5. Required snapshots captured in exam mode include the banner
6. The review view shows the attestation as a green, amber or red summary chip with reasons; platform faults are labeled 'platform', never the learner

Failure paths:
- Second session: 'Session already active' screen with a take-over action
- Network loss: the countdown keeps running from the last server time and resyncs on reconnect
- Operations after close: rejected with the toast 'Exam closed at 15:00 (America/Chicago); your last accepted draft was submitted'
- Restricted artifact served by mistake: attestation shows platform_fault; the learner UI is unaffected

## Flow: Token change governance (Designer or engineer changing tokens.json)

1. Edit packages/ui/tokens/tokens.json (the only source); the PR template requires the role and contrast pair for any new token
2. The build emits tokens.css (custom properties), tokens.ts (typed names) and viz-palette.json consumed by the WebGL renderer and the HTML legend
3. CI runs contrast tests for every fg/bg pair per theme, colour-vision simulation for adjacent utilization bands and categorical sets, a stylelint rule against raw hex in components, and visual regression of the token sheet and the canvas reference scenes in light, dark and print
4. The docs site regenerates the token sheet with the new build hash; release notes tag the change cosmetic unless a viz token changed, which tags it a behaviour change and requires a --viz-palette-version bump recorded in screenshot sidecars

Failure paths:
- Contrast or CVD test fails: the PR is blocked with the failing pair and simulated mode listed
- A viz token changes without a palette version bump: the build fails
- A component references a raw hex or a primitive token: stylelint fails the build

## Components

| component | purpose | variants and states |
|---|---|---|
| Button | Primary, secondary, tertiary and danger actions with density-aware sizing | primary (accent), secondary (outline), tertiary (text), danger (red, destructive only); sizes from density tokens; hover, active, focus-visible (double ring), disabled, loading ('Working…' text under reduced motion); icon-only requires aria-label and tooltip |
| StatusChip | Check status and severity as icon plus word | pass, warn, fail, not checked, error, pending; severity variant advisory/minor/major/critical with 0-3 bar glyph; compact table variant shows the icon with sr-only text and a tooltip |
| ClauseChip | Clause citation with paraphrased title, explanation and official link-out | validated (default), link-out only (explanation flag off), unverified (dashed border, authoring previews only), inline-in-prose; tooltip shows the paraphrased title and pack version; actions Open explanation and Official source |
| CombinationChip | Load combination formula with type and governing marker | strength, service, seismic tags; 'governing' word plus star; envelope variant 'Envelope (12 combos)'; truncates with the full formula in a tooltip |
| LoadCaseChip | Load case identity by color dot, letter and name | selected, unselected (dimmed when hidden), legend row variant with the glyph shapes used |
| DcrMeter | Demand-to-capacity ratio as a bar against the 1.00 limit | cell (8 px track) and card (with named values and clause); pass, tolerance 1.00-1.02 (hatched amber), over (hatched red with outline), over beyond 1.20 (clamped with arrow), unverified (dashed gray), not applicable (empty with en dash), stale (desaturated) |
| ColormapLegend | Legend for utilization and other scalar overlays, rendered in HTML and in screenshots | vertical and horizontal; banded (5/10/20) or smooth; editable min/max; target bracket for Design/Optimize; pattern-only; stale; hidden by exam profile; screenshot variant without controls |
| EvidenceTable | Sortable, filterable list of GradeEvidence records synced with canvas selection | workspace dock (compact) and review screen (default); loading skeleton, empty, error, partial (judged pending), unverified rows, stale header, selected row; virtualized above 200 rows |
| CriterionCard | One rubric criterion with score, weight, provenance and evidence | learner and instructor variants; scored, pending (AI), overridden (before and after), gated (cap banner), carried from a previous grade version; collapsed and expanded |
| ProvenanceLabel | States who or what produced a score or text and the review status | Deterministic check; AI proposed; AI-generated, pending instructor review; AI-generated, confirmed by <name> on <date>; Overridden by <name>; Carried from version n; Manual grade |
| ConfidenceIndicator | Instructor-only confidence bar with threshold and flag reasons | bar 0-1 with the course threshold tick; flag chips for low confidence, near threshold, critical gate, injection, contradiction, refusal, validator fallback, integrity; absent from learner markup |
| ReceiptChip | Submission or model hash as a verifiable receipt | mono 'sha256:3f9a…c21e' with copy; verify states matches and mismatch; includes version number and offering-timezone timestamp in the receipt row |
| UnitInput | Numeric entry with dimension-aware unit select, expressions and conversions | default, focus, invalid dimension, implausible magnitude (warning with fix), locked, varies (mixed selection), read-only, pending (analysis running); convention hint variant with tension/compression selector |
| SectionPicker | Search and select catalog sections with property preview | family, depth and weight filters; favorites; no results; library version chip; locked catalog (allow-list) shows disabled rows with the constraint reason |
| SliderWithInput | Continuous control with an exact numeric twin | linear and logarithmic; keyboard step 1% (Shift 10%); numeric field accepts values beyond the slider range up to hard limits; used for deformation scale, diagram scale and legend bounds |
| SegmentedControl, Toggle, Checkbox, Radio, Select, Combobox | Standard controls at density-aware sizes | checkbox indeterminate for mixed selections; toggle for live mode; segmented for LRFD/ASD and banded/smooth; all with 24 px minimum targets and 44 px in touch density |
| FormSection | Task-builder section with completion state and right-rail validation | complete, incomplete, invalid with count, not applicable; validation list mirrors the publish gate |
| InlineValidation | Error, warning and info messages under a field | error (aria-invalid), warning, info; linked by aria-describedby; never color only |
| Toast | Transient confirmation of an action or a recoverable failure | info, success, warning, danger; single action (Undo, Retry, Run); persistent danger; stack of three; paused on hover or focus; placement bottom-center in the workspace and bottom-right on LMS pages |
| InlineAlert | Page-level state that stays until resolved | info, success, warning, danger; gate variant 'Score capped at … due to: …'; with or without actions |
| ModeBanner | Persistent, non-dismissable statement of an exceptional mode | exam (plum, identical in both themes), preview-as-learner, view-as, impersonation with countdown and End session, offline, degraded AI, staff live view, read-only tenant; one at a time by priority, others as status-bar chips |
| GradingStatusTimeline | Shows where a submission is in the pipeline | stages submitted, analyzed, checked, AI feedback, instructor review, released; states done, current, pending, skipped, failed, degraded; timestamps in the offering timezone |
| NotificationItem | Inbox row for the roughly six MVP notification events | unread, read; categories grade, due, review requested, discussion, announcement, extension; grouped by day |
| ReasonDialog | Confirmation with a mandatory reason for grade-affecting or operator actions | default and destructive; before/after summary; reason minimum 10 characters; focus trapped and returned |
| CanvasHudPanel | Solid HTML panels in the viewport corners | case/combination switcher with overlay toggles, view cube with presets, plane/snap/coordinates readout, legend; collapsed and expanded; never blurred so screenshots are deterministic |
| LiveStatePill | The live analysis state in words | fresh with timing, solving, stale, paused with Run, unstable/error naming the node and DOF, offline; announces changes through a polite live region |
| ProbeCard | Pinned readout anchored to an entity | value, quantity, case and clause; follows the entity; stale; maximum ten; closable by button or Delete when focused |
| SnapIndicator | Shows the active snap target and coordinates before a click | node, member end, midpoint, grid intersection, member intersection, perpendicular, grid line, increment; Shift-disabled state; tooltip with world coordinates |
| EntityGlyphs | Screen-space glyphs for supports, releases, loads and locks | pin triangle, roller circle with direction arrow, fixed hatched block, spring zigzag; release hollow circle; load arrow, double-headed moment, distributed fan with magnitudes, hatched area; locked entity at 70% alpha with a padlock badge; 24-40 px on screen |
| OverlayPin | Numbered marker for grader findings and diagnostics on the canvas | fail, warn, note styles; numbered to match the list; hover shows the finding title; aria-hidden with the list as the accessible twin |
| DiagnosticItem | One validation or engine finding with a fix | error (blocks analysis) and warning; rule code (VAL-*, ENG-*); Fly-to and Fix actions; resolved items fade out |
| MemoSectionCard | Structured memo section with prompt, bounds and provenance notice | within bounds, soft-bound warning, hard-bound block; LaTeX preview; figure insertion from snapshots; paste provenance notice; plain-text fallback mode |
| SubmissionChecklistItem | Deliverable completeness before submit | complete, incomplete with reason, invalid; hard-required and soft-required markers; late penalty preview row; receipt row after submission |
| EmptyState | Content-first empty views with one action | no results yet, no findings yet, no notifications, no tokens match; engineering-specific copy naming the next step |
| Skeleton | Loading placeholders | row, card, canvas; shimmer disabled under reduced motion |
| Tooltip | Supplementary detail on hover, focus and long-press | 300 ms delay; dismissible with Escape; never the only place for required information |
| HelpAffordance | Contextual help entry on every tool, panel and dialog | icon button bound to a help id; keyboard '?' opens the page for the focused tool |
| DisclaimerBadge | D1 badge in the workspace status bar and full-text footers on exports and AI panels | collapsed badge (expands on hover and focus), export footer, AI panel line (D2) with review status, certificate (D3), Credits (D5), sandbox watermark |

## Content and copy

- Voice: plain, direct and engineering-literate; second person for guidance ('Add a support at N4'); third person for system facts; sentence case; no exclamation marks, no jokes, no 'oops'.
- The grader is never described as an engineer: the words engineer, PE, SE, certified and approved are forbidden for the AI or the platform's checks; use 'AI grader', 'automated checks' and 'instructor'.
- Status vocabulary is fixed: Pass, Warn, Fail, Not checked, Error, Pending review; severity: Advisory, Minor, Major, Critical; never OK, Good or Bad.
- Units: the task's display set is used everywhere; SI-engineering kN, kN·m, MPa, mm and m, kN/m², kN/m; US customary kip, kip·ft, ksi, in and ft, psf, kip/ft; a thin space (U+2009) precedes the unit, the middle dot (U+00B7) joins products, superscripts are ² and ³; never KN, Kn or kNm.
- Significant figures: forces, moments, stresses and pressures 3 s.f. (4 in tables, probes and exports); deflections 0.1 mm or 0.01 in; coordinates 0.001 m or 0.01 ft; DCR 2 decimals; L/x integer; percent 0 decimals (1 decimal below 10%); angles 0.1 degree; mass 3 s.f.; cost integer currency.
- Limit-rounding rule: comparisons happen in SI; when the rounded display equals the limit but the comparison result differs from what the display suggests, show one more significant figure so the number explains the status (1.004 Fail, never 1.00 Fail).
- Negative numbers use the true minus (U+2212); ranges use the en dash; thousands and decimal separators follow the user's locale through ICU, but unit symbols are never translated.
- Clause citation format: '<Code> <edition> §<clause>' (AISC 360-22 §F2.2, ASCE 7-22 §2.3.1, ACI 318-19 §9.6.1.2, EN 1993-1-1:2005 §6.3.2.2); tables 'ASCE 7-22 Table 12.12-1'; equations 'AISC 360-22 Eq. F2-1'; the chip shows the id only, the paraphrased title lives in the tooltip, standard text is never quoted, and an official-source link-out always accompanies the id.
- Pack provenance lines appear under evidence and feedback: 'Checks: us-aisc360-22@1.3.0 · verified <date>' and 'Clause references validated against pack us-asce7-22@1.3.0'; the Credits page carries the D5 non-affiliation statement and dataset attributions.
- Load combinations are written '1.2D + 1.6L + 0.5S' and '0.9D − Ev + Eh' with spaces around operators, case letters as defined by the pack, and the word 'governing' next to the governing combination (a star alone is never enough).
- Entities are referred to by label, never by opaque id: 'member B12', 'node N7', 'support at A'; the opaque id is available in a tooltip for support tickets.
- Error messages state what is wrong, where, and the fix: 'Unstable: node N4 can rotate freely (all connected members released). Add a rotational restraint or remove a release.'
- Live-state words: 'Live 38 ms', 'Solving…', 'Stale', 'Live paused — Run (Ctrl+Enter)', 'Unstable: N4 free rotation', 'Offline — saving locally'.
- AI labels (PRD-02, D2): 'AI-generated, pending instructor review' or 'AI-generated, confirmed by <name> on <date>', always with 'Automated feedback — not professional engineering advice' and either 'Reviewed by <name> on <date>' or 'Not yet reviewed by an instructor'.
- Disclaimer placement: D1 as a persistent badge in the workspace status bar (expanding to the full text) and in every export footer, CSV header comment and JSON metadata field; D2 on every AI panel; D3 on certificates; D4 in API envelopes and the response header; D5 on Credits; the sandbox watermark on sandbox exports.
- Gates are always spelled out: 'Score capped at 50% due to: mechanism (Critical)'; every gate reason is listed and the uncapped value is available in a tooltip.
- Deadlines carry the offering timezone label: 'Due Nov 14, 2026, 23:59 (America/Chicago)'; relative forms 'due in 2 d 4 h' and 'overdue by 3 h' always sit next to the absolute time; UTC is stored, never shown.
- Receipts: 'Receipt sha256:3f9a…c21e' (first and last four hex digits) with a copy action and 'Submitted Nov 12, 14:02 (America/Chicago), version 2 of 3'.
- Exam copy: 'Exam mode', 'Hints off', 'Self-check off', 'Code checks off', 'Remaining 01:12:30', 'Exam closed at <time>'; the pre-start screen lists recorded fields verbatim from the profile so text can never disagree with enforcement.
- Empty states are one sentence plus one action: 'No results yet. Add a support and a load to run the analysis.'; 'No findings reported. Add a finding for each member in scope (3 remaining).'
- Buttons are verb-first and specific: 'Run analysis', 'Show in model', 'Open explanation', 'Save override', 'Submit version 2'; never OK or Yes as the only label.
- Numbers in prose are digits ('3 members', '1 node'); percentages attach the sign and symbol ('−3%'); counts of findings precede the noun ('2 warnings').
- Terminology: 'load case', 'load combination', 'utilization' in learner copy (the meter label 'DCR' carries the tooltip 'demand-to-capacity ratio'); 'section', not 'profile'; 'working units', not 'unit system'.
- Accessibility text: every status icon has sr-only text equal to the status word; the legend has a description ('Utilization legend: 10 bands from 0 to 1.00; hatched band 1.00 to 1.02 tolerance; red hatched above 1.02'); the canvas description follows the model-summary template on the accessibility sheet.

## Open questions

- Default UI theme for the workspace: follow the OS (proposed) or dark by default as in many CAD tools? And is the independent canvas-theme setting wanted at MVP, or should the canvas simply follow the UI theme until v1.x?
- Confirm cividis over viridis for utilization with the design-partner instructors; several teaching tools use a green-yellow-red ramp that this system deliberately rejects (red is reserved for failure), so expectation-setting may be needed.
- Should the 1.00-1.02 tolerance band (GRD-03) be visible in the live colormap and self-check, or only in grading evidence? Proposed: visible and labeled 'tolerance' so the self-check matches the grader exactly.
- Default sign conventions and colors for diagrams (positive moment drawn on the tension side; tension orange, compression blue) need structural-domain sign-off alongside the DLV open question on learner-reported sign conventions.
- Tenant branding (TEN-01, v1.x): logo only (recommended) or logo plus accent hue? Status and viz tokens must stay fixed in any case.
- Fonts: Inter, JetBrains Mono and KaTeX fonts are OFL; confirm self-hosting under the strict CSP (no third-party font CDN) and the subset list (latin, Greek letters, engineering symbols) against the 300 KB shell budget.
- Density default for data-heavy LMS pages (gradebook, review queue): default (proposed) or compact on laptops?
- Exam banner color (plum) is reserved for exam mode only; confirm with the pilot institution's integrity office that it should also appear on LMS pages during an exam window, not only in the workspace.
- Pattern-only (isoline/hatch) results mode is listed as must in ACC-02; confirm the WebGL2 renderer can produce screen-space hatching within the Tier S/M frame budgets, otherwise ship pattern mode as a 2D overlay layer.
- Tablet read-only workspace (BRW-01) implies a comfortable density at MVP for tablets only; confirm whether comfortable density should be user-selectable on laptops at MVP or deferred to v1.x.

## Risks

- The darkest cividis band is invisible on a dark canvas and the brightest on a light one; mitigated by the mandatory 1.5 px halo in the inverse canvas color and visual regression of reference scenes on all three canvas themes.
- Hue collisions among the Okabe-Ito load-case colors, diagram component hues and axis colors; mitigated by letter tags, dimming load arrows to 30% while any ribbon overlay is on, an always-visible legend when overlays are on, and letters on gizmo handles.
- Display rounding could contradict a pass/fail status (1.004 shown as 1.00 Fail); mitigated by SI comparison before formatting, the extra-digit rule and snapshot tests with values at and near limits.
- Red fatigue: using red for selection, required fields or emphasis would dilute failure signaling; red is reserved for Fail, over-utilization and destructive actions, enforced by token naming and lint.
- Theme flash and screenshots that differ between users; mitigated by the pre-paint theme script, the print canvas theme for every export and the palette version recorded in screenshot sidecars.
- Forced-colors mode (Windows High Contrast) can blank WebGL fills; mitigated by pattern-only results, system colors for chrome and an HTML legend, tested in CI with forced-colors emulation.
- Token drift between CSS and the WebGL renderer; mitigated by one tokens.json generating both outputs and a test comparing legend swatches with rendered pixels.
- Web fonts on 20 Mbps lab networks delay time to interactive (PERF-02); mitigated by subsetting, font-display swap with size-adjusted fallbacks and lazy loading of KaTeX fonts only on memo and clause pages.
- Three density modes are expensive for a small team; ship compact and default at MVP, define comfortable tokens now and apply them only to the tablet read-only surface until v1.x.
- The exam banner, toolbar and status bar consume 112 px at 720 px height; verified in layout tests that the canvas keeps 608 px and HUD panels stay within 25% of canvas height, with the legend collapsing to a horizontal strip when needed.
