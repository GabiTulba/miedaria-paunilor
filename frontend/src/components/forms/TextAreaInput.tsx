import React, { forwardRef } from 'react';
import FormField from './FormField';

interface TextAreaInputProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  id: string;
  label: string;
  error?: string;
  helpText?: string;
}

const TextAreaInput = forwardRef<HTMLTextAreaElement, TextAreaInputProps>(function TextAreaInput(
  { id, label, error, helpText, required = false, rows = 3, ...rest },
  ref,
) {
  return (
    <FormField id={id} label={label} required={required} helpText={helpText} error={error}>
      {({ describedBy }) => (
        <textarea
          id={id}
          ref={ref}
          required={required}
          rows={rows}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...rest}
        />
      )}
    </FormField>
  );
});

export default TextAreaInput;
