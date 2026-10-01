import { useEffect, useRef, type ReactNode } from "react";

/** Native modal provides focus containment and makes the workspace inert. */
export default function ModuleDialog({
  label,
  busy = false,
  onClose,
  children,
}: {
  label: string;
  busy?: boolean;
  onClose(): void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="module-modal"
      aria-label={label}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      {children}
    </dialog>
  );
}
