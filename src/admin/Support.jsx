import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './api'

const fmtTime = (ms) =>
  ms
    ? new Date(ms).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : ''

export default function Support() {
  const [threads, setThreads] = useState(null)
  const [sel, setSel] = useState(null) // email
  const [thread, setThread] = useState(null)
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const listRef = useRef(null)

  const loadThreads = useCallback(async () => {
    try {
      const { threads } = await api.get('/api/admin/support')
      setThreads(threads)
    } catch (e) {
      setError(e.message)
    }
  }, [])

  const loadThread = useCallback(async (email) => {
    if (!email) return
    try {
      const { thread } = await api.get(`/api/admin/support/${encodeURIComponent(email)}`)
      setThread(thread)
    } catch (e) {
      setError(e.message)
    }
  }, [])

  useEffect(() => {
    loadThreads()
    const t = setInterval(loadThreads, 15000)
    return () => clearInterval(t)
  }, [loadThreads])

  useEffect(() => {
    if (!sel) return
    loadThread(sel)
    const t = setInterval(() => loadThread(sel), 12000)
    return () => clearInterval(t)
  }, [sel, loadThread])

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [thread])

  async function send(e) {
    e.preventDefault()
    const body = text.trim()
    if (!body || sending) return
    setSending(true)
    setError('')
    try {
      const { thread } = await api.post(`/api/admin/support/${encodeURIComponent(sel)}`, {
        text: body,
      })
      setThread(thread)
      setText('')
      loadThreads()
    } catch (err) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  async function setStatus(status) {
    try {
      await api.put(`/api/admin/support/${encodeURIComponent(sel)}`, { status })
      loadThread(sel)
      loadThreads()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="adm__panel">
      <h2 className="adm__h2">Support</h2>
      {error && <p className="adm__error">{error}</p>}

      <div className="adm__sup">
        <div className="adm__sup-list">
          {!threads && <p className="adm__muted">Loading…</p>}
          {threads && !threads.length && <p className="adm__muted">No conversations yet.</p>}
          {threads &&
            threads.map((t) => (
              <button
                key={t.email}
                className={`adm__sup-row${sel === t.email ? ' is-active' : ''}`}
                onClick={() => setSel(t.email)}
              >
                <span className="adm__sup-row-top">
                  <strong>{t.userName || t.email}</strong>
                  {t.unreadForAdmin && <span className="adm__sup-dot" />}
                </span>
                <span className="adm__sup-row-prev">
                  {t.lastMessageFrom === 'admin' ? 'You: ' : ''}
                  {t.lastMessagePreview || '—'}
                </span>
                <span className="adm__sup-row-meta">
                  {fmtTime(t.updatedAt)}
                  {t.status === 'closed' && ' · resolved'}
                </span>
              </button>
            ))}
        </div>

        <div className="adm__sup-conv">
          {!sel && <p className="adm__muted">Pick a conversation.</p>}
          {sel && thread && (
            <>
              <div className="adm__sup-conv-head">
                <div>
                  <strong>{thread.userName || thread.email}</strong>
                  <span className="adm__muted"> · {thread.email}</span>
                </div>
                <button
                  className="adm__chip"
                  onClick={() => setStatus(thread.status === 'closed' ? 'open' : 'closed')}
                >
                  {thread.status === 'closed' ? 'Reopen' : 'Mark resolved'}
                </button>
              </div>

              <div className="adm__sup-msgs" ref={listRef}>
                {thread.messages.map((m) => (
                  <div
                    key={m.id}
                    className={`adm__sup-msg adm__sup-msg--${m.from === 'admin' ? 'me' : 'them'}`}
                  >
                    <span className="adm__sup-bubble">{m.text}</span>
                    <span className="adm__sup-time">
                      {m.from === 'admin' ? 'You' : thread.userName || 'Customer'} · {fmtTime(m.at)}
                    </span>
                  </div>
                ))}
              </div>

              <form className="adm__sup-form" onSubmit={send}>
                <textarea
                  className="adm__input"
                  rows={2}
                  maxLength={2000}
                  placeholder="Write a reply…"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) send(e)
                  }}
                />
                <button className="adm__btn" type="submit" disabled={sending || !text.trim()}>
                  {sending ? 'Sending…' : 'Send'}
                </button>
              </form>
              <p className="adm__hint">The customer also gets your reply by email.</p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
