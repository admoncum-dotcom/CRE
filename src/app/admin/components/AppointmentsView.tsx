'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiArrowLeft, FiSearch, FiChevronLeft, FiChevronRight, FiCalendar, FiClock
} from 'react-icons/fi'; // Se añade FiCalendar, FiClock para detalles
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import EditAppointmentModal from './EditAppointmentModal';

// --- Helper Function ---
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
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [calendarViewMode, setCalendarViewMode] = useState<'month' | 'week'>('month');

  // Colores de la paleta mejorada
  const primaryColor = 'sky'; // Azul principal
  const primaryColorDark = 'sky-600';
  const primaryColorLight = 'sky-100';
  const primaryColorText = 'sky-700';
  const neutralDark = 'slate-900';
  const neutralLight = 'slate-100';

  const daysOfWeek = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  // --- LOGIC (Mantenida) ---

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

  // Funciones de navegación (Mantenidas)
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
    return Array.from({ length: 7 }, (_, i) => {
      const weekDay = new Date(startOfWeek);
      weekDay.setDate(startOfWeek.getDate() + i);
      return weekDay;
    });
  };

  const getAppointmentsForDay = (day: Date) => {
    const formattedDay = toLocalDateString(day);
    return appointments.filter(appt => appt.date === formattedDay).sort((a, b) => a.time.localeCompare(b.time));
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

  const selectedDayAppointments = useMemo(() => {
    if (!selectedDay) return [];
    return getAppointmentsForDay(selectedDay);
  }, [selectedDay, appointments]);

  useEffect(() => setSelectedDay(null), [calendarViewMode, currentDate]);

  const daysInMonth = getDaysInMonth(currentDate);
  const firstDayOfMonth = daysInMonth[0].getDay();

  // --- RENDER (Mejorado) ---

  // Componente de Resultados de Búsqueda
  if (searchTerm) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center space-x-4 mb-8">
          <button onClick={() => setSearchTerm('')} className={`p-2 rounded-full text-${primaryColorDark} hover:bg-${primaryColorLight} transition-colors focus:outline-none focus:ring-2 focus:ring-${primaryColor}-500`}>
            <FiArrowLeft size={24} />
          </button>
          <h2 className={`text-3xl font-extrabold text-${neutralDark}`}>Resultados de Búsqueda 🔍</h2>
        </div>
        
        {/* Barra de Búsqueda (Mejorada visualmente) */}
        <div className="relative mb-8">
          <input 
            type="text" 
            placeholder="Buscar por nombre de paciente..." 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
            className={`pl-12 pr-4 py-3 w-full rounded-xl bg-white border-2 border-${neutralLight} shadow-md focus:outline-none focus:ring-4 focus:ring-${primaryColor}-200 focus:border-${primaryColorDark} text-lg`}
          />
          <FiSearch className={`absolute left-4 top-1/2 -translate-y-1/2 text-${primaryColorDark}`} size={20} />
        </div>

        {/* Lista de Citas (Estilo de tarjeta) */}
        <div className="bg-white p-6 rounded-3xl shadow-xl space-y-4 border border-slate-100">
          {filteredAppointments.length > 0 ? (
            <motion.div initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.05 } }, hidden: {} }}>
              {filteredAppointments.map(appt => (
                <motion.div 
                  key={appt.id} 
                  onClick={() => setEditingAppointment(appt)} 
                  className={`p-4 rounded-xl flex justify-between items-center cursor-pointer transform transition-all duration-300 ${appt.status === 'cancelled' ? 'bg-red-50 opacity-70 border border-red-200' : `bg-white hover:bg-${primaryColorLight} hover:shadow-lg border border-${neutralLight}`}`}
                  variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}
                >
                  <div className="flex-1 min-w-0">
                    <p className={`font-extrabold text-lg truncate ${appt.status === 'cancelled' ? 'text-red-600 line-through' : `text-${neutralDark}`}`}>
                      {appt.patientName}
                    </p>
                    <div className="flex items-center space-x-3 text-sm mt-1 text-slate-500">
                      <span className="flex items-center"><FiCalendar className="mr-1" size={14} />{appt.date}</span>
                      <span className="flex items-center"><FiClock className="mr-1" size={14} />{appt.time}</span>
                    </div>
                  </div>
                  <span className={`text-xs font-bold px-3 py-1.5 rounded-full uppercase ml-4 shadow-sm ${appt.type === 'consultation' ? 'bg-emerald-100 text-emerald-800' : 'bg-purple-100 text-purple-800'}`}>
                    {appt.type === 'consultation' ? 'Consulta' : 'Terapia'}
                  </span>
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <p className="text-center text-slate-500 py-4 text-lg">😔 No se encontraron citas con ese nombre.</p>
          )}
        </div>
        
        <AnimatePresence>
          {editingAppointment && <EditAppointmentModal appointment={editingAppointment} onClose={() => setEditingAppointment(null)} doctors={doctors} therapists={therapists} appointments={appointments} />}
        </AnimatePresence>
      </motion.div>
    );
  }

  // Componente de Vista Principal (Calendario)
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      {/* Encabezado */}
      <div className="flex items-center space-x-4 mb-8">
        <button onClick={onBack} className={`p-3 rounded-full text-${primaryColorDark} hover:bg-${primaryColorLight} transition-colors focus:outline-none focus:ring-2 focus:ring-${primaryColor}-500`}>
          <FiArrowLeft size={24} />
        </button>
        <h2 className={`text-4xl font-extrabold text-${neutralDark}`}>Calendario de Citas 🗓️</h2>
      </div>

      {/* Barra de Búsqueda (Mejorada visualmente) */}
      <div className="relative mb-8">
        <input 
          type="text" 
          placeholder="Buscar paciente para ir a resultados..." 
          value={searchTerm} 
          onChange={(e) => setSearchTerm(e.target.value)} 
          className={`pl-12 pr-4 py-3 w-full rounded-xl bg-white border-2 border-${neutralLight} shadow-md focus:outline-none focus:ring-4 focus:ring-${primaryColor}-200 focus:border-${primaryColorDark} text-lg`}
        />
        <FiSearch className={`absolute left-4 top-1/2 -translate-y-1/2 text-${primaryColorDark}`} size={20} />
      </div>

      {/* Contenedor Principal del Calendario */}
      <div className="bg-white p-6 rounded-3xl shadow-xl space-y-6 border border-slate-100">
        
        {/* Controles de Navegación y Vista */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 border-b pb-4 border-slate-100">
          
          {/* Navegación y Título */}
          <div className="flex items-center space-x-2 mb-4 sm:mb-0">
            <button onClick={goToPrevious} className={`p-2 rounded-full text-${primaryColorDark} hover:bg-${primaryColorLight}`}><FiChevronLeft size={28} /></button>
            <button onClick={goToNext} className={`p-2 rounded-full text-${primaryColorDark} hover:bg-${primaryColorLight}`}><FiChevronRight size={28} /></button>
            <h3 className={`text-2xl font-bold text-${primaryColorDark}`}>
              {calendarViewMode === 'month' ? `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}` : `Semana del ${getDaysInWeek(currentDate)[0].getDate()} de ${monthNames[getDaysInWeek(currentDate)[0].getMonth()]}`}
            </h3>
          </div>
          
          {/* Selector de Vista (Toggle mejorado) */}
          <div className={`flex space-x-1 bg-${neutralLight} p-1 rounded-full shadow-inner`}>
            <button onClick={() => setCalendarViewMode('month')} className={`px-4 py-2 text-sm font-bold rounded-full transition-all duration-300 ${calendarViewMode === 'month' ? `bg-white shadow-lg text-${primaryColorDark}` : 'text-slate-600 hover:text-slate-900'}`}>Mes</button>
            <button onClick={() => setCalendarViewMode('week')} className={`px-4 py-2 text-sm font-bold rounded-full transition-all duration-300 ${calendarViewMode === 'week' ? `bg-white shadow-lg text-${primaryColorDark}` : 'text-slate-600 hover:text-slate-900'}`}>Semana</button>
          </div>
        </div>

        {/* Vista de Mes */}
        {calendarViewMode === 'month' ? (
          <div className="space-y-4">
            <div className="grid grid-cols-7 text-center font-extrabold text-slate-700 uppercase tracking-wider text-sm border-b border-slate-200 pb-2">
              {daysOfWeek.map(day => <span key={day} className="py-2">{day}</span>)}
            </div>
            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: firstDayOfMonth }).map((_, i) => <div key={`empty-${i}`} className="h-32 border border-transparent"></div>)}
              {daysInMonth.map((day) => {
                const appointmentsForDay = getAppointmentsForDay(day);
                const isToday = day.toDateString() === new Date().toDateString();
                const isSelected = selectedDay?.toDateString() === day.toDateString();
                const hasAppointments = appointmentsForDay.length > 0;
                
                return (
                  <motion.div 
                    key={day.toISOString()} 
                    className={`h-40 p-2 flex flex-col rounded-xl border-2 transition-all duration-200 cursor-pointer shadow-sm relative ${isToday ? `border-${primaryColorDark} bg-${primaryColorLight}/50` : 'border-slate-200'} ${isSelected ? `ring-4 ring-${primaryColor}-300/70 border-${primaryColorDark} bg-${primaryColorLight}` : 'hover:bg-slate-50'}`}
                    onClick={() => setSelectedDay(day)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <span className={`font-extrabold text-xl ${isToday ? `text-${primaryColorDark}` : 'text-slate-800'} mb-1`}>{day.getDate()}</span>
                    
                    {hasAppointments && (
                        <div className={`absolute top-2 right-2 w-2 h-2 rounded-full ${isToday ? `bg-${primaryColorDark}` : 'bg-green-500'}`} title={`${appointmentsForDay.length} citas`}></div>
                    )}

                    <div className="flex flex-col text-left text-xs space-y-1 overflow-y-auto custom-scrollbar">
                      {appointmentsForDay.slice(0, 3).map(appt => (
                        <div key={appt.id} onClick={(e) => { e.stopPropagation(); setEditingAppointment(appt); }} 
                          className={`w-full p-1.5 rounded-lg truncate cursor-pointer shadow-inner hover:shadow-md transition-all ${appt.status === 'cancelled' ? 'bg-red-200 text-red-800 line-through opacity-70' : appt.type === 'consultation' ? 'bg-emerald-100 text-emerald-800' : 'bg-purple-100 text-purple-800'}`}>
                          <p className="font-bold leading-tight truncate">{appt.patientName.split(' ')[0]}</p>
                          <p className="text-xs opacity-90 font-semibold">{appt.time}</p>
                        </div>
                      ))}
                      {appointmentsForDay.length > 3 && (
                        <div className={`text-center text-${primaryColorDark} font-bold pt-1 text-xs`}>
                          + {appointmentsForDay.length - 3} más
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        ) : (
          // Vista de Semana
          <div className="space-y-4">
            {/* Encabezado de la Semana */}
            <div className="grid grid-cols-7 text-center font-extrabold text-slate-700 uppercase tracking-wider text-sm border-b-2 border-slate-200">
              {getDaysInWeek(currentDate).map(day => {
                const isToday = day.toDateString() === new Date().toDateString();
                return (
                  <div key={day.toISOString()} className="py-2 flex flex-col items-center">
                    <p className="text-sm">{daysOfWeek[day.getDay()]}</p>
                    <p className={`text-xl mt-1 font-bold ${isToday ? `bg-${primaryColorDark} text-white rounded-full w-8 h-8 flex items-center justify-center shadow-lg` : 'text-slate-800'}`}>
                      {day.getDate()}
                    </p>
                  </div>
                );
              })}
            </div>
            
            {/* Contenido de Citas por Día */}
            <div className="grid grid-cols-7 gap-1 border border-slate-200 rounded-xl overflow-hidden min-h-[500px]">
              {getDaysInWeek(currentDate).map(day => {
                const dailyAppointments = getAppointmentsForDay(day).sort((a, b) => a.time.localeCompare(b.time));
                return (
                  <div key={day.toISOString()} className={`border-r border-slate-200 p-2 space-y-2 ${day.toDateString() === new Date().toDateString() ? `bg-${primaryColorLight}/20` : 'bg-white'} last:border-r-0 overflow-y-auto custom-scrollbar`}>
                    <AnimatePresence>
                      {dailyAppointments.map(appt => (
                        <motion.div 
                          key={appt.id} 
                          className={`p-2 rounded-lg text-xs shadow-md cursor-pointer transition-all duration-300 transform hover:scale-[1.03] ${appt.status === 'cancelled' ? 'bg-red-100 text-red-700 opacity-70 border border-red-300' : appt.type === 'consultation' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-purple-100 text-purple-800 border border-purple-300'}`} 
                          initial={{ opacity: 0, y: 10 }} 
                          animate={{ opacity: 1, y: 0 }} 
                          exit={{ opacity: 0, y: -10 }}
                          onClick={() => setEditingAppointment(appt)}
                        >
                          <p className={`font-extrabold text-sm truncate ${appt.status === 'cancelled' && 'line-through'}`}>{appt.patientName}</p>
                          <p className="font-semibold text-xs">{appt.time}</p>
                          <p className="truncate opacity-80 text-[10px]">{appt.type === 'consultation' ? appt.doctorName : appt.therapistName}</p>
                          {appt.status === 'cancelled' && <p className="font-bold text-center mt-1 text-red-800">CANCELADA</p>}
                        </motion.div>
                      ))}
                    </AnimatePresence>
                    {dailyAppointments.length === 0 && <p className="text-center text-slate-400 text-sm italic pt-4">Sin citas</p>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Panel de Citas del Día Seleccionado (Mejorado) */}
      <AnimatePresence>
        {selectedDay && calendarViewMode === 'month' && (
          <motion.div 
            className="mt-6 bg-white p-6 rounded-3xl shadow-xl border border-slate-100"
            initial={{ opacity: 0, y: 20, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: 20, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <h3 className={`text-2xl font-bold text-${primaryColorDark} mb-4 border-b pb-2 border-slate-100`}>
              Citas para el {selectedDay.toLocaleDateString('es-HN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </h3>
            <div className="space-y-3 max-h-80 overflow-y-auto custom-scrollbar p-1">
              {selectedDayAppointments.length > 0 ? selectedDayAppointments.map(appt => (
                <motion.div 
                  key={appt.id} 
                  onClick={() => setEditingAppointment(appt)} 
                  className={`p-3 rounded-xl flex justify-between items-center cursor-pointer transition-colors shadow-sm ${appt.status === 'cancelled' ? 'bg-red-100 opacity-80 border border-red-200' : `bg-${primaryColorLight} hover:bg-${primaryColor}-200 border border-${primaryColor}-200`}`}
                  whileHover={{ scale: 1.01 }}
                >
                  <div className="flex-1 min-w-0">
                    <p className={`font-extrabold text-lg truncate ${appt.status === 'cancelled' ? 'text-red-700 line-through' : `text-${neutralDark}`}`}>{appt.patientName}</p>
                    <p className="text-sm text-slate-600 font-medium mt-0.5">{appt.time} - {appt.type === 'consultation' ? appt.doctorName : appt.therapistName}</p>
                  </div>
                  <span className={`text-xs font-bold px-3 py-1.5 rounded-full uppercase ml-4 shadow-sm ${appt.type === 'consultation' ? 'bg-emerald-200 text-emerald-900' : 'bg-purple-200 text-purple-900'}`}>
                    {appt.type === 'consultation' ? 'Consulta' : 'Terapia'}
                  </span>
                </motion.div>
              )) : (
                <div className={`text-center text-slate-500 py-6 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50`}>
                    <p className="font-semibold">¡Día libre! 🥳</p>
                    <p className="text-sm">No hay citas agendadas para este día.</p>
                </div>
              )}
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