import twilio from 'twilio'
import sgMail from '@sendgrid/mail'

const twilioClient =
  process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
    ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    : null

if (process.env.SENDGRID_API_KEY) sgMail.setApiKey(process.env.SENDGRID_API_KEY)

export function smsConfigured() {
  return Boolean(twilioClient && process.env.TWILIO_SMS_FROM)
}

export function emailConfigured() {
  return Boolean(process.env.SENDGRID_API_KEY && process.env.SENDGRID_FROM)
}

export async function sendSms(to, body) {
  if (!smsConfigured()) throw new Error('SMS not configured')
  await twilioClient.messages.create({ to, from: process.env.TWILIO_SMS_FROM, body })
}

export async function sendEmail(to, subject, text) {
  if (!emailConfigured()) throw new Error('Email not configured')
  await sgMail.send({ to, from: process.env.SENDGRID_FROM, subject, text })
}
