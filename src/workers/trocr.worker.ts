import { env, pipeline } from '@huggingface/transformers';

const scope = self as any;

env.allowLocalModels = true;
env.allowRemoteModels = false;
env.localModelPath = '/models/';
env.useBrowserCache = true;
const wasmBackend = env.backends?.onnx?.wasm;
if (wasmBackend) {
  wasmBackend.numThreads = 1;
  wasmBackend.wasmPaths = '/ocr/ort/';
}

let pipelinePromise: Promise<any> | null = null;

function getPipeline() {
  if (!pipelinePromise) {
    pipelinePromise = pipeline('image-to-text', 'trocr-small-handwritten', {
      dtype: 'q8',
      device: 'wasm',
    });
  }
  return pipelinePromise;
}

function extractText(output: any): string {
  const first = Array.isArray(output) ? output[0] : output;
  if (!first) return '';
  if (typeof first === 'string') return first;
  return first.generated_text || first.text || first.generated_text?.[0] || '';
}

scope.onmessage = async (event: MessageEvent) => {
  const { id, type, image } = event.data || {};
  try {
    if (type === 'warmup') {
      await getPipeline();
      scope.postMessage({ id, ok: true, text: '' });
      return;
    }
    if (type === 'recognize') {
      const recognizer = await getPipeline();
      const output = await recognizer(image, {
        max_new_tokens: 48,
        num_beams: 1,
      });
      scope.postMessage({ id, ok: true, text: extractText(output) });
      return;
    }
    scope.postMessage({ id, ok: false, error: `Tipo de mensaje desconocido: ${type}` });
  } catch (error: any) {
    pipelinePromise = null;
    scope.postMessage({ id, ok: false, error: error?.message || String(error) });
  }
};
