import { describe, expect, it } from "vitest";
import { formatMessage } from "./index";
import { pseudoCatalog, pseudoMessage, pseudoText } from "./pseudo";

const MEMBERS = "{count, plural, =0 {No members} one {# member} other {# members}} in {course}";

describe("pseudoText (fixture P)", () => {
  it("accents every ASCII letter, doubles the vowels and keeps the rest", () => {
    expect(pseudoText("abcdefghijklmnopqrstuvwxyz ABCDEFGHIJKLMNOPQRSTUVWXYZ 0-9")).toBe(
      "ååƀçðééƒĝĥîîĵķļɱñööþǫŕšţûûṽŵẋýž ÅÅƁÇÐÉÉƑĜĤÎÎĴĶĻṀÑÖÖÞǪŔŠŢÛÛṼŴẊÝŽ 0-9",
    );
  });
  it("keeps an empty string empty", () => {
    expect(pseudoText("")).toBe("");
  });
});

describe("pseudoMessage (fixture G)", () => {
  it("keeps plural arguments, # and the argument names; the result formats in en-XA", () => {
    const pseudo = pseudoMessage(MEMBERS);
    expect(formatMessage("en-XA", pseudo, { count: 0, course: "CE 101" })).toBe(
      "[Ñöö ɱééɱƀééŕš îîñ CE 101]",
    );
    expect(formatMessage("en-XA", pseudo, { count: 1, course: "CE 101" })).toBe(
      "[1 ɱééɱƀééŕ îîñ CE 101]",
    );
    expect(formatMessage("en-XA", pseudo, { count: 1234, course: "CE 101" })).toBe(
      "[1,234 ɱééɱƀééŕš îîñ CE 101]",
    );
  });
  it("keeps apostrophes that are text", () => {
    expect(formatMessage("en-XA", pseudoMessage("It's {name}'s turn"), { name: "Ana" })).toBe(
      "[ÎÎţ'š Ana'š ţûûŕñ]",
    );
  });
  it("keeps quoted braces literal", () => {
    expect(formatMessage("en-XA", pseudoMessage("Use '{braces}' literally"))).toBe(
      "[ÛÛšéé {ƀŕååçééš} ļîîţééŕååļļý]",
    );
  });
  it("accents the children of a tag, not its name", () => {
    expect(pseudoMessage("Read the <b>notice</b> first")).toBe(
      "[Ŕééååð ţĥéé <b>ñööţîîçéé</b> ƒîîŕšţ]",
    );
  });
  it("throws on a message that does not parse (a plural without other)", () => {
    expect(() => pseudoMessage("{count, plural, one {# member}")).toThrow();
  });
});

describe("pseudoCatalog", () => {
  it("keeps the ids and their order", () => {
    const out = pseudoCatalog({ "b.two": "Two", "a.one": "One" });
    expect(Object.entries(out)).toEqual([
      ["b.two", "[Ţŵöö]"],
      ["a.one", "[ÖÖñéé]"],
    ]);
  });
});
