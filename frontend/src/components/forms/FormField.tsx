import { ReactNode } from 'react';

export interface FormFieldChromeProps {
    id: string;
    label: string;
    required?: boolean;
    helpText?: string;
    error?: string;
    children: (helperIds: { describedBy?: string }) => ReactNode;
}

// Owns label + required indicator + help/error rendering and the aria-describedby
// id wiring shared by every form input. Inputs render through `children` which
// receives `describedBy` to attach to the underlying control.
export default function FormField({
    id,
    label,
    required,
    helpText,
    error,
    children,
}: FormFieldChromeProps) {
    const helpTextId = helpText ? `${id}-help` : undefined;
    const errorId = error ? `${id}-error` : undefined;
    const describedBy = [helpTextId, errorId].filter(Boolean).join(' ') || undefined;

    return (
        <div className="form-group">
            <label htmlFor={id}>
                {label}
                {required && <span className="required-indicator">*</span>}
            </label>
            {children({ describedBy })}
            {helpText && <p className="help-text" id={helpTextId}>{helpText}</p>}
            {error && <p className="error-message" id={errorId}>{error}</p>}
        </div>
    );
}
