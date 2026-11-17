export function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('No se pudo cargar la imagen'));
    image.src = dataUrl;
  });
}

export function imageToCanvas(image: HTMLImageElement, maxWidth = 2000): HTMLCanvasElement {
  let width = image.naturalWidth || image.width;
  let height = image.naturalHeight || image.height;
  if (!width || !height) throw new Error('La imagen no tiene dimensiones válidas');
  if (width > maxWidth || height > maxWidth) {
    if (width >= height) {
      height = Math.round((height * maxWidth) / width);
      width = maxWidth;
    } else {
      width = Math.round((width * maxWidth) / height);
      height = maxWidth;
    }
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('No se pudo crear el contexto de canvas');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  return canvas;
}

export function dataUrlToCanvas(dataUrl: string, maxWidth = 2000): Promise<HTMLCanvasElement> {
  return loadImage(dataUrl).then((image) => imageToCanvas(image, maxWidth));
}

export function canvasToDataUrl(canvas: HTMLCanvasElement, quality = 0.92, type = 'image/jpeg'): string {
  return canvas.toDataURL(type, quality);
}

export function cropCanvas(
  source: HTMLCanvasElement,
  x: number,
  y: number,
  width: number,
  height: number,
  scale = 1
): HTMLCanvasElement {
  const safeX = Math.max(0, Math.min(source.width - 1, Math.round(x)));
  const safeY = Math.max(0, Math.min(source.height - 1, Math.round(y)));
  const safeWidth = Math.max(1, Math.min(source.width - safeX, Math.round(width)));
  const safeHeight = Math.max(1, Math.min(source.height - safeY, Math.round(height)));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(safeWidth * scale));
  canvas.height = Math.max(1, Math.round(safeHeight * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('No se pudo crear el contexto de canvas');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(
    source,
    safeX,
    safeY,
    safeWidth,
    safeHeight,
    0,
    0,
    canvas.width,
    canvas.height
  );
  return canvas;
}

export function makeThumbnail(dataUrl: string, maxWidth = 220): Promise<string> {
  return dataUrlToCanvas(dataUrl, maxWidth).then((canvas) => canvasToDataUrl(canvas, 0.7));
}

export function estimateInkRatio(canvas: HTMLCanvasElement): number {
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return 0;
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  let dark = 0;
  let total = 0;
  for (let index = 0; index < data.length; index += 4) {
    const alpha = data[index + 3];
    if (alpha < 20) continue;
    const luminance = 0.299 * data[index] + 0.587 * data[index + 1] + 0.114 * data[index + 2];
    if (luminance < 150) dark++;
    total++;
  }
  return total ? dark / total : 0;
}

export function estimateSharpness(canvas: HTMLCanvasElement): number {
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return 0;
  const { width, height } = canvas;
  const { data } = context.getImageData(0, 0, width, height);
  const gray = new Float32Array(width * height);
  for (let index = 0; index < data.length; index += 4) {
    gray[index / 4] = 0.299 * data[index] + 0.587 * data[index + 1] + 0.114 * data[index + 2];
  }
  let sum = 0;
  let sumSquares = 0;
  let count = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const value =
        -4 * gray[y * width + x] +
        gray[(y - 1) * width + x] +
        gray[(y + 1) * width + x] +
        gray[y * width + x - 1] +
        gray[y * width + x + 1];
      sum += value;
      sumSquares += value * value;
      count++;
    }
  }
  if (!count) return 0;
  const mean = sum / count;
  return sumSquares / count - mean * mean;
}
