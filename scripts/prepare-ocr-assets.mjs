import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const publicOcr = path.join(root, 'public', 'ocr');
const coreTarget = path.join(publicOcr, 'core');
const langTarget = path.join(publicOcr, 'lang');
const ortTarget = path.join(publicOcr, 'ort');
const require = createRequire(import.meta.url);

function resolvePackageDir(packageName) {
  let current = path.dirname(require.resolve(packageName));
  while (current !== path.dirname(current)) {
    const packageJson = path.join(current, 'package.json');
    if (fs.existsSync(packageJson)) {
      const parsed = JSON.parse(fs.readFileSync(packageJson, 'utf8'));
      if (parsed.name === packageName) return current;
    }
    current = path.dirname(current);
  }
  throw new Error(`No se encontró el directorio del paquete ${packageName}`);
}

function copyFile(source, destination) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
}

function main() {
  const tesseractDir = resolvePackageDir('tesseract.js');
  const coreDir = resolvePackageDir('tesseract.js-core');
  const spaDir = resolvePackageDir('@tesseract.js-data/spa');
  const ortDir = path.join(resolvePackageDir('onnxruntime-web'), 'dist');

  copyFile(path.join(tesseractDir, 'dist', 'worker.min.js'), path.join(publicOcr, 'worker.min.js'));

  const coreFiles = fs
    .readdirSync(coreDir)
    .filter((name) => name.endsWith('.wasm.js') || name.endsWith('.wasm'));
  for (const name of coreFiles) {
    copyFile(path.join(coreDir, name), path.join(coreTarget, name));
  }

  copyFile(
    path.join(spaDir, '4.0.0_best_int', 'spa.traineddata.gz'),
    path.join(langTarget, 'spa.traineddata.gz')
  );

  const ortFiles = fs
    .readdirSync(ortDir)
    .filter(
      (name) =>
        name.startsWith('ort-wasm-simd-threaded') &&
        (name.endsWith('.wasm') || name.endsWith('.mjs'))
    );
  for (const name of ortFiles) {
    copyFile(path.join(ortDir, name), path.join(ortTarget, name));
  }

  const manifest = {
    preparedAt: new Date().toISOString(),
    worker: '/ocr/worker.min.js',
    core: '/ocr/core',
    lang: '/ocr/lang',
    ort: '/ocr/ort',
    language: 'spa',
    coreFiles,
    ortFiles,
  };
  fs.writeFileSync(path.join(publicOcr, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`[ocr] Assets listos: worker, ${coreFiles.length} archivos de core y spa.traineddata.gz`);
}

try {
  main();
} catch (error) {
  console.error('[ocr] No se pudieron preparar los assets:', error.message);
  process.exit(1);
}
