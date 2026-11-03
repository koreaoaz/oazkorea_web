/** Runs when a Next server instance starts, before serving application requests. */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { assertRuntimeEnvironment } = await import('./lib/privacy/preview-environment.mjs');
    const { publicDeploymentEnvironment } = await import('./lib/privacy/deployment-environment');
    // Indirect access keeps runtime values distinct from Next's baked public values.
    const runtime = process.env;
    try {
      assertRuntimeEnvironment(publicDeploymentEnvironment(), runtime);
    } catch {
      // Next may keep listening after a rejected instrumentation promise. Fail
      // the process explicitly so a bad Preview never reaches readiness.
      console.error('PREVIEW_STOP:SERVER_CONFIGURATION');
      process.exit(1);
    }
  }
}
