// Verifies the actual npm-packed artifact in an isolated consumer:
//   1. `npm pack` (runs the build) and inspect the file list;
//   2. install the tarball plus peer dependencies into a fresh project outside this checkout;
//   3. type-check consumer code against the shipped declarations;
//   4. import the React-free entry in Node;
//   5. build the consumer with Vite and check that styles, fonts and externals are right.
// Usage: node scripts/verify-pack.mjs [--keep]
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const isWindows = process.platform === 'win32';
// npm/yarn are .cmd shims on Windows and need a shell; quote arguments for it.
const quote = (arg) => (isWindows && /[\s"]/.test(arg) ? `"${arg.replaceAll('"', '\\"')}"` : arg);
const run = (command, args, cwd) =>
  execFileSync(isWindows ? quote(command) : command, args.map(quote), {
    cwd,
    stdio: ['ignore', 'pipe', 'inherit'],
    shell: isWindows,
  })
    .toString()
    .trim();
const failures = [];
const check = (condition, message) => {
  console.log(`${condition ? 'ok  ' : 'FAIL'} ${message}`);
  if (!condition) failures.push(message);
};

// 1. Pack.
const packDir = join(root, '.pack-check');
rmSync(packDir, { recursive: true, force: true });
mkdirSync(packDir, { recursive: true });
// Build explicitly; --ignore-scripts keeps prepack output out of the JSON report.
execFileSync(isWindows ? 'yarn.cmd' : 'yarn', ['-s', 'build'], {
  cwd: root,
  stdio: 'inherit',
  shell: isWindows,
});
const [packed] = JSON.parse(
  run('npm', ['pack', '--json', '--ignore-scripts', '--pack-destination', packDir], root),
);
const tarball = join(packDir, packed.filename);
const files = packed.files.map((file) => file.path);
console.log(`packed ${packed.filename}: ${files.length} files, ${packed.size} bytes`);
check(packed.name === '@prostriveorg/ui' && packed.version === pkg.version, 'name and version');
for (const required of [
  'package.json',
  'README.md',
  'NOTICE.md',
  'dist/index.js',
  'dist/theme.js',
  'dist/dynamic.js',
  'dist/dynamic-data.js',
  'dist/styles.css',
  'dist/fonts.css',
  'dist/fonts/inter-latin-wght-normal.woff2',
  'dist/fonts/saira-latin-ext-wght-normal.woff2',
  'dist/fonts/inter-LICENSE.txt',
  'dist/types/index.d.ts',
  'dist/types/theme.d.ts',
  'dist/types/dynamic/index.d.ts',
  'dist/types/dynamic/data.d.ts',
])
  check(files.includes(required), `contains ${required}`);
check(
  !files.some((file) => /^(src|tests|playground|scripts|\.github)\//.test(file)),
  'no sources, tests, playground, scripts or workflows',
);
check(!files.some((file) => /\.npmrc|\.env|\.tgz$/.test(file)), 'no registry config or archives');

// 2. Isolated consumer outside the checkout.
const consumer = mkdtempSync(join(tmpdir(), 'psui-consumer-'));
const keep = process.argv.includes('--keep');
process.on('exit', () => {
  if (keep) console.log(`consumer kept at ${consumer}`);
  else rmSync(consumer, { recursive: true, force: true });
});
const version = (name) =>
  JSON.parse(readFileSync(join(root, 'node_modules', name, 'package.json'), 'utf8')).version;
writeFileSync(
  join(consumer, 'package.json'),
  JSON.stringify(
    {
      name: 'psui-consumer',
      private: true,
      type: 'module',
      dependencies: {
        '@prostriveorg/ui': `file:${tarball.replaceAll('\\', '/')}`,
        '@mantine/core': version('@mantine/core'),
        '@mantine/hooks': version('@mantine/hooks'),
        react: version('react'),
        'react-dom': version('react-dom'),
      },
      devDependencies: {
        '@types/react': version('@types/react'),
        '@types/react-dom': version('@types/react-dom'),
        '@vitejs/plugin-react': version('@vitejs/plugin-react'),
        typescript: version('typescript'),
        vite: version('vite'),
      },
    },
    null,
    2,
  ),
);
console.log(`installing into ${consumer}`);
run('yarn', ['install', '--silent', '--non-interactive', '--no-lockfile'], consumer);

const installed = join(consumer, 'node_modules', '@prostriveorg', 'ui');
const installedPkg = JSON.parse(readFileSync(join(installed, 'package.json'), 'utf8'));
check(installedPkg.version === pkg.version, 'installed version matches');
check(
  readdirSync(join(installed, 'dist', 'fonts')).filter((f) => f.endsWith('.woff2')).length === 4,
  'installed font files',
);
check(
  !existsSync(join(installed, 'node_modules')),
  'no nested dependencies installed with the package',
);

// 3. Type-check consumer code against the shipped declarations.
mkdirSync(join(consumer, 'src'));
writeFileSync(
  join(consumer, 'src', 'main.tsx'),
  `import '@mantine/core/styles.css';
import '@prostriveorg/ui/fonts.css';
import '@prostriveorg/ui/styles.css';

import { MantineProvider, createTheme, mergeThemeOverrides } from '@mantine/core';
import { FOOT_COLORS, formatClock } from '@prostriveorg/ui';
import type { Foot } from '@prostriveorg/ui';
import {
  createPreviewBuffers,
  ingestSample,
  LiveWorkspace,
  RecordingStrip,
  resolveSource,
  useRecordingClock,
} from '@prostriveorg/ui/dynamic';
import type { LivePreview, PreviewKind, ResolvedSource } from '@prostriveorg/ui/dynamic';
import { parseSample } from '@prostriveorg/ui/dynamic/data';
import { prostriveTheme } from '@prostriveorg/ui/theme';
import { createRoot } from 'react-dom/client';

const theme = mergeThemeOverrides(prostriveTheme, createTheme({ defaultRadius: 'md' }));
const buffers = createPreviewBuffers();
const outcome: 'accepted' | 'duplicate' | 'rejected' = ingestSample(buffers, null, 0);
const preview: LivePreview = { buffers, connected: true };
const source: ResolvedSource | null = resolveSource({ acquisitionMode: 'bluez' });
const kinds: Record<Foot, PreviewKind> = { Left: 'waiting', Right: 'disconnected' };
// @ts-expect-error units are required: no default unit claim.
const missingUnits = <LiveWorkspace preview={preview} />;

function Strip() {
  const clock = useRecordingClock({ anchorMs: null, observedAt: null, maxDurationMs: 1, running: false });
  return (
    <RecordingStrip
      recorder={{ headline: 'Not recording', detail: formatClock(0), tone: 'neutral' }}
      clock={clock}
      limitMs={300000}
      running={false}
      preview={kinds}
      previewDetail={outcome + String(parseSample(null, 0)) + FOOT_COLORS.Left}
    />
  );
}

createRoot(document.getElementById('root')!).render(
  <MantineProvider theme={theme}>
    <Strip />
    <LiveWorkspace preview={preview} units="unknown units" source={source} />
    {missingUnits}
  </MantineProvider>,
);
`,
);
writeFileSync(
  join(consumer, 'tsconfig.json'),
  JSON.stringify({
    compilerOptions: {
      target: 'ES2020',
      // Mantine's own declarations use ES2024 collection types.
      lib: ['ESNext', 'DOM', 'DOM.Iterable'],
      module: 'ESNext',
      moduleResolution: 'bundler',
      jsx: 'react-jsx',
      strict: true,
      noEmit: true,
      skipLibCheck: false,
      types: [],
    },
    include: ['src'],
  }),
);
writeFileSync(join(consumer, 'src', 'css.d.ts'), "declare module '*.css';\n");
try {
  run(process.execPath, [join('node_modules', 'typescript', 'bin', 'tsc'), '-p', '.'], consumer);
  check(true, 'consumer type-checks against shipped declarations (skipLibCheck off)');
} catch (error) {
  console.log(String(error.stdout ?? ''));
  check(false, 'consumer type-checks against shipped declarations (skipLibCheck off)');
}

// 4. The React-free entry loads in Node without React or Mantine.
writeFileSync(
  join(consumer, 'node-check.mjs'),
  `import * as data from '@prostriveorg/ui/dynamic/data';
import * as root from '@prostriveorg/ui';
console.log(typeof data.parseSample, typeof data.PreviewBuffer, typeof root.formatClock);
`,
);
const nodeCheck = run(process.execPath, ['node-check.mjs'], consumer);
check(nodeCheck === 'function function function', 'Node imports the data and root entries');
for (const file of ['index.js', 'dynamic-data.js'])
  check(
    !/from ["'](react|react-dom|@mantine)/.test(
      readFileSync(join(installed, 'dist', file), 'utf8'),
    ),
    `${file} has no React/Mantine import`,
  );

// 5. Vite build of the consumer.
writeFileSync(
  join(consumer, 'index.html'),
  '<!doctype html><html><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>',
);
writeFileSync(
  join(consumer, 'vite.config.js'),
  "import react from '@vitejs/plugin-react';\nexport default { plugins: [react()] };\n",
);
run(process.execPath, [join('node_modules', 'vite', 'bin', 'vite.js'), 'build'], consumer);
const assets = readdirSync(join(consumer, 'dist', 'assets'));
const css = assets
  .filter((file) => file.endsWith('.css'))
  .map((file) => readFileSync(join(consumer, 'dist', 'assets', file), 'utf8'))
  .join('');
check(
  /\.psui-recordingStrip/.test(css) && /--psui-strip-bg/.test(css),
  'consumer CSS has UI styles',
);
check(css.indexOf('.mantine-') < css.indexOf('.psui-'), 'Mantine styles precede UI styles');
check(
  assets.filter((file) => file.endsWith('.woff2')).length === 4,
  'consumer build emits the bundled fonts',
);
const shipped = readdirSync(join(installed, 'dist'))
  .filter((file) => file.endsWith('.js'))
  .map((file) => readFileSync(join(installed, 'dist', file), 'utf8'))
  .join('');
// Peers are imported, never bundled: no React, ReactDOM or Mantine implementation inside.
check(
  !/__CLIENT_INTERNALS|react\.(production|development)|MantineProvider\s*=|function MantineProvider/.test(
    shipped,
  ),
  'React, ReactDOM and Mantine are external (not bundled)',
);
check(
  /from "react"/.test(shipped) && /from "@mantine\/core"/.test(shipped),
  'components import the peer packages',
);
check(!/@tauri-apps|supabase|\.\.\/views\//.test(shipped), 'no Tauri, Supabase or app imports');

if (failures.length) {
  console.error(`\n${failures.length} pack check(s) failed`);
  process.exit(1);
}
console.log(`\nPacked artifact verified: ${tarball}`);
