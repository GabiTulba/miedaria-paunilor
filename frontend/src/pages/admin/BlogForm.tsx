import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Controller, useFormContext, type SubmitHandler } from 'react-hook-form';
import { NewBlogPost } from '../../types';
import TextInput from '../../components/forms/TextInput';
import TextAreaInput from '../../components/forms/TextAreaInput';
import BooleanSelect from '../../components/forms/BooleanSelect';
import { validateRequired, validateSlug } from '../../lib/validators';
import { BLOG_AUTHOR_MAX, BLOG_EXCERPT_MAX, BLOG_SLUG_MAX, BLOG_TITLE_MAX } from '../../lib/blogConstants';
import { useShakeOnError } from '../../hooks/useShakeOnError';
import './Admin.css';

interface BlogFormProps {
    onSubmit: SubmitHandler<NewBlogPost>;
    isEdit?: boolean;
    submitting?: boolean;
    onCancel: () => void;
}

function BlogForm({ onSubmit, isEdit = false, submitting = false, onCancel }: BlogFormProps) {
    const { t } = useTranslation();
    const formRef = useRef<HTMLFormElement>(null);
    const {
        register,
        control,
        handleSubmit,
        formState: { errors, submitCount },
    } = useFormContext<NewBlogPost>();

    const formError = errors.root?.server?.message;
    const fieldErrorMessages = Object.entries(errors)
        .filter(([field]) => field !== 'root')
        .map(([, fieldError]) => fieldError?.message)
        .filter((message): message is string => Boolean(message));
    // Gate the shake on submitCount so plain blur-validation errors never trigger it.
    useShakeOnError(formRef, fieldErrorMessages.length > 0 || formError ? submitCount : 0);

    return (
        <div className="admin-content">
            <div className="admin-header">
                <div className="header-content">
                    <h1>{isEdit ? t('admin.blog.form.editTitle') : t('admin.blog.form.createTitle')}</h1>
                    <p>{isEdit ? t('admin.blog.form.editSubtitle') : t('admin.blog.form.createSubtitle')}</p>
                </div>
            </div>

            {formError && (
                <div className="error-message">
                    {formError}
                </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="admin-form" ref={formRef}>
                {submitCount > 0 && fieldErrorMessages.length > 0 && (
                    <div className="validation-summary" role="alert">
                        <h4>{t('admin.blog.form.validationErrors')}</h4>
                        <ul>
                            {fieldErrorMessages.map((err, i) => (
                                <li key={i}>{err}</li>
                            ))}
                        </ul>
                    </div>
                )}

                <div className="form-section">
                    <h3>{t('admin.blog.form.basicInfo')}</h3>

                    <div className="form-row">
                        <TextInput
                            id="title"
                            label={t('admin.blog.form.titleEn')}
                            error={errors.title?.message}
                            required
                            maxLength={BLOG_TITLE_MAX}
                            {...register('title', { validate: (v) => validateRequired(v, 'Title') })}
                        />
                        <TextInput
                            id="title_ro"
                            label={t('admin.blog.form.titleRo')}
                            error={errors.title_ro?.message}
                            required
                            maxLength={BLOG_TITLE_MAX}
                            {...register('title_ro', { validate: (v) => validateRequired(v, 'Romanian title') })}
                        />
                    </div>

                    <div className="form-row">
                        <TextInput
                            id="slug"
                            label={t('admin.blog.form.slug')}
                            error={errors.slug?.message}
                            required
                            maxLength={BLOG_SLUG_MAX}
                            helpText={t('admin.blog.form.slugHelp')}
                            {...register('slug', { validate: (v) => validateSlug(v) })}
                        />
                        <TextInput
                            id="author"
                            label={t('admin.blog.form.author')}
                            error={errors.author?.message}
                            required
                            maxLength={BLOG_AUTHOR_MAX}
                            {...register('author', { validate: (v) => validateRequired(v, 'Author') })}
                        />
                    </div>

                    <div className="form-row">
                        <Controller
                            name="is_published"
                            control={control}
                            render={({ field }) => (
                                <BooleanSelect
                                    id="is_published"
                                    label={t('admin.blog.form.status')}
                                    value={field.value ?? true}
                                    onChange={field.onChange}
                                    trueLabel={t('admin.blog.status.published')}
                                    falseLabel={t('admin.blog.status.draft')}
                                />
                            )}
                        />
                    </div>
                </div>

                <div className="form-section">
                    <h3>{t('admin.blog.form.content')}</h3>

                    <div className="form-row">
                        <TextAreaInput
                            id="excerpt"
                            label={t('admin.blog.form.excerptEn')}
                            error={errors.excerpt?.message}
                            required
                            rows={3}
                            maxLength={BLOG_EXCERPT_MAX}
                            helpText={t('admin.blog.form.excerptHelp')}
                            {...register('excerpt', { validate: (v) => validateRequired(v, 'Excerpt') })}
                        />
                        <TextAreaInput
                            id="excerpt_ro"
                            label={t('admin.blog.form.excerptRo')}
                            error={errors.excerpt_ro?.message}
                            required
                            rows={3}
                            maxLength={BLOG_EXCERPT_MAX}
                            {...register('excerpt_ro', { validate: (v) => validateRequired(v, 'Romanian excerpt') })}
                        />
                    </div>

                    <div className="form-row">
                        <TextAreaInput
                            id="content_markdown"
                            label={t('admin.blog.form.contentEn')}
                            error={errors.content_markdown?.message}
                            required
                            rows={10}
                            helpText={t('admin.blog.form.contentHelp')}
                            {...register('content_markdown', { validate: (v) => validateRequired(v, 'Content') })}
                        />
                        <TextAreaInput
                            id="content_markdown_ro"
                            label={t('admin.blog.form.contentRo')}
                            error={errors.content_markdown_ro?.message}
                            required
                            rows={10}
                            {...register('content_markdown_ro', { validate: (v) => validateRequired(v, 'Romanian content') })}
                        />
                    </div>
                </div>

                <div className="form-actions">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="secondary-button"
                        disabled={submitting}
                    >
                        {t('common.cancel')}
                    </button>
                    <button
                        type="submit"
                        className="primary-button"
                        disabled={submitting}
                    >
                        {submitting && <span className="button-spinner" aria-hidden="true" />}
                        {submitting ? t('common.loading') : (isEdit ? t('common.update') : t('common.create'))}
                    </button>
                </div>
            </form>
        </div>
    );
}

export default BlogForm;
