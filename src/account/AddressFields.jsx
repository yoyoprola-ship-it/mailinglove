import { US_STATES } from './states'

// Controlled US-address field group. `value` is { line1, line2, city, state, zip };
// `onChange(next)` gets the whole updated object.
export default function AddressFields({ value, onChange }) {
  const set = (k, v) => onChange({ ...value, [k]: v })

  return (
    <>
      <label className="acc__label">
        Street address
        <input
          className="acc__input"
          value={value.line1 || ''}
          onChange={(e) => set('line1', e.target.value)}
          placeholder="123 Main St"
          required
        />
      </label>

      <label className="acc__label">
        Apt / suite / unit <span className="acc__opt">(optional)</span>
        <input
          className="acc__input"
          value={value.line2 || ''}
          onChange={(e) => set('line2', e.target.value)}
        />
      </label>

      <div className="acc__row">
        <label className="acc__label acc__label--grow">
          City
          <input
            className="acc__input"
            value={value.city || ''}
            onChange={(e) => set('city', e.target.value)}
            required
          />
        </label>
        <label className="acc__label">
          State
          <select
            className="acc__input"
            value={value.state || ''}
            onChange={(e) => set('state', e.target.value)}
            required
          >
            <option value="">—</option>
            {US_STATES.map(([code, label]) => (
              <option key={code} value={code}>
                {code} — {label}
              </option>
            ))}
          </select>
        </label>
        <label className="acc__label">
          ZIP
          <input
            className="acc__input acc__input--zip"
            value={value.zip || ''}
            onChange={(e) => set('zip', e.target.value)}
            placeholder="10001"
            inputMode="numeric"
            required
          />
        </label>
      </div>
    </>
  )
}
