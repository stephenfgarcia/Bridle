export interface LiveConfig {
  url: string;
  anonKey: string;
  /** Optional: which project row to show. Default: the oldest one. */
  projectId?: string;
}

/** Reads the browser-side configuration (Vite exposes VITE_* variables to the client). */
export function readLiveConfig(env: Record<string, string | undefined>): LiveConfig | null {
  const url = env.VITE_SUPABASE_URL?.trim();
  const anonKey = env.VITE_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) return null;
  const projectId = env.VITE_PROJECT_ID?.trim();
  return projectId ? { url, anonKey, projectId } : { url, anonKey };
}
