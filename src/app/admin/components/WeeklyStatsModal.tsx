'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FiX, FiBarChart } from 'react-icons/fi';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// Helper
const toLocalDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

interface WeeklyStatsModalProps {
  onClose: () => void;
}

const SkeletonChart = () => (
    <div className="w-full h-[300px] bg-slate-200 rounded-lg animate-pulse"></div>
);

const WeeklyStatsModal: React.FC<WeeklyStatsModalProps> = ({ onClose }) => {
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const dailyCounts: { [key: string]: { name: string, pacientes: number } } = {};
    const today = new Date();
    
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(today.getDate() - i);
        const formattedDate = toLocalDateString(date);
        dailyCounts[formattedDate] = { name: dayNames[date.getDay()], pacientes: 0 };
    }
    
    const firstDay = Object.keys(dailyCounts)[0];
    const lastDay = Object.keys(dailyCounts)[Object.keys(dailyCounts).length - 1];

    const q = query(collection(db, 'appointments'), where('date', '>=', firstDay), where('date', '<=', lastDay));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const newCounts = { ...dailyCounts };
        Object.keys(newCounts).forEach(date => { newCounts[date].pacientes = 0; });
        
        snapshot.forEach(doc => {
            const appt = doc.data();
            if (newCounts[appt.date] && appt.status !== 'cancelled') {
                newCounts[appt.date].pacientes++;
            }
        });
        setWeeklyData(Object.values(newCounts));
        setIsLoading(false);
    }, (error) => {
        console.error("Error fetching weekly data: ", error);
        setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      <motion.div
        className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-3xl"
        initial={{ scale: 0.9, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 30 }}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-slate-900 flex items-center">
            <FiBarChart className="mr-3 text-sky-500" />
            Pacientes Atendidos en la Semana
          </h3>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-200 transition-colors"><FiX size={24} /></button>
        </div>
        
        <div className="w-full h-[300px]">
          {isLoading ? <SkeletonChart /> : (
            <ResponsiveContainer>
              <BarChart data={weeklyData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                <XAxis dataKey="name" stroke="#6b7280" />
                <YAxis stroke="#6b7280" allowDecimals={false} />
                <Tooltip contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', backdropFilter: 'blur(4px)', border: '1px solid #e0e0e0', borderRadius: '0.75rem' }} />
                <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: '20px' }} />
                <Bar dataKey="pacientes" fill="#0ea5e9" name="Pacientes Atendidos" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default WeeklyStatsModal;