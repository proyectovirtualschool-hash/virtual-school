import { createWorker, OEM, PSM, Worker } from 'tesseract.js';

let workerPromise: Promise<Worker> | null = null;
let progressHandler: ((message: string, progress: number) => void) | null = null;

const WORKER_PATH = '/ocr/worker.min.js';
const CORE_PATH = '/ocr/core';
const LANG_PATH = '/ocr/lang';

function createLocalWorker(): Promise<Worker> {
  return createWorker('spa', OEM.LSTM_ONLY, {
    workerPath: WORKER_PATH,
    corePath: CORE_PATH,
    langPath: LANG_PATH,
    logger: (message) => {
      if (progressHandler && message.status) {
        progressHandler(message.status, Number(message.progress) || 0);
      }
    },
  });
}

export async function getTesseractWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = createLocalWorker().catch((error) => {
      workerPromise = null;
      throw new Error(
        `No se pudo iniciar Tesseract local. Ejecuta "npm run setup:ocr". Detalle: ${error?.message || error}`
      );
    });
  }
  return workerPromise;
}

export async function terminateTesseract(): Promise<void> {
  if (!workerPromise) return;
  const worker = await workerPromise;
  workerPromise = null;
  await worker.terminate();
}

export interface PageOcrResult {
  text: string;
  tsv: string;
  confidence: number;
}

export async function recognizePage(
  image: string,
  onProgress?: (message: string, progress: number) => void
): Promise<PageOcrResult> {
  const worker = await getTesseractWorker();
  progressHandler = onProgress || null;
  try {
    await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO });
    const result = await worker.recognize(image, {}, { text: true, tsv: true });
    return {
      text: result.data.text || '',
      tsv: result.data.tsv || '',
      confidence: Number(result.data.confidence) || 0,
    };
  } finally {
    progressHandler = null;
  }
}

export async function recognizeSingleLine(
  image: string,
  whitelist = ''
): Promise<{ text: string; confidence: number }> {
  const worker = await getTesseractWorker();
  try {
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.SINGLE_LINE,
      tessedit_char_whitelist: whitelist,
    });
    const result = await worker.recognize(image, {}, { text: true });
    return {
      text: (result.data.text || '').replace(/\s+/g, ' ').trim(),
      confidence: Number(result.data.confidence) || 0,
    };
  } finally {
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.AUTO,
      tessedit_char_whitelist: '',
    });
  }
}
