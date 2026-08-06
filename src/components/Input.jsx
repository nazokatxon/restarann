import React, { useId, useState } from "react";
import { Eye, EyeOff, AlertCircle } from "lucide-react";

const SIZE_STYLES = {
  sm: "text-xs py-1.5 px-3 rounded-lg",
  md: "text-sm py-2.5 px-3.5 rounded-xl",
  lg: "text-base py-3.5 px-4 rounded-2xl",
};

const ICON_SIZE = { sm: 14, md: 16, lg: 18 };
const ICON_PAD = { sm: "pl-8", md: "pl-9", lg: "pl-11" };
const ICON_PAD_RIGHT = { sm: "pr-8", md: "pr-9", lg: "pr-11" };

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

export default function Input({
  label,
  helperText,
  error,
  icon = null,
  size = "md",
  fullWidth = true,
  required = false,
  type = "text",
  id,
  className = "",
  inputClassName = "",
  disabled = false,
  ...rest
}) {
  const autoId = useId();
  const inputId = id || autoId;
  const isPassword = type === "password";
  const [showPassword, setShowPassword] = useState(false);
  const resolvedType = isPassword ? (showPassword ? "text" : "password") : type;
  const hasError = Boolean(error);

  return (
    <div className={cn(fullWidth && "w-full", className)}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-semibold text-[#241F19] mb-1.5"
        >
          {label}
          {required && <span className="text-[#C0392B] ml-0.5">*</span>}
        </label>
      )}

      <div className="relative">
        {icon && (
          <span className="absolute left-3 top-0 bottom-0 flex items-center text-[#8E8676] pointer-events-none">
            {icon}
          </span>
        )}

        <input
          id={inputId}
          type={resolvedType}
          disabled={disabled}
          aria-invalid={hasError || undefined}
          aria-describedby={
            hasError ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined
          }
          className={cn(
            "w-full bg-white text-[#241F19] placeholder:text-[#8E8676]",
            "border transition-colors duration-150",
            "focus:outline-none focus:ring-2 focus:ring-offset-0",
            SIZE_STYLES[size],
            icon && ICON_PAD[size],
            isPassword && ICON_PAD_RIGHT[size],
            hasError
              ? "border-[#C0392B] focus:ring-[#C0392B]/30"
              : "border-[#E8E4D8] focus:border-[#1B3A6B] focus:ring-[#1B3A6B]/20",
            disabled && "bg-[#F4F1EA] text-[#8E8676] cursor-not-allowed",
            inputClassName
          )}
          {...rest}
        />

        {isPassword && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-0 top-0 bottom-0 flex items-center pr-3 text-[#8E8676] hover:text-[#241F19] transition-colors"
            aria-label={showPassword ? "Parolni yashirish" : "Parolni ko'rsatish"}
          >
            {showPassword ? <EyeOff size={ICON_SIZE[size]} /> : <Eye size={ICON_SIZE[size]} />}
          </button>
        )}
      </div>

      {hasError ? (
        <p id={`${inputId}-error`} className="mt-1.5 text-xs text-[#C0392B] flex items-center gap-1">
          <AlertCircle size={13} className="shrink-0" /> {error}
        </p>
      ) : helperText ? (
        <p id={`${inputId}-helper`} className="mt-1.5 text-xs text-[#8E8676]">
          {helperText}
        </p>
      ) : null}
    </div>
  );
}