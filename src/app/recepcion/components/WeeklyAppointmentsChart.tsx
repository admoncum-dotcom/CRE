    'use client';
    
    import React from 'react';
    import { motion } from 'framer-motion';
    import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
    import { FiBarChart } from 'react-icons/fi';
    
    // Componente para el esqueleto de carga del gráfico
    const SkeletonChart = () => (
      <div className="bg-white p-6 rounded-2xl shadow-lg animate-pulse h-96 flex items-center justify-center">
        <div className="w-full h-full bg-slate-200 rounded-lg"></div>
      </div>
    );
    
    interface ChartProps {
      data: any[];
      isLoading: boolean;
      doctors: any[];
      therapists: any[];
      filter: string;
      onFilterChange: (value: string) => void;
    }
    
    const WeeklyAppointmentsChart: React.FC<ChartProps> = ({ data, isLoading, doctors, therapists, filter, onFilterChange }) => {
      if (isLoading) {
        return <SkeletonChart />;
      }
    
      return (
        <motion.div
          className="bg-white p-6 rounded-2xl shadow-lg"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
            <h3 className="text-2xl font-bold text-slate-900 flex items-center flex-shrink-0">
              <FiBarChart className="mr-3 text-sky-500" />
              Pacientes Atendidos en la Semana
            </h3>
            <div className="w-full sm:w-auto sm:min-w-[250px]">
              <select
                id="professionalFilter"
                name="professionalFilter"
                value={filter}
                onChange={(e) => onFilterChange(e.target.value)}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-slate-300 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm rounded-md shadow-sm"
              >
                <option value="all">Todos los profesionales</option>
                <optgroup label="Doctores/as">
                  {doctors.map(doc => (
                    <option key={doc.id} value={`doc-${doc.id}`}>{doc.name}</option>
                  ))}
                </optgroup>
                <optgroup label="Terapeutas">
                  {therapists.map(ther => (
                    <option key={ther.id} value={`ther-${ther.id}`}>{ther.name}</option>
                  ))}
                </optgroup>
              </select>
            </div>
          </div>
          <div className="w-full h-[300px]">
            <ResponsiveContainer>
              <BarChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                <XAxis dataKey="name" stroke="#6b7280" />
                <YAxis stroke="#6b7280" allowDecimals={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', backdropFilter: 'blur(4px)', border: '1px solid #e0e0e0', borderRadius: '0.75rem' }}
                  labelStyle={{ fontWeight: 'bold', color: '#1f2937' }}
                  formatter={(value: number) => [`${value} paciente(s)`, 'Total']}
                />
                <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: '20px' }} />
                <Bar dataKey="pacientes" fill="#0ea5e9" name="Pacientes Atendidos" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      );
    };
    
    export default WeeklyAppointmentsChart;
    

