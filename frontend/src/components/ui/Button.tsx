import type { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'quiet';
  loading?: boolean;
}

export default function Button({ variant = 'primary', loading = false, disabled, type = 'button', className = '', children, ...props }: ButtonProps) {
  return <button {...props} type={type} disabled={disabled || loading} aria-busy={loading || undefined} className={`tb-button tb-button--${variant} ${className}`}>
    {loading ? <span className="tb-spinner" aria-hidden="true" /> : null}{children}
  </button>;
}
