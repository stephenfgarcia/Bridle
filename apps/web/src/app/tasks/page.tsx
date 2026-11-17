import { t } from "../../i18n";
import styles from "./page.module.css";

// The tasks route before stage B: the shell and a "coming soon" state.
export default function TasksPage() {
  return (
    <main className={styles.tasks} id="content">
      <h1 className={styles.title}>{t("tasks.title")}</h1>
      <section className={styles.empty} data-testid="coming-soon">
        <h2 className={styles.emptyTitle}>{t("tasks.comingSoon.title")}</h2>
        <p className={styles.emptyBody}>{t("tasks.comingSoon.body")}</p>
      </section>
    </main>
  );
}
