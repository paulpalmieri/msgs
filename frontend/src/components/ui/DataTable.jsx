import React, { useState, useMemo, useCallback } from 'react';

/**
 * useSortable - Hook for managing table sort state
 * 
 * @param {string} defaultColumn - Initial sort column
 * @param {string} defaultDirection - Initial sort direction ('asc' | 'desc')
 * @returns {object} { sortColumn, sortDirection, handleSort, sortData }
 * 
 * @example
 * const { sortColumn, sortDirection, handleSort, sortData } = useSortable('name', 'desc');
 * const sorted = sortData(data, (a, b, col, dir) => { ... });
 */
export function useSortable(defaultColumn = '', defaultDirection = 'desc') {
    const [sortColumn, setSortColumn] = useState(defaultColumn);
    const [sortDirection, setSortDirection] = useState(defaultDirection);
    
    const handleSort = useCallback((column) => {
        if (sortColumn === column) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection('desc');
        }
    }, [sortColumn]);
    
    // Generic sort function - pass comparator for custom sorting
    const sortData = useCallback((data, comparator) => {
        if (!sortColumn) return data;
        return [...data].sort((a, b) => comparator(a, b, sortColumn, sortDirection));
    }, [sortColumn, sortDirection]);
    
    return { sortColumn, sortDirection, handleSort, sortData };
}

/**
 * SortIndicator - Shows current sort state for a column
 */
export function SortIndicator({ column, sortColumn, sortDirection }) {
    if (sortColumn !== column) {
        return <span className="ml-1 opacity-30 group-hover:opacity-60 transition-opacity">↕</span>;
    }
    return <span className="ml-1 text-accent">{sortDirection === 'asc' ? '↑' : '↓'}</span>;
}

/**
 * SortableHeader - Clickable table header with sort indicator
 * 
 * @param {string} column - Column key for sorting
 * @param {string} sortColumn - Currently sorted column
 * @param {string} sortDirection - Current sort direction
 * @param {function} onSort - Sort handler function
 * @param {string} align - Text alignment ('left' | 'right' | 'center')
 * @param {string} className - Additional CSS classes
 * @param {ReactNode} children - Header label content
 */
export function SortableHeader({ 
    column, 
    sortColumn, 
    sortDirection, 
    onSort, 
    align = 'right', 
    className = '',
    children 
}) {
    const alignClass = {
        left: 'text-left',
        right: 'text-right',
        center: 'text-center'
    }[align] || 'text-right';
    
    return (
        <th 
            className={`py-4 px-3 font-mono text-[12px] uppercase tracking-[0.15em] text-neutral-400 cursor-pointer hover:text-black group ${alignClass} ${className}`}
            onClick={() => onSort(column)}
        >
            <span className="inline-flex items-center gap-1">
                {children}
                <SortIndicator 
                    column={column} 
                    sortColumn={sortColumn} 
                    sortDirection={sortDirection} 
                />
            </span>
        </th>
    );
}

/**
 * TableHeader - Non-sortable table header with consistent styling
 */
export function TableHeader({ align = 'right', className = '', children }) {
    const alignClass = {
        left: 'text-left',
        right: 'text-right',
        center: 'text-center'
    }[align] || 'text-right';
    
    return (
        <th className={`py-4 px-3 font-mono text-[12px] uppercase tracking-[0.15em] text-neutral-400 ${alignClass} ${className}`}>
            {children}
        </th>
    );
}

/**
 * TableCell - Consistent table cell styling
 * 
 * @param {string} variant - Style variant ('default' | 'muted' | 'accent' | 'rank')
 * @param {string} align - Text alignment
 * @param {boolean} isLeader - Highlight as leader value
 * @param {boolean} isHovered - Row hover state
 */
export function TableCell({ 
    variant = 'default', 
    align = 'right', 
    isLeader = false, 
    isHovered = false,
    className = '',
    children 
}) {
    const alignClass = {
        left: 'text-left',
        right: 'text-right',
        center: 'text-center'
    }[align] || 'text-right';
    
    const variantClasses = {
        default: `font-mono text-[13px] tabular-nums font-medium ${
            isLeader ? 'text-accent font-bold' : isHovered ? 'text-accent' : 'text-black'
        }`,
        muted: `font-mono text-[12px] tabular-nums ${
            isHovered ? 'text-accent/70' : 'text-neutral-500'
        }`,
        rank: `font-mono text-[12px] tabular-nums ${
            isHovered ? 'text-accent' : 'text-neutral-400'
        }`,
        accent: `font-mono text-[13px] tabular-nums font-medium text-accent`,
    };
    
    return (
        <td className={`py-3 px-3 ${alignClass} ${className}`}>
            <span className={variantClasses[variant] || variantClasses.default}>
                {children}
            </span>
        </td>
    );
}

/**
 * TableRow - Consistent table row with hover behavior
 * 
 * @param {boolean} isHovered - Current hover state
 * @param {function} onHover - Hover callback (receives true/false)
 * @param {function} onClick - Click handler
 * @param {string} className - Additional classes
 */
export function TableRow({ 
    isHovered = false, 
    onHover, 
    onClick, 
    className = '', 
    children 
}) {
    return (
        <tr 
            className={`cursor-pointer touch-manipulation ${className}`}
            onPointerEnter={(e) => e.pointerType === 'mouse' && onHover?.(true)}
            onPointerLeave={(e) => e.pointerType === 'mouse' && onHover?.(false)}
            onClick={onClick}
        >
            {children}
        </tr>
    );
}

/**
 * TableFooter - Consistent table footer row
 */
export function TableFooter({ className = '', children }) {
    return (
        <tr className={`mt-6 ${className}`}>
            {children}
        </tr>
    );
}

/**
 * TableFooterCell - Consistent footer cell styling
 * 
 * @param {string} align - Text alignment
 * @param {boolean} isLabel - Whether this is a label cell (like "Total")
 * @param {boolean} isEmpty - Show dash for empty aggregate cells
 */
export function TableFooterCell({ 
    align = 'right', 
    isLabel = false, 
    isEmpty = false,
    className = '', 
    children 
}) {
    const alignClass = {
        left: 'text-left',
        right: 'text-right',
        center: 'text-center'
    }[align] || 'text-right';
    
    if (isEmpty) {
        return (
            <td className={`py-4 px-3 ${alignClass} font-mono text-[12px] text-neutral-400 ${className}`}>
                —
            </td>
        );
    }
    
    if (isLabel) {
        return (
            <td className={`py-4 px-3 ${alignClass} ${className}`}>
                <span className="font-mono text-sm font-bold uppercase text-black">
                    {children}
                </span>
            </td>
        );
    }
    
    return (
        <td className={`py-4 px-3 ${alignClass} ${className}`}>
            <span className="font-mono text-sm font-bold text-black tabular-nums">
                {children}
            </span>
        </td>
    );
}

/**
 * formatValue - Format cell values with consistent handling of empty/zero
 */
export function formatValue(value, options = {}) {
    const { 
        suffix = '', 
        emptyDisplay = '—', 
        showZero = false,
        locale = true 
    } = options;
    
    if (value === null || value === undefined || (!showZero && value === 0)) {
        return emptyDisplay;
    }
    
    const formatted = locale && typeof value === 'number' 
        ? value.toLocaleString() 
        : value;
    
    return suffix ? `${formatted}${suffix}` : formatted;
}

