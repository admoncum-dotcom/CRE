'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FiArrowLeft, FiTrendingUp, FiUsers, FiUserCheck } from 'react-icons/fi';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

import WeeklyStatsChart from './WeeklyStatsChart';
import ReferralSourceChart from './ReferralSourceChart';
import GenderDistributionChart from './GenderDistributionChart'; // 1. Importar el gráfico de género
import CityDistributionChart from './CityDistributionChart'; // Importar el nuevo gráfico de ciudades

interface ReportsViewProps {
  onBack: () => void;
}

const StatCard = ({ title, value, icon, isLoading }: { title: string; value: string; icon: React.ReactNode; isLoading: boolean; }) => (
  <motion.div 
    className="bg-white p-6 rounded-2xl shadow-lg flex items-center justify-between" 
    initial={{ opacity: 0, y: 20 }} 
    animate={{ opacity: 1, y: 0 }}
  >
    {isLoading ? (
      <div className="w-full h-20 animate-pulse flex items-center justify-between">
        <div className="w-2/3 space-y-3">
          <div className="h-5 bg-slate-200 rounded w-3/4"></div>
          <div className="h-8 bg-slate-300 rounded w-1/2"></div>
        </div>
        <div className="h-14 w-14 bg-slate-200 rounded-full"></div>
      </div>
    ) : (
      <>
        <div>
          <h4 className="text-lg font-semibold text-slate-500">{title}</h4>
          <p className="text-4xl font-bold text-slate-800 mt-1">{value}</p>
        </div>
        <div className="text-4xl text-sky-500">
          {icon}
        </div>
      </>
    )}
  </motion.div>
);

const ReportsView: React.FC<ReportsViewProps> = ({ onBack }) => {
  const [stats, setStats] = useState({ totalUsers: 0, totalPatients: 0 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      setIsLoading(true);
      try {
        const usersPromise = getDocs(collection(db, 'users'));
        const patientsPromise = getDocs(collection(db, 'patients'));
        const [usersSnapshot, patientsSnapshot] = await Promise.all([usersPromise, patientsPromise]);
        setStats({
          totalUsers: usersSnapshot.size,
          totalPatients: patientsSnapshot.size,
        });
      } catch (error) {
        console.error("Error fetching stats:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchStats();
  }, []);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex items-center space-x-4 mb-8">
        <button onClick={onBack} className="p-2 rounded-full hover:bg-slate-200 transition-colors">
          <FiArrowLeft size={24} />
        </button>
        <h2 className="text-3xl font-bold text-slate-900 flex items-center">
          <FiTrendingUp className="mr-3" />
          Estadisticas Generales
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <StatCard title="Usuarios Totales" value={stats.totalUsers.toString()} icon={<FiUsers />} isLoading={isLoading} />
        <StatCard title="Pacientes Registrados" value={stats.totalPatients.toString()} icon={<FiUserCheck />} isLoading={isLoading} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-8">
        <div className="lg:col-span-3"><WeeklyStatsChart /></div>
        <div className="lg:col-span-2"><ReferralSourceChart /></div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <GenderDistributionChart />
        <CityDistributionChart />
      </div>
    </motion.div>
  );
};

export default ReportsView;