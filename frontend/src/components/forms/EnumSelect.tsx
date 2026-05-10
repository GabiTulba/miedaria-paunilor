import { ChangeEvent, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import SelectInput from './SelectInput';
import { EnumContext } from '../../context/EnumContext';
import { EnumValues, getEnumLabel } from '../../enums';

export type EnumKind = keyof EnumValues;

interface EnumSelectProps {
    id: string;
    name?: string;
    label: string;
    kind: EnumKind;
    value: string;
    onChange: (e: ChangeEvent<HTMLSelectElement>) => void;
    placeholder: string;
    required?: boolean;
    error?: string;
    helpText?: string;
}

export default function EnumSelect({
    id,
    name,
    label,
    kind,
    value,
    onChange,
    placeholder,
    required,
    error,
    helpText,
}: EnumSelectProps) {
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
            value={value}
            onChange={onChange}
            options={options}
            required={required}
            error={error}
            helpText={helpText}
        />
    );
}
