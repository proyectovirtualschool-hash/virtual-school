import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const MODEL_ID = process.env.TROCR_MODEL_ID || 'Xenova/trocr-small-handwritten';
const MODEL_DIR_NAME = process.env.TROCR_MODEL_DIR || MODEL_ID.split('/').pop();
const targetDir = path.join(root, 'public', 'models', MODEL_DIR_NAME);

const files = [
  'config.json',
  'generation_config.json',
  'preprocessor_config.json',
  'tokenizer.json',
  'tokenizer_config.json',
  'special_tokens_map.json',
  'sentencepiece.bpe.model',
  'quantize_config.json',
  'onnx/encoder_model_quantized.onnx',
  'onnx/decoder_model_merged_quantized.onnx',
];

function humanSize(bytes) {
  if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes > 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

async function download(file) {
  const destination = path.join(targetDir, file);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  if (fs.existsSync(destination) && fs.statSync(destination).size > 0) {
    console.log(`[ocr] ${file} ya existe (${humanSize(fs.statSync(destination).size)})`);
    return;
  }
  const url = `https://huggingface.co/${MODEL_ID}/resolve/main/${file}`;
  console.log(`[ocr] Descargando ${file}...`);
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) {
    throw new Error(`No se pudo descargar ${url}: HTTP ${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(destination, buffer);
  console.log(`[ocr] ${file} guardado (${humanSize(buffer.length)})`);
}

async function main() {
  console.log(`[ocr] Modelo TrOCR: ${MODEL_ID}`);
  console.log(`[ocr] Destino: ${path.relative(root, targetDir)}`);
  for (const file of files) {
    await download(file);
  }
  const metadata = {
    modelId: MODEL_ID,
    downloadedAt: new Date().toISOString(),
    files,
  };
  fs.writeFileSync(path.join(targetDir, 'local-model.json'), JSON.stringify(metadata, null, 2));
  console.log('[ocr] Modelo listo. Todo el reconocimiento se ejecutará localmente.');
}

main().catch((error) => {
  console.error('[ocr] Error:', error.message);
  process.exit(1);
});
