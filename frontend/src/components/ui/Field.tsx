import { cloneElement, type ReactElement } from 'react';

interface ControlProps { id?: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean | 'true' | 'false' | 'grammar' | 'spelling' }
interface FieldProps { id: string; label: string; hint?: string; error?: string; children: ReactElement<ControlProps> }

export default function Field({ id, label, hint, error, children }: FieldProps) {
  const describedBy = [children.props['aria-describedby'], hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined;
  return <div className="tb-field">
    <label htmlFor={id}>{label}</label>
    {cloneElement(children, { id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : children.props['aria-invalid'] })}
    {hint ? <p id={`${id}-hint`} className="tb-help">{hint}</p> : null}
    {error ? <p id={`${id}-error`} className="tb-field-error" role="alert">{error}</p> : null}
  </div>;
}
