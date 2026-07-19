import React, { forwardRef, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import SelectInput from './SelectInput';
import { EnumContext } from '../../context/EnumContext';
import { EnumValues, getEnumLabel } from '../../enums';

export type EnumKind = keyof EnumValues;

interface EnumSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    id: string;
    label: string;
    kind: EnumKind;
    placeholder: string;
    error?: string;
    helpText?: string;
}

const EnumSelect = forwardRef<HTMLSelectElement, EnumSelectProps>(function EnumSelect(
    { id, name, label, kind, placeholder, error, helpText, ...rest },
    ref,
) {
    const { enums } = useContext(EnumContext);
    const { t } = useTranslation();

    const options = [
        { value: '', label: placeholder },
        ...((enums?.[kind] ?? []).map(enumValue => ({
            value: enumValue.value,
            label: getEnumLabel(enumValue.value, kind, t),
        }))),
    ];

    return (
        <SelectInput
            id={id}
            name={name ?? id}
            label={label}
            options={options}
            error={error}
            helpText={helpText}
            ref={ref}
            {...rest}
        />
    );
});

export default EnumSelect;
