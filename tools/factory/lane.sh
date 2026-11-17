#!/usr/bin/env bash
# Lanes (card P0-08.2): one linked git worktree and one branch `lane/<name>` per lane of factory/lanes.json.
#
#   tools/factory/lane.sh new <name>      make the lane's worktree on a new branch lane/<name> at origin/main
#   tools/factory/lane.sh list            one line per lane worktree
#   tools/factory/lane.sh remove <name>   remove the lane's worktree and branch once the branch is in origin/main
#
# Exit 0 ok, 1 refused (the reason on stderr), 2 usage, or for `new` a name that `lanes` of factory/lanes.json (of the
# checkout holding this script) does not list.
#
# The repository acted on is the main checkout as `tools/monitor/log.sh --main-root` gives it (the rule is in the
# header of log.sh), so the script gives the same answer from the main checkout and from a lane's worktree.
# Lane worktrees are made in <parent of the main checkout>/<its directory name>.lanes/<name>, or in
# $BRIDLE_LANES_DIR/<name> when that variable is set: an absolute path without a `..` part, created if missing, and
# refused when it or an existing directory above it is the main checkout.
#
# new <name>     Refused with `lane <name> exists: ...` when the branch lane/<name>, a worktree on it or the directory
#                is there. Runs `git fetch origin main` (a failure is exit 1), then
#                `git worktree add --no-track -b lane/<name> <dir> origin/main`. Stdout is the worktree's path alone.
# list           For each worktree whose branch is lane/<x>, in the order of `git worktree list`:
#                <x><TAB><path><TAB>lane/<x><TAB><idle | running <id> <station>>
#                The last field is the first line of `card.py lane <x> --cards <path>/factory/cards`: a card with
#                `lane: <x>` at plan, build, test or review among the cards of that worktree. No lanes, no lines.
# remove <name>  Runs `git fetch origin main`, then refuses unless lane/<name> is an ancestor of origin/main (the
#                branch is merged, or has no commits of its own; a squash merge does not count), printing the commits
#                that are not in origin/main. Then `git worktree remove <path>` without --force: git refuses a
#                worktree with modified or untracked files, and its message is the reason. Then `git branch -D`.
#                Prints `removed lane <name> (<path>, lane/<name>)`. `no lane <name>` (exit 1) when there is neither
#                a branch nor a worktree of that name.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
USAGE='usage: lane.sh new <name> | lane.sh list | lane.sh remove <name>'

usage() { echo "$USAGE" >&2; exit 2; }
refuse() { echo "lane.sh: $*" >&2; exit 1; }

MAIN="$("$ROOT/tools/monitor/log.sh" --main-root)" || refuse "tools/monitor/log.sh --main-root failed"
g() { env -u GIT_DIR -u GIT_WORK_TREE git -C "$MAIN" "$@"; }

lane_names() { # the `lanes` list of this checkout's factory/lanes.json, one per line
  python3 -c 'import json, sys
for name in json.load(open(sys.argv[1], encoding="utf-8"))["lanes"]:
    print(name)' "$ROOT/factory/lanes.json"
}

lanes_dir() { # prints the directory that holds the lane worktrees
  local dir d
  if [ -z "${BRIDLE_LANES_DIR:-}" ]; then
    printf '%s/%s.lanes\n' "$(dirname "$MAIN")" "$(basename "$MAIN")"
    return
  fi
  dir="${BRIDLE_LANES_DIR%/}"
  [ "${dir#/}" != "$dir" ] || refuse "BRIDLE_LANES_DIR is not an absolute path: $BRIDLE_LANES_DIR"
  case "$dir/" in */../*) refuse "BRIDLE_LANES_DIR holds a '..' part: $BRIDLE_LANES_DIR" ;; esac
  d="$dir"
  while [ -n "$d" ] && [ "$d" != "/" ]; do
    if [ -e "$d" ] && [ "$d" -ef "$MAIN" ]; then
      refuse "BRIDLE_LANES_DIR is inside the main checkout ($MAIN): $BRIDLE_LANES_DIR"
    fi
    d="$(dirname "$d")"
  done
  printf '%s\n' "$dir"
}

worktree_of() { # $1 = branch name; prints the path of the worktree on that branch, or nothing
  g worktree list --porcelain | awk -v want="branch refs/heads/$1" '
    /^worktree / { path = substr($0, 10) }
    $0 == want { print path; exit }'
}

cmd_new() {
  local name="$1" branch="lane/$1" known dir path
  known="$(lane_names)" || refuse "factory/lanes.json of $ROOT cannot be read"
  if ! printf '%s\n' "$known" | grep -q -x -F -- "$name"; then
    echo "lane.sh: $name is not a lane of factory/lanes.json ($(printf '%s' "$known" | tr '\n' ' '))" >&2
    exit 2
  fi
  dir="$(lanes_dir)/$name"
  path="$(worktree_of "$branch")"
  [ -z "$path" ] || refuse "lane $name exists: $path"
  if g show-ref --verify --quiet "refs/heads/$branch"; then
    refuse "lane $name exists: the branch $branch, without a worktree"
  fi
  [ ! -e "$dir" ] || refuse "lane $name exists: $dir"
  g fetch --quiet origin main >&2 || refuse "git fetch origin main failed; no lane made"
  mkdir -p "$(dirname "$dir")"
  g worktree add --quiet --no-track -b "$branch" "$dir" origin/main >&2 || refuse "git worktree add failed; see above"
  echo "lane.sh: lane $name on $branch at $(g rev-parse --short "$branch"); the worktree has no node_modules, run pnpm install in it" >&2
  printf '%s\n' "$dir"
}

cmd_list() {
  local name path state
  g worktree list --porcelain | awk '
    /^worktree / { path = substr($0, 10) }
    /^branch refs\/heads\/lane\// { print substr($0, 24) "\t" path }' |
  while IFS="$(printf '\t')" read -r name path; do
    state="$(python3 "$ROOT/tools/monitor/card.py" lane "$name" --cards "$path/factory/cards" | sed -n '1p')"
    if [ -n "$state" ]; then
      state="running $(printf '%s\n' "$state" | cut -d ' ' -f 1,2)"
    else
      state="idle"
    fi
    printf '%s\t%s\t%s\t%s\n' "$name" "$path" "lane/$name" "$state"
  done
}

cmd_remove() {
  local name="$1" branch="lane/$1" path has_branch=0 n
  path="$(worktree_of "$branch")"
  if g show-ref --verify --quiet "refs/heads/$branch"; then has_branch=1; fi
  if [ -z "$path" ] && [ "$has_branch" -eq 0 ]; then refuse "no lane $name"; fi
  g fetch --quiet origin main >&2 || refuse "git fetch origin main failed; lane $name not removed"
  if [ "$has_branch" -eq 1 ] && ! g merge-base --is-ancestor "$branch" origin/main; then
    n="$(g rev-list --count "origin/main..$branch")"
    {
      if [ "$n" -eq 1 ]; then echo "lane.sh: $branch has 1 commit not in origin/main:"
      else echo "lane.sh: $branch has $n commits not in origin/main:"; fi
      g log --oneline "origin/main..$branch"
      echo "lane.sh: lane $name not removed; merge the branch into origin/main first"
    } >&2
    exit 1
  fi
  if [ -n "$path" ]; then
    g worktree remove "$path" >&2 || refuse "git worktree remove refused (its reason is above); lane $name not removed"
  fi
  if [ "$has_branch" -eq 1 ]; then
    g branch -q -D "$branch" >&2 || refuse "git branch -D $branch failed; the worktree is removed, the branch is not"
  fi
  echo "removed lane $name (${path:-no worktree}, $branch)"
}

[ "$#" -ge 1 ] || usage
case "$1" in
  new|remove)
    [ "$#" -eq 2 ] || usage
    [[ "$2" =~ ^[a-z0-9][a-z0-9-]*$ ]] || usage
    "cmd_$1" "$2" ;;
  list) [ "$#" -eq 1 ] || usage; cmd_list ;;
  *) usage ;;
esac
