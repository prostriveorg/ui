// Copies the latin and latin-ext variable font files of Inter and Saira into dist/fonts and
// writes dist/fonts.css with matching @font-face rules. Optional for consumers: import
// `@prostriveorg/ui/fonts.css` to use the theme fonts without a network font service.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const out = fileURLToPath(new URL('../dist/', import.meta.url));
mkdirSync(join(out, 'fonts'), { recursive: true });

const families = [
  { pkg: '@fontsource-variable/inter', prefix: 'inter' },
  { pkg: '@fontsource-variable/saira', prefix: 'saira' },
];
const subsets = ['latin-ext', 'latin'];
let css =
  '/* Inter and Saira variable fonts (SIL Open Font License 1.1, see fonts/*-LICENSE.txt).\n' +
  ' * Latin and Latin Extended subsets only. Generated from @fontsource-variable. */\n';
for (const { pkg, prefix } of families) {
  const root = dirname(require.resolve(`${pkg}/package.json`));
  const source = readFileSync(join(root, 'index.css'), 'utf8');
  for (const subset of subsets) {
    const name = `${prefix}-${subset}-wght-normal`;
    const start = source.indexOf(`/* ${name} */`);
    const end = start < 0 ? -1 : source.indexOf('}', start);
    if (end < 0) throw new Error(`No @font-face for ${name} in ${pkg}`);
    const block = source.slice(start, end + 1);
    copyFileSync(join(root, 'files', `${name}.woff2`), join(out, 'fonts', `${name}.woff2`));
    css += `\n${block.replace(`./files/${name}.woff2`, `./fonts/${name}.woff2`)}\n`;
  }
  copyFileSync(join(root, 'LICENSE'), join(out, 'fonts', `${prefix}-LICENSE.txt`));
}
writeFileSync(join(out, 'fonts.css'), css);
console.log('fonts.css and', families.length * subsets.length, 'font files written');
