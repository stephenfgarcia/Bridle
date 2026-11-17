import { t } from "../i18n";
import { gitSha } from "../sha";

// Rendered at request time: the image gets its sha after the build, and a prerendered page would freeze it.
export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <main>
      <h1>{t("app.name")}</h1>
      <p data-testid="sha">{gitSha()}</p>
      <p data-testid="notice">{t("home.notice")}</p>
    </main>
  );
}
