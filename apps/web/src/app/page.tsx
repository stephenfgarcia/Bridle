import Link from "next/link";
import { t } from "../i18n";
import { gitSha } from "../sha";
import styles from "./page.module.css";

// Rendered at request time: the image gets its sha after the build, and a prerendered page would freeze it.
export const dynamic = "force-dynamic";

// The h1 and the two paragraphs carry no class: tools/test/web.test.sh matches their markup.
export default function HomePage() {
  return (
    <main className={styles.home} id="content">
      <h1>{t("app.name")}</h1>
      <p data-testid="sha">{gitSha()}</p>
      <p data-testid="notice">{t("home.notice")}</p>
      <Link className={styles.action} href="/workspace">
        {t("home.openWorkspace")}
      </Link>
    </main>
  );
}
