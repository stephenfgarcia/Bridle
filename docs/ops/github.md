# GitHub

The remote is `origin` = `https://github.com/stephenfgarcia/Bridle.git`, a PUBLIC repository of the user's personal
account `stephenfgarcia`. The first push was on 2026-11-03 (10:18 UTC): `git push -u origin main` sent `3ea44db`
(28 commits, 137 tracked files, one author) to the empty repository and made `main` its default branch. Every
GitHub setting is the user's decision: no station writes a setting; the three writes on record (two visibility
changes in item (a), the protection rule in item (e)) were made by the foreman with `gh` at the user's explicit
instruction. No station needs a secret (`docs/ops/secrets.md`); the factory pushes `main` (and, from P0-08, lane branches and pull
requests) and reads settings with `gh api` to report them. What a station may run is in `docs/ops/permissions.md`.

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
  `{"enabled":true,"allowed_actions":"all"}`). Ticked at P0-02.3, when the first workflow run proves it.
- [x] (d) Secrets and variables: none now (user). Settings > Secrets and variables > Actions: nothing to add
  before P0-02.3 (today: 0 secrets, 0 variables). Later, per the "GitHub Actions" column of `docs/ops/secrets.md`,
  each on the card that needs it: Variables tab > "New repository variable" for `AWS_OIDC_ROLE_ARN`,
  `TOFU_STATE_BUCKET` and `TOFU_LOCK_TABLE` (P0-05.2); Secrets tab > "New repository secret" for
  `SENTRY_AUTH_TOKEN` (P7-02). Everything else in that column is a service container or a per-run random value.
  The credential git pushes with must carry the `workflow` scope before P0-02.3 pushes `.github/workflows/`
  (GitHub refuses such a push without it); gh's token has it (`gh auth status` lists `workflow`), and `gh auth
  setup-git` makes git use that token instead of the `osxkeychain` entry (it edits `~/.gitconfig`: the user's
  decision, to be taken only if that push is refused).
- [ ] (e) Branch protection on `main` (user; gate: branch protection on main). Precondition met on 2026-11-03 by
  item (a): on a free personal plan branch protection rules and rulesets exist only for public repositories (a
  private one answers HTTP 403 "Upgrade to GitHub Pro or make this repository public to enable this feature").
  Applied by the foreman at 10:33Z with `gh api -X PUT repos/stephenfgarcia/Bridle/branches/main/protection`
  (classic rule: pull request required with 0 approvals, force pushes and deletions blocked, admins not enforced
  so the owner's direct ship pushes still land until P0-08 moves shipping to pull requests; no required status
  check until P0-02.3 exists). The same rule in the UI: Settings > Branches > "Add classic branch protection rule", branch name pattern
  `main`, with exactly these values:
  - tick "Require a pull request before merging"; leave "Require approvals" unticked (0 approvals: a sole owner
    cannot approve their own pull request);
  - leave "Require status checks to pass before merging" unticked until P0-02.3 exists, then tick it, add the
    `check` context, and tick "Require branches to be up to date before merging" (a required context nothing
    reports blocks every merge, so never before the workflow has reported once);
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
  checks: .required_status_checks.contexts}'` (prints `pr: true, force: false, deletions: false, admins: false, checks: null` today; a 404 "Branch not
  protected" would mean the rule was removed).
- [ ] (f) Lane branches `lane/<name>` (factory, P0-08). One per worktree and foreman session, rebased on
  `origin/main`, pushed, merged by pull request, deleted after the merge; the `main` rule above does not match
  them. Optional click: Settings > General > Pull Requests > "Automatically delete head branches" (unticked
  today). The three merge methods ("Allow merge commits", "Allow squash merging", "Allow rebase merging") stay
  allowed (all three on today); P0-08 records a merge commit.

## Manual gates

Card P0-06.3 carries `manualGates: [Actions enabled on GitHub, branch protection on main]` in its frontmatter:
verbatim the two `gate:` items above, (c) and (e). Both stay unticked on that card: the push is its deliverable
(acceptance criterion 3), and nothing can prove the gates before a workflow exists. P0-02.3 (the Actions
workflow) re-checks both with the proof commands above and ticks them by prefixing the entry with `[x]` inside
the card's `manualGates:` list (`card.py` keeps that key across moves; a gate name must never contain a comma).
Gate (e)'s precondition was lifted on 2026-11-03 by making the repository public (item (a)); the rule itself is
in place, so P0-02.3 only re-verifies and ticks. Items (a), (d) and (f) are user items but not gates here: a secret or variable gates the card that
needs it (P0-05.2, P7-02), and lane branches are P0-08's.

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
```
