import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { NewBlogPost, UpdateBlogPost } from '../../types';
import TextInput from '../../components/forms/TextInput';
import TextAreaInput from '../../components/forms/TextAreaInput';
import BooleanSelect from '../../components/forms/BooleanSelect';
import { validateRequired, validateSlug } from '../../lib/validators';
import { BLOG_AUTHOR_MAX, BLOG_EXCERPT_MAX, BLOG_SLUG_MAX, BLOG_TITLE_MAX } from '../../lib/blogConstants';
import { useShakeOnError } from '../../hooks/useShakeOnError';
import './Admin.css';

export type BlogFormData = NewBlogPost | UpdateBlogPost;

interface BlogFormProps {
    formData: BlogFormData;
    setFormData: (data: BlogFormData) => void;
    onSubmit: (e: React.FormEvent) => void;
    isEdit?: boolean;
    errors?: Record<string, string>;
    submitting?: boolean;
    onCancel: () => void;
    formError?: string | null;
}

function BlogForm({
    formData,
    setFormData,
    onSubmit,
    isEdit = false,
    errors = {},
    submitting = false,
    onCancel,
    formError,
}: BlogFormProps) {
    const { t } = useTranslation();
    const formRef = useRef<HTMLFormElement>(null);
    useShakeOnError(formRef, Object.keys(errors).length);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
    };

    const setIsPublished = (next: boolean) => {
        setFormData({ ...formData, is_published: next });
    };

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

            <form onSubmit={onSubmit} className="admin-form" ref={formRef}>
                {Object.keys(errors).length > 0 && (
                    <div className="validation-summary" role="alert">
                        <h4>{t('admin.blog.form.validationErrors')}</h4>
                        <ul>
                            {Object.values(errors).filter(Boolean).map((err, i) => (
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
                            name="title"
                            value={formData.title || ''}
                            onChange={handleChange}
                            error={errors.title}
                            required
                            maxLength={BLOG_TITLE_MAX}
                            validate={(v) => validateRequired(v, 'Title')}
                        />
                        <TextInput
                            id="title_ro"
                            label={t('admin.blog.form.titleRo')}
                            name="title_ro"
                            value={formData.title_ro || ''}
                            onChange={handleChange}
                            error={errors.title_ro}
                            required
                            maxLength={BLOG_TITLE_MAX}
                            validate={(v) => validateRequired(v, 'Romanian title')}
                        />
                    </div>

                    <div className="form-row">
                        <TextInput
                            id="slug"
                            label={t('admin.blog.form.slug')}
                            name="slug"
                            value={formData.slug || ''}
                            onChange={handleChange}
                            error={errors.slug}
                            required
                            maxLength={BLOG_SLUG_MAX}
                            helpText={t('admin.blog.form.slugHelp')}
                            validate={(v) => validateSlug(v)}
                        />
                        <TextInput
                            id="author"
                            label={t('admin.blog.form.author')}
                            name="author"
                            value={formData.author || ''}
                            onChange={handleChange}
                            error={errors.author}
                            required
                            maxLength={BLOG_AUTHOR_MAX}
                            validate={(v) => validateRequired(v, 'Author')}
                        />
                    </div>

                    <div className="form-row">
                        <BooleanSelect
                            id="is_published"
                            label={t('admin.blog.form.status')}
                            value={formData.is_published ?? true}
                            onChange={setIsPublished}
                            trueLabel={t('admin.blog.status.published')}
                            falseLabel={t('admin.blog.status.draft')}
                        />
                    </div>
                </div>

                <div className="form-section">
                    <h3>{t('admin.blog.form.content')}</h3>

                    <div className="form-row">
                        <TextAreaInput
                            id="excerpt"
                            label={t('admin.blog.form.excerptEn')}
                            name="excerpt"
                            value={formData.excerpt || ''}
                            onChange={handleChange}
                            error={errors.excerpt}
                            required
                            rows={3}
                            maxLength={BLOG_EXCERPT_MAX}
                            helpText={t('admin.blog.form.excerptHelp')}
                            validate={(v) => validateRequired(v, 'Excerpt')}
                        />
                        <TextAreaInput
                            id="excerpt_ro"
                            label={t('admin.blog.form.excerptRo')}
                            name="excerpt_ro"
                            value={formData.excerpt_ro || ''}
                            onChange={handleChange}
                            error={errors.excerpt_ro}
                            required
                            rows={3}
                            maxLength={BLOG_EXCERPT_MAX}
                            validate={(v) => validateRequired(v, 'Romanian excerpt')}
                        />
                    </div>

                    <div className="form-row">
                        <TextAreaInput
                            id="content_markdown"
                            label={t('admin.blog.form.contentEn')}
                            name="content_markdown"
                            value={formData.content_markdown || ''}
                            onChange={handleChange}
                            error={errors.content_markdown}
                            required
                            rows={10}
                            helpText={t('admin.blog.form.contentHelp')}
                            validate={(v) => validateRequired(v, 'Content')}
                        />
                        <TextAreaInput
                            id="content_markdown_ro"
                            label={t('admin.blog.form.contentRo')}
                            name="content_markdown_ro"
                            value={formData.content_markdown_ro || ''}
                            onChange={handleChange}
                            error={errors.content_markdown_ro}
                            required
                            rows={10}
                            validate={(v) => validateRequired(v, 'Romanian content')}
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
