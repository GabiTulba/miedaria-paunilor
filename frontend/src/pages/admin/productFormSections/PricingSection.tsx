import { Controller, useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { ProductFormData } from '../../../types';
import NumberInput from '../../../components/forms/NumberInput';
import { useLanguage } from '../../../hooks/useLanguage';
import { useFormattedDate } from '../../../hooks/useFormattedDate';
import { useFetch } from '../../../hooks/useFetch';
import { api } from '../../../lib/api';
import { numericOptions, validateAbv, validatePositiveNumber, validateNonNegative } from '../../../lib/validators';
// Side-effect import — registers en/ro locales with react-datepicker.
import '../../../utils/dateUtils';

// bottling_date is stored as a YYYY-MM-DD string; react-datepicker works in Dates.
function isoToDate(iso: string): Date | null {
    if (!iso || iso.trim() === '') return null;
    const [year, month, day] = iso.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return isNaN(date.getTime()) ? null : date;
}

function dateToIso(date: Date | null): string {
    if (!date) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function PricingSection() {
    const { t } = useTranslation();
    const language = useLanguage();
    const formatDate = useFormattedDate();
    const { register, control, formState: { errors } } = useFormContext<ProductFormData>();

    // Prices are entered in RON only; show the indicative EUR equivalent at
    // the current BNR rate as a hint under the input.
    const { data: exchangeRate } = useFetch(signal => api.getExchangeRate(signal), []);
    const priceRon = useWatch({ control, name: 'price_ron' });
    const eurHint = exchangeRate && Number(priceRon) > 0
        ? t('admin.productForm.priceRonEurApprox', {
            amount: (Number(priceRon) / exchangeRate.rate).toFixed(2),
            date: formatDate(exchangeRate.rate_date),
        })
        : undefined;

    return (
        <div className="form-section">
            <h2 className="section-title">{t('admin.productForm.pricingInventory')}</h2>
            <div className="section-content">
                <div className="form-row">
                    <NumberInput
                        id="abv"
                        label={t('admin.productForm.abv')}
                        required
                        step="0.1"
                        min="0"
                        max="99.9"
                        error={errors.abv?.message}
                        helpText={t('admin.productForm.abvHelp')}
                        {...register('abv', numericOptions(validateAbv))}
                    />
                    <NumberInput
                        id="price_ron"
                        label={t('admin.productForm.price') + ' (RON)'}
                        required
                        step="0.01"
                        min="0"
                        error={errors.price_ron?.message}
                        helpText={eurHint ?? t('admin.productForm.priceRonHelp')}
                        {...register('price_ron', numericOptions((v) => validatePositiveNumber(v, 'Price (RON)')))}
                    />
                </div>
                <div className="form-row">
                    <NumberInput
                        id="bottle_count"
                        label={t('admin.productForm.bottleCount')}
                        required
                        min="0"
                        error={errors.bottle_count?.message}
                        helpText={t('admin.productForm.bottleCount')}
                        {...register('bottle_count', numericOptions((v) => validateNonNegative(v, 'Bottle count')))}
                    />
                    <NumberInput
                        id="bottle_size"
                        label={t('admin.productForm.bottleSize')}
                        required
                        min="1"
                        error={errors.bottle_size?.message}
                        helpText={t('admin.productForm.bottleSizeHelp')}
                        {...register('bottle_size', numericOptions((v) => validatePositiveNumber(v, 'Bottle size')))}
                    />
                </div>
                <div className="form-row">
                    <div className="form-group">
                        <label htmlFor="bottling_date" className="form-label">
                            {t('admin.productForm.bottlingDate')}
                            <span className="required-indicator">*</span>
                        </label>
                        <Controller
                            name="bottling_date"
                            control={control}
                            rules={{
                                validate: (v) =>
                                    !v || v.trim() === '' || isNaN(new Date(v).getTime())
                                        ? t('admin.productForm.validation.invalidBottlingDate')
                                        : undefined,
                            }}
                            render={({ field }) => (
                                <DatePicker
                                    id="bottling_date"
                                    selected={isoToDate(field.value)}
                                    onChange={(date: Date | null) => field.onChange(dateToIso(date))}
                                    onBlur={field.onBlur}
                                    dateFormat="dd/MM/yyyy"
                                    locale={language === 'ro' ? 'ro' : 'en'}
                                    className={`form-input ${errors.bottling_date ? 'input-error' : ''}`}
                                    placeholderText="DD/MM/YYYY"
                                    isClearable
                                    showYearDropdown
                                    yearDropdownItemNumber={10}
                                    scrollableYearDropdown
                                    required
                                />
                            )}
                        />
                        {errors.bottling_date?.message && (
                            <div className="error-message">{errors.bottling_date.message}</div>
                        )}
                        <div className="help-text">{t('admin.productForm.bottlingDateHelp')}</div>
                    </div>
                    <NumberInput
                        id="lot_number"
                        label={t('admin.productForm.lotNumber')}
                        required
                        min="1"
                        error={errors.lot_number?.message}
                        helpText={t('admin.productForm.lotNumberHelp')}
                        {...register('lot_number', numericOptions((v) => validatePositiveNumber(v, 'Lot number')))}
                    />
                </div>
            </div>
        </div>
    );
}

export default PricingSection;
