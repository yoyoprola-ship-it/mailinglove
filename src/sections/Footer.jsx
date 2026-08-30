import Icon from '../components/Icon'

export default function Footer() {
  return (
    <footer className="footer">
      <div className="section-inner footer__inner">
        <a className="brand" href="#top">
          <span className="brand__mark">
            <Icon name="heart" size={16} />
          </span>
          <span>MailingLove</span>
        </a>
        <p className="footer__text">Real mail, redesigned by AI.</p>
        <p className="footer__copy">© {new Date().getFullYear()} MailingLove</p>
      </div>
    </footer>
  )
}
