import { ShieldCheck } from '@phosphor-icons/react'
import { useEffect, useId, useRef } from 'react'

export function InfoDialog({ open, title, description, onDismiss }: { open: boolean; title: string; description: string; onDismiss: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const restoreFocusRef = useRef<HTMLElement | null>(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open) {
      restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      if (!dialog.open) {
        if (typeof dialog.showModal === 'function') dialog.showModal()
        else dialog.setAttribute('open', '')
      }
      closeRef.current?.focus()
      return
    }
    if (dialog.open) {
      if (typeof dialog.close === 'function') dialog.close()
      else dialog.removeAttribute('open')
    }
    restoreFocusRef.current?.focus()
  }, [open])

  return <dialog ref={dialogRef} className="info-dialog" aria-labelledby={titleId} aria-describedby={descriptionId} onCancel={event => { event.preventDefault(); onDismiss() }} onMouseDown={event => { if (event.target === event.currentTarget) onDismiss() }}><div className="info-dialog-card"><span className="info-dialog-icon"><ShieldCheck size={28} /></span><div><h2 id={titleId}>{title}</h2><p id={descriptionId}>{description}</p></div><button ref={closeRef} className="button primary" type="button" onClick={onDismiss}>Got it</button></div></dialog>
}
