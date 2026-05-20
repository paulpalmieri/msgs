import React from 'react';
import { AreaChart, Area, BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const ACCENT = '#FF5F1A';

/**
 * Mini Chart Component
 * ====================
 * Small chart for wrapped stories (area or bar).
 * 
 * @param {Object} props
 * @param {Array} props.data - Chart data array
 * @param {string} props.dataKey - Key for y-axis value
 * @param {string} props.xAxisKey - Key for x-axis value
 * @param {string} props.type - Chart type ('area' | 'bar')
 * @param {boolean} props.highlightMax - Highlight max value in bar chart
 * @param {number} props.delay - Animation delay
 */
export default function MiniChart({ data, dataKey, xAxisKey, type = 'area', highlightMax = true, delay = 0 }) {
    const maxValue = Math.max(...data.map(d => d[dataKey]));
    
    return (
        <div className={`wrapped-mini-chart wrapped-animate-up wrapped-delay-${delay + 1}`}>
            <ResponsiveContainer width="100%" height="100%">
                {type === 'area' ? (
                    <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <XAxis 
                            dataKey={xAxisKey} 
                            axisLine={false} 
                            tickLine={false}
                            tick={{ fontSize: 12, fill: '#5A5A5A', fontFamily: 'JetBrains Mono' }}
                            interval="preserveStartEnd"
                        />
                        <Tooltip 
                            contentStyle={{ 
                                background: '#1A1A1A', 
                                border: '1px solid #2A2A2A',
                                fontFamily: 'JetBrains Mono',
                                fontSize: '12px'
                            }}
                            labelStyle={{ color: '#A0A0A0' }}
                            itemStyle={{ color: '#FAFAFA' }}
                        />
                        <Area 
                            type="monotone" 
                            dataKey={dataKey} 
                            stroke={ACCENT} 
                            fill={`${ACCENT}20`}
                            strokeWidth={2}
                        />
                    </AreaChart>
                ) : (
                    <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <XAxis 
                            dataKey={xAxisKey} 
                            axisLine={false} 
                            tickLine={false}
                            tick={{ fontSize: 12, fill: '#5A5A5A', fontFamily: 'JetBrains Mono' }}
                        />
                        <Tooltip 
                            contentStyle={{ 
                                background: '#1A1A1A', 
                                border: '1px solid #2A2A2A',
                                fontFamily: 'JetBrains Mono',
                                fontSize: '12px'
                            }}
                        />
                        <Bar dataKey={dataKey}>
                            {data.map((entry, index) => (
                                <Cell 
                                    key={`cell-${index}`} 
                                    fill={highlightMax && entry[dataKey] === maxValue ? ACCENT : '#2A2A2A'} 
                                />
                            ))}
                        </Bar>
                    </BarChart>
                )}
            </ResponsiveContainer>
        </div>
    );
}


