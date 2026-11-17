import { dataUrlToCanvas, canvasToDataUrl } from './imageUtils';

type Cv = any;

let cvPromise: Promise<Cv> | null = null;

export async function loadOpenCv(): Promise<Cv> {
  if (cvPromise) return cvPromise;
  cvPromise = (async () => {
    const module: any = await import('@techstark/opencv-js');
    const candidate = module?.default ?? module;
    if (candidate instanceof Promise) return candidate;
    if (candidate?.Mat) return candidate;
    return new Promise<Cv>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error('OpenCV.js no terminó de inicializar')), 60000);
      candidate.onRuntimeInitialized = () => {
        window.clearTimeout(timeout);
        resolve(candidate);
      };
    });
  })();
  return cvPromise;
}

function fallbackEnhance(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return canvas;
  const output = document.createElement('canvas');
  output.width = canvas.width;
  output.height = canvas.height;
  const outputContext = output.getContext('2d');
  if (!outputContext) return canvas;
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  for (let index = 0; index < data.length; index += 4) {
    const gray = 0.299 * data[index] + 0.587 * data[index + 1] + 0.114 * data[index + 2];
    const contrasted = Math.max(0, Math.min(255, (gray - 128) * 1.35 + 140));
    data[index] = contrasted;
    data[index + 1] = contrasted;
    data[index + 2] = contrasted;
  }
  outputContext.putImageData(imageData, 0, 0);
  return output;
}

export interface EnhancedPage {
  enhancedDataUrl: string;
  usedFallback: boolean;
  width: number;
  height: number;
}

export async function enhanceDocument(dataUrl: string): Promise<EnhancedPage> {
  const canvas = await dataUrlToCanvas(dataUrl, 2000);
  try {
    const cv = await loadOpenCv();
    const src = cv.imread(canvas);
    let working = src;
    let gray = new cv.Mat();
    let output = new cv.Mat();
    try {
      cv.cvtColor(working, gray, cv.COLOR_RGBA2GRAY);

      const deskewed = deskew(cv, gray);
      gray.delete();
      gray = deskewed;

      const corrected = correctPerspective(cv, gray);
      gray.delete();
      gray = corrected;

      const clahe = new cv.CLAHE(2.2, new cv.Size(8, 8));
      clahe.apply(gray, gray);
      clahe.delete();

      const blurred = new cv.Mat();
      cv.medianBlur(gray, blurred, 3);
      cv.cvtColor(blurred, output, cv.COLOR_GRAY2RGBA);
      blurred.delete();

      const resultCanvas = document.createElement('canvas');
      resultCanvas.width = output.cols;
      resultCanvas.height = output.rows;
      cv.imshow(resultCanvas, output);
      return {
        enhancedDataUrl: canvasToDataUrl(resultCanvas, 0.94),
        usedFallback: false,
        width: resultCanvas.width,
        height: resultCanvas.height,
      };
    } finally {
      src.delete();
      if (gray && !gray.isDeleted()) gray.delete();
      if (output && !output.isDeleted()) output.delete();
    }
  } catch (error) {
    console.warn('OpenCV no disponible, se usa mejora básica de contraste.', error);
    const output = fallbackEnhance(canvas);
    return {
      enhancedDataUrl: canvasToDataUrl(output, 0.92),
      usedFallback: true,
      width: output.width,
      height: output.height,
    };
  }
}

function deskew(cv: Cv, gray: any): any {
  const edges = new cv.Mat();
  const lines = new cv.Mat();
  const result = gray.clone();
  try {
    cv.Canny(gray, edges, 50, 150, 3, false);
    cv.HoughLinesP(edges, lines, 1, Math.PI / 180, 80, gray.cols * 0.3, 12);
    const angles: number[] = [];
    for (let index = 0; index < lines.rows; index++) {
      const x1 = lines.data32S[index * 4];
      const y1 = lines.data32S[index * 4 + 1];
      const x2 = lines.data32S[index * 4 + 2];
      const y2 = lines.data32S[index * 4 + 3];
      const angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
      if (Math.abs(angle) <= 12) angles.push(angle);
    }
    if (angles.length < 4) return result;
    angles.sort((a, b) => a - b);
    const median = angles[Math.floor(angles.length / 2)];
    if (Math.abs(median) < 0.35 || Math.abs(median) > 12) return result;
    const center = new cv.Point(gray.cols / 2, gray.rows / 2);
    const matrix = cv.getRotationMatrix2D(center, median, 1);
    const rotated = new cv.Mat();
    cv.warpAffine(
      gray,
      rotated,
      matrix,
      new cv.Size(gray.cols, gray.rows),
      cv.INTER_CUBIC,
      cv.BORDER_CONSTANT,
      new cv.Scalar(255, 255, 255, 255)
    );
    matrix.delete();
    result.delete();
    return rotated;
  } finally {
    edges.delete();
    lines.delete();
  }
}

function orderPoints(points: number[][]): number[][] {
  const sortedBySum = [...points].sort((a, b) => a[0] + a[1] - (b[0] + b[1]));
  const topLeft = sortedBySum[0];
  const bottomRight = sortedBySum[sortedBySum.length - 1];
  const sortedByDiff = [...points].sort((a, b) => a[1] - a[0] - (b[1] - b[0]));
  const topRight = sortedByDiff[0];
  const bottomLeft = sortedByDiff[sortedByDiff.length - 1];
  return [topLeft, topRight, bottomRight, bottomLeft];
}

function correctPerspective(cv: Cv, gray: any): any {
  const blurred = new cv.Mat();
  const edges = new cv.Mat();
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  try {
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0, 0, cv.BORDER_DEFAULT);
    cv.Canny(blurred, edges, 60, 180, 3, false);
    cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
    let best: number[][] | null = null;
    let bestArea = 0;
    const imageArea = gray.cols * gray.rows;
    for (let index = 0; index < contours.size(); index++) {
      const contour = contours.get(index);
      const perimeter = cv.arcLength(contour, true);
      const approx = new cv.Mat();
      try {
        cv.approxPolyDP(contour, approx, 0.02 * perimeter, true);
        if (approx.rows === 4) {
          const area = Math.abs(cv.contourArea(approx));
          if (area > bestArea && area > imageArea * 0.35) {
            bestArea = area;
            const points: number[][] = [];
            for (let pointIndex = 0; pointIndex < 4; pointIndex++) {
              points.push([approx.data32S[pointIndex * 2], approx.data32S[pointIndex * 2 + 1]]);
            }
            best = points;
          }
        }
      } finally {
        approx.delete();
        contour.delete();
      }
    }
    if (!best) return gray.clone();
    const [topLeft, topRight, bottomRight, bottomLeft] = orderPoints(best);
    const widthTop = Math.hypot(topRight[0] - topLeft[0], topRight[1] - topLeft[1]);
    const widthBottom = Math.hypot(bottomRight[0] - bottomLeft[0], bottomRight[1] - bottomLeft[1]);
    const heightLeft = Math.hypot(bottomLeft[0] - topLeft[0], bottomLeft[1] - topLeft[1]);
    const heightRight = Math.hypot(bottomRight[0] - topRight[0], bottomRight[1] - topRight[1]);
    const width = Math.max(widthTop, widthBottom);
    const height = Math.max(heightLeft, heightRight);
    if (width < gray.cols * 0.5 || height < gray.rows * 0.5) return gray.clone();
    const source = cv.matFromArray(4, 1, cv.CV_32FC2, [
      topLeft[0], topLeft[1],
      topRight[0], topRight[1],
      bottomRight[0], bottomRight[1],
      bottomLeft[0], bottomLeft[1],
    ]);
    const destination = cv.matFromArray(4, 1, cv.CV_32FC2, [
      0, 0,
      width - 1, 0,
      width - 1, height - 1,
      0, height - 1,
    ]);
    const matrix = cv.getPerspectiveTransform(source, destination);
    const warped = new cv.Mat();
    cv.warpPerspective(
      gray,
      warped,
      matrix,
      new cv.Size(Math.round(width), Math.round(height)),
      cv.INTER_CUBIC,
      cv.BORDER_CONSTANT,
      new cv.Scalar(255)
    );
    source.delete();
    destination.delete();
    matrix.delete();
    return warped;
  } finally {
    blurred.delete();
    edges.delete();
    contours.delete();
    hierarchy.delete();
  }
}

export interface RowBand {
  y: number;
  height: number;
}

export interface LayoutAnalysis {
  width: number;
  height: number;
  rowBands: RowBand[];
  horizontalLines: number[];
  verticalLines: number[];
  usedGrid: boolean;
  usedFallback: boolean;
}

export async function analyzeLayout(dataUrl: string): Promise<LayoutAnalysis> {
  const canvas = await dataUrlToCanvas(dataUrl, 1800);
  try {
    const cv = await loadOpenCv();
    const src = cv.imread(canvas);
    const gray = new cv.Mat();
    const binary = new cv.Mat();
    const horizontal = new cv.Mat();
    const vertical = new cv.Mat();
    const lines = new cv.Mat();
    try {
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
      cv.adaptiveThreshold(
        gray,
        binary,
        255,
        cv.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv.THRESH_BINARY_INV,
        31,
        15
      );

      const horizontalKernel = cv.getStructuringElement(
        cv.MORPH_RECT,
        new cv.Size(Math.max(20, Math.round(gray.cols / 25)), 1)
      );
      const verticalKernel = cv.getStructuringElement(
        cv.MORPH_RECT,
        new cv.Size(1, Math.max(20, Math.round(gray.rows / 25)))
      );

      cv.morphologyEx(binary, horizontal, cv.MORPH_OPEN, horizontalKernel);
      cv.morphologyEx(binary, vertical, cv.MORPH_OPEN, verticalKernel);
      horizontalKernel.delete();
      verticalKernel.delete();

      const horizontalLines = clusterPositions(
        collectLinePositions(cv, horizontal, 'horizontal', gray.cols, gray.rows),
        8
      );
      const verticalLines = clusterPositions(
        collectLinePositions(cv, vertical, 'vertical', gray.cols, gray.rows),
        12
      );

      const table = new cv.Mat();
      cv.add(horizontal, vertical, table);
      cv.subtract(binary, table, lines);
      table.delete();

      let rowBands: RowBand[] = [];
      if (horizontalLines.length >= 3) {
        rowBands = bandsFromLines(horizontalLines, gray.rows);
      }
      if (rowBands.length < 3) {
        rowBands = bandsFromProjection(cv, lines, gray.rows);
      }
      rowBands = rowBands.filter((band) => band.height >= 10 && band.height <= Math.max(90, gray.rows * 0.12));

      return {
        width: gray.cols,
        height: gray.rows,
        rowBands,
        horizontalLines,
        verticalLines,
        usedGrid: horizontalLines.length >= 3 && rowBands.length >= 3,
        usedFallback: rowBands.length < 3,
      };
    } finally {
      src.delete();
      gray.delete();
      binary.delete();
      horizontal.delete();
      vertical.delete();
      lines.delete();
    }
  } catch (error) {
    console.warn('No se pudo analizar la tabla con OpenCV.', error);
    return {
      width: canvas.width,
      height: canvas.height,
      rowBands: [],
      horizontalLines: [],
      verticalLines: [],
      usedGrid: false,
      usedFallback: true,
    };
  }
}

function collectLinePositions(
  cv: Cv,
  mask: any,
  orientation: 'horizontal' | 'vertical',
  width: number,
  height: number
): number[] {
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  const positions: number[] = [];
  try {
    cv.findContours(mask, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
    for (let index = 0; index < contours.size(); index++) {
      const contour = contours.get(index);
      const rect = cv.boundingRect(contour);
      contour.delete();
      if (orientation === 'horizontal') {
        if (rect.width >= width * 0.25 && rect.height <= Math.max(12, height * 0.02)) {
          positions.push(rect.y + rect.height / 2);
        }
      } else if (rect.height >= height * 0.2 && rect.width <= Math.max(16, width * 0.03)) {
        positions.push(rect.x + rect.width / 2);
      }
    }
  } finally {
    contours.delete();
    hierarchy.delete();
  }
  return positions;
}

function clusterPositions(values: number[], tolerance: number): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  const clusters: number[][] = [];
  sorted.forEach((value) => {
    const last = clusters[clusters.length - 1];
    if (!last || value - last[last.length - 1] > tolerance) {
      clusters.push([value]);
    } else {
      last.push(value);
    }
  });
  return clusters.map((cluster) => cluster.reduce((sum, value) => sum + value, 0) / cluster.length);
}

function bandsFromLines(lines: number[], height: number): RowBand[] {
  const bands: RowBand[] = [];
  for (let index = 1; index < lines.length; index++) {
    const top = lines[index - 1];
    const bottom = lines[index];
    const bandHeight = bottom - top;
    if (bandHeight < 10 || bandHeight > Math.max(90, height * 0.12)) continue;
    bands.push({ y: Math.round(top), height: Math.round(bandHeight) });
  }
  return bands;
}

function bandsFromProjection(cv: Cv, clean: any, height: number): RowBand[] {
  const projection = new Array<number>(height).fill(0);
  const data: Uint8Array = clean.data;
  const width: number = clean.cols;
  for (let y = 0; y < height; y++) {
    let count = 0;
    const rowOffset = y * width;
    for (let x = 0; x < width; x++) {
      if (data[rowOffset + x] > 0) count++;
    }
    projection[y] = count;
  }
  const max = Math.max(...projection);
  if (max <= 0) return [];
  const threshold = Math.max(4, max * 0.08);
  const bands: RowBand[] = [];
  let start = -1;
  let gap = 0;
  for (let y = 0; y < height; y++) {
    const active = projection[y] >= threshold;
    if (active) {
      if (start === -1) start = y;
      gap = 0;
    } else if (start !== -1) {
      gap++;
      if (gap >= 3) {
        const end = y - gap;
        if (end - start >= 8) bands.push({ y: start, height: end - start + 1 });
        start = -1;
        gap = 0;
      }
    }
  }
  if (start !== -1 && height - start >= 8) bands.push({ y: start, height: height - start });
  return bands;
}
