import { readFile, writeFile } from 'node:fs/promises';

const version = process.argv[2]?.replace(/^v/, '');
if (!version || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
  throw new Error('Uso: npm run version:set -- 1.2.0');
}

for (const file of ['package.json', 'package-lock.json', 'src-tauri/tauri.conf.json']) {
  const contents = JSON.parse(await readFile(file, 'utf8'));
  contents.version = version;
  if (file === 'package-lock.json' && contents.packages?.['']) {
    contents.packages[''].version = version;
  }
  await writeFile(file, `${JSON.stringify(contents, null, 2)}\n`);
}

const cargoPath = 'src-tauri/Cargo.toml';
const cargo = await readFile(cargoPath, 'utf8');
await writeFile(cargoPath, cargo.replace(/^version = ".+"$/m, `version = "${version}"`));

console.log(`Haven Desktop atualizado para ${version}.`);
