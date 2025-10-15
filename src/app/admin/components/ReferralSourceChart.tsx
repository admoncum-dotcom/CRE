'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { FiShare2 } from 'react-icons/fi';

const SkeletonChart = () => (
    <div className="bg-white p-6 rounded-2xl shadow-lg animate-pulse h-96 flex items-center justify-center">
        <div className="w-full h-full bg-slate-200 rounded-lg"></div>
    </div>
);

const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#6366f1', '#84cc16'];
const RADIAN = Math.PI / 180;

const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" className="font-bold">
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

const ReferralSourceChart: React.FC = () => {
    const [chartData, setChartData] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        setIsLoading(true);
        const q = collection(db, 'patients');
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const sources: { [key: string]: number } = {};
            snapshot.forEach(doc => {
                const source = doc.data().referralSource || 'No especificado';
                sources[source] = (sources[source] || 0) + 1;
            });

            const formattedData = Object.keys(sources).map(key => ({
                name: key,
                value: sources[key],
            }));

            setChartData(formattedData);
            setIsLoading(false);
        }, (error) => {
            console.error("Error fetching patient data for chart:", error);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, []);

    if (isLoading) {
        return <SkeletonChart />;
    }

    return (
        <motion.div
            className="bg-white p-6 rounded-2xl shadow-lg"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
        >
            <h3 className="text-2xl font-bold text-slate-900 flex items-center mb-4">
                <FiShare2 className="mr-3 text-sky-500" />
                Origen de los Pacientes
            </h3>
            <div className="w-full h-[300px]">
                <ResponsiveContainer>
                    <PieChart>
                        <Pie data={chartData} cx="50%" cy="50%" labelLine={false} label={renderCustomizedLabel} outerRadius={110} fill="#8884d8" dataKey="value" nameKey="name">
                            {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip formatter={(value: number, name: string) => [`${value} paciente(s)`, name]} />
                        <Legend iconType="circle" />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </motion.div>
    );
};

export default ReferralSourceChart;