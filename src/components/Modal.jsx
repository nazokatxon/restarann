import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";


const SIZE_STYLES = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-2xl",
};

export default function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
  closeOnBackdrop = true,
  showCloseButton = true,
}) {
  const dialogRef = useRef(null);

  // Esc tugmasi bilan yopish
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e) {
      if (e.key === "Escape") onClose?.();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // Ochiq paytda orqa fon scroll bo'lishini to'xtatish
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  if (!open) return null;

  function handleBackdropClick(e) {
    if (closeOnBackdrop && e.target === e.currentTarget) {
      onClose?.();
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      onMouseDown={handleBackdropClick}
      role="presentation"
    >
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-[#241F19]/50 backdrop-blur-[2px] animate-[fadeIn_0.18s_ease]"
        aria-hidden="true"
      />

      {/* Dialog oynasi */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "modal-title" : undefined}
        className={`relative w-full ${SIZE_STYLES[size]} bg-[#FAF6EC] rounded-3xl shadow-2xl border border-[#E8E4D8] overflow-hidden animate-[modalIn_0.2s_cubic-bezier(0.16,1,0.3,1)]`}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-[#E8E4D8]">
            {title && (
              <h2
                id="modal-title"
                className="text-lg font-extrabold text-[#241F19]"
                style={{ fontFamily: "'Montserrat', sans-serif" }}
              >
                {title}
              </h2>
            )}
            {showCloseButton && (
              <button
                onClick={onClose}
                aria-label="Yopish"
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#8E8676] hover:bg-[#E8E4D8] hover:text-[#241F19] transition-colors ml-auto"
              >
                <X size={18} />
              </button>
            )}
          </div>
        )}

        {/* Body */}
        <div className="px-5 py-4 max-h-[70vh] overflow-y-auto text-sm text-[#241F19]">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[#E8E4D8] bg-white/40">
            {footer}
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.95) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>,
    document.body
  );
}