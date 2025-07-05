import { existsSync } from "fs";
import { readFile } from "fs/promises";
import path from "path";
import os from "os";

export interface GraftreeConfig {
  mode: "copy" | "symlink";
  include: string[];
  exclude?: string[];
}

export interface CliArgs {
  include?: string[];
  exclude?: string[];
}

const DEFAULT_CONFIG: GraftreeConfig = {
  mode: "copy",
  include: []
};

export async function loadConfig(cliArgs?: CliArgs): Promise<GraftreeConfig> {
  const configs: Partial<GraftreeConfig>[] = [];
  
  // Load global config (~/.graftreerc)
  const globalConfigPath = path.join(os.homedir(), ".graftreerc");
  if (existsSync(globalConfigPath)) {
    try {
      const globalConfigContent = await readFile(globalConfigPath, "utf-8");
      const globalConfig = JSON.parse(globalConfigContent);
      configs.push(globalConfig);
    } catch {
      console.warn(`Warning: Failed to parse global config at ${globalConfigPath}`);
    }
  }
  
  // Load local config (./.graftreerc)
  const localConfigPath = path.join(process.cwd(), ".graftreerc");
  if (existsSync(localConfigPath)) {
    try {
      const localConfigContent = await readFile(localConfigPath, "utf-8");
      const localConfig = JSON.parse(localConfigContent);
      configs.push(localConfig);
    } catch {
      console.warn(`Warning: Failed to parse local config at ${localConfigPath}`);
    }
  }
  
  // Merge configs: DEFAULT_CONFIG < global < local
  const mergedConfig = {
    ...DEFAULT_CONFIG,
    ...configs.reduce((acc, config) => ({ ...acc, ...config }), {})
  };
  
  // Apply CLI args if provided (append to config)
  if (cliArgs) {
    if (cliArgs.include) {
      mergedConfig.include = [...mergedConfig.include, ...cliArgs.include];
    }
    if (cliArgs.exclude) {
      mergedConfig.exclude = [...(mergedConfig.exclude || []), ...cliArgs.exclude];
    }
  }
  
  return mergedConfig;
}