import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../context/ToastContext';
import { api } from '../../lib/api';
import { useFetch } from '../../hooks/useFetch';
import { UpdateBlogPost } from '../../types';
import BlogForm, { BlogFormData } from './BlogForm';
import { blogErrorMapping, mapBackendValidationErrors } from './errorMappings';
import ErrorDisplay from '../../components/ErrorDisplay';

function AdminBlogEdit() {
    const { id } = useParams<{ id: string }>();
    const { showToast } = useToast();
    const { t } = useTranslation();
    const navigate = useNavigate();

    const { data: post, loading, error, refetch } = useFetch(
        signal => (id ? api.getBlogPostByIdAdmin(id, signal) : Promise.resolve(null as never)),
        [id],
    );

    const [formData, setFormData] = useState<BlogFormData | null>(null);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [formError, setFormError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
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
    }, [post]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id || !formData || submitting) return;
        setErrors({});
        setFormError(null);
        try {
            setSubmitting(true);
            await api.updateBlogPost(id, formData as UpdateBlogPost);
            showToast(t('admin.blog.updated'), 'success');
            navigate('/admin/dashboard/blog');
        } catch (err: any) {
            console.error('Failed to update blog post:', err);
            const validationErrors = mapBackendValidationErrors(err, blogErrorMapping, t, 'blog');
            if (validationErrors) {
                setErrors(validationErrors);
            } else {
                setFormError(err.response?.data?.message || t('common.error'));
            }
        } finally {
            setSubmitting(false);
        }
    };

    if (error) {
        return <ErrorDisplay error={t('common.error')} onRetry={refetch} retryLabel={t('common.retry')} />;
    }
    if (loading || !formData) {
        return <p>{t('common.loading')}</p>;
    }

    return (
        <BlogForm
            formData={formData}
            setFormData={setFormData}
            onSubmit={handleSubmit}
            isEdit
            errors={errors}
            submitting={submitting}
            onCancel={() => navigate('/admin/dashboard/blog')}
            formError={formError}
        />
    );
}

export default AdminBlogEdit;
