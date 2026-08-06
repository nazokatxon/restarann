import React from "react";
import { Loader2 } from "lucide-react";

 
const VARIANT_STYLES = {
  primary: "bg-[#1B3A6B] text-white hover:bg-[#16305A] active:bg-[#122748] disabled:bg-[#1B3A6B]/40",
  secondary: "bg-[#0E8C82] text-white hover:bg-[#0C766D] active:bg-[#0A625A] disabled:bg-[#0E8C82]/40",
  accent: "bg-[#A8461F] text-white hover:bg-[#8F3B1A] active:bg-[#772F15] disabled:bg-[#A8461F]/40",
  gold: "bg-[#C99A3A] text-white hover:bg-[#B58730] active:bg-[#9C7328] disabled:bg-[#C99A3A]/40",
  outline: "bg-transparent text-[#1B3A6B] border border-[#1B3A6B]/40 hover:bg-[#1B3A6B]/5 active:bg-[#1B3A6B]/10 disabled:text-[#1B3A6B]/30 disabled:border-[#1B3A6B]/15",
  ghost: "bg-transparent text-[#241F19] hover:bg-[#E8E4D8] active:bg-[#DEDACB] disabled:text-[#241F19]/30",
  danger: "bg-[#C0392B] text-white hover:bg-[#A83226] active:bg-[#8F2B21] disabled:bg-[#C0392B]/40",
};

const SIZE_STYLES = {
  sm: "text-xs px-3 py-1.5 gap-1.5 rounded-lg",
  md: "text-sm px-4 py-2.5 gap-2 rounded-xl",
  lg: "text-base px-5 py-3.5 gap-2.5 rounded-2xl",
};

const ICON_SIZE = {
  sm: 14,
  md: 16,
  lg: 18,
};

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

/**
 * @param {Object} props
 * @param {"primary"|"secondary"|"accent"|"gold"|"outline"|"ghost"|"danger"} [props.variant="primary"]
 * @param {"sm"|"md"|"lg"} [props.size="md"]
 * @param {React.ReactNode} [props.icon] - Matndan oldin chiqadigan ikonka (masalan lucide-react)
 * @param {React.ReactNode} [props.iconRight] - Matndan keyin chiqadigan ikonka
 * @param {boolean} [props.loading=false] - Yuklanish holatini ko'rsatadi, tugmani avtomatik disable qiladi
 * @param {boolean} [props.disabled=false]
 * @param {boolean} [props.fullWidth=false] - Konteynerning to'liq kengligini egallaydi
 * @param {"button"|"submit"|"reset"} [props.type="button"]
 * @param {string} [props.className] - Qo'shimcha tashqi klasslar
 * @param {React.ReactNode} props.children
 */
export default function Button({
  variant = "primary",
  size = "md",
  icon = null,
  iconRight = null,
  loading = false,
  disabled = false,
  fullWidth = false,
  type = "button",
  className = "",
  children,
  onClick,
  ...rest
}) {
  const isDisabled = disabled || loading;

  return (                   
    <button
      type={type}
      disabled={isDisabled}
      onClick={isDisabled ? undefined : onClick}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex items-center justify-center font-semibold whitespace-nowrap select-none",
        "transition-all duration-150 active:scale-[0.97]",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#1B3A6B]/50",
        "disabled:cursor-not-allowed disabled:active:scale-100",
        VARIANT_STYLES[variant],
        SIZE_STYLES[size],
        fullWidth && "w-full",
        className
      )}
      {...rest}
    >
      {loading ? (
        <Loader2 size={ICON_SIZE[size]} className="animate-spin" />
      ) : (
        icon && <span className="shrink-0 flex items-center">{icon}</span>
      )}
      {children && <span>{children}</span>}
      {!loading && iconRight && <span className="shrink-0 flex items-center">{iconRight}</span>}
    </button>
  );
}