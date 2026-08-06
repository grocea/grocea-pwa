export function GroceaLoadingSplash() {
  return <main className="storage-state storage-opening" aria-busy="true">
    <div className="storage-opening-content" role="status" aria-live="polite">
      <div className="storage-opening-logo" aria-hidden="true">
        <img src="/brand/grocea-icon.png" alt="" />
      </div>
      <p className="storage-opening-message">Your pantry is almost ready.</p>
      <span className="storage-opening-dots" aria-hidden="true">
        <span className="storage-opening-dot" />
        <span className="storage-opening-dot" />
        <span className="storage-opening-dot" />
      </span>
    </div>
  </main>
}
