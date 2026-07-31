import { useEffect, useId, useRef } from 'react'
import { usePendingAction } from '../lib/usePendingAction'

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  pendingLabel = 'Working…',
  onConfirm,
  onDismiss,
}: {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  pendingLabel?: string
  onConfirm: () => Promise<void>
  onDismiss: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const restoreFocusRef = useRef<HTMLElement | null>(null)
  const titleId = useId()
  const descriptionId = useId()
  const { pending, run } = usePendingAction(async () => {
    await onConfirm()
    onDismiss()
  })

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open) {
      restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      if (!dialog.open) {
        if (typeof dialog.showModal === 'function') dialog.showModal()
        else dialog.setAttribute('open', '')
      }
      cancelRef.current?.focus()
      return
    }
    if (dialog.open) {
      if (typeof dialog.close === 'function') dialog.close()
      else dialog.removeAttribute('open')
    }
    restoreFocusRef.current?.focus()
  }, [open])

  return <dialog
    ref={dialogRef}
    className="confirm-dialog"
    aria-labelledby={titleId}
    aria-describedby={descriptionId}
    aria-busy={pending}
    onCancel={event => {
      event.preventDefault()
      if (!pending) onDismiss()
    }}
    onKeyDown={event => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      if (!pending) onDismiss()
    }}
  >
    <div className="confirm-dialog-card">
      <h2 id={titleId}>{title}</h2>
      <p id={descriptionId}>{description}</p>
      <div className="confirm-dialog-actions">
        <button ref={cancelRef} autoFocus className="button secondary" type="button" disabled={pending} onClick={onDismiss}>Cancel</button>
        <button className="button danger" type="button" disabled={pending} onClick={() => void run().catch(() => undefined)}>{pending ? pendingLabel : confirmLabel}</button>
      </div>
    </div>
  </dialog>
}
