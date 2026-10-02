"use client";

import { WarningIcon } from "@phosphor-icons/react/dist/csr/Warning";
import { useEffect, useRef } from "react";

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  pending = false,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  pending?: boolean;
  onCancel(): void;
  onConfirm(): void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      className="confirm-dialog"
      ref={dialogRef}
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onCancel();
      }}
      onClose={() => {
        if (open && !pending) onCancel();
      }}
    >
      <div className="confirm-dialog-icon" aria-hidden="true">
        <WarningIcon size={24} weight="bold" />
      </div>
      <h2>{title}</h2>
      <p>{description}</p>
      <div className="confirm-dialog-actions">
        <button
          className="button button-secondary"
          type="button"
          onClick={onCancel}
          disabled={pending}
        >
          Batal
        </button>
        <button
          className="button button-danger"
          type="button"
          onClick={onConfirm}
          disabled={pending}
        >
          {pending ? "Memproses..." : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
