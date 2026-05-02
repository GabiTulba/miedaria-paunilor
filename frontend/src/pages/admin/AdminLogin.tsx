import { useState, useContext, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthContext } from '../../context/AuthContext';
import { api } from '../../lib/api';
import './Admin.css';

function AdminLogin() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const { setToken } = useContext(AuthContext);
    const navigate = useNavigate();
    const { t } = useTranslation();
    const formRef = useRef<HTMLFormElement>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        try {
            const data = await api.adminLogin({ username, password });
            if (data && data.token) {
                setToken(data.token);
                navigate('/admin/dashboard');
            } else {
                throw new Error('Login failed');
            }
        } catch (err) {
            setError(t('admin.login.invalidCredentials'));
            formRef.current?.classList.add('shake');
            formRef.current?.addEventListener('animationend', () => {
                formRef.current?.classList.remove('shake');
            }, { once: true });
            console.error(err);
        }
    };

    return (
        <div className="admin-login-page">
            <div className="login-container">
                <div className="login-card">
                    <div className="login-card-header">
                        <h2>{t('admin.login.title')}</h2>
                        <p>{t('admin.login.subtitle')}</p>
                    </div>
                    
                    <form onSubmit={handleSubmit} className="login-form" ref={formRef}>
                        <div className="form-group">
                            <label htmlFor="username">{t('admin.login.username')}</label>
                            <input
                                id="username"
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                                autoComplete="username"
                                placeholder={t('admin.login.username')}
                                className="login-input"
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="password">{t('admin.login.password')}</label>
                            <div className="password-input-wrapper">
                                <input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    autoComplete="current-password"
                                    placeholder={t('admin.login.password')}
                                    className="login-input"
                                />
                                <button
                                    type="button"
                                    className="password-toggle"
                                    onClick={() => setShowPassword(!showPassword)}
                                    aria-label={showPassword ? t('admin.login.hidePassword') : t('admin.login.showPassword')}
                                    tabIndex={-1}
                                >
                                    <img
                                        src="/eye_open.svg"
                                        alt=""
                                        className={`password-toggle-icon${showPassword ? '' : ' hidden'}`}
                                    />
                                    <img
                                        src="/eye_closed.svg"
                                        alt=""
                                        className={`password-toggle-icon${!showPassword ? '' : ' hidden'}`}
                                    />
                                </button>
                            </div>
                        </div>
                        
                        {error && (
                            <div className="login-error">
                                <span className="error-icon warning-icon"></span>
                                <span>{error}</span>
                            </div>
                        )}
                        
                        <button type="submit" className="button button-primary login-button">
                            {t('admin.login.signIn')}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default AdminLogin;
