#!/usr/bin/env python3
"""Tests for .claude/settings.json, the factory's Claude Code permission rules (factory card P0-06.2).

Run from anywhere:  python3 tools/test/settings.test.py
(unittest, standard library only, Python 3.9 is enough; the dotted file name cannot be imported, so the file
is run. The repository root is resolved from this file's own path.)

One test per acceptance criterion of the card, named in each test's docstring:
  test_json_and_rules   AC1  the file parses (no duplicate keys) and ends with one newline; `hooks` precedes
                             `permissions`; `allow` and `deny` are lists of unique `Tool(specifier)` strings;
                             each of the spec's 21 allow and 9 deny rules is present, and no other rule is;
                             no allow entry duplicates a deny entry
  test_hooks_intact     AC1  the three monitor hooks of P0-10 (PostToolUse, PostToolUseFailure, SubagentStop)
                             are exactly as committed in 126d1f8: one command hook each, ending in
                             /tools/monitor/trace-hook.sh
  test_docs             AC2  docs/ops/permissions.md explains every rule of the file (read from the file, so the
                             doc cannot drift from it) in one table row, states that credentials never reach
                             station agents and links docs/ops/secrets.md
  test_assertions_bite  AC3  the checks name the entry when any deny or allow rule is removed, when an allow entry
                             duplicates a deny entry, when a hook is removed or changed, and when a rule leaves
                             the doc; a document with a duplicate key is rejected

The checks are plain functions over the parsed document (and the doc's text) returning a list of problems,
empty when everything is fine, so the tests reuse them on edited copies. Nothing is written; the test leaves no
__pycache__ behind.
"""
import copy
import json
import os
import re
import sys
import unittest

sys.dont_write_bytecode = True  # no __pycache__ in the tree

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..', '..'))
SETTINGS = os.path.join(ROOT, '.claude', 'settings.json')
DOCS = os.path.join(ROOT, 'docs', 'ops', 'permissions.md')
SECRETS_LINK = 'docs/ops/secrets.md'
HOOK_SUFFIX = '/tools/monitor/trace-hook.sh'
HOOK_EVENTS = ('PostToolUse', 'PostToolUseFailure', 'SubagentStop')
RULE = re.compile(r'^[A-Za-z]+\(.+\)$')  # Tool(specifier)
CREDENTIALS_RULE = re.compile(r'credentials?\b.*\bnever\b|\bnever\b.*\bcredentials?', re.IGNORECASE)

# The spec's AC1 lists, in the spec's order (amended at the plan station on 2026-11-03: no
# `Bash(aws sts get-caller-identity)` allow, since a deny always wins; seven destructive Bash deny patterns).
ALLOW = [
    'Bash(cargo *)',
    'Bash(rustup *)',
    'Bash(pnpm *)',
    'Bash(corepack *)',
    'Bash(node *)',
    'Bash(npx playwright *)',
    'Bash(docker *)',
    'Bash(docker compose *)',
    'Bash(git add *)',
    'Bash(git commit *)',
    'Bash(git push *)',
    'Bash(git rebase *)',
    'Bash(git worktree *)',
    'Bash(git switch *)',
    'Bash(gh pr *)',
    'Bash(tofu fmt *)',
    'Bash(tofu validate *)',
    'Bash(tofu plan *)',
    'Bash(tools/monitor/*)',
    'Bash(python3 tools/monitor/*)',
    'Bash(bash tools/doctor.sh)',
]
DENY = [
    'Bash(tofu apply *)',
    'Bash(tofu destroy *)',
    'Bash(aws *)',
    'Bash(git push --force*)',
    'Bash(git push -f *)',
    'Bash(git push * --force*)',
    'Bash(git push * -f*)',
    'Read(.env.local)',
    'Read(.env.*.local)',
]
DESTRUCTIVE = DENY[:7]  # the seven Bash patterns
READ_DENIES = DENY[7:]  # the two Read patterns
assert len(ALLOW) == 21 and len(DENY) == 9 and len(DESTRUCTIVE) == 7 and len(READ_DENIES) == 2

# The hooks block as committed by the monitor card P0-10 (commit 126d1f8); this card must not change it.
TRACE_HOOK = {'type': 'command', 'command': '"$CLAUDE_PROJECT_DIR"' + HOOK_SUFFIX, 'async': True, 'timeout': 20}
HOOKS_P0_10 = {
    'PostToolUse': [{'matcher': '*', 'hooks': [TRACE_HOOK]}],
    'PostToolUseFailure': [{'matcher': '*', 'hooks': [TRACE_HOOK]}],
    'SubagentStop': [{'hooks': [TRACE_HOOK]}],
}


# --- the checks: plain functions returning a list of problems (empty = fine) ---------------------------------

def no_duplicate_keys(pairs):
    """object_pairs_hook for json.loads: a repeated key is an error (json.loads alone keeps the last one)."""
    out = {}
    for key, value in pairs:
        if key in out:
            raise ValueError('duplicate key: %s' % key)
        out[key] = value
    return out


def load(path=SETTINGS):
    """The settings document as (text, parsed dict). Raises ValueError on bad JSON or a duplicate key."""
    with open(path, encoding='utf-8') as f:
        text = f.read()
    return text, json.loads(text, object_pairs_hook=no_duplicate_keys)


def check_text(text):
    """The file ends with exactly one newline."""
    if not text.endswith('\n'):
        return ['file does not end with a newline']
    if text.endswith('\n\n'):
        return ['file ends with more than one newline']
    return []


def check_rules(doc):
    """AC1 over the parsed document: shape, every spec rule present and no other, no allow/deny overlap."""
    problems = []
    if not isinstance(doc, dict):
        return ['document is not an object']
    if list(doc) != ['hooks', 'permissions']:
        problems.append('top-level keys are %r, expected [hooks, permissions]' % (list(doc),))
    perms = doc.get('permissions')
    if not isinstance(perms, dict):
        problems.append('permissions is missing or not an object')
        return problems
    if list(perms) != ['allow', 'deny']:
        problems.append('permissions keys are %r, expected [allow, deny]' % (list(perms),))
    lists = {}
    for name, expected in (('allow', ALLOW), ('deny', DENY)):
        rules = perms.get(name)
        if not isinstance(rules, list):
            problems.append('permissions.%s is missing or not a list' % name)
            continue
        for i, rule in enumerate(rules):
            if not isinstance(rule, str):
                problems.append('permissions.%s[%d] is not a string: %r' % (name, i, rule))
            elif not RULE.match(rule):
                problems.append('permissions.%s[%d] is not Tool(specifier): %r' % (name, i, rule))
        strings = [r for r in rules if isinstance(r, str)]
        for rule in sorted(set(r for r in strings if strings.count(r) > 1)):
            problems.append('permissions.%s lists %s more than once' % (name, rule))
        for rule in expected:
            if rule not in strings:
                problems.append('permissions.%s is missing %s' % (name, rule))
        for rule in strings:
            if rule not in expected:
                problems.append('permissions.%s has %s, which the spec does not list' % (name, rule))
        lists[name] = strings
    if 'allow' in lists and 'deny' in lists:
        for rule in sorted(set(lists['allow']) & set(lists['deny'])):
            problems.append('%s is both allowed and denied' % rule)
    return problems


def check_hooks(doc):
    """The three P0-10 hooks: each event holds a command hook ending in /tools/monitor/trace-hook.sh, and the
    block equals the one committed in 126d1f8."""
    problems = []
    hooks = doc.get('hooks') if isinstance(doc, dict) else None
    if not isinstance(hooks, dict):
        return ['hooks is missing or not an object']
    for event in HOOK_EVENTS:
        groups = hooks.get(event)
        if not isinstance(groups, list) or not groups:
            problems.append('hooks.%s is missing or empty' % event)
            continue
        commands = [h for g in groups if isinstance(g, dict) and isinstance(g.get('hooks'), list)
                    for h in g['hooks'] if isinstance(h, dict)]
        if not any(h.get('type') == 'command' and str(h.get('command', '')).endswith(HOOK_SUFFIX) for h in commands):
            problems.append('hooks.%s has no command hook ending in %s' % (event, HOOK_SUFFIX))
        if groups != HOOKS_P0_10[event]:
            problems.append('hooks.%s is not the block committed by P0-10' % event)
    for event in hooks:
        if event not in HOOK_EVENTS:
            problems.append('hooks.%s is not one of the P0-10 events' % event)
    return problems


def check_docs(doc, md):
    """AC2: every rule of the parsed file has a table row `| \\`rule\\` | <one line> |` in the doc; the doc states
    the credentials rule and links docs/ops/secrets.md."""
    problems = []
    perms = doc.get('permissions', {}) if isinstance(doc, dict) else {}
    rows = [line for line in md.splitlines() if line.startswith('|')]
    for name in ('allow', 'deny'):
        for rule in perms.get(name, []) if isinstance(perms, dict) else []:
            if not isinstance(rule, str):
                continue
            cell = '`%s`' % rule
            if cell not in md:
                problems.append('docs/ops/permissions.md does not name %s (%s)' % (cell, name))
                continue
            explained = False
            for row in rows:
                cells = [c.strip() for c in row.strip().strip('|').split('|')]
                if len(cells) >= 2 and cells[0] == cell and cells[1]:
                    explained = True
            if not explained:
                problems.append('docs/ops/permissions.md has no table row explaining %s (%s)' % (cell, name))
    if SECRETS_LINK not in md:
        problems.append('docs/ops/permissions.md does not link %s' % SECRETS_LINK)
    if not CREDENTIALS_RULE.search(md):
        problems.append('docs/ops/permissions.md does not state that credentials never reach station agents')
    return problems


# --- the tests ---------------------------------------------------------------------------------------------------

class SettingsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.text, cls.doc = load()
        with open(DOCS, encoding='utf-8') as f:
            cls.md = f.read()

    def assertNoProblems(self, problems):
        self.assertEqual(problems, [], '\n'.join(['problems:'] + problems))

    def assertNamed(self, problems, needle, msg):
        hits = [p for p in problems if needle in p]
        self.assertTrue(hits, '%s: no problem names %r in %r' % (msg, needle, problems))

    def test_json_and_rules(self):
        """AC1: valid JSON (no duplicate keys, one trailing newline), hooks before permissions, allow and deny are
        lists of unique Tool(specifier) strings holding exactly the spec's 21 allow and 9 deny rules, and no
        allow entry duplicates a deny entry."""
        self.assertNoProblems(check_text(self.text))
        self.assertNoProblems(check_rules(self.doc))
        self.assertEqual(list(self.doc), ['hooks', 'permissions'])
        allow, deny = self.doc['permissions']['allow'], self.doc['permissions']['deny']
        self.assertEqual(len(allow), 21)
        self.assertEqual(len(deny), 9)
        for rule in ALLOW:
            self.assertIn(rule, allow)
        for rule in DESTRUCTIVE + READ_DENIES:
            self.assertIn(rule, deny)
        self.assertEqual(set(allow) & set(deny), set())
        self.assertEqual(allow, ALLOW, 'allow is not in the spec order')
        self.assertEqual(deny, DENY, 'deny is not in the spec order')

    def test_hooks_intact(self):
        """AC1: the three monitor hooks are exactly the P0-10 block (one command hook per event, ending in
        /tools/monitor/trace-hook.sh); nothing else under hooks."""
        self.assertNoProblems(check_hooks(self.doc))
        self.assertEqual(self.doc['hooks'], HOOKS_P0_10)
        self.assertEqual(list(self.doc['hooks']), list(HOOK_EVENTS))

    def test_docs(self):
        """AC2: docs/ops/permissions.md explains each allow and deny rule of the file in one table row and states
        the rule that production credentials never reach station agents, linking docs/ops/secrets.md."""
        self.assertNoProblems(check_docs(self.doc, self.md))
        for rule in self.doc['permissions']['allow'] + self.doc['permissions']['deny']:
            self.assertIn('`%s`' % rule, self.md)
        self.assertIn(SECRETS_LINK, self.md)

    def test_assertions_bite(self):
        """AC3: the checks fail, naming the entry, when a deny or allow rule is missing (each of the 9 deny and
        21 allow rules in turn), when an allow entry duplicates a deny entry, when a hook is removed or changed,
        when a rule leaves the doc; a duplicate key is rejected at parse time."""
        self.assertNoProblems(check_rules(self.doc))  # the baseline is clean, so every failure below is the edit
        for rule in DENY:
            edited = copy.deepcopy(self.doc)
            edited['permissions']['deny'].remove(rule)
            self.assertNamed(check_rules(edited), rule, 'deny %s removed' % rule)
        for rule in ALLOW:
            edited = copy.deepcopy(self.doc)
            edited['permissions']['allow'].remove(rule)
            self.assertNamed(check_rules(edited), rule, 'allow %s removed' % rule)
        edited = copy.deepcopy(self.doc)
        edited['permissions']['allow'].append('Bash(tofu apply *)')
        self.assertNamed(check_rules(edited), 'Bash(tofu apply *) is both allowed and denied', 'overlap added')
        edited = copy.deepcopy(self.doc)
        edited['permissions']['allow'].append('Bash(rm -rf /)')
        self.assertNamed(check_rules(edited), 'Bash(rm -rf /)', 'unlisted allow added')
        edited = copy.deepcopy(self.doc)
        edited['permissions']['allow'].append('cargo')
        self.assertNamed(check_rules(edited), "not Tool(specifier): 'cargo'", 'malformed rule added')
        edited = copy.deepcopy(self.doc)
        edited['permissions']['deny'].append('Read(.env.local)')
        self.assertNamed(check_rules(edited), 'lists Read(.env.local) more than once', 'duplicate deny added')
        edited = copy.deepcopy(self.doc)
        del edited['permissions']
        self.assertNamed(check_rules(edited), 'permissions is missing', 'permissions removed')
        for event in HOOK_EVENTS:
            edited = copy.deepcopy(self.doc)
            del edited['hooks'][event]
            self.assertNamed(check_hooks(edited), 'hooks.%s is missing' % event, 'hook %s removed' % event)
            edited = copy.deepcopy(self.doc)
            edited['hooks'][event][0]['hooks'][0]['command'] = 'echo hi'
            self.assertNamed(check_hooks(edited), 'hooks.%s has no command hook' % event, 'hook %s changed' % event)
            edited = copy.deepcopy(self.doc)
            edited['hooks'][event][0]['hooks'][0]['timeout'] = 21
            self.assertNamed(check_hooks(edited), 'hooks.%s is not the block' % event, 'hook %s timeout' % event)
        for rule in ('Bash(cargo *)', 'Bash(aws *)', 'Read(.env.*.local)'):
            md = '\n'.join(line for line in self.md.splitlines() if ('`%s`' % rule) not in line)
            self.assertNamed(check_docs(self.doc, md), '`%s`' % rule, 'doc row %s removed' % rule)
        self.assertNamed(check_docs(self.doc, self.md.replace(SECRETS_LINK, 'docs/ops/other.md')), SECRETS_LINK,
                         'secrets link removed')
        self.assertNamed(check_text(self.text.rstrip('\n')), 'does not end with a newline', 'newline removed')
        self.assertNamed(check_text(self.text + '\n'), 'more than one newline', 'newline doubled')
        with self.assertRaises(ValueError):
            json.loads('{"hooks": {}, "hooks": {}}', object_pairs_hook=no_duplicate_keys)


if __name__ == '__main__':
    unittest.main(verbosity=2)
