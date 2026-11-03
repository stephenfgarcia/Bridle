# GitHub

The remote is `origin` = `https://github.com/stephenfgarcia/Bridle.git`, a PUBLIC repository of the user's personal
account `stephenfgarcia`. The first push was on 2026-11-03 (10:18 UTC): `git push -u origin main` sent `3ea44db`
(28 commits, 137 tracked files, one author) to the empty repository and made `main` its default branch. Every
GitHub setting is the user's decision: no station writes a setting; the writes on record (two visibility
changes in item (a), the protection rule in item (e) and, at the ship of P0-02.3, the required status check added
to that rule) were made by the foreman with `gh` at the user's explicit instruction. No station needs a secret
(`docs/ops/secrets.md`); the factory pushes `main`, pushed the proof branches of P0-02.3 (`ci/p0-02-3`: the
repository's first branch and first pull request, item (f)) and, from P0-08, pushes lane branches and pull
requests as the rule; it reads settings with `gh api` to report them. What a station may run is in
`docs/ops/permissions.md`.

## Checklist

One line per item, ticked when done, ending with who does it: `(user)` the user's decision, applied by a click in
the GitHub UI or by the foreman with `gh` at the user's instruction, `(factory)` a station, `(automatic)` GitHub
itself. The two items marked `gate:` are the `manualGates` of card P0-06.3 (see
"Manual gates"). The state quoted as "today" was read with `gh api` on 2026-11-03 after the push.

- [x] (a) Visibility: PUBLIC (user). Two decisions by the user on 2026-11-03, both applied by the foreman with
  `gh repo edit stephenfgarcia/Bridle --visibility ...` at the user's instruction: private before the first push
  (10:12Z), then public (10:27:46Z) so that branch protection, item (e), becomes available on the free personal
  plan. Everything pushed is publicly visible (plan documents, tooling, cards, commit author email). To change it:
  Settings > General > Danger Zone > "Change repository visibility", then type the repository name to confirm;
  GitHub locks the repository for a few minutes after each change. Proof: `gh repo view stephenfgarcia/Bridle
  --json visibility --jq .visibility` = `PUBLIC`.
- [x] (b) Default branch `main` (automatic). Set by the first push: the repository was empty and `main` was the
  first branch to arrive. Proof: `gh repo view stephenfgarcia/Bridle --json isEmpty,defaultBranchRef --jq
  '[.isEmpty, .defaultBranchRef.name]'` = `[false,"main"]`.
- [ ] (c) Actions (user; gate: Actions enabled on GitHub). Settings > Actions > General: under "Actions
  permissions" select "Allow all actions and reusable workflows" (= `allowed_actions: all`, today's state); under
  "Workflow permissions" select "Read repository contents and packages permissions" and leave "Allow GitHub
  Actions to create and approve pull requests" unchecked (today: `default_workflow_permissions: read`,
  `can_approve_pull_request_reviews: false`); Save in each box. Proof: `gh api
  repos/stephenfgarcia/Bridle/actions/permissions --jq .enabled` = `true` (today
  `{"enabled":true,"allowed_actions":"all"}`). The workflow is `.github/workflows/check.yml` (name `check`; jobs
  `changes`, `code`, `docs` and the summary job `check`, the one required context; see "Actions workflow").
  Ticked at P0-02.3 by its docs-only proof pull request, which records the first run's URL here.
- [x] (d) Secrets and variables: none now (user). Settings > Secrets and variables > Actions: nothing to add
  before P0-02.3 (today: 0 secrets, 0 variables). Later, per the "GitHub Actions" column of `docs/ops/secrets.md`,
  each on the card that needs it: Variables tab > "New repository variable" for `AWS_OIDC_ROLE_ARN`,
  `TOFU_STATE_BUCKET` and `TOFU_LOCK_TABLE` (P0-05.2); Secrets tab > "New repository secret" for
  `SENTRY_AUTH_TOKEN` (P7-02). Everything else in that column is a service container or a per-run random value.
  The credential git pushes with must carry the `workflow` scope before P0-02.3 pushes `.github/workflows/`
  (GitHub refuses such a push without it); gh's token has it (`gh auth status` lists `workflow`), and `gh auth
  setup-git` makes git use that token instead of the `osxkeychain` entry (it edits `~/.gitconfig`: the user's
  decision, to be taken only if that push is refused).
- [x] (e) Branch protection on `main` (user; gate: branch protection on main). Precondition met on 2026-11-03 by
  item (a): on a free personal plan branch protection rules and rulesets exist only for public repositories (a
  private one answers HTTP 403 "Upgrade to GitHub Pro or make this repository public to enable this feature").
  Applied by the foreman at 10:33Z with `gh api -X PUT repos/stephenfgarcia/Bridle/branches/main/protection`
  (classic rule: pull request required with 0 approvals, force pushes and deletions blocked, admins not enforced
  so the owner's direct ship pushes still land until P0-08 moves shipping to pull requests). The required status
  check `check` (the summary job of `.github/workflows/check.yml`) is added at the ship of P0-02.3, after its
  proof pull request has merged and the context has reported once, with `gh api -X PATCH
  repos/stephenfgarcia/Bridle/branches/main/protection/required_status_checks -F strict=true -f 'contexts[]=check'`
  (`strict`: the branch must be up to date with `main`). If that answers 404 "Required status checks not enabled"
  (the rule holds no `required_status_checks` object yet), the fallback rewrites the whole rule with `gh api -X PUT
  repos/stephenfgarcia/Bridle/branches/main/protection --input <file>` holding exactly `required_status_checks:
  {strict: true, contexts: ["check"]}`, `enforce_admins: false`, `required_pull_request_reviews:
  {required_approving_review_count: 0}`, `restrictions: null`, `allow_force_pushes: false`, `allow_deletions:
  false`. The same rule in the UI: Settings > Branches > "Add classic branch protection rule", branch name pattern
  `main`, with exactly these values:
  - tick "Require a pull request before merging"; leave "Require approvals" unticked (0 approvals: a sole owner
    cannot approve their own pull request);
  - tick "Require status checks to pass before merging", add the `check` context, and tick "Require branches to be
    up to date before merging" (a required context nothing reports blocks every merge, so only after the workflow
    has reported once: at the ship of P0-02.3, never before);
  - leave "Do not allow bypassing the above settings" unticked until P0-08 makes shipping PR-based (unticked,
    the owner's credentials, which the factory uses, may still push `main` directly as the ship station does
    today; tick it at P0-08);
  - under "Rules applied to everyone including administrators": "Allow force pushes" unticked, "Allow deletions"
    unticked.
  The ruleset form of the same rule: Settings > Rules > Rulesets > New ruleset > New branch ruleset, Enforcement
  status "Active", Target branches "Include default branch", rules "Restrict deletions", "Block force pushes",
  "Require a pull request before merging" (Required approvals 0) and, after P0-02.3, "Require status checks to
  pass" with `check`; a bypass applies to the whole ruleset, so make two rulesets if the pull request rule needs a
  "Repository admin" bypass while force pushes stay blocked for everyone. Proof: `gh api
  repos/stephenfgarcia/Bridle/branches/main/protection --jq '{pr: (.required_pull_request_reviews != null),
  force: .allow_force_pushes.enabled, deletions: .allow_deletions.enabled, admins: .enforce_admins.enabled,
  checks: .required_status_checks.contexts}'` (prints `pr: true, force: false, deletions: false, admins: false,
  checks: ["check"]` from the ship of P0-02.3 on, `checks: null` before it; a 404 "Branch not protected" would
  mean the rule was removed). Ticked at the ship of P0-02.3, when the required check joins the rule.
- [ ] (f) Lane branches `lane/<name>` (factory, P0-08). One per worktree and foreman session, rebased on
  `origin/main`, pushed, merged by pull request, deleted after the merge; the `main` rule above does not match
  them. The flow, as P0-02.3 exercised it on its proof branch `ci/p0-02-3` (the repository's first branch and
  pull request, named `ci/` because it proves the workflow rather than carrying a lane):
  `git worktree add -b ci/p0-02-3 ../Bridle-1-ci-p0-02-3 origin/main`, commit in the worktree,
  `git push -u origin ci/p0-02-3`, `gh pr create --base main --head ci/p0-02-3 --title ... --body-file ...`,
  `gh pr checks ci/p0-02-3 --watch --fail-fast` (waits for the `check` context), then
  `gh pr merge --squash --delete-branch <n>`; a stacked docs-only branch (`ci/p0-02-3-docs`, base `ci/p0-02-3`)
  proved the `docs` path the same way. Direct pushes to
  `main` by the owner's credentials still land (`enforce_admins: false`); from P0-02.3 on the foreman prefers a
  pull request, and P0-08 makes it the rule. Optional click: Settings > General > Pull Requests > "Automatically
  delete head branches" (unticked today). The three merge methods ("Allow merge commits", "Allow squash merging",
  "Allow rebase merging") stay allowed (all three on today); P0-08 records a merge commit.

## Actions workflow

`.github/workflows/check.yml` (P0-02.3), name `check`. Triggers: every `pull_request` (no branch filter, so a pull
request into a lane or proof branch runs too) and every `push` to `main`. `permissions: contents: read` for the
whole workflow; `concurrency` groups runs per ref and cancels a superseded pull-request run; `DO_NOT_TRACK=1` keeps
turbo quiet. Four jobs, all on `ubuntu-latest`:

- `changes`: `dorny/paths-filter` with `predicate-quantifier: some-with-excludes` and one filter, `code: ['**',
  '!docs/**', '!factory/**', '!**/*.md']`, so a diff touching only `docs/**`, `factory/**` or Markdown files gives
  `code=false`. The job needs `pull-requests: read` (on a pull request the action lists the changed files through
  the API; on a push it diffs the checkout against the previous commit).
- `code` (`if: needs.changes.outputs.code == 'true'`, 20 minutes): checkout; `pnpm/action-setup` without a
  `version` input (it reads `packageManager` from package.json; it runs before setup-node, whose pnpm cache needs
  pnpm on PATH); `actions/setup-node` with `node-version-file: .node-version` and `cache: pnpm`; a step `pins` that
  reads `tools.rust.channel`, `targets` and `components` from `tools/toolchain.json` with `jq`;
  `dtolnay/rust-toolchain` with those three inputs (it does not read rust-toolchain.toml; rustup also honours
  that file, so a wrong input shows as a doctor DRIFT row, not a silent other compiler);
  `mozilla-actions/sccache-action` with `SCCACHE_GHA_ENABLED=true` and `RUSTC_WRAPPER=sccache`; then `pnpm install
  --frozen-lockfile`, `bash tools/doctor.sh --ci` (the rows `rustup`, `rust`, `node`, `pnpm` and the two mirror
  files) and `pnpm check` (`tools/check.sh`: lint, typecheck, test, cargo fmt, clippy, cargo test).
- `docs` (`if: needs.changes.outputs.code != 'true'`): one `echo` naming what a docs-only change skipped.
- `check` (`needs: [changes, code, docs]`, `if: always()`): the summary. It prints the three `needs.*.result`
  values and exits 0 only for `changes=success` with `code=success, docs=skipped` or `code=skipped, docs=success`;
  any failure, cancellation or other combination fails it. Branch protection requires this one context, so a
  docs-only pull request passes without the heavy job and a red `code` job blocks the merge.

Every `uses:` is pinned to a full commit SHA with the tag it named when pinned as a trailing comment (resolved
2026-11-03 with `gh api repos/<owner>/<repo>/commits/<tag> --jq .sha`; re-resolve the same way when bumping, and
keep the comment honest):

| Action | SHA | Tag |
|---|---|---|
| `actions/checkout` | `3d3c42e5aac5ba805825da76410c181273ba90b1` | v7.0.1 (= v7) |
| `dorny/paths-filter` | `ceb8a2b8f2d89434be7ff52d3de7ec3738c5cc9d` | v4.0.3 (= v4) |
| `pnpm/action-setup` | `ea17c68df8912ef543352723c149a84f56e3d413` | v6.1.0 (the `v6` tag still named v6.0.10) |
| `actions/setup-node` | `949feb2413d6458794dcd2491c4babbbce0c15c1` | v7.1.0 (= v7) |
| `dtolnay/rust-toolchain` | `683b588c487a69d01f6c6ddf40f036ff682cc2c8` | `master` of 2026-10-16 (no version tags) |
| `mozilla-actions/sccache-action` | `fc920bf0ec8de6ee65d409111f7ec508035751ba` | v0.0.11 |

Out of scope here: the wasm host matrix (P0-09) and deploy workflows; `Swatinem/rust-cache` waits until Cargo.lock
has dependencies. A Rust bump edits `tools/toolchain.json` and its two mirror files only (the workflow reads the
pins); a node bump edits `.node-version`; a pnpm bump edits `packageManager` in package.json.

## Manual gates

Card P0-06.3 carries `manualGates: [Actions enabled on GitHub, branch protection on main]` in its frontmatter:
verbatim the two `gate:` items above, (c) and (e). Both stayed unticked on that card at its ship: the push was its
deliverable (acceptance criterion 3), and nothing could prove the gates before a workflow existed. P0-02.3 (the
Actions workflow) re-checks both with the proof commands above and, at its ship, the foreman ticks them by
prefixing each entry with `[x]` inside the card's `manualGates:` list, giving `manualGates: [[x] Actions enabled on
GitHub, [x] branch protection on main]` (`card.py` keeps that key across moves and writes the entries back
verbatim; a gate name must never contain a comma): (c) is proven by the first workflow run, (e) by the protection
rule once the required check `check` is in it. Gate (e)'s precondition was lifted on 2026-11-03 by making the
repository public (item (a)); the rule itself has been in place since then, so P0-02.3 only adds the check,
re-verifies and ticks. Items (a), (d) and (f) are user items but not gates here: a secret or variable gates the
card that needs it (P0-05.2, P7-02), and lane branches are P0-08's.

## Verify

```sh
# The push: remote main equals the local HEAD and the branch tracks origin/main.
test "$(git ls-remote --heads origin main | cut -f1)" = "$(git rev-parse HEAD)" && echo same
git status -sb | head -1                                  # ## main...origin/main
git rev-parse --abbrev-ref --symbolic-full-name '@{u}'    # origin/main
gh repo view stephenfgarcia/Bridle --json isEmpty,defaultBranchRef --jq '[.isEmpty, .defaultBranchRef.name]'  # [false,"main"]
# The settings, read-only (the gates are ticked by hand from the proof lines of the checklist).
gh api repos/stephenfgarcia/Bridle/actions/permissions --jq .enabled                       # true
gh api repos/stephenfgarcia/Bridle/actions/secrets --jq .total_count                       # 0 today
gh api repos/stephenfgarcia/Bridle/actions/variables --jq .total_count                     # 0 today
gh api repos/stephenfgarcia/Bridle/branches/main/protection                                # the classic rule, see (e)
# All of the above as a test (network and git; gh only for the report lines).
bash tools/test/github.test.sh
# The Actions workflow (P0-02.3), read-only: the one registered workflow, the latest run on main, a run's jobs,
# the required check (from the ship of P0-02.3 on), and all of it as a test.
gh api repos/stephenfgarcia/Bridle/actions/workflows --jq '.workflows[].name'              # check
gh api 'repos/stephenfgarcia/Bridle/actions/runs?branch=main&event=push&per_page=1' \
  --jq '.workflow_runs[0] | [.conclusion, .html_url] | join(" ")'                          # success https://github.com/stephenfgarcia/Bridle/actions/runs/<id>
gh api repos/stephenfgarcia/Bridle/actions/runs/<id>/jobs --jq '.jobs[] | [.name, .conclusion] | join(" ")'  # changes, code or docs, check
gh api repos/stephenfgarcia/Bridle/branches/main/protection/required_status_checks --jq '{strict, contexts}'  # {"strict":true,"contexts":["check"]}
bash tools/test/ci.test.sh                                                                 # the workflow file, the proof pull requests' runs, the gates
```
