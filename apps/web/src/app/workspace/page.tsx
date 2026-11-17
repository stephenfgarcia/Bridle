import { StaticGrid } from "../../components/viewport/StaticGrid";
import { t } from "../../i18n";
import styles from "./page.module.css";

// The workspace: the viewport area and the side panel area. Card W2 builds the viewport; the panel is empty.
export default function WorkspacePage() {
  return (
    <main className={styles.workspace} id="content">
      <h1 className="visually-hidden">{t("workspace.title")}</h1>
      <section
        aria-label={t("workspace.viewport.label")}
        className={styles.viewport}
        data-testid="viewport"
      >
        <StaticGrid />
      </section>
      <aside
        aria-labelledby="workspace-panel-title"
        className={styles.panel}
        data-testid="side-panel"
      >
        <h2 className={styles.panelTitle} id="workspace-panel-title">
          {t("workspace.panel.title")}
        </h2>
        <p className={styles.panelEmpty}>{t("workspace.panel.empty")}</p>
      </aside>
    </main>
  );
}
