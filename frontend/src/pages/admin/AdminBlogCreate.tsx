import { useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthContext } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../lib/api';
import { NewBlogPost } from '../../types';
import BlogForm, { BlogFormData } from './BlogForm';
import { blogErrorMapping, mapBackendValidationErrors } from './errorMappings';

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
    const [formData, setFormData] = useState<BlogFormData>(INITIAL_POST);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [formError, setFormError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const { token } = useContext(AuthContext);
    const { showToast } = useToast();
    const { t } = useTranslation();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!token || submitting) return;
        setErrors({});
        setFormError(null);
        try {
            setSubmitting(true);
            await api.createBlogPost(formData as NewBlogPost, token);
            showToast(t('admin.blog.created'), 'success');
            navigate('/admin/dashboard/blog');
        } catch (err: any) {
            console.error('Failed to create blog post:', err);
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

    return (
        <BlogForm
            formData={formData}
            setFormData={setFormData}
            onSubmit={handleSubmit}
            errors={errors}
            submitting={submitting}
            onCancel={() => navigate('/admin/dashboard/blog')}
            formError={formError}
        />
    );
}

export default AdminBlogCreate;
