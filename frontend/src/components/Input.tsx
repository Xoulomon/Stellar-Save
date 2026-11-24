import './Input.css';

import { FormField } from './FormField';

type InputType = 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'search';

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  type?: InputType;
  error?: string;
  helperText?: string;
  required?: boolean;
  validate?: (value: string) => string | undefined;
}

export function Input({
  label,
  type = 'text',
  error,
  helperText,
  required = false,
  validate,
  onChange,
  className = '',
  id,
  ...rest
}: InputProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (validate) {
      validate(e.target.value);
    }
    onChange?.(e);
  };

  const inputClasses = ['input-field', error ? 'input-field-error' : '', className]
    .filter(Boolean)
    .join(' ');

  return (
    <FormField
      id={inputId}
      label={label}
      required={required}
      error={error}
      helperText={helperText}
    >
      <input
        id={inputId}
        type={type}
        className={inputClasses}
        required={required}
        onChange={handleChange}
        aria-invalid={!!error}
        aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
        {...rest}
      />
    </FormField>
  );
}
