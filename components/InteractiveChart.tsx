import React, { useEffect, useRef, memo } from 'react';
import { InteractiveChartData } from '../types';

interface InteractiveChartProps {
    chartData: InteractiveChartData;
    theme: 'light' | 'dark';
}

const InteractiveChart: React.FC<InteractiveChartProps> = ({ chartData, theme }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const chartRef = useRef<any>(null); // To hold the chart instance

    useEffect(() => {
        if (!canvasRef.current || !chartData) return;
        
        // Destroy previous chart instance if it exists
        if (chartRef.current) {
            chartRef.current.destroy();
        }

        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) return;

        // Theme-aware color configuration
        const isDark = theme === 'dark';
        const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
        const textColor = isDark ? '#f0f0f0' : '#333333';
        const tooltipBgColor = isDark ? '#333333' : '#ffffff';
        const tooltipTextColor = isDark ? '#ffffff' : '#333333';

        // Deep merge theme options with user-provided options
        const defaultOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: textColor,
                    }
                },
                tooltip: {
                    backgroundColor: tooltipBgColor,
                    titleColor: tooltipTextColor,
                    bodyColor: tooltipTextColor,
                }
            },
            scales: {
                x: {
                    ticks: {
                        color: textColor,
                    },
                    grid: {
                        color: gridColor,
                    }
                },
                y: {
                    ticks: {
                        color: textColor,
                    },
                    grid: {
                        color: gridColor,
                    }
                }
            }
        };

        // A simple deep merge function
        const mergeOptions = (target: any, source: any) => {
            for (const key in source) {
                if (source[key] instanceof Object && key in target) {
                    Object.assign(source[key], mergeOptions(target[key], source[key]));
                }
            }
            return { ...target, ...source };
        };

        const finalOptions = mergeOptions(defaultOptions, chartData.options || {});

        // Create new chart instance
        try {
            chartRef.current = new Chart(ctx, {
                type: chartData.type,
                data: chartData.data,
                options: finalOptions,
            });
        } catch (error) {
            console.error("Chart.js rendering error:", error);
        }

        // Cleanup function
        return () => {
            if (chartRef.current) {
                chartRef.current.destroy();
                chartRef.current = null;
            }
        };

    }, [chartData, theme]);

    return (
        <div className="interactive-chart-container">
            <canvas ref={canvasRef}></canvas>
        </div>
    );
};

export default memo(InteractiveChart);