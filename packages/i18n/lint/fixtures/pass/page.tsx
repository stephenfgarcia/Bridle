// Passing fixture of lint-strings: the same shapes as the failing fixture, every string a catalog lookup or
// in a position no user reads.
"use client";

import { t } from "../i18n";

export const dynamic = "force-dynamic";

export const metadata = {
  title: t("app.name"),
};

type Mode = "read only" | "read write";

export default function PassPage({ late, mode }: { late: boolean; mode: Mode }) {
  if (mode !== "read only" && mode !== "read write") {
    throw new Error("unknown mode: expected read only or read write");
  }
  console.warn("rendering the passing fixture");
  return (
    <main className="page wide" data-testid="pass" lang="en">
      <h1>{t("app.name")}</h1>
      <p>{late ? t("home.notice") : null}</p>
      <p>
        {42} / {100}
      </p>
      <img src="/beam.png" alt={t("app.name")} />
      <input type="text" name="q" placeholder={t("app.name")} />
    </main>
  );
}
