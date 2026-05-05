import type { Components } from 'react-markdown';

const SAFE_PROTOCOLS = ['http:', 'https:', 'mailto:', 'tel:'];

function isSafeHref(href: string | undefined): boolean {
    if (!href) return false;
    const trimmed = href.trim();
    if (trimmed.startsWith('/') || trimmed.startsWith('#')) return true;
    try {
        const parsed = new URL(trimmed, window.location.origin);
        return SAFE_PROTOCOLS.includes(parsed.protocol);
    } catch {
        return false;
    }
}

function isSafeImgSrc(src: string | undefined): boolean {
    if (!src) return false;
    const trimmed = src.trim();
    if (trimmed.startsWith('/') || trimmed.startsWith('data:image/')) return true;
    try {
        const parsed = new URL(trimmed, window.location.origin);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
}

function isExternalHref(href: string): boolean {
    try {
        const parsed = new URL(href, window.location.origin);
        return parsed.origin !== window.location.origin;
    } catch {
        return false;
    }
}

export const BLOG_MARKDOWN_COMPONENTS: Components = {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    a: ({ node, href, children, ...props }) => {
        if (!isSafeHref(href)) {
            return <span {...props}>{children}</span>;
        }
        const external = isExternalHref(href!);
        return (
            <a
                {...props}
                href={href}
                {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            >
                {children}
            </a>
        );
    },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    img: ({ node, ...props }) => {
        if (!isSafeImgSrc(props.src)) {
            return null;
        }
        const altText = props.alt || '';
        const widthMatch = altText.match(/\{width=(\d+)\}/);
        const heightMatch = altText.match(/\{height=(\d+)\}/);
        const classNameMatch = altText.match(/\{class=(\w+)\}/);

        let style: React.CSSProperties = { maxWidth: '100%', height: 'auto' };
        let className = '';
        let cleanAlt = altText;
        const intrinsic: { width?: number; height?: number } = {};

        if (widthMatch) {
            intrinsic.width = parseInt(widthMatch[1], 10);
            style = { width: `${widthMatch[1]}px`, height: 'auto', maxWidth: '100%' };
            cleanAlt = cleanAlt.replace(/\{width=\d+\}/, '').trim();
        }
        if (heightMatch) {
            intrinsic.height = parseInt(heightMatch[1], 10);
            cleanAlt = cleanAlt.replace(/\{height=\d+\}/, '').trim();
        }
        if (classNameMatch) {
            className = classNameMatch[1];
            cleanAlt = cleanAlt.replace(/\{class=\w+\}/, '').trim();
        }

        return <img {...props} {...intrinsic} loading="lazy" decoding="async" alt={cleanAlt} style={style} className={className} />;
    },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    table: ({ node, children, ...props }) => (
        <div className="blog-table-wrapper" tabIndex={0} role="region" aria-label="table">
            <table className="blog-table" {...props}>
                {children}
            </table>
        </div>
    ),
};
