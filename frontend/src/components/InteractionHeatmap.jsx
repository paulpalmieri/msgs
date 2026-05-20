import React, { useMemo, useState, useRef, useCallback } from 'react';
import ChartCard from './ChartCard';
import { formatName } from '../utils/formatters';
import { COLORS } from '../design';

// Custom Heatmap Grid with Crosshair
const HeatmapGrid = ({ data, showShare }) => {
    const containerRef = useRef(null);
    const [hoveredCell, setHoveredCell] = useState(null);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const [isHovering, setIsHovering] = useState(false);

    const { x, y, rawValues, shareValues, fullNames } = data;
    const cellSize = 48;
    const labelWidth = 100;
    const labelHeight = 80;
    const padding = 20;
    
    const gridWidth = x.length * cellSize;
    const gridHeight = y.length * cellSize;
    const totalWidth = gridWidth + labelWidth + padding;
    const totalHeight = gridHeight + labelHeight + padding;

    const displayValues = showShare ? shareValues : rawValues;
    
    // Find max value for color scaling
    const maxVal = useMemo(() => {
        return Math.max(...displayValues.flat().filter(v => v > 0), 1);
    }, [displayValues]);

    // Color interpolation - uses accent-based heat scale
    // Colors are tints of the accent color for visual consistency
    const HEAT_SCALE = {
        empty: COLORS.bg.primary,       // #FAFAFA
        veryLight: '#FEE8E3',           // Tint of accent
        light: '#FCBCAC',               // Lighter tint
        medium: '#F47853',              // Medium tint
        strong: COLORS.accent,          // Full accent
    };
    
    const getColor = useCallback((value) => {
        if (value === 0) return HEAT_SCALE.empty;
        const ratio = value / maxVal;
        
        if (ratio < 0.25) return HEAT_SCALE.veryLight;
        if (ratio < 0.5) return HEAT_SCALE.light;
        if (ratio < 0.75) return HEAT_SCALE.medium;
        return HEAT_SCALE.strong;
    }, [maxVal]);

    const handleMouseMove = useCallback((e) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left - labelWidth;
        const y = e.clientY - rect.top - padding;
        
        setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        
        if (x >= 0 && x < gridWidth && y >= 0 && y < gridHeight) {
            const colIndex = Math.floor(x / cellSize);
            const rowIndex = Math.floor(y / cellSize);
            setHoveredCell({ row: rowIndex, col: colIndex });
            setIsHovering(true);
        } else {
            setHoveredCell(null);
            setIsHovering(false);
        }
    }, [gridWidth, gridHeight, cellSize, labelWidth]);

    const handleMouseLeave = useCallback(() => {
        setHoveredCell(null);
        setIsHovering(false);
    }, []);

    return (
        <div className="relative w-full overflow-x-auto">
            <svg
                ref={containerRef}
                width={totalWidth}
                height={totalHeight}
                className="mx-auto"
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                style={{ cursor: 'crosshair' }}
            >
                {/* Y-axis labels (Reactors) */}
                {y.map((name, i) => (
                    <text
                        key={`y-${i}`}
                        x={labelWidth - 8}
                        y={padding + i * cellSize + cellSize / 2}
                        textAnchor="end"
                        dominantBaseline="middle"
                        className="font-mono text-[12px] uppercase tracking-wider"
                        fill={hoveredCell?.row === i ? COLORS.text.primary : COLORS.text.muted}
                        fontWeight={hoveredCell?.row === i ? 600 : 400}
                    >
                        {name}
                    </text>
                ))}

                {/* X-axis labels (Receivers) */}
                {x.map((name, i) => (
                    <text
                        key={`x-${i}`}
                        x={labelWidth + i * cellSize + cellSize / 2}
                        y={padding + gridHeight + 16}
                        textAnchor="start"
                        className="font-mono text-[12px] uppercase tracking-wider"
                        fill={hoveredCell?.col === i ? COLORS.text.primary : COLORS.text.muted}
                        fontWeight={hoveredCell?.col === i ? 600 : 400}
                        transform={`rotate(45, ${labelWidth + i * cellSize + cellSize / 2}, ${padding + gridHeight + 16})`}
                    >
                        {name}
                    </text>
                ))}

                {/* Axis titles */}
                <text
                    x={labelWidth / 2}
                    y={padding + gridHeight / 2}
                    textAnchor="middle"
                    className="font-mono text-[12px] uppercase tracking-widest"
                    fill={COLORS.text.muted}
                    transform={`rotate(-90, ${labelWidth / 2 - 20}, ${padding + gridHeight / 2})`}
                >
                    REACTOR
                </text>
                <text
                    x={labelWidth + gridWidth / 2}
                    y={totalHeight - 8}
                    textAnchor="middle"
                    className="font-mono text-[12px] uppercase tracking-widest"
                    fill={COLORS.text.muted}
                >
                    RECEIVER
                </text>

                {/* Grid cells - No stroke borders */}
                {displayValues.map((row, rowIndex) =>
                    row.map((value, colIndex) => (
                        <rect
                            key={`${rowIndex}-${colIndex}`}
                            x={labelWidth + colIndex * cellSize}
                            y={padding + rowIndex * cellSize}
                            width={cellSize - 1}
                            height={cellSize - 1}
                            fill={getColor(value)}
                        />
                    ))
                )}

                {/* Cell values */}
                {displayValues.map((row, rowIndex) =>
                    row.map((value, colIndex) => (
                        value > 0 && (
                            <text
                                key={`text-${rowIndex}-${colIndex}`}
                                x={labelWidth + colIndex * cellSize + cellSize / 2}
                                y={padding + rowIndex * cellSize + cellSize / 2}
                                textAnchor="middle"
                                dominantBaseline="middle"
                                className="font-mono text-[12px]"
                                fill={COLORS.text.primary}
                            >
                                {showShare ? `${value}%` : value}
                            </text>
                        )
                    ))
                )}

                {/* Crosshair overlay - inverted colors */}
                {isHovering && hoveredCell && (
                    <>
                        {/* Horizontal crosshair bar (full row highlight) */}
                        <rect
                            x={labelWidth}
                            y={padding + hoveredCell.row * cellSize}
                            width={gridWidth}
                            height={cellSize - 1}
                            fill="rgba(10, 10, 10, 0.08)"
                            pointerEvents="none"
                        />
                        {/* Vertical crosshair bar (full column highlight) */}
                        <rect
                            x={labelWidth + hoveredCell.col * cellSize}
                            y={padding}
                            width={cellSize - 1}
                            height={gridHeight}
                            fill="rgba(10, 10, 10, 0.08)"
                            pointerEvents="none"
                        />
                        {/* Intersection highlight - inverted */}
                        <rect
                            x={labelWidth + hoveredCell.col * cellSize}
                            y={padding + hoveredCell.row * cellSize}
                            width={cellSize - 1}
                            height={cellSize - 1}
                            fill="#0A0A0A"
                            pointerEvents="none"
                        />
                        {/* Inverted text at intersection */}
                        {displayValues[hoveredCell.row][hoveredCell.col] > 0 && (
                            <text
                                x={labelWidth + hoveredCell.col * cellSize + cellSize / 2}
                                y={padding + hoveredCell.row * cellSize + cellSize / 2}
                                textAnchor="middle"
                                dominantBaseline="middle"
                                className="font-mono text-[12px] font-semibold"
                                fill={COLORS.bg.primary}
                                pointerEvents="none"
                            >
                                {showShare 
                                    ? `${displayValues[hoveredCell.row][hoveredCell.col]}%` 
                                    : displayValues[hoveredCell.row][hoveredCell.col]}
                            </text>
                        )}
                    </>
                )}
            </svg>

            {/* Hover tooltip - No border, shadow separation */}
            {isHovering && hoveredCell && fullNames[hoveredCell.row] && fullNames[hoveredCell.col] && (
                <div
                    className="absolute pointer-events-none bg-white px-4 py-3 font-mono text-[12px] z-50 shadow-[0_8px_32px_rgba(0,0,0,0.12)]"
                    style={{
                        left: Math.min(mousePos.x + 12, totalWidth - 200),
                        top: mousePos.y + 12,
                        maxWidth: 280,
                    }}
                >
                    <span className="font-semibold text-neutral-900">
                        {fullNames[hoveredCell.row]}
                    </span>
                    <span className="text-neutral-500"> gave </span>
                    <span className="font-semibold text-neutral-900">
                        {fullNames[hoveredCell.col]}
                    </span>
                    <br />
                    <span className="text-accent font-bold">
                        {rawValues[hoveredCell.row]?.[hoveredCell.col] ?? 0}
                    </span>
                    <span className="text-neutral-500">
                        {' '}reactions ({shareValues[hoveredCell.row]?.[hoveredCell.col] ?? 0}%)
                    </span>
                </div>
            )}
        </div>
    );
};

export default function InteractionHeatmap({ networkMatrix, selectedUsers }) {
    const [showShare, setShowShare] = useState(false);

    const data = useMemo(() => {
        if (!networkMatrix) return null;

        // Create a set of selected users for filtering
        const selectedUserSet = selectedUsers ? new Set(selectedUsers) : null;

        // Filter networkMatrix to only include selected users
        const filteredNetwork = {};
        Object.keys(networkMatrix).forEach(key => {
            const [reactor, receiver] = key.split('|');
            // Only include if both reactor and receiver are in selectedUsers (or no filter applied)
            if (!selectedUserSet || (selectedUserSet.has(reactor) && selectedUserSet.has(receiver))) {
                filteredNetwork[key] = networkMatrix[key];
            }
        });

        const usersSet = new Set();
        Object.keys(filteredNetwork).forEach(key => {
            const [reactor, receiver] = key.split('|');
            usersSet.add(reactor);
            usersSet.add(receiver);
        });

        if (usersSet.size === 0) return null;

        // Sort reverse alphabetically Z-A by full name, then format for display
        const fullNames = Array.from(usersSet).sort((a, b) => b.localeCompare(a));
        const displayNames = fullNames.map(formatName);
        
        // Calculate raw values and reactor totals
        const rawValues = [];
        const reactorTotals = {};
        
        fullNames.forEach(reactor => {
            const row = [];
            let total = 0;
            fullNames.forEach(receiver => {
                const key = `${reactor}|${receiver}`;
                const val = filteredNetwork[key] || 0;
                row.push(val);
                total += val;
            });
            rawValues.push(row);
            reactorTotals[reactor] = total;
        });

        // Calculate share values (percentage of each reactor's total)
        const shareValues = rawValues.map((row, i) => {
            const reactor = fullNames[i];
            const total = reactorTotals[reactor] || 1;
            return row.map(val => total > 0 ? Math.round((val / total) * 100) : 0);
        });

        return {
            x: displayNames,
            y: displayNames,
            fullNames,
            rawValues,
            shareValues,
            reactorTotals
        };
    }, [networkMatrix, selectedUsers]);

    if (!data) return null;

    return (
        <ChartCard
            title="Interaction Heatmap"
            subtitle="Who reacts to whom? (Rows = Reactor, Columns = Receiver)"
            explanation={showShare 
                ? "Shows what percentage of each reactor's reactions go to each receiver."
                : "Visualizes reaction intensity between users. Rows = reactor, columns = receiver. Brighter = more reactions."
            }
            className="h-auto"
            headerRight={
                <button
                    onClick={() => setShowShare(!showShare)}
                    className={`px-2.5 py-1.5 font-mono text-[12px] uppercase tracking-widest transition-colors ${
                        showShare 
                            ? 'bg-neutral-900 text-white' 
                            : 'text-neutral-400 hover:bg-neutral-900 hover:text-white'
                    }`}
                >
                    {showShare ? '% Share' : 'Count'}
                </button>
            }
        >
            <div className="min-h-[600px] w-full py-4">
                <HeatmapGrid data={data} showShare={showShare} />
            </div>
        </ChartCard>
    );
}
