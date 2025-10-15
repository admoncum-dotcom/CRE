'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { 
  FiArrowLeft, FiSearch, FiChevronLeft, FiChevronRight
} from 'react-icons/fi';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import EditAppointmentModal from './EditAppointmentModal';

// --- Helper Function ---
// Esta función es CRUCIAL para evitar errores de zona horaria.
// Convierte una fecha a formato YYYY-MM-DD local.
const toLocalDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
// -----------------------

interface AppointmentsViewProps {
  onBack: () => void;
  doctors: any[];
  therapists: any[];
}

const AppointmentsView: React.FC<AppointmentsViewProps> = ({ onBack, doctors, therapists }) => {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [filteredAppointments, setFilteredAppointments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [editingAppointment, setEditingAppointment] = useState<any | null>(null);
  const [calendarViewMode, setCalendarViewMode] = useState<'month' | 'week'>('month');
  const [selectedDayForList, setSelectedDayForList] = useState<Date | null>(null);

  const [fullDayThreshold, setFullDayThreshold] = useState(20);

  const daysOfWeek = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  useEffect(() => {
    setIsLoading(true);
    const q = collection(db, 'appointments');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allAppointments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAppointments(allAppointments);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);
  
  useEffect(() => {
    const lowerCaseSearch = searchTerm.toLowerCase().trim();
    if (!lowerCaseSearch) {
      setFilteredAppointments(appointments);
      return;
    }
    const filtered = appointments.filter(appt => 
      appt.patientName && appt.patientName.toLowerCase().includes(lowerCaseSearch)
    );
    setFilteredAppointments(filtered);
  }, [searchTerm, appointments]);

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return Array.from({ length: new Date(year, month + 1, 0).getDate() }, (_, i) => new Date(year, month, i + 1));
  };
  
  const getDaysInWeek = (refDate: Date) => {
    const date = new Date(refDate);
    const dayOfWeek = date.getDay();
    const diff = date.getDate() - dayOfWeek;
    const startOfWeek = new Date(date.setDate(diff));
    return Array.from({length: 7}, (_, i) => {
        const weekDay = new Date(startOfWeek);
        weekDay.setDate(startOfWeek.getDate() + i);
        return weekDay;
    });
  };

  const getAppointmentsForDay = (day: Date) => {
    // *** CORRECCIÓN CLAVE ***
    // Usamos la función helper para comparar fechas sin errores de timezone.
    const formattedDay = toLocalDateString(day);
    // Usamos 'appointments' en lugar de 'filteredAppointments' para la vista de calendario
    // para asegurar que siempre se muestren todas las citas del día.
    return appointments.filter(appt => appt.date === formattedDay);
  };
  
  const goToPrevious = () => {
    setCurrentDate(prevDate => {
      const newDate = new Date(prevDate);
      if (calendarViewMode === 'month') {
        newDate.setMonth(newDate.getMonth() - 1);
      } else {
        newDate.setDate(newDate.getDate() - 7);
      }
      return newDate;
    });
  };

  const goToNext = () => {
    setCurrentDate(prevDate => {
      const newDate = new Date(prevDate);
      if (calendarViewMode === 'month') {
        newDate.setMonth(newDate.getMonth() + 1);
      } else {
        newDate.setDate(newDate.getDate() + 7);
      }
      return newDate;
    });
  };

  const daysInMonth = getDaysInMonth(currentDate);
  const firstDayOfMonth = daysInMonth[0].getDay();

  // Si se está buscando, mostramos una lista simple de resultados
  if (searchTerm) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center space-x-4 mb-6">
          <button onClick={onBack} className="p-2 rounded-full hover:bg-slate-200 transition-colors"><FiArrowLeft size={24} /></button>
          <h2 className="text-3xl font-bold text-slate-900">Resultados de Búsqueda</h2>
        </div>
        <div className="relative mb-6">
          <input type="text" placeholder="Buscar por nombre de paciente..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-12 pr-4 py-3 w-full rounded-full bg-white border-2 border-slate-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500"/>
          <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-lg space-y-3">
            {filteredAppointments.length > 0 ? filteredAppointments.map(appt => (
                 <div key={appt.id} onClick={() => setEditingAppointment(appt)} className={`p-4 rounded-lg flex justify-between items-center cursor-pointer ${appt.status === 'cancelled' ? 'bg-red-100' : 'bg-slate-50 hover:bg-sky-50'}`}>
                    <div>
                        <p className={`font-bold ${appt.status === 'cancelled' && 'line-through'}`}>{appt.patientName}</p>
                        <p className="text-sm text-slate-500">{appt.date} a las {appt.time}</p>
                    </div>
                    <span className={`text-sm font-semibold px-3 py-1 rounded-full ${appt.type === 'consultation' ? 'bg-emerald-100 text-emerald-800' : 'bg-purple-100 text-purple-800'}`}>{appt.type === 'consultation' ? 'Consulta' : 'Terapia'}</span>
                 </div>
            )) : <p className="text-center text-slate-500">No se encontraron citas.</p>}
        </div>
         <AnimatePresence>
            {editingAppointment && <EditAppointmentModal appointment={editingAppointment} onClose={() => setEditingAppointment(null)} doctors={doctors} therapists={therapists} appointments={appointments} />}
        </AnimatePresence>
      </motion.div>
    )
  }

  // Vista de Calendario
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex items-center space-x-4 mb-6">
        <button onClick={onBack} className="p-2 rounded-full hover:bg-slate-200 transition-colors"><FiArrowLeft size={24} /></button>
        <h2 className="text-3xl font-bold text-slate-900">Gestión de Citas</h2>
      </div>
      
      <div className="relative mb-6">
        <input type="text" placeholder="Buscar por nombre de paciente..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-12 pr-4 py-3 w-full rounded-full bg-white border-2 border-slate-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500"/>
        <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-lg space-y-4">
        <div className="flex justify-between items-center mb-4 flex-wrap gap-4">          
          <div className="flex items-center space-x-2">
            <button onClick={goToPrevious} className="p-2 rounded-full hover:bg-slate-200"><FiChevronLeft size={24} /></button>
            <h3 className="text-2xl font-semibold text-slate-900">
              {calendarViewMode === 'month' ? `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}` : `Semana del ${getDaysInWeek(currentDate)[0].getDate()} de ${monthNames[getDaysInWeek(currentDate)[0].getMonth()]}`}
            </h3>
            <button onClick={goToNext} className="p-2 rounded-full hover:bg-slate-200"><FiChevronRight size={24} /></button>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <label htmlFor="full-day-threshold" className="text-sm font-medium text-slate-600">Día lleno:</label>
              <input
                type="number"
                id="full-day-threshold"
                value={fullDayThreshold}
                onChange={(e) => { const val = Number(e.target.value); if (val > 0) setFullDayThreshold(val); }}
                className="w-16 p-1 border-2 border-slate-200 rounded-lg text-center focus:ring-sky-500 focus:border-sky-500"
                min="1"
              />
            </div>
            <div className="flex space-x-1 bg-slate-200 p-1 rounded-full">
              <button onClick={() => setCalendarViewMode('month')} className={`px-3 py-1 text-sm font-semibold rounded-full ${calendarViewMode === 'month' ? 'bg-white shadow text-sky-600' : 'text-slate-600'}`}>Mes</button>
              <button onClick={() => setCalendarViewMode('week')} className={`px-3 py-1 text-sm font-semibold rounded-full ${calendarViewMode === 'week' ? 'bg-white shadow text-sky-600' : 'text-slate-600'}`}>Semana</button>
            </div>
          </div>
        </div>
        
        <AnimatePresence mode="wait">
        <motion.div key={calendarViewMode} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          {calendarViewMode === 'month' ? (
          <>
            <div className="grid grid-cols-7 text-center font-bold text-slate-600">{daysOfWeek.map(day => <span key={day} className="py-2">{day}</span>)}</div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstDayOfMonth }).map((_, i) => <div key={`empty-${i}`} className="h-32 border border-transparent"></div>)}
              {daysInMonth.map(day => {
                const appointmentsForDay = getAppointmentsForDay(day);
                const activeAppointmentsCount = appointmentsForDay.filter(a => a.status !== 'cancelled').length;
                const isSelectedForList = selectedDayForList?.toDateString() === day.toDateString();
                const isFull = activeAppointmentsCount >= fullDayThreshold;
                const isToday = day.toDateString() === new Date().toDateString();

                let dayStyle = '';
                if (isFull) {
                  dayStyle = 'bg-rose-100 border-rose-300 hover:bg-rose-200';
                } else if (isToday) {
                  dayStyle = 'border-sky-400 bg-sky-50 hover:bg-sky-100';
                } else {
                  dayStyle = 'border-slate-200 hover:bg-slate-50';
                }

                if (isSelectedForList) {
                  dayStyle = isFull 
                    ? 'bg-rose-200 border-rose-400 ring-2 ring-rose-500' 
                    : 'bg-sky-100 border-sky-400 ring-2 ring-sky-500';
                }

                return (
                  <div key={day.toISOString()} onClick={() => setSelectedDayForList(day)} className={`h-32 p-2 flex flex-col rounded-lg border-2 cursor-pointer transition-all ${dayStyle}`}>
                    <span className={`font-bold ${isFull ? 'text-rose-800' : ''}`}>{day.getDate()}</span>
                    <div className="mt-1 flex flex-col text-left text-xs space-y-1 overflow-y-auto pr-1">
                      {appointmentsForDay.sort((a, b) => a.time.localeCompare(b.time)).slice(0, 3).map(appt => (
                        <div key={appt.id} onClick={(e) => { e.stopPropagation(); setEditingAppointment(appt); }} className={`w-full p-1 rounded-md truncate cursor-pointer ${appt.status === 'cancelled' ? 'bg-red-100 text-red-700 line-through' : appt.type === 'consultation' ? 'bg-emerald-100 text-emerald-800' : 'bg-purple-100 text-purple-800'}`}>
                          <p className="font-semibold">{appt.patientName.split(' ')[0]}</p><p className="text-xs opacity-80">{appt.time}</p>
                        </div>
                      ))}
                      {appointmentsForDay.length > 3 && (
                        <p className="text-center text-slate-500 font-semibold text-xs mt-1">+{appointmentsForDay.length - 3} más...</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="border-t border-slate-200">
            <div className="grid grid-cols-7 text-center font-semibold text-slate-600 border-b border-slate-200">
              {getDaysInWeek(currentDate).map(day => (<div key={day.toISOString()} className="py-2"><p className="text-sm">{daysOfWeek[day.getDay()]}</p><p className={`text-lg mt-1 ${day.toDateString() === new Date().toDateString() ? 'bg-sky-600 text-white rounded-full w-8 h-8 mx-auto flex items-center justify-center' : ''}`}>{day.getDate()}</p></div>))}
            </div>
            <div className="grid grid-cols-7 gap-0 border-l border-slate-200 min-h-[500px]">
              {getDaysInWeek(currentDate).map((day, dayIndex) => {
                const dailyAppointments = getAppointmentsForDay(day).sort((a, b) => a.time.localeCompare(b.time));
                return (
                  <div key={day.toISOString()} className="border-r border-slate-200 p-1 space-y-2">
                    {dailyAppointments.map(appt => (
                      <motion.div key={appt.id} className={`p-2 rounded-lg text-xs shadow-md cursor-pointer ${appt.status === 'cancelled' ? 'bg-red-100 text-red-700 opacity-70' : appt.type === 'consultation' ? 'bg-emerald-100 text-emerald-800' : 'bg-purple-100 text-purple-800'}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} onClick={() => appt.status !== 'cancelled' && setEditingAppointment(appt)}>
                        <p className="font-bold text-sm truncate">{appt.patientName}</p><p className="font-semibold">{appt.time}</p><p className="truncate opacity-80">{appt.type === 'consultation' ? appt.doctorName : appt.therapistName}</p>{appt.status === 'cancelled' && <p className="font-bold text-center mt-1">CANCELADA</p>}
                      </motion.div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        </motion.div>
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {selectedDayForList && calendarViewMode === 'month' && (
          <motion.div
            className="mt-8"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <h3 className="text-xl font-bold text-slate-800 mb-4">
              Citas para el {selectedDayForList.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
            </h3>
            <div className="bg-white p-4 rounded-xl shadow-md space-y-3">
              {getAppointmentsForDay(selectedDayForList).sort((a, b) => a.time.localeCompare(b.time)).length > 0 ? (
                getAppointmentsForDay(selectedDayForList).sort((a, b) => a.time.localeCompare(b.time)).map(appt => (
                  <div key={appt.id} onClick={() => setEditingAppointment(appt)} className={`p-3 rounded-lg flex justify-between items-center cursor-pointer transition-colors ${appt.status === 'cancelled' ? 'bg-red-50 hover:bg-red-100' : 'bg-sky-50 hover:bg-sky-100'}`}>
                    <div>
                      <p className={`font-bold ${appt.status === 'cancelled' && 'line-through'}`}>{appt.patientName}</p>
                      <p className="text-sm text-slate-500">{appt.time} - {appt.type === 'consultation' ? appt.doctorName : appt.therapistName}</p>
                    </div>
                    <span className={`text-sm font-semibold px-3 py-1 rounded-full ${appt.type === 'consultation' ? 'bg-emerald-100 text-emerald-800' : 'bg-purple-100 text-purple-800'}`}>{appt.type === 'consultation' ? 'Consulta' : 'Terapia'}</span>
                  </div>
                ))
              ) : <p className="text-center text-slate-500 py-4">No hay citas programadas para este día.</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editingAppointment && <EditAppointmentModal appointment={editingAppointment} onClose={() => setEditingAppointment(null)} doctors={doctors} therapists={therapists} appointments={appointments} />}
      </AnimatePresence>
    </motion.div>
  );
};

export default AppointmentsView;
