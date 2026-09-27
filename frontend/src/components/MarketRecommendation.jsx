export default function MarketRecommendation({ data }) {
  if (!data || !data.recommendations?.length) return null;

  return (
    <div className="recommend-box">
      <h3>Best markets to sell {data.commodity}</h3>
      <p className="hint">Ranked by estimated net profit = price − transport cost, for {data.quantityQuintals} quintal(s)</p>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Market</th>
            <th>Distance</th>
            <th>Grade</th>
            <th>Price</th>
            <th>Transport cost</th>
            <th>Net profit</th>
          </tr>
        </thead>
        <tbody>
          {data.recommendations.map((r, i) => (
            <tr key={r.market_id} className={i === 0 ? 'best-row' : ''}>
              <td>{i + 1}{i === 0 ? ' 🏆' : ''}</td>
              <td>{r.market_name}<br /><small>{r.district}, {r.state}</small></td>
              <td>{r.distance_km} km</td>
              <td>
                <span className={`grade-pill grade-${r.matched_grade}`}>{r.matched_grade}</span>
                {r.broker_priced && <span className="broker-pill" title="Priced by this market's broker, matched against their reference photos">Broker-priced</span>}
              </td>
              <td>₹{r.grade_adjusted_price}/quintal</td>
              <td>₹{r.estimated_transport_cost}</td>
              <td><strong>₹{r.estimated_net_profit}</strong></td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="hint broker-legend">
        "Broker-priced" rows use that market's own daily grade prices, with your photo matched against the broker's real reference photos — not an estimate.
        Other rows use a general forecast since no broker has set up grading there yet.
      </p>
    </div>
  );
}
