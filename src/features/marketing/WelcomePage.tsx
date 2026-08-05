import {
  ArrowRight,
  Bread,
  Carrot,
  Check,
  CookingPot,
  ForkKnife,
  Leaf,
  Package,
  Plus,
} from '@phosphor-icons/react'
import { Link } from 'react-router-dom'
import './welcome.css'

const benefits = [
  {
    icon: Package,
    title: 'Know what you have',
    body: 'A simple, living picture of your pantry, fridge, and freezer.',
    note: 'No more duplicate buys.',
    tone: 'warm',
  },
  {
    icon: ForkKnife,
    title: 'Cook with confidence',
    body: 'Recipes surface around what you already have at home.',
    note: 'Your kitchen, working for you.',
    tone: 'mint',
  },
  {
    icon: Leaf,
    title: 'Waste less, gently',
    body: 'Small, helpful nudges mean good food stays on your table.',
    note: 'Every meal is a little kinder.',
    tone: 'sun',
  },
]

const steps = [
  ['01', 'Add what comes home', 'Build your kitchen as you shop or unpack.'],
  ['02', 'See what needs your attention', 'Restock visibility keeps pantry gaps easy to spot.'],
  ['03', 'Make something delicious', 'Cook from the ingredients already in reach.'],
]

const recipes = [
  { icon: Carrot, title: 'Golden vegetable curry', meta: '35 min · Pantry favourite', tone: 'orange' },
  { icon: Leaf, title: 'Herby green bowl', meta: '20 min · Pantry-friendly', tone: 'green' },
  { icon: Bread, title: 'Tomato toast, elevated', meta: '15 min · Weeknight win', tone: 'peach' },
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
        <a href="#how-it-works">How it works</a>
        <a href="#why-grocea">Why Grocea</a>
        <Link to="/login">Sign in</Link>
        <Link className="welcome-nav-cta" to="/register">Create account</Link>
      </nav>
      <div className="welcome-mobile-actions"><Link className="welcome-mobile-signin" to="/login">Sign in</Link><Link className="welcome-mobile-cta" to="/register">Create account</Link></div>
    </header>

    <main id="welcome-main">
      <section className="welcome-hero" aria-labelledby="welcome-title">
        <div className="welcome-hero-inner">
          <div className="welcome-copy">
            <span className="welcome-pill"><Leaf size={14} weight="bold" /> Better food, less waste</span>
            <h1 id="welcome-title">Your kitchen,<br />in rhythm with you.</h1>
            <p>Keep every ingredient in view, cook what you already have, and make fresh food feel beautifully effortless.</p>
            <div className="welcome-actions">
              <Link className="welcome-primary-button" to="/register">Organise my kitchen <ArrowRight size={18} /></Link>
              <a className="welcome-text-link" href="#how-it-works"><span aria-hidden="true">↓</span> See how it works</a>
            </div>
            <div className="welcome-proof">
              <span className="welcome-avatars" aria-hidden="true"><i /><i /><i /></span>
              <span>Private account · Offline-first · Syncs when available</span>
            </div>
          </div>

          <div className="kitchen-preview" aria-label="Preview of the Grocea kitchen dashboard">
            <div className="preview-top"><strong>My kitchen</strong><span><Plus size={20} /></span></div>
            <div className="preview-idea">
              <small>Cook with what you have</small>
              <div><strong>Tonight’s good idea</strong><CookingPot size={22} /></div>
              <p><Carrot size={20} /> <span><b>Golden vegetable curry</b><small>Uses 8 ingredients from your pantry</small></span><ArrowRight size={22} /></p>
            </div>
            <div className="preview-stats">
              <div><small>In stock</small><strong>24 items</strong></div>
              <div><small>Restock</small><strong>3 items</strong></div>
            </div>
            <div className="preview-note"><span><Leaf size={19} /></span><p><strong>Made with your pantry</strong><small>Save time, spend less</small></p></div>
          </div>
        </div>
        <div className="welcome-hero-foot"><span>A calmer way to cook, every day</span><div><span>Plan less</span><span>Waste less</span><span>Enjoy more</span></div></div>
      </section>

      <section className="welcome-benefits" id="why-grocea" aria-labelledby="benefits-title">
        <div className="welcome-section-heading">
          <h2 id="benefits-title">Grocea brings clarity to your<br />everyday cooking.</h2>
          <p>One calm home for your ingredients, meal ideas, and the little wins that make cooking feel lighter.</p>
        </div>
        <div className="benefit-grid">
          {benefits.map(({ icon: Icon, title, body, note, tone }) => <article className={`benefit-card ${tone}`} key={title}>
            <span><Icon size={23} /></span><h3>{title}</h3><p>{body}</p><strong>{note}</strong>
          </article>)}
        </div>
      </section>

      <section className="welcome-flow" id="how-it-works" aria-labelledby="flow-title">
        <div className="welcome-flow-inner">
          <div className="flow-intro">
            <span className="welcome-eyebrow">Your week, a little easier</span>
            <h2 id="flow-title">From ingredients to a good dinner—without overthinking it.</h2>
            <p>Grocea makes the next right step feel obvious, not overwhelming.</p>
            <div className="flow-stat"><div><strong>24</strong><span>ingredients visible</span></div><div><strong>3</strong><span>items to restock</span></div></div>
            <p className="flow-reassurance"><Check size={17} weight="bold" /> More ease in your kitchen, from day one.</p>
          </div>
          <ol className="flow-steps">
            {steps.map(([number, title, body]) => <li key={number}><span>{number}</span><p><strong>{title}</strong><small>{body}</small></p></li>)}
          </ol>
        </div>
      </section>

      <section className="welcome-recipes" aria-labelledby="recipes-title">
        <div className="recipes-intro"><span className="welcome-eyebrow">Made for real life</span><h2 id="recipes-title">Use what’s here. Make it feel special.</h2><p>Fresh ideas appear when your kitchen is already in view.</p></div>
        <div className="recipe-showcase">
          {recipes.map(({ icon: Icon, title, meta, tone }) => <article key={title} className="showcase-card"><div className={tone}><Icon size={48} /></div><h3>{title}</h3><p>{meta}</p></article>)}
        </div>
          <figure className="welcome-quote"><span aria-hidden="true"><Leaf /></span><blockquote>Private pantry tracking, offline-first work, and synchronization whenever the Grocea service is available.</blockquote><figcaption>How Grocea keeps your kitchen yours</figcaption></figure>
      </section>

      <section className="welcome-final" aria-labelledby="final-title">
        <div><h2 id="final-title">A more thoughtful kitchen<br />starts today.</h2><p>Bring calm to your groceries, confidence to your cooking, and a little more joy to every meal.</p><div className="final-actions"><Link to="/register">Create your account <ArrowRight size={18} /></Link><span>Your account · Works offline</span></div></div>
        <footer><Brand /><small>© 2026 Grocea. Better food, less waste.</small></footer>
      </section>
    </main>
  </div>
}
