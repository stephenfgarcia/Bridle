// The string lint (card P0-02.6, I18N-01): fails on hard-coded user-facing strings in apps/web, that is, on
// JSX text and string literals in user-facing positions that are not catalog lookups (`t("id")`).
// Run by `pnpm lint` after Biome; the rules, the allowlist and the limits are in docs/ops/i18n.md.
//
// Usage: node packages/i18n/lint/lint-strings.mjs [--src <dir>] [--allow <file>]
//   --src    the directory to scan (default apps/web/src): *.ts and *.tsx, not *.d.ts, not *.test.*
//   --allow  the allowlist (default apps/web/i18n-allowlist.json):
//            { "allow": [ { "file": "<path relative to the allowlist's directory>", "text": "...", "reason": "..." } ] }
// Exit 0: `lint-strings: ok, <k> files checked, <a> allowlisted` on stdout.
// Exit 1: one line per finding on stderr, `<path>:<line>:<column> <rule id> "<text>"`, one line per stale
//         allowlist entry (an entry that matches no finding), then a `lint-strings: FAILED: ...` line.
// Exit 2: usage, an unreadable --src, or an allowlist that is unreadable or has an entry without file, text
//         or a non-empty reason.
// A syntax heuristic over the TypeScript syntax tree (ts.createSourceFile: no program, no type information).
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

// JSX attributes a user reads or hears.
const USER_FACING_ATTRIBUTES = new Set([
  "alt",
  "title",
  "placeholder",
  "label",
  "aria-label",
  "aria-description",
  "aria-placeholder",
  "aria-roledescription",
  "aria-valuetext",
]);
// Object property names whose value a user reads (Next `metadata`, JSON bodies of route handlers).
const USER_FACING_PROPERTIES = new Set([
  "title",
  "description",
  "label",
  "message",
  "error",
  "detail",
  "summary",
  "heading",
  "placeholder",
  "alt",
]);
const HAS_LETTER = /\p{L}/u;
const IS_PROSE = /\p{L}{2,}\s+\p{L}{2,}/u;
const EQUALITY = new Set([
  ts.SyntaxKind.EqualsEqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsEqualsToken,
  ts.SyntaxKind.EqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsToken,
]);

// The text of a string or template literal (a template's placeholders become `{}`), else undefined.
function literalText(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  if (ts.isTemplateExpression(node)) {
    return [node.head.text, ...node.templateSpans.map((span) => span.literal.text)].join("{}");
  }
  return undefined;
}

// `t(...)` or `x.t(...)`: the catalog lookup.
function isLookup(node) {
  if (!ts.isCallExpression(node)) {
    return false;
  }
  const callee = node.expression;
  return (
    (ts.isIdentifier(callee) && callee.text === "t") ||
    (ts.isPropertyAccessExpression(callee) && callee.name.text === "t")
  );
}

// `console.*(...)` and `new <Name>Error(...)`: text for developers.
function isForDevelopers(node) {
  if (ts.isNewExpression(node)) {
    return ts.isIdentifier(node.expression) && node.expression.text.endsWith("Error");
  }
  return (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    ts.isIdentifier(node.expression.expression) &&
    node.expression.expression.text === "console"
  );
}

/**
 * The findings of one source file, in position order: `{ line, column, rule, text }`, the text with its
 * whitespace collapsed. One finding per position; the first rule that sees a string names it.
 */
export function lintSource(fileName, source) {
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const findings = new Map(); // start position -> finding
  const report = (node, rule, text) => {
    const start = node.getStart(sourceFile);
    if (findings.has(start)) {
      return;
    }
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(start);
    findings.set(start, {
      start,
      line: line + 1,
      column: character + 1,
      rule,
      text: text.replace(/\s+/g, " ").trim(),
    });
  };

  // Identifiers this file binds to a string or template literal with a letter (for `jsx-constant`).
  const constants = new Map();
  const collect = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const text = literalText(node.initializer);
      if (text !== undefined && HAS_LETTER.test(text)) {
        constants.set(node.name.text, node.initializer);
      }
    }
    ts.forEachChild(node, collect);
  };
  collect(sourceFile);

  // position: "child" (a JSX child expression), "attribute" (a user-facing JSX attribute), "quiet" (any
  // other JSX attribute) or "other".
  const visit = (node, position) => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node) || ts.isTypeNode(node)) {
      return;
    }
    if (ts.isExpressionStatement(node) && ts.isStringLiteral(node.expression)) {
      return; // a directive: "use client"
    }
    if (isLookup(node)) {
      for (const argument of node.arguments.slice(1)) {
        visit(argument, "other");
      }
      return;
    }
    if (isForDevelopers(node)) {
      return;
    }
    if (ts.isBinaryExpression(node) && EQUALITY.has(node.operatorToken.kind)) {
      for (const side of [node.left, node.right]) {
        if (literalText(side) === undefined) {
          visit(side, position);
        }
      }
      return;
    }
    if (ts.isCaseClause(node)) {
      if (literalText(node.expression) === undefined) {
        visit(node.expression, position);
      }
      for (const statement of node.statements) {
        visit(statement, position);
      }
      return;
    }
    if (ts.isJsxText(node)) {
      if (HAS_LETTER.test(node.text)) {
        report(node, "jsx-text", node.text);
      }
      return;
    }
    if (ts.isJsxAttribute(node)) {
      if (!node.initializer) {
        return;
      }
      const inside = USER_FACING_ATTRIBUTES.has(node.name.getText(sourceFile))
        ? "attribute"
        : "quiet";
      if (ts.isStringLiteral(node.initializer)) {
        if (inside === "attribute" && HAS_LETTER.test(node.initializer.text)) {
          report(node.initializer, "jsx-attribute", node.initializer.text);
        }
        return;
      }
      visit(node.initializer, inside);
      return;
    }
    if (ts.isJsxExpression(node)) {
      if (node.expression) {
        const isChild = ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent);
        visit(node.expression, isChild ? "child" : position);
      }
      return;
    }
    if (
      position === "quiet" &&
      (ts.isArrowFunction(node) || ts.isFunctionExpression(node) || ts.isFunctionDeclaration(node))
    ) {
      ts.forEachChild(node, (child) => visit(child, "other")); // a function written in a quiet attribute
      return;
    }
    if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
      visit(node.expression, position);
      for (const argument of node.arguments ?? []) {
        visit(argument, position === "quiet" ? "quiet" : "other");
      }
      return;
    }
    if (ts.isPropertyAssignment(node)) {
      const name =
        ts.isIdentifier(node.name) || ts.isStringLiteral(node.name) ? node.name.text : undefined;
      const text = literalText(node.initializer);
      if (name !== undefined && USER_FACING_PROPERTIES.has(name) && text !== undefined) {
        if (HAS_LETTER.test(text)) {
          report(node.initializer, "property", text);
        }
        return;
      }
      visit(node.initializer, position === "quiet" ? "quiet" : "other");
      return;
    }
    const text = literalText(node);
    if (text !== undefined) {
      if (position === "child" && HAS_LETTER.test(text)) {
        report(node, "jsx-expression", text);
      } else if (position === "attribute" && HAS_LETTER.test(text)) {
        report(node, "jsx-attribute", text);
      } else if (position === "other" && IS_PROSE.test(text)) {
        report(node, "prose", text);
      }
      if (ts.isTemplateExpression(node)) {
        for (const span of node.templateSpans) {
          visit(span.expression, position === "quiet" ? "quiet" : "other");
        }
      }
      return;
    }
    if (ts.isIdentifier(node) && (position === "child" || position === "attribute")) {
      const initializer = constants.get(node.text);
      if (initializer !== undefined) {
        report(initializer, "jsx-constant", literalText(initializer));
      }
      return;
    }
    ts.forEachChild(node, (child) => visit(child, position));
  };
  visit(sourceFile, "other");
  return [...findings.values()].sort((a, b) => a.start - b.start);
}

// The files to scan under a directory, sorted by name at every level.
function sourceFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name !== "node_modules") {
        out.push(...sourceFiles(full));
      }
    } else if (/\.tsx?$/.test(name) && !/\.d\.ts$/.test(name) && !/\.test\.tsx?$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

function readAllowlist(file) {
  const parsed = JSON.parse(readFileSync(file, "utf8"));
  const allow = parsed?.allow;
  if (!Array.isArray(allow)) {
    throw new Error('it has no "allow" array');
  }
  for (const entry of allow) {
    for (const key of ["file", "text", "reason"]) {
      if (typeof entry?.[key] !== "string" || entry[key].trim() === "") {
        throw new Error(`the entry ${JSON.stringify(entry)} has no non-empty "${key}"`);
      }
    }
  }
  return allow;
}

// A path for a message: relative to the working directory when it is inside it, else absolute.
function shown(file) {
  const relative = path.relative(process.cwd(), file);
  return relative.startsWith("..") || path.isAbsolute(relative) ? file : relative;
}

function main(argv) {
  let src = path.join(ROOT, "apps/web/src");
  let allowFile = path.join(ROOT, "apps/web/i18n-allowlist.json");
  for (let i = 0; i < argv.length; i += 2) {
    const value = argv[i + 1];
    if (argv[i] === "--src" && value !== undefined) {
      src = path.resolve(value);
    } else if (argv[i] === "--allow" && value !== undefined) {
      allowFile = path.resolve(value);
    } else {
      console.error("usage: lint-strings.mjs [--src <dir>] [--allow <file>]");
      return 2;
    }
  }

  let allow;
  try {
    allow = readAllowlist(allowFile);
  } catch (error) {
    console.error(`lint-strings: cannot use the allowlist ${shown(allowFile)}: ${error.message}`);
    return 2;
  }
  let files;
  try {
    files = sourceFiles(src);
  } catch (error) {
    console.error(`lint-strings: cannot read the sources under ${shown(src)}: ${error.message}`);
    return 2;
  }

  const allowBase = path.dirname(allowFile);
  const matched = new Set(); // indexes of the allowlist entries that matched a finding
  const reported = [];
  let allowlisted = 0;
  for (const file of files) {
    const relative = path.relative(allowBase, file).split(path.sep).join("/");
    for (const finding of lintSource(file, readFileSync(file, "utf8"))) {
      const index = allow.findIndex(
        (entry) => entry.file === relative && entry.text === finding.text,
      );
      if (index >= 0) {
        matched.add(index);
        allowlisted += 1;
      } else {
        reported.push(
          `${shown(file)}:${finding.line}:${finding.column} ${finding.rule} ${JSON.stringify(finding.text)}`,
        );
      }
    }
  }
  const stale = allow.filter((_, index) => !matched.has(index));

  for (const line of reported) {
    console.error(line);
  }
  for (const entry of stale) {
    console.error(
      `lint-strings: stale allowlist entry ${JSON.stringify({ file: entry.file, text: entry.text })} in ${shown(allowFile)}: it matches no string any more; remove it`,
    );
  }
  if (reported.length > 0 || stale.length > 0) {
    console.error(
      `lint-strings: FAILED: ${reported.length} hard-coded user-facing string(s), ${stale.length} stale allowlist entr(ies); ${files.length} files checked`,
    );
    return 1;
  }
  console.log(`lint-strings: ok, ${files.length} files checked, ${allowlisted} allowlisted`);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
