export default function Footer() {
  return (
    <footer className="footer">
      <div className="section-inner footer__inner">
        <a className="brand" href="#top" aria-label="MailingLove — home">
          <img className="brand__logo" src="/logo.png" alt="MailingLove" width="631" height="200" />
        </a>
        <p className="footer__text">Your photos &amp; postcards — printed and mailed.</p>
        <nav className="footer__links">
          <a href="/terms">Terms &amp; Conditions</a>
          <a href="/privacy">Privacy Policy</a>
        </nav>
        <p className="footer__copy">© {new Date().getFullYear()} MailingLove</p>
      </div>
    </footer>
  )
}
