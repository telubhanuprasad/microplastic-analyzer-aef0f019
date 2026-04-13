import * as ort from "onnxruntime-web";

export interface Detection {
  id: number;
  classId: number;
  className: string;
  confidence: number;
  x: number;
  y: number;
  width: number;
  height: number;
  sizeMm: number;
}

// Common microplastic polymer types — adjust to match your model's class labels
const CLASS_NAMES = [
  "PE (Polyethylene)",
  "PP (Polypropylene)",
  "PS (Polystyrene)",
  "PET (Polyethylene Terephthalate)",
  "PVC (Polyvinyl Chloride)",
  "PA (Polyamide/Nylon)",
  "PMMA (Acrylic)",
  "Other Polymer",
];

const MODEL_INPUT_SIZE = 640;
const CONFIDENCE_THRESHOLD = 0.25;
const IOU_THRESHOLD = 0.45;
const ORT_WEB_VERSION = "1.24.3";

let session: ort.InferenceSession | null = null;

export async function loadModel(modelPath = "/best.onnx"): Promise<void> {
  const resp = await fetch(modelPath, { cache: "no-store" });
  if (!resp.ok) {
    throw new Error(`Failed to fetch model: HTTP ${resp.status} — ensure best.onnx is in the public/ folder`);
  }

  const buffer = await resp.arrayBuffer();

  if (buffer.byteLength < 1000) {
    const text = new TextDecoder().decode(buffer.slice(0, 200));
    if (text.includes("git-lfs") || text.includes("<!DOCTYPE") || text.includes("<html")) {
      throw new Error("Got a Git LFS pointer or HTML page instead of the model binary. Please place the actual .onnx file in public/");
    }
  }

  ort.env.wasm.wasmPaths = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_WEB_VERSION}/dist/`;
  session = await ort.InferenceSession.create(buffer, {
    executionProviders: ["wasm"],
  });
}

export function isModelLoaded(): boolean {
  return session !== null;
}

function preprocessImage(
  canvas: HTMLCanvasElement,
  imgElement: HTMLImageElement
): { tensor: ort.Tensor; xRatio: number; yRatio: number } {
  const ctx = canvas.getContext("2d")!;
  canvas.width = MODEL_INPUT_SIZE;
  canvas.height = MODEL_INPUT_SIZE;

  const imgW = imgElement.naturalWidth;
  const imgH = imgElement.naturalHeight;

  // letterbox
  const scale = Math.min(MODEL_INPUT_SIZE / imgW, MODEL_INPUT_SIZE / imgH);
  const newW = Math.round(imgW * scale);
  const newH = Math.round(imgH * scale);
  const offsetX = (MODEL_INPUT_SIZE - newW) / 2;
  const offsetY = (MODEL_INPUT_SIZE - newH) / 2;

  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);
  ctx.drawImage(imgElement, offsetX, offsetY, newW, newH);

  const imageData = ctx.getImageData(0, 0, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);
  const pixels = imageData.data;

  const red = new Float32Array(MODEL_INPUT_SIZE * MODEL_INPUT_SIZE);
  const green = new Float32Array(MODEL_INPUT_SIZE * MODEL_INPUT_SIZE);
  const blue = new Float32Array(MODEL_INPUT_SIZE * MODEL_INPUT_SIZE);

  for (let i = 0; i < MODEL_INPUT_SIZE * MODEL_INPUT_SIZE; i++) {
    red[i] = pixels[i * 4] / 255.0;
    green[i] = pixels[i * 4 + 1] / 255.0;
    blue[i] = pixels[i * 4 + 2] / 255.0;
  }

  const inputData = new Float32Array(3 * MODEL_INPUT_SIZE * MODEL_INPUT_SIZE);
  inputData.set(red, 0);
  inputData.set(green, MODEL_INPUT_SIZE * MODEL_INPUT_SIZE);
  inputData.set(blue, 2 * MODEL_INPUT_SIZE * MODEL_INPUT_SIZE);

  const tensor = new ort.Tensor("float32", inputData, [1, 3, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE]);

  return {
    tensor,
    xRatio: imgW / newW,
    yRatio: imgH / newH,
  };
}

function iou(a: Detection, b: Detection): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const union = a.width * a.height + b.width * b.height - inter;
  return inter / union;
}

function nms(detections: Detection[]): Detection[] {
  detections.sort((a, b) => b.confidence - a.confidence);
  const keep: Detection[] = [];
  const suppressed = new Set<number>();
  for (let i = 0; i < detections.length; i++) {
    if (suppressed.has(i)) continue;
    keep.push(detections[i]);
    for (let j = i + 1; j < detections.length; j++) {
      if (!suppressed.has(j) && iou(detections[i], detections[j]) > IOU_THRESHOLD) {
        suppressed.add(j);
      }
    }
  }
  return keep;
}

export async function runInference(
  imgElement: HTMLImageElement,
  processingCanvas: HTMLCanvasElement
): Promise<Detection[]> {
  if (!session) throw new Error("Model not loaded");

  const { tensor, xRatio, yRatio } = preprocessImage(processingCanvas, imgElement);

  const inputName = session.inputNames[0];
  const results = await session.run({ [inputName]: tensor });
  const output = results[session.outputNames[0]];
  const data = output.data as Float32Array;

  // YOLOv8 output shape: [1, numClasses+4, numBoxes]
  // Rows 0-3: cx, cy, w, h; Rows 4+: class scores
  const dims = output.dims;
  const numAttributes = dims[1] as number; // 4 + numClasses
  const numBoxes = dims[2] as number;
  const numClasses = numAttributes - 4;

  const imgW = imgElement.naturalWidth;
  const imgH = imgElement.naturalHeight;
  const scale = Math.min(MODEL_INPUT_SIZE / imgW, MODEL_INPUT_SIZE / imgH);
  const offsetX = (MODEL_INPUT_SIZE - Math.round(imgW * scale)) / 2;
  const offsetY = (MODEL_INPUT_SIZE - Math.round(imgH * scale)) / 2;

  const detections: Detection[] = [];
  let idCounter = 0;

  for (let i = 0; i < numBoxes; i++) {
    const cx = data[0 * numBoxes + i];
    const cy = data[1 * numBoxes + i];
    const w = data[2 * numBoxes + i];
    const h = data[3 * numBoxes + i];

    let maxScore = 0;
    let maxClass = 0;
    for (let c = 0; c < numClasses; c++) {
      const score = data[(4 + c) * numBoxes + i];
      if (score > maxScore) {
        maxScore = score;
        maxClass = c;
      }
    }

    if (maxScore < CONFIDENCE_THRESHOLD) continue;

    // Convert from letterboxed coords to original image coords
    const x1 = ((cx - w / 2) - offsetX) * xRatio;
    const y1 = ((cy - h / 2) - offsetY) * yRatio;
    const bw = w * xRatio;
    const bh = h * yRatio;

    // Estimate size in mm (rough: assume 1px ≈ 0.01mm for microscope images)
    const sizeMm = Math.round(Math.max(bw, bh) * 0.01 * 100) / 100;

    detections.push({
      id: idCounter++,
      classId: maxClass,
      className: CLASS_NAMES[maxClass] || `Class ${maxClass}`,
      confidence: Math.round(maxScore * 10000) / 100,
      x: x1,
      y: y1,
      width: bw,
      height: bh,
      sizeMm,
    });
  }

  return nms(detections);
}
