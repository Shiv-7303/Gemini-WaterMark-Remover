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
const BG_96_BASE64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAIAAABt+uBvAAAfrElEQVR4nJV9zXNc15Xf75zXIuBUjG45M7GyEahFTMhVMUEvhmQqGYJeRPTG1mokbUL5v5rsaM/CkjdDr4b2RqCnKga9iIHJwqCyMCgvbG/ibparBGjwzpnF+bjnvm7Q9isU2Hj93r3nno/f+bgfJOaZqg4EJfglSkSXMtLAKkRETKqqRMM4jmC1Z5hZVZEXEylUiYgAISKBf8sgiKoqDayqIkJEKBeRArh9++7BwcHn558/+8XRz//30cDDOI7WCxGBCYCIZL9EpKoKEKCqzFzpr09aCzZAb628DjAAggBin5UEBCPfuxcRiIpIG2+On8TuZ9Ot9eg+Pxt9+TkIIDBZL9lU/yLv7Czeeeedra2txWLxzv948KXtL9WxGWuS1HzRvlKAFDpKtm8yGMfRPmc7diVtRcA+8GEYGqMBEDEgIpcABKqkSiIMgYoIKQjCIACqojpmQ+v8IrUuRyVJ9pk2qY7Gpon0AIAAJoG+8Z/eaGQp9vb2UloCFRWI6igQJQWEmGbeCBGI7DMpjFpmBhPPBh/zbAATRCEKZSgn2UzEpGyM1iZCKEhBopzq54IiqGqaWw5VtXAkBl9V3dlUpG2iMD7Yncpcex7eIO/tfb3IDbu7u9kaFTv2Xpi1kMUAmJi5ERDWnZprJm/jomCohjJOlAsFATjJVcIwzFgZzNmKqIg29VNVIiW2RkLD1fGo2hoRQYhBAInAmBW/Z0SD9y9KCmJ9663dVB8o3n77bSJ7HUQ08EBEzMxGFyuxjyqErwLDt1FDpUzfBU6n2w6JYnRlrCCljpXMDFUEv9jZFhDoRAYo8jDwMBiVYcwAYI0Y7xuOAvW3KS0zM7NB5jAMwdPR/jSx77755ny+qGqytbV1/fr11Oscnph+a1PDqphErjnGqqp0eYfKlc1mIz4WdStxDWJms8+0IITdyeWoY2sXgHFalQBiEClctswOBETqPlEASXAdxzGG5L7JsA/A/q1bQDEkAoAbN27kDbN6/1FVHSFjNyS3LKLmW1nVbd9NHsRwxBCoYaKqmpyUREl65IYzKDmaVo1iO0aEccHeGUdXnIo4CB+cdpfmrfHA5eVlEXvzdNd3dxtF4V/39/cFKujIJSIaWMmdReqFjGO2ZpaCUGRXc1COvIIOhbNL3acCQDb2Es5YtIIBI3SUgZw7Ah1VBKpQmH0RlCAQ81noVd16UnKMpOBa93twRbvx9t5ivnC1MQ4Rwaxsd7eyu36wUQzkxDMxmd9Rl6uxyaU+du6/sEBERkMrUmSgY97DyGN7pwlc4UqUuq1q0Cgi6LlrHtY0yNQnv5qMZ/23iHexf/OmhXr5ajZycHC/oklqsT1BAYK1lxy/RtCUNphW0uDCZUdJP3UBCgAwmEYVoiEBmyBEauFJ0w4JnGdWSvCHJHK5TimY3BW5hUqNnoxpNkYiWuzM927sdWakjUfXd3cX83mMzBVcRaAGgo0wOA5YvGZdiMjo5sZEA4NLMK2SKAZpumZDViWMgBjgFoHXq0p7YpberAgA5iC0iMgF7r4fKX/nZDSmqvfu3attrne0f+tWCsmxdhhSlao/yp5SkZkpoj6dtN/rshANptFVfZgtsHAJSKYmREqkDNWxSYM5GjWvpIAoGIJIgkR1lPBrEQCqQiwzM91G+ACGYLHz+q39W5UlTkC5c/f2nWvXrjnQBLKk3WlkdqRQESIGKPwdjxp4Fw4XmaVYKKUQqKE+GEqw4COIIZHwYqkpqtpsLeJOs50ItFpgYoJJL1Dl74lEoobLChbqARiGYX9/XzHV3OzU/tza2rp7925VE44rlcJlTi2VqcplXWeQMfVTmg63Cak+UIIXVQXzbHAzjywnHhsQTtSkoapE3GJiu6Tpp/VYs1PjkcHBl+c7+/v7BKoaQ2SOCCDNb27fuX1t65qJmgYWBIIw0eDphRJM8lr426ROMABSQs3FwAB5EDMMM+ZZlXc+gprFQDnMm2salYFGdQEosU+2aFmuMdX+ybdM8kb3/YP788WihUONJiViTVgnbG9/6c7du0Q0ljCKIoJvFBY3VEU2USuQELdMkJhNhKZiGmlTY5CZTyZyImLGLlBNpRUikKmRB2/mHUM7Mj50iYWXcUMI6YmKBX47Ozs3b36jKg4oYgKFNUupWap3bt+Z7+xYDigiSiygcRyppNkM0lHM1ZICMjJUVCz4NtlbVcfZqgohHaEQwUgtlyoYJ9KKT6lKIpLp/LpbMV3wBKIm0OKZoaq/raOM/3qJgkQUEj44OLCRh4ynvjLU2f/c3tp68OBBakcx2FYkMDmJiNmIB3PULjT1j7ciQKnxXQ2UeBgYUHMzAEQvFSNYlYQwQFrEGVA1dE2IQERMAgMEYjCRDzPPKmX2+e0be/vfuBkKktgIoqaGwbMmmL29vTff3I1xewUqC0Cq5nOK6TFqrquqyqoOUi11hPnZsUV8FLHiQAxRRoG0asNExMNg+XdVv57TbQAWR4hLz6Dh0kJEVU0LB/BO6MJEObuakY2td3Hvfvfd7e1t6omMyAUAtBaOyxUm1hHfY5NbwBClC2Sg51qmYJANzx2JjtAxogZk7uspj3PNQx6DYCJmmmkEqESkKqZlKfaDeweL+VxrvFwGktwBoAnU4c4W88X9gwNS8TqBR+3+UGW4KQcR7GGyorcIhyKnETAzgxkDqZKKoZiqZNbUkm/K8K5wfRIUVAiotfcUiKpSqwB6Vqnq6PPVr3713r17zfLXL+rvR9ICdSC/ffvO7u51J52b+mdklLDNnNoRH/q6lUZoHmQjm2UmzUpGhElehIZ0fHE8F4XoQDOGFRXJ80e28iKrEmGQEYl/RMqzGZhFHC/mX955/72/s8jMR7+RR21U8bV9DA159913t7f/HdEAZVI2s4o40Avno14Gs9j9aY1CGth7nsjMEX+LYIQQKUcVqahAKkhyN0EhYajoUfMpLWpwf+/Ba7mDg4OD+c7CzCgUr5MwjCkGF9IqCl0pjTBfLL77ne8YiQ0uu8C6hdfVRWRMv24Wlo4F9Gg+Q0RliqMRMdjT1fWYfKxCmDcBj1kAWADmwAYmZfMCYFXC3x7cu7l/s3aSvxQgTutWr5umi4sPYWoAsHdj787f3CZS1bFiykAzCBGxjKo0jIFKqqPIZdR61GZZmBkggM39JdYyD9mmiLAqVDDhKFFXh88Xwr6iqoQWQVRWpg4CgOj169cP7h1URdCsKJKDVGOcexxMwoCJur3zzjtvvvlmEWpTZx3B/BplfBQSjVG0cC+RyzNEbSqGzPtIiSnQziom7AVgcJ+2mYoSaPAqTxbx3PGJVtS3Mtt8/vr7f/felWijUFFMHFpGiRWzC2Db9f7777/++rwW5y/FFEqho1uHKBMDnGhrHj39jE8ujqqqIMdsq4VZENfGU6UBQGS0e7XMXJ9J866/VTNphkB3dnYePny4tbVV360aMf1btUEzrX3f5+vb29sPH364mM9TZw1rndpWq3HK1wsAOQoeuijRO7Q2lUSQDlut7mPqbNZYp5KJyGZfqjVx5Htl1ghgnr8+//B7Hy4WiylrvK3yO3lAoLCyyENexdT54vXvffi9+Zd3krzWPCmjhoJUw+6cNVNVUlYlJcEwad7wNN8n8vpGIr/VSqg9AAf5Rk1KI8DbMkVsb29/+DC4c7U77741gK55WSIRNXY2ZbTocbH44IMPtra2mNnTV3fBha/FRyNYv0mp1+4ARAOriAXDSqIK5kEtrFQwD5k0O/sJsNS5xARtxYUCTPPXd95/7/2v/sc3oo/SNSHgxP5qk/QETy+d1sI4f4DQyiB5RwFguVz94B9+sFwumVkuPd2hCBpVRxXYDGiUotlm7pQ8MRAoiAY0F6SjqcXANjBVtaUtEQwrs8fvlgTGMwT48pc6Z5D8ev311x9++HA+n1OIpDGIHEpy6M6g6uJTa6x8BlKrqCO8WyffxrXVavXo0aPVapVZVap/zBrYSNtnJWmCV62fAZByA+nIGxiIUiBskYy7ZGtLCb5GoiS3KOoa3FkAJXGpHrrVEBUTPbcgsY83jF+K9dpspmz+13w+//Dhhzs7O4YGCYh1MqrhdLzV1i6VycUasvgaEcN80ybEjBUNHDBkDnxQ7bhjgsolI2+99dZ77723tbUVaw7Mhf8lFxUdydBR+/trPKJ4CsD5+fnHH398dnZm34dTK1ojwp57kJJHaomzFafYqoLD7Jqqyviv5iOTQV3oSMX02yxeV/S8fef2tx98GxvB7y+6NvJigkf9Y+Ytar+Hh4eHP3uao1ARtnRd1Tz1RschyGURREQDzVSViGeqHllVDVJV046CTVZAaBUr++e1115799139/b2/oIB/5nf+3dmlpFuxFfUMwW9ChyfHB8+fbparXzsANEACKACxxq7HD3JEk57nckKzRRrEOr0rk+o2qPsXPeyb/gvr5Ardnd3v/Pud82dV/q6QeJP8GjKkfyNeHddg9Y4st77arX64ccf/f73v4cID1CBxMIdtizMWSMI7xzYxMmBzFAasqShWdBd4uP2GoBr167dPzi4fefOnzvsyajSneczsAC8Wk7vuSjuqm7UoI3COPzZ039+eig2HUDwWg+8dgxEEkIWqDqDEJ6deDYQKcTr8LGMzCbsWwJBRKphVord3d3vfue788V8M3HNbVOSEXyJxyYMqhxZG2TXxeSP3g9ufHH1cvlPT56cnp5G+JmFSDe9EqmIGVchakDeyuds2seZyTyOl4AHkPOdnQcPvr1344ZFfH0E6ExxRhRV8BrN1CG194nR0qwW9BbDqdwpZjjVIwoaqvYRYKj0yeHy5UvYmuVSFOw6goeOnq/Nrr3WKo9j1ZqWyAhGAFuvbd+9e/f2ndvb29ubHA2Zs82eJpy6Mthr/KXmrjc/ENyZ3J+E6Y2hrsDEbfAnJ8efHD5dLpdMM1UFCW2EToB8RqPN0rj9ZyUo37y2de3u3Tt3bt/1GOcV+l+tqR+AM+iqd5uou/rQn8GgK9halcsTDn9/uVwdnxwf//JfVqsVD6gFE9iyX26RdHPtlkZYSgHAErSdxfyb3/zm7dt/s7W1vWlkV4/zFWpy1firt9qoTVfx6CpyOvPsX1aAcHJ8cnh4uFqtmFnkkpkrr+CxDDvuGu6kHu2++ebBwf3d67vxKLDuNeqw1z3OVfHeK4Zn6sCEUcG2WGYtpvuL4tA1oytNOGT/6lenJycnn356CkDEc4OEFwJ7+AdAFbu71/f29m7d2u9UpoYnVw3sFXrRkRufuupUfEFrjVwdBF3ZC2LsiKrAelSl3TvM/Ic//OHs7Ozk5P+enZ3lYigzMWxtbb99Y+/69et7e3tXmhKV1oMEb4XNvF2DpgBUjSX5EP62Mah5/U2hzSsYtNFsJ8C0Rnx8pUmMmkmKrlarFy/Onj9//tvf/na5XNKd/3rnwTsPGgUdCnh+0cF87SZ1ta2gaBR2JE/AuwsCE8ZfwQWahpT55JW2TNMQqQ6qNexfhKQ6Mf/0pz/lO7dbKFwmgaxbLVyaEFy7105lJhFyzyqvJKxHwGVSrNKdXXR8mejZ5FnP4LXeL2sl2jYDiqmaYE0Tvjnxe/fuzba3m02VMnCIND53I6qmUc1nSjQBWise6WiNYi39IZEh6JtyhLLmuHZV9TRnIvF6amqngGZPhgzkAiZE+wbJpIrPzy/48OnTJpM1BEAKk6b369gmH6+6GXpBU4doItA11KgtaNPojV2o1yK5GW8PfOtXgE+17q7jo6NnRAN/5Stf+ev/8Fdf//rXd3enm0omUeYr/Nhffl0BORT68oqoEuXVDS5s7ZWNnNoI4UrnFxfPT391dnZ2enp6cXER6yBdD8fd3es3b+6/9dZb8/l8I+VY49qfc00z1Y6u9ac3RxUdmmn/cG1yveUJg7Sgftw8Pz8/Pjk+PX3+4uw3sdRHPZImanXZTMG+duNrt27t3/jaXhJxZbmno6/knzUXWwvSYClSK25c4Yw6gIdepcSb4G/DY5PnCQDOzl4cPj08++zXICLL46XlsV6Trjuw/GJV1fmXF/fv379586bfs2nDnBhZj32ok0/mX5EuUoQejJgNmPJi3aP/ycG/ysSom0FC082Li4ufPzs6OTlZLpeAwFKuEcaNnA0lWxgdjQ0gYZBqrIwQArCzmO/v79+6ub9YLCpTYOFPDuwqkitY2AjDH13hl4IxtBbLKCZhgze6ITQl0HqmQoCen58/Ozo6Ojq6uDi3u5ZmCSmJTe359AQREc+GtqJFGSQQJfKikk2ejSrMvPPvv3z//v2b+zfTrVYoVcvjwoF0SlyVCx3FmxiU4fb6yHsG1cFr90wPN63li4vznx/9/Ojo6PKLL2SSmDIJKSuRwnbrkA9zKLPPZWrQ9gXaQit7wOrQO/Odb33rW9/4L9+oGjSpARGzqnS2UEOVdW5sMCKsffEnUKWZ/BXX6enzJz958vLlS1X1FQheWeS0GFtCZ3X3WIo5+KKY5stiupaI6opMz3GZANz4z1978ODBYrFoeUKfgmX9xW+/gkEbsXnCkbU7V3iM4v+K7qxWy398/Pizz36TrwwE9X3ABoheurcimRtXaJBnEiWf4GSQ1Wvd58XmGYQ23bt3r+1n2ui101w2lUr6Ofu+KDEpg1IkhH0jU/ZuigmPnh09fXp4fn6eKzU2XsoKUQjIdkBlyZVn4c/iVkxoxzrNXL9xOdb5eHvrjTfe+OCDDyp4b2SQm6F/bgtLu2pHA/5N0L0mgA0S6Rm0XC4f//jxixdnceNKBhGR2L567eaWYRoEoJ/0aK95Md+wRpQAHmw7kACggSG6WCwODg5u7u9vcM9XaRCF9+3jvaicYN15rcfWVzDIGz09ff74x48vLi4A9FseNzNLWZNB1KHqAIqDSMLq6mDK/pmOr6Q2ly+qqsMw/Le//e8H9w4azYRalNow9+AimUxaxCsVa9KR2/Kq0Pe4vcYz4MmTJ89+8YtCrU4MPKew2h0SU6QEk4yk850oWnmtk0EEjHmmi/VRS/q5CMaM8vr16++/957PeRBitdhVCzNcI7qAux+nZ4/UsQxTEXZQdH5+/tGPPn7x4oWq5GxwQQ+NhWXJoDjxhe2Ui6G0HBPWRCTSlpo7BCkTs+olgG4e0rkZGsfJaVLVxWLx8H8+XMznyEmFcCydEoW+ELKy8cqSGLCBy0hccxnYEqHly1UObxPuCMfydj91Bc2LDTSrs/CqI2EGYFMtmOx+S2VhSUZZ4u9QLQS2A1QEwM7O3BffrYWF6YIzBdkQ2uGK53WNWzViUl2ulo++/2i5XKLUQNOOTIQiYqbEakstxRb2JINIbXkU5wrGXGmPbAgZJdcVMOl3y0Ly/M3lWJ9VEkrTMJ84Qu0WW1MutfBV7dO3+ue7y5RTAf3d73//6PuPVqsl+c4aSiKnjdTRZgUvky3/t+zUj09TmjBFNcc5W31suyL8RCHKw3B8N81yufz7//X3v/vd79aGWWq36zqbVW2DHu0fs5ps7GktjdByufqHH/zgjy//qLEsNVdC2+4dKqXV2oCtb23jL1LPq+UZlUrPRAqDc7N0ZVY04SqtfpKJEuHi4vyjH320XC2nbGj+qTXXfdW7+ahBxsq9CMqT0cvl8tH3H33++YWI5BkYuTbQ9rvVrQGq+SFsIltTtYAmFwnDViSWJasEMCnn+o/c/7O+oc46U4UgVGno9GK1XD569Gi5XPYimVgdHGK1vFt4qCV8d0ii6JuwXK3MnAVj2TuWg9dRR49gYhE086BKNVMloE1Lw/fca9jWZJ10YAqocrrpZ2RYkQAUi7EZ2u78L1qtlo8ePfr88/PKlLoDeO3qgc9/ty4pC+SE8/PzR99/9PLly/SheS5FwWYQkc2419XubaRxpd1pH0O0fQwASGEnvqgqg9HtAnEzti0yOQoiUoIyUZyhkZdt0lwtlx9/9BEZpqjz28ZNayq5XpmncFXFLJxzH/3wRy9Xf6y8HmjI0AwA0WDrEicupfQ2ilzqeGknGZF6WFwpKkd0qdoJQxOZNlQKh1/QqY1wcpiGxoJGIrx4cfbkyZP1Nifkls/Ni657Hvv+8PDwsxcv1llsM+vWRJtij73y651edeUzTCozbh5RMAqUZ4PtpFcdY3NGxKDEqcLKUKaBZmzbHdqPeZA2tl8cPXt+ejrhjmqBmG5uVpsfy3XVoYBQHP/yl08PnyLO74PFYoCq2lqvcpnDFekPb/SKDw2qJJ1c/SQT1VFVBlsK3JxixIe2/WCC9iJQ6jCrEqL98QLsx9IN7tmZ/vHx4+VyOZGSa3QN+Vro539NnOZqtfrZz35GsRLOVDt3E0a/1K3QoC4di3NrbPd4t0esrSVXEEFE2OM7AdFA4ExG1NYMeZ1ogLRtjxZIqCorsfp+USJqG/YNgFiVxM4bEugXX3zx+PHjwh7TIMkAoxO8OlxXL2aG98OPP1q+XNnhlVHbU8VIZPu8eojlmalJ4qwL2z2vY/BAea7MyGz5w8DMEWUrQCSxtb1qR9TSNFfJUnDHuCCSu+3HtSCgk7wSPvvss2fPnrW/C+iU9xqUhsdsPvjw6WGNP3PxYI58EkOPl7a6su2P7i9XpWyHSlo7jgrf9MJ22EoXCnpQBLYzUbrWc9QM2DlDMqqVckQYHnl5A/aGuK89PDy06JGyJOQA07kYNbCpnRKtVsunh/88EA/E0QsZPtr+2BybBXuqo51t1vsZCtJtpKNvs40f5pkveGYCD75OkcrG4Xq5JKk75mEiCe9U1SBIPaPoQIqIbLnkxcXF4x//GBQ1HXRtBkpXvrTf//Tkie10HscxZ2JUDZvrTrHkVAviaqSS4p1koFouS/dlHNk2/ChBMJop+k876ETJjpKFxQm2J3qwmDsxi5RFkpUAQCqx9wgqlyFJefHrs+enzwGN0zO7ALlX0XYdnxx/+umnNEQXwyw5q6o0wE5wycsLOHYOCakhDhHleYl+PlnQ7D9gUX/G9rt2WpMMrla9LoHq3aoEXC6bAmWeDRqbEYnoyZMn5+clvHY3EcoySU0IAA4/+aSBURwYpKWGV0liP/CttNLTHF4vM7/UJQGVPd0A2zG/REqkdi6inT4QN4nIj5AzjTBtyvOk1eq4QhAdiAEWOy3DXBwx+dFhY+44U8Ly5erZs6OOhZG71KSMfFETjk9OVqs/QuPssHIsj/q2d/LN3d6bbXGiyBNINY7osfMa1N8gZtsCh/YT3AQrnNNpqE2iVV9SPnX/Uy1RZ0K/rlP+LkesF/WaOvNL7Jm69vhj7S2Xq6dPn5psiwV1dfjCL53NZgapWYGwr7rTZXoie4WX2jjXpzUOJwzAUyUZ9dJ0x2S1TpOI5L4FirMw86AuWPBZKl7G988vzn9+dGQG1ZG9hkLHx79cLv+/siprFKFaO86XEYhzPBKnS17aVMPxxVro9mQ0r+L+SkeCdBhERDU7GwbWmKrLYwZrpBCPDQlSE1fIE9nUkA84enbUIdHkCh6d/Mux1vSvBPf5mW2XUwQ1Odqr9LoqeK24Z+SVLbTxiHSFIiWMowBkx1dmKXNUyd0L1p4hgB/22icc4eDayKwr1ZGBL87PjwyJJl6rGNrxyfFqtWImUmYvALIhZh9JiOrY7acFkba9uDl7wxgMNEnZbFbgAbMQyI9pkIx789gYSz1aME7M5Afx+AL9DZYfR12lrDJCSe5svPKb4+NjoAt2Jn8eHh5WfcmcK1WDqK3+Sl02SiZHLayTRJlzAwrGpm85lMrYDFX4nP5ovPAT4jTP/kIjCAZAZZ6kqnRV2u6ID3CcKc4vly9fnL3oyon+Mgg4PT19+XIVMS6SNZE65MYJrsgdWqyqY0bYSR5EGWTxkZNqft1nt9rJs65B9kdh9rQqmNdEbtXOq21TXwN2ppe0oz4J4JNPPuk1p0XVx8fH6TRblWf0//7AQJB51o7RXkvNxnL8Y3XKG7V7ctOMI3IQ0ZhBHcAzRVffWX/Z74jmUXTrWFjY5xFtHMLWziFSwovffHZ+cR4ZmbMGhOVydfr/Ts1DEClIBaPIZZFfqFU4xzykzjggInZOq/HOUQk6qV4nUJLC4MlwygWAUB8ugOLlPO6CgGwxFSo9yEQyhcrW/bpw0iKOT46zn+AQXrx4kTcA+LKuiVeMRLQ5nYghM5LOqvNGEebYs5HJk8FysjMiRxHBCBKCHUQIAH7y+ERFs3UpR20nFjYbDIBnxH9+ArZKQtJ6evo8JZpx0Mnx/4Hk+fmceUGG4wz1gmHQlrGPqsLOktI4KiKQiJllHHWU/CFVHS8l0heL4DJA4RSy/VscZ5V2A51kSnLBGjUFro4jPgAS/jGqSxM3d3Z2dn5+UaeqV6vl2dlZfdi/KuR5Hk1NHimk6jqqXsOKpakvDg5O8ETq4cVKZEl21LglbDqa9O0ANCOl7vSdzWZZu0SEHhmJ+JKPPINXAIniKwXeNBPW0+e/qkHlr399FosuOs/o+Q3Zrv8WYRANFHBhg7RgbRgGK/INQwisnAOJQC6jqtkBtUUZXcmiqFLnsCYHu6U2orr52NTpZxFwpyP5n3mkVKuSEuHs12f1zumnz52zExQzhBRHfrMA0qYmteWkTbU7T7o9Foe4V12bqN5MR2Do4y772ghXVgiYRUfyVRCggWNWgDRiVq0g2tkp217+MtfsJ+ygDOn09LQG0L/77W+pLSrxBIIpAMGgnAReEgUgtovFqLLsUMNSfAkCQ3IFK1GS6px3LhtIj83iiHydXWVt8wHBzDijwqcE8j9eco+WI1ZLm6zM7RP2Whxfrzit34svzn/ykyfLPyzPz8+f/OTJ6uVLNLrF9qsbd2owXSWan6U73q47YXrioeqVEF4fBvBvwZvfB2giLLAAAAAASUVORK5CYII=";

// ── 2. WatermarkEngine Class ──
const BG_VEO_72_BASE64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEgAAABICAAAAABwhuybAAAFIElEQVR4nK2X+1NTRxTHz9m9yb0hhgQIIJSn5Vnjg6roOFWxU58/9YdO/9A67dBWR22dgfqY2hYHRxgeAkYSgQRMcnMfu53dJErgPgJhhxmSzbmf/Z6z55zdC+A/zn9bgxHxM0BovT0WPRLQFxvZniMAMRguWiNHAAIYeZ8dOgrQsJX7ED5xBKAracNevVM/qHlgJhCe7+6qC0QB4IcXWijI3typC2QD9EY3iaKQ1Wi0Tte+WWSaamps7fahQYgAMBTdUFkRTFzvidal6OqHkLBAILnr3ubeoIvqx7IZvh9KyDz3BQlHqgcH7XSKyw9AMb15Bp2s/BVxgLtGJlBZp3mp4Uc56QfaZ4Iw1pBSzPI80XG1/TQQggdXNHhuwwar8iAJ2slrDYwdYvu/y+gUlE/6KG7l7ro75w66i5kgYZ89MQlZa51wjbcziABc7VsCyj7/jMiAr58aB06xdhCDi2eWgfKqRwhiLnnqLNiO3lVisGcMXVos7vuJcsgb56wZNydKyqtmR7/f0lVKUNZbZch8LGYnzjuCKstWyR28/W4lzAFwjxMIQLfYuDLtAHIK3MT5pUzYctlnbh+Lr/1mOi2yZ4Rv9c8XiEeZF5Xj9mTKV9Ho5YaFnBJiLoIQ0CZ6W/PTZy4gSg3xT706tpYkGETXhoFoEw7BpvxPhaogVitKXG58sx0IiL10BQFHDkRpJw/euLnWPd6xnWQqscRWeoOQmy2R1FTKCdR5J5Zf3gkTRMI8QSBzJZAJtTWmJ7OfPC5/6LsRzS1bHCliqTDcW5gcHBi3oKMn/WBRfC0/RMYuxRY2dUpEMkNNIBC/2zppGV5+JmOF0J0YiHxYz1CiWuJkrRUEwkop6EpnL3n9at7Aazc3kmsFjWiKjHHVil4UjgCKwQhum20tSv+ioprpDFcbCHLKZMREjfmpAS7/DOAWCRe29PZCGuHEyUHMbm6BOC/KPauyM54oBAALSSQUIWxx5V/55PGzJ/E/LgQhrRkEAMxUIz2Z2RmRA0gUURvaldNmNs0ZHAhktMWKf86VnJCKUEwnLkSSWaBiSsj2AqHocGagNb7515xTifReUfNZTsEU2+cJYozkO9pS00ui/3JpWr1B577SVk0qQ+6tyDAG+fQreSLwUjGVQcI5agMEL325sxMo3xzcw2PG4u8mjT3wPWPghpnEkloXORbXh9Tfq3qIY6s9drNrWWeq6yGPRTLw9vHOvum9E9SGC19vFJC7OIdFtXP1vgmy13gqokoxcS2Zd+v+RrjrnydOCzhaJyZS2wEmq4DvzmRQzPbY/VlHpc7rdt/a1E119+5xsdcFGo/fW9p/crpdIgisPGgJBopVk0zAYk33lyDoFD5HEA/C4lSXpolq4bvmLa3j6SwEqxPIE2QRmHnebwPnWMmpADBmDr9+LrpQzSBgQGB6tk9WJ5bCaBJgifmHjubuIHkY/bLTiLvu4aRwfOuReVCQJD1qIZVbLOe21Rr/dV8++4NEYqwsjxqlAHFg1O5/lnbneL+L3Eu35ioCC0PvnBLaFySbJn/YWX6F4Lw5dA8OAZKpi7DwtrdEReh8vnMYkAwNB/gjYsnvTLGnPDneMUJIv23UAdC2+2aNOkBA4UlM3NGsJu0x1AHiHNaJZnEbmt+zOkDi5IWXIzaxlI6ffTg+rnGOL4x4nrUvZOsDifv5yzbk3X9DPaDSGfqC2iFzoS5QaRQyga6PhSMAwWpTfN7fqgaQHtKcX9EOCprjyaS/1f+t3/5S/oYyHAAAAABJRU5ErkJggg==";

class WatermarkEngine {
  constructor(bg48, bg96, bgVeo72) {
    this.bg48 = bg48;
    this.bg96 = bg96;
    this.bgVeo72 = bgVeo72;
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
      const [bg48, bg96, bgVeo72] = await Promise.all([
        loadImage(BG_48_BASE64),
        loadImage(BG_96_BASE64),
        loadImage(BG_VEO_72_BASE64).catch(err => {
          console.warn("Veo 72 template failed to load, falling back to bg96", err);
          return null;
        })
      ]);
      return new WatermarkEngine(bg48, bg96, bgVeo72);
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
    return this.engine.bgVeo72 || this.engine.bg96;
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
    const bg = opts.template || this.sparkleImage;
    return cleanFrame(bg, fullImageData, width, height, base, {
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
    const templateImg = opts.template || this.sparkleImage;
    const alpha = buildAlpha(templateImg, roi, wm, gain);
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
var currentTab = 'image';
var watermarkEngine = null;
var videoEngine = null;

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

function detectWatermarkCandidate(imageData, width, height, engineOrBg) {
  const minDim = Math.min(width, height);
  const baseRatio = minDim / 1536;
  const base = getWatermarkInfo(width, height);

  const bg48 = (engineOrBg && engineOrBg.bg48) ? engineOrBg.bg48 : ((engineOrBg && engineOrBg.width <= 48) ? engineOrBg : (window.watermarkEngine?.bg48 || engineOrBg));
  const bg96 = (engineOrBg && engineOrBg.bg96) ? engineOrBg.bg96 : ((engineOrBg && engineOrBg.width > 48) ? engineOrBg : (window.watermarkEngine?.bg96 || engineOrBg));
  const getTmplForSize = (s) => (s <= 64 ? bg48 : bg96);

  // Candidate Layout Families with Bayesian Priors:
  // Both 48px and 96px families are evaluated across all resolutions to support
  // full-res individual images, multi-panel storyboards, and video stills.
  const layoutFamilies = [
    // 1. Calibrated 48px Anchors (Standard video, storyboard panels, small/medium frames)
    {
      presetKey: 'classic',
      name: 'Calibrated Anchor (73px margin, 48px)',
      baseSize: 48,
      calcPos: (s) => ({
        x: Math.max(0, width - 73 - s),
        y: Math.max(0, height - 73 - s)
      }),
      gain: 0.6,
      prior: 2.1
    },
    {
      presetKey: 'classic',
      name: 'Corner Anchor (64px margin, 48px)',
      baseSize: 48,
      calcPos: (s) => ({
        x: Math.max(0, width - 64 - s),
        y: Math.max(0, height - 64 - s)
      }),
      gain: 0.6,
      prior: 2.05
    },
    {
      presetKey: 'new',
      name: 'Storyboard Panel (Inset, 48px)',
      baseSize: 48,
      calcPos: (s) => ({
        x: Math.max(0, width - 88 - s),
        y: Math.max(0, height - 88 - s)
      }),
      gain: 0.6,
      prior: 1.95
    },

    // 2. Calibrated 96px Anchors (Full-res single images 2K/4K/standard Gemini)
    {
      presetKey: 'classic',
      name: 'Calibrated Anchor (64px margin, 96px)',
      baseSize: 96,
      calcPos: (s) => ({
        x: Math.max(0, width - 64 - s),
        y: Math.max(0, height - 64 - s)
      }),
      gain: 1.0,
      prior: 2.0
    },
    {
      presetKey: 'new',
      name: 'Gemini & Nano Banana (Fixed 96px Inset)',
      baseSize: 96,
      calcPos: (s) => {
        const m = minDim >= 1400 ? 192 : Math.round(128 * Math.max(0.5, minDim / 1024));
        return { x: Math.max(0, width - m - s), y: Math.max(0, height - m - s) };
      },
      gain: 0.6,
      prior: 1.85
    },

    // 3. Adaptive Inset (12.5% Inset)
    {
      presetKey: 'new',
      name: 'Gemini Adaptive Inset',
      baseSize: base.size,
      calcPos: (s) => {
        const m = Math.max(8, Math.round(192 * baseRatio));
        return { x: Math.max(0, width - m - s), y: Math.max(0, height - m - s) };
      },
      gain: 0.6,
      prior: 1.15
    },

    // 4. Classic Corner Adaptive
    {
      presetKey: 'classic',
      name: 'Classic Corner Adaptive',
      baseSize: base.size,
      calcPos: (s) => {
        const m = Math.max(8, Math.round(64 * baseRatio));
        return { x: Math.max(0, width - m - s), y: Math.max(0, height - m - s) };
      },
      gain: 1.0,
      prior: 1.10
    }
  ];

  // Discrete multi-scale test (canonical 1.00x native, plus slight 0.90x and 1.10x tolerance)
  const scalePyramid = [1.00, 0.90, 1.10];

  let bestMatch = null;
  let bestScore = -1;

  for (const layout of layoutFamilies) {
    for (const scale of scalePyramid) {
      const s = Math.max(16, Math.min(Math.round(layout.baseSize * scale), Math.min(width, height) - 8));
      const pos = layout.calcPos(s);
      const tmpl = getTmplForSize(s);
      const { score, variance } = evaluateCandidateMatch(imageData, width, height, tmpl, { x: pos.x, y: pos.y, size: s });
      if (variance < 1.5) continue; // reject only completely blank zero-variance areas
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

  // Full Quadrant Scan across bottom-right (catches arbitrary insets, widescreen ratios, crops, storyboards)
  const scanMinX = Math.max(0, Math.round(width * 0.65));
  const scanMinY = Math.max(0, Math.round(height * 0.68));
  const scanSizes = [48, 96];
  if (base.size !== 48 && base.size !== 96) scanSizes.push(base.size);
  const uniqueScanSizes = [...new Set(scanSizes)].map(s => Math.max(16, Math.min(s, Math.min(width, height) - 8)));
  const gridStep = 16;

  for (const s of uniqueScanSizes) {
    const tmpl = getTmplForSize(s);
    for (let sy = scanMinY; sy <= height - s - 4; sy += gridStep) {
      for (let sx = scanMinX; sx <= width - s - 4; sx += gridStep) {
        const { score, variance } = evaluateCandidateMatch(imageData, width, height, tmpl, { x: sx, y: sy, size: s });
        if (variance < 1.5) continue;
        if (score > bestScore) {
          bestScore = score;
          const matchingLayout = layoutFamilies.find(l => l.baseSize === s) || layoutFamilies[0];
          bestMatch = {
            layout: matchingLayout,
            size: s,
            scale: 1.0,
            x: sx,
            y: sy,
            score
          };
        }
      }
    }
  }

  // Refinement: Joint 2D Position (±16px) fine-tuning
  if (bestMatch && bestMatch.score > 0.05) {
    let refinedX = bestMatch.x;
    let refinedY = bestMatch.y;
    let refinedSize = bestMatch.size;
    let refinedScore = bestMatch.score;

    const tmpl = getTmplForSize(refinedSize);

    for (let dy = -16; dy <= 16; dy += 2) {
      for (let dx = -16; dx <= 16; dx += 2) {
        const testX = Math.max(0, Math.min(width - refinedSize, bestMatch.x + dx));
        const testY = Math.max(0, Math.min(height - refinedSize, bestMatch.y + dy));
        const { score, variance } = evaluateCandidateMatch(imageData, width, height, tmpl, { x: testX, y: testY, size: refinedSize });
        if (variance < 1.5) continue;
        const weightedScore = score * (bestMatch.layout.prior || 1.0);

        if (weightedScore > refinedScore) {
          refinedScore = weightedScore;
          refinedX = testX;
          refinedY = testY;
        }
      }
    }

    const calculatedScale = Math.round((refinedSize / bestMatch.layout.baseSize) * 100) / 100;
    const optimalGain = findOptimalGainJs(imageData, width, height, refinedX, refinedY, refinedSize, tmpl);
    const basePos = bestMatch.layout.calcPos(bestMatch.layout.baseSize);

    return {
      matchFound: refinedScore >= 0.10,
      score: Math.min(1.0, refinedScore),
      presetKey: bestMatch.layout.presetKey,
      name: `${bestMatch.layout.name} (${refinedSize}px, ${optimalGain.toFixed(2)}x)`,
      baseSize: bestMatch.layout.baseSize,
      baseX: basePos.x,
      baseY: basePos.y,
      x: refinedX,
      y: refinedY,
      offsetX: refinedX - basePos.x,
      offsetY: refinedY - basePos.y,
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
    baseSize: base.size,
    baseX: base.x,
    baseY: base.y,
    x: base.x + fallbackOffset,
    y: base.y + fallbackOffset,
    offsetX: fallbackOffset,
    offsetY: fallbackOffset,
    sizeScale: 1.0,
    gain: 0.6,
  };
}

function detectVideoWatermarkCandidate(imageData, width, height, engineOrBg) {
  const baseDim = Math.min(width, height);
  const veoBase = {
    size: Math.max(24, Math.min(Math.round(baseDim / 15), baseDim)),
    margin: Math.round(baseDim / 10),
  };

  const bgVeo = (engineOrBg && engineOrBg.bgVeo72) ? engineOrBg.bgVeo72 : ((engineOrBg && engineOrBg.width) ? engineOrBg : (window.watermarkEngine?.bgVeo72 || engineOrBg));
  const bg96 = (engineOrBg && engineOrBg.bg96) ? engineOrBg.bg96 : (window.watermarkEngine?.bg96 || bgVeo);

  const layoutFamilies = [
    // 1. Gemini Omni & Google Flow Adaptive Inset (Dual-layer Veo video profile)
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
      template: bgVeo,
      gain: 1.0,
      prior: 1.15
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
      template: bgVeo,
      gain: 1.0,
      prior: 1.05
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
      template: bg96,
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
      const { score } = evaluateCandidateMatch(imageData, width, height, layout.template, { x: pos.x, y: pos.y, size: s });
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
          const { score } = evaluateCandidateMatch(imageData, width, height, bestMatch.layout.template, { x: testX, y: testY, size: testSize });
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
      presetKey: bestMatch.layout.presetKey,
      name: `${bestMatch.layout.name} (${refinedSize}px)`,
      baseSize: bestMatch.layout.baseSize,
      baseX: baseX,
      baseY: baseY,
      x: refinedX,
      y: refinedY,
      offsetX: refinedX - baseX,
      offsetY: refinedY - baseY,
      sizeScale: Math.max(0.5, Math.min(2.5, calculatedScale)),
      gain: bestMatch.layout.gain !== undefined ? bestMatch.layout.gain : 1.0,
      template: bestMatch.layout.template
    };
  }

  const fallbackOffset = Math.round(-24 * (baseDim / 720));
  return {
    matchFound: false,
    score: bestScore > 0 ? bestScore : 0,
    presetKey: 'veo',
    name: 'Gemini Omni & Google Flow (Adaptive Inset)',
    baseSize: veoBase.size,
    baseX: baseX,
    baseY: baseY,
    x: baseX + fallbackOffset,
    y: baseY + fallbackOffset,
    offsetX: fallbackOffset,
    offsetY: fallbackOffset,
    sizeScale: 1.0,
    gain: 1.0,
    template: bgVeo
  };
}




// ═════════════════════════════════════════════════════════════════════════
// UNMARK — UI Design Specification v2 Controller (Light, Colorful, Alive)
// Full-Featured Implementation: Dissolve, Compare, Loupe, Video, Batch, ZIP
// ═════════════════════════════════════════════════════════════════════════

(function () {
  'use strict';

  // Global Engine & State
  var watermarkEngine = null;
  var videoEngine = null;
  var currentTab = 'image';

  var currentImageFile = null;
  var imageSessionFiles = [];
  var activeImageIndex = 0;
  var currentCandidate = null;

  // Video State
  var currentVideoFile = null;
  var videoElement = null;
  var videoDuration = 0;
  var videoFps = 24;
  var videoPlaying = false;
  var videoSpeed = 1.0;
  var videoCandidate = null;
  var isCleaningVideo = false;
  var lastCompletedVideoBlob = null;

  // Batch State
  var batchQueue = [];
  var batchRunning = false;
  var batchPaused = false;
  var batchActiveCount = 0;

  // UI Interactive State
  var comparePos = 50;
  var compareMode = 'slider';
  var isDraggingCompare = false;
  var loupeActive = false;
  var holdingOriginal = false;
  var undoStack = [];

  // Settings
  var appSettings = {
    outputFormat: 'png',
    suffix: '_cleaned',
    concurrency: 2,
    checkAllCorners: false,
    engine: 'browser'
  };

  const DISSOLVE_COLORS = ['#0f172a', '#2563eb', '#38bdf8', '#10b981', '#f59e0b'];

  // DOM Cache
  const app = document.getElementById('app');
  const landingHero = document.getElementById('landing-hero');
  const dropzone = document.getElementById('dropzone');
  const demoShowcase = document.getElementById('demo-showcase');
  const dropTitle = document.getElementById('drop-title');
  const dropSub = document.getElementById('drop-sub');
  const chooseImgBtn = document.getElementById('choose-img-btn');
  const chooseVideoBtn = document.getElementById('choose-video-btn');
  const batchEmptyBtns = document.getElementById('batch-empty-btns');

  // Hidden Inputs
  const imageInput = document.getElementById('image-input');
  const videoInput = document.getElementById('video-input');
  const batchFileInput = document.getElementById('batch-file-input');
  const batchFolderInput = document.getElementById('batch-folder-input');
  const batchZipInput = document.getElementById('batch-zip-input');

  // Workspaces
  const viewImage = document.getElementById('view-image');
  const viewVideo = document.getElementById('view-video');
  const viewBatch = document.getElementById('view-batch');

  // Tabs
  const tabImage = document.getElementById('tab-image');
  const tabVideo = document.getElementById('tab-video');
  const tabBatch = document.getElementById('tab-batch');
  const tabsContainer = document.querySelector('.tabs');

  // Canvases
  const canvasClean = document.getElementById('canvas-clean');
  const canvasOrig = document.getElementById('canvas-orig');
  const canvasSideOrig = document.getElementById('canvas-side-orig');
  const canvasSideClean = document.getElementById('canvas-side-clean');
  const canvasFlip = document.getElementById('canvas-flip');
  const flipBadge = document.getElementById('flip-badge');

  // Compare & Loupe
  const compareBox = document.getElementById('compare-box');
  const compareLine = document.getElementById('compare-line');
  const sideBySideBox = document.getElementById('side-by-side-box');
  const flipBox = document.getElementById('flip-box');
  const imageLoupe = document.getElementById('image-loupe');
  const loupeCanvas = document.getElementById('loupe-canvas');
  const particlesLayer = document.getElementById('particles-layer');

  // Sliders & Steppers
  const sliderImgGain = document.getElementById('slider-img-gain');
  const sliderImgScale = document.getElementById('slider-img-scale');
  const lblImgGain = document.getElementById('lbl-img-gain');
  const lblImgScale = document.getElementById('lbl-img-scale');
  const lblImgX = document.getElementById('lbl-img-x');
  const lblImgY = document.getElementById('lbl-img-y');
  const btnImgUndo = document.getElementById('btn-img-undo');
  const btnImgReset = document.getElementById('btn-img-reset');

  // Result & Ring
  const resultTitle = document.getElementById('result-title');
  const ringFillImg = document.getElementById('ring-fill-img');
  const ringTextImg = document.getElementById('ring-text-img');
  const lblMetaDims = document.getElementById('lbl-meta-dims');
  const lblMetaFormat = document.getElementById('lbl-meta-format');
  const lblMetaSize = document.getElementById('lbl-meta-size');

  // Presets & Corner Toggle
  const presetExpanderBtn = document.getElementById('preset-expander-btn');
  const presetListBox = document.getElementById('preset-list-box');
  const lblCurrentPreset = document.getElementById('lbl-current-preset');
  const toggleCornersRow = document.getElementById('toggle-corners-row');
  const toggleCorners = document.getElementById('toggle-corners');

  // Image Actions
  const btnImgDownload = document.getElementById('btn-img-download');
  const btnImgDownloadText = document.getElementById('btn-img-download-text');
  const btnImgCopy = document.getElementById('btn-img-copy');
  const btnImgCopyText = document.getElementById('btn-img-copy-text');
  const filmstripList = document.getElementById('filmstrip-list');
  const filmAddTile = document.getElementById('film-add-tile');

  // Video View Elements
  const videoCanvasPreview = document.getElementById('video-canvas-preview');
  const btnVideoPlay = document.getElementById('btn-video-play');
  const playIcon = document.getElementById('play-icon');
  const videoTimeReadout = document.getElementById('video-time-readout');
  const btnFramePrev = document.getElementById('btn-frame-prev');
  const btnFrameNext = document.getElementById('btn-frame-next');
  const btnSpeedToggle = document.getElementById('btn-speed-toggle');
  const videoTimeline = document.getElementById('video-timeline');
  const videoTimelinePlayed = document.getElementById('video-timeline-played');
  const videoTimelineThumb = document.getElementById('video-timeline-thumb');
  const videoFrameStrip = document.getElementById('video-frame-strip');
  const videoFilename = document.getElementById('video-filename');
  const lblVideoDims = document.getElementById('lbl-video-dims');
  const lblVideoDur = document.getElementById('lbl-video-dur');
  const lblVideoFps = document.getElementById('lbl-video-fps');
  const vStep1 = document.getElementById('v-step-1');
  const vStep2 = document.getElementById('v-step-2');
  const vStep3 = document.getElementById('v-step-3');
  const vStep1Desc = document.getElementById('v-step-1-desc');
  const vStep2Desc = document.getElementById('v-step-2-desc');
  const btnVideoClean = document.getElementById('btn-video-clean');
  const videoProcessingCard = document.getElementById('video-processing-card');
  const videoProcPct = document.getElementById('video-proc-pct');
  const videoProcBar = document.getElementById('video-proc-bar');
  const videoProcFrames = document.getElementById('video-proc-frames');
  const videoProcEta = document.getElementById('video-proc-eta');
  const btnVideoCancel = document.getElementById('btn-video-cancel');
  const videoCompleteCard = document.getElementById('video-complete-card');
  const btnVideoDownload = document.getElementById('btn-video-download');
  const videoOutputSize = document.getElementById('video-output-size');

  // Batch View Elements
  const bentoTotal = document.getElementById('bento-total');
  const bentoCleaned = document.getElementById('bento-cleaned');
  const bentoLook = document.getElementById('bento-look');
  const bentoWaiting = document.getElementById('bento-waiting');
  const batchOverallBar = document.getElementById('batch-overall-bar');
  const batchAddMoreBtn = document.getElementById('batch-add-more-btn');
  const batchClearBtn = document.getElementById('batch-clear-btn');
  const batchStartBtn = document.getElementById('batch-start-btn');
  const batchZipBtn = document.getElementById('batch-zip-btn');
  const batchQueueList = document.getElementById('batch-queue-list');

  // Modals & Drawers
  const engineBtn = document.getElementById('engine-btn');
  const engineDot = document.getElementById('engine-dot');
  const engineStatusText = document.getElementById('engine-status-text');
  const enginePopover = document.getElementById('engine-popover');
  const popCardBrowser = document.getElementById('pop-card-browser');
  const popCardLocal = document.getElementById('pop-card-local');
  const localEnginePingStatus = document.getElementById('local-engine-ping-status');
  const btnTestEngine = document.getElementById('btn-test-engine');

  const settingsBtn = document.getElementById('settings-btn');
  const settingsBackdrop = document.getElementById('settings-backdrop');
  const settingsDrawer = document.getElementById('settings-drawer');
  const btnCloseSettings = document.getElementById('btn-close-settings');
  const settingImgFormat = document.getElementById('setting-img-format');
  const settingSuffix = document.getElementById('setting-suffix');
  const concurrencyDec = document.getElementById('concurrency-dec');
  const concurrencyInc = document.getElementById('concurrency-inc');
  const concurrencyVal = document.getElementById('concurrency-val');
  const btnResetSettings = document.getElementById('btn-reset-settings');

  const modalBackdrop = document.getElementById('modal-backdrop');
  const batchPreviewModal = document.getElementById('batch-preview-modal');
  const modalFilename = document.getElementById('modal-filename');
  const modalMeta = document.getElementById('modal-meta');
  const modalBtnClean = document.getElementById('modal-btn-clean');
  const modalBtnOrig = document.getElementById('modal-btn-orig');
  const modalBtnClose = document.getElementById('modal-btn-close');
  const modalBtnCloseFooter = document.getElementById('modal-btn-close-footer');
  const modalImgPreview = document.getElementById('modal-img-preview');
  const modalVidPreview = document.getElementById('modal-vid-preview');
  const modalBtnDownload = document.getElementById('modal-btn-download');

  const toastShelf = document.getElementById('toast-shelf');

  // Initialize Engines
  async function ensureEngines() {
    if (!watermarkEngine) {
      watermarkEngine = await WatermarkEngine.create();
    }
    if (!videoEngine) {
      videoEngine = new VideoWatermarkEngine(watermarkEngine);
    }
    return { watermarkEngine, videoEngine };
  }

  // Toast
  function showToast(message, type = 'info', duration = 4000, actionLabel = null, actionCallback = null) {
    if (!toastShelf) return;
    const toast = document.createElement('div');
    toast.className = 'toast';

    let iconHtml = '<iconify-icon icon="ph:info-bold" width="16" style="color:var(--sky);"></iconify-icon>';
    if (type === 'success') iconHtml = '<iconify-icon icon="ph:check-circle-bold" width="16" style="color:var(--mint);"></iconify-icon>';
    if (type === 'warn') iconHtml = '<iconify-icon icon="ph:warning-circle-bold" width="16" style="color:var(--sun);"></iconify-icon>';
    if (type === 'error') iconHtml = '<iconify-icon icon="ph:x-circle-bold" width="16" style="color:var(--danger);"></iconify-icon>';

    toast.innerHTML = `${iconHtml}<span>${message}</span>`;

    if (actionLabel && typeof actionCallback === 'function') {
      const actBtn = document.createElement('button');
      actBtn.className = 'btn btn-sm';
      actBtn.style.cssText = 'background: rgba(255,255,255,0.18); color: #fff; margin-left: 8px;';
      actBtn.textContent = actionLabel;
      actBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        actionCallback();
        toast.remove();
      });
      toast.appendChild(actBtn);
    }

    toastShelf.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(12px)';
      toast.style.transition = 'all 240ms ease';
      setTimeout(() => toast.remove(), 250);
    }, duration);
  }

  // Mode Switch
  function setMode(mode) {
    currentTab = mode;
    app.dataset.mode = mode;

    tabImage.setAttribute('aria-selected', mode === 'image');
    tabVideo.setAttribute('aria-selected', mode === 'video');
    tabBatch.setAttribute('aria-selected', mode === 'batch');

    const tabIndex = mode === 'image' ? 0 : mode === 'video' ? 1 : 2;
    tabsContainer.style.setProperty('--tab-index', tabIndex);

    updateViewVisibility();
  }

  function updateViewVisibility() {
    const hasImage = imageSessionFiles.length > 0;
    const hasVideo = currentVideoFile !== null;
    const hasBatch = batchQueue.length > 0;
    const isShowingWorkspace = (currentTab === 'image' && hasImage) ||
                               (currentTab === 'video' && hasVideo) ||
                               (currentTab === 'batch' && hasBatch);

    if (landingHero) landingHero.classList.toggle('hidden', isShowingWorkspace);
    if (demoShowcase) demoShowcase.classList.toggle('hidden', isShowingWorkspace);

    if (currentTab === 'image') {
      if (hasImage) {
        dropzone.classList.add('hidden');
        viewImage.classList.remove('hidden');
        viewVideo.classList.add('hidden');
        viewBatch.classList.add('hidden');
      } else {
        dropzone.classList.remove('hidden');
        viewImage.classList.add('hidden');
        viewVideo.classList.add('hidden');
        viewBatch.classList.add('hidden');
        dropTitle.textContent = 'Drop an image, video or folder';
        dropSub.textContent = '';
        chooseImgBtn.classList.remove('hidden');
        chooseVideoBtn.classList.add('hidden');
        batchEmptyBtns.classList.add('hidden');
      }
    } else if (currentTab === 'video') {
      if (hasVideo) {
        dropzone.classList.add('hidden');
        viewImage.classList.add('hidden');
        viewVideo.classList.remove('hidden');
        viewBatch.classList.add('hidden');
      } else {
        dropzone.classList.remove('hidden');
        viewImage.classList.add('hidden');
        viewVideo.classList.add('hidden');
        viewBatch.classList.add('hidden');
        dropTitle.textContent = 'Drop an image, video or folder';
        dropSub.textContent = '';
        chooseImgBtn.classList.add('hidden');
        chooseVideoBtn.classList.remove('hidden');
        batchEmptyBtns.classList.add('hidden');
      }
    } else if (currentTab === 'batch') {
      if (hasBatch) {
        dropzone.classList.add('hidden');
        viewImage.classList.add('hidden');
        viewVideo.classList.add('hidden');
        viewBatch.classList.remove('hidden');
      } else {
        dropzone.classList.remove('hidden');
        viewImage.classList.add('hidden');
        viewVideo.classList.add('hidden');
        viewBatch.classList.add('hidden');
        dropTitle.textContent = 'Drop an image, video or folder';
        dropSub.textContent = '';
        chooseImgBtn.classList.add('hidden');
        chooseVideoBtn.classList.add('hidden');
        batchEmptyBtns.classList.remove('hidden');
      }
    }
  }

  tabImage.addEventListener('click', () => setMode('image'));
  tabVideo.addEventListener('click', () => setMode('video'));
  tabBatch.addEventListener('click', () => setMode('batch'));

  // Dissolve Signature Moment
  function triggerDissolve(layer, cx, cy) {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!layer) return;

    for (let i = 0; i < 12; i++) {
      const el = document.createElement('i');
      const sz = 6 + Math.random() * 6;
      el.className = 'particle';
      el.style.cssText = `left:${cx - sz / 2}px;top:${cy - sz / 2}px;--sz:${sz}px;--c:${DISSOLVE_COLORS[i % 5]};`;
      layer.appendChild(el);

      const a = Math.random() * Math.PI * 2;
      const d = 28 + Math.random() * 44;
      const dur = 520 + Math.random() * 200;

      if (el.animate) {
        el.animate(
          [
            { transform: 'translate(0,0) rotate(0deg) scale(1)', opacity: 1 },
            { transform: `translate(${Math.cos(a) * d}px, ${Math.sin(a) * d}px) rotate(${Math.random() * 180}deg) scale(0.6)`, opacity: 0 }
          ],
          { duration: dur, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', delay: 80, fill: 'forwards' }
        ).onfinish = () => el.remove();
      } else {
        setTimeout(() => el.remove(), 700);
      }
    }
  }

  function triggerRevealSweep() {
    comparePos = 0;
    setComparePos(0);
    const start = performance.now();
    const duration = 480;

    function step(ts) {
      const elapsed = ts - start;
      const progress = Math.min(1, elapsed / duration);
      const eased = Math.sin((progress * Math.PI) / 2);
      const pos = eased * 50;
      setComparePos(pos);
      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        setComparePos(50);
        btnImgDownload.classList.add('btn-glow');
        setTimeout(() => btnImgDownload.classList.remove('btn-glow'), 1000);
      }
    }
    requestAnimationFrame(step);
  }

  // Confidence Meter & Ring
  function updateConfidenceRing(pct) {
    const cleanPct = Math.max(0, Math.min(100, Math.round(pct)));
    const totalCircumference = 144.5;
    const targetOffset = totalCircumference * (1 - cleanPct / 100);

    if (ringTextImg) ringTextImg.textContent = cleanPct;
    if (ringFillImg) {
      ringFillImg.style.strokeDashoffset = targetOffset;
      if (cleanPct >= 70) {
        ringFillImg.setAttribute('stroke', 'var(--ok)');
        resultTitle.textContent = 'Looks clean';
      } else {
        ringFillImg.setAttribute('stroke', 'var(--warn)');
        resultTitle.textContent = 'Check this one';
      }
    }

    const meterCells = document.querySelectorAll('#meter-cells .meter-cell');
    const meterNum = document.getElementById('meter-num');
    if (meterCells.length) {
      const score = Math.max(1, Math.min(10, Math.round(cleanPct / 10)));
      if (meterNum) meterNum.textContent = score;
      meterCells.forEach((cell, idx) => {
        cell.className = 'meter-cell';
        if (idx < score) {
          cell.classList.add('filled');
          if (cleanPct < 70) cell.classList.add('warn');
        }
      });
    }
  }

  // Compare Slider
  function setComparePos(pct) {
    comparePos = Math.min(98, Math.max(2, pct));
    compareBox.style.setProperty('--pos', comparePos + '%');
    compareBox.setAttribute('aria-valuenow', Math.round(comparePos));
    compareBox.setAttribute('aria-valuetext', Math.round(comparePos) + ' percent original');
  }

  function handleComparePointer(clientX) {
    const rect = compareBox.getBoundingClientRect();
    if (rect.width <= 0) return;
    const p = ((clientX - rect.left) / rect.width) * 100;
    setComparePos(p);
  }

  compareBox.addEventListener('pointerdown', (e) => {
    isDraggingCompare = true;
    compareBox.classList.add('is-dragging');
    compareBox.setPointerCapture(e.pointerId);
    handleComparePointer(e.clientX);
  });

  compareBox.addEventListener('pointermove', (e) => {
    if (isDraggingCompare) handleComparePointer(e.clientX);
    if (loupeActive) updateLoupePosition(e.clientX, e.clientY);
  });

  compareBox.addEventListener('pointerup', () => {
    isDraggingCompare = false;
    compareBox.classList.remove('is-dragging');
  });

  compareBox.addEventListener('pointercancel', () => {
    isDraggingCompare = false;
    compareBox.classList.remove('is-dragging');
  });

  // Scroll Animation for Before & After Showcase
  const demoSectionEl = document.getElementById('demo-showcase');
  if (demoSectionEl && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          demoSectionEl.classList.add('is-revealed');
        }
      });
    }, { threshold: 0.15 });
    observer.observe(demoSectionEl);
  } else if (demoSectionEl) {
    demoSectionEl.classList.add('is-revealed');
  }

  // Compare Modes (Slider | Side by side | Flip)
  const btnModeSlider = document.getElementById('btn-mode-slider');
  const btnModeSide = document.getElementById('btn-mode-side');
  const btnModeFlip = document.getElementById('btn-mode-flip');

  function setCompareMode(mode) {
    compareMode = mode;
    btnModeSlider.classList.toggle('active', mode === 'slider');
    btnModeSide.classList.toggle('active', mode === 'side');
    btnModeFlip.classList.toggle('active', mode === 'flip');

    if (mode === 'slider') {
      compareBox.classList.remove('hidden');
      sideBySideBox.classList.add('hidden');
      flipBox.classList.add('hidden');
    } else if (mode === 'side') {
      compareBox.classList.add('hidden');
      sideBySideBox.classList.remove('hidden');
      flipBox.classList.add('hidden');
      syncSideBySide();
    } else if (mode === 'flip') {
      compareBox.classList.add('hidden');
      sideBySideBox.classList.add('hidden');
      flipBox.classList.remove('hidden');
      syncFlipView(false);
    }
  }

  btnModeSlider.addEventListener('click', () => setCompareMode('slider'));
  btnModeSide.addEventListener('click', () => setCompareMode('side'));
  btnModeFlip.addEventListener('click', () => setCompareMode('flip'));

  function syncSideBySide() {
    if (!canvasOrig || !canvasClean) return;
    canvasSideOrig.width = canvasOrig.width;
    canvasSideOrig.height = canvasOrig.height;
    const ctx1 = canvasSideOrig.getContext('2d');
    ctx1.clearRect(0, 0, canvasSideOrig.width, canvasSideOrig.height);
    ctx1.drawImage(canvasOrig, 0, 0);

    canvasSideClean.width = canvasClean.width;
    canvasSideClean.height = canvasClean.height;
    const ctx2 = canvasSideClean.getContext('2d');
    ctx2.clearRect(0, 0, canvasSideClean.width, canvasSideClean.height);
    ctx2.drawImage(canvasClean, 0, 0);
  }

  let flipIsClean = true;
  function syncFlipView(isOriginal) {
    if (!canvasOrig || !canvasClean) return;
    canvasFlip.width = canvasClean.width;
    canvasFlip.height = canvasClean.height;
    const ctx = canvasFlip.getContext('2d');
    ctx.clearRect(0, 0, canvasFlip.width, canvasFlip.height);
    if (isOriginal) {
      ctx.drawImage(canvasOrig, 0, 0);
      flipBadge.textContent = 'Original';
      flipBadge.className = 'chip neutral';
    } else {
      ctx.drawImage(canvasClean, 0, 0);
      flipBadge.textContent = 'Cleaned';
      flipBadge.className = 'chip ok';
    }
  }

  flipBox.addEventListener('click', () => {
    flipIsClean = !flipIsClean;
    syncFlipView(!flipIsClean);
  });

  // Hold Original
  const btnHoldOrig = document.getElementById('btn-hold-orig');
  function startHoldOriginal() {
    holdingOriginal = true;
    btnHoldOrig.classList.add('btn-soft');
    if (compareMode === 'slider') {
      compareBox.style.setProperty('--pos', '100%');
    } else if (compareMode === 'flip') {
      syncFlipView(true);
    }
  }
  function stopHoldOriginal() {
    holdingOriginal = false;
    btnHoldOrig.classList.remove('btn-soft');
    if (compareMode === 'slider') {
      compareBox.style.setProperty('--pos', comparePos + '%');
    } else if (compareMode === 'flip') {
      syncFlipView(!flipIsClean);
    }
  }

  btnHoldOrig.addEventListener('mousedown', startHoldOriginal);
  btnHoldOrig.addEventListener('mouseup', stopHoldOriginal);
  btnHoldOrig.addEventListener('mouseleave', stopHoldOriginal);
  btnHoldOrig.addEventListener('touchstart', startHoldOriginal, { passive: true });
  btnHoldOrig.addEventListener('touchend', stopHoldOriginal);

  // Loupe
  const btnLoupe = document.getElementById('btn-loupe');
  function toggleLoupe() {
    loupeActive = !loupeActive;
    btnLoupe.classList.toggle('btn-soft', loupeActive);
    imageLoupe.classList.toggle('active', loupeActive);
    if (loupeActive && currentCandidate) {
      const rect = compareBox.getBoundingClientRect();
      updateLoupePosition(rect.left + rect.width * 0.75, rect.top + rect.height * 0.75);
    }
  }
  btnLoupe.addEventListener('click', toggleLoupe);

  function updateLoupePosition(clientX, clientY) {
    if (!loupeActive || !canvasClean) return;
    const rect = compareBox.getBoundingClientRect();
    const lx = clientX - rect.left;
    const ly = clientY - rect.top;

    imageLoupe.style.left = `${lx - 110}px`;
    imageLoupe.style.top = `${ly - 110}px`;

    const ctx = loupeCanvas.getContext('2d');
    ctx.clearRect(0, 0, 220, 220);

    const scaleX = canvasClean.width / rect.width;
    const scaleY = canvasClean.height / rect.height;
    const imgX = lx * scaleX;
    const imgY = ly * scaleY;

    const sw = 55;
    const sh = 55;
    const sx = Math.max(0, Math.min(canvasClean.width - sw, imgX - sw / 2));
    const sy = Math.max(0, Math.min(canvasClean.height - sh, imgY - sh / 2));

    ctx.drawImage(canvasClean, sx, sy, sw, sh, 0, 0, 220, 220);
  }

  // Image Unblending Pipeline
  async function loadImageFile(file) {
    if (!file || !file.type.startsWith('image/')) {
      showToast('Please select a valid image (PNG, JPG, WebP).', 'warn');
      return;
    }

    await ensureEngines();
    currentImageFile = file;

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        canvasOrig.width = img.naturalWidth;
        canvasOrig.height = img.naturalHeight;
        const ctxOrig = canvasOrig.getContext('2d', { willReadFrequently: true });
        ctxOrig.clearRect(0, 0, canvasOrig.width, canvasOrig.height);
        ctxOrig.drawImage(img, 0, 0);

        canvasClean.width = img.naturalWidth;
        canvasClean.height = img.naturalHeight;

        // Candidate Detection
        const imgData = ctxOrig.getImageData(0, 0, canvasOrig.width, canvasOrig.height);
        const candidate = detectWatermarkCandidate(imgData, canvasOrig.width, canvasOrig.height, watermarkEngine);
        currentCandidate = candidate;

        // Meta chips
        lblMetaDims.textContent = `${img.naturalWidth} × ${img.naturalHeight}`;
        lblMetaFormat.textContent = file.type.split('/')[1].toUpperCase();
        lblMetaSize.textContent = `${(file.size / 1024).toFixed(0)} KB`;

        // Confidence ring & title
        const confidencePct = Math.round((candidate.score || 0.85) * 100);
        updateConfidenceRing(confidencePct);

        // Sliders
        sliderImgGain.value = candidate.gain || 0.82;
        lblImgGain.textContent = `${parseFloat(sliderImgGain.value).toFixed(2)}x`;
        updateSliderFill(sliderImgGain);

        sliderImgScale.value = candidate.sizeScale || 1.0;
        lblImgScale.textContent = `${parseFloat(sliderImgScale.value).toFixed(2)}x`;
        updateSliderFill(sliderImgScale);

        lblImgX.textContent = '0';
        lblImgY.textContent = '0';

        // Apply clean
        applyImageCleaning();

        if (!imageSessionFiles.includes(file)) {
          imageSessionFiles.push(file);
          renderFilmstrip();
        }
        activeImageIndex = imageSessionFiles.indexOf(file);

        setMode('image');
        window.scrollTo({ top: 0, behavior: 'smooth' });

        setTimeout(() => {
          const rect = compareBox.getBoundingClientRect();
          const pX = candidate.offsetX ? (candidate.offsetX / img.naturalWidth) * rect.width : rect.width - 60;
          const pY = candidate.offsetY ? (candidate.offsetY / img.naturalHeight) * rect.height : rect.height - 60;
          triggerDissolve(particlesLayer, pX, pY);
          triggerRevealSweep();
        }, 150);

        showToast('Image analyzed & cleaned with zero blur.', 'success');
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function applyImageCleaning() {
    if (!watermarkEngine || !canvasOrig || !currentCandidate) return;

    const ctxClean = canvasClean.getContext('2d', { willReadFrequently: true });
    ctxClean.clearRect(0, 0, canvasClean.width, canvasClean.height);
    ctxClean.drawImage(canvasOrig, 0, 0);

    const imgData = ctxClean.getImageData(0, 0, canvasClean.width, canvasClean.height);
    const base = getWatermarkInfo(canvasClean.width, canvasClean.height);

    const candBaseSize = currentCandidate.baseSize || (currentCandidate.size && currentCandidate.size <= 64 ? 48 : base.size);
    const bg = candBaseSize <= 48 ? watermarkEngine.bg48 : watermarkEngine.bg96;

    const gain = parseFloat(sliderImgGain.value);
    const scale = parseFloat(sliderImgScale.value);
    const offsetX = (currentCandidate.offsetX || 0) + parseInt(lblImgX.textContent, 10);
    const offsetY = (currentCandidate.offsetY || 0) + parseInt(lblImgY.textContent, 10);

    const effectiveBase = {
      size: candBaseSize,
      x: currentCandidate.baseX !== undefined ? currentCandidate.baseX : base.x,
      y: currentCandidate.baseY !== undefined ? currentCandidate.baseY : base.y
    };

    cleanFrame(bg, imgData, canvasClean.width, canvasClean.height, effectiveBase, {
      gain: gain,
      sizeScale: scale,
      offsetX: offsetX,
      offsetY: offsetY
    });

    ctxClean.putImageData(imgData, 0, 0);

    syncSideBySide();
    if (compareMode === 'flip') syncFlipView(!flipIsClean);

    btnImgUndo.removeAttribute('disabled');
    btnImgReset.removeAttribute('disabled');
  }

  function updateSliderFill(slider) {
    const min = parseFloat(slider.min);
    const max = parseFloat(slider.max);
    const val = parseFloat(slider.value);
    const pct = ((val - min) / (max - min)) * 100;
    slider.style.setProperty('--fill', pct + '%');
  }

  sliderImgGain.addEventListener('input', () => {
    lblImgGain.textContent = `${parseFloat(sliderImgGain.value).toFixed(2)}x`;
    updateSliderFill(sliderImgGain);
    applyImageCleaning();
  });

  sliderImgScale.addEventListener('input', () => {
    lblImgScale.textContent = `${parseFloat(sliderImgScale.value).toFixed(2)}x`;
    updateSliderFill(sliderImgScale);
    applyImageCleaning();
  });

  const stepperXDec = document.getElementById('stepper-x-dec');
  const stepperXInc = document.getElementById('stepper-x-inc');
  const stepperYDec = document.getElementById('stepper-y-dec');
  const stepperYInc = document.getElementById('stepper-y-inc');

  stepperXDec.addEventListener('click', () => {
    lblImgX.textContent = parseInt(lblImgX.textContent, 10) - 1;
    applyImageCleaning();
  });
  stepperXInc.addEventListener('click', () => {
    lblImgX.textContent = parseInt(lblImgX.textContent, 10) + 1;
    applyImageCleaning();
  });
  stepperYDec.addEventListener('click', () => {
    lblImgY.textContent = parseInt(lblImgY.textContent, 10) - 1;
    applyImageCleaning();
  });
  stepperYInc.addEventListener('click', () => {
    lblImgY.textContent = parseInt(lblImgY.textContent, 10) + 1;
    applyImageCleaning();
  });

  btnImgReset.addEventListener('click', () => {
    if (!currentCandidate) return;
    sliderImgGain.value = currentCandidate.gain || 0.82;
    sliderImgScale.value = currentCandidate.sizeScale || 1.0;
    lblImgX.textContent = '0';
    lblImgY.textContent = '0';
    lblImgGain.textContent = `${parseFloat(sliderImgGain.value).toFixed(2)}x`;
    lblImgScale.textContent = `${parseFloat(sliderImgScale.value).toFixed(2)}x`;
    updateSliderFill(sliderImgGain);
    updateSliderFill(sliderImgScale);
    applyImageCleaning();
    showToast('Fine tuning reset to auto match.', 'info');
  });

  presetExpanderBtn.addEventListener('click', () => {
    presetListBox.classList.toggle('hidden');
    document.getElementById('preset-chevron').style.transform = presetListBox.classList.contains('hidden') ? 'none' : 'rotate(180deg)';
  });

  presetListBox.querySelectorAll('.preset-item').forEach((item) => {
    item.addEventListener('click', () => {
      presetListBox.querySelectorAll('.preset-item').forEach((p) => p.classList.remove('selected'));
      item.classList.add('selected');
      const presetKey = item.dataset.preset;
      lblCurrentPreset.textContent = item.querySelector('.preset-name').textContent;
      presetListBox.classList.add('hidden');
      document.getElementById('preset-chevron').style.transform = 'none';

      if (currentCandidate) {
        currentCandidate.presetKey = presetKey;
        applyImageCleaning();
        showToast(`Applied preset: ${item.querySelector('.preset-name').textContent}`, 'info');
      }
    });
  });

  toggleCornersRow.addEventListener('click', () => {
    const isChecked = toggleCorners.getAttribute('aria-checked') === 'true';
    toggleCorners.setAttribute('aria-checked', String(!isChecked));
    appSettings.checkAllCorners = !isChecked;
    if (canvasOrig && watermarkEngine) {
      const ctx = canvasOrig.getContext('2d', { willReadFrequently: true });
      const imgData = ctx.getImageData(0, 0, canvasOrig.width, canvasOrig.height);
      currentCandidate = detectWatermarkCandidate(imgData, canvasOrig.width, canvasOrig.height, watermarkEngine);
      applyImageCleaning();
      showToast(appSettings.checkAllCorners ? 'Checked all corners for secondary marks.' : 'Checked default corner.', 'info');
    }
  });

  function renderFilmstrip() {
    filmstripList.innerHTML = '';
    imageSessionFiles.forEach((f, idx) => {
      const thumb = document.createElement('div');
      thumb.className = `film-thumb ${idx === activeImageIndex ? 'active' : ''}`;
      thumb.title = f.name;

      const img = document.createElement('img');
      img.src = URL.createObjectURL(f);
      thumb.appendChild(img);

      thumb.addEventListener('click', () => {
        loadImageFile(f);
      });
      filmstripList.appendChild(thumb);
    });
  }

  filmAddTile.addEventListener('click', () => imageInput.click());

  btnImgDownload.addEventListener('click', () => {
    if (!canvasClean) return;
    if (typeof handleDownloadAd === 'function') handleDownloadAd();

    const format = appSettings.outputFormat === 'webp' ? 'image/webp' : 'image/png';
    const ext = appSettings.outputFormat === 'webp' ? '.webp' : '.png';
    const baseName = currentImageFile ? currentImageFile.name.replace(/\.[^/.]+$/, '') : 'image';
    const filename = `${baseName}${appSettings.suffix}${ext}`;

    canvasClean.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      btnImgDownloadText.textContent = 'Saved';
      btnImgDownload.style.background = 'var(--mint)';
      setTimeout(() => {
        btnImgDownloadText.textContent = 'Download PNG';
        btnImgDownload.style.background = 'var(--violet)';
      }, 2000);

      showToast('Cleaned image saved to your device.', 'success');
    }, format, 1.0);
  });

  btnImgCopy.addEventListener('click', async () => {
    if (!canvasClean) return;
    try {
      canvasClean.toBlob(async (blob) => {
        if (!blob) return;
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
        btnImgCopyText.textContent = 'Copied';
        setTimeout(() => {
          btnImgCopyText.textContent = 'Copy image';
        }, 2000);
        showToast('Image copied to clipboard.', 'success');
      }, 'image/png');
    } catch (err) {
      console.error(err);
      showToast('Clipboard copy not supported on this browser.', 'warn');
    }
  });

  // Video Controller
  async function loadVideoFile(file) {
    if (!file || !file.type.startsWith('video/')) {
      showToast('Please select a valid MP4 or WebM video.', 'warn');
      return;
    }

    await ensureEngines();
    currentVideoFile = file;
    videoFilename.textContent = file.name;

    if (!videoElement) {
      videoElement = document.createElement('video');
      videoElement.playsInline = true;
      videoElement.muted = false;
    }

    const videoUrl = URL.createObjectURL(file);
    videoElement.src = videoUrl;

    videoElement.onloadedmetadata = () => {
      videoDuration = videoElement.duration || 8;
      lblVideoDims.textContent = `${videoElement.videoWidth} × ${videoElement.videoHeight}`;
      lblVideoDur.textContent = formatTime(videoDuration);
      lblVideoFps.textContent = '24 fps';

      videoCanvasPreview.width = videoElement.videoWidth;
      videoCanvasPreview.height = videoElement.videoHeight;

      videoElement.currentTime = Math.min(1.0, videoDuration / 2);
    };

    videoElement.onseeked = () => {
      const ctx = videoCanvasPreview.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(videoElement, 0, 0);

      if (!videoCandidate) {
        const imgData = ctx.getImageData(0, 0, videoCanvasPreview.width, videoCanvasPreview.height);
        videoCandidate = detectVideoWatermarkCandidate(imgData, videoCanvasPreview.width, videoCanvasPreview.height, watermarkEngine);

        vStep1.classList.add('done');
        vStep1Desc.textContent = `High variance frame verified`;
        vStep2.classList.add('done');
        vStep2Desc.textContent = `${videoCandidate.name || 'Adaptive Inset'} locked`;
        vStep3.classList.add('active');

        generateVideoThumbnails();
      }

      cleanVideoPreviewFrame(ctx);

      setMode('video');
      showToast('Video clip loaded & watermark coordinates locked.', 'success');
    };
  }

  function cleanVideoPreviewFrame(ctx) {
    if (!videoCandidate || !videoEngine || !watermarkEngine) return;
    const imgData = ctx.getImageData(0, 0, videoCanvasPreview.width, videoCanvasPreview.height);
    const base = videoEngine.getVeoWatermark(videoCanvasPreview.width, videoCanvasPreview.height);
    const bg = videoCandidate.template || (videoCandidate.presetKey === 'sparkle' ? watermarkEngine.bg96 : (watermarkEngine.bgVeo72 || watermarkEngine.bg96));
    cleanFrame(bg, imgData, videoCanvasPreview.width, videoCanvasPreview.height, base, {
      gain: videoCandidate.gain !== undefined ? videoCandidate.gain : 1.0,
      sizeScale: videoCandidate.sizeScale !== undefined ? videoCandidate.sizeScale : 1.0,
      offsetX: videoCandidate.offsetX !== undefined ? videoCandidate.offsetX : -24,
      offsetY: videoCandidate.offsetY !== undefined ? videoCandidate.offsetY : -24,
    });
    ctx.putImageData(imgData, 0, 0);
  }

  function formatTime(secs) {
    const m = Math.floor(secs / 60);
    const s = (secs % 60).toFixed(1);
    return `${m < 10 ? '0' : ''}${m}:${parseFloat(s) < 10 ? '0' : ''}${s}`;
  }

  function generateVideoThumbnails() {
    videoFrameStrip.innerHTML = '';
    const numThumbs = 12;
    const interval = videoDuration / numThumbs;

    for (let i = 0; i < numThumbs; i++) {
      const thumb = document.createElement('div');
      thumb.className = 'film-thumb';
      const c = document.createElement('canvas');
      c.width = 56;
      c.height = 56;
      thumb.appendChild(c);

      const targetTime = i * interval;
      thumb.addEventListener('click', () => {
        videoElement.currentTime = targetTime;
      });
      videoFrameStrip.appendChild(thumb);
    }
  }

  btnVideoPlay.addEventListener('click', () => {
    if (!videoElement) return;
    if (videoPlaying) {
      videoElement.pause();
      videoPlaying = false;
      playIcon.setAttribute('icon', 'ph:play-fill');
    } else {
      videoElement.play();
      videoPlaying = true;
      playIcon.setAttribute('icon', 'ph:pause-fill');
      playVideoLoop();
    }
  });

  function playVideoLoop() {
    if (!videoPlaying || !videoElement) return;
    const ctx = videoCanvasPreview.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(videoElement, 0, 0);
    cleanVideoPreviewFrame(ctx);

    const cur = videoElement.currentTime;
    videoTimeReadout.textContent = `${formatTime(cur)} / ${formatTime(videoDuration)}`;
    const pct = (cur / videoDuration) * 100;
    videoTimelinePlayed.style.width = `${pct}%`;
    videoTimelineThumb.style.left = `${pct}%`;

    requestAnimationFrame(playVideoLoop);
  }

  btnFramePrev.addEventListener('click', () => {
    if (videoElement) videoElement.currentTime = Math.max(0, videoElement.currentTime - 1 / 24);
  });
  btnFrameNext.addEventListener('click', () => {
    if (videoElement) videoElement.currentTime = Math.min(videoDuration, videoElement.currentTime + 1 / 24);
  });

  btnSpeedToggle.addEventListener('click', () => {
    if (videoSpeed === 1.0) videoSpeed = 2.0;
    else if (videoSpeed === 2.0) videoSpeed = 0.5;
    else videoSpeed = 1.0;
    btnSpeedToggle.textContent = `${videoSpeed}x`;
    if (videoElement) videoElement.playbackRate = videoSpeed;
  });

  videoTimeline.addEventListener('click', (e) => {
    if (!videoElement || videoDuration <= 0) return;
    const rect = videoTimeline.getBoundingClientRect();
    const p = (e.clientX - rect.left) / rect.width;
    videoElement.currentTime = p * videoDuration;
  });

  btnVideoClean.addEventListener('click', async () => {
    if (!currentVideoFile || isCleaningVideo) return;
    isCleaningVideo = true;

    btnVideoClean.classList.add('hidden');
    videoProcessingCard.classList.remove('hidden');
    videoCompleteCard.classList.add('hidden');

    try {
      await ensureEngines();

      const bg = videoCandidate && videoCandidate.template ? videoCandidate.template : (watermarkEngine.bgVeo72 || watermarkEngine.bg96);
      const result = await videoEngine.process(currentVideoFile, {
        template: bg,
        gain: videoCandidate && videoCandidate.gain !== undefined ? videoCandidate.gain : 1.0,
        sizeScale: videoCandidate && videoCandidate.sizeScale !== undefined ? videoCandidate.sizeScale : 1.0,
        offsetX: videoCandidate && videoCandidate.offsetX !== undefined ? videoCandidate.offsetX : -24,
        offsetY: videoCandidate && videoCandidate.offsetY !== undefined ? videoCandidate.offsetY : -24,
        onProgress: ({ progress }) => {
          const pct = Math.round(progress * 100);
          videoProcPct.textContent = `${pct}%`;
          videoProcBar.style.width = `${pct}%`;
          const etaSecs = Math.max(0, Math.round(((1 - progress) / (progress || 0.01)) * 10));
          videoProcEta.textContent = `about ${etaSecs}s left`;
          document.title = `(${pct}%) Unmark Video`;
        }
      });

      lastCompletedVideoBlob = result.blob;
      isCleaningVideo = false;
      videoProcessingCard.classList.add('hidden');
      videoCompleteCard.classList.remove('hidden');
      videoOutputSize.textContent = `${(result.blob.size / (1024 * 1024)).toFixed(1)} MB MP4`;
      document.title = 'Done. Unmark';
      setTimeout(() => (document.title = 'Unmark — Lossless Watermark Removal'), 5000);

      btnVideoDownload.onclick = () => {
        if (typeof handleDownloadAd === 'function') handleDownloadAd();
        const url = URL.createObjectURL(lastCompletedVideoBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = currentVideoFile.name.replace(/\.[^/.]+$/, '') + appSettings.suffix + '.mp4';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('Cleaned video saved.', 'success');
      };

      showToast('Video watermark unblended successfully!', 'success');
    } catch (err) {
      console.error(err);
      isCleaningVideo = false;
      btnVideoClean.classList.remove('hidden');
      videoProcessingCard.classList.add('hidden');
      showToast('Error during video cleaning: ' + err.message, 'error');
    }
  });

  btnVideoCancel.addEventListener('click', () => {
    isCleaningVideo = false;
    btnVideoClean.classList.remove('hidden');
    videoProcessingCard.classList.add('hidden');
    showToast('Video cleaning cancelled.', 'info');
  });

  // Batch Workspace
  function addFilesToBatch(files) {
    if (!files || files.length === 0) return;
    let addedCount = 0;

    Array.from(files).forEach((file) => {
      const isImg = file.type.startsWith('image/');
      const isVid = file.type.startsWith('video/') || file.name.endsWith('.mp4');

      if (!isImg && !isVid) return;

      const item = {
        id: 'batch-' + Math.random().toString(36).substr(2, 9),
        file: file,
        type: isImg ? 'Image' : 'Video',
        name: file.name,
        size: (file.size / 1024).toFixed(0) + ' KB',
        status: 'waiting',
        progress: 0,
        cleanedBlob: null,
        origUrl: URL.createObjectURL(file)
      };

      batchQueue.push(item);
      addedCount++;
    });

    if (addedCount > 0) {
      updateBentoStats();
      renderBatchRows();
      setMode('batch');
      showToast(`Added ${addedCount} files to batch queue.`, 'info');
    }
  }

  function updateBentoStats() {
    const total = batchQueue.length;
    const cleaned = batchQueue.filter((i) => i.status === 'cleaned').length;
    const look = batchQueue.filter((i) => i.status === 'look').length;
    const waiting = batchQueue.filter((i) => i.status === 'waiting' || i.status === 'cleaning').length;

    bentoTotal.textContent = total;
    bentoCleaned.textContent = cleaned;
    bentoLook.textContent = look;
    bentoWaiting.textContent = waiting;

    const overallPct = total > 0 ? (cleaned / total) * 100 : 0;
    batchOverallBar.style.width = `${overallPct}%`;

    batchZipBtn.disabled = cleaned === 0;
  }

  function renderBatchRows() {
    batchQueueList.innerHTML = '';
    batchQueue.forEach((item, index) => {
      const row = document.createElement('div');
      row.className = 'row';
      row.style.setProperty('--n', index);
      row.id = `row-${item.id}`;

      const thumb = document.createElement('img');
      thumb.className = 'thumb';
      thumb.src = item.origUrl;
      row.appendChild(thumb);

      const name = document.createElement('span');
      name.className = 'file-name';
      name.textContent = item.name;
      name.title = item.name;
      row.appendChild(name);

      const typeChip = document.createElement('span');
      typeChip.className = 'chip neutral col-type';
      typeChip.textContent = item.type;
      row.appendChild(typeChip);

      const sizeSpan = document.createElement('span');
      sizeSpan.className = 'num col-size';
      sizeSpan.style.color = 'var(--ink-3)';
      sizeSpan.textContent = item.size;
      row.appendChild(sizeSpan);

      const statusChip = document.createElement('span');
      statusChip.className = getStatusChipClass(item.status);
      statusChip.innerHTML = getStatusChipHtml(item.status);
      row.appendChild(statusChip);

      const actBtn = document.createElement('button');
      actBtn.className = 'btn btn-secondary btn-sm';
      actBtn.textContent = item.status === 'cleaned' ? 'Review' : 'Remove';
      actBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (item.status === 'cleaned') {
          openBatchPreview(item);
        } else {
          removeBatchItem(item.id);
        }
      });
      row.appendChild(actBtn);

      const bar = document.createElement('div');
      bar.className = 'bar';
      bar.style.setProperty('--p', item.progress);
      row.appendChild(bar);

      row.addEventListener('click', () => {
        if (item.cleanedBlob) openBatchPreview(item);
      });

      batchQueueList.appendChild(row);
    });
  }

  function getStatusChipClass(status) {
    if (status === 'cleaned') return 'chip ok';
    if (status === 'cleaning') return 'chip run';
    if (status === 'look') return 'chip look';
    if (status === 'failed') return 'chip bad';
    return 'chip wait';
  }

  function getStatusChipHtml(status) {
    if (status === 'cleaned') return '<iconify-icon icon="ph:check-bold" width="12"></iconify-icon>Cleaned';
    if (status === 'cleaning') return '<iconify-icon icon="ph:sparkle-bold" width="12" class="spin"></iconify-icon>Cleaning';
    if (status === 'look') return '<iconify-icon icon="ph:warning-circle-bold" width="12"></iconify-icon>Look again';
    if (status === 'failed') return '<iconify-icon icon="ph:x-circle-bold" width="12"></iconify-icon>Failed';
    return '<iconify-icon icon="ph:clock-bold" width="12"></iconify-icon>Waiting';
  }

  function removeBatchItem(id) {
    const idx = batchQueue.findIndex((i) => i.id === id);
    if (idx !== -1) {
      batchQueue.splice(idx, 1);
      updateBentoStats();
      renderBatchRows();
      if (batchQueue.length === 0) setMode('batch');
    }
  }

  batchClearBtn.addEventListener('click', () => {
    batchQueue = [];
    updateBentoStats();
    renderBatchRows();
    setMode('batch');
    showToast('Batch queue cleared.', 'info');
  });

  batchStartBtn.addEventListener('click', () => {
    if (batchRunning) {
      batchPaused = true;
      batchRunning = false;
      batchStartBtn.innerHTML = '<iconify-icon icon="ph:play-bold" width="16"></iconify-icon>Resume batch';
      showToast('Batch processing paused.', 'info');
      return;
    }

    batchRunning = true;
    batchPaused = false;
    batchStartBtn.innerHTML = '<iconify-icon icon="ph:pause-bold" width="16"></iconify-icon>Pause';
    pumpBatchQueue();
  });

  async function pumpBatchQueue() {
    if (!batchRunning || batchPaused) return;

    while (batchActiveCount < appSettings.concurrency) {
      const nextItem = batchQueue.find((i) => i.status === 'waiting');
      if (!nextItem) break;
      processBatchItem(nextItem);
    }

    const allDone = batchQueue.every((i) => i.status === 'cleaned' || i.status === 'look' || i.status === 'failed');
    if (allDone && batchQueue.length > 0) {
      batchRunning = false;
      batchStartBtn.innerHTML = '<iconify-icon icon="ph:check-bold" width="16"></iconify-icon>All done';
      showToast('All batch files finished processing!', 'success');
    }
  }

  async function processBatchItem(item) {
    batchActiveCount++;
    item.status = 'cleaning';
    updateBentoStats();
    renderBatchRows();

    try {
      await ensureEngines();

      if (item.type === 'Image') {
        const img = new Image();
        img.src = item.origUrl;
        await img.decode();

        const offCanvas = document.createElement('canvas');
        offCanvas.width = img.naturalWidth;
        offCanvas.height = img.naturalHeight;
        const ctx = offCanvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0);

        const imgData = ctx.getImageData(0, 0, offCanvas.width, offCanvas.height);
        const cand = detectWatermarkCandidate(imgData, offCanvas.width, offCanvas.height, watermarkEngine);

        const base = getWatermarkInfo(offCanvas.width, offCanvas.height);
        const candBaseSize = cand.baseSize || (cand.size && cand.size <= 64 ? 48 : base.size);
        const useBg = candBaseSize <= 48 ? watermarkEngine.bg48 : watermarkEngine.bg96;
        const effectiveBase = {
          size: candBaseSize,
          x: cand.baseX !== undefined ? cand.baseX : base.x,
          y: cand.baseY !== undefined ? cand.baseY : base.y,
        };

        cleanFrame(useBg, imgData, offCanvas.width, offCanvas.height, effectiveBase, {
          gain: cand.gain || 0.6,
          sizeScale: cand.sizeScale || 1.0,
          offsetX: cand.offsetX || 0,
          offsetY: cand.offsetY || 0,
        });

        ctx.putImageData(imgData, 0, 0);

        const format = appSettings.outputFormat === 'webp' ? 'image/webp' : 'image/png';
        const blob = await new Promise((res) => offCanvas.toBlob(res, format, 1.0));

        item.cleanedBlob = blob;
        item.status = (cand.score || 0.8) >= 0.7 ? 'cleaned' : 'look';
        item.progress = 1.0;
      } else {
        const res = await videoEngine.process(item.file, {
          gain: 0.6,
          sizeScale: 1.0,
          offsetX: -24,
          offsetY: -24,
          onProgress: ({ progress }) => {
            item.progress = progress;
            const row = document.getElementById(`row-${item.id}`);
            if (row) {
              const bar = row.querySelector('.bar');
              if (bar) bar.style.setProperty('--p', progress);
            }
          }
        });

        item.cleanedBlob = res.blob;
        item.status = 'cleaned';
        item.progress = 1.0;
      }
    } catch (err) {
      console.error(err);
      item.status = 'failed';
    } finally {
      batchActiveCount--;
      updateBentoStats();
      renderBatchRows();
      pumpBatchQueue();
    }
  }

  function openBatchPreview(item) {
    if (!item.cleanedBlob) return;
    modalFilename.textContent = item.name;
    modalMeta.textContent = `${item.type} • ${item.size}`;

    const cleanUrl = URL.createObjectURL(item.cleanedBlob);
    modalBtnDownload.href = cleanUrl;
    modalBtnDownload.download = item.name.replace(/\.[^/.]+$/, '') + appSettings.suffix + (item.type === 'Video' ? '.mp4' : '.png');

    if (item.type === 'Image') {
      modalImgPreview.classList.remove('hidden');
      modalVidPreview.classList.add('hidden');
      modalImgPreview.src = cleanUrl;

      modalBtnClean.onclick = () => {
        modalBtnClean.classList.add('active');
        modalBtnOrig.classList.remove('active');
        modalImgPreview.src = cleanUrl;
      };
      modalBtnOrig.onclick = () => {
        modalBtnOrig.classList.add('active');
        modalBtnClean.classList.remove('active');
        modalImgPreview.src = item.origUrl;
      };
    } else {
      modalImgPreview.classList.add('hidden');
      modalVidPreview.classList.remove('hidden');
      modalVidPreview.style.display = 'block';
      modalVidPreview.src = cleanUrl;
    }

    modalBackdrop.classList.add('open');
    batchPreviewModal.classList.add('open');
  }

  function closeBatchPreview() {
    modalBackdrop.classList.remove('open');
    batchPreviewModal.classList.remove('open');
    if (modalVidPreview) modalVidPreview.pause();
  }

  modalBtnClose.addEventListener('click', closeBatchPreview);
  modalBtnCloseFooter.addEventListener('click', closeBatchPreview);
  modalBackdrop.addEventListener('click', closeBatchPreview);

  batchZipBtn.addEventListener('click', async () => {
    const cleanedItems = batchQueue.filter((i) => i.cleanedBlob);
    if (cleanedItems.length === 0) return;

    if (typeof handleExportAd === 'function') handleExportAd();

    batchZipBtn.innerHTML = '<iconify-icon icon="ph:spinner-bold" width="16" class="spin"></iconify-icon>Packaging ZIP...';
    batchZipBtn.disabled = true;

    try {
      const zip = new JSZip();
      cleanedItems.forEach((item) => {
        const ext = item.type === 'Video' ? '.mp4' : appSettings.outputFormat === 'webp' ? '.webp' : '.png';
        const name = item.name.replace(/\.[^/.]+$/, '') + appSettings.suffix + ext;
        zip.file(name, item.cleanedBlob);
      });

      const zipBlob = await zip.generateAsync({ type: 'blob' }, (metadata) => {
        batchZipBtn.textContent = `Packaging ${Math.round(metadata.percent)}%`;
      });

      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `unmarked_batch_${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      batchZipBtn.innerHTML = '<iconify-icon icon="ph:check-bold" width="16"></iconify-icon>Saved ZIP';
      setTimeout(() => {
        batchZipBtn.innerHTML = '<iconify-icon icon="ph:archive-bold" width="16"></iconify-icon>Download all as ZIP';
        batchZipBtn.disabled = false;
      }, 2000);

      showToast(`ZIP downloaded with ${cleanedItems.length} cleaned files!`, 'success');
    } catch (err) {
      console.error(err);
      batchZipBtn.innerHTML = '<iconify-icon icon="ph:archive-bold" width="16"></iconify-icon>Download all as ZIP';
      batchZipBtn.disabled = false;
      showToast('Failed to create ZIP package: ' + err.message, 'error');
    }
  });

  // Pickers & Drag Drop
  dropzone.addEventListener('click', (e) => {
    if (e.target.closest('button')) return;
    if (currentTab === 'image') imageInput.click();
    else if (currentTab === 'video') videoInput.click();
    else batchFileInput.click();
  });

  chooseImgBtn.addEventListener('click', () => imageInput.click());
  chooseVideoBtn.addEventListener('click', () => videoInput.click());
  batchAddMoreBtn.addEventListener('click', () => batchFileInput.click());
  document.getElementById('batch-add-files').addEventListener('click', () => batchFileInput.click());
  document.getElementById('batch-add-folder').addEventListener('click', () => batchFolderInput.click());
  document.getElementById('batch-add-zip').addEventListener('click', () => batchZipInput.click());

  imageInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) loadImageFile(e.target.files[0]);
    imageInput.value = '';
  });

  videoInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) loadVideoFile(e.target.files[0]);
    videoInput.value = '';
  });

  batchFileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) addFilesToBatch(e.target.files);
    batchFileInput.value = '';
  });

  batchFolderInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) addFilesToBatch(e.target.files);
    batchFolderInput.value = '';
  });

  batchZipInput.addEventListener('change', async (e) => {
    if (e.target.files && e.target.files[0]) {
      const zipFile = e.target.files[0];
      try {
        const zip = await JSZip.loadAsync(zipFile);
        const extractedFiles = [];
        for (const [name, fileObj] of Object.entries(zip.files)) {
          if (!fileObj.dir) {
            const blob = await fileObj.async('blob');
            const file = new File([blob], name, { type: blob.type || 'image/png' });
            extractedFiles.push(file);
          }
        }
        addFilesToBatch(extractedFiles);
        showToast(`Extracted ${extractedFiles.length} files from ZIP.`, 'success');
      } catch (err) {
        console.error(err);
        showToast('Could not read ZIP archive.', 'error');
      }
    }
    batchZipInput.value = '';
  });

  ['dragenter', 'dragover'].forEach((eventName) => {
    window.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropzone.setAttribute('data-drag', 'over');
      if (dropTitle) dropTitle.textContent = 'Release to add';
    });
  });

  ['dragleave', 'dragend'].forEach((eventName) => {
    window.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropzone.removeAttribute('data-drag');
      if (dropTitle) dropTitle.textContent = 'Drop an image, video or folder';
    });
  });

  function showDropError() {
    dropzone.classList.add('is-invalid');
    if (dropTitle) dropTitle.textContent = 'That file type is not supported';
    const hudDesc = dropzone.querySelector('.hud span:last-child');
    if (hudDesc) hudDesc.textContent = 'Use PNG, JPG, WEBP, MP4 or ZIP';
    setTimeout(() => {
      dropzone.classList.remove('is-invalid');
      if (dropTitle) dropTitle.textContent = 'Drop an image, video or folder';
      if (hudDesc) hudDesc.textContent = 'Runs in this browser. Nothing is uploaded.';
    }, 2400);
  }

  window.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.removeAttribute('data-drag');
    if (dropTitle) dropTitle.textContent = 'Drop an image, video or folder';
    if (!e.dataTransfer || !e.dataTransfer.files) return;
    const files = e.dataTransfer.files;

    if (files.length === 1) {
      const file = files[0];
      if (file.type.startsWith('image/')) {
        setMode('image');
        loadImageFile(file);
      } else if (file.type.startsWith('video/') || file.name.endsWith('.mp4')) {
        setMode('video');
        loadVideoFile(file);
      } else if (file.name.endsWith('.zip')) {
        setMode('batch');
        JSZip.loadAsync(file).then(async (zip) => {
          const extracted = [];
          for (const [n, f] of Object.entries(zip.files)) {
            if (!f.dir) {
              const b = await f.async('blob');
              extracted.push(new File([b], n, { type: b.type || 'image/png' }));
            }
          }
          addFilesToBatch(extracted);
        }).catch((err) => {
          console.error(err);
          showDropError();
        });
      } else {
        showDropError();
      }
    } else if (files.length > 1) {
      setMode('batch');
      addFilesToBatch(files);
    }
  });

  window.addEventListener('paste', (e) => {
    if (!e.clipboardData || !e.clipboardData.items) return;
    for (const item of e.clipboardData.items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          setMode('image');
          loadImageFile(file);
          showToast('Image pasted from clipboard.', 'info');
          break;
        }
      }
    }
  });

  // Engine Popover & Settings
  engineBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    enginePopover.classList.toggle('open');
  });

  document.addEventListener('click', (e) => {
    if (!enginePopover.contains(e.target) && e.target !== engineBtn) {
      enginePopover.classList.remove('open');
    }
  });

  popCardBrowser.addEventListener('click', () => {
    popCardBrowser.classList.add('selected');
    popCardLocal.classList.remove('selected');
    appSettings.engine = 'browser';
    engineStatusText.textContent = 'In browser';
    engineDot.className = 'dot';
    enginePopover.classList.remove('open');
    showToast('Engine switched to In-browser (100% private).', 'info');
  });

  popCardLocal.addEventListener('click', () => {
    popCardLocal.classList.add('selected');
    popCardBrowser.classList.remove('selected');
    appSettings.engine = 'local';
    engineStatusText.textContent = 'Local engine';
    engineDot.className = 'dot local';
    enginePopover.classList.remove('open');
    showToast('Engine switched to Local engine.', 'info');
  });

  btnTestEngine.addEventListener('click', async (e) => {
    e.stopPropagation();
    localEnginePingStatus.textContent = 'Checking...';
    try {
      const res = await fetch('http://127.0.0.1:8000/api/v1/health');
      if (res.ok) {
        localEnginePingStatus.textContent = 'Connected';
        localEnginePingStatus.className = 'chip ok';
      } else {
        throw new Error();
      }
    } catch {
      localEnginePingStatus.textContent = 'Could not reach it';
      localEnginePingStatus.className = 'chip bad';
    }
  });

  settingsBtn.addEventListener('click', () => {
    settingsDrawer.classList.add('open');
    settingsBackdrop.classList.add('open');
  });

  function closeSettingsDrawer() {
    settingsDrawer.classList.remove('open');
    settingsBackdrop.classList.remove('open');
  }

  btnCloseSettings.addEventListener('click', closeSettingsDrawer);
  settingsBackdrop.addEventListener('click', closeSettingsDrawer);

  settingImgFormat.addEventListener('change', (e) => {
    appSettings.outputFormat = e.target.value;
    btnImgDownloadText.textContent = `Download ${e.target.value.toUpperCase()}`;
  });

  settingSuffix.addEventListener('input', (e) => {
    appSettings.suffix = e.target.value;
  });

  concurrencyDec.addEventListener('click', () => {
    appSettings.concurrency = Math.max(1, appSettings.concurrency - 1);
    concurrencyVal.textContent = appSettings.concurrency;
  });

  concurrencyInc.addEventListener('click', () => {
    appSettings.concurrency = Math.min(4, appSettings.concurrency + 1);
    concurrencyVal.textContent = appSettings.concurrency;
  });

  btnResetSettings.addEventListener('click', () => {
    appSettings = {
      outputFormat: 'png',
      suffix: '_cleaned',
      concurrency: 2,
      checkAllCorners: false,
      engine: 'browser'
    };
    settingImgFormat.value = 'png';
    settingSuffix.value = '_cleaned';
    concurrencyVal.textContent = '2';
    btnImgDownloadText.textContent = 'Download PNG';
    showToast('Settings reset to defaults.', 'info');
  });

  // Shortcuts
  window.addEventListener('keydown', (e) => {
    if (e.target.matches('input, select, textarea')) return;

    if (e.key === '1') setMode('image');
    else if (e.key === '2') setMode('video');
    else if (e.key === '3') setMode('batch');
    else if (e.key === 'o' || e.key === 'O') {
      if (currentTab === 'image') imageInput.click();
      else if (currentTab === 'video') videoInput.click();
      else batchFileInput.click();
    } else if (e.key === 'c' || e.key === 'C') {
      if (currentTab === 'image') {
        const next = compareMode === 'slider' ? 'side' : compareMode === 'side' ? 'flip' : 'slider';
        setCompareMode(next);
      }
    } else if (e.key === 'z' || e.key === 'Z') {
      if (currentTab === 'image') toggleLoupe();
    } else if (e.key === '\\') {
      startHoldOriginal();
    } else if (e.key === 'r' || e.key === 'R') {
      if (currentTab === 'image' && currentCandidate) {
        const rect = compareBox.getBoundingClientRect();
        triggerDissolve(particlesLayer, rect.width / 2, rect.height / 2);
        triggerRevealSweep();
      }
    } else if (e.code === 'Space') {
      if (currentTab === 'video') {
        e.preventDefault();
        btnVideoPlay.click();
      }
    } else if (e.key === ',') {
      if (currentTab === 'video') btnFramePrev.click();
      else settingsBtn.click();
    } else if (e.key === '.') {
      if (currentTab === 'video') btnFrameNext.click();
    } else if (e.key === 'Escape') {
      closeSettingsDrawer();
      closeBatchPreview();
      enginePopover.classList.remove('open');
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.key === '\\') {
      stopHoldOriginal();
    }
  });

  // Nav shadow on scroll
  window.addEventListener('scroll', () => {
    const nav = document.querySelector('.nav');
    if (nav) {
      if (window.scrollY > 8) nav.classList.add('scrolled');
      else nav.classList.remove('scrolled');
    }
  }, { passive: true });

  // Proof Band Interactive Compare Slider
  const proofCompare = document.getElementById('proof-compare');
  const proofMarker = document.getElementById('proof-ruler-marker');
  if (proofCompare) {
    let isDraggingProof = false;

    function setProofPos(pct) {
      const clamped = Math.min(98, Math.max(2, pct));
      proofCompare.style.setProperty('--pos', clamped + '%');
      proofCompare.setAttribute('aria-valuenow', Math.round(clamped));
      proofCompare.setAttribute('aria-valuetext', Math.round(clamped) + ' percent original');
      if (proofMarker) proofMarker.style.left = clamped + '%';
    }

    function handleProofPointer(clientX) {
      const rect = proofCompare.getBoundingClientRect();
      if (rect.width <= 0) return;
      const p = ((clientX - rect.left) / rect.width) * 100;
      setProofPos(p);
    }

    proofCompare.addEventListener('pointerdown', (e) => {
      isDraggingProof = true;
      proofCompare.classList.add('is-dragging');
      proofCompare.setPointerCapture(e.pointerId);
      handleProofPointer(e.clientX);
    });

    proofCompare.addEventListener('pointermove', (e) => {
      if (isDraggingProof) handleProofPointer(e.clientX);
    });

    proofCompare.addEventListener('pointerup', () => {
      isDraggingProof = false;
      proofCompare.classList.remove('is-dragging');
    });

    proofCompare.addEventListener('pointercancel', () => {
      isDraggingProof = false;
      proofCompare.classList.remove('is-dragging');
    });

    proofCompare.addEventListener('keydown', (e) => {
      const current = parseFloat(proofCompare.style.getPropertyValue('--pos')) || 62;
      const step = e.shiftKey ? 10 : 1;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
        e.preventDefault();
        setProofPos(current - step);
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
        e.preventDefault();
        setProofPos(current + step);
      }
    });

    // Reveal animation when entering viewport: settle 100% -> 62% over 700ms once
    if ('IntersectionObserver' in window) {
      let hasAnimated = false;
      const proofObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasAnimated) {
            hasAnimated = true;
            if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
              setProofPos(62);
            } else {
              setProofPos(100);
              const startTime = performance.now();
              const duration = 700;
              function animateSettle(time) {
                const elapsed = time - startTime;
                const t = Math.min(1, elapsed / duration);
                const ease = 1 - Math.pow(1 - t, 3);
                const val = 100 - (100 - 62) * ease;
                setProofPos(val);
                if (t < 1) requestAnimationFrame(animateSettle);
              }
              requestAnimationFrame(animateSettle);
            }
            proofObserver.unobserve(entry.target);
          }
        });
      }, { threshold: 0.15 });
      proofObserver.observe(proofCompare);
    }
  }

  // Modes Spec Sheet Open Buttons
  document.querySelectorAll('.spec-open-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetMode = btn.dataset.modeTarget;
      if (targetMode) {
        setMode(targetMode);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        const dropEl = document.getElementById('dropzone');
        if (dropEl) dropEl.focus();
      }
    });
  });

  // Footer Navigation Mode Jumps
  document.querySelectorAll('[data-mode-jump]').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const mode = link.dataset.modeJump;
      if (mode) {
        setMode(mode);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        const dropEl = document.getElementById('dropzone');
        if (dropEl) dropEl.focus();
      }
    });
  });

  // Whole Window Drag Overlay
  let windowDragCounter = 0;
  window.addEventListener('dragenter', (e) => {
    if (e.dataTransfer && e.dataTransfer.types && Array.from(e.dataTransfer.types).includes('Files')) {
      windowDragCounter++;
      document.body.classList.add('window-drag-over');
    }
  });
  window.addEventListener('dragleave', () => {
    windowDragCounter--;
    if (windowDragCounter <= 0) {
      windowDragCounter = 0;
      document.body.classList.remove('window-drag-over');
    }
  });
  window.addEventListener('drop', () => {
    windowDragCounter = 0;
    document.body.classList.remove('window-drag-over');
  });

  // Default Init
  setMode('image');
  ensureEngines().catch(console.error);
})();
