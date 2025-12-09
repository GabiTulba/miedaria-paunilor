import { useState } from 'react';
import './CollapsibleSection.css';

interface CollapsibleSectionProps {
    title: string;
    children: React.ReactNode;
    defaultCollapsed?: boolean;
}

function CollapsibleSection({ title, children, defaultCollapsed = true }: CollapsibleSectionProps) {
    const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

    const toggleCollapse = () => {
        setIsCollapsed(!isCollapsed);
    };

    return (
        <div className="collapsible-section">
            <button 
                className="collapsible-header" 
                onClick={toggleCollapse}
                aria-expanded={!isCollapsed}
            >
                <span className="collapsible-title">{title}</span>
                <span className="collapsible-icon">
                    {isCollapsed ? '＋' : '－'}
                </span>
            </button>
            <div 
                className={`collapsible-content ${isCollapsed ? 'collapsed' : 'expanded'}`}
                aria-hidden={isCollapsed}
            >
                {children}
            </div>
        </div>
    );
}

export default CollapsibleSection;