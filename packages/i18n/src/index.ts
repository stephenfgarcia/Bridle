// The message catalog and its lookup (card P0-02.6, I18N-01): user-facing strings live in ../messages/en.json
// as ICU MessageFormat; ../messages/en-XA.json is the generated pseudo-locale (`pnpm i18n:pseudo`).
import { IntlMessageFormat } from "intl-messageformat";
import en from "../messages/en.json";
import enXA from "../messages/en-XA.json";

export const LOCALES = ["en", "en-XA"] as const;
export type Locale = (typeof LOCALES)[number];
/** The ids of the catalog: a lookup of an id that en.json does not hold is a type error. */
export type MessageId = keyof typeof en;
export type MessageValues = Record<string, string | number | boolean | Date | null | undefined>;

// Typed against the ids of en.json: a key missing from en-XA.json is a type error here.
const CATALOGS: Record<Locale, Record<MessageId, string>> = { en, "en-XA": enXA };

const formats = new Map<string, IntlMessageFormat>();

/** The locale a raw setting names: `en` when it is unset or empty; an unknown value throws, naming it. */
export function resolveLocale(raw: string | undefined): Locale {
  const value = raw?.trim();
  if (!value) {
    return "en";
  }
  const found = LOCALES.find((locale) => locale === value);
  if (found === undefined) {
    throw new Error(`unknown locale "${value}": expected one of ${LOCALES.join(", ")}`);
  }
  return found;
}

/** Formats one ICU message. Throws when the message does not parse or a value it names is missing. */
export function formatMessage(locale: Locale, message: string, values?: MessageValues): string {
  const key = `${locale}\u0000${message}`;
  let format = formats.get(key);
  if (format === undefined) {
    format = new IntlMessageFormat(message, locale);
    formats.set(key, format);
  }
  return String(format.format(values));
}

/** The catalog lookup: the message of `id` in `locale`, formatted with `values`. */
export function t(id: MessageId, values?: MessageValues, locale: Locale = "en"): string {
  const message: string | undefined = CATALOGS[locale][id];
  if (message === undefined) {
    throw new Error(`unknown message id "${id}" in the ${locale} catalog`);
  }
  return formatMessage(locale, message, values);
}

/** A lookup bound to one locale. */
export function createTranslator(
  locale: Locale,
): (id: MessageId, values?: MessageValues) => string {
  return (id, values) => t(id, values, locale);
}
