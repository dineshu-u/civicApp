// ============================================
// AI CLASSIFIER — MobileNet + RLHF
// ============================================
// Dual-model approach:
//   1. MobileNet (TF.js) — ImageNet 1000-class predictions mapped to grievance categories
//   2. RLHF feedback loop — user corrections stored in LocalForage adjust predictions over time

import localforage from 'localforage';
import { ComplaintCategory } from '../types';

export interface AIClassification {
  category: ComplaintCategory;
  confidence: number;
  severity: number;
  processingTime: number;
  allPredictions: { category: ComplaintCategory; confidence: number }[];
  reasoning: string;
  modelUsed: 'mobilenet' | 'pixel_fallback';
  imageHash?: string;
}

// ── ImageNet label → grievance category mapping ──────────────────────────────
const IMAGENET_TO_CATEGORY: Array<{ keywords: string[]; category: ComplaintCategory }> = [
  { keywords: ['car', 'vehicle', 'automobile', 'jeep', 'minivan', 'truck', 'van', 'cab', 'taxi', 'bus'], category: 'illegal_parking' },
  { keywords: ['garbage', 'trash', 'waste', 'refuse', 'landfill', 'dustbin', 'litter', 'compost', 'recycling'], category: 'garbage' },
  { keywords: ['manhole', 'gutter', 'sewer', 'drainage', 'pipe', 'culvert', 'canal', 'ditch'], category: 'drainage' },
  { keywords: ['pothole', 'asphalt', 'road', 'pavement', 'tarmac', 'highway', 'street'], category: 'pothole' },
  { keywords: ['street lamp', 'lamppost', 'pole', 'lantern', 'beacon'], category: 'streetlight' },
  { keywords: ['water', 'leak', 'puddle', 'flood', 'faucet', 'fountain', 'hydrant'], category: 'water_leak' },
  { keywords: ['crack', 'break', 'construction', 'barrier', 'concrete', 'cement', 'rubble', 'debris'], category: 'road_damage' },
  { keywords: ['tree', 'log', 'branch', 'trunk', 'fallen', 'wood', 'stump'], category: 'tree_fall' },
  { keywords: ['stall', 'booth', 'tent', 'shed', 'shack', 'hut', 'kiosk', 'encroach'], category: 'encroachment' },
  { keywords: ['smoke', 'smog', 'fog', 'haze', 'chimney', 'exhaust', 'emission', 'fume'], category: 'air_pollution' },
  { keywords: ['dog', 'cat', 'cattle', 'cow', 'goat', 'pig', 'animal', 'stray'], category: 'stray_animals' },
];

const ALL_CATEGORIES: ComplaintCategory[] = [
  'pothole', 'garbage', 'streetlight', 'drainage', 'road_damage', 'water_leak',
  'illegal_parking', 'tree_fall', 'encroachment', 'noise_pollution', 'air_pollution',
  'stray_animals', 'other',
];

const mapImageNetToCategory = (
  predictions: Array<{ className: string; probability: number }>
): { category: ComplaintCategory; confidence: number }[] => {
  const scores: Partial<Record<ComplaintCategory, number>> = {};
  for (const pred of predictions) {
    const label = pred.className.toLowerCase();
    let matched = false;
    for (const mapping of IMAGENET_TO_CATEGORY) {
      if (mapping.keywords.some((kw) => label.includes(kw))) {
        scores[mapping.category] = (scores[mapping.category] ?? 0) + pred.probability;
        matched = true;
        break;
      }
    }
    if (!matched) scores['other'] = (scores['other'] ?? 0) + pred.probability * 0.1;
  }
  const total = Object.values(scores).reduce((a, b) => a + (b ?? 0), 0) || 1;
  return ALL_CATEGORIES
    .map((cat) => ({ category: cat, confidence: (scores[cat] ?? 0.01) / total }))
    .sort((a, b) => b.confidence - a.confidence);
};

// ── RLHF storage ──────────────────────────────────────────────────────────────
interface RlhfEntry { predictedCategory: ComplaintCategory; correctedCategory: ComplaintCategory; count: number; }
const RLHF_KEY = 'rlhf_corrections';

const getRlhfData = async (): Promise<Record<string, RlhfEntry[]>> =>
  (await localforage.getItem<Record<string, RlhfEntry[]>>(RLHF_KEY)) ?? {};

const getGlobalCorrectionMap = async (): Promise<Map<ComplaintCategory, Map<ComplaintCategory, number>>> => {
  const data = await getRlhfData();
  const map = new Map<ComplaintCategory, Map<ComplaintCategory, number>>();
  for (const entries of Object.values(data)) {
    for (const e of entries) {
      if (!map.has(e.predictedCategory)) map.set(e.predictedCategory, new Map());
      const inner = map.get(e.predictedCategory)!;
      inner.set(e.correctedCategory, (inner.get(e.correctedCategory) ?? 0) + e.count);
    }
  }
  return map;
};

const applyRlhf = async (
  predictions: { category: ComplaintCategory; confidence: number }[]
): Promise<{ category: ComplaintCategory; confidence: number }[]> => {
  const correctionMap = await getGlobalCorrectionMap();
  if (correctionMap.size === 0) return predictions;

  const adjusted = predictions.map(({ category, confidence }) => {
    const corrections = correctionMap.get(category);
    if (!corrections || corrections.size === 0) return { category, confidence };
    const totalCor = [...corrections.values()].reduce((a, b) => a + b, 0);
    const correctionRate = totalCor / (totalCor + 10);
    return { category, confidence: confidence * (1 - correctionRate * 0.5) };
  });

  for (const [predictedCat, corrections] of correctionMap.entries()) {
    const predictedPred = predictions.find((p) => p.category === predictedCat);
    if (!predictedPred) continue;
    const totalCor = [...corrections.values()].reduce((a, b) => a + b, 0);
    for (const [correctedCat, count] of corrections.entries()) {
      const boost = (count / (totalCor + 10)) * predictedPred.confidence * 0.4;
      const existing = adjusted.find((p) => p.category === correctedCat);
      if (existing) existing.confidence += boost;
    }
  }

  const total = adjusted.reduce((a, p) => a + p.confidence, 0) || 1;
  return adjusted
    .map((p) => ({ ...p, confidence: p.confidence / total }))
    .sort((a, b) => b.confidence - a.confidence);
};

// ── Image hash ────────────────────────────────────────────────────────────────
const hashBlob = async (blob: Blob): Promise<string> => {
  try {
    const buf = await blob.arrayBuffer();
    const hash = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
  } catch { return `blob_${blob.size}_${Date.now()}`; }
};

// ── Pixel fallback ────────────────────────────────────────────────────────────
const pixelFallback = (imageData: ImageData): { category: ComplaintCategory; confidence: number }[] => {
  const data = imageData.data;
  const totalPixels = data.length / 4;
  let dark = 0, bright = 0, brown = 0, gray = 0, green = 0, blue = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const lum = (r + g + b) / 3;
    if (lum < 50) dark++;
    if (lum > 200) bright++;
    if (r > 80 && r < 180 && g > 60 && g < 140 && b > 40 && b < 100) brown++;
    if (Math.abs(r - g) < 20 && Math.abs(g - b) < 20 && lum > 80 && lum < 200) gray++;
    if (g > r + 20 && g > b + 20) green++;
    if (b > r + 20 && b > g + 20) blue++;
  }
  const darkR = dark / totalPixels, brightR = bright / totalPixels;
  const brownR = brown / totalPixels, grayR = gray / totalPixels;
  const greenR = green / totalPixels, blueR = blue / totalPixels;
  const scores: Partial<Record<ComplaintCategory, number>> = {
    pothole: 0.05 + (brownR > 0.3 && grayR > 0.2 ? 0.5 : 0),
    road_damage: 0.05 + (grayR > 0.4 && brownR > 0.15 ? 0.4 : 0),
    garbage: 0.05 + (greenR > 0.15 || (brownR > 0.2 && brightR > 0.1) ? 0.4 : 0),
    streetlight: 0.05 + (darkR > 0.5 && brightR > 0.05 && brightR < 0.3 ? 0.5 : 0),
    drainage: 0.05 + (blueR > 0.2 || (blueR > 0.1 && grayR > 0.3) ? 0.35 : 0),
    water_leak: 0.05 + (blueR > 0.2 ? 0.45 : 0),
    other: 0.05,
  };
  const total = Object.values(scores).reduce((a, b) => a + (b ?? 0), 0) || 1;
  return ALL_CATEGORIES.map((cat) => ({ category: cat, confidence: (scores[cat] ?? 0.02) / total }))
    .sort((a, b) => b.confidence - a.confidence);
};

// ── MobileNet lazy loader ─────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mobilenetModel: any = null;
let mobilenetLoading = false;
let mobilenetFailed = false;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const loadMobileNet = async (): Promise<any | null> => {
  if (mobilenetModel) return mobilenetModel;
  if (mobilenetFailed) return null;
  if (mobilenetLoading) {
    for (let i = 0; i < 150; i++) {
      await new Promise((r) => setTimeout(r, 100));
      if (mobilenetModel) return mobilenetModel;
      if (mobilenetFailed) return null;
    }
    return null;
  }
  mobilenetLoading = true;
  try {
    const [tf, mobilenet] = await Promise.all([import('@tensorflow/tfjs'), import('@tensorflow-models/mobilenet')]);
    await tf.ready();
    mobilenetModel = await mobilenet.load({ version: 2, alpha: 0.5 });
    console.log('[AIClassifier] MobileNet v2 loaded ✓');
    return mobilenetModel;
  } catch (err) {
    console.warn('[AIClassifier] MobileNet failed, using pixel fallback:', err);
    mobilenetFailed = true;
    return null;
  } finally {
    mobilenetLoading = false;
  }
};

// ── Reasoning map ─────────────────────────────────────────────────────────────
const REASONING_MAP: Record<ComplaintCategory, string[]> = {
  pothole: ['Road surface depression detected', 'Asphalt damage identified', 'Crater-like irregularity found'],
  garbage: ['Waste accumulation detected', 'Mixed debris patterns found', 'Refuse pile identified'],
  streetlight: ['Night environment with isolated light source', 'Lamppost structure detected', 'Lighting infrastructure issue'],
  drainage: ['Water channel patterns detected', 'Drainage structure visible', 'Blocked drain indicators'],
  road_damage: ['Surface cracking detected', 'Road deterioration identified', 'Structural road damage'],
  water_leak: ['Water accumulation detected', 'Moisture spread identified', 'Pipe leakage pattern'],
  illegal_parking: ['Vehicle in prohibited zone', 'Parked in restricted area', 'Unauthorized parking detected'],
  tree_fall: ['Fallen tree or branch detected', 'Downed vegetation on road', 'Tree obstruction identified'],
  encroachment: ['Unauthorized structure detected', 'Public space obstruction', 'Illegal occupation pattern'],
  noise_pollution: ['Noise source visible', 'Noise-generating equipment detected', 'Crowd or event detected'],
  air_pollution: ['Smoke or haze detected', 'Emission source identified', 'Air quality concern detected'],
  stray_animals: ['Animal on road/public space', 'Stray animal identified', 'Animal hazard detected'],
  other: ['Issue does not match known categories', 'Manual review recommended', 'General infrastructure concern'],
};

// ── Exported classifier ───────────────────────────────────────────────────────
export const AIClassifier = {
  submitFeedback: async (imageHash: string, predictedCategory: ComplaintCategory, correctedCategory: ComplaintCategory): Promise<void> => {
    if (predictedCategory === correctedCategory) return;
    const data = await getRlhfData();
    const entries = data[imageHash] ?? [];
    const existing = entries.find((e) => e.predictedCategory === predictedCategory && e.correctedCategory === correctedCategory);
    if (existing) existing.count += 1;
    else entries.push({ predictedCategory, correctedCategory, count: 1 });
    data[imageHash] = entries;
    await localforage.setItem(RLHF_KEY, data);
    console.log(`[RLHF] Correction stored: ${predictedCategory} → ${correctedCategory}`);
  },

  classify: async (imageBlob: Blob): Promise<AIClassification> => {
    const startTime = performance.now();
    const imageHash = await hashBlob(imageBlob);
    const imageUrl = URL.createObjectURL(imageBlob);
    const img = new Image();

    return new Promise((resolve) => {
      img.onload = async () => {
        try {
          let rawPredictions: { category: ComplaintCategory; confidence: number }[] = [];
          let modelUsed: 'mobilenet' | 'pixel_fallback' = 'mobilenet';

          const model = await loadMobileNet();
          if (model) {
            try {
              const mnPreds: Array<{ className: string; probability: number }> = await model.classify(img, 10);
              rawPredictions = mapImageNetToCategory(mnPreds);
            } catch (err) {
              console.warn('[AIClassifier] classify error, falling back to pixel:', err);
              modelUsed = 'pixel_fallback';
            }
          }

          if (!model || modelUsed === 'pixel_fallback') {
            modelUsed = 'pixel_fallback';
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d')!;
            canvas.width = img.width; canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            rawPredictions = pixelFallback(ctx.getImageData(0, 0, canvas.width, canvas.height));
          }

          const adjustedPredictions = await applyRlhf(rawPredictions);
          const top = adjustedPredictions[0];
          const severity = AIClassifier.estimateSeverity(top.category, top.confidence);
          const reasoning = REASONING_MAP[top.category][Math.floor(Math.random() * 3)];

          URL.revokeObjectURL(imageUrl);
          resolve({ category: top.category, confidence: Math.min(0.98, top.confidence), severity, processingTime: performance.now() - startTime, allPredictions: adjustedPredictions, reasoning, modelUsed, imageHash });
        } catch (err) {
          console.error('[AIClassifier] Fatal error:', err);
          URL.revokeObjectURL(imageUrl);
          resolve({ category: 'other', confidence: 0.5, severity: 3, processingTime: performance.now() - startTime, allPredictions: [{ category: 'other', confidence: 1 }], reasoning: 'Classification failed', modelUsed: 'pixel_fallback', imageHash });
        }
      };
      img.onerror = () => { URL.revokeObjectURL(imageUrl); resolve({ category: 'other', confidence: 0.5, severity: 3, processingTime: performance.now() - startTime, allPredictions: [{ category: 'other', confidence: 1 }], reasoning: 'Image load failed', modelUsed: 'pixel_fallback', imageHash }); };
      img.src = imageUrl;
    });
  },

  estimateSeverity: (category: ComplaintCategory, confidence: number): number => {
    const base: Partial<Record<ComplaintCategory, number>> = {
      pothole: 4, road_damage: 4, water_leak: 4, drainage: 5, tree_fall: 5,
      streetlight: 3, garbage: 3, illegal_parking: 3, encroachment: 3,
      noise_pollution: 2, air_pollution: 3, stray_animals: 3, other: 2,
    };
    const b = base[category] ?? 3;
    const boost = confidence > 0.8 ? 1 : 0;
    return Math.min(5, Math.max(1, b + (Math.random() > 0.7 ? boost : 0)));
  },
};

export type { AIClassification as AIClassificationResult };
