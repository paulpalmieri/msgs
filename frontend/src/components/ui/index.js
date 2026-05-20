/**
 * UI Components - Shared micro-components
 * =======================================
 * 
 * All reusable UI primitives in one place.
 * Import from here for convenience:
 * 
 * import { SectionHeader, ModeToggle, Sparkline } from './components/ui';
 * 
 * For design tokens/config, import from '../design':
 * import { COLORS, STYLES, CHART } from '../design';
 */

// Typography components
export { 
    SectionHeader, 
    DataLabel, 
    DataValue, 
    KeyStat
} from './Typography';

// Control components
export { ModeToggle } from './Controls';

// Display components
export { 
    RankBadge, 
    UserColorBar 
} from './Display';

// Visualization components
export { default as Sparkline } from './Sparkline';

// Data Table utilities
export { 
    useSortable, 
    SortableHeader, 
    TableHeader,
    TableCell,
    TableRow,
    TableFooter,
    TableFooterCell,
    formatValue 
} from './DataTable';
