import { CSSProperties, ReactNode } from 'react';

type SkeletonElement = 'span' | 'div';

export interface SkeletonProps {
    h?: string;
    w?: string;
    inline?: boolean;
    block?: boolean;
    className?: string;
    style?: CSSProperties;
    as?: SkeletonElement;
}

export function Skeleton({ h, w, inline, block, className, style, as }: SkeletonProps) {
    const Tag: SkeletonElement = as ?? (inline ? 'span' : 'div');
    const display = inline ? 'inline-block' : block ? 'block' : undefined;
    const merged: CSSProperties = {
        ...(display ? { display } : {}),
        ...(h ? { height: h } : {}),
        ...(w ? { width: w } : {}),
        ...style,
    };
    return <Tag className={`skeleton${className ? ` ${className}` : ''}`} style={merged} />;
}

export interface TableSkeletonProps {
    rows: number;
    columns: { w: string }[];
    headers?: ReactNode;
}

export function TableSkeleton({ rows, columns, headers }: TableSkeletonProps) {
    return (
        <>
            {headers}
            <tbody>
                {Array.from({ length: rows }).map((_, i) => (
                    <tr key={i}>
                        {columns.map((col, j) => (
                            <td key={j}>
                                <Skeleton inline h="1em" w={col.w} />
                            </td>
                        ))}
                    </tr>
                ))}
            </tbody>
        </>
    );
}
