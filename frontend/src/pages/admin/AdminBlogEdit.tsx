import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FormProvider, useForm, type SubmitHandler } from 'react-hook-form';
import { useToast } from '../../context/ToastContext';
import { api } from '../../lib/api';
import { useFetch } from '../../hooks/useFetch';
import { NewBlogPost } from '../../types';
import BlogForm from './BlogForm';
import { applyServerErrors, blogErrorMapping, mapBackendValidationErrors } from './errorMappings';
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

    const [submitting, setSubmitting] = useState(false);

    // Must be referentially stable, or `values` resets the form every render.
    const formValues = useMemo<NewBlogPost | undefined>(() => post ? {
        title: post.title,
        title_ro: post.title_ro,
        slug: post.slug,
        content_markdown: post.content_markdown,
        content_markdown_ro: post.content_markdown_ro,
        excerpt: post.excerpt,
        excerpt_ro: post.excerpt_ro,
        author: post.author,
        is_published: post.is_published,
    } : undefined, [post]);

    const methods = useForm<NewBlogPost>({ mode: 'onBlur', values: formValues });

    const onSubmit: SubmitHandler<NewBlogPost> = async (data) => {
        if (!id || submitting) return;
        try {
            setSubmitting(true);
            await api.updateBlogPost(id, data);
            showToast(t('admin.blog.updated'), 'success');
            navigate('/admin/dashboard/blog');
        } catch (err) {
            console.error('Failed to update blog post:', err);
            const validationErrors = mapBackendValidationErrors(err, blogErrorMapping, t, 'blog');
            if (validationErrors) {
                applyServerErrors(methods.setError, validationErrors);
            } else {
                const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
                methods.setError('root.server', { message: message || t('common.error') });
            }
        } finally {
            setSubmitting(false);
        }
    };

    if (error) {
        return <ErrorDisplay error={t('common.error')} onRetry={refetch} retryLabel={t('common.retry')} />;
    }
    if (loading || !post) {
        return <p>{t('common.loading')}</p>;
    }

    return (
        <FormProvider {...methods}>
            <BlogForm
                onSubmit={onSubmit}
                isEdit
                submitting={submitting}
                onCancel={() => navigate('/admin/dashboard/blog')}
            />
        </FormProvider>
    );
}

export default AdminBlogEdit;
