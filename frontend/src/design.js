/**
 * Design System Configuration
 * ===========================
 * SINGLE SOURCE OF TRUTH for all design tokens and configuration.
 * 
 * This is a PURE JS file (no React) so it can be imported by:
 * - tailwind.config.js (for Tailwind theme)
 * - Any component that needs design values
 * 
 * For UI components, import from './components/ui'
 * 
 * USAGE:
 * import { COLORS, STYLES, CHART } from '../design';
 */

// =============================================================================
// COLOR TOKENS
// =============================================================================

export const COLORS = {
    // Primary accent - Signal Orange (Rust)
    accent: '#D95218',
    accentDim: '#B44212',
    accentGlow: 'rgba(217, 82, 24, 0.04)',
    
    // Backgrounds
    bg: {
        primary: '#FAFAFA',
        secondary: '#FAFAFA',
        card: 'transparent',
        elevated: '#FFFFFF',
        inverted: '#0A0A0A',
        hover: 'rgba(0, 0, 0, 0.03)',
    },
    
    // Text
    text: {
        primary: '#0A0A0A',
        secondary: '#525252',
        muted: '#A3A3A3',
    },
    
    // Borders
    border: {
        default: 'transparent',
        subtle: 'transparent',
        strong: '#0A0A0A',
        whisper: 'rgba(0, 0, 0, 0.06)',
    },
    
    // Chart-specific colors
    chart: {
        primary: '#D95218',
        secondary: '#0A0A0A',
        tertiary: '#525252',
        quaternary: '#A3A3A3',
        grid: 'transparent',
        axis: 'rgba(0, 0, 0, 0.08)',
    },
    
    // Semantic colors
    positive: '#22C55E',
    negative: '#EF4444',
    
    // User palette for charts (10 distinct colors)
    userPalette: [
        '#D95218', '#2D3436', '#636E72', '#0984e3', '#00b894',
        '#fdcb6e', '#e17055', '#6c5ce7', '#00cec9', '#b2bec3',
    ],
    
    // Neutral scale (for Tailwind compatibility)
    neutral: {
        50: '#FAFAFA',
        100: '#F5F5F5',
        200: '#E5E5E5',
        300: '#D4D4D4',
        400: '#A3A3A3',
        500: '#737373',
        600: '#525252',
        700: '#404040',
        800: '#262626',
        900: '#171717',
    },
};

// =============================================================================
// FONT TOKENS
// =============================================================================

export const FONTS = {
    display: '"Space Grotesk", system-ui, sans-serif',
    mono: '"JetBrains Mono", monospace',
    headline: '"Bebas Neue", Impact, sans-serif',
};

// =============================================================================
// PRE-COMPOSED TAILWIND CLASS STRINGS
// =============================================================================

/**
 * Use these for consistent styling:
 * <h3 className={STYLES.sectionTitle}>Title</h3>
 */
export const STYLES = {
    // Section Headers
    sectionTitle: 'font-display text-xl lg:text-2xl font-semibold tracking-tight text-neutral-900',
    sectionSubtitle: 'font-mono text-[12px] text-neutral-500',
    sectionNumber: 'font-mono text-[12px] uppercase tracking-[0.2em] text-neutral-400 opacity-60',
    
    // Data Labels (micro metadata)
    dataLabel: 'font-mono text-[12px] uppercase tracking-[0.1em] text-neutral-400',
    dataLabelStrong: 'font-mono text-[12px] uppercase tracking-[0.1em] text-neutral-400 font-medium',
    
    // Data Values
    dataValue: 'font-display text-2xl font-semibold text-neutral-900 tabular-nums',
    dataValueLarge: 'font-display text-3xl lg:text-4xl font-semibold text-neutral-900 tabular-nums',
    dataValueSmall: 'font-mono text-sm font-medium text-neutral-900 tabular-nums',
    
    // Mode Toggle Buttons (tabs)
    modeButton: 'px-2.5 py-1.5 font-mono text-[12px] uppercase tracking-wider transition-colors',
    modeButtonActive: 'bg-neutral-900 text-white',
    modeButtonInactive: 'text-neutral-400 hover:bg-neutral-900 hover:text-white',
    
    // Peak/Insight Display
    peakLabel: 'text-lg lg:text-xl font-semibold tracking-tight text-neutral-900',
    peakValue: 'text-accent',
    peakContext: 'text-neutral-400 text-sm ml-2 font-normal',
    
    // Table Headers
    tableHeader: 'py-4 px-3 font-mono text-[12px] uppercase tracking-[0.1em] text-neutral-400',
    tableHeaderSortable: 'py-4 px-3 font-mono text-[12px] uppercase tracking-[0.1em] text-neutral-400 cursor-pointer hover:text-black',
    
    // Table Cells
    tableCell: 'py-3 px-3 font-mono text-[14px] tabular-nums font-medium text-black',
    tableCellMuted: 'py-3 px-3 font-mono text-[12px] tabular-nums text-neutral-500',
    
    // Rank Numbers
    rank: 'font-mono text-[12px] tabular-nums text-neutral-400',
    rankAccent: 'font-mono text-[12px] font-bold text-accent',
    
    // User Names in Lists
    userName: 'font-mono text-[14px] font-bold uppercase tracking-wide text-black',
    userNameSmall: 'font-mono text-[12px] text-neutral-900 font-medium',
    
    // Empty States
    emptyState: 'font-mono text-[12px] uppercase tracking-[0.08em] text-neutral-400',
    
    // Tooltip Container
    tooltip: 'p-3 bg-white shadow-[0_8px_32px_rgba(0,0,0,0.12)]',
};

// =============================================================================
// CHART CONFIGURATION (for Recharts)
// =============================================================================

export const CHART = {
    tooltip: {
        backgroundColor: COLORS.bg.elevated,
        border: 'none',
        fontFamily: FONTS.mono,
        fontSize: '12px',
        color: COLORS.text.primary,
        padding: '12px 16px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
    },
    
    axis: {
        stroke: COLORS.chart.axis,
        tick: {
            fontSize: 12,
            fill: COLORS.text.muted,
            fontFamily: FONTS.mono,
        },
        tickLine: false,
    },
    
    grid: {
        stroke: 'transparent',
    },
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get the standard tooltip contentStyle for Recharts
 */
export function getChartTooltipStyle() {
    return CHART.tooltip;
}

/**
 * Format a person's name for display
 * "FirstName LastName" -> "FirstName L."
 * "FirstName" -> "FirstName"
 * @param {string} fullName - The full name to format
 * @param {boolean} initialOnly - If true, only show first letter of first name
 * @returns {string} Formatted name
 */
export function formatName(fullName, initialOnly = false) {
    if (!fullName) return '';
    const parts = fullName.trim().split(' ');
    if (initialOnly) {
        return parts[0][0] + (parts.length > 1 ? parts[1][0] : '');
    }
    if (parts.length === 1) return parts[0];
    const firstName = parts[0];
    const lastInitial = parts[1][0];
    return `${firstName} ${lastInitial}.`;
}
