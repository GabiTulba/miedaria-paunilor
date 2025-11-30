import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useContext } from "react";
import { AuthContext } from "../../context/AuthContext";
import './Admin.css';

function AdminLayout() {
    const { setToken } = useContext(AuthContext);
    const navigate = useNavigate();

    const handleLogout = () => {
        setToken(null);
        navigate('/admin');
    };

    return (
        <div className="admin-layout">
            <aside className="admin-sidebar">
                <h2>Admin Panel</h2>
                <nav className="admin-nav">
                    <NavLink to="/admin/dashboard">Dashboard</NavLink>
                    <NavLink to="/admin/dashboard/products">Products</NavLink>
                    <NavLink to="/admin/dashboard/images">Images</NavLink> {/* New NavLink */}
                    {/* Add other admin links here */}
                </nav>
                <button onClick={handleLogout} className="button-secondary" style={{ width: '100%', marginTop: '2rem' }}>Logout</button>
            </aside>
            <main className="admin-main-content">
                <Outlet />
            </main>
        </div>
    );
}

export default AdminLayout;