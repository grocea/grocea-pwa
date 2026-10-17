import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import './welcome.css'

type Unit = 'g' | 'ml' | 'item'
type Stage = 'evergreen' | 'lime' | 'dough' | 'leaf'

// The demo kitchen's balances and recipes (src/app/fixtures.ts), in display units.
const pantry: Record<string, { name: string; unit: Unit; onHand: number }> = {
  rice: { name: 'Basmati rice', unit: 'g', onHand: 2400 },
  eggs: { name: 'Eggs', unit: 'item', onHand: 8 },
  tomatoes: { name: 'Tomatoes', unit: 'item', onHand: 2 },
  carrots: { name: 'Carrots', unit: 'item', onHand: 0 },
  chickpeas: { name: 'Chickpeas', unit: 'g', onHand: 600 },
  cucumber: { name: 'Cucumber', unit: 'item', onHand: 0 },
  oats: { name: 'Rolled oats', unit: 'g', onHand: 800 },
  milk: { name: 'Whole milk', unit: 'ml', onHand: 1500 },
}

const recipes: { id: string; name: string; baseServings: number; needs: Record<string, number>; stage: Stage }[] = [
  { id: 'tomato-egg-rice', name: 'Tomato egg rice', baseServings: 2, needs: { rice: 300, eggs: 2, tomatoes: 3 }, stage: 'evergreen' },
  { id: 'fried-rice', name: 'Vegetable fried rice', baseServings: 2, needs: { rice: 300, eggs: 2, carrots: 2 }, stage: 'lime' },
  { id: 'chickpea-bowl', name: 'Chickpea bowl', baseServings: 2, needs: { chickpeas: 300, cucumber: 1 }, stage: 'leaf' },
  { id: 'oat-porridge', name: 'Oat porridge', baseServings: 1, needs: { oats: 80, milk: 250 }, stage: 'dough' },
]

const loop = [
  { image: 'pantry', width: 284, height: 108, clause: 'First, two tomatoes sit in the pantry.', alt: 'Grocea pantry screen: Produce, Tomatoes, 2 items.' },
  { image: 'recipe', width: 284, height: 309, clause: 'Then a recipe asks for three.', alt: 'Tomato egg rice ingredients for two servings: Basmati rice and eggs available, tomatoes short with 2 in the pantry and 3 needed. Add 1 item.' },
  { image: 'shopping', width: 288, height: 203, clause: 'So the missing one goes on the list.', alt: 'Grocea shopping list: Carrots, buy 2 items. Tomatoes, buy 1 item.' },
  { image: 'activity', width: 284, height: 288, clause: 'Last, the meal is cooked and counted.', alt: 'Pantry changes after cooking: Basmati rice 2.4 kg to 2.1 kg, eggs 8 to 6 items, tomatoes 3 to 0 items.' },
]

const specimens = [
  { plate: 'tomato', width: 697, height: 1000, title: 'Counted in items', fact: 'Tomatoes: 2 on hand. Half a tomato is a real amount too.', alt: 'Botanical plate of a tomato plant with small green and red fruit.', page: 'https://commons.wikimedia.org/wiki/File:Lycopersicum_philippinarum_Blanco1.43b-cropped.jpg' },
  { plate: 'rice', width: 628, height: 1000, title: 'Weighed in grams', fact: 'Basmati rice: 2.4 kg on hand, 300 g to a pot of tomato egg rice.', alt: 'Botanical plate of three rice plants in flower, roots showing.', page: 'https://commons.wikimedia.org/wiki/File:Oryza_sativa_Blanco1.102-cropped.jpg', wide: true },
  { plate: 'coffee', width: 635, height: 1000, title: 'Allowed below zero', fact: 'Coffee beans: −50 g. The balance stays as it is and waits in Restock.', alt: 'Botanical plate of a coffee branch with white flowers and orange cherries.', page: 'https://commons.wikimedia.org/wiki/File:Coffea_arabica_Blanco1.53-cropped.jpg' },
  { plate: 'cucumber', width: 670, height: 1000, title: 'Recipes see the gap', fact: 'Cucumber: none on hand, so Chickpea bowl is short 1.', alt: 'Botanical plate of a cucumber vine with a pale fruit, broad leaves and a yellow flower.', page: 'https://commons.wikimedia.org/wiki/File:Cucumis_sativus_Blanco2.299-cropped.jpg' },
  { plate: 'banana', width: 734, height: 1000, title: 'Restock at zero', fact: 'Bananas: 0 on hand, listed under Needs restock until you buy more.', alt: 'Botanical plate of a banana plant beside a single ripe banana.', page: 'https://commons.wikimedia.org/wiki/File:Musa_paradisiaca_Blanco1.88-cropped.jpg' },
]

const decimal = (value: number) => String(Math.round(value * 1000) / 1000)
function amount(value: number, unit: Unit) {
  if (unit === 'item') return `${decimal(value)} ${value === 1 ? 'item' : 'items'}`
  if (value >= 1000) return `${decimal(value / 1000)} ${unit === 'g' ? 'kg' : 'L'}`
  return `${decimal(value)} ${unit}`
}

function cookPreview(recipe: typeof recipes[number], servings: number) {
  const rows = Object.entries(recipe.needs).map(([id, base]) => {
    const item = pantry[id]
    const needed = base * servings / recipe.baseServings
    return { id, ...item, needed, short: Math.max(0, needed - item.onHand) }
  })
  return { rows, short: rows.filter(row => row.short > 0) }
}

function Mascot() {
  return <svg className="welcome-mascot-art" viewBox="30 12 200 232" aria-hidden="true" focusable="false">
    <path fill="#FFF1DA" d="M112 99 C96.5 98 76 106 64 117.5 C48.5 134.5 39 155 40 174 C41 195 58.5 214 85 224.5 C103 235.5 126 240 147.5 235 C178 228.5 208 212 217 188.5 C225 167.5 219.5 145 205.5 128 C199 119 192 112 183.5 107 C158.5 110.5 137 102 112 99 Z" />
    <path fill="#193B2B" fillRule="evenodd" d="M112 99 C96.5 98 76 106 64 117.5 C48.5 134.5 39 155 40 174 C41 195 58.5 214 85 224.5 C103 235.5 126 240 147.5 235 C178 228.5 208 212 217 188.5 C225 167.5 219.5 145 205.5 128 C199 119 192 112 183.5 107 C158.5 110.5 137 102 112 99 Z M112 103.5 C97 102.5 78.5 110.5 67.5 121 C52.5 137.5 43 156.5 44.5 174 C46 192.5 62.5 210.5 87.5 220.5 C105 231 125.5 235.5 146.5 230.5 C175.5 224.5 204 208.5 213 187 C220.5 167.5 215.5 147 202 131 C196.5 124 190 117 182.5 111.5 C158.5 114.5 136 107 112 103.5 Z" />
    <path fill="#193B2B" d="M57.5 131 C61 119 52 112 44 107 C25 95 31.5 75 47 65.5 C55 60.5 63.5 59 71 59.5 C73.5 38.5 91 21 112 18 C132.5 15 148.5 25 155 44.5 C165.5 40.5 179.5 42 189 50 C200 61 201.5 75.5 192.5 87 C186.5 94.5 179 94 181.5 104 L182.5 109.5 C159 110.5 141.5 107 130.5 104 C105 95 83 104.5 68 118.5 L57.5 131 Z" />
    <path className="welcome-mascot-eyes" fill="#193B2B" d="M102 154.5 L109.5 151.5 C113 150 116.5 152 117.5 155.5 C118.5 159 116 161.5 113 162.5 L105 165.5 C101.5 166.5 98.5 164.5 98 161.5 C97.5 158.5 99 156 102 154.5 Z M163 141 L170 141 C174 141 176 143.5 176 146.5 C176 150 173.5 152 170 152 L163 152 C159 152 157 149.5 157 146.5 C157 143 159.5 141 163 141 Z" />
    <path fill="#193B2B" d="M129 169.5 C137 170 144.5 167.5 150 164 C153.5 162 157 163 159 166 C161.5 169 159.5 172.5 156.5 174.5 C148.5 180.5 137 182.5 129 179.5 C126 178.5 124 176 125 173 C125.5 170.5 127 169.5 129 169.5 Z" />
  </svg>
}

function RecipeDemo() {
  const [selected, setSelected] = useState(recipes[0].id)
  const [preview, setPreview] = useState<string | null>(null)
  const [servings, setServings] = useState<Record<string, number>>(() => Object.fromEntries(recipes.map(recipe => [recipe.id, recipe.baseServings])))
  const shown = recipes.find(recipe => recipe.id === (preview ?? selected)) ?? recipes[0]
  const count = servings[shown.id]
  const { rows, short } = cookPreview(shown, count)
  const changeServings = (delta: number) => setServings(current => ({ ...current, [selected]: Math.min(8, Math.max(1, current[selected] + delta)) }))
  return <div className={`welcome-demo welcome-stage-${shown.stage}`} onPointerLeave={() => setPreview(null)}>
    <fieldset className="welcome-dinners" data-reveal>
      <legend><h2 id="try-title">Pick a dinner</h2></legend>
      <ul>{recipes.map((recipe, index) => <li key={recipe.id} style={{ '--d': `${80 + index * 70}ms` } as CSSProperties}><label onPointerEnter={event => { if (event.pointerType === 'mouse') setPreview(recipe.id) }}>
        <input type="radio" name="sample-recipe" value={recipe.id} checked={selected === recipe.id} onChange={() => { setSelected(recipe.id); setPreview(null) }} />
        <span>{recipe.name}</span>
      </label></li>)}</ul>
    </fieldset>
    <div className="welcome-demo-stage" data-reveal="settle">
      <span className="welcome-dough welcome-demo-dough" aria-hidden="true" />
      <article className="welcome-recipe-card" data-ui key={shown.id} aria-labelledby="demo-recipe-name">
        <header><h3 id="demo-recipe-name">{shown.name}</h3>
          <div className="welcome-servings" role="group" aria-label="Servings">
            <button type="button" onClick={() => changeServings(-1)} disabled={preview !== null || count <= 1} aria-label="Fewer servings">−</button>
            <output aria-live="polite">{count} {count === 1 ? 'serving' : 'servings'}</output>
            <button type="button" onClick={() => changeServings(1)} disabled={preview !== null || count >= 8} aria-label="More servings">+</button>
          </div>
        </header>
        <ul>{rows.map(row => <li key={row.id}>
          <div><strong>{row.name}</strong><span>{amount(row.onHand, row.unit)} in pantry</span></div>
          <div className={row.short ? 'is-short' : undefined}><strong>{row.short ? 'Short' : 'Available'} · {amount(row.needed, row.unit)}</strong>{row.short > 0 && <span>Add {amount(row.short, row.unit)}</span>}</div>
        </li>)}</ul>
      </article>
    </div>
    <div className="welcome-demo-fact" role="status" aria-live="polite" data-reveal style={{ '--d': '240ms' } as CSSProperties}>
      <strong>{short.length ? `${short.length} ${short.length === 1 ? 'ingredient' : 'ingredients'} short` : 'Ready to cook'}</strong>
      <p>{short.length ? `Shopping list: ${short.map(row => `${row.name}, ${amount(row.short, row.unit)}`).join('; ')}.` : 'Everything it needs is already in the pantry.'}</p>
    </div>
  </div>
}

function CreateAccount() {
  const navigate = useNavigate()
  const [displayName, setDisplayName] = useState('')
  const submit = (event: FormEvent) => {
    event.preventDefault()
    navigate('/register', { state: { displayName: displayName.trim() } })
  }
  return <form className="welcome-signup" data-ui onSubmit={submit} aria-labelledby="signup-title" data-reveal="settle">
    <h3 id="signup-title">Make your kitchen yours.</h3>
    <p>Create an account to use Grocea offline and sync your kitchen data.</p>
    <label><span>Display name</span><input value={displayName} onChange={event => setDisplayName(event.target.value)} placeholder="Grocie Crumbsworth" autoComplete="name" maxLength={120} /></label>
    <p className="welcome-signup-next">Email address and password come next.</p>
    <button type="submit">Create account</button>
  </form>
}

export default function WelcomePage() {
  const page = useRef<HTMLDivElement>(null)
  const mascot = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const root = page.current
    if (!root) return
    root.classList.add('welcome-js')
    const pending = [...root.querySelectorAll<HTMLElement>('[data-reveal]')]
    // A jump scroll can carry a short element past the viewport unseen, so each reveal also releases every earlier one.
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (!entry.isIntersecting) return
      pending.splice(0, pending.indexOf(entry.target as HTMLElement) + 1).forEach(element => { element.classList.add('is-in'); observer.unobserve(element) })
    }), { rootMargin: '0px 0px -10% 0px', threshold: 0.1 })
    pending.forEach(element => observer.observe(element))
    // The hero chef sinks and tilts slightly as the page scrolls away from it.
    const still = window.matchMedia('(prefers-reduced-motion: reduce)')
    let frame = 0
    const move = () => {
      frame = 0
      const y = Math.min(window.scrollY, window.innerHeight)
      if (mascot.current) mascot.current.style.transform = still.matches ? '' : `translate3d(0, ${y * 0.22}px, 0) rotate(${y * -0.012}deg)`
    }
    const schedule = () => { if (!frame) frame = window.requestAnimationFrame(move) }
    window.addEventListener('scroll', schedule, { passive: true })
    return () => { observer.disconnect(); window.removeEventListener('scroll', schedule); if (frame) window.cancelAnimationFrame(frame) }
  }, [])
  return <div className="welcome-page" ref={page} id="welcome-top">
    <a className="welcome-skip" href="#welcome-main">Skip to content</a>
    <header className="welcome-header">
      <Link className="welcome-brand" to="/welcome" aria-label="Grocea home"><img src="/brand/dough/grocea-horizontal-color.svg" alt="" width="791" height="256" /></Link>
      <nav aria-label="Welcome navigation"><a href="#try">Try a recipe</a><a href="#kitchen-loop">Kitchen loop</a><a href="#pantry">Pantry</a><a href="#offline">Offline</a></nav>
      <Link className="welcome-header-signin" to="/login">Sign in</Link>
    </header>
    <main id="welcome-main">
      <section className="welcome-hero" aria-labelledby="welcome-title">
        <div className="welcome-hero-copy">
          <h1 id="welcome-title" className="welcome-rise">Down to the last tomato</h1>
          <p className="welcome-rise">Grocea keeps your pantry in exact grams and counts, shows what each recipe is short of, and puts the gap on your shopping list.</p>
          <div className="welcome-hero-actions welcome-rise"><Link className="welcome-button" to="/register">Create account</Link><a href="#try">Try a recipe first</a></div>
        </div>
        <div className="welcome-mascot" ref={mascot}><Mascot /></div>
      </section>

      <section className="welcome-try" id="try" aria-labelledby="try-title">
        <RecipeDemo />
        <p className="welcome-note">Sample kitchen, with the same balances as Grocea’s demo pantry. Nothing here changes your account.</p>
      </section>

      <section className="welcome-loop" id="kitchen-loop" aria-labelledby="loop-title">
        <ol>{loop.map(({ image, width, height, clause, alt }, index) => <li key={image} className={`welcome-field welcome-field-${image}`}>
          {index === 0 && <div className="welcome-loop-head" data-reveal><h2 id="loop-title">From pantry to plate</h2><p>Actual Grocea screens, sample kitchen.</p></div>}
          <figure data-ui data-reveal="settle" style={{ '--d': '120ms' } as CSSProperties}><span className="welcome-dough" aria-hidden="true" /><img src={`/images/welcome/${image}.png`} width={width} height={height} alt={alt} loading="lazy" /></figure>
          <p data-reveal style={{ '--d': '220ms' } as CSSProperties}>{clause}</p>
        </li>)}</ol>
      </section>

      <section className="welcome-offline" id="offline" aria-labelledby="offline-title">
        <div className="welcome-offline-dough">
          <h2 id="offline-title" data-reveal>Offline after first sync</h2>
          <p className="welcome-statement" data-reveal style={{ '--d': '90ms' } as CSSProperties}>Once your first sync is done, Grocea keeps working without a connection. Changes wait on your device until it is back.</p>
          <ul>
            <li data-reveal style={{ '--d': '160ms' } as CSSProperties}><strong>Start online.</strong> Sign in and let the first sync finish before you rely on offline use.</li>
            <li data-reveal style={{ '--d': '230ms' } as CSSProperties}><strong>Keep cooking.</strong> Pantry, recipe, shopping and cooking changes save on this device.</li>
            <li data-reveal style={{ '--d': '300ms' } as CSSProperties}><strong>Reconnect.</strong> Waiting changes sync when the service is reachable. The save status shows what is pending.</li>
            <li data-reveal style={{ '--d': '370ms' } as CSSProperties}><strong>Yours alone.</strong> Your kitchen data belongs to your personal account.</li>
          </ul>
        </div>
      </section>

      <section className="welcome-pantry" id="pantry" aria-labelledby="pantry-title">
        <div className="welcome-pantry-head" data-reveal>
          <h2 id="pantry-title">Every amount, exact</h2>
          <p>Mass, volume and counts, kept to three decimal places. Here is the sample pantry, plant by plant.</p>
        </div>
        <div className="welcome-specimens">
          {specimens.map(({ plate, width, height, title, fact, alt, wide }, index) => <figure key={plate} className={`welcome-specimen welcome-specimen-${plate}${wide ? ' is-wide' : ''}`} data-reveal="settle" style={{ '--d': `${index * 80}ms` } as CSSProperties}>
            <div className="welcome-specimen-tile"><span className="welcome-dough" aria-hidden="true" /><img src={`/images/welcome/plates/${plate}.jpg`} width={width} height={height} alt={alt} loading="lazy" /></div>
            <figcaption><strong>{title}</strong><span>{fact}</span></figcaption>
          </figure>)}
        </div>
        <p className="welcome-note welcome-plates-credit">Plates from <cite>Flora de Filipinas</cite> by Francisco Manuel Blanco, 1880–1883. Public domain, via <a href="https://commons.wikimedia.org/wiki/Category:Flora_de_Filipinas">Wikimedia Commons</a>. The amounts are from the sample pantry.</p>
      </section>

      <section className="welcome-start" aria-labelledby="start-title">
        <div className="welcome-start-copy" data-reveal>
          <h2 id="start-title">Start your pantry</h2>
          <p>Pick a display name, then add your email address and a password. Your pantry starts empty, ready for the first thing you put away.</p>
        </div>
        <CreateAccount />
      </section>
    </main>

    <footer className="welcome-footer" id="contact">
      <img className="welcome-footer-mark" src="/brand/dough/grocea-wordmark-white.svg" alt="Grocea" width="883" height="256" loading="lazy" data-reveal="settle" />
      <div className="welcome-footer-links">
        <nav aria-label="Page sections"><a href="#try">Try a recipe</a><a href="#kitchen-loop">Kitchen loop</a><a href="#pantry">Pantry</a><a href="#offline">Offline</a></nav>
        <nav aria-label="Account"><Link to="/register">Create account</Link><Link to="/login">Sign in</Link></nav>
        <nav aria-label="Source"><a href="https://github.com/grocea/grocea-pwa">GitHub</a></nav>
        <div className="welcome-footer-contact"><p>Get in touch</p><a href="mailto:grocea@aeyslo.lol">grocea@aeyslo.lol</a></div>
      </div>
      <p className="welcome-footer-credit">Botanical plates: Francisco Manuel Blanco, <cite>Flora de Filipinas</cite> (1880–1883), public domain, via Wikimedia Commons: {specimens.map(({ plate, page: source }, index) => <span key={plate}>{index > 0 && ', '}<a href={source}>{plate}</a></span>)}.</p>
      <div className="welcome-footer-bottom"><p>© 2026 Grocea. Open source under the MIT licence.</p><a className="welcome-button welcome-button-small" href="#welcome-top">Back to top</a></div>
    </footer>
  </div>
}
