import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import './welcome.css'

function Brand() {
  return <Link className="welcome-brand" to="/welcome" aria-label="Grocea home"><img src="/brand/grocea-icon.png" alt="" width="36" height="36" /><span>grocea</span></Link>
}

const stages = [
  { image: 'recipe', title: 'Check a recipe', body: 'Grocea compares its ingredients with current pantry stock. In this sample kitchen, Tomato egg rice is short of one tomato.', alt: 'Tomato egg rice ingredients for two servings: 300 g rice, two eggs and three tomatoes. One tomato is missing.' },
  { image: 'shopping', title: 'Buy what is missing', body: 'Add recipe shortages or restock items to a shopping list, or start a list yourself. Review purchased quantities before adding them to the pantry.', alt: 'An actual sample shopping list in Grocea, with ingredient quantities ready to review.' },
  { image: 'activity', title: 'Keep the record', body: 'Recording a meal changes pantry stock. Activity shows which ingredients changed, by how much, and their resulting balances.', alt: 'Actual sample cooking activity: rice 2.4 kg to 2.1 kg, eggs eight to six, tomatoes three to zero.' },
]

export default function WelcomePage() {
  const [tomatoes, setTomatoes] = useState(2)
  const page = useRef<HTMLDivElement>(null)
  const shortage = Math.max(0, 3 - tomatoes)
  useEffect(() => {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('welcome-seen'); observer.unobserve(entry.target) }
    }), { threshold: 0.12 })
    page.current?.querySelectorAll('[data-welcome-enter]').forEach(element => observer.observe(element))
    return () => observer.disconnect()
  }, [])
  return <div className="welcome-page" ref={page} id="welcome-top">
    <a className="welcome-skip" href="#welcome-main">Skip to content</a>
    <header className="welcome-header"><Brand /><nav aria-label="Welcome navigation"><a href="#kitchen-loop">Kitchen loop</a><a href="#offline">Offline & privacy</a><a href="#contact">Contact</a><Link to="/login">Sign in</Link></nav></header>
    <main id="welcome-main">
      <section className="welcome-hero" aria-labelledby="welcome-title">
        <div className="welcome-ledger">
          <div className="welcome-hero-copy"><h1 id="welcome-title" data-welcome-enter>Your kitchen,<br />accounted for</h1><p data-welcome-enter>Grocea connects your pantry stock, recipe needs, shopping lists and cooking records in one personal kitchen.</p><Link className="welcome-primary" to="/register" data-welcome-enter>Create account</Link><a className="welcome-explore" href="#kitchen-loop">Explore the kitchen loop</a></div>
          <figure className="welcome-pantry" data-welcome-enter><img src="/images/welcome/pantry.png" width="284" height="108" alt="Actual sample pantry in Grocea, showing two tomatoes on hand." /><figcaption>Sample kitchen. Actual Grocea screens with example ingredients and quantities.</figcaption></figure>
        </div>
      </section>
      <section className="welcome-example welcome-width" aria-labelledby="example-title">
        <div className="welcome-section-copy"><h2 id="example-title" data-welcome-enter>See what is missing</h2><p data-welcome-enter>Change the tomatoes on hand to see what Tomato egg rice needs for two servings.</p></div>
        <div className="welcome-calculation" data-welcome-enter>
          <div className="welcome-recipe-note"><h3>Tomato egg rice</h3><p>2 servings</p><dl><div><dt>Basmati rice</dt><dd>300 g</dd></div><div><dt>Eggs</dt><dd>2</dd></div><div><dt>Tomatoes</dt><dd>3</dd></div></dl><p>Pantry has 2.4 kg Basmati rice and 8 eggs.</p></div>
          <div className="welcome-shortage"><fieldset><legend>Tomatoes on hand</legend>{[0, 2, 3].map(amount => <label key={amount}><input type="radio" name="sample-tomatoes" value={amount} checked={tomatoes === amount} onChange={() => setTomatoes(amount)} /><span>{amount} tomatoes</span></label>)}</fieldset><div className="welcome-result" role="status" aria-live="polite" aria-atomic="true"><strong>{shortage ? `Buy ${shortage} tomato${shortage === 1 ? '' : 'es'}` : 'No tomatoes to buy'}</strong><p>3 needed − {tomatoes} on hand = {shortage} for the shopping list.</p></div></div>
        </div>
        <p className="welcome-sample-note">Sample kitchen. This example does not change your pantry or create a shopping list.</p>
      </section>
      <section className="welcome-loop welcome-width" id="kitchen-loop" aria-labelledby="loop-title"><h2 id="loop-title" data-welcome-enter>From pantry to plate</h2>{stages.map(({image,title,body,alt}) => <article className={`welcome-stage welcome-stage-${image}`} key={image}><figure data-welcome-enter><img src={`/images/welcome/${image}.png`} width={image === 'shopping' ? 288 : 284} height={image === 'activity' ? 288 : image === 'shopping' ? 203 : 309} alt={alt} loading="lazy" /><figcaption>{image === 'activity' ? 'Sample kitchen. Recorded cooking after buying the missing tomato.' : 'Sample kitchen. Actual Grocea screen.'}</figcaption></figure><div><h3 data-welcome-enter>{title}</h3><p data-welcome-enter>{body}</p></div></article>)}</section>
      <section className="welcome-conditions" id="offline" aria-labelledby="offline-title"><div className="welcome-condition-sheet"><h2 id="offline-title" data-welcome-enter>Offline after first sync</h2><div className="welcome-condition-group" data-welcome-enter><h3>On your device</h3><p><strong>Start online.</strong> Sign in and complete the first sync before relying on offline access.</p><p><strong>Keep working.</strong> After first sync, pantry, recipe, shopping and cooking changes can be saved on your device while offline.</p><p><strong>Reconnect.</strong> Pending changes synchronize when the service is available. Check the app’s save and sync status.</p></div><div className="welcome-condition-group" data-welcome-enter><h3>Your personal kitchen</h3><p><strong>Private account.</strong> Your kitchen data belongs to your personal account.</p><p><strong>Exact quantities.</strong> Grocea uses metric measurements and item counts throughout the kitchen loop.</p></div></div></section>
      <section className="welcome-close welcome-width"><p data-welcome-enter>Create your account and start with the ingredients you have.</p><div data-welcome-enter><Link className="welcome-primary" to="/register">Create account</Link><Link to="/login">Sign in</Link></div></section>
    </main>
    <footer className="welcome-footer" id="contact"><div className="welcome-width"><div className="welcome-footer-top"><Brand /><a href="#welcome-top">Back to top</a></div><h2 data-welcome-enter>Get in touch</h2><a className="welcome-email" href="mailto:grocea@aeyslo.lol">grocea@aeyslo.lol</a><div className="welcome-footer-bottom"><a href="https://github.com/grocea/grocea-pwa">GitHub</a><p>© 2026 Grocea. Open source under the MIT licence.</p></div></div></footer>
  </div>
}
