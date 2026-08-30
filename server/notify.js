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

export async function sendEmail(to, subject, text) {
  if (!emailConfigured()) throw new Error('Email not configured')
  const { error } = await resend.emails.send({ from: process.env.RESEND_FROM, to, subject, text })
  if (error) throw new Error(error.message || 'Resend send failed')
}
