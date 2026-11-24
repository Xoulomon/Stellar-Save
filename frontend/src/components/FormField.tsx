import type { ReactNode } from 'react';

interface FormFieldProps {
  id?: string;
  label?: string;
  required?: boolean;
  error?: string;
  helperText?: string;
  children: ReactNode;
}

export function FormField({
  id,
  label,
  required = false,
  error,
  helperText,
  children,
}: FormFieldProps) {
  return (
    <div className="input-wrapper">
      {label && (
        <label className="input-label" htmlFor={id}>
          {label}
          {required && <span className="input-label-required">*</span>}
        </label>
      )}
      {children}
      {error && (
        <span id={`${id}-error`} className="input-error" role="alert">
          {error}
        </span>
      )}
      {!error && helperText && (
        <span id={`${id}-helper`} className="input-helper">
          {helperText}
        </span>
      )}
    </div>
  );
}
