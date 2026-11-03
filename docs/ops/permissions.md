# Claude Code permissions

What a station agent may run without a prompt, and what it may never run. The rules are the `permissions`
object of `.claude/settings.json`: committed project settings, in the same file as the three monitor hooks of
P0-10 (`PostToolUse`, `PostToolUseFailure`, `SubagentStop`), which this card did not touch. Claude Code merges
the project file with the user's own `~/.claude/settings.json` and with `.claude/settings.local.json`
(personal, uncommitted, absent here); it reloads the file when it is saved; it applies the project's allow
rules only in a trusted workspace (an untrusted folder, or a `claude -p` run without trust, ignores them with
a warning on stderr).

## Precedence

From the Claude Code permissions documentation: "Rules are evaluated in order: deny, then ask, then allow. The
first match in that order determines the outcome, and rule specificity doesn't change the order. A broad deny
rule like `Bash(aws *)` blocks every matching call, including calls that also match a narrower allow rule". A
deny in any of the three files wins over an allow in any other. A rule is `Tool(specifier)`; in a Bash rule `*`
matches any text, and the trailing ` *` form also matches the bare command (`Bash(cargo *)` matches `cargo`
as well as `cargo build`).

## Allow: runs without a prompt

| Rule | Lets a station run |
|---|---|
| `Bash(cargo *)` | the Rust build, tests, `cargo clippy`, `cargo fmt` |
| `Bash(rustup *)` | toolchain, target and component installs at the pins of `tools/toolchain.json` |
| `Bash(pnpm *)` | `pnpm install`, `pnpm check`, `pnpm test`, `pnpm e2e:smoke` and the other package scripts |
| `Bash(corepack *)` | enabling corepack and pinning pnpm |
| `Bash(node *)` | Node scripts |
| `Bash(npx playwright *)` | the Playwright browser install and e2e runs |
| `Bash(docker *)` | images and containers |
| `Bash(docker compose *)` | the local stack (Postgres, MinIO, mailpit); already covered by `Bash(docker *)`, listed so the intent is explicit |
| `Bash(git add *)` | staging, at the ship station |
| `Bash(git commit *)` | committing, at the ship station |
| `Bash(git push *)` | pushing; the force forms below are denied first |
| `Bash(git rebase *)` | rebasing a card branch |
| `Bash(git worktree *)` | one worktree per card |
| `Bash(git switch *)` | changing branches |
| `Bash(gh pr *)` | pull requests through the GitHub CLI |
| `Bash(tofu fmt *)` | formatting infrastructure code |
| `Bash(tofu validate *)` | validating infrastructure code |
| `Bash(tofu plan *)` | a plan: reads state, changes nothing (CI runs it with the OIDC role; a local run has no credentials) |
| `Bash(tools/monitor/*)` | the monitor protocol: `tools/monitor/log.sh` and the other monitor scripts |
| `Bash(python3 tools/monitor/*)` | the monitor's Python tools and `tools/monitor/test/*.test.py` |
| `Bash(bash tools/doctor.sh)` | the toolchain doctor, exactly as written (`bash tools/doctor.sh --root <dir>` still prompts) |

## Deny: always refused

| Rule | Stops |
|---|---|
| `Bash(tofu apply *)` | changing real infrastructure from an agent |
| `Bash(tofu destroy *)` | destroying real infrastructure from an agent |
| `Bash(aws *)` | every AWS CLI call, with no carve-out (see below) |
| `Bash(git push --force*)` | `git push --force ...` and, having no space before the `*`, `git push --force-with-lease ...` |
| `Bash(git push -f *)` | `git push -f ...` |
| `Bash(git push * --force*)` | `git push origin main --force` and `--force-with-lease` after a remote or refspec |
| `Bash(git push * -f*)` | `git push origin main -f` |
| `Read(.env.local)` | reading the developer's local secrets file, by the Read tool or by `cat`, `head`, `sed` and redirections in Bash |
| `Read(.env.*.local)` | the per-environment variants (`.env.staging.local`, ...) the same way |

`aws` has no carve-out. Deny is evaluated before allow, so an allow such as `Bash(aws sts get-caller-identity)`
would be inert; the plan station checked this on 2026-11-03 and the spec dropped it. An agent that needs to
know whether credentials are valid asks the user, who runs `aws sts get-caller-identity` in a terminal. A Bash
rule matches the command text, not what the command does, so a script the agent may run (`bash
tools/doctor.sh`) could run the check internally; today the doctor only probes `aws --version`.

## Credentials never reach station agents

`docs/ops/secrets.md` states the rule: no station agent (plan, build, test, review, ship) ever needs a
production credential. Cards run against the docker compose defaults (Postgres, MinIO, mailpit), the tester
uses record/replay fixtures for the Anthropic API, CI assumes an IAM role through GitHub's OIDC provider, and
there are no long-lived AWS access keys anywhere. The denies above back that rule up: an agent that somehow
held a key still could not run `aws` or `tofu apply`, and could not read `.env.local`.

## Limits

- A Bash rule matches the command text only: `/usr/bin/aws`, `sh -c 'aws ...'`, `git -C . push --force`, an
  alias, or a script that calls `aws` itself are not matched. The denies are a tripwire for the usual
  spellings, not a sandbox.
- The four force-push patterns cover `--force`, `--force-with-lease` and `-f` before or after the refspec;
  bundled short flags (`git push -fu origin main`) and a `+main` force refspec are not spelled that way and
  are not denied.
- The Read denies are relative to the session's working directory (the repository root or a card worktree) and
  match at any depth; `grep -r` output and programs that open the file themselves are not covered.
- A typo in a rule surfaces only as a Settings Warning at startup; `claude doctor` and
  `python3 tools/test/settings.test.py` catch it.

## Not here

- The hooks in the same file belong to the monitor (P0-10): see `tools/monitor/README.md`.
- Personal rules (an editor, a browser, one more allow) go in `.claude/settings.local.json`, which is never
  committed.
- The user's global `~/.claude/settings.json` is not changed by the factory.
