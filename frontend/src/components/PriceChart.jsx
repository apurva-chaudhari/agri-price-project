import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

/**
 * history: [{ price_date, modal_price }]
 * forecast: [{ date, predicted_price }]
 */
export default function PriceChart({ history = [], forecast = [] }) {
  const historyData = history.map((h) => ({
    date: h.price_date?.slice(0, 10) || h.price_date,
    actual: Number(h.modal_price),
  }));
  const forecastData = forecast.map((f) => ({
    date: f.date,
    predicted: Number(f.predicted_price),
  }));

  // Merge on date for a single continuous x-axis
  const merged = [...historyData];
  forecastData.forEach((f) => merged.push({ date: f.date, predicted: f.predicted }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={merged}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip />
        <Legend />
        <Line type="monotone" dataKey="actual" name="Actual price (₹/quintal)" stroke="#2e7d32" dot={false} strokeWidth={2} />
        <Line type="monotone" dataKey="predicted" name="Forecast" stroke="#f57c00" strokeDasharray="5 5" dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
