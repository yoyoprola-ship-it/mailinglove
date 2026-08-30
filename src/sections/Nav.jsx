import Icon from '../components/Icon'

export default function Nav() {
  return (
    <header className="site-nav">
      <div className="section-inner site-nav__inner">
        <a className="brand" href="#top">
          <span className="brand__mark">
            <Icon name="heart" size={16} />
          </span>
          <span>MailingLove</span>
        </a>
        <a className="btn btn--primary btn--sm" href="#waitlist">
          Join the waitlist
        </a>
      </div>
    </header>
  )
}
