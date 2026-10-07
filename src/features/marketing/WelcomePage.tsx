import {
  ArrowRight,
  Basket,
  Check,
  ClockCounterClockwise,
  CookingPot,
  EnvelopeSimple,
  GithubLogo,
  Leaf,
  LockSimple,
  Package,
  WifiSlash,
} from '@phosphor-icons/react'
import { Link } from 'react-router-dom'
import './welcome.css'

const loop = [
  ['01', 'Know what is on hand', 'Track the ingredients you choose to keep in your pantry.'],
  ['02', 'Choose what to cook', 'Compare recipe ingredients with your current stock.'],
  ['03', 'Shop for what is missing', 'Build a grocery list from the basket of recipes you plan to make.'],
  ['04', 'Keep your pantry current', 'Record cooking and shopping changes in a traceable history.'],
]

const capabilities = [
  { icon: Package, title: 'A pantry you control', body: 'Choose which ingredients to track. A zero balance only means “Needs restock” when you have chosen to track it.' },
  { icon: CookingPot, title: 'Recipes grounded in stock', body: 'See what a recipe needs, what you have, and what is short before you cook.' },
  { icon: Basket, title: 'Shopping with context', body: 'Combine recipe needs into a focused list, then decide which purchases should update Pantry.' },
  { icon: ClockCounterClockwise, title: 'A record you can follow', body: 'Cooking and stock changes remain in Activity, with linked reversals for corrections.' },
]

function Brand() {
  return <Link className="welcome-brand" to="/welcome" aria-label="Grocea home">
    <span className="welcome-brand-mark" aria-hidden="true"><img src="/brand/grocea-icon.png" alt="" /></span>
    <span>grocea</span>
  </Link>
}

export default function WelcomePage() {
  return <div className="welcome-page">
    <a className="welcome-skip" href="#welcome-main">Skip to content</a>

    <header className="welcome-header">
      <Brand />
      <nav aria-label="Welcome page navigation">
        <a href="#kitchen-loop">The kitchen loop</a>
        <a href="#offline">Offline & privacy</a>
        <a href="#contact">Contact Us</a>
        <Link to="/login">Sign in</Link>
        <Link className="welcome-nav-cta" to="/register">Create account <ArrowRight size={16} /></Link>
      </nav>
      <div className="welcome-mobile-actions"><Link className="welcome-mobile-signin" to="/login">Sign in</Link><Link className="welcome-mobile-cta" to="/register">Get started</Link></div>
      <a className="welcome-mobile-contact" href="#contact">Contact Us <ArrowRight size={14} aria-hidden="true" /></a>
    </header>

    <main id="welcome-main">
      <section className="welcome-hero" aria-labelledby="welcome-title">
        <div className="welcome-hero-inner">
          <div className="welcome-copy">
            <span className="welcome-kicker"><Leaf size={16} weight="fill" /> THE KITCHEN LEDGER</span>
            <h1 id="welcome-title">A clearer view of what’s in your kitchen.</h1>
            <p>Keep pantry stock, recipes, shopping, and cooking in one connected place—so each decision starts with what you already know.</p>
            <div className="welcome-actions">
              <Link className="welcome-primary-button" to="/register">Create your account <ArrowRight size={18} /></Link>
              <a className="welcome-text-link" href="#kitchen-loop">Explore the kitchen loop <span aria-hidden="true">↓</span></a>
            </div>
            <div className="welcome-facts"><span><LockSimple size={17} /> Private personal account</span><span><WifiSlash size={17} /> Offline after first sync</span></div>
          </div>

          <div className="welcome-product" aria-label="Example view of Grocea">
            <div className="product-window-bar"><span className="window-mark"><img src="/brand/grocea-icon.png" alt="" /></span><strong>My kitchen</strong><span className="preview-sync"><Check size={14} weight="bold" /> Synced</span></div>
            <div className="product-preview-grid">
              <section className="preview-pane pantry-preview" aria-label="Sample pantry balances">
                <div className="preview-heading"><div><small>YOUR PANTRY</small><strong>On hand</strong></div><span className="preview-count">3 tracked</span></div>
                <div className="preview-ingredient"><span className="ingredient-stamp grain">O</span><span><strong>Rolled oats</strong><small>Pantry staples</small></span><b>800 g</b></div>
                <div className="preview-ingredient"><span className="ingredient-stamp dairy">M</span><span><strong>Whole milk</strong><small>Dairy & chilled</small></span><b>1.5 L</b></div>
                <div className="preview-ingredient restock"><span className="ingredient-stamp produce">C</span><span><strong>Carrots</strong><small>Needs restock</small></span><b>0 items</b></div>
                <small className="preview-caption">Illustrative sample</small>
              </section>
              <section className="preview-pane dinner-preview" aria-label="Sample recipe and shopping need">
                <small className="preview-eyebrow">A RECIPE FROM YOUR KITCHEN</small>
                <div className="recipe-art" aria-hidden="true"><Leaf size={34} weight="light" /><span>GOOD THINGS, IN SEASON</span></div>
                <h2>Oat porridge</h2>
                <p>For 2 servings · 2 ingredients</p>
                <div className="recipe-ready"><Check size={16} weight="bold" /> Pantry has what you need</div>
                <div className="preview-list-row"><Basket size={17} /><span>Shopping list</span><b>Ready when you are</b></div>
              </section>
            </div>
            <div className="product-preview-foot"><span>One kitchen, kept in context.</span><span>Example screen · sample quantities</span></div>
          </div>
        </div>
        <div className="welcome-hero-foot"><span>From what you have to what you’ll make</span><a href="#kitchen-loop">See how Grocea connects it <span aria-hidden="true">↓</span></a></div>
      </section>

      <section className="welcome-loop" id="kitchen-loop" aria-labelledby="loop-title">
        <div className="section-intro">
          <span className="welcome-kicker">A CONTINUOUS KITCHEN WORKFLOW</span>
          <h2 id="loop-title">Every part of the kitchen, in step.</h2>
          <p>Grocea carries useful context from pantry to plate, then keeps a record of what changed.</p>
        </div>
        <ol className="loop-grid">
          {loop.map(([number, title, body], index) => <li className="loop-step" key={number}>
            <span className="loop-number">{number}</span>
            <div className="loop-connector" aria-hidden="true"><i className={index === 0 ? 'filled' : ''} /></div>
            <h3>{title}</h3><p>{body}</p>
          </li>)}
        </ol>
      </section>

      <section className="welcome-capabilities" aria-labelledby="capabilities-title">
        <div className="section-intro capabilities-intro">
          <span className="welcome-kicker">USEFUL, NOT NOISY</span>
          <h2 id="capabilities-title">A practical ledger for everyday cooking.</h2>
        </div>
        <div className="capability-list">
          {capabilities.map(({ icon: Icon, title, body }, index) => <article key={title} className="capability-row">
            <span className="capability-index">0{index + 1}</span><span className="capability-icon"><Icon size={23} weight="regular" /></span>
            <h3>{title}</h3><p>{body}</p>
          </article>)}
        </div>
      </section>

      <section className="welcome-offline" id="offline" aria-labelledby="offline-title">
        <div className="offline-mark"><WifiSlash size={26} /></div>
        <div><span className="welcome-kicker">YOUR DATA, YOUR KITCHEN</span><h2 id="offline-title">Private by account. Ready for offline moments.</h2><p>Sign in and complete your first sync while online. After that, Grocea saves changes on this device and syncs them when the service is available.</p></div>
        <div className="offline-facts"><span><Check size={17} weight="bold" /> Personal account data</span><span><Check size={17} weight="bold" /> Metric quantities throughout</span><span><Check size={17} weight="bold" /> Stock changes stay traceable</span></div>
      </section>

      <section className="welcome-final" aria-labelledby="final-title">
        <span className="welcome-kicker">START WITH WHAT’S IN YOUR KITCHEN</span>
        <h2 id="final-title">Make your kitchen easier to keep up with.</h2>
        <p>Set up your pantry, find a recipe, and keep the next shop connected to the meal.</p>
        <div className="final-actions"><Link to="/register">Create your account <ArrowRight size={18} /></Link><Link className="final-signin" to="/login">Already have an account? Sign in</Link></div>
      </section>
    </main>
    <footer className="welcome-footer">
      <div className="welcome-footer-about"><Brand /><span>Pantry · Recipes · Groceries · Cooking history</span></div>
      <nav className="welcome-contact" id="contact" aria-label="Contact and source code" tabIndex={-1}>
        <a href="https://github.com/grocea/grocea-pwa"><GithubLogo size={18} aria-hidden="true" /> GitHub</a>
        <a href="mailto:grocea@aeyslo.lol"><EnvelopeSimple size={18} aria-hidden="true" /> grocea@aeyslo.lol</a>
      </nav>
      <small>© 2026 Grocea</small>
    </footer>
  </div>
}
