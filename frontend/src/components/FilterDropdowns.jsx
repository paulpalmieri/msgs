import { useState } from 'react';

/**
 * Year filter dropdown panel
 * Self-contained with local state for instant toggling
 */
export function YearDropdownPanel({ allYears, initialSelection, onApply, onCancel }) {
    const [selected, setSelected] = useState(() => new Set(initialSelection));
    
    const toggle = (year) => {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(year)) {
                next.delete(year);
            } else {
                next.add(year);
            }
            return next;
        });
    };
    
    const selectAll = () => setSelected(new Set(allYears));
    const selectNone = () => setSelected(new Set());
    const isAllSelected = selected.size === allYears.length;
    const isNoneSelected = selected.size === 0;
    const hasChanges = selected.size !== initialSelection.length || 
        [...selected].some(y => !initialSelection.includes(y));
    const canApply = hasChanges && selected.size > 0;
    
    return (
        <div 
            className="absolute top-full left-0 mt-2 bg-white min-w-[200px] max-w-[calc(100vw-1rem)] z-50 shadow-[0_8px_40px_rgba(0,0,0,0.12)]"
            onClick={(e) => e.stopPropagation()}
        >
            <div className="px-4 py-3 flex items-center justify-between border-b border-neutral-100">
                <span className="font-mono text-[12px] uppercase tracking-widest text-neutral-400">
                    {selected.size}/{allYears.length}
                </span>
                <div className="flex gap-3">
                    <button
                        onClick={selectNone}
                        className={`font-mono text-[12px] uppercase tracking-widest ${isNoneSelected ? 'text-neutral-300' : 'text-neutral-900 hover:text-accent'}`}
                    >
                        None
                    </button>
                    <button
                        onClick={selectAll}
                        className={`font-mono text-[12px] uppercase tracking-widest ${isAllSelected ? 'text-neutral-300' : 'text-neutral-900 hover:text-accent'}`}
                    >
                        All
                    </button>
                </div>
            </div>
            <div className="px-4 py-3 flex flex-wrap gap-1.5">
                {allYears.map(year => (
                    <button
                        key={year}
                        onClick={() => toggle(year)}
                        className={`px-2.5 py-1 font-mono text-[12px] font-medium ${
                            selected.has(year)
                                ? 'bg-neutral-900 text-white'
                                : 'text-neutral-400 hover:bg-neutral-100'
                        }`}
                    >
                        {year}
                    </button>
                ))}
            </div>
            <div className="px-4 py-3 flex gap-2 border-t border-neutral-100">
                <button
                    onClick={onCancel}
                    className="flex-1 font-mono text-[12px] uppercase tracking-widest py-1.5 text-neutral-400 hover:text-neutral-900"
                >
                    Cancel
                </button>
                <button
                    onClick={() => canApply && onApply([...selected])}
                    className={`flex-1 font-mono text-[12px] uppercase tracking-widest py-1.5 ${
                        canApply 
                            ? 'bg-accent text-white font-medium' 
                            : 'bg-neutral-100 text-neutral-300 cursor-not-allowed'
                    }`}
                >
                    Apply
                </button>
            </div>
        </div>
    );
}

/**
 * User filter dropdown panel
 * Self-contained with local state for instant toggling
 */
export function UserDropdownPanel({ allUsers, initialSelection, userDisplayNames, onApply, onCancel }) {
    const [selected, setSelected] = useState(() => new Set(initialSelection));
    
    const toggle = (user) => {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(user)) {
                next.delete(user);
            } else {
                next.add(user);
            }
            return next;
        });
    };
    
    const selectAll = () => setSelected(new Set(allUsers));
    const selectNone = () => setSelected(new Set());
    const isAllSelected = selected.size === allUsers.length;
    const isNoneSelected = selected.size === 0;
    const hasChanges = selected.size !== initialSelection.length || 
        [...selected].some(u => !initialSelection.includes(u));
    const canApply = hasChanges && selected.size > 0;
    
    return (
        <div 
            className="fixed md:absolute top-auto md:top-full left-4 right-4 md:left-0 md:right-auto bottom-4 md:bottom-auto mt-0 md:mt-2 bg-white w-auto md:w-[360px] z-50 shadow-[0_8px_40px_rgba(0,0,0,0.2)] md:shadow-[0_8px_40px_rgba(0,0,0,0.12)]"
            onClick={(e) => e.stopPropagation()}
        >
            <div className="px-4 py-3 flex items-center justify-between border-b border-neutral-100">
                <span className="font-mono text-[12px] uppercase tracking-widest text-neutral-400">
                    {selected.size}/{allUsers.length}
                </span>
                <div className="flex gap-3">
                    <button
                        onClick={selectNone}
                        className={`font-mono text-[12px] uppercase tracking-widest ${isNoneSelected ? 'text-neutral-300' : 'text-neutral-900 hover:text-accent'}`}
                    >
                        None
                    </button>
                    <button
                        onClick={selectAll}
                        className={`font-mono text-[12px] uppercase tracking-widest ${isAllSelected ? 'text-neutral-300' : 'text-neutral-900 hover:text-accent'}`}
                    >
                        All
                    </button>
                </div>
            </div>
            <div className="px-4 py-3 max-h-[50vh] md:max-h-[40vh] overflow-y-auto">
                <div className="flex flex-wrap gap-1.5">
                    {allUsers.map(user => (
                        <button
                            key={user}
                            onClick={() => toggle(user)}
                            className={`px-2 py-1 font-mono text-[12px] ${
                                selected.has(user)
                                    ? 'bg-neutral-900 text-white font-medium'
                                    : 'text-neutral-400 hover:bg-neutral-100'
                            }`}
                        >
                            {userDisplayNames[user] || user}
                        </button>
                    ))}
                </div>
            </div>
            <div className="px-4 py-3 flex gap-2 border-t border-neutral-100">
                <button
                    onClick={onCancel}
                    className="flex-1 font-mono text-[12px] uppercase tracking-widest py-2 text-neutral-400 hover:text-neutral-900"
                >
                    Cancel
                </button>
                <button
                    onClick={() => canApply && onApply([...selected])}
                    className={`flex-1 font-mono text-[12px] uppercase tracking-widest py-2 ${
                        canApply 
                            ? 'bg-accent text-white font-medium' 
                            : 'bg-neutral-100 text-neutral-300 cursor-not-allowed'
                    }`}
                >
                    Apply
                </button>
            </div>
        </div>
    );
}


