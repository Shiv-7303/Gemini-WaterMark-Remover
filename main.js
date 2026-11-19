// ── Direct Link Configuration (Monetag) ──
const MONETAG_DIRECT_LINK = 'https://omg10.com/4/11542046';
const MONETAG_EXPORT_DIRECT_LINK = 'https://omg10.com/4/11584190';

// Auto-Detect Click Ad (Direct link moved from download button)
function handleAutoDetectAd() {
  if (MONETAG_DIRECT_LINK) {
    try {
      window.open(MONETAG_DIRECT_LINK, '_blank');
    } catch (e) {
      console.error('Failed to open Monetag direct link on auto-detect:', e);
    }
  }
}
window.handleAutoDetectAd = handleAutoDetectAd;

// Download Ad (Used by Video download)
function handleDownloadAd() {
  if (MONETAG_DIRECT_LINK) {
    try {
      window.open(MONETAG_DIRECT_LINK, '_blank');
    } catch (e) {
      console.error('Failed to open Monetag direct link:', e);
    }
  }
}
window.handleDownloadAd = handleDownloadAd;

function handleExportAd() {
  // Open Monetag Export Direct Link
  if (MONETAG_EXPORT_DIRECT_LINK) {
    try {
      window.open(MONETAG_EXPORT_DIRECT_LINK, '_blank');
    } catch (e) {
      console.error('Failed to open Monetag export direct link:', e);
    }
  }
}
window.handleExportAd = handleExportAd;

// ── Monetag OnClick Popunder Tag Loader ──
let isMonetagLoaded = false;
function loadMonetagPopunder() {
  if (isMonetagLoaded) return;
  isMonetagLoaded = true;
  try {
    (function (s) {
      s.dataset.zone = '11558621';
      s.src = 'https://al5sm.com/tag.min.js';
    })([document.documentElement, document.body].filter(Boolean).pop().appendChild(document.createElement('script')));
  } catch (e) {
    console.error('Failed to load Monetag popunder script:', e);
  }
}
window.loadMonetagPopunder = loadMonetagPopunder;

// ── 1. Engine Core (alphaMap, blendModes, geometry, tuner) ──
function calculateAlphaMap(bgCaptureImageData) {
  const { width, height, data } = bgCaptureImageData;
  const alphaMap = new Float32Array(width * height);
  for (let i = 0; i < alphaMap.length; i++) {
    const idx = i * 4;
    alphaMap[i] = Math.max(data[idx], data[idx + 1], data[idx + 2]) / 255.0;
  }
  return alphaMap;
}

const ALPHA_THRESHOLD = 0.002;
const MAX_ALPHA = 0.99;
const LOGO_VALUE = 255;

function removeWatermark(imageData, alphaMap, position, options = {}) {
  const { x, y, width, height } = position;
  const gain = Number.isFinite(options.alphaGain) && options.alphaGain > 0
    ? options.alphaGain
    : 1;

  // Pure Mathematical Alpha Unblending:
  // Original = (Watermarked - alpha * 255) / (1 - alpha)
  // Zero inpainting, zero blur, 100% texture preservation.
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const imgIdx = ((y + row) * imageData.width + (x + col)) * 4;
      const alphaIdx = row * width + col;

      let alpha = alphaMap[alphaIdx] * gain;
      if (alpha < ALPHA_THRESHOLD) continue;
      alpha = Math.min(alpha, MAX_ALPHA);

      for (let c = 0; c < 3; c++) {
        const watermarked = imageData.data[imgIdx + c];
        const original = (watermarked - alpha * LOGO_VALUE) / (1.0 - alpha);
        imageData.data[imgIdx + c] = Math.max(0, Math.min(255, Math.round(original)));
      }
    }
  }
}

function getWatermarkInfo(width, height) {
  const minDim = Math.min(width, height);
  const ratio = minDim / 1536;
  const size = Math.max(16, Math.round(96 * ratio));
  const margin = Math.max(8, Math.round(64 * ratio));

  return {
    size,
    x: Math.max(0, width - margin - size),
    y: Math.max(0, height - margin - size),
    width: size,
    height: size,
  };
}

function getRoi(width, height, wm) {
  const pad = Math.round(wm.size * 0.6);
  const rx = Math.max(0, Math.min(width - 1, wm.x - pad));
  const ry = Math.max(0, Math.min(height - 1, wm.y - pad));
  const rw = Math.max(1, Math.min(width - rx, wm.width + pad * 2));
  const rh = Math.max(1, Math.min(height - ry, wm.height + pad * 2));
  return { x: rx, y: ry, width: rw, height: rh };
}

function resolveBox(base, width, height, opts = {}) {
  const sizeScale = opts.sizeScale || 1;
  const size = Math.max(8, Math.min(Math.round(base.size * sizeScale), Math.min(width, height)));
  const x = Math.max(0, Math.min(base.x + Math.round(opts.offsetX || 0), width - size));
  const y = Math.max(0, Math.min(base.y + Math.round(opts.offsetY || 0), height - size));
  return { size, x, y, width: size, height: size };
}

function buildAlpha(bgImg, roi, wm, gain) {
  const count = roi.width * roi.height;
  const alphaMap = new Float32Array(count);
  const offX = wm.x - roi.x;
  const offY = wm.y - roi.y;

  const c = document.createElement('canvas');
  c.width = wm.size; c.height = wm.size;
  const cx = c.getContext('2d', { willReadFrequently: true });
  cx.imageSmoothingEnabled = true;
  cx.imageSmoothingQuality = 'high';
  cx.drawImage(bgImg, 0, 0, wm.size, wm.size);
  const data = cx.getImageData(0, 0, wm.size, wm.size).data;

  for (let row = 0; row < wm.size; row++) {
    for (let col = 0; col < wm.size; col++) {
      const ri = (offY + row) * roi.width + (offX + col);
      if (ri < 0 || ri >= count) continue;
      const o = (row * wm.size + col) * 4;
      const a = (Math.max(data[o], data[o + 1], data[o + 2]) / 255) * gain;
      alphaMap[ri] = a > 0 ? Math.min(a, 0.99) : 0;
    }
  }
  return alphaMap;
}

function cleanFrame(bgImg, imageData, width, height, base, opts = {}) {
  const wm = resolveBox(base, width, height, opts);
  const roi = getRoi(width, height, wm);
  const alpha = buildAlpha(bgImg, roi, wm, opts.gain ?? 1);
  removeWatermark(imageData, alpha, {
    x: roi.x, y: roi.y, width: roi.width, height: roi.height,
  });
  return { wm, roi };
}

// Inline Base64 Reference Images (guarantees zero CORS/Tainted Canvas errors when double clicked)
const BG_48_BASE64 = "data:image/png;base64,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";
const BG_96_BASE64 = "data:image/png;base64,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";

// ── 2. WatermarkEngine Class ──
class WatermarkEngine {
  constructor(bg48, bg96) {
    this.bg48 = bg48;
    this.bg96 = bg96;
    this.alphaMaps = {};
  }

  static async create() {
    const loadImage = (src) => new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = (e) => reject(e);
      img.src = src;
    });

    try {
      const [bg48, bg96] = await Promise.all([
        loadImage(BG_48_BASE64),
        loadImage(BG_96_BASE64)
      ]);
      return new WatermarkEngine(bg48, bg96);
    } catch (e) {
      console.error("Failed to load watermark background assets.", e);
      throw e;
    }
  }

  getWatermarkInfo(width, height) {
    return getWatermarkInfo(width, height);
  }

  async getAlphaMap(size) {
    if (this.alphaMaps[size]) return this.alphaMaps[size];

    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(size <= 48 ? this.bg48 : this.bg96, 0, 0, size, size);

    const map = calculateAlphaMap(ctx.getImageData(0, 0, size, size));
    this.alphaMaps[size] = map;
    return map;
  }

  buildScaledAlphaMap(size) {
    if (this.alphaMaps[size]) return this.alphaMaps[size];

    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.clearRect(0, 0, size, size);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(this.bg96, 0, 0, size, size);

    const map = calculateAlphaMap(ctx.getImageData(0, 0, size, size));
    this.alphaMaps[size] = map;
    return map;
  }

  async process(imageFile) {
    const objectUrl = URL.createObjectURL(imageFile);
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = objectUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const config = this.getWatermarkInfo(canvas.width, canvas.height);

    const alphaMap = await this.getAlphaMap(config.size);
    removeWatermark(imageData, alphaMap, config);

    ctx.putImageData(imageData, 0, 0);

    return {
      blob: await new Promise(r => canvas.toBlob(r, 'image/png')),
      originalSrc: objectUrl,
      width: img.width,
      height: img.height
    };
  }

  async prepareForSize(width, height) {
    const config = this.getWatermarkInfo(width, height);
    const alphaMap = await this.getAlphaMap(config.size);
    return { config, alphaMap };
  }

  removeFromImageData(imageData, prepared) {
    const { config, alphaMap } = prepared || this._sync(imageData.width, imageData.height);
    removeWatermark(imageData, alphaMap, config);
    return imageData;
  }

  _sync(width, height) {
    const config = this.getWatermarkInfo(width, height);
    return { config, alphaMap: this.alphaMaps[config.size] };
  }
}

// ── 3. VideoWatermarkEngine Class ──
const VIDEO_DEFAULTS = { gain: 1.0, offsetX: -24, offsetY: -24, sizeScale: 1 };

class VideoWatermarkEngine {
  constructor(engine) {
    this.engine = engine;
    this._mb = null;
  }

  static async create() {
    const engine = await WatermarkEngine.create();
    return new VideoWatermarkEngine(engine);
  }

  static isSupported() {
    return (
      typeof VideoEncoder !== 'undefined' &&
      typeof VideoDecoder !== 'undefined'
    );
  }

  async _lib() {
    if (!this._mb) this._mb = await import('https://cdn.jsdelivr.net/npm/mediabunny@1.52.3/+esm');
    return this._mb;
  }

  get sparkleImage() {
    return this.engine.bg96;
  }

  getVeoWatermark(width, height) {
    const base = Math.min(width, height);
    const size = Math.max(24, Math.min(Math.round(base / 15), base));
    const margin = Math.round(base / 10);
    return {
      size,
      x: Math.max(0, width - margin - size),
      y: Math.max(0, height - margin - size),
      width: size,
      height: size,
    };
  }

  previewClean(fullImageData, width, height, opts = {}) {
    const base = this.getVeoWatermark(width, height);
    return cleanFrame(this.engine.bg96, fullImageData, width, height, base, {
      ...opts,
      gain: opts.gain ?? VIDEO_DEFAULTS.gain,
    });
  }

  async process(file, opts = {}) {
    const onProgress = opts.onProgress || (() => { });
    const gain = opts.gain ?? VIDEO_DEFAULTS.gain;

    const mb = await this._lib();
    const {
      ALL_FORMATS, BlobSource, BufferTarget, CanvasSource,
      EncodedAudioPacketSource, EncodedPacketSink, Input,
      Mp4OutputFormat, Output, QUALITY_HIGH, VideoSampleSink, canEncodeVideo,
    } = mb;

    if (canEncodeVideo && !(await canEncodeVideo('avc'))) {
      throw new Error(
        'Your browser cannot encode H.264 video locally. Please try Chrome or Edge desktop.'
      );
    }

    const originalUrl = URL.createObjectURL(file);
    const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });

    const videoTrack = await input.getPrimaryVideoTrack();
    if (!videoTrack) {
      input.dispose?.();
      URL.revokeObjectURL(originalUrl);
      throw new Error('No decodable video track found.');
    }

    const width = videoTrack.displayWidth ?? videoTrack.codedWidth;
    const height = videoTrack.displayHeight ?? videoTrack.codedHeight;
    const duration = await input.computeDuration().catch(() => 0);

    let frameRate = 30;
    try {
      const stats = await videoTrack.computePacketStats(120);
      if (stats?.averagePacketRate) frameRate = Math.round(stats.averagePacketRate);
    } catch { }

    const base = opts.mode === 'gemini' ? getWatermarkInfo(width, height) : this.getVeoWatermark(width, height);
    const wm = resolveBox(base, width, height, opts);
    const roi = getRoi(width, height, wm);
    const alpha = buildAlpha(this.engine.bg96, roi, wm, gain);
    const region = { x: 0, y: 0, width: roi.width, height: roi.height };

    const canvas = Object.assign(document.createElement('canvas'), { width, height });
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    const target = new BufferTarget();
    const output = new Output({ format: new Mp4OutputFormat(), target });
    const videoSource = new CanvasSource(canvas, {
      codec: 'avc',
      bitrate: QUALITY_HIGH,
      keyFrameInterval: 2,
      sizeChangeBehavior: 'passThrough',
    });
    output.addVideoTrack(videoSource, { frameRate });

    let audioSource = null;
    let audioTrack = null;
    let audioDecoderConfig = null;
    try {
      audioTrack = await input.getPrimaryAudioTrack();
      if (audioTrack) {
        const audioCodec = await audioTrack.getCodec();
        audioDecoderConfig = await audioTrack.getDecoderConfig().catch(() => null);
        if (audioCodec && audioDecoderConfig) {
          audioSource = new EncodedAudioPacketSource(audioCodec);
          output.addAudioTrack(audioSource);
        }
      }
    } catch {
      audioSource = null;
    }

    await output.start();

    const fallbackDur = frameRate > 0 ? 1 / frameRate : 1 / 30;
    const sink = new VideoSampleSink(videoTrack);
    let firstTimestamp = null;
    let lastTimestamp = -1;
    for await (const sample of sink.samples()) {
      if (firstTimestamp === null) firstTimestamp = sample.timestamp;
      let timestamp = sample.timestamp - firstTimestamp;
      if (!(timestamp >= 0)) timestamp = 0;
      if (timestamp <= lastTimestamp) timestamp = lastTimestamp + fallbackDur;
      const dur = Number.isFinite(sample.duration) && sample.duration > 0 ? sample.duration : fallbackDur;
      lastTimestamp = timestamp;

      sample.draw(ctx, 0, 0, width, height);
      sample.close();

      const px = ctx.getImageData(roi.x, roi.y, roi.width, roi.height);
      removeWatermark(px, alpha, region);

      // Force GPU texture sync for WebCodecs by using ImageBitmap
      const bmp = await createImageBitmap(px);
      ctx.drawImage(bmp, roi.x, roi.y);
      bmp.close();

      await videoSource.add(timestamp, dur);
      if (duration) onProgress({ progress: Math.min(0.99, timestamp / duration) });
    }
    videoSource.close();

    if (audioSource) {
      try {
        const offset = firstTimestamp ?? 0;
        const aSink = new EncodedPacketSink(audioTrack);
        let isFirstAudio = true;
        let lastAudioTs = -1;
        for await (const packet of aSink.packets()) {
          let newTs = packet.timestamp - offset;
          if (newTs < 0) continue;
          if (newTs <= lastAudioTs) newTs = lastAudioTs + 1e-6;
          lastAudioTs = newTs;
          let outPacket = packet;
          if (newTs !== packet.timestamp && typeof packet.clone === 'function') {
            outPacket = packet.clone({ timestamp: newTs });
          }
          await audioSource.add(
            outPacket,
            isFirstAudio && audioDecoderConfig ? { decoderConfig: audioDecoderConfig } : undefined
          );
          isFirstAudio = false;
        }
      } catch (e) {
        console.warn('Audio passthrough failed.', e);
      } finally {
        audioSource.close();
      }
    }

    await output.finalize();
    input.dispose?.();

    if (!target.buffer) {
      URL.revokeObjectURL(originalUrl);
      throw new Error('Video export produced no output.');
    }

    const blob = new Blob([target.buffer], { type: 'video/mp4' });
    onProgress({ progress: 1 });

    return {
      blob,
      url: URL.createObjectURL(blob),
      originalUrl,
      ext: 'mp4',
      mime: 'video/mp4',
      width,
      height,
    };
  }
}

// ── 4. App Controller & Event Handlers ──
// Global instances reused from lines 489-491
currentTab = 'image';

const IMG_PRESETS = {
  new: { gain: 0.6, offsetX: -128, offsetY: -128, sizeScale: 1 },
  classic: { gain: 1, offsetX: 0, offsetY: 0, sizeScale: 1 }
};

const VIDEO_PRESETS = {
  veo: { gain: 0.6, offsetX: -24, offsetY: -24, sizeScale: 1 },
  corner: { gain: 0.6, offsetX: 0, offsetY: 0, sizeScale: 1 },
  sparkle: { gain: 0.6, offsetX: 0, offsetY: 0, sizeScale: 1 }
};

function getAdaptiveImagePreset(presetKey, width = 1536, height = 1536) {
  if (presetKey === 'classic') {
    return { gain: 1.0, offsetX: 0, offsetY: 0, sizeScale: 1.0 };
  }
  const minDim = Math.min(width, height || width);
  const scaleRatio = Math.max(0.25, Math.min(1.5, minDim / 1536));
  const adaptiveOffset = Math.round(-128 * scaleRatio);
  return {
    gain: 0.6,
    offsetX: adaptiveOffset,
    offsetY: adaptiveOffset,
    sizeScale: 1.0
  };
}

function getAdaptiveVideoPreset(presetKey, width = 720, height = 720) {
  if (presetKey === 'corner') {
    return { gain: 0.6, offsetX: 0, offsetY: 0, sizeScale: 1.0 };
  }
  if (presetKey === 'sparkle') {
    const minDim = Math.min(width, height || width);
    const m = Math.max(16, Math.round(192 * (minDim / 1536)));
    const s = Math.max(24, Math.round(96 * (minDim / 1536)));
    const baseDim = Math.min(width, height);
    const veoBase = {
      size: Math.max(24, Math.min(Math.round(baseDim / 15), baseDim)),
      margin: Math.round(baseDim / 10),
    };
    const baseX = Math.max(0, width - veoBase.margin - veoBase.size);
    const baseY = Math.max(0, height - veoBase.margin - veoBase.size);
    return {
      gain: 0.6,
      offsetX: Math.max(0, width - m - s) - baseX,
      offsetY: Math.max(0, height - m - s) - baseY,
      sizeScale: 1.0
    };
  }
  const minDim = Math.min(width, height || width);
  const scaleRatio = Math.max(0.3, Math.min(1.5, minDim / 720));
  const adaptiveOffset = Math.round(-24 * scaleRatio);
  return {
    gain: 0.6,
    offsetX: adaptiveOffset,
    offsetY: adaptiveOffset,
    sizeScale: 1.0
  };
}

// ── Advanced Watermark Auto-Detection System (Fused Multi-Scale, Gradient & Dual-Polarity) ──

const alphaTemplateCache = new Map();

function getAlphaTemplateData(bgImg, size) {
  if (alphaTemplateCache.has(size)) {
    return alphaTemplateCache.get(size);
  }
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const cx = c.getContext('2d', { willReadFrequently: true });
  cx.imageSmoothingEnabled = true;
  cx.imageSmoothingQuality = 'high';
  cx.drawImage(bgImg, 0, 0, size, size);
  const raw = cx.getImageData(0, 0, size, size).data;

  const alphas = new Float32Array(size * size);
  for (let i = 0; i < alphas.length; i++) {
    const o = i * 4;
    alphas[i] = Math.max(raw[o], raw[o + 1], raw[o + 2]) / 255.0;
  }

  const gradMag = new Float32Array(size * size);
  for (let r = 1; r < size - 1; r++) {
    for (let col = 1; col < size - 1; col++) {
      const idx = r * size + col;
      const gx = alphas[idx + 1] - alphas[idx - 1];
      const gy = alphas[(r + 1) * size + col] - alphas[(r - 1) * size + col];
      gradMag[idx] = Math.sqrt(gx * gx + gy * gy);
    }
  }

  const template = { raw, alphas, gradMag, size };
  alphaTemplateCache.set(size, template);
  return template;
}

function evaluateCandidateMatch(imageData, width, height, bgImg, box) {
  const { x, y, size } = box;
  if (x < 0 || y < 0 || x + size > width || y + size > height || size <= 0) {
    return { score: -1, variance: 0 };
  }

  const template = getAlphaTemplateData(bgImg, size);
  const { alphas, gradMag } = template;

  let sumL = 0, sumA = 0;
  let sumL2 = 0, sumA2 = 0;
  let sumLA = 0;

  let sumInvL = 0;
  let sumInvL2 = 0;
  let sumInvLA = 0;

  let sumG = 0, sumGA = 0;
  let sumG2 = 0, sumGA2 = 0;
  let sumGGA = 0;

  let n = 0;
  let nGrad = 0;

  const step = size > 80 ? 2 : 1;

  for (let r = 0; r < size; r += step) {
    const imgRow = y + r;
    for (let col = 0; col < size; col += step) {
      const imgCol = x + col;
      const imgIdx = (imgRow * width + imgCol) * 4;
      const alphaIdx = r * size + col;

      const rVal = imageData.data[imgIdx];
      const gVal = imageData.data[imgIdx + 1];
      const bVal = imageData.data[imgIdx + 2];
      const lum = 0.299 * rVal + 0.587 * gVal + 0.114 * bVal;
      const invLum = 255.0 - lum;
      const alpha = alphas[alphaIdx];

      sumL += lum;
      sumA += alpha;
      sumL2 += lum * lum;
      sumA2 += alpha * alpha;
      sumLA += lum * alpha;

      sumInvL += invLum;
      sumInvL2 += invLum * invLum;
      sumInvLA += invLum * alpha;
      n++;

      // Gradient analysis (high-frequency diamond sparkle edges)
      if (r > 0 && r < size - 1 && col > 0 && col < size - 1 && imgRow > 0 && imgRow < height - 1 && imgCol > 0 && imgCol < width - 1) {
        const leftIdx = (imgRow * width + (imgCol - 1)) * 4;
        const rightIdx = (imgRow * width + (imgCol + 1)) * 4;
        const upIdx = ((imgRow - 1) * width + imgCol) * 4;
        const downIdx = ((imgRow + 1) * width + imgCol) * 4;

        const lumLeft = 0.299 * imageData.data[leftIdx] + 0.587 * imageData.data[leftIdx + 1] + 0.114 * imageData.data[leftIdx + 2];
        const lumRight = 0.299 * imageData.data[rightIdx] + 0.587 * imageData.data[rightIdx + 1] + 0.114 * imageData.data[rightIdx + 2];
        const lumUp = 0.299 * imageData.data[upIdx] + 0.587 * imageData.data[upIdx + 1] + 0.114 * imageData.data[upIdx + 2];
        const lumDown = 0.299 * imageData.data[downIdx] + 0.587 * imageData.data[downIdx + 1] + 0.114 * imageData.data[downIdx + 2];

        const gx = lumRight - lumLeft;
        const gy = lumDown - lumUp;
        const imgGrad = Math.sqrt(gx * gx + gy * gy);
        const aGrad = gradMag[alphaIdx];

        sumG += imgGrad;
        sumGA += aGrad;
        sumG2 += imgGrad * imgGrad;
        sumGA2 += aGrad * aGrad;
        sumGGA += imgGrad * aGrad;
        nGrad++;
      }
    }
  }

  if (n === 0) return { score: -1, variance: 0 };

  const meanL = sumL / n;
  const meanA = sumA / n;
  const varL = Math.max(0, sumL2 / n - meanL * meanL);
  const varA = Math.max(0, sumA2 / n - meanA * meanA);

  if (varA <= 0.0001) {
    return { score: 0, variance: varL };
  }

  // White polarity NCC
  let nccWhite = 0;
  if (varL > 0.5) {
    const covLA = sumLA / n - meanL * meanA;
    nccWhite = covLA / Math.sqrt(varL * varA);
  }

  // Dark polarity NCC (for bright white backgrounds)
  let nccDark = 0;
  const meanInvL = sumInvL / n;
  const varInvL = Math.max(0, sumInvL2 / n - meanInvL * meanInvL);
  if (varInvL > 0.5 && meanL > 160) {
    const covInvLA = sumInvLA / n - meanInvL * meanA;
    nccDark = covInvLA / Math.sqrt(varInvL * varA);
  }

  const nccLum = Math.max(nccWhite, nccDark);

  // Gradient edge NCC
  let nccGrad = 0;
  if (nGrad > 10) {
    const meanG = sumG / nGrad;
    const meanGA = sumGA / nGrad;
    const varG = Math.max(0, sumG2 / nGrad - meanG * meanG);
    const varGA = Math.max(0, sumGA2 / nGrad - meanGA * meanGA);
    if (varG > 0.5 && varGA > 0.0001) {
      const covGGA = sumGGA / nGrad - meanG * meanGA;
      nccGrad = Math.max(0, covGGA / Math.sqrt(varG * varGA));
    }
  }

  let fusedScore = (nccLum * 0.65) + (nccGrad * 0.35);
  if (varL < 20) {
    fusedScore = Math.max(fusedScore, (nccLum * 0.40) + (nccGrad * 0.60));
  }

  return { score: Math.max(0, fusedScore), variance: varL };
}

function findOptimalGainJs(imageData, width, height, x, y, size, bgImg) {
  const template = getAlphaTemplateData(bgImg, size);
  const alphas = template.alphas;

  let bestGain = 0.6;
  let bestScore = Infinity;

  const candidateGains = [0.4, 0.45, 0.5, 0.55, 0.57, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 1.0];

  for (const g of candidateGains) {
    let sumL = 0, sumA = 0, sumL2 = 0, sumA2 = 0, sumLA = 0;
    let count = 0;

    for (let r = 0; r < size; r++) {
      const imgRow = y + r;
      if (imgRow < 0 || imgRow >= height) continue;
      for (let c = 0; c < size; c++) {
        const imgCol = x + c;
        if (imgCol < 0 || imgCol >= width) continue;

        const imgIdx = (imgRow * width + imgCol) * 4;
        const alphaIdx = r * size + c;
        const a = Math.min(alphas[alphaIdx] * g, 0.99);

        // Compute mathematically restored luminance
        const rVal = (imageData.data[imgIdx] - a * 255) / (1 - a);
        const gVal = (imageData.data[imgIdx + 1] - a * 255) / (1 - a);
        const bVal = (imageData.data[imgIdx + 2] - a * 255) / (1 - a);
        const lum = Math.max(0, Math.min(255, 0.299 * rVal + 0.587 * gVal + 0.114 * bVal));
        const alpha = alphas[alphaIdx];

        sumL += lum;
        sumA += alpha;
        sumL2 += lum * lum;
        sumA2 += alpha * alpha;
        sumLA += lum * alpha;
        count++;
      }
    }

    if (count > 0) {
      const meanL = sumL / count;
      const meanA = sumA / count;
      const varL = sumL2 / count - meanL * meanL;
      const varA = sumA2 / count - meanA * meanA;
      const covLA = sumLA / count - meanL * meanA;

      let corr = 0;
      if (varL > 0.001 && varA > 0.001) {
        corr = covLA / Math.sqrt(varL * varA);
      }
      const absScore = Math.abs(corr);
      if (absScore < bestScore) {
        bestScore = absScore;
        bestGain = g;
      }
    }
  }

  return bestGain;
}

function detectWatermarkCandidate(imageData, width, height, bgImg) {
  const minDim = Math.min(width, height);
  const baseRatio = minDim / 1536;
  const base = getWatermarkInfo(width, height);

  // Calibrated reference anchors from standard Gemini test images:
  // - Small images (<1000px, e.g. 1376x768): right=73px, bottom=73px, size=48px
  // - Large images (>=1000px, e.g. 2752x1536, 3200x1344): right=64px, bottom=64px, size=96px
  const isSmall = minDim < 1000;
  const primaryAnchor = isSmall
    ? { marginR: 73, marginB: 73, size: 48, name: 'Calibrated Anchor (73px margin, 48px)' }
    : { marginR: 64, marginB: 64, size: 96, name: 'Calibrated Anchor (64px margin, 96px)' };

  // Candidate Layout Families with Bayesian Priors (Primary Anchor checked first):
  const layoutFamilies = [
    {
      presetKey: 'classic',
      name: primaryAnchor.name,
      baseSize: primaryAnchor.size,
      calcPos: (s) => ({
        x: Math.max(0, width - primaryAnchor.marginR - s),
        y: Math.max(0, height - primaryAnchor.marginB - s)
      }),
      gain: isSmall ? 0.6 : 1.0,
      prior: 2.0
    },
    // 1. Gemini & Nano Banana Adaptive Inset (12.5% Inset)
    {
      presetKey: 'new',
      name: 'Gemini & Nano Banana (Adaptive)',
      baseSize: base.size,
      calcPos: (s) => {
        const m = Math.max(8, Math.round(192 * baseRatio));
        return { x: Math.max(0, width - m - s), y: Math.max(0, height - m - s) };
      },
      gain: 0.6,
      prior: 1.08
    },
    // 2. Classic Corner Adaptive (4.16% Margin)
    {
      presetKey: 'classic',
      name: 'Classic Corner (Adaptive)',
      baseSize: base.size,
      calcPos: (s) => {
        const m = Math.max(8, Math.round(64 * baseRatio));
        return { x: Math.max(0, width - m - s), y: Math.max(0, height - m - s) };
      },
      gain: 1.0,
      prior: 1.04
    }
  ];

  if (minDim >= 1200) {
    layoutFamilies.push(
      // 3. Fixed Standard (96px watermark for full-resolution)
      {
        presetKey: 'new',
        name: 'Gemini & Nano Banana (Fixed 96px Inset)',
        baseSize: 96,
        calcPos: (s) => {
          const m = minDim >= 1400 ? 192 : Math.round(128 * Math.max(0.5, minDim / 1024));
          return { x: Math.max(0, width - m - s), y: Math.max(0, height - m - s) };
        },
        gain: 0.6,
        prior: 1.02
      },
      // 4. Fixed 96px Classic Corner
      {
        presetKey: 'classic',
        name: 'Classic Corner (Fixed 96px)',
        baseSize: 96,
        calcPos: (s) => {
          const m = minDim >= 1024 ? 64 : 32;
          return { x: Math.max(0, width - m - s), y: Math.max(0, height - m - s) };
        },
        gain: 1.0,
        prior: 1.01
      }
    );
  }

  // Multi-Scale search pyramid around expected scale
  const scalePyramid = [0.75, 0.90, 1.00, 1.10, 1.25];

  let bestMatch = null;
  let bestScore = -1;

  for (const layout of layoutFamilies) {
    for (const scale of scalePyramid) {
      const s = Math.max(16, Math.min(Math.round(layout.baseSize * scale), Math.min(width, height) - 8));
      const pos = layout.calcPos(s);
      const { score, variance } = evaluateCandidateMatch(imageData, width, height, bgImg, { x: pos.x, y: pos.y, size: s });
      if (variance < 6.0) continue; // reject flat patches
      const weightedScore = score * (layout.prior || 1.0);

      if (weightedScore > bestScore) {
        bestScore = weightedScore;
        bestMatch = {
          layout,
          size: s,
          scale,
          x: pos.x,
          y: pos.y,
          score: weightedScore
        };
      }
    }
  }

  // Full Quadrant Scan across bottom-right (catches arbitrary insets, widescreen ratios, crops)
  const scanMinX = Math.max(0, Math.round(width * 0.65));
  const scanMinY = Math.max(0, Math.round(height * 0.70));
  const expectedSize = base.size;
  const scanSizes = [Math.round(expectedSize * 0.85), expectedSize, Math.round(expectedSize * 1.15)]
    .map(s => Math.max(16, Math.min(s, Math.min(width, height) - 8)));
  const uniqueScanSizes = [...new Set(scanSizes)];
  const gridStep = Math.max(8, Math.round(expectedSize / 5));

  for (const s of uniqueScanSizes) {
    for (let sy = scanMinY; sy <= height - s - 4; sy += gridStep) {
      for (let sx = scanMinX; sx <= width - s - 4; sx += gridStep) {
        const { score, variance } = evaluateCandidateMatch(imageData, width, height, bgImg, { x: sx, y: sy, size: s });
        if (variance < 6.0) continue;
        if (score > bestScore) {
          bestScore = score;
          bestMatch = {
            layout: layoutFamilies[0],
            size: s,
            scale: s / base.size,
            x: sx,
            y: sy,
            score
          };
        }
      }
    }
  }

  // Refinement: Joint 2D Position (±16px) and Scale fine-tuning (±10%)
  if (bestMatch && bestMatch.score > 0.05) {
    let refinedX = bestMatch.x;
    let refinedY = bestMatch.y;
    let refinedSize = bestMatch.size;
    let refinedScore = bestMatch.score;

    const fineSizes = [
      Math.max(16, Math.round(bestMatch.size * 0.94)),
      bestMatch.size,
      Math.min(Math.min(width, height) - 8, Math.round(bestMatch.size * 1.06))
    ];
    const uniqueSizes = [...new Set(fineSizes)];

    for (const testSize of uniqueSizes) {
      for (let dy = -20; dy <= 20; dy += 2) {
        for (let dx = -20; dx <= 20; dx += 2) {
          const testX = Math.max(0, Math.min(width - testSize, bestMatch.x + dx));
          const testY = Math.max(0, Math.min(height - testSize, bestMatch.y + dy));
          const { score, variance } = evaluateCandidateMatch(imageData, width, height, bgImg, { x: testX, y: testY, size: testSize });
          if (variance < 6.0) continue;
          const weightedScore = score * (bestMatch.layout.prior || 1.0);

          if (weightedScore > refinedScore) {
            refinedScore = weightedScore;
            refinedX = testX;
            refinedY = testY;
            refinedSize = testSize;
          }
        }
      }
    }

    const calculatedScale = Math.round((refinedSize / base.size) * 100) / 100;
    const optimalGain = findOptimalGainJs(imageData, width, height, refinedX, refinedY, refinedSize, bgImg);

    return {
      matchFound: refinedScore >= 0.10,
      score: Math.min(1.0, refinedScore),
      presetKey: bestMatch.layout.presetKey,
      name: `${bestMatch.layout.name} (${refinedSize}px, ${optimalGain.toFixed(2)}x)`,
      offsetX: refinedX - base.x,
      offsetY: refinedY - base.y,
      sizeScale: Math.max(0.5, Math.min(2.5, calculatedScale)),
      gain: optimalGain,
    };
  }

  const fallbackOffset = Math.round(-128 * baseRatio);
  return {
    matchFound: false,
    score: bestScore > 0 ? bestScore : 0,
    presetKey: 'new',
    name: 'Gemini & Nano Banana (Adaptive)',
    offsetX: fallbackOffset,
    offsetY: fallbackOffset,
    sizeScale: 1.0,
    gain: 0.6,
  };
}

function detectVideoWatermarkCandidate(imageData, width, height, bgImg) {
  const baseDim = Math.min(width, height);
  const veoBase = {
    size: Math.max(24, Math.min(Math.round(baseDim / 15), baseDim)),
    margin: Math.round(baseDim / 10),
  };

  const layoutFamilies = [
    // 1. Gemini Omni & Google Flow Adaptive Inset
    {
      presetKey: 'veo',
      name: 'Gemini Omni & Google Flow (Adaptive Inset)',
      baseSize: veoBase.size,
      calcPos: (s) => {
        const adaptiveOffset = Math.round(-24 * (baseDim / 720));
        const baseX = Math.max(0, width - veoBase.margin - veoBase.size);
        const baseY = Math.max(0, height - veoBase.margin - veoBase.size);
        return {
          x: Math.max(0, Math.min(width - s, baseX + adaptiveOffset)),
          y: Math.max(0, Math.min(height - s, baseY + adaptiveOffset))
        };
      },
      gain: 0.6,
      prior: 1.06
    },
    // 2. Veo Classic Corner
    {
      presetKey: 'corner',
      name: 'Gemini Veo & Flow (Corner)',
      baseSize: veoBase.size,
      calcPos: (s) => {
        const baseX = Math.max(0, width - veoBase.margin - veoBase.size);
        const baseY = Math.max(0, height - veoBase.margin - veoBase.size);
        return {
          x: Math.max(0, Math.min(width - s, baseX)),
          y: Math.max(0, Math.min(height - s, baseY))
        };
      },
      gain: 0.6,
      prior: 1.02
    },
    // 3. Gemini Sparkle Image-style on Video
    {
      presetKey: 'sparkle',
      name: 'Gemini Sparkle (Standard Video)',
      baseSize: Math.max(24, Math.round(96 * (baseDim / 1536))),
      calcPos: (s) => {
        const m = Math.max(16, Math.round(192 * (baseDim / 1536)));
        return {
          x: Math.max(0, width - m - s),
          y: Math.max(0, height - m - s)
        };
      },
      gain: 0.6,
      prior: 1.01
    }
  ];

  const scalePyramid = [0.65, 0.85, 1.00, 1.20, 1.45];

  let bestMatch = null;
  let bestScore = -1;

  for (const layout of layoutFamilies) {
    for (const scale of scalePyramid) {
      const s = Math.max(16, Math.min(Math.round(layout.baseSize * scale), Math.min(width, height) - 8));
      const pos = layout.calcPos(s);
      const { score } = evaluateCandidateMatch(imageData, width, height, bgImg, { x: pos.x, y: pos.y, size: s });
      const weightedScore = score * (layout.prior || 1.0);

      if (weightedScore > bestScore) {
        bestScore = weightedScore;
        bestMatch = {
          layout,
          size: s,
          scale,
          x: pos.x,
          y: pos.y,
          score: weightedScore
        };
      }
    }
  }

  const baseX = Math.max(0, width - veoBase.margin - veoBase.size);
  const baseY = Math.max(0, height - veoBase.margin - veoBase.size);

  if (bestMatch && bestMatch.score > 0.05) {
    let refinedX = bestMatch.x;
    let refinedY = bestMatch.y;
    let refinedSize = bestMatch.size;
    let refinedScore = bestMatch.score;

    const fineSizes = [
      Math.max(16, Math.round(bestMatch.size * 0.92)),
      bestMatch.size,
      Math.min(Math.min(width, height) - 8, Math.round(bestMatch.size * 1.08))
    ];
    const uniqueSizes = [...new Set(fineSizes)];

    for (const testSize of uniqueSizes) {
      for (let dy = -16; dy <= 16; dy += 4) {
        for (let dx = -16; dx <= 16; dx += 4) {
          const testX = Math.max(0, Math.min(width - testSize, bestMatch.x + dx));
          const testY = Math.max(0, Math.min(height - testSize, bestMatch.y + dy));
          const { score } = evaluateCandidateMatch(imageData, width, height, bgImg, { x: testX, y: testY, size: testSize });
          const weightedScore = score * (bestMatch.layout.prior || 1.0);

          if (weightedScore > refinedScore) {
            refinedScore = weightedScore;
            refinedX = testX;
            refinedY = testY;
            refinedSize = testSize;
          }
        }
      }
    }

    const calculatedScale = Math.round((refinedSize / veoBase.size) * 100) / 100;

    return {
      matchFound: refinedScore >= 0.08,
      score: Math.min(1.0, refinedScore),
      name: `${bestMatch.layout.name} (${refinedSize}px)`,
      offsetX: refinedX - baseX,
      offsetY: refinedY - baseY,
      sizeScale: Math.max(0.5, Math.min(2.5, calculatedScale)),
      gain: bestMatch.layout.gain || 0.6,
    };
  }

  const fallbackOffset = Math.round(-24 * (baseDim / 720));
  return {
    matchFound: false,
    score: bestScore > 0 ? bestScore : 0,
    presetKey: 'veo',
    name: 'Gemini Omni & Google Flow (Adaptive Inset)',
    offsetX: fallbackOffset,
    offsetY: fallbackOffset,
    sizeScale: 1.0,
    gain: 0.6,
  };
}


// ═════════════════════════════════════════════════════════════════════════
// UNMARK — Minimalist Darkroom UI Controller
// Specification Version 1.0 (Dark Theme Only, Zero Inpainting/Blur)
// ═════════════════════════════════════════════════════════════════════════

// Global instances reused from lines 489-491
currentTab = 'image';

// ── Toast Notifications ──
function showToast(message, type = 'info', duration = 3000) {
  const shelf = document.getElementById('toast-shelf');
  if (!shelf) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type === 'success' ? 'chip-success' : type === 'danger' ? 'chip-danger' : ''}`;
  let icon = 'ph:info-bold';
  if (type === 'success') icon = 'ph:check-circle-bold';
  if (type === 'danger') icon = 'ph:warning-circle-bold';
  toast.innerHTML = `<iconify-icon icon="${icon}" width="16"></iconify-icon><span>${message}</span>`;
  shelf.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 240ms ease';
    setTimeout(() => toast.remove(), 250);
  }, duration);
}

// ── Smooth Scroll Helper ──
function smoothScrollTo(element, offset = 75) {
  if (!element) return;
  setTimeout(() => {
    const rect = element.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const targetY = rect.top + scrollTop - offset;
    window.scrollTo({
      top: Math.max(0, targetY),
      behavior: 'smooth'
    });
  }, 100);
}

// ── Initialize App ──
function init() {
  initTabs();
  initOverlays();
  initImageRemover();
  initVideoRemover();
  initBatch();
  initShortcuts();
  checkEngineHealth();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// ── 1. Tab / Mode Controller ──
function initTabs() {
  const tabImage = document.getElementById('tab-image');
  const tabVideo = document.getElementById('tab-video');
  const tabBatch = document.getElementById('tab-batch');
  const panelImage = document.getElementById('panel-image');
  const panelVideo = document.getElementById('panel-video');
  const panelBatch = document.getElementById('panel-batch');
  const inspectorImage = document.getElementById('inspector-image');
  const inspectorVideo = document.getElementById('inspector-video');
  const inspectorBatch = document.getElementById('inspector-batch');

  function switchTab(target, updateHash = false) {
    currentTab = target;
    try { sessionStorage.setItem('activeTab', target); } catch (e) { }

    if (tabImage) tabImage.classList.toggle('active', target === 'image');
    if (tabVideo) tabVideo.classList.toggle('active', target === 'video');
    if (tabBatch) tabBatch.classList.toggle('active', target === 'batch');

    if (panelImage) {
      panelImage.style.display = target === 'image' ? 'block' : 'none';
      panelImage.classList.toggle('hidden', target !== 'image');
    }
    if (panelVideo) {
      panelVideo.style.display = target === 'video' ? 'block' : 'none';
      panelVideo.classList.toggle('hidden', target !== 'video');
    }
    if (panelBatch) {
      panelBatch.style.display = target === 'batch' ? 'block' : 'none';
      panelBatch.classList.toggle('hidden', target !== 'batch');
    }

    if (inspectorImage) inspectorImage.classList.toggle('hidden', target !== 'image');
    if (inspectorVideo) inspectorVideo.classList.toggle('hidden', target !== 'video');
    if (inspectorBatch) inspectorBatch.classList.toggle('hidden', target !== 'batch');

    if (updateHash) {
      try {
        const hash = target === 'image' ? '' : '#' + target;
        history.replaceState(null, '', window.location.pathname + window.location.search + hash);
      } catch (e) { }
    }
  }

  window.switchTab = switchTab;

  if (tabImage) tabImage.onclick = (e) => { e.preventDefault(); switchTab('image', true); };
  if (tabVideo) tabVideo.onclick = (e) => { e.preventDefault(); switchTab('video', true); };
  if (tabBatch) tabBatch.onclick = (e) => { e.preventDefault(); switchTab('batch', true); };

  // URL hash check
  const hash = (window.location.hash || '').toLowerCase();
  if (hash === '#video' || hash === '#panel-video') {
    switchTab('video');
  } else if (hash === '#batch' || hash === '#panel-batch') {
    switchTab('batch');
  } else {
    try {
      const saved = sessionStorage.getItem('activeTab');
      if (saved && (saved === 'image' || saved === 'video' || saved === 'batch')) {
        switchTab(saved);
      }
    } catch (e) { }
  }

  window.addEventListener('hashchange', () => {
    const h = (window.location.hash || '').toLowerCase();
    if (h === '#video' || h === '#panel-video') switchTab('video');
    else if (h === '#batch' || h === '#panel-batch') switchTab('batch');
    else if (h === '#image' || h === '#panel-image') switchTab('image');
  });

  document.querySelectorAll('a[href="#panel-video"], a[href="#video"]').forEach(link => {
    link.addEventListener('click', (e) => { e.preventDefault(); switchTab('video', true); });
  });
  document.querySelectorAll('a[href="#panel-image"], a[href="#image"]').forEach(link => {
    link.addEventListener('click', (e) => { e.preventDefault(); switchTab('image', true); });
  });
}

// ── 2. Overlays Controller (Settings, Engine, Shortcuts) ──
function initOverlays() {
  const btnSettings = document.getElementById('btn-open-settings');
  const btnCloseSettings = document.getElementById('btn-close-settings');
  const drawerSettings = document.getElementById('settings-drawer');
  const backdropSettings = document.getElementById('settings-backdrop');

  const btnShortcuts = document.getElementById('btn-open-shortcuts');
  const btnCloseShortcuts = document.getElementById('btn-close-shortcuts');
  const modalShortcuts = document.getElementById('shortcuts-modal');

  const btnEngine = document.getElementById('btn-engine-status');
  const popoverEngine = document.getElementById('engine-popover');

  function openSettings() {
    if (drawerSettings) drawerSettings.classList.remove('hidden');
    if (backdropSettings) backdropSettings.classList.remove('hidden');
  }
  function closeSettings() {
    if (drawerSettings) drawerSettings.classList.add('hidden');
    if (backdropSettings) backdropSettings.classList.add('hidden');
  }

  function openShortcuts() {
    if (modalShortcuts) modalShortcuts.classList.remove('hidden');
  }
  function closeShortcuts() {
    if (modalShortcuts) modalShortcuts.classList.add('hidden');
  }

  btnSettings?.addEventListener('click', openSettings);
  btnCloseSettings?.addEventListener('click', closeSettings);
  backdropSettings?.addEventListener('click', closeSettings);

  btnShortcuts?.addEventListener('click', openShortcuts);
  btnCloseShortcuts?.addEventListener('click', closeShortcuts);
  modalShortcuts?.addEventListener('click', (e) => {
    if (e.target === modalShortcuts) closeShortcuts();
  });

  btnEngine?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (popoverEngine) popoverEngine.classList.toggle('hidden');
  });

  document.addEventListener('click', (e) => {
    if (popoverEngine && !popoverEngine.contains(e.target) && e.target !== btnEngine && !btnEngine?.contains(e.target)) {
      popoverEngine.classList.add('hidden');
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeSettings();
      closeShortcuts();
      if (popoverEngine) popoverEngine.classList.add('hidden');
      const batchModal = document.getElementById('batch-preview-modal');
      if (batchModal) batchModal.classList.add('hidden');
    }
  });
}

// ── Check Engine Health (Local FastAPI Ping) ──
async function checkEngineHealth() {
  const dot = document.getElementById('engine-ping-dot');
  const statusTxt = document.getElementById('engine-ping-status');
  const topbarTxt = document.getElementById('engine-status-text');
  const inputUrl = document.getElementById('setting-engine-url');
  const url = (inputUrl && inputUrl.value) ? inputUrl.value.trim() : 'http://127.0.0.1:8000';

  try {
    const res = await fetch(`${url}/api/v1/health`, { signal: AbortSignal.timeout(1500) });
    if (res.ok) {
      if (dot) dot.style.background = 'var(--success)';
      if (statusTxt) statusTxt.textContent = 'Local FastAPI connected (port 8000)';
      if (topbarTxt) topbarTxt.textContent = 'FastAPI + GPU';
      return;
    }
  } catch (e) {
    // Fallback to in-browser WebCodecs
  }
  if (dot) dot.style.background = 'var(--accent)';
  if (statusTxt) statusTxt.textContent = 'In-browser WebCodecs (100% private, on-device)';
  if (topbarTxt) topbarTxt.textContent = 'In browser';
}

// ── 3. Image Remover Controller ──
function initImageRemover() {
  const dropzone = document.getElementById('img-dropzone');
  const fileInput = document.getElementById('img-input');
  const stageLoaded = document.getElementById('img-stage-loaded');
  const compareBox = document.getElementById('img-compare');
  const mainCanvas = document.getElementById('img-main-canvas');
  const origImg = document.getElementById('img-staging-preview');
  const compareLine = document.getElementById('img-compare-line');
  const layerOrig = document.getElementById('img-layer-orig');

  const metaFilename = document.getElementById('img-staging-filename');
  const metaDims = document.getElementById('img-staging-dims');
  const selectedPresetName = document.getElementById('img-selected-preset-name');
  const btnTogglePresets = document.getElementById('btn-toggle-presets');
  const presetList = document.getElementById('img-preset-list');

  const sliderGain = document.getElementById('slider-img-gain');
  const sliderScale = document.getElementById('slider-img-scale');
  const sliderOffsetX = document.getElementById('slider-img-offset-x');
  const sliderOffsetY = document.getElementById('slider-img-offset-y');

  const lblGain = document.getElementById('lbl-img-gain');
  const lblScale = document.getElementById('lbl-img-scale');
  const lblOffsetX = document.getElementById('lbl-img-offset-x');
  const lblOffsetY = document.getElementById('lbl-img-offset-y');

  const btnResetSliders = document.getElementById('btn-img-reset-sliders');
  const btnExport = document.getElementById('btn-img-export');
  const btnReplace = document.getElementById('btn-img-change-file-tuner');

  const btnToggleSplit = document.getElementById('btn-toggle-split');
  const btnHoldOrig = document.getElementById('btn-hold-orig');
  const btnToggleLoupe = document.getElementById('btn-toggle-loupe');
  const loupeEl = document.getElementById('img-loupe');
  const loupeCanvas = document.getElementById('img-zoom-cleaned-canvas');
  const btnFitScreen = document.getElementById('btn-fit-screen');

  if (!dropzone || !fileInput) return;

  let currentFile = null;
  let currentPreviewFrame = null;
  let currentBase = null;
  let currentDetected = null;
  let isProcessing = false;
  let isSplitActive = true;
  let isLoupeActive = false;
  let splitPercent = 50;
  let isDraggingSplit = false;

  const currentSettings = { gain: 0.6, offsetX: -128, offsetY: -128, sizeScale: 1 };

  function updateSliderLabels() {
    if (lblGain) lblGain.textContent = `${currentSettings.gain.toFixed(2)}x`;
    if (lblScale) lblScale.textContent = `${currentSettings.sizeScale.toFixed(2)}x`;
    if (lblOffsetX) lblOffsetX.textContent = `${currentSettings.offsetX}px`;
    if (lblOffsetY) lblOffsetY.textContent = `${currentSettings.offsetY}px`;
  }

  function setSplit(pct) {
    splitPercent = Math.max(0, Math.min(100, pct));
    if (compareBox) compareBox.dataset.split = splitPercent.toFixed(1);
    if (compareLine) compareLine.style.left = `${splitPercent}%`;
    if (layerOrig) {
      if (!isSplitActive) {
        layerOrig.style.clipPath = 'polygon(100% 0, 100% 0, 100% 100%, 100% 100%)';
      } else {
        layerOrig.style.clipPath = `polygon(${splitPercent}% 0, 100% 0, 100% 100%, ${splitPercent}% 100%)`;
      }
    }
  }

  // Signature Reveal Animation: 420ms left-to-center sweep
  function triggerRevealSweep() {
    if (!compareBox) return;
    compareBox.dataset.reveal = "play";
    setSplit(0);
    const start = performance.now();
    const duration = 420;
    function sweep(time) {
      const elapsed = time - start;
      const progress = Math.min(1, elapsed / duration);
      // ease-reveal cubic-bezier(0.65, 0, 0.15, 1)
      const ease = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;
      setSplit(ease * 50);
      if (progress < 1) {
        requestAnimationFrame(sweep);
      } else {
        setSplit(50);
        compareBox.removeAttribute('data-reveal');
      }
    }
    requestAnimationFrame(sweep);
  }

  // Compare Slider Drag Handling
  function onPointerDown(e) {
    if (e.target.closest('.stage-toolbar') || e.target.closest('.loupe')) return;
    isDraggingSplit = true;
    updateSplitFromPointer(e);
    compareBox.setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e) {
    if (isDraggingSplit) {
      updateSplitFromPointer(e);
    }
    if (isLoupeActive) {
      updateLoupePosition(e);
    }
  }

  function onPointerUp(e) {
    isDraggingSplit = false;
    try { compareBox.releasePointerCapture?.(e.pointerId); } catch (err) {}
  }

  function updateSplitFromPointer(e) {
    if (!compareBox) return;
    const rect = compareBox.getBoundingClientRect();
    if (rect.width <= 0) return;
    const clientX = e.clientX ?? (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
    const x = clientX - rect.left;
    const pct = (x / rect.width) * 100;
    setSplit(pct);
  }

  compareBox?.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);

  // Loupe Controller (4x magnification)
  function updateLoupePosition(e) {
    if (!loupeEl || !loupeCanvas || !mainCanvas || !compareBox) return;
    const rect = compareBox.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
      loupeEl.classList.add('hidden');
      return;
    }
    loupeEl.classList.remove('hidden');
    loupeEl.style.left = `${x}px`;
    loupeEl.style.top = `${y}px`;

    // Map to canvas pixel coordinates
    const scaleX = mainCanvas.width / rect.width;
    const scaleY = mainCanvas.height / rect.height;
    const cx = x * scaleX;
    const cy = y * scaleY;

    const zctx = loupeCanvas.getContext('2d');
    zctx.imageSmoothingEnabled = false;
    zctx.clearRect(0, 0, loupeCanvas.width, loupeCanvas.height);

    const zoomFactor = 4;
    const srcSize = 200 / zoomFactor; // 50px source box
    zctx.drawImage(
      mainCanvas,
      cx - srcSize / 2, cy - srcSize / 2, srcSize, srcSize,
      0, 0, loupeCanvas.width, loupeCanvas.height
    );
  }

  btnToggleLoupe?.addEventListener('click', () => {
    isLoupeActive = !isLoupeActive;
    btnToggleLoupe.classList.toggle('active', isLoupeActive);
    if (!isLoupeActive && loupeEl) loupeEl.classList.add('hidden');
  });

  btnToggleSplit?.addEventListener('click', () => {
    isSplitActive = !isSplitActive;
    btnToggleSplit.classList.toggle('active', isSplitActive);
    if (compareLine) compareLine.style.display = isSplitActive ? 'block' : 'none';
    setSplit(splitPercent);
  });

  // Hold original button / key
  let previousSplit = 50;
  function startHoldOriginal() {
    previousSplit = splitPercent;
    setSplit(100);
    if (layerOrig) layerOrig.style.clipPath = 'polygon(0 0, 100% 0, 100% 100%, 0 100%)';
  }
  function stopHoldOriginal() {
    setSplit(previousSplit);
  }

  btnHoldOrig?.addEventListener('mousedown', startHoldOriginal);
  btnHoldOrig?.addEventListener('mouseup', stopHoldOriginal);
  btnHoldOrig?.addEventListener('mouseleave', stopHoldOriginal);
  btnHoldOrig?.addEventListener('touchstart', (e) => { e.preventDefault(); startHoldOriginal(); });
  btnHoldOrig?.addEventListener('touchend', (e) => { e.preventDefault(); stopHoldOriginal(); });

  window.addEventListener('keydown', (e) => {
    if (currentTab === 'image' && e.key === '\\' && !e.repeat) {
      startHoldOriginal();
    }
  });
  window.addEventListener('keyup', (e) => {
    if (currentTab === 'image' && e.key === '\\') {
      stopHoldOriginal();
    }
  });

  btnFitScreen?.addEventListener('click', () => {
    setSplit(50);
  });

  // Presets Accordion
  btnTogglePresets?.addEventListener('click', () => {
    if (presetList) presetList.classList.toggle('hidden');
  });

  presetList?.querySelectorAll('.preset-item').forEach(item => {
    item.addEventListener('click', () => {
      presetList.querySelectorAll('.preset-item').forEach(p => p.classList.remove('active'));
      item.classList.add('active');
      const presetKey = item.dataset.preset;
      const w = currentPreviewFrame ? currentPreviewFrame.width : 1536;
      const h = currentPreviewFrame ? currentPreviewFrame.height : 1536;
      const p = getAdaptiveImagePreset(presetKey, w, h);
      Object.assign(currentSettings, p);

      if (sliderOffsetX) sliderOffsetX.value = currentSettings.offsetX;
      if (sliderOffsetY) sliderOffsetY.value = currentSettings.offsetY;
      if (sliderGain) sliderGain.value = currentSettings.gain;
      if (sliderScale) sliderScale.value = currentSettings.sizeScale;

      if (selectedPresetName) selectedPresetName.textContent = item.querySelector('.preset-title')?.textContent || presetKey;
      presetList.classList.add('hidden');
      updateSliderLabels();
      renderTuner();
    });
  });

  function bindSlider(element, prop, isFloat = false) {
    if (!element) return;
    element.addEventListener('input', (e) => {
      currentSettings[prop] = isFloat ? parseFloat(e.target.value) : parseInt(e.target.value, 10);
      updateSliderLabels();
      renderTuner();
    });
  }

  bindSlider(sliderGain, 'gain', true);
  bindSlider(sliderScale, 'sizeScale', true);
  bindSlider(sliderOffsetX, 'offsetX', false);
  bindSlider(sliderOffsetY, 'offsetY', false);

  btnResetSliders?.addEventListener('click', () => {
    applyAutoSettings();
    showToast('Sliders reset to auto-detected watermark parameters');
  });

  function applyAutoSettings() {
    const w = currentPreviewFrame ? currentPreviewFrame.width : 1536;
    const h = currentPreviewFrame ? currentPreviewFrame.height : 1536;

    let p;
    if (currentDetected) {
      p = {
        gain: currentDetected.gain,
        offsetX: currentDetected.offsetX,
        offsetY: currentDetected.offsetY,
        sizeScale: currentDetected.sizeScale
      };
      if (selectedPresetName) {
        selectedPresetName.textContent = `${currentDetected.name} (${Math.round(currentDetected.score * 100)}% match)`;
      }
    } else {
      p = getAdaptiveImagePreset('new', w, h);
      if (selectedPresetName) selectedPresetName.textContent = 'Gemini Adaptive Inset';
    }
    Object.assign(currentSettings, p);

    if (sliderOffsetX) {
      sliderOffsetX.min = -Math.round(w * 0.45);
      sliderOffsetX.max = Math.round(w * 0.2);
      sliderOffsetX.value = currentSettings.offsetX;
    }
    if (sliderOffsetY) {
      sliderOffsetY.min = -Math.round(h * 0.45);
      sliderOffsetY.max = Math.round(h * 0.2);
      sliderOffsetY.value = currentSettings.offsetY;
    }
    if (sliderGain) sliderGain.value = currentSettings.gain;
    if (sliderScale) sliderScale.value = currentSettings.sizeScale;

    updateSliderLabels();
    renderTuner();
  }

  function renderTuner() {
    if (!currentPreviewFrame || !mainCanvas || !watermarkEngine) return;
    const { width, height, imageData } = currentPreviewFrame;

    mainCanvas.width = width;
    mainCanvas.height = height;

    const copy = new ImageData(new Uint8ClampedArray(imageData.data), width, height);
    const activeBg = (Math.min(width, height) < 1000) ? watermarkEngine.bg48 : watermarkEngine.bg96;
    cleanFrame(activeBg, copy, width, height, currentBase, currentSettings);

    const ctx = mainCanvas.getContext('2d');
    ctx.putImageData(copy, 0, 0);
  }

  async function grabImageFrame(file) {
    if (typeof createImageBitmap === 'function') {
      try {
        const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
        const width = bmp.width;
        const height = bmp.height;
        const c = document.createElement('canvas');
        c.width = width;
        c.height = height;
        const cx = c.getContext('2d', { willReadFrequently: true });
        cx.drawImage(bmp, 0, 0, width, height);
        const imageData = cx.getImageData(0, 0, width, height);
        bmp.close();
        return { width, height, imageData };
      } catch (e) {}
    }

    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const cx = c.getContext('2d', { willReadFrequently: true });
        cx.drawImage(img, 0, 0, w, h);
        const imageData = cx.getImageData(0, 0, w, h);
        URL.revokeObjectURL(url);
        resolve({ width: w, height: h, imageData });
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Could not read image file.'));
      };
      img.src = url;
    });
  }

  async function handleImageFile(file) {
    if (!file.type.startsWith('image/')) {
      showToast('Please select a valid image file (PNG, JPG, WebP)', 'danger');
      return;
    }
    currentFile = file;

    try {
      if (!watermarkEngine) {
        watermarkEngine = await WatermarkEngine.create();
      }

      currentPreviewFrame = await grabImageFrame(file);

      // Metadata
      if (metaFilename) metaFilename.textContent = file.name;
      if (metaDims) metaDims.textContent = `${currentPreviewFrame.width} × ${currentPreviewFrame.height} px`;
      if (origImg) origImg.src = URL.createObjectURL(file);

      // Auto detect
      currentBase = watermarkEngine.getWatermarkInfo(currentPreviewFrame.width, currentPreviewFrame.height);
      const activeBg = (Math.min(currentPreviewFrame.width, currentPreviewFrame.height) < 1000) ? watermarkEngine.bg48 : watermarkEngine.bg96;
      currentDetected = detectWatermarkCandidate(currentPreviewFrame.imageData, currentPreviewFrame.width, currentPreviewFrame.height, activeBg);

      // Hide dropzone, show loaded stage
      dropzone.classList.add('hidden');
      stageLoaded.classList.remove('hidden');

      applyAutoSettings();
      triggerRevealSweep();
      showToast(`Watermark detected: ${currentDetected.name}`, 'success');
    } catch (err) {
      console.error(err);
      showToast('Error loading image: ' + (err.message || err), 'danger');
    }
  }

  dropzone.onclick = () => fileInput.click();
  dropzone.ondragover = (e) => { e.preventDefault(); dropzone.classList.add('drag-over'); };
  dropzone.ondragleave = () => dropzone.classList.remove('drag-over');
  dropzone.ondrop = (e) => {
    e.preventDefault();
    dropzone.classList.remove('drag-over');
    if (e.dataTransfer.files.length) handleImageFile(e.dataTransfer.files[0]);
  };
  fileInput.onchange = (e) => {
    if (e.target.files.length) handleImageFile(e.target.files[0]);
    fileInput.value = '';
  };

  btnReplace?.addEventListener('click', () => fileInput.click());

  // Export / Download Cleaned Image
  btnExport?.addEventListener('click', async () => {
    if (!currentFile || !currentPreviewFrame || !mainCanvas) return;
    try {
      handleExportAd();
      loadMonetagPopunder();

      const blob = await new Promise(r => mainCanvas.toBlob(r, 'image/png'));
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `unmark_${currentFile.name.replace(/\.[^/.]+$/, '')}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast('Cleaned image downloaded successfully!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Error exporting image: ' + err.message, 'danger');
    }
  });
}

// ── 4. Video Remover Controller ──
function initVideoRemover() {
  const dropzone = document.getElementById('video-dropzone');
  const fileInput = document.getElementById('video-input');
  const stageLoaded = document.getElementById('video-stage-loaded');
  const mainCanvas = document.getElementById('video-main-canvas');
  const videoSrc = document.getElementById('video-src-element');
  const statusOverlay = document.getElementById('video-status');
  const progressBar = document.getElementById('video-progress-bar');
  const progressText = document.getElementById('video-progress-text');

  const metaFilename = document.getElementById('video-staging-filename');
  const metaDims = document.getElementById('video-staging-dims');

  const step1Desc = document.getElementById('video-step-1-desc');
  const step2Desc = document.getElementById('video-step-2-desc');
  const step3Desc = document.getElementById('video-step-3-desc');

  const sliderGain = document.getElementById('slider-video-gain');
  const sliderScale = document.getElementById('slider-video-scale');
  const sliderOffsetX = document.getElementById('slider-video-offset-x');
  const sliderOffsetY = document.getElementById('slider-video-offset-y');

  const lblGain = document.getElementById('lbl-video-gain');
  const lblScale = document.getElementById('lbl-video-scale');
  const lblOffsetX = document.getElementById('lbl-video-offset-x');
  const lblOffsetY = document.getElementById('lbl-video-offset-y');

  const btnResetSliders = document.getElementById('btn-video-reset-sliders');
  const btnExport = document.getElementById('btn-video-export');
  const btnReplace = document.getElementById('btn-video-change-file-tuner');

  const btnPlay = document.getElementById('btn-video-play');
  const iconPlay = document.getElementById('icon-video-play');
  const btnStepBack = document.getElementById('btn-video-step-back');
  const btnStepForward = document.getElementById('btn-video-step-forward');
  const timeReadout = document.getElementById('lbl-video-time');
  const timelineTrack = document.getElementById('video-timeline-track');
  const timelinePlayed = document.getElementById('video-timeline-played');
  const timelineThumb = document.getElementById('video-timeline-thumb');
  const thumbStrip = document.getElementById('video-thumbnail-strip');

  if (!dropzone || !fileInput) return;

  let currentFile = null;
  let currentPreviewFrame = null;
  let currentBase = null;
  let currentDetected = null;
  let isPlaying = false;
  let animFrameId = null;

  const currentSettings = { gain: 0.6, offsetX: -24, offsetY: -24, sizeScale: 1 };

  function updateSliderLabels() {
    if (lblGain) lblGain.textContent = `${currentSettings.gain.toFixed(2)}x`;
    if (lblScale) lblScale.textContent = `${currentSettings.sizeScale.toFixed(2)}x`;
    if (lblOffsetX) lblOffsetX.textContent = `${currentSettings.offsetX}px`;
    if (lblOffsetY) lblOffsetY.textContent = `${currentSettings.offsetY}px`;
  }

  function bindSlider(element, prop, isFloat = false) {
    if (!element) return;
    element.addEventListener('input', (e) => {
      currentSettings[prop] = isFloat ? parseFloat(e.target.value) : parseInt(e.target.value, 10);
      updateSliderLabels();
      renderFrame();
    });
  }

  bindSlider(sliderGain, 'gain', true);
  bindSlider(sliderScale, 'sizeScale', true);
  bindSlider(sliderOffsetX, 'offsetX', false);
  bindSlider(sliderOffsetY, 'offsetY', false);

  btnResetSliders?.addEventListener('click', () => {
    applyAutoSettings();
    showToast('Video watermark parameters reset');
  });

  function applyAutoSettings() {
    const w = currentPreviewFrame ? currentPreviewFrame.width : 1280;
    const h = currentPreviewFrame ? currentPreviewFrame.height : 720;

    let p;
    if (currentDetected) {
      p = {
        gain: currentDetected.gain,
        offsetX: currentDetected.offsetX,
        offsetY: currentDetected.offsetY,
        sizeScale: currentDetected.sizeScale
      };
      if (step2Desc) step2Desc.textContent = `${currentDetected.name} (${Math.round(currentDetected.score * 100)}%)`;
    } else {
      p = getAdaptiveVideoPreset('veo', w, h);
      if (step2Desc) step2Desc.textContent = 'Veo Video Inset';
    }
    Object.assign(currentSettings, p);

    if (sliderOffsetX) {
      sliderOffsetX.min = -Math.round(w * 0.45);
      sliderOffsetX.max = Math.round(w * 0.2);
      sliderOffsetX.value = currentSettings.offsetX;
    }
    if (sliderOffsetY) {
      sliderOffsetY.min = -Math.round(h * 0.45);
      sliderOffsetY.max = Math.round(h * 0.2);
      sliderOffsetY.value = currentSettings.offsetY;
    }
    if (sliderGain) sliderGain.value = currentSettings.gain;
    if (sliderScale) sliderScale.value = currentSettings.sizeScale;

    updateSliderLabels();
    renderFrame();
  }

  function renderFrame() {
    if (!videoSrc || !mainCanvas || !videoEngine) return;
    if (videoSrc.videoWidth === 0) return;

    const w = videoSrc.videoWidth;
    const h = videoSrc.videoHeight;
    mainCanvas.width = w;
    mainCanvas.height = h;

    const ctx = mainCanvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(videoSrc, 0, 0, w, h);

    const imgData = ctx.getImageData(0, 0, w, h);
    cleanFrame(videoEngine.sparkleImage, imgData, w, h, currentBase, currentSettings);
    ctx.putImageData(imgData, 0, 0);

    updateTimeReadout();
  }

  function formatTime(sec) {
    if (isNaN(sec)) return '00:00.00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 100);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
  }

  function updateTimeReadout() {
    if (!videoSrc) return;
    const cur = videoSrc.currentTime || 0;
    const dur = videoSrc.duration || 0;
    if (timeReadout) timeReadout.textContent = `${formatTime(cur)} / ${formatTime(dur)}`;
    const pct = dur > 0 ? (cur / dur) * 100 : 0;
    if (timelinePlayed) timelinePlayed.style.width = `${pct}%`;
    if (timelineThumb) timelineThumb.style.left = `${pct}%`;
  }

  function togglePlay() {
    if (!videoSrc) return;
    if (videoSrc.paused || videoSrc.ended) {
      videoSrc.play();
      isPlaying = true;
      if (iconPlay) iconPlay.setAttribute('icon', 'ph:pause-fill');
      loopPlayback();
    } else {
      videoSrc.pause();
      isPlaying = false;
      if (iconPlay) iconPlay.setAttribute('icon', 'ph:play-fill');
      if (animFrameId) cancelAnimationFrame(animFrameId);
    }
  }

  function loopPlayback() {
    if (!isPlaying) return;
    renderFrame();
    animFrameId = requestAnimationFrame(loopPlayback);
  }

  btnPlay?.addEventListener('click', togglePlay);

  btnStepBack?.addEventListener('click', () => {
    if (!videoSrc) return;
    videoSrc.pause();
    isPlaying = false;
    if (iconPlay) iconPlay.setAttribute('icon', 'ph:play-fill');
    videoSrc.currentTime = Math.max(0, videoSrc.currentTime - 1 / 30);
    renderFrame();
  });

  btnStepForward?.addEventListener('click', () => {
    if (!videoSrc) return;
    videoSrc.pause();
    isPlaying = false;
    if (iconPlay) iconPlay.setAttribute('icon', 'ph:play-fill');
    videoSrc.currentTime = Math.min(videoSrc.duration, videoSrc.currentTime + 1 / 30);
    renderFrame();
  });

  timelineTrack?.addEventListener('click', (e) => {
    if (!videoSrc || !videoSrc.duration) return;
    const rect = timelineTrack.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    videoSrc.currentTime = pos * videoSrc.duration;
    renderFrame();
  });

  // Extract 12 thumbnails along video timeline
  async function generateThumbnailStrip(file, duration) {
    if (!thumbStrip) return;
    thumbStrip.innerHTML = '';
    const numThumbs = 12;
    const interval = duration / numThumbs;

    const v = document.createElement('video');
    v.muted = true;
    v.src = URL.createObjectURL(file);
    await new Promise(r => { v.onloadedmetadata = r; });

    for (let i = 0; i < numThumbs; i++) {
      const t = i * interval + interval / 2;
      v.currentTime = t;
      await new Promise(r => { v.onseeked = r; });

      const c = document.createElement('canvas');
      c.width = 64;
      c.height = 36;
      c.getContext('2d').drawImage(v, 0, 0, 64, 36);

      const div = document.createElement('div');
      div.className = 'thumbnail-frame';
      div.title = `Seek to ${formatTime(t)}`;
      div.appendChild(c);

      div.onclick = () => {
        videoSrc.currentTime = t;
        renderFrame();
      };
      thumbStrip.appendChild(div);
    }
    URL.revokeObjectURL(v.src);
  }

  async function handleVideoFile(file) {
    if (!file.type.startsWith('video/')) {
      showToast('Please select a valid video file (MP4, WebM, MOV)', 'danger');
      return;
    }
    currentFile = file;

    try {
      if (!videoEngine) {
        videoEngine = await VideoWatermarkEngine.create();
      }

      currentPreviewFrame = await grabPreviewFrame(file);

      if (metaFilename) metaFilename.textContent = file.name;
      if (metaDims) metaDims.textContent = `${currentPreviewFrame.width} × ${currentPreviewFrame.height} px`;
      if (step1Desc) step1Desc.textContent = `High-variance locked (${currentPreviewFrame.width}x${currentPreviewFrame.height})`;

      currentBase = videoEngine.getVeoWatermark(currentPreviewFrame.width, currentPreviewFrame.height);
      currentDetected = detectVideoWatermarkCandidate(currentPreviewFrame.imageData, currentPreviewFrame.width, currentPreviewFrame.height, videoEngine.sparkleImage);

      dropzone.classList.add('hidden');
      stageLoaded.classList.remove('hidden');

      videoSrc.src = URL.createObjectURL(file);
      await new Promise(r => { videoSrc.onloadedmetadata = r; });

      applyAutoSettings();
      generateThumbnailStrip(file, videoSrc.duration);
      showToast('Video analyzed! Watermark locked on high-contrast frame.', 'success');
    } catch (err) {
      console.error(err);
      showToast('Error loading video: ' + (err.message || err), 'danger');
    }
  }

  dropzone.onclick = () => fileInput.click();
  dropzone.ondragover = (e) => { e.preventDefault(); dropzone.classList.add('drag-over'); };
  dropzone.ondragleave = () => dropzone.classList.remove('drag-over');
  dropzone.ondrop = (e) => {
    e.preventDefault();
    dropzone.classList.remove('drag-over');
    if (e.dataTransfer.files.length) handleVideoFile(e.dataTransfer.files[0]);
  };
  fileInput.onchange = (e) => {
    if (e.target.files.length) handleVideoFile(e.target.files[0]);
    fileInput.value = '';
  };

  btnReplace?.addEventListener('click', () => fileInput.click());

  // Process Full Video
  btnExport?.addEventListener('click', async () => {
    if (!currentFile || !videoEngine) return;
    try {
      handleExportAd();
      loadMonetagPopunder();

      if (videoSrc) videoSrc.pause();
      isPlaying = false;

      statusOverlay.classList.remove('hidden');
      if (progressBar) progressBar.style.width = '0%';
      if (progressText) progressText.textContent = '0%';

      const res = await videoEngine.process(currentFile, {
        ...currentSettings,
        onProgress: ({ progress }) => {
          const pct = Math.round(progress * 100);
          if (progressBar) progressBar.style.width = `${pct}%`;
          if (progressText) progressText.textContent = `Encoding ${pct}%`;
        }
      });

      statusOverlay.classList.add('hidden');

      const a = document.createElement('a');
      a.href = res.url;
      a.download = `unmark_${currentFile.name.replace(/\.[^/.]+$/, '')}.mp4`;
      document.body.appendChild(a);
      a.click();
      a.remove();

      showToast('Video watermark removed! Clean MP4 downloaded.', 'success');
    } catch (err) {
      console.error(err);
      statusOverlay.classList.add('hidden');
      showToast('Video processing failed: ' + (err.message || err), 'danger');
    }
  });
}

// ── 5. Batch Remover Controller ──
function initBatch() {
  const dropzone = document.getElementById('batch-dropzone');
  const folderInput = document.getElementById('batch-folder-input');
  const fileInput = document.getElementById('batch-file-input');
  const btnSelectFolder = document.getElementById('btn-select-batch-folder');
  const btnSelectZip = document.getElementById('btn-select-batch-zip');

  const statusCard = document.getElementById('batch-status-card');
  const summaryTotal = document.getElementById('batch-summary-total');
  const statCompleted = document.getElementById('batch-stat-completed');
  const statProcessing = document.getElementById('batch-stat-processing');
  const statFailed = document.getElementById('batch-stat-failed');
  const progressBar = document.getElementById('batch-progress-bar');
  const filesList = document.getElementById('batch-files-list');
  const btnBatchDownload = document.getElementById('btn-batch-download');
  const btnCleanAnother = document.getElementById('btn-batch-clean-another');

  const previewModal = document.getElementById('batch-preview-modal');
  const modalFilename = document.getElementById('modal-filename');
  const modalImg = document.getElementById('modal-img-preview');
  const modalVid = document.getElementById('modal-vid-preview');
  const btnModalClean = document.getElementById('btn-modal-show-clean');
  const btnModalOrig = document.getElementById('btn-modal-show-orig');
  const btnModalClose = document.getElementById('btn-modal-close');
  const btnModalCloseFooter = document.getElementById('btn-modal-close-footer');
  const btnModalDownload = document.getElementById('btn-modal-download');

  let activeModalItem = null;
  let batchPreset = 'auto';

  document.querySelectorAll('[data-batch-preset]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-batch-preset]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      batchPreset = btn.getAttribute('data-batch-preset') || 'auto';
    });
  });

  btnSelectFolder?.addEventListener('click', (e) => { e.stopPropagation(); folderInput?.click(); });
  btnSelectZip?.addEventListener('click', (e) => { e.stopPropagation(); fileInput?.click(); });

  folderInput?.addEventListener('change', (e) => {
    if (e.target.files.length) startBatchProcess(Array.from(e.target.files));
    folderInput.value = '';
  });
  fileInput?.addEventListener('change', (e) => {
    if (e.target.files.length) startBatchProcess(Array.from(e.target.files));
    fileInput.value = '';
  });

  dropzone?.addEventListener('click', (e) => {
    if (e.target.closest('button')) return;
    folderInput?.click();
  });
  dropzone?.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('drag-over'); });
  dropzone?.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
  dropzone?.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('drag-over');
    if (e.dataTransfer.files.length) startBatchProcess(Array.from(e.dataTransfer.files));
  });

  btnCleanAnother?.addEventListener('click', () => {
    statusCard?.classList.add('hidden');
    dropzone?.classList.remove('hidden');
    if (filesList) filesList.innerHTML = '';
  });

  function closeModal() {
    if (previewModal) previewModal.classList.add('hidden');
    if (modalVid) { modalVid.pause(); modalVid.src = ''; }
    activeModalItem = null;
  }
  btnModalClose?.addEventListener('click', closeModal);
  btnModalCloseFooter?.addEventListener('click', closeModal);

  btnModalClean?.addEventListener('click', () => {
    btnModalClean.classList.add('active');
    btnModalOrig.classList.remove('active');
    if (activeModalItem) {
      if (activeModalItem.isVideo) {
        modalVid.src = activeModalItem.cleanUrl;
      } else {
        modalImg.src = activeModalItem.cleanUrl;
      }
    }
  });

  btnModalOrig?.addEventListener('click', () => {
    btnModalOrig.classList.add('active');
    btnModalClean.classList.remove('active');
    if (activeModalItem) {
      if (activeModalItem.isVideo) {
        modalVid.src = activeModalItem.origUrl;
      } else {
        modalImg.src = activeModalItem.origUrl;
      }
    }
  });

  async function startBatchProcess(files) {
    if (!files || files.length === 0) return;

    dropzone?.classList.add('hidden');
    statusCard?.classList.remove('hidden');
    if (filesList) filesList.innerHTML = '';

    const isSingleZip = files.length === 1 && files[0].name.toLowerCase().endsWith('.zip');
    let fileQueue = files;

    if (isSingleZip && window.JSZip) {
      try {
        const zipData = await JSZip.loadAsync(files[0]);
        const entries = Object.keys(zipData.files);
        const extracted = [];
        for (const [path, entry] of Object.entries(zipData.files)) {
          if (entry.dir) continue;
          if (/\.(png|jpe?g|webp|mp4|webm|mov)$/i.test(path)) {
            const blob = await entry.async('blob');
            const fname = path.split('/').pop();
            const f = new File([blob], fname, { type: blob.type });
            Object.defineProperty(f, 'webkitRelativePath', { value: path });
            extracted.push(f);
          }
        }
        if (extracted.length > 0) fileQueue = extracted;
      } catch (err) {
        console.warn('Zip inspect error, processing direct:', err);
      }
    }

    const total = fileQueue.length;
    if (summaryTotal) summaryTotal.textContent = `${total} files`;
    let completed = 0;
    let failed = 0;

    const zip = new JSZip();

    if (!watermarkEngine) watermarkEngine = await WatermarkEngine.create();
    if (!videoEngine) videoEngine = await VideoWatermarkEngine.create();

    // Create table rows
    const rowMap = new Map();
    fileQueue.forEach((f, idx) => {
      const tr = document.createElement('tr');
      const isVid = /\.(mp4|mov|webm)$/i.test(f.name);
      tr.innerHTML = `
        <td><canvas width="48" height="48" style="border-radius: var(--r-xs); background: var(--bg-3); width: 48px; height: 48px; object-fit: cover;"></canvas></td>
        <td style="font-weight: 500; color: var(--text-1); max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${f.name}</td>
        <td><span class="queue-type">${isVid ? 'VIDEO' : 'IMAGE'}</span></td>
        <td class="num text-xs text-3">${(f.size / 1024 / 1024).toFixed(2)} MB</td>
        <td><span class="chip chip-neutral" id="status-chip-${idx}">Waiting</span></td>
        <td><button type="button" class="btn btn-ghost btn-sm hidden" id="btn-prev-${idx}">Preview</button></td>
      `;
      filesList.appendChild(tr);
      rowMap.set(idx, { tr, file: f, isVid });
    });

    // Process sequentially
    for (let i = 0; i < total; i++) {
      const { tr, file, isVid } = rowMap.get(i);
      const chip = tr.querySelector(`#status-chip-${i}`);
      const btnPrev = tr.querySelector(`#btn-prev-${i}`);
      const thumbCanvas = tr.querySelector('canvas');

      chip.className = 'chip chip-warning';
      chip.textContent = 'Processing...';
      if (statProcessing) statProcessing.textContent = `${total - i} pending`;

      try {
        let cleanBlob = null;
        let origUrl = URL.createObjectURL(file);
        let cleanUrl = null;

        if (isVid) {
          // Exact same Video Watermark Engine!
          const res = await videoEngine.process(file, {
            preset: batchPreset,
            gain: 0.6,
            offsetX: -24,
            offsetY: -24,
            sizeScale: 1
          });
          cleanBlob = res.blob;
          cleanUrl = res.url;
        } else {
          // Exact same Image Watermark Engine!
          const bmp = await createImageBitmap(file);
          const c = document.createElement('canvas');
          c.width = bmp.width;
          c.height = bmp.height;
          const cx = c.getContext('2d', { willReadFrequently: true });
          cx.drawImage(bmp, 0, 0);
          const imgData = cx.getImageData(0, 0, bmp.width, bmp.height);
          bmp.close();

          const activeBg = (Math.min(c.width, c.height) < 1000) ? watermarkEngine.bg48 : watermarkEngine.bg96;
          const detected = detectWatermarkCandidate(imgData, c.width, c.height, activeBg);
          const base = watermarkEngine.getWatermarkInfo(c.width, c.height);

          cleanFrame(activeBg, imgData, c.width, c.height, base, {
            gain: detected.gain,
            offsetX: detected.offsetX,
            offsetY: detected.offsetY,
            sizeScale: detected.sizeScale
          });

          cx.putImageData(imgData, 0, 0);
          cleanBlob = await new Promise(r => c.toBlob(r, 'image/png'));
          cleanUrl = URL.createObjectURL(cleanBlob);

          // Draw thumbnail
          thumbCanvas.getContext('2d').drawImage(c, 0, 0, 48, 48);
        }

        const outPath = file.webkitRelativePath || file.name;
        zip.file(outPath, cleanBlob);

        chip.className = 'chip chip-success';
        chip.textContent = 'Cleaned';
        completed++;
        if (statCompleted) statCompleted.textContent = `${completed} cleaned`;

        btnPrev.classList.remove('hidden');
        btnPrev.onclick = () => {
          activeModalItem = { name: file.name, origUrl, cleanUrl, isVideo: isVid };
          if (modalFilename) modalFilename.textContent = file.name;
          if (isVid) {
            modalImg.classList.add('hidden');
            modalVid.classList.remove('hidden');
            modalVid.src = cleanUrl;
          } else {
            modalVid.classList.add('hidden');
            modalImg.classList.remove('hidden');
            modalImg.src = cleanUrl;
          }
          if (btnModalDownload) {
            btnModalDownload.href = cleanUrl;
            btnModalDownload.download = `unmark_${file.name}`;
          }
          previewModal?.classList.remove('hidden');
        };

      } catch (err) {
        console.error(err);
        chip.className = 'chip chip-danger';
        chip.textContent = 'Failed';
        failed++;
        if (statFailed) statFailed.textContent = `${failed} failed`;
      }

      const pct = Math.round(((i + 1) / total) * 100);
      if (progressBar) progressBar.style.width = `${pct}%`;
    }

    if (statProcessing) statProcessing.textContent = '0 pending';

    // Generate ZIP
    try {
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const zipUrl = URL.createObjectURL(zipBlob);
      if (btnBatchDownload) {
        btnBatchDownload.href = zipUrl;
        btnBatchDownload.download = 'unmark_batch_cleaned.zip';
        btnBatchDownload.classList.remove('hidden');
      }
      showToast(`Batch completed: ${completed} files cleaned successfully!`, 'success');
    } catch (err) {
      console.error(err);
      showToast('Error generating ZIP: ' + err.message, 'danger');
    }
  }
}

// ── 6. Global Keyboard Shortcuts ──
function initShortcuts() {
  window.addEventListener('keydown', (e) => {
    // Avoid triggering when focused in an input
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;

    if (e.key === '1') {
      e.preventDefault();
      window.switchTab?.('image', true);
    } else if (e.key === '2') {
      e.preventDefault();
      window.switchTab?.('video', true);
    } else if (e.key === '3') {
      e.preventDefault();
      window.switchTab?.('batch', true);
    } else if (e.key === 'o' || e.key === 'O') {
      e.preventDefault();
      if (currentTab === 'image') document.getElementById('img-input')?.click();
      else if (currentTab === 'video') document.getElementById('video-input')?.click();
      else if (currentTab === 'batch') document.getElementById('batch-folder-input')?.click();
    } else if (e.key === ' ') {
      if (currentTab === 'video') {
        e.preventDefault();
        document.getElementById('btn-video-play')?.click();
      }
    } else if (e.key === ',') {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        document.getElementById('btn-open-settings')?.click();
      } else if (currentTab === 'video') {
        e.preventDefault();
        document.getElementById('btn-video-step-back')?.click();
      }
    } else if (e.key === '.') {
      if (currentTab === 'video') {
        e.preventDefault();
        document.getElementById('btn-video-step-forward')?.click();
      }
    } else if (e.key === 'z' || e.key === 'Z') {
      if (currentTab === 'image') {
        e.preventDefault();
        document.getElementById('btn-toggle-loupe')?.click();
      }
    } else if (e.key === 'c' || e.key === 'C') {
      if (currentTab === 'image') {
        e.preventDefault();
        document.getElementById('btn-toggle-split')?.click();
      }
    } else if (e.key === 'r' || e.key === 'R') {
      if (currentTab === 'image') {
        e.preventDefault();
        document.getElementById('btn-img-reset-sliders')?.click();
      } else if (currentTab === 'video') {
        e.preventDefault();
        document.getElementById('btn-video-reset-sliders')?.click();
      }
    } else if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
      e.preventDefault();
      if (currentTab === 'image') document.getElementById('btn-img-export')?.click();
      else if (currentTab === 'video') document.getElementById('btn-video-export')?.click();
      else if (currentTab === 'batch') document.getElementById('btn-batch-download')?.click();
    } else if (e.key === '?') {
      e.preventDefault();
      document.getElementById('btn-open-shortcuts')?.click();
    }
  });
}
