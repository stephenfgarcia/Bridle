import { parse } from "@formatjs/icu-messageformat-parser";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import en from "../messages/en.json";
import enXA from "../messages/en-XA.json";
import {
  createTranslator,
  formatMessage,
  LOCALES,
  type MessageId,
  resolveLocale,
  t,
} from "./index";
import { pseudoMessage } from "./pseudo";

const MEMBERS = "{count, plural, =0 {No members} one {# member} other {# members}} in {course}";

// These tests hold properties of the catalogs, not what they say today: a string added or changed by the steps
// of docs/ops/i18n.md passes them unedited. Today's exact content is held by tools/test/i18n.test.sh.
const IDS = Object.keys(en) as MessageId[];
// Loosely typed on purpose: a key missing from one file is reported once, by index.ts, not again here.
const CATALOGS: Record<string, Record<string, string | undefined>> = { en, "en-XA": enXA };
/** No ICU syntax at all: the formatter returns such a message as it is written. */
const PLAIN_IDS = IDS.filter((id) => !/[{}'<>#]/.test(CATALOGS.en?.[id] ?? "{"));

describe("the catalogs", () => {
  it("en-XA.json has the ids of en.json in the same order, each the pseudo form of its en message (run `pnpm i18n:pseudo` after changing en.json)", () => {
    expect(Object.entries(enXA)).toEqual(
      Object.entries(en).map(([id, message]) => [id, pseudoMessage(message)]),
    );
  });
  it("every message of en.json and en-XA.json parses as ICU MessageFormat", () => {
    for (const [locale, catalog] of Object.entries(CATALOGS)) {
      for (const [id, message] of Object.entries(catalog)) {
        expect(() => parse(message ?? ""), `${id} (${locale})`).not.toThrow();
      }
    }
  });
  it("every id is dotted: ^[a-z][A-Za-z0-9]*(\\.[A-Za-z0-9]+)+$", () => {
    for (const id of Object.keys(en)) {
      expect(id).toMatch(/^[a-z][A-Za-z0-9]*(\.[A-Za-z0-9]+)+$/);
    }
  });
});

describe("t and createTranslator, on the ids of the catalog", () => {
  it("t gives the en message by default, and the message of the locale it is given", () => {
    for (const id of PLAIN_IDS) {
      expect(t(id), id).toBe(CATALOGS.en?.[id]);
      expect(t(id, { unused: 1 }), id).toBe(CATALOGS.en?.[id]);
      for (const locale of LOCALES) {
        expect(t(id, undefined, locale), `${id} (${locale})`).toBe(CATALOGS[locale]?.[id]);
      }
    }
  });
  it("createTranslator binds the locale", () => {
    for (const locale of LOCALES) {
      const translate = createTranslator(locale);
      for (const id of PLAIN_IDS) {
        expect(translate(id), `${id} (${locale})`).toBe(CATALOGS[locale]?.[id]);
      }
    }
  });
  it("rejects an unknown id at compile time, and at run time", () => {
    // @ts-expect-error "no.such.id" is not a key of en.json
    expect(() => t("no.such.id")).toThrow(/unknown message id "no\.such\.id" in the en catalog/);
  });
});

describe("t and createTranslator with values (a catalog defined here, not the shipped one)", () => {
  // The ids of this catalog are not keys of the shipped en.json, hence the casts.
  const members = "test.members" as MessageId;
  const greeting = "test.greeting" as MessageId;
  let mocked: typeof import("./index");

  beforeAll(async () => {
    vi.resetModules();
    vi.doMock("../messages/en.json", () => ({
      default: { "test.members": MEMBERS, "test.greeting": "Welcome back" },
    }));
    vi.doMock("../messages/en-XA.json", () => ({
      default: {
        "test.members": pseudoMessage(MEMBERS),
        "test.greeting": pseudoMessage("Welcome back"),
      },
    }));
    mocked = await import("./index");
  });
  afterAll(() => {
    vi.doUnmock("../messages/en.json");
    vi.doUnmock("../messages/en-XA.json");
    vi.resetModules();
  });

  it("t formats the message of the id with the values, in en by default", () => {
    expect(mocked.t(greeting)).toBe("Welcome back");
    expect(mocked.t(members, { count: 0, course: "CE 101" })).toBe("No members in CE 101");
    expect(mocked.t(members, { count: 1, course: "CE 101" })).toBe("1 member in CE 101");
    expect(mocked.t(members, { count: 1234, course: "CE 101" })).toBe("1,234 members in CE 101");
  });
  it("t formats the message of the locale it is given", () => {
    expect(mocked.t(greeting, undefined, "en-XA")).toBe(pseudoMessage("Welcome back"));
    expect(mocked.t(members, { count: 1, course: "CE 101" }, "en-XA")).toBe(
      "[1 ɱééɱƀééŕ îîñ CE 101]",
    );
  });
  it("createTranslator binds the locale and passes the values", () => {
    expect(mocked.createTranslator("en")(members, { count: 2, course: "CE 101" })).toBe(
      "2 members in CE 101",
    );
    expect(mocked.createTranslator("en-XA")(members, { count: 0, course: "CE 101" })).toBe(
      "[Ñöö ɱééɱƀééŕš îîñ CE 101]",
    );
  });
  it("t throws when a value the message names is missing", () => {
    expect(() => mocked.t(members, { count: 1 })).toThrow(/course/);
  });
  it("t throws the named error for an id the catalog does not hold", () => {
    expect(() => mocked.t("app.name", undefined, "en-XA")).toThrow(
      'unknown message id "app.name" in the en-XA catalog',
    );
  });
});

describe("formatMessage (fixture G)", () => {
  it("formats plural, # and an argument in en", () => {
    expect(formatMessage("en", MEMBERS, { count: 0, course: "CE 101" })).toBe(
      "No members in CE 101",
    );
    expect(formatMessage("en", MEMBERS, { count: 1, course: "CE 101" })).toBe("1 member in CE 101");
    expect(formatMessage("en", MEMBERS, { count: 1234, course: "CE 101" })).toBe(
      "1,234 members in CE 101",
    );
  });
  it("throws on a plural without other", () => {
    expect(() => formatMessage("en", "{count, plural, one {# member}", { count: 1 })).toThrow();
  });
  it("throws when a value the message names is missing", () => {
    expect(() => formatMessage("en", MEMBERS, { count: 1 })).toThrow(/course/);
  });
});

describe("resolveLocale", () => {
  it("gives en when the setting is unset or empty", () => {
    expect(resolveLocale(undefined)).toBe("en");
    expect(resolveLocale("")).toBe("en");
  });
  it("gives a known locale itself", () => {
    expect(resolveLocale("en")).toBe("en");
    expect(resolveLocale("en-XA")).toBe("en-XA");
    expect(LOCALES).toEqual(["en", "en-XA"]);
  });
  it("throws on an unknown locale, naming it", () => {
    expect(() => resolveLocale("fr")).toThrow(/unknown locale "fr"/);
  });
});
