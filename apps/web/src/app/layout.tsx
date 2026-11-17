import type { Metadata } from "next";
import type { ReactNode } from "react";
import { locale, t } from "../i18n";

export const metadata: Metadata = {
  title: t("app.name"),
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang={locale}>
      <body>{children}</body>
    </html>
  );
}
