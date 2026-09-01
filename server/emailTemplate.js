// Builds a branded HTML email (table layout, inline styles for client
// compatibility) plus a matching plain-text version. Every transactional
// email goes through here so they all look the same.

const SITE = 'https://mailinglove.com'
const LOGO = `${SITE}/logo.png`

const C = {
  ink: '#2b2020',
  rose900: '#4a1626',
  rose: '#b8355f',
  blush: '#fbe6ec',
  cream: '#fff8f5',
  muted: '#8a7278',
  line: '#efe3e7',
  card: '#ffffff',
}

const esc = (s) =>
  String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

const nl2br = (s) => esc(s).replace(/\n/g, '<br>')

function block(b) {
  if (b.hr) {
    return `<tr><td style="padding:6px 0"><hr style="border:none;border-top:1px solid ${C.line};margin:0"></td></tr>`
  }
  if (b.code != null) {
    return `<tr><td style="padding:6px 0 14px">
      <div style="background:${C.blush};border:1px solid ${C.line};border-radius:12px;padding:18px 20px;text-align:center">
        <div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:${C.muted};margin-bottom:6px">Verification code</div>
        <div style="font-size:34px;font-weight:700;letter-spacing:.24em;color:${C.rose900};font-family:'SFMono-Regular',Consolas,Menlo,monospace">${esc(b.code)}</div>
      </div></td></tr>`
  }
  if (b.list) {
    const items = b.list
      .map(
        (li) =>
          `<li style="margin:0 0 6px">${nl2br(li)}</li>`
      )
      .join('')
    return `<tr><td style="padding:2px 0 12px"><ul style="margin:0;padding-left:20px;color:${C.ink};font-size:15px;line-height:1.6">${items}</ul></td></tr>`
  }
  if (b.rows) {
    const trs = b.rows
      .map(
        ([k, v]) =>
          `<tr>
             <td style="padding:6px 12px 6px 0;color:${C.muted};font-size:14px;vertical-align:top;white-space:nowrap">${esc(k)}</td>
             <td style="padding:6px 0;color:${C.ink};font-size:14px;vertical-align:top">${nl2br(v)}</td>
           </tr>`
      )
      .join('')
    return `<tr><td style="padding:4px 0 14px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">${trs}</table></td></tr>`
  }
  if (b.quote != null) {
    return `<tr><td style="padding:4px 0 14px">
      <div style="border-left:3px solid ${C.rose};background:${C.cream};padding:12px 16px;border-radius:0 10px 10px 0;color:${C.ink};font-size:15px;line-height:1.6">${nl2br(b.quote)}</div></td></tr>`
  }
  if (b.small != null) {
    return `<tr><td style="padding:2px 0 10px;color:${C.muted};font-size:13px;line-height:1.6">${nl2br(b.small)}</td></tr>`
  }
  // default: paragraph
  return `<tr><td style="padding:2px 0 12px;color:${C.ink};font-size:15px;line-height:1.65">${nl2br(b.p || '')}</td></tr>`
}

function ctaRow(cta) {
  if (!cta || !cta.href) return ''
  return `<tr><td style="padding:8px 0 6px">
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td style="background:${C.rose};border-radius:999px">
        <a href="${esc(cta.href)}" style="display:inline-block;padding:12px 26px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;font-family:Arial,Helvetica,sans-serif">${esc(cta.label || 'Open')}</a>
      </td>
    </tr></table></td></tr>`
}

// --- text version ----------------------------------------------------

function textBlock(b) {
  if (b.hr) return '----------------------------------------'
  if (b.code != null) return `\n    ${b.code}\n`
  if (b.list) return b.list.map((li) => `  • ${li}`).join('\n')
  if (b.rows) return b.rows.map(([k, v]) => `${k}: ${v}`).join('\n')
  if (b.quote != null) return b.quote.replace(/^/gm, '> ')
  if (b.small != null) return b.small
  return b.p || ''
}

export function renderEmail({
  preheader = '',
  title = '',
  greeting = '',
  blocks = [],
  cta = null,
  footNote = '',
} = {}) {
  const bodyRows = blocks.map(block).join('\n')

  const html = `<!doctype html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:${C.cream};font-family:Arial,Helvetica,sans-serif">
  <span style="display:none!important;opacity:0;color:transparent;height:0;width:0;overflow:hidden">${esc(preheader)}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.cream}">
    <tr><td align="center" style="padding:28px 16px">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%">
        <tr><td style="padding:0 4px 16px">
          <a href="${SITE}"><img src="${LOGO}" alt="MailingLove" height="30" style="height:30px;display:block;border:0"></a>
        </td></tr>
        <tr><td style="background:${C.card};border:1px solid ${C.line};border-radius:18px;padding:32px 34px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${title ? `<tr><td style="padding-bottom:10px"><h1 style="margin:0;font-size:21px;color:${C.rose900};font-family:Georgia,'Times New Roman',serif">${esc(title)}</h1></td></tr>` : ''}
            ${greeting ? `<tr><td style="padding:2px 0 12px;color:${C.ink};font-size:15px">${esc(greeting)}</td></tr>` : ''}
            ${bodyRows}
            ${ctaRow(cta)}
          </table>
        </td></tr>
        <tr><td style="padding:18px 8px 0;color:${C.muted};font-size:12px;line-height:1.6">
          ${footNote ? `${esc(footNote)}<br><br>` : ''}
          MailingLove · Photos &amp; postcards, printed and mailed.<br>
          <a href="${SITE}" style="color:${C.muted}">mailinglove.com</a> ·
          <a href="${SITE}/terms" style="color:${C.muted}">Terms</a> ·
          <a href="${SITE}/privacy" style="color:${C.muted}">Privacy</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`

  const textParts = [
    title,
    '',
    greeting,
    greeting ? '' : null,
    ...blocks.map(textBlock),
    cta && cta.href ? `\n${cta.label || 'Open'}: ${cta.href}` : null,
    '',
    footNote || null,
    '— MailingLove · mailinglove.com',
  ].filter((x) => x !== null && x !== undefined)

  const text = textParts.join('\n').replace(/\n{3,}/g, '\n\n').trim()

  return { html, text }
}
