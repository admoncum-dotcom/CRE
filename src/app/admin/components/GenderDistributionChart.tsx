'use client';

import React, { useState, useEffect } from 'react';
import { onSnapshot, collection, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { motion } from 'framer-motion';

const COLORS = ['#38bdf8', '#fb7185', '#a78bfa', '#a3a3a3']; // Azul (Masculino), Rosa (Femenino), Morado (Otro), Gris (No especificado)

const GenderDistributionChart = () => {
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'patients'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const genderCounts = {
        'Masculino': 0,
        'Femenino': 0,
        'Otro': 0,
        'No especificado': 0,
      };

      snapshot.forEach(doc => {
        const patient = doc.data();
        switch (patient.gender) {
          case 'Masculino':
            genderCounts['Masculino']++;
            break;
          case 'Femenino':
            genderCounts['Femenino']++;
            break;
          case 'Otro':
            genderCounts['Otro']++;
            break;
          default:
            genderCounts['No especificado']++;
            break;
        }
      });

      const chartData = Object.entries(genderCounts)
        .map(([name, value]) => ({ name, value }))
        .filter(item => item.value > 0); // Solo mostrar categorías con pacientes

      setData(chartData);
      setIsLoading(false);
    }, (error) => {
      console.error("Error al obtener datos de pacientes:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (isLoading) {
    return <div className="bg-white p-6 rounded-2xl shadow-lg h-[400px] animate-pulse"><div className="w-full h-full bg-slate-200 rounded-xl"></div></div>;
  }

  return (
    <motion.div 
      className="bg-white p-6 rounded-2xl shadow-lg"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <h3 className="text-xl font-bold text-slate-800 mb-4">Distribución por Género</h3>
      <div style={{ width: '100%', height: 300 }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => [`${value} pacientes`, '']} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
};

export default GenderDistributionChart;