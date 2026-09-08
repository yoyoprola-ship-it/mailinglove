import { useState } from 'react'
import { createPortal } from 'react-dom'

// Small popup shown right after the customer picks a sign-in method when
// they haven't agreed to the Terms yet: just the checkbox + Continue.
// Keeps the Google credential alive so they don't have to sign in twice.
export default function ConsentGate({ onAccept, onClose, busy }) {
  const [agree, setAgree] = useState(false)

  return createPortal(
    <div
      className="cgate"
      onClick={(e) => {
        e.stopPropagation()
        if (!busy) onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Accept the terms to continue"
    >
      <div className="cgate__box" onClick={(e) => e.stopPropagation()}>
        <p className="cgate__title">One last step</p>
        <label className="cgate__check">
          <input
            type="checkbox"
            checked={agree}
            onChange={(e) => setAgree(e.target.checked)}
          />
          <span>
            I have read and agree to the{' '}
            <a href="/terms" target="_blank" rel="noopener noreferrer">
              Terms &amp; Conditions
            </a>{' '}
            and{' '}
            <a href="/privacy" target="_blank" rel="noopener noreferrer">
              Privacy Policy
            </a>
            .
          </span>
        </label>
        <button
          className="btn btn--primary cgate__go"
          type="button"
          disabled={!agree || busy}
          onClick={onAccept}
        >
          {busy ? 'Signing in…' : 'Continue'}
        </button>
        <button type="button" className="cgate__link" onClick={onClose} disabled={busy}>
          Cancel
        </button>
      </div>
    </div>,
    document.body
  )
}
