import { get, set, del } from "idb-keyval";
import type { AppConfig, Dataset } from "@/core/types";
import { appConfigSchema } from "@/core/config/schema";

/**
 * IndexedDB persistence for configuration and datasets. Chosen so the
 * internal application works fully offline/local today while keeping a thin
 * seam that a backend/database can replace later.
 */

const CONFIG_KEY = "utilization:config";
const CONFIG_HISTORY_KEY = "utilization:config-history";
const DATASETS_KEY = "utilization:datasets";

export async function loadConfig(): Promise<AppConfig | null> {
  const raw = await get(CONFIG_KEY);
  if (!raw) return null;
  const parsed = appConfigSchema.safeParse(raw);
  return parsed.success ? (parsed.data as AppConfig) : null;
}

export async function persistConfig(config: AppConfig): Promise<void> {
  appConfigSchema.parse(config);
  await set(CONFIG_KEY, config);
}

export async function loadConfigHistory(): Promise<AppConfig[]> {
  return ((await get(CONFIG_HISTORY_KEY)) as AppConfig[] | undefined) ?? [];
}

export async function persistConfigHistory(history: AppConfig[]): Promise<void> {
  await set(CONFIG_HISTORY_KEY, history);
}

export async function loadDatasets(): Promise<Dataset[]> {
  return ((await get(DATASETS_KEY)) as Dataset[] | undefined) ?? [];
}

export async function persistDatasets(datasets: Dataset[]): Promise<void> {
  await set(DATASETS_KEY, datasets);
}

export async function clearAll(): Promise<void> {
  await Promise.all([del(CONFIG_KEY), del(CONFIG_HISTORY_KEY), del(DATASETS_KEY)]);
}
