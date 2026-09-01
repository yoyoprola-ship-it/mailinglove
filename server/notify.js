import twilio from 'twilio'
import { Resend } from 'resend'

const twilioClient =
  process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
    ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    : null

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

export function smsConfigured() {
  return Boolean(twilioClient && process.env.TWILIO_SMS_FROM)
}

export function emailConfigured() {
  return Boolean(resend && process.env.RESEND_FROM)
}

export async function sendSms(to, body) {
  if (!smsConfigured()) throw new Error('SMS not configured')
  await twilioClient.messages.create({ to, from: process.env.TWILIO_SMS_FROM, body })
}

// `body` is either a plain string or { text, html } (use renderEmail()).
export async function sendEmail(to, subject, body) {
  if (!emailConfigured()) throw new Error('Email not configured')
  const payload = { from: process.env.RESEND_FROM, to, subject }
  if (body && typeof body === 'object') {
    if (body.text) payload.text = body.text
    if (body.html) payload.html = body.html
  } else {
    payload.text = String(body || '')
  }
  const { error } = await resend.emails.send(payload)
  if (error) throw new Error(error.message || 'Resend send failed')
}
