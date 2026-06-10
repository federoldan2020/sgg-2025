/**
 * Next.js fija postcss@8.4.31 en node_modules/next/node_modules/postcss.
 * npm overrides no siempre lo reemplaza; sincronizamos la versión parcheada del proyecto.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const safePostcss = path.join(root, 'node_modules', 'postcss');
const nestedPostcss = path.join(root, 'node_modules', 'next', 'node_modules', 'postcss');

if (!fs.existsSync(safePostcss) || !fs.existsSync(nestedPostcss)) {
  process.exit(0);
}

const safePkg = JSON.parse(
  fs.readFileSync(path.join(safePostcss, 'package.json'), 'utf8'),
);
const nestedPkg = JSON.parse(
  fs.readFileSync(path.join(nestedPostcss, 'package.json'), 'utf8'),
);

const nextPkgPath = path.join(root, 'node_modules', 'next', 'package.json');
const nextPkg = JSON.parse(fs.readFileSync(nextPkgPath, 'utf8'));
const targetVersion = safePkg.version;

if (nestedPkg.version === targetVersion && nextPkg.dependencies?.postcss === targetVersion) {
  process.exit(0);
}

if (nextPkg.dependencies?.postcss) {
  nextPkg.dependencies.postcss = targetVersion;
  fs.writeFileSync(nextPkgPath, `${JSON.stringify(nextPkg, null, 2)}\n`);
}

fs.rmSync(nestedPostcss, { recursive: true, force: true });
fs.cpSync(safePostcss, nestedPostcss, { recursive: true });
console.log(
  `[postinstall] postcss en next actualizado: ${nestedPkg.version} → ${targetVersion}`,
);
