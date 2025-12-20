import { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthContext } from '../../context/AuthContext';
import { api } from '../../lib/api';
import './Admin.css';

function AdminLogin() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { setToken } = useContext(AuthContext);
    const navigate = useNavigate();
    const { t } = useTranslation();

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
                    
                    <form onSubmit={handleSubmit} className="login-form">
                        <div className="form-group">
                            <label htmlFor="username">{t('admin.login.username')}</label>
                            <input
                                id="username"
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                                placeholder={t('admin.login.username')}
                                className="login-input"
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="password">{t('admin.login.password')}</label>
                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                placeholder={t('admin.login.password')}
                                className="login-input"
                            />
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
