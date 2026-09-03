import { useEffect } from 'react'
import './legal.css'

const EFFECTIVE = 'September 1, 2026'

function Header() {
  return (
    <header className="lgl__top">
      <a className="lgl__brand" href="/" aria-label="MailingLove — home">
        <img src="/logo.png" alt="MailingLove" width="631" height="200" />
      </a>
      <nav className="lgl__topnav">
        <a href="/terms">Terms</a>
        <a href="/privacy">Privacy</a>
        <a href="/">Home</a>
      </nav>
    </header>
  )
}

function Footer() {
  return (
    <footer className="lgl__foot">
      <p>© {new Date().getFullYear()} MailingLove. All rights reserved.</p>
      <p>
        Questions? Use the Help chat at <a href="/">mailinglove.com</a> or email{' '}
        <a href="mailto:support@mailinglove.com">support@mailinglove.com</a>.
      </p>
    </footer>
  )
}

function Terms() {
  return (
    <article className="lgl">
      <h1>Terms &amp; Conditions</h1>
      <p className="lgl__eff">Effective {EFFECTIVE}</p>

      <p>
        These Terms &amp; Conditions ("Terms") govern your use of the MailingLove
        website and services ("MailingLove", "we", "us"). MailingLove prints
        photos, postcards, and photo calendars and mails them within the United
        States. By creating
        an account, placing an order, or otherwise using the service, you agree to
        these Terms.
      </p>

      <h2>1. Orders and payment</h2>
      <p>
        Prices are shown per item before checkout and are charged in full at the
        time you place the order, through our payment processors (Stripe and
        PayPal). We do not receive or store your full card number. An order is
        accepted once payment is confirmed.
      </p>
      <p>
        Because items are printed on demand for you, an order generally cannot be
        changed or cancelled once it has been submitted for printing. If you need
        a correction, contact support immediately; we will help if the order has
        not yet entered production, but we cannot guarantee it.
      </p>

      <h2>2. Your delivery address is your responsibility</h2>
      <p>
        You are responsible for entering a complete and correct delivery address
        for yourself and for any recipient. We print and mail to exactly the
        address saved on the order at the time it is placed.
      </p>
      <p>
        <strong>
          If a package is delayed, lost, returned, or delivered to the wrong
          place because the address you provided was wrong, incomplete, or
          outdated, MailingLove is not responsible for that loss.
        </strong>{' '}
        In that situation no refund, credit, or free reprint is owed. We keep a
        dated record of the address entered on each order and of later changes to
        your saved addresses.
      </p>

      <h2>3. Delivery times and non-arrival</h2>
      <p>
        We hand completed orders to the U.S. Postal Service ("USPS") within about
        1–2 business days. First-Class Mail then typically takes about 3–9
        business days to arrive, though USPS delivery times are outside our
        control and are not guaranteed.
      </p>
      <p>
        If a package has not arrived, contact support. Provided the delivery
        address you gave was correct and complete, we allow a{' '}
        <strong>30-day window from the date we handed the order to USPS</strong>{' '}
        for it to be delivered. If it still has not arrived after those 30 days,
        you may choose <strong>either</strong>:
      </p>
      <ul>
        <li>a full refund of the amount you paid for that order; or</li>
        <li>a remake of the order, reprinted and reshipped at no additional charge.</li>
      </ul>
      <p>
        This 30-day remedy is our entire responsibility for a non-delivered order
        and does not apply where Section 2 (wrong address you provided) applies.
      </p>

      <h2>4. Print quality</h2>
      <p>
        If an item arrives damaged in transit or with a printing defect, contact
        support within 14 days of delivery and include a photo of the problem. We
        will reprint and reship the affected item at no charge, or refund it, at
        our option. Colors on a physical print may vary slightly from what you see
        on screen; small variations are normal and are not a defect.
      </p>

      <h2>5. Designs and site content — no download or reuse</h2>
      <p>
        All postcard designs, template artwork, photographs, illustrations, text,
        layouts, and other content shown on the site are owned by MailingLove or
        used under license, and are protected by copyright and other laws.
      </p>
      <p>
        <strong>
          You may not download, copy, screenshot for reuse, scrape, reproduce,
          redistribute, publish, sell, or otherwise use the postcard designs or
          any site imagery
        </strong>{' '}
        for any purpose. Buying a printed postcard from us is a license to receive
        that one physical printed copy only; it does not give you any rights in
        the underlying design, and it does not permit you to make, print, or
        distribute further copies yourself. Automated or bulk downloading of the
        catalog is prohibited.
      </p>

      <h2>6. Content you upload</h2>
      <p>
        You keep ownership of the photos and text you upload. By uploading them
        you confirm that you own them or have permission to use them, and you
        grant MailingLove a limited license to store, crop, print, and mail them
        to fulfil your order. We do not claim ownership of your content and we do
        not use it to train models or for advertising. We may delete uploaded
        files after your order is fulfilled.
      </p>
      <p>You must not upload or ask us to print content that:</p>
      <ul>
        <li>infringes anyone's copyright, trademark, publicity, or privacy rights;</li>
        <li>is unlawful, hateful, harassing, defamatory, or sexually explicit; or</li>
        <li>depicts a person who has not consented to your use of their image.</li>
      </ul>
      <p>
        We may refuse or cancel any order whose content violates these Terms and
        refund it.
      </p>

      <h2>7. Accounts</h2>
      <p>
        You are responsible for activity under your account and for keeping access
        to your email secure. Provide accurate information and keep it current.
      </p>

      <h2>8. Limitation of liability</h2>
      <p>
        To the fullest extent permitted by law, MailingLove's total liability for
        any claim arising out of an order or these Terms is limited to the amount
        you paid for that order. We are not liable for indirect, incidental, or
        consequential damages, or for delays or losses caused by USPS, by events
        outside our reasonable control, or by an address you provided.
      </p>

      <h2>9. Changes to these Terms</h2>
      <p>
        We may update these Terms from time to time. The "Effective" date above
        shows the current version. Continuing to use the service after a change
        means you accept the updated Terms.
      </p>

      <h2>10. Governing law</h2>
      <p>
        These Terms are governed by the laws of the United States and of the state
        in which MailingLove is organized, without regard to conflict-of-laws
        rules.
      </p>

      <h2>11. Contact</h2>
      <p>
        Use the Help chat at <a href="/">mailinglove.com</a> or email{' '}
        <a href="mailto:support@mailinglove.com">support@mailinglove.com</a>.
      </p>
    </article>
  )
}

function Privacy() {
  return (
    <article className="lgl">
      <h1>Privacy Policy</h1>
      <p className="lgl__eff">Effective {EFFECTIVE}</p>

      <p>
        This Privacy Policy explains what MailingLove ("we", "us") collects when
        you use our website and print-and-mail service, how we use it, and the
        choices you have.
      </p>

      <h2>1. Information we collect</h2>
      <ul>
        <li>
          <strong>Account information:</strong> your email address and, when you
          add it, your name.
        </li>
        <li>
          <strong>Delivery details:</strong> the postal addresses you enter for
          yourself and for recipients, and the notes you add to an order.
        </li>
        <li>
          <strong>Orders:</strong> what you ordered, prices, dates, and delivery
          status.
        </li>
        <li>
          <strong>Uploaded content:</strong> photos and custom text you upload to
          be printed.
        </li>
        <li>
          <strong>Payments:</strong> handled by Stripe and PayPal. We receive a
          confirmation and a reference, not your full card number.
        </li>
        <li>
          <strong>Support messages:</strong> the messages and images you send us
          through the Help chat.
        </li>
        <li>
          <strong>Usage and device data:</strong> pages viewed, approximate
          country derived from your IP address, and basic device/browser
          information.
        </li>
        <li>
          <strong>Change log:</strong> when you edit your profile or a delivery
          address, or place or pay for an order, we record the change, the date
          and time, and the request IP address. We use this to fulfil orders
          correctly and to resolve delivery disputes and prevent fraud.
        </li>
      </ul>

      <h2>2. How we use it</h2>
      <ul>
        <li>to print, package, and mail your orders;</li>
        <li>to provide customer support and process the remedies in our Terms;</li>
        <li>
          to verify what address an order was placed with, and to detect and
          resolve disputes, abuse, and fraud;
        </li>
        <li>to operate, secure, and improve the service;</li>
        <li>to send transactional messages (sign-in codes, receipts, order updates);</li>
        <li>to comply with legal, tax, and accounting obligations.</li>
      </ul>

      <h2>3. Who we share it with</h2>
      <p>We share personal information only with:</p>
      <ul>
        <li>
          <strong>Printing and mailing partners and USPS</strong>, to produce and
          deliver your order (they receive the recipient's name and address);
        </li>
        <li>
          <strong>Stripe and PayPal</strong>, to process payments;
        </li>
        <li>
          <strong>Resend and Twilio</strong>, to send email and SMS messages;
        </li>
        <li>
          <strong>Google Firebase</strong> (hosting, database, and file storage)
          and an IP-geolocation provider, as infrastructure;
        </li>
        <li>
          authorities or advisors when required by law or to protect our rights.
        </li>
      </ul>
      <p>We do not sell your personal information or share it for advertising.</p>

      <h2>4. How long we keep it</h2>
      <ul>
        <li>
          <strong>Account data</strong> — while your account is active, and for a
          reasonable period afterward.
        </li>
        <li>
          <strong>Order records and the change log</strong> — retained for up to
          three years for accounting, tax, and dispute-resolution purposes, even
          after an account is closed.
        </li>
        <li>
          <strong>Uploaded photos</strong> — kept while needed to fulfil and
          support your order, then deleted.
        </li>
        <li>
          <strong>Support messages and attachments</strong> — kept while a
          conversation is useful for support and records.
        </li>
      </ul>

      <h2>5. Your choices and rights</h2>
      <p>
        You can view and update your name and addresses in your account. To
        request access to, correction of, or deletion of your personal
        information, contact us. We will honour valid requests, except where we
        are required or permitted to keep certain records (such as order and
        change-log data) for legal, accounting, or dispute-resolution reasons.
      </p>

      <h2>6. Cookies and local storage</h2>
      <p>
        We use a first-party cookie to keep you signed in, and your browser's
        local storage for minor interface preferences. We use lightweight,
        first-party analytics to count visits and estimate visitor countries; we
        do not use third-party advertising trackers.
      </p>

      <h2>7. Children</h2>
      <p>
        The service is intended for adults. It is not directed to children, and we
        do not knowingly collect personal information from children under 13.
      </p>

      <h2>8. Security</h2>
      <p>
        Data is transmitted over encrypted connections and stored with access
        controls. No system is perfectly secure, but we take reasonable measures
        to protect your information.
      </p>

      <h2>9. Changes</h2>
      <p>
        We may update this Policy. The "Effective" date above shows the current
        version.
      </p>

      <h2>10. Contact</h2>
      <p>
        Use the Help chat at <a href="/">mailinglove.com</a> or email{' '}
        <a href="mailto:support@mailinglove.com">support@mailinglove.com</a>.
      </p>
    </article>
  )
}

export default function LegalPage({ doc }) {
  useEffect(() => {
    document.title =
      doc === 'privacy'
        ? 'Privacy Policy — MailingLove'
        : 'Terms & Conditions — MailingLove'
    const canonical = document.querySelector('link[rel="canonical"]')
    if (canonical) canonical.href = `https://mailinglove.com/${doc}`
  }, [doc])

  return (
    <div className="lgl__page">
      <Header />
      <main className="lgl__main">{doc === 'privacy' ? <Privacy /> : <Terms />}</main>
      <Footer />
    </div>
  )
}
