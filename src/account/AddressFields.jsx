import { useEffect, useRef } from 'react'
import { US_STATES } from './states'
import { googleMapsConfigured, loadGoogleMaps, placeToAddress } from './googleMaps'

// Controlled US-address field group. `value` is { line1, line2, city, state, zip };
// `onChange(next)` gets the whole updated object. The street field wires up
// Google Places autocomplete when a maps key is configured — picking a
// suggestion fills city/state/zip too; typing manually still works either way.
export default function AddressFields({ value, onChange }) {
  const line1Ref = useRef(null)
  const onChangeRef = useRef(onChange)
  const valueRef = useRef(value)
  onChangeRef.current = onChange
  valueRef.current = value

  const set = (k, v) => onChange({ ...value, [k]: v })

  useEffect(() => {
    if (!googleMapsConfigured() || !line1Ref.current) return
    let autocomplete
    let listener
    let cancelled = false

    loadGoogleMaps()
      .then((google) => {
        if (cancelled || !line1Ref.current) return
        autocomplete = new google.maps.places.Autocomplete(line1Ref.current, {
          componentRestrictions: { country: 'us' },
          fields: ['address_components'],
          types: ['address'],
        })
        listener = autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace()
          const picked = placeToAddress(place)
          if (!picked.line1) return // no address_components — user hit Enter on free text
          onChangeRef.current({ ...valueRef.current, ...picked })
        })
      })
      .catch(() => {
        /* no autocomplete — the plain inputs still work */
      })

    return () => {
      cancelled = true
      if (listener) listener.remove()
      if (autocomplete) window.google?.maps?.event?.clearInstanceListeners(autocomplete)
    }
  }, [])

  return (
    <>
      <label className="acc__label">
        Street address
        <input
          ref={line1Ref}
          className="acc__input"
          value={value.line1 || ''}
          onChange={(e) => set('line1', e.target.value)}
          placeholder="123 Main St"
          autoComplete="off"
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

      <label className="acc__label">
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
          className="acc__input"
          value={value.zip || ''}
          onChange={(e) => set('zip', e.target.value)}
          placeholder="10001"
          inputMode="numeric"
          required
        />
      </label>
    </>
  )
}
