import { Link } from 'react-router-dom';
import './Admin.css';

function AdminDashboard() {
    return (
        <div className="admin-dashboard">
            <h1>Welcome, Admin!</h1>
            <p>This is your central hub for managing the Miedăria Păunilor online shop.</p>
            
            <div className="dashboard-cards">
                <Link to="products" className="card-link">
                    <div className="card">
                        <h3>Manage Products</h3>
                        <p>Add, edit, or remove products from your shop.</p>
                    </div>
                </Link>
                {/* Add more cards for other sections like Orders, Users etc. */}
            </div>
        </div>
    );
}

export default AdminDashboard;