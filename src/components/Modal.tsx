import { useLayoutEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
export default function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const dialog = ref.current!;
    const active = document.activeElement as HTMLElement;
    dialog.showModal();
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = before;
      active?.focus();
    };
  }, []);
  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    dialog.scrollTop = 0;
    const heading = dialog.querySelector<HTMLElement>("h2, h3");
    if (heading) { heading.tabIndex = -1; heading.focus({preventScroll: true}); }
  }, [title]);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "wide" : ""}`}
      aria-label={title}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) {
          const r = ref.current.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            onClose();
        }
      }}
    >
      <div className="modal-controls"><button
        className="icon-button modal-close"
        onClick={onClose}
        aria-label="Закрыть окно"
      >
        <X size={20} />
      </button></div>
      {children}
    </dialog>
  );
}
