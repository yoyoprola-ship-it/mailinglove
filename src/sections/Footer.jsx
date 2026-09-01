export default function Footer() {
  return (
    <footer className="footer">
      <div className="section-inner footer__inner">
        <a className="brand" href="#top" aria-label="MailingLove — home">
          <img className="brand__logo" src="/logo.png" alt="MailingLove" width="631" height="200" />
        </a>
        <p className="footer__text">Real mail, redesigned by AI.</p>
        <p className="footer__copy">© {new Date().getFullYear()} MailingLove</p>
      </div>
    </footer>
  )
}
