import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useContext } from "react";
import { useTranslation } from 'react-i18next';
import { AuthContext } from "../../context/AuthContext";
import './Admin.css';

function AdminLayout() {
    const { setToken } = useContext(AuthContext);
    const navigate = useNavigate();
    const { t } = useTranslation();

    const handleLogout = () => {
        setToken(null);
        navigate('/admin');
    };

    return (
        <div className="admin-layout">
            <aside className="admin-sidebar">
                <div className="sidebar-header">
                    <h2>{t('admin.dashboard.title')}</h2>
                    <p className="sidebar-subtitle">Miedăria Păunilor</p>
                </div>
                <nav className="admin-nav">
                    <NavLink to="/admin/dashboard" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                        <span className="nav-icon dashboard-icon"></span>
                        <span className="nav-text">{t('navigation.dashboard')}</span>
                    </NavLink>
                    <NavLink to="/admin/dashboard/products" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                        <span className="nav-icon products-icon"></span>
                        <span className="nav-text">{t('navigation.products')}</span>
                    </NavLink>
                    <NavLink to="/admin/dashboard/images" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                        <span className="nav-icon images-icon"></span>
                        <span className="nav-text">{t('navigation.images')}</span>
                    </NavLink>
                </nav>
                <div className="sidebar-footer">
                    <button onClick={handleLogout} className="logout-button">
                        <span className="logout-icon"></span>
                        <span>{t('common.logout')}</span>
                    </button>
                </div>
            </aside>
            <main className="admin-main-content">
                <Outlet />
            </main>
        </div>
    );
}

export default AdminLayout;