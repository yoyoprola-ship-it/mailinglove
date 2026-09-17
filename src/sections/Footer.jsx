export default function Footer({ showCalendar = false, showFrames = false }) {
  return (
    <footer className="footer">
      <div className="section-inner footer__inner">
        <a className="brand" href="/" aria-label="MailingLove — home">
          <img className="brand__logo" src="/logo.png" alt="MailingLove" width="631" height="200" />
        </a>
        <p className="footer__text">Your photos &amp; postcards — printed and mailed.</p>
        <div className="footer__link-cols">
          <nav className="footer__col">
            <a href="/photos">Print your photos</a>
            <a href="/postcards">Send a postcard</a>
            {showCalendar && <a href="/calendars">Make a calendar</a>}
            {showFrames && <a href="/frames">Frame a photo</a>}
          </nav>
          <nav className="footer__col">
            <a href="/terms">Terms &amp; Conditions</a>
            <a href="/privacy">Privacy Policy</a>
            <a href="mailto:joesoftwareusallc@gmail.com">Contact</a>
          </nav>
        </div>
        <p className="footer__copy">
          © {new Date().getFullYear()} Joe Software USA LLC · joesoftwareusallc@gmail.com
        </p>
        <p className="footer__copy footer__copy--fine">
          MailingLove is a service operated by Joe Software USA LLC.
        </p>
      </div>
    </footer>
  )
}
