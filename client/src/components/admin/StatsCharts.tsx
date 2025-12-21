'use client';

import { Chart as ChartJS, ArcElement, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, PointElement, LineElement, Filler } from 'chart.js';
import { Pie, Bar, Line } from 'react-chartjs-2';

ChartJS.register(ArcElement, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, PointElement, LineElement, Filler);

export const TierPieChart = ({ data }: { data: any[] }) => {
    // Map tier data to chart format
    // data example: [{ tier: 'free', count: 10 }, { tier: 'standard', count: 5 }]

    // Default zero values
    let counts = { free: 0, standard: 0, pro: 0 };
    data.forEach(item => {
        if (item.tier === 'free') counts.free = item.count;
        if (item.tier === 'standard') counts.standard = item.count;
        if (item.tier === 'pro') counts.pro = item.count;
    });

    const chartData = {
        labels: ['Free', 'Standart', 'Pro'],
        datasets: [
            {
                data: [counts.free, counts.standard, counts.pro],
                backgroundColor: [
                    'rgba(148, 163, 184, 0.6)', // Slate-400 for Free (Grey)
                    'rgba(59, 130, 246, 0.6)',  // Blue-500 for Standard
                    'rgba(249, 115, 22, 0.6)',  // Orange-500 for Pro
                ],
                borderColor: [
                    'rgba(148, 163, 184, 1)',
                    'rgba(59, 130, 246, 1)',
                    'rgba(249, 115, 22, 1)',
                ],
                borderWidth: 1,
            },
        ],
    };

    return <Pie data={chartData} options={{ maintainAspectRatio: false }} />;
};

export const DurationBarChart = ({ data }: { data: any[] }) => {
    // data example: [{ duration_months: 1, count: 5 }, { duration_months: 12, count: 2 }]

    let counts = { m1: 0, m6: 0, m12: 0 };
    data.forEach(item => {
        if (item.duration_months === 1) counts.m1 = item.count;
        if (item.duration_months === 6) counts.m6 = item.count;
        if (item.duration_months === 12) counts.m12 = item.count;
    });

    const chartData = {
        labels: ['Aylık', '6 Aylık', 'Yıllık'],
        datasets: [
            {
                label: 'Abone Sayısı',
                data: [counts.m1, counts.m6, counts.m12],
                backgroundColor: 'rgba(99, 102, 241, 0.6)', // Indigo-500
                borderColor: 'rgba(99, 102, 241, 1)',
                borderWidth: 1,
            },
        ],
    };

    const options = {
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false,
            },
        },
        scales: {
            y: {
                beginAtZero: true,
                ticks: {
                    stepSize: 1
                }
            }
        }
    };

    return <Bar data={chartData} options={options} />;
};

export const DailySignupsChart = ({ data }: { data: any[] }) => {
    // data example: [{ date: '2023-10-01', count: 5 }, ...]

    const chartData = {
        labels: data.map(d => new Date(d.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })),
        datasets: [
            {
                label: 'Yeni Üye',
                data: data.map(d => d.count),
                borderColor: 'rgba(59, 130, 246, 1)', // Blue-500
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                borderWidth: 2,
                tension: 0.4,
                fill: true,
                pointBackgroundColor: '#fff',
                pointBorderColor: 'rgba(59, 130, 246, 1)',
                pointRadius: 4,
                pointHoverRadius: 6
            },
        ],
    };

    const options = {
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false,
            },
            tooltip: {
                intersect: false,
                mode: 'index' as const,
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                grid: {
                    color: 'rgba(0,0,0,0.05)',
                },
                ticks: {
                    stepSize: 1
                }
            },
            x: {
                grid: {
                    display: false
                }
            }
        },
        interaction: {
            intersect: false,
            mode: 'index' as const,
        },
    };

    return <Line data={chartData} options={options} />;
};
