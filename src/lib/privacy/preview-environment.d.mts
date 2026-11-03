export type DeploymentEnvironment = Record<string, string | undefined>;
export function checkPreviewEnvironment(env: DeploymentEnvironment): string;
export function assertRuntimeEnvironment(compiled: DeploymentEnvironment, runtime: DeploymentEnvironment): void;
