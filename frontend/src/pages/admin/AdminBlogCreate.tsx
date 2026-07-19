import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FormProvider, useForm, type SubmitHandler } from 'react-hook-form';
import { useToast } from '../../context/ToastContext';
import { api } from '../../lib/api';
import { NewBlogPost } from '../../types';
import BlogForm from './BlogForm';
import { applyServerErrors, blogErrorMapping, mapBackendValidationErrors } from './errorMappings';

const INITIAL_POST: NewBlogPost = {
    title: '',
    title_ro: '',
    slug: '',
    content_markdown: '',
    content_markdown_ro: '',
    excerpt: '',
    excerpt_ro: '',
    author: '',
    is_published: true,
};

function AdminBlogCreate() {
    const [submitting, setSubmitting] = useState(false);
    const { showToast } = useToast();
    const { t } = useTranslation();
    const navigate = useNavigate();

    const methods = useForm<NewBlogPost>({ defaultValues: INITIAL_POST, mode: 'onBlur' });

    const onSubmit: SubmitHandler<NewBlogPost> = async (data) => {
        if (submitting) return;
        try {
            setSubmitting(true);
            await api.createBlogPost(data);
            showToast(t('admin.blog.created'), 'success');
            navigate('/admin/dashboard/blog');
        } catch (err) {
            console.error('Failed to create blog post:', err);
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

    return (
        <FormProvider {...methods}>
            <BlogForm
                onSubmit={onSubmit}
                submitting={submitting}
                onCancel={() => navigate('/admin/dashboard/blog')}
            />
        </FormProvider>
    );
}

export default AdminBlogCreate;
