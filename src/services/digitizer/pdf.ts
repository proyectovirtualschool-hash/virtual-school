import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export interface PdfPageImage {
  pageNumber: number;
  dataUrl: string;
  width: number;
  height: number;
}

export async function isPdfFile(file: File): Promise<boolean> {
  if (file.type === 'application/pdf') return true;
  if (!file.name.toLowerCase().endsWith('.pdf')) return false;
  const header = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  return String.fromCharCode(...header) === '%PDF-';
}

export async function renderPdfPages(file: File, maxPages = 8, maxWidth = 2000): Promise<PdfPageImage[]> {
  const buffer = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data: buffer });
  const pdf = await loadingTask.promise;
  const pageCount = Math.min(pdf.numPages, maxPages);
  const pages: PdfPageImage[] = [];
  try {
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const scale = Math.min(maxWidth / viewport.width, 3);
      const scaled = page.getViewport({ scale });
      const canvas = window.document.createElement('canvas');
      canvas.width = Math.round(scaled.width);
      canvas.height = Math.round(scaled.height);
      const context = canvas.getContext('2d');
      if (!context) throw new Error('No se pudo preparar el canvas del PDF');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvas, canvasContext: context, viewport: scaled }).promise;
      pages.push({
        pageNumber,
        dataUrl: canvas.toDataURL('image/jpeg', 0.92),
        width: canvas.width,
        height: canvas.height,
      });
      page.cleanup();
    }
  } finally {
    await loadingTask.destroy();
  }
  return pages;
}
