/**
 * Cosine similarity between two equal-length embedding vectors.
 * Used to match a farmer's crop photo against a broker's Grade A/B/C
 * reference photos — the closest reference (by embedding similarity)
 * determines the matched grade.
 *
 * Returns a value in roughly [-1, 1]; 1 = identical direction (very similar
 * images), 0 = unrelated, negative = opposite.
 */
function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length || a.length === 0) return -1;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  if (magA === 0 || magB === 0) return -1;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

module.exports = { cosineSimilarity };
