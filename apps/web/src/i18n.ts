import { createTranslator, resolveLocale } from "@bridle/i18n";

/**
 * The locale of this build: `NEXT_PUBLIC_LOCALE`, `en` when it is unset or empty; another value than `en` or
 * `en-XA` throws, so a typo fails the build. Next inlines the variable at build time, and only when the
 * member expression is written out as below.
 */
export const locale = resolveLocale(process.env.NEXT_PUBLIC_LOCALE);

/** The catalog lookup of apps/web in that locale (docs/ops/i18n.md). */
export const t = createTranslator(locale);
