export default {
  // `unbundle` keeps every entry self-contained, which also means every module a test or a
  // check imports directly has to be listed here (a missing entry is a module that exists in
  // src and not in lib — found the hard way when the Git plumbing was added).
  entry: [
    'src/index.ts',
    'src/plugin.ts',
    'src/changed-paths.ts',
    'src/tree-snapshot.ts',
    'src/git-artifacts.ts',
    'src/task-store.ts',
    'src/team-store.ts',
    'src/dispatch.ts',
    'src/mailbox.ts',
    'src/routes.ts',
    'src/scope.ts',
    'src/path-diagnostics.ts',
    'src/session-bridge.ts',
    'src/rotation.ts',
    'src/review-return-state.ts',
    'src/review-return-ports.ts',
    'src/review-return-guard.ts',
    'src/assignment-guard.ts',
    'src/assignment-recovery.ts',
    'src/submission-notice-ports.ts',
    'src/lifecycle-notice.ts',
  ],
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'node22',
  dts: true,
  clean: true,
  // Each entry must be self-contained: DSH plugin packages ship plain
  // lib/<entry>.js files, and hashed shared chunks would also fall outside the
  // package's published `files` list.
  unbundle: true,
  sourcemap: false,
  // First-party DSH packages ship `.js` and `.d.ts`, not `.mjs` and `.d.mts`.
  outExtensions: () => ({ js: '.js', dts: '.d.ts' }),
  external: [
    /^@deepseek-ai\//,
    /^node:/,
  ],
}
