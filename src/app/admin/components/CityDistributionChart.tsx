'use client';

import React, { useState, useEffect } from 'react';
import { onSnapshot, collection, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { motion } from 'framer-motion';

const CityDistributionChart = () => {
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'patients'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const cityCounts: { [key: string]: number } = {};

      snapshot.forEach(doc => {
        const patient = doc.data();
        const city = patient.city?.trim(); // Obtiene la ciudad y elimina espacios en blanco

        if (city) {
          cityCounts[city] = (cityCounts[city] || 0) + 1;
        } else {
          cityCounts['No especificado'] = (cityCounts['No especificado'] || 0) + 1;
        }
      });

      const chartData = Object.entries(cityCounts)
        .map(([name, value]) => ({ name, Pacientes: value })) // Renombrado a 'Pacientes' para la leyenda
        .sort((a, b) => b.Pacientes - a.Pacientes); // Ordenar de mayor a menor

      setData(chartData);
      setIsLoading(false);
    }, (error) => {
      console.error("Error al obtener datos de pacientes por ciudad:", error);
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
      <h3 className="text-xl font-bold text-slate-800 mb-4">Procedencia de Pacientes por Ciudad</h3>
      <div style={{ width: '100%', height: 300 }}>
        <ResponsiveContainer>
          <BarChart layout="vertical" data={data} margin={{ top: 5, right: 30, left: 50, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" allowDecimals={false} />
            <YAxis type="category" dataKey="name" width={120} />
            <Tooltip formatter={(value) => [`${value} pacientes`, '']} />
            <Legend />
            <Bar dataKey="Pacientes" fill="#22d3ee" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
};

export default CityDistributionChart;