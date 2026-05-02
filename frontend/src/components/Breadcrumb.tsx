import { Link } from 'react-router-dom';
import './Breadcrumb.css';

interface BreadcrumbItem {
    label: string;
    to?: string;
}

interface BreadcrumbProps {
    items: BreadcrumbItem[];
}

function Breadcrumb({ items }: BreadcrumbProps) {
    return (
        <nav className="breadcrumb" aria-label="breadcrumb">
            {items.map((item, index) => (
                <span key={index} className="breadcrumb-item">
                    {index > 0 && <span className="breadcrumb-separator" aria-hidden="true"> &rsaquo; </span>}
                    {item.to && index < items.length - 1 ? (
                        <Link to={item.to}>{item.label}</Link>
                    ) : (
                        <span aria-current={index === items.length - 1 ? 'page' : undefined}>{item.label}</span>
                    )}
                </span>
            ))}
        </nav>
    );
}

export default Breadcrumb;
