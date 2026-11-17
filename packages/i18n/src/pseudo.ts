// The pseudo-locale generator (card P0-02.6): en-XA is en with accented, lengthened text inside brackets.
// Imported by scripts/pseudo.mjs through node's type stripping: keep this file erasable TypeScript (no enum,
// no parameter property) and without relative imports.
import { type MessageFormatElement, parse, TYPE } from "@formatjs/icu-messageformat-parser";
import { printAST } from "@formatjs/icu-messageformat-parser/printer.js";

const PLAIN = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const ACCENTED = [..."åƀçðéƒĝĥîĵķļɱñöþǫŕšţûṽŵẋýžÅƁÇÐÉƑĜĤÎĴĶĻṀÑÖÞǪŔŠŢÛṼŴẊÝŽ"];
const VOWELS = "aeiouAEIOU";

/**
 * Plain text to pseudo text: each ASCII letter becomes its accented look-alike, written twice when the
 * letter is a vowel (the lengthening); every other character stays as it is.
 */
export function pseudoText(text: string): string {
  let out = "";
  for (const ch of text) {
    const accented = ACCENTED[PLAIN.indexOf(ch)];
    if (accented === undefined) {
      out += ch;
    } else {
      out += VOWELS.includes(ch) ? accented + accented : accented;
    }
  }
  return out;
}

// The literal text of a parsed message, at the top level, in plural and select options and in tag children;
// arguments, `#`, skeletons and tag names are returned as they are.
function pseudoElements(elements: MessageFormatElement[]): MessageFormatElement[] {
  return elements.map((element) => {
    if (element.type === TYPE.literal) {
      return { ...element, value: pseudoText(element.value) };
    }
    if (element.type === TYPE.plural || element.type === TYPE.select) {
      const options: typeof element.options = {};
      for (const [key, option] of Object.entries(element.options)) {
        options[key] = { ...option, value: pseudoElements(option.value) };
      }
      return { ...element, options };
    }
    if (element.type === TYPE.tag) {
      return { ...element, children: pseudoElements(element.children) };
    }
    return element;
  });
}

/** An ICU message to its pseudo-locale form, in brackets. Throws when the message does not parse. */
export function pseudoMessage(message: string): string {
  return `[${printAST(pseudoElements(parse(message)))}]`;
}

/** A catalog to its pseudo-locale catalog: the same ids in the same order. */
export function pseudoCatalog(catalog: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [id, message] of Object.entries(catalog)) {
    out[id] = pseudoMessage(message);
  }
  return out;
}
