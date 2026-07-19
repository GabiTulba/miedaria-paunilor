import React, { forwardRef } from 'react';
import FormField from './FormField';

interface NumberInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  error?: string;
  helpText?: string;
}

const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(function NumberInput(
  { id, label, error, helpText, required = false, ...rest },
  ref,
) {
  return (
    <FormField id={id} label={label} required={required} helpText={helpText} error={error}>
      {({ describedBy }) => (
        <input
          type="number"
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

export default NumberInput;
