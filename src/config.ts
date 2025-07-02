import { existsSync } from "fs";
import path from "path";
import os from "os";

export interface GraftreeConfig {
  mode: "copy" | "symlink";
  include: string[];
  exclude?: string[];
}

const DEFAULT_CONFIG: GraftreeConfig = {
  mode: "copy",
  include: [".env"]
};

export async function loadConfig(): Promise<GraftreeConfig> {
  const configs: Partial<GraftreeConfig>[] = [];
  
  // Load global config (~/.graftreerc)
  const globalConfigPath = path.join(os.homedir(), ".graftreerc");
  if (existsSync(globalConfigPath)) {
    try {
      const globalConfig = await Bun.file(globalConfigPath).json();
      configs.push(globalConfig);
    } catch (error) {
      console.warn(`Warning: Failed to parse global config at ${globalConfigPath}`);
    }
  }
  
  // Load local config (./.graftreerc)
  const localConfigPath = path.join(process.cwd(), ".graftreerc");
  if (existsSync(localConfigPath)) {
    try {
      const localConfig = await Bun.file(localConfigPath).json();
      configs.push(localConfig);
    } catch (error) {
      console.warn(`Warning: Failed to parse local config at ${localConfigPath}`);
    }
  }
  
  // Merge configs: DEFAULT_CONFIG < global < local
  return {
    ...DEFAULT_CONFIG,
    ...configs.reduce((acc, config) => ({ ...acc, ...config }), {})
  };
}