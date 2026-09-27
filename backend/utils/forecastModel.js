/**
 * Lightweight price forecaster using ordinary least-squares linear
 * regression over recent daily modal prices, plus a fallback moving
 * average for smoothing.
 *
 * This keeps the backend dependency-free (no TensorFlow/Python needed
 * to run the whole project). It's intentionally simple; the accompanying
 * report can note this as v1, with LSTM (see the earlier APMC forecasting
 * project) as a documented future upgrade path for higher accuracy.
 *
 * @param {Array<{price_date: string, modal_price: number}>} history - ascending by date
 * @param {number} daysAhead - how many days into the future to predict
 * @returns {Array<{date: string, predicted_price: number}>}
 */
function forecastPrices(history, daysAhead = 7) {
  if (!history || history.length < 3) {
    return [];
  }

  const n = history.length;
  const xs = history.map((_, i) => i);
  const ys = history.map((h) => Number(h.modal_price));

  const xMean = xs.reduce((a, b) => a + b, 0) / n;
  const yMean = ys.reduce((a, b) => a + b, 0) / n;

  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - xMean) * (ys[i] - yMean);
    den += (xs[i] - xMean) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  const intercept = yMean - slope * xMean;

  const lastDate = new Date(history[n - 1].price_date);
  const results = [];
  for (let d = 1; d <= daysAhead; d++) {
    const x = n - 1 + d;
    let predicted = intercept + slope * x;
    predicted = Math.max(predicted, 0);
    const date = new Date(lastDate);
    date.setDate(date.getDate() + d);
    results.push({
      date: date.toISOString().slice(0, 10),
      predicted_price: Math.round(predicted * 100) / 100,
    });
  }
  return results;
}

module.exports = { forecastPrices };
