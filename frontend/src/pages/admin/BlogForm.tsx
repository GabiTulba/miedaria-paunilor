import { useState, useContext, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { NewBlogPost, UpdateBlogPost } from '../../types';
import { api } from '../../lib/api';
import { AuthContext } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import TextInput from '../../components/forms/TextInput';
import TextAreaInput from '../../components/forms/TextAreaInput';
import SelectInput from '../../components/forms/SelectInput';
import './Admin.css';

function validateRequired(value: string, fieldName: string): string | undefined {
    if (!value.trim()) return `${fieldName} is required`;
    return undefined;
}

function validateSlug(value: string): string | undefined {
    if (!value.trim()) return 'Slug is required';
    if (!/^[a-z0-9-]+$/.test(value)) return 'Only lowercase letters, numbers, hyphens';
    if (value.length > 256) return 'Max 256 characters';
    return undefined;
}

interface BlogFormProps {
    isEdit?: boolean;
}

function BlogForm({ isEdit = false }: BlogFormProps) {
    const { id } = useParams<{ id: string }>();
    const [formData, setFormData] = useState<NewBlogPost | UpdateBlogPost>({
        title: '',
        title_ro: '',
        slug: '',
        content_markdown: '',
        content_markdown_ro: '',
        excerpt: '',
        excerpt_ro: '',
        author: '',
        is_published: true,
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    const { t } = useTranslation();
    const { token } = useContext(AuthContext);
    const { showToast } = useToast();
    const navigate = useNavigate();
    const formRef = useRef<HTMLFormElement>(null);

    useEffect(() => {
        if (isEdit && id && token) {
            const fetchBlogPost = async () => {
                try {
                    setLoading(true);
                    const posts = await api.getBlogPostsAdmin(token);
                    const post = posts.find(p => p.id === id);
                    if (post) {
                        setFormData({
                            title: post.title,
                            title_ro: post.title_ro,
                            slug: post.slug,
                            content_markdown: post.content_markdown,
                            content_markdown_ro: post.content_markdown_ro,
                            excerpt: post.excerpt,
                            excerpt_ro: post.excerpt_ro,
                            author: post.author,
                            is_published: post.is_published,
                        });
                    }
                } catch (err) {
                    console.error("Failed to fetch blog post:", err);
                    setError(t('common.error'));
                } finally {
                    setLoading(false);
                }
            };
            fetchBlogPost();
        }
    }, [isEdit, id, token, t]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        let newValue: any = value;
        
        if (type === 'checkbox') {
            newValue = (e.target as HTMLInputElement).checked;
        } else if (name === 'is_published') {
            // Convert string 'true'/'false' to boolean
            newValue = value === 'true';
        }
        
        setFormData(prev => ({
            ...prev,
            [name]: newValue
        }));

        // Clear error for this field
        if (formErrors[name]) {
            setFormErrors(prev => ({
                ...prev,
                [name]: ''
            }));
        }
    };

    const validateForm = (): boolean => {
        const errors: Record<string, string> = {};

        if (!formData.title?.trim()) {
            errors.title = t('common.required');
        }

        if (!formData.title_ro?.trim()) {
            errors.title_ro = t('common.required');
        }

        if (!formData.slug?.trim()) {
            errors.slug = t('common.required');
        } else if (!/^[a-z0-9-]+$/.test(formData.slug)) {
            errors.slug = t('admin.blog.form.slugInvalid');
        }

        if (!formData.content_markdown?.trim()) {
            errors.content_markdown = t('common.required');
        }

        if (!formData.content_markdown_ro?.trim()) {
            errors.content_markdown_ro = t('common.required');
        }

        if (!formData.excerpt?.trim()) {
            errors.excerpt = t('common.required');
        }

        if (!formData.excerpt_ro?.trim()) {
            errors.excerpt_ro = t('common.required');
        }

        if (!formData.author?.trim()) {
            errors.author = t('common.required');
        }

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!token || !validateForm()) {
            return;
        }

        try {
            setLoading(true);
            setError(null);

            if (isEdit && id) {
                await api.updateBlogPost(id, formData as UpdateBlogPost, token);
            } else {
                await api.createBlogPost(formData as NewBlogPost, token);
            }

            showToast(t(isEdit ? 'admin.blog.updated' : 'admin.blog.created'), 'success');
            navigate('/admin/dashboard/blog');
        } catch (err: any) {
            console.error("Failed to save blog post:", err);
            
            if (err.response?.data?.errors) {
                const validationErrors: Record<string, string> = {};
                err.response.data.errors.forEach((error: any) => {
                    if (error === 'EmptyTitle') validationErrors.title = t('common.required');
                    else if (error === 'EmptyTitleRo') validationErrors.title_ro = t('common.required');
                    else if (error === 'EmptySlug' || error === 'InvalidSlug') validationErrors.slug = 'Invalid slug format';
                    else if (error === 'EmptyContent') validationErrors.content_markdown = t('common.required');
                    else if (error === 'EmptyContentRo') validationErrors.content_markdown_ro = t('common.required');
                    else if (error === 'EmptyExcerpt') validationErrors.excerpt = t('common.required');
                    else if (error === 'EmptyExcerptRo') validationErrors.excerpt_ro = t('common.required');
                    else if (error === 'EmptyAuthor') validationErrors.author = t('common.required');
                });
                setFormErrors(validationErrors);
            } else {
                setError(err.response?.data?.message || t('common.error'));
            }
            formRef.current?.classList.add('shake');
            formRef.current?.addEventListener('animationend', () => {
                formRef.current?.classList.remove('shake');
            }, { once: true });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="admin-content">
            <div className="admin-header">
                <div className="header-content">
                    <h1>{isEdit ? t('admin.blog.form.editTitle') : t('admin.blog.form.createTitle')}</h1>
                    <p>{isEdit ? t('admin.blog.form.editSubtitle') : t('admin.blog.form.createSubtitle')}</p>
                </div>
            </div>

            {error && (
                <div className="error-message">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="admin-form" ref={formRef}>
                {Object.keys(formErrors).length > 0 && (
                    <div className="validation-summary" role="alert">
                        <h4>{t('admin.blog.form.validationErrors')}</h4>
                        <ul>
                            {Object.values(formErrors).filter(Boolean).map((err, i) => (
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
                            error={formErrors.title}
                            required
                            validate={(v) => validateRequired(v, 'Title')}
                        />
                        <TextInput
                            id="title_ro"
                            label={t('admin.blog.form.titleRo')}
                            name="title_ro"
                            value={formData.title_ro || ''}
                            onChange={handleChange}
                            error={formErrors.title_ro}
                            required
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
                            error={formErrors.slug}
                            required
                            helpText={t('admin.blog.form.slugHelp')}
                            validate={(v) => validateSlug(v)}
                        />
                        <TextInput
                            id="author"
                            label={t('admin.blog.form.author')}
                            name="author"
                            value={formData.author || ''}
                            onChange={handleChange}
                            error={formErrors.author}
                            required
                            validate={(v) => validateRequired(v, 'Author')}
                        />
                    </div>

                    <div className="form-row">
                        <SelectInput
                            id="is_published"
                            label={t('admin.blog.form.status')}
                            name="is_published"
                            value={formData.is_published ? 'true' : 'false'}
                            onChange={handleChange}
                            options={[
                                { value: 'true', label: t('admin.blog.status.published') },
                                { value: 'false', label: t('admin.blog.status.draft') }
                            ]}
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
                            error={formErrors.excerpt}
                            required
                            rows={3}
                            helpText={t('admin.blog.form.excerptHelp')}
                            validate={(v) => validateRequired(v, 'Excerpt')}
                        />
                        <TextAreaInput
                            id="excerpt_ro"
                            label={t('admin.blog.form.excerptRo')}
                            name="excerpt_ro"
                            value={formData.excerpt_ro || ''}
                            onChange={handleChange}
                            error={formErrors.excerpt_ro}
                            required
                            rows={3}
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
                            error={formErrors.content_markdown}
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
                            error={formErrors.content_markdown_ro}
                            required
                            rows={10}
                            validate={(v) => validateRequired(v, 'Romanian content')}
                        />
                    </div>
                </div>

                <div className="form-actions">
                    <button
                        type="button"
                        onClick={() => navigate('/admin/dashboard/blog')}
                        className="secondary-button"
                        disabled={loading}
                    >
                        {t('common.cancel')}
                    </button>
                    <button
                        type="submit"
                        className="primary-button"
                        disabled={loading}
                    >
                        {loading ? t('common.loading') : (isEdit ? t('common.update') : t('common.create'))}
                    </button>
                </div>
            </form>
        </div>
    );
}

export default BlogForm;