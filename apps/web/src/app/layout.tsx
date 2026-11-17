import type { Metadata } from "next";
import type { ReactNode } from "react";
import { TopBar } from "../components/shell/TopBar";
import { locale, t } from "../i18n";
// The tokens first: global.css and the modules of the components read their custom properties.
import "../styles/tokens.css";
import "../styles/global.css";

export const metadata: Metadata = {
  title: t("app.name"),
};

// The shell of every route: the skip link, the top bar, then the page, whose <main> has the id `content`.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang={locale}>
      <body>
        <a className="skip-link" href="#content">
          {t("shell.skipToContent")}
        </a>
        <TopBar />
        {children}
      </body>
    </html>
  );
}
