'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiCalendar, FiClock, FiUser, FiInfo, FiCheckCircle, FiXCircle, FiAlertCircle, FiHeart, FiUserPlus } from 'react-icons/fi';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface PatientDetailsModalProps {
  patient: any;
  onClose: () => void;
}

const statusInfo = {
  scheduled: { icon: <FiClock className="text-blue-500" />, text: 'Programada', color: 'text-blue-500' },
  completed: { icon: <FiCheckCircle className="text-green-500" />, text: 'Completada', color: 'text-green-500' },
  cancelled: { icon: <FiXCircle className="text-red-500" />, text: 'Cancelada', color: 'text-red-500' },
  'no-show': { icon: <FiAlertCircle className="text-yellow-500" />, text: 'No se presentó', color: 'text-yellow-500' },
};

const AppointmentItem = ({ appt }: { appt: any }) => {
  const status = statusInfo[appt.status as keyof typeof statusInfo] || { icon: <FiInfo />, text: appt.status, color: 'text-gray-500' };
  const typeIcon = appt.type === 'consultation' 
    ? <FiUserPlus className="text-emerald-600" /> 
    : <FiHeart className="text-purple-600" />;
  const typeBg = appt.type === 'consultation' ? 'bg-emerald-100' : 'bg-purple-100';

  return (
    <div className="p-4 bg-sky-50 rounded-lg flex items-start space-x-4">
      <div className={`mt-1 p-2 rounded-full ${typeBg}`}>
        {typeIcon}
      </div>
      <div>
        <p className="font-bold text-slate-800">{appt.date}</p>
        <p className="text-sm text-slate-600">Hora: {appt.time}</p>
        <p className="text-sm text-slate-600">Profesional: {appt.doctorName || appt.therapistName}</p>
        <p className={`text-sm font-semibold ${status.color}`}>{status.text}</p>
      </div>
    </div>
  );
};

const TreatmentProgress = ({ treatmentName, therapies }: { treatmentName: string, therapies: any[] }) => {
  const completedCount = therapies.filter(t => t.status === 'completed').length;
  const progress = (completedCount / 10) * 100;

  let progressColor = 'bg-sky-500';
  if (completedCount >= 8 && completedCount < 10) {
    progressColor = 'bg-orange-500';
  } else if (completedCount >= 10) {
    progressColor = 'bg-red-500';
  }

  return (
    <div className="p-4 bg-slate-100 rounded-lg">
      <div className="flex justify-between items-center mb-2">
        <h4 className="font-bold text-slate-800">{treatmentName}</h4>
        <span className={`font-semibold text-sm ${completedCount >= 10 ? 'text-red-600' : 'text-slate-600'}`}>
          Sesiones: {completedCount} de 10
        </span>
      </div>
      <div className="w-full bg-slate-200 rounded-full h-2.5">
        <div className={`${progressColor} h-2.5 rounded-full transition-all duration-500`} style={{ width: `${progress}%` }}></div>
      </div>
    </div>
  );
};

const PatientDetailsModal: React.FC<PatientDetailsModalProps> = ({ patient, onClose }) => {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'consultation' | 'therapy'>('all');

  const treatments = useMemo(() => {
    if (isLoading) return {};

    const treatmentsMap: { [key: string]: any[] } = {};

    // Agrupar terapias por el nombre del tratamiento
    appointments
      .filter(appt => appt.type === 'therapy' && appt.indicatedTreatment)
      .forEach(therapy => {
        const treatmentName = therapy.indicatedTreatment;
        if (!treatmentsMap[treatmentName]) treatmentsMap[treatmentName] = [];
        treatmentsMap[treatmentName].push(therapy);
      });
    return treatmentsMap;
  }, [appointments, isLoading]);

  useEffect(() => {
    if (!patient?.id) return;
    setIsLoading(true);

    const constraints: any[] = [
      where('patientId', '==', patient.id)
    ];

    if (startDate) {
      constraints.push(where('date', '>=', startDate));
    }
    if (endDate) {
      constraints.push(where('date', '<=', endDate));
    }

    constraints.push(orderBy('date', 'desc'));

    const q = query(collection(db, 'appointments'), ...constraints);

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const appts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAppointments(appts);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching appointments:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [patient.id, startDate, endDate]);

  const filteredAppointments = useMemo(() => {
    if (typeFilter === 'all') {
      return appointments;
    }
    return appointments.filter(appt => appt.type === typeFilter);
  }, [appointments, typeFilter]);


  const FilterButton = ({ value, label }: { value: typeof typeFilter, label: string }) => (
    <button onClick={() => setTypeFilter(value)} className={`px-4 py-1.5 text-sm font-semibold rounded-full transition-colors ${typeFilter === value ? 'bg-sky-600 text-white shadow-md' : 'bg-white text-slate-600 hover:bg-slate-100'}`}>
      {label}
    </button>
  );

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      <motion.div
        className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-2xl"
        initial={{ scale: 0.9, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 30 }}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-slate-900 flex items-center">
            <FiCalendar className="mr-3" />
            Historial de Citas de {patient.name}
          </h3>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-200 transition-colors"><FiX size={24} /></button>
        </div>
        <div className="mb-4 border-b border-slate-200 pb-4 space-y-4">
            <div className="flex items-center space-x-2 bg-slate-100 p-1 rounded-full w-fit">
                <FilterButton value="all" label="Todas" />
                <FilterButton value="consultation" label="Consultas" />
                <FilterButton value="therapy" label="Terapias" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label htmlFor="startDate" className="block text-base font-medium text-slate-700">Desde</label>
                <input type="date" id="startDate" value={startDate} onChange={e => setStartDate(e.target.value)} className="mt-1 w-full p-2 rounded-lg bg-sky-50 border-2 border-slate-200 focus:border-sky-500 focus:ring-sky-500"/>
            </div>
            <div>
                <label htmlFor="endDate" className="block text-base font-medium text-slate-700">Hasta</label>
                <input type="date" id="endDate" value={endDate} onChange={e => setEndDate(e.target.value)} className="mt-1 w-full p-2 rounded-lg bg-sky-50 border-2 border-slate-200 focus:border-sky-500 focus:ring-sky-500"/>
            </div>
            </div>
        </div>
        <div className="max-h-[50vh] overflow-y-auto space-y-4 pr-2">
          {isLoading && <p className="text-center text-slate-500 py-8">Cargando historial...</p>}
          {!isLoading && (
            <AnimatePresence>
              {typeFilter === 'therapy' && Object.keys(treatments).length > 0 && (
                <motion.div layout className="space-y-4 mb-6 p-4 bg-sky-50 rounded-lg">
                  <h3 className="text-lg font-bold text-slate-800">Progreso de Terapias</h3>
                  {Object.entries(treatments).map(([name, therapies]) => (
                    <TreatmentProgress key={name} treatmentName={name} therapies={therapies} />
                  ))}
                </motion.div>
              )}
              {filteredAppointments.length === 0 && <p className="text-center text-slate-500 py-8">No hay citas que coincidan con los filtros.</p>}
              {filteredAppointments.map(appt => <AppointmentItem key={appt.id} appt={appt} />)}
            </AnimatePresence>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default PatientDetailsModal;