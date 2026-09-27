import { useRef, useState } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as mobilenet from '@tensorflow-models/mobilenet';
import api from '../api';

/**
 * Handles: photo capture/upload -> MobileNet classification (runs fully in
 * the browser, no server round-trip) -> match against our known commodity
 * list -> simple canvas-based quality grading.
 *
 * commodities: [{ id, name, imagenet_labels }] fetched from the backend.
 * onResult(result) is called with:
 *   { commodity, confidence, grade, qualityScore, imageFile, matched }
 */
export default function PhotoUpload({ commodities, onResult }) {
  const [preview, setPreview] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | loading-model | classifying | done | error
  const [manualCommodity, setManualCommodity] = useState('');
  const [lastPrediction, setLastPrediction] = useState(null);
  const fileInputRef = useRef(null);
  const imgRef = useRef(null);
  const modelRef = useRef(null);

  async function ensureModel() {
    if (!modelRef.current) {
      setStatus('loading-model');
      modelRef.current = await mobilenet.load();
    }
    return modelRef.current;
  }

  // MobileNet's own top guess is only trustworthy above this confidence —
  // below it, a "match" is really just the nearest class it happens to know,
  // which is exactly what was producing wrong labels like "Cucumber" for a
  // tomato photo. Below threshold we discard the guess and fall through to
  // the color-based estimator, then to manual selection.
  const MIN_MOBILENET_CONFIDENCE = 0.55;

  // Simple HSV-based color-signature fallback for common produce that ISN'T
  // in ImageNet's 1000 classes at all (tomato, onion, potato, garlic — none
  // of these have a matching ImageNet category, so MobileNet can never get
  // them right no matter the confidence bar). This is a transparent color
  // heuristic, not a trained model — flagged as such in the UI — but it
  // correctly catches the common case a farmer actually photographs.
  const COLOR_SIGNATURES = [
    { commodity: 'Tomato', hueCenter: 6, hueTolerance: 20, minSat: 0.42, minVal: 0.3 },
    { commodity: 'Onion', hueCenter: 300, hueTolerance: 35, minSat: 0.1, maxVal: 0.8 },
    { commodity: 'Potato', hueCenter: 35, hueTolerance: 14, minSat: 0.08, maxSat: 0.5 },
    { commodity: 'Garlic', hueCenter: 45, hueTolerance: 30, maxSat: 0.15, minVal: 0.55 },
  ];

  function hueDistance(a, b) {
    const d = Math.abs(a - b) % 360;
    return d > 180 ? 360 - d : d;
  }

  function guessByColor(hueDeg, avgSat, avgVal) {
    for (const sig of COLOR_SIGNATURES) {
      if (hueDistance(hueDeg, sig.hueCenter) > sig.hueTolerance) continue;
      if (sig.minSat !== undefined && avgSat < sig.minSat) continue;
      if (sig.maxSat !== undefined && avgSat > sig.maxSat) continue;
      if (sig.minVal !== undefined && avgVal < sig.minVal) continue;
      if (sig.maxVal !== undefined && avgVal > sig.maxVal) continue;
      const match = commodities.find((c) => c.name.toLowerCase().includes(sig.commodity.toLowerCase()));
      if (match) return match;
    }
    return null;
  }


  // Matches a MobileNet/ImageNet class string against our commodities table.
  function matchCommodity(imagenetClassName) {
    const lower = imagenetClassName.toLowerCase();
    for (const c of commodities) {
      const labels = (c.imagenet_labels || '').split(',').map((l) => l.trim().toLowerCase());
      if (labels.some((label) => label && lower.includes(label))) {
        return c;
      }
    }
    return null;
  }

  /**
   * Explainable quality heuristic, matched to how a farmer actually judges
   * produce visually — e.g. for a banana: solid, even, vivid color with
   * little to no black/brown spotting = Grade A; some spotting = Grade B;
   * heavy dark spotting or dull/discolored skin = Grade C.
   *
   * Method: sample pixels on the produce itself (skip near-white background),
   * convert to HSV, and measure:
   *   1. darkSpotRatio  - % of produce-pixels that are dark/black (blemishes,
   *                        bruising, rot spots)
   *   2. colorVividness - average saturation (dull/faded skin scores lower
   *                        than bright, fresh-looking skin)
   *
   * This is a transparent, rule-based stand-in for a trained defect-detection
   * CNN — documented as a limitation/future-scope item in the report, but it
   * gives genuinely different, explainable grades for clean vs. spotted photos.
   */
  function gradeQuality(imageEl) {
    const canvas = document.createElement('canvas');
    const size = 160;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(imageEl, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);

    let darkPixels = 0;
    let produceCount = 0;
    let saturationSum = 0;
    let valueSum = 0;
    let hueSinSum = 0;
    let hueCosSum = 0;
    let whiteCount = 0;
    let whiteBrightnessSum = 0;
    const totalPixels = data.length / 4;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      const brightness = (r + g + b) / 3;
      const value = max / 255;
      const saturation = max === 0 ? 0 : (max - min) / max; // 0-1

      // Track whiteness across the WHOLE frame (not just non-background
      // pixels) — needed for cotton, whose actual product IS white/cream
      // fiber. Normal background exclusion would wrongly treat the cotton
      // itself as "backdrop", so this is measured separately.
      const isWhitish = saturation < 0.18 && brightness > 150;
      if (isWhitish) { whiteCount++; whiteBrightnessSum += brightness; }

      // Background/non-produce: any fairly bright, neutral (low-saturation)
      // surface — a white backdrop, a gray steel tray, a wooden table, a
      // countertop.
      const isBackground = saturation < 0.15 && brightness > 95;
      if (isBackground) continue;

      produceCount++;
      saturationSum += saturation;
      valueSum += value;

      // Hue (degrees), weighted by saturation so weak/ambiguous pixels
      // barely influence the average dominant color.
      let hue = 0;
      const delta = max - min;
      if (delta !== 0) {
        if (max === r) hue = ((g - b) / delta) % 6;
        else if (max === g) hue = (b - r) / delta + 2;
        else hue = (r - g) / delta + 4;
        hue *= 60;
        if (hue < 0) hue += 360;
      }
      hueSinSum += Math.sin((hue * Math.PI) / 180) * saturation;
      hueCosSum += Math.cos((hue * Math.PI) / 180) * saturation;

      // Two-tier blemish rule, applied only to genuine produce pixels
      // (background already excluded above):
      //   - very dark (brightness < 42) counts as a blemish/hole regardless
      //     of color — nothing on healthy produce is ever that dark
      //   - moderately dark (42-72) counts only if also fairly desaturated,
      //     i.e. grayish/muddy rot rather than a plain reddish shadow between
      //     pieces of produce, which stays saturated even when dim
      const isDefiniteBlemish = brightness < 42;
      const isProbableBlemish = brightness < 72 && saturation < 0.45;
      if (isDefiniteBlemish || isProbableBlemish) darkPixels++;
    }

    if (produceCount === 0) produceCount = 1; // guard divide-by-zero
    const darkSpotPct = Math.round((darkPixels / produceCount) * 100);
    const avgSaturation = saturationSum / produceCount; // 0-1, higher = more vivid
    const avgValue = valueSum / produceCount; // 0-1, brightness of the produce itself
    let hueDeg = (Math.atan2(hueSinSum, hueCosSum) * 180) / Math.PI;
    if (hueDeg < 0) hueDeg += 360;

    const whiteFraction = whiteCount / totalPixels;
    const avgWhiteBrightness = whiteCount > 0 ? whiteBrightnessSum / whiteCount : 0;

    // Hue coherence: how strongly the frame points to ONE dominant color vs.
    // being a mix of many (sky, soil, leaves, multiple objects). Near 1 =
    // single uniform subject (good for color-guessing); near 0 = busy,
    // multi-element scene where a single-hue guess would be unreliable.
    const coherence = saturationSum > 0
      ? Math.sqrt(hueSinSum ** 2 + hueCosSum ** 2) / saturationSum
      : 0;

    // Score 0-100: start from color vividness, subtract for dark spotting.
    let score = avgSaturation * 100 - darkSpotPct * 2.2;
    score = Math.max(0, Math.min(100, Math.round(score)));

    let grade = 'C';
    if (darkSpotPct <= 4 && score >= 55) grade = 'A';
    else if (darkSpotPct <= 12 && score >= 35) grade = 'B';
    // else stays C: heavy spotting or dull/faded color

    return { grade, score, darkSpotPct, hueDeg, avgSaturation, avgValue, whiteFraction, avgWhiteBrightness, coherence };
  }

  /**
   * Cotton-specific grading: raw cotton is graded by fiber whiteness/
   * brightness and trash content, NOT by "absence of black spots" — the
   * dark, papery bracts/calyx around a cotton boll are a normal structural
   * feature, not a defect. Using the generic blemish-based grader on cotton
   * was previously flagging that normal dark husk as heavy spotting.
   */
  function gradeCotton(whiteFraction, avgWhiteBrightness) {
    let score = whiteFraction * 70 + (avgWhiteBrightness / 255) * 30;
    score = Math.round(Math.max(0, Math.min(100, score)));
    let grade = 'C';
    if (whiteFraction >= 0.5 && avgWhiteBrightness >= 195) grade = 'A';
    else if (whiteFraction >= 0.3 && avgWhiteBrightness >= 165) grade = 'B';
    return { grade, score };
  }

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setStatus('classifying');
    setLastPrediction(null);

    const url = URL.createObjectURL(file);
    setPreview(url);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = async () => {
      try {
        const model = await ensureModel();
        const predictions = await model.classify(img);
        const quality = gradeQuality(img);

        // Feature embedding (pre-classification activations) — used to
        // compare this photo against a broker's Grade A/B/C reference
        // photos via cosine similarity, so the grade shown matches what
        // that specific mandi's broker actually defines, not just an
        // independent AI opinion.
        let embedding = null;
        try {
          const embeddingTensor = model.infer(img, true);
          embedding = Array.from(await embeddingTensor.data());
          embeddingTensor.dispose();
        } catch (embedErr) {
          console.warn('Embedding extraction failed, broker-matching will be skipped:', embedErr);
        }

        // --- Primary method: match this photo directly against every broker's
        // fixed Grade A/B/C reference photos. This is more reliable than a
        // generic ImageNet/color guess because it's grounded in real photos
        // a human broker uploaded, and it identifies the crop AND the grade
        // in one step. Only falls through to the generic guesser below if no
        // broker reference photo is a confident match.
        if (embedding) {
          try {
            const { data: idResult } = await api.post('/broker/identify', { embedding });
            if (idResult.matched && idResult.best) {
              const refMatch = commodities.find((c) => c.id === idResult.best.commodity_id);
              const result = {
                commodity: idResult.best.commodity_name,
                confidence: Math.round(idResult.best.similarity * 100),
                grade: idResult.best.grade,
                qualityScore: quality.score,
                darkSpotPct: quality.darkSpotPct,
                imageFile: file,
                matched: true,
                referenceMatched: true,
                matchedMarketName: idResult.best.market_name,
                matchedNotes: idResult.best.notes,
                embedding,
                rawTopGuesses: [],
              };
              setLastPrediction(result);
              setStatus('done');
              return;
            }
          } catch (idErr) {
            console.warn('Reference-photo matching failed, falling back to generic estimate:', idErr);
          }
        }

        let matched = null;
        let confidence = 0;
        let colorGuessed = false;
        let busyPhoto = false;
        let grade = quality.grade;
        let qualityScore = quality.score;
        let darkSpotPct = quality.darkSpotPct;

        const cottonCommodity = commodities.find((c) => c.name.toLowerCase().includes('cotton'));

        // Raised from 0.35 -> 0.6 and now also requires very bright whites:
        // the old lower bar was catching produce shot on plain WHITE
        // BACKGROUNDS (e.g. tomatoes on a white sheet) as if they were cotton
        // fiber, since background pixels alone pushed whiteFraction past 0.35.
        if (cottonCommodity && quality.whiteFraction > 0.6 && quality.avgWhiteBrightness > 210) {
          // Dominated by white/cream fiber across the frame — almost
          // certainly cotton. Grade it on whiteness, not blemish presence.
          matched = cottonCommodity;
          confidence = 65;
          colorGuessed = true;
          const cottonGrade = gradeCotton(quality.whiteFraction, quality.avgWhiteBrightness);
          grade = cottonGrade.grade;
          qualityScore = cottonGrade.score;
          darkSpotPct = null; // not a meaningful metric for cotton
        } else {
          for (const p of predictions) {
            const m = matchCommodity(p.className);
            if (m && p.probability >= MIN_MOBILENET_CONFIDENCE) {
              matched = m;
              confidence = Math.round(p.probability * 100);
              break;
            }
          }

          if (!matched) {
            if (quality.coherence >= 0.45) {
              // Frame is dominated by one fairly consistent color — safe to
              // attempt the color-signature fallback (tomato/onion/potato/garlic).
              const colorMatch = guessByColor(quality.hueDeg, quality.avgSaturation, quality.avgValue);
              if (colorMatch) {
                matched = colorMatch;
                confidence = 60;
                colorGuessed = true;
              }
            }
            // else: coherence too low (mixed colors — sky, soil, leaves,
            // multiple objects) to trust a single-hue guess at all. Falls
            // through to manual selection instead of guessing wrong.
          }
        }

        // A photo with very low hue coherence (a wide field/landscape shot
        // rather than a close-up of the produce) also isn't reliable to
        // GRADE, even if a crop name was found some other way — flag it
        // honestly instead of showing a confident-looking but meaningless
        // A/B/C. Cotton's own whiteness-based grade is unaffected by this.
        if (matched !== cottonCommodity && quality.coherence < 0.25) {
          busyPhoto = true;
          grade = 'B'; // neutral default if the farmer proceeds anyway — better than a wild/wrong extreme
        }

        const result = {
          commodity: matched ? matched.name : null,
          confidence,
          grade,
          qualityScore,
          darkSpotPct,
          imageFile: file,
          matched: !!matched,
          colorGuessed,
          busyPhoto,
          embedding,
          rawTopGuesses: predictions.map((p) => p.className),
        };
        setLastPrediction(result);
        setStatus('done');
      } catch (err) {
        console.error(err);
        setStatus('error');
      }
    };
    img.src = url;
    imgRef.current = img;
  }

  function confirmManual() {
    if (!manualCommodity) return;
    onResult({
      commodity: manualCommodity,
      confidence: 100,
      grade: lastPrediction?.grade || 'B',
      qualityScore: lastPrediction?.qualityScore || 60,
      darkSpotPct: lastPrediction?.darkSpotPct,
      imageFile: lastPrediction?.imageFile,
      embedding: lastPrediction?.embedding,
      matched: true,
    });
  }

  function confirmDetected() {
    if (lastPrediction) onResult(lastPrediction);
  }

  return (
    <div className="upload-card">
      <label className="file-drop">
        <input type="file" accept="image/*" capture="environment" ref={fileInputRef} onChange={handleFile} hidden />
        {preview ? <img src={preview} alt="preview" className="preview-img" /> : <span>Tap to take / upload a crop photo</span>}
      </label>
      <p className="upload-tip">Tip: for the most accurate grading, photograph 1–3 pieces on a plain background rather than a full crate.</p>

      {status === 'loading-model' && <p className="status-text">Loading vision model (first time only)...</p>}
      {status === 'classifying' && <p className="status-text">Analyzing photo...</p>}

      {status === 'done' && lastPrediction && (
        <div className="result-box">
          {lastPrediction.matched ? (
            <p className="detected-line">
              Detected: <strong>{lastPrediction.commodity}</strong>
              <span className="confidence-chip">
                {lastPrediction.referenceMatched
                  ? `matched to ${lastPrediction.matchedMarketName}'s reference photo · ${lastPrediction.confidence}% similar`
                  : lastPrediction.colorGuessed ? 'estimated by color' : `${lastPrediction.confidence}% confidence`}
              </span>
            </p>
          ) : (
            <p>Couldn't confidently identify the crop from the photo. Please select it manually below:</p>
          )}
          {lastPrediction.referenceMatched && (
            <p className="grade-note">
              This grade is matched directly against a real photo a broker uploaded — not a generic guess.
              {lastPrediction.matchedNotes ? ` Broker's note: "${lastPrediction.matchedNotes}"` : ''}
            </p>
          )}

          <div className="quality-panel">
            {lastPrediction.busyPhoto ? (
              <p className="grade-note busy-note">
                ⚠️ This photo has a lot of mixed background (sky, soil, multiple plants, etc.) — not reliable to grade confidently.
                Please retake a closer photo of just the produce for an accurate grade.
              </p>
            ) : (
              <>
                <div className={`grade-badge grade-${lastPrediction.grade}`}>Grade {lastPrediction.grade}</div>
                <div className="quality-details">
                  {lastPrediction.darkSpotPct !== null && (
                    <div className="quality-metric">
                      <span>Dark/black spots detected</span>
                      <div className="meter"><div className="meter-fill spot" style={{ width: `${Math.min(lastPrediction.darkSpotPct ?? 0, 100)}%` }} /></div>
                      <span className="metric-value">{lastPrediction.darkSpotPct ?? 0}%</span>
                    </div>
                  )}
                  <div className="quality-metric">
                    <span>{lastPrediction.darkSpotPct === null ? 'Fiber whiteness score' : 'Freshness / color score'}</span>
                    <div className="meter"><div className="meter-fill fresh" style={{ width: `${lastPrediction.qualityScore}%` }} /></div>
                    <span className="metric-value">{lastPrediction.qualityScore}/100</span>
                  </div>
                  <p className="grade-note">
                    {lastPrediction.darkSpotPct === null
                      ? 'Cotton is graded by fiber whiteness/brightness, not black-spot presence — the dark bracts around raw cotton are normal, not a defect.'
                      : <>
                          {lastPrediction.grade === 'A' && 'Clean, vivid color with minimal spotting — sells near full market price.'}
                          {lastPrediction.grade === 'B' && 'Some spotting or dullness — typically sells a bit below top price.'}
                          {lastPrediction.grade === 'C' && 'Heavy spotting or discoloration — typically sells well below top price.'}
                        </>}
                  </p>
                </div>
              </>
            )}
          </div>

          {lastPrediction.matched && <button onClick={confirmDetected}>Use this result</button>}

          <div className="manual-select">
            <select value={manualCommodity} onChange={(e) => setManualCommodity(e.target.value)}>
              <option value="">-- select crop manually --</option>
              {commodities.map((c) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
            <button onClick={confirmManual} disabled={!manualCommodity}>
              {lastPrediction.matched ? 'Or use manual selection' : 'Confirm crop'}
            </button>
          </div>
        </div>
      )}

      {status === 'error' && <p className="status-text error">Something went wrong analyzing the photo. Try again.</p>}
    </div>
  );
}
