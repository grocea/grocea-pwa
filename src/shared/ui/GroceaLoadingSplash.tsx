import { useEffect, useId, useRef } from 'react'
import { usePendingAction } from '../lib/usePendingAction'

interface LoadingFailure {
  message: string
  retry: () => Promise<void>
  requestReset: () => void
}

export function GroceaLoadingSplash({ failure = null }: { failure?: LoadingFailure | null }) {
  return <>
    <main className="storage-state storage-opening" aria-busy="true">
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
    <StorageErrorDialog failure={failure} />
  </>
}

function StorageErrorDialog({ failure }: { failure: LoadingFailure | null }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const retryRef = useRef<HTMLButtonElement>(null)
  const restoreFocusRef = useRef<HTMLElement | null>(null)
  const titleId = useId()
  const descriptionId = useId()
  const { pending, run } = usePendingAction(async () => {
    if (failure) await failure.retry()
  })

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (failure) {
      restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      if (!dialog.open) {
        if (typeof dialog.showModal === 'function') dialog.showModal()
        else dialog.setAttribute('open', '')
      }
      retryRef.current?.focus()
      return
    }
    if (dialog.open) {
      if (typeof dialog.close === 'function') dialog.close()
      else dialog.removeAttribute('open')
    }
    restoreFocusRef.current?.focus()
  }, [failure])

  return <dialog
    ref={dialogRef}
    className="storage-error-dialog"
    role="alertdialog"
    aria-modal="true"
    aria-labelledby={titleId}
    aria-describedby={descriptionId}
    aria-busy={pending}
    onCancel={event => event.preventDefault()}
    onKeyDown={event => {
      if (event.key === 'Escape') event.preventDefault()
    }}
  >
    <div className="storage-error-dialog-card">
      <span className="eyebrow">LOCAL STORAGE ERROR</span>
      <h2 id={titleId}>Grocea couldn’t open your data</h2>
      <p id={descriptionId}>{failure?.message ?? 'Your offline data is unavailable.'}</p>
      <div className="storage-error-dialog-actions">
        <button ref={retryRef} className="button primary" type="button" disabled={pending} onClick={() => void run().catch(() => undefined)}>{pending ? 'Retrying…' : 'Retry'}</button>
        <button className="button danger" type="button" disabled={pending} onClick={() => failure?.requestReset()}>Reset local data</button>
      </div>
    </div>
  </dialog>
}
