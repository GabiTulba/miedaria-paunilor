import React, { forwardRef } from 'react';
import FormField from './FormField';

interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  error?: string;
  helpText?: string;
}

const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput(
  { id, label, error, helpText, required = false, type = 'text', ...rest },
  ref,
) {
  return (
    <FormField id={id} label={label} required={required} helpText={helpText} error={error}>
      {({ describedBy }) => (
        <input
          type={type}
          id={id}
          ref={ref}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...rest}
        />
      )}
    </FormField>
  );
});

export default TextInput;
