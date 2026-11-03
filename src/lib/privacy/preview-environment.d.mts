export type DeploymentEnvironment = Record<string, string | undefined>;
export function checkPreviewEnvironment(env: DeploymentEnvironment): string;
export function assertRuntimeEnvironment(compiled: DeploymentEnvironment, runtime: DeploymentEnvironment): void;
export function previewVariableInventory(env: DeploymentEnvironment): Array<{ name: string; present: boolean; kind: string; matchesDeclaredTarget?: boolean }>;
