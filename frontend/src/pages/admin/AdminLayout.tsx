import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import { useContext, useState, useEffect, useRef } from "react";
import { useTranslation } from 'react-i18next';
import { AuthContext } from "../../context/AuthContext";
import ConfirmModal from "../../components/ConfirmModal";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import './Admin.css';

function AdminLayout() {
    const { setToken } = useContext(AuthContext);
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { pathname } = useLocation();
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const isDesktop = useMediaQuery('(min-width: 1024px)');
    const hamburgerRef = useRef<HTMLButtonElement>(null);
    const sidebarRef = useRef<HTMLElement>(null);

    const handleLogout = () => {
        setShowLogoutConfirm(false);
        setToken(null);
        navigate('/admin');
    };

    useEffect(() => {
        setIsSidebarOpen(false);
    }, [pathname]);

    useEffect(() => {
        if (!isSidebarOpen || isDesktop) return;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const firstLink = sidebarRef.current?.querySelector<HTMLElement>('a');
        firstLink?.focus();

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setIsSidebarOpen(false);
                hamburgerRef.current?.focus();
            }
        };

        const handlePointerDown = (e: PointerEvent) => {
            const target = e.target as Node;
            if (
                sidebarRef.current &&
                !sidebarRef.current.contains(target) &&
                hamburgerRef.current &&
                !hamburgerRef.current.contains(target)
            ) {
                setIsSidebarOpen(false);
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('pointerdown', handlePointerDown);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('pointerdown', handlePointerDown);
            document.body.style.overflow = previousOverflow;
        };
    }, [isSidebarOpen, isDesktop]);

    const toggleSidebar = () => setIsSidebarOpen(open => !open);

    return (
        <div className="admin-layout admin-page">
            <header className="admin-topbar">
                <button
                    ref={hamburgerRef}
                    type="button"
                    className="admin-hamburger"
                    onClick={toggleSidebar}
                    aria-expanded={isSidebarOpen}
                    aria-controls="admin-sidebar"
                    aria-label={t('navigation.toggleMenu')}
                >
                    <span className="bar"></span>
                    <span className="bar"></span>
                    <span className="bar"></span>
                </button>
                <span className="admin-topbar-title">{t('admin.dashboard.title')}</span>
            </header>
            <aside
                id="admin-sidebar"
                ref={sidebarRef}
                className={`admin-sidebar${isSidebarOpen ? ' open' : ''}`}
            >
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
                    <NavLink to="/admin/dashboard/blog" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                        <span className="nav-icon blog-icon"></span>
                        <span className="nav-text">{t('blog.title')}</span>
                    </NavLink>
                </nav>
                <div className="sidebar-footer">
                    <button onClick={() => setShowLogoutConfirm(true)} className="logout-button">
                        <span className="logout-icon"></span>
                        <span>{t('common.logout')}</span>
                    </button>
                </div>
            </aside>
            {isSidebarOpen && !isDesktop && (
                <div
                    className="admin-backdrop"
                    aria-hidden="true"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}
            <main className="admin-main-content">
                <Outlet />
            </main>
            {showLogoutConfirm && (
                <ConfirmModal
                    title={t('admin.logout.confirmTitle')}
                    message={t('admin.logout.confirmMessage')}
                    confirmLabel={t('common.logout')}
                    cancelLabel={t('common.cancel')}
                    onConfirm={handleLogout}
                    onCancel={() => setShowLogoutConfirm(false)}
                    variant="danger"
                />
            )}
        </div>
    );
}

export default AdminLayout;
