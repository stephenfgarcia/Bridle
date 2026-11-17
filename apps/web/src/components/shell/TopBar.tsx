import Link from "next/link";
import { t } from "../../i18n";
import { NavLinks } from "./NavLinks";
import styles from "./TopBar.module.css";

/** The shell's top bar: the product name, a link to `/`, and the main navigation. */
export function TopBar() {
  return (
    <header className={styles.bar}>
      <Link className={styles.brand} href="/">
        <span aria-hidden="true" className={styles.mark} />
        {t("app.name")}
      </Link>
      <NavLinks
        items={[
          { href: "/workspace", text: t("nav.workspace") },
          { href: "/tasks", text: t("nav.tasks") },
        ]}
        name={t("nav.label")}
      />
    </header>
  );
}
