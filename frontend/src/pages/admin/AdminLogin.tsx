import { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { api } from '../../lib/api';
import './Admin.css';

function AdminLogin() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { setToken } = useContext(AuthContext);
    const navigate = useNavigate();

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
            setError('Invalid username or password');
            console.error(err);
        }
    };

    return (
        <div className="admin-login-page">
            <div className="admin-form-container">
                <h2>Admin Login</h2>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="username">Username</label>
                        <input
                            id="username"
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="password">Password</label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    {error && <p className="error-message">{error}</p>}
                    <button type="submit" className="button">Login</button>
                </form>
            </div>
        </div>
    );
}

export default AdminLogin;
