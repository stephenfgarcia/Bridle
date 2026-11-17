import { WorkspaceView } from "../../components/workspace/WorkspaceView";
import { t } from "../../i18n";
import styles from "./page.module.css";

// The workspace: the viewport of the model and the side panel (components/workspace/WorkspaceView.tsx).
export default function WorkspacePage() {
  return (
    <main className={styles.workspace} id="content">
      <h1 className="visually-hidden">{t("workspace.title")}</h1>
      <WorkspaceView />
    </main>
  );
}
