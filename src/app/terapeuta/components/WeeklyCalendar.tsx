'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiChevronLeft, 
  FiChevronRight, 
  FiCalendar, 
  FiClock, 
  FiUser, 
  FiMapPin,
  FiArrowLeft,
  FiSearch
} from 'react-icons/fi';

// --- INTERFACES ---
interface Appointment {
  id: string;
  patientName: string;
  patientId: string;
  therapistId: string;
  date: string; // formato YYYY-MM-DD
  time: string; // formato HH:MM
  duration?: number; // duración en minutos
  type: string;
  status: 'scheduled' | 'completed' | 'cancelled' | 'no-show';
  observations?: string;
  location?: string;
}

interface WeeklyCalendarProps {
  therapistId: string;
  onBackToDashboard: () => void;
  onSelectAppointment?: (appointment: Appointment) => void;
}

// --- HELPERS ---
const getWeekDates = (date: Date) => {
  const start = new Date(date);
  start.setDate(date.getDate() - date.getDay()); // Domingo de la semana
  
  const week = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    week.push(day);
  }
  return week;
};

const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

const isToday = (date: Date): boolean => {
  const today = new Date();
  return date.toDateString() === today.toDateString();
};

// --- COMPONENTE PRINCIPAL ---
const WeeklyCalendar: React.FC<WeeklyCalendarProps> = ({ 
  therapistId, 
  onBackToDashboard,
  onSelectAppointment 
}) => {
  const [currentWeek, setCurrentWeek] = useState<Date>(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // ✅ CORRECCIÓN: Usar useMemo para evitar recreación en cada render
  const weekDates = useMemo(() => getWeekDates(currentWeek), [currentWeek]);

  // ✅ CORRECCIÓN: Memoizar las fechas de inicio y fin para las dependencias
  const weekStart = useMemo(() => formatDate(weekDates[0]), [weekDates]);
  const weekEnd = useMemo(() => formatDate(weekDates[6]), [weekDates]);

  const daysOfWeek = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  // Navegación entre semanas
  const goToPreviousWeek = () => {
    setCurrentWeek(prev => {
      const newDate = new Date(prev);
      newDate.setDate(prev.getDate() - 7);
      return newDate;
    });
  };

  const goToNextWeek = () => {
    setCurrentWeek(prev => {
      const newDate = new Date(prev);
      newDate.setDate(prev.getDate() + 7);
      return newDate;
    });
  };

  const goToToday = () => {
    setCurrentWeek(new Date());
  };

  // ✅ CORRECCIÓN: Cargar citas del terapeuta con dependencias estables
  useEffect(() => {
    if (!therapistId) return;

    setIsLoading(true);

    const q = query(
      collection(db, 'appointments'),
      where('therapistId', '==', therapistId),
      where('date', '>=', weekStart),
      where('date', '<=', weekEnd),
      orderBy('date'),
      orderBy('time')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const appointmentsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Appointment));
      
      setAppointments(appointmentsData);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching appointments:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [therapistId, weekStart, weekEnd]);

  // Filtrar citas por búsqueda
  const filteredAppointments = useMemo(() => {
    if (!searchTerm.trim()) return appointments;
    
    const term = searchTerm.toLowerCase().trim();
    return appointments.filter(appt => 
      appt.patientName.toLowerCase().includes(term)
    );
  }, [appointments, searchTerm]);

  // Obtener citas para un día específico
  const getAppointmentsForDay = useCallback((day: Date) => {
    const dateStr = formatDate(day);
    return filteredAppointments.filter(appt => 
      appt.date === dateStr
    ).sort((a, b) => a.time.localeCompare(b.time));
  }, [filteredAppointments]);

  // Manejar clic en cita
  const handleAppointmentClick = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    if (onSelectAppointment) {
      onSelectAppointment(appointment);
    }
  };

  // Si hay término de búsqueda, mostrar vista de lista
  if (searchTerm.trim()) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center space-x-4 mb-6">
          <button onClick={onBackToDashboard} className="p-2 rounded-full hover:bg-slate-200 transition-colors">
            <FiArrowLeft size={24} />
          </button>
          <h2 className="text-3xl font-bold text-slate-900">Resultados de Búsqueda</h2>
        </div>
        
        <div className="relative mb-6">
          <input 
            type="text" 
            placeholder="Buscar por nombre de paciente..." 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
            className="pl-12 pr-4 py-3 w-full rounded-full bg-white border-2 border-slate-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
          <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-lg space-y-3">
          {filteredAppointments.length > 0 ? filteredAppointments.map(appt => (
            <div 
              key={appt.id} 
              onClick={() => handleAppointmentClick(appt)} 
              className={`p-4 rounded-lg flex justify-between items-center cursor-pointer ${
                appt.status === 'cancelled' ? 'bg-red-100' : 'bg-slate-50 hover:bg-sky-50'
              }`}
            >
              <div>
                <p className={`font-bold ${appt.status === 'cancelled' && 'line-through'}`}>
                  {appt.patientName}
                </p>
                <p className="text-sm text-slate-500">
                  {appt.date} a las {appt.time}
                </p>
              </div>
              <span className={`text-sm font-semibold px-3 py-1 rounded-full ${
                appt.type === 'consultation' ? 'bg-emerald-100 text-emerald-800' : 'bg-purple-100 text-purple-800'
              }`}>
                {appt.type === 'consultation' ? 'Consulta' : 'Terapia'}
              </span>
            </div>
          )) : (
            <p className="text-center text-slate-500">No se encontraron citas.</p>
          )}
        </div>
      </motion.div>
    );
  }

  // Vista de Calendario Semanal
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      {/* Header */}
      <div className="flex items-center space-x-4 mb-6">
        <button onClick={onBackToDashboard} className="p-2 rounded-full hover:bg-slate-200 transition-colors">
          <FiArrowLeft size={24} />
        </button>
        <h2 className="text-3xl font-bold text-slate-900">Calendario Semanal</h2>
      </div>
      
      {/* Barra de búsqueda */}
      <div className="relative mb-6">
        <input 
          type="text" 
          placeholder="Buscar por nombre de paciente..." 
          value={searchTerm} 
          onChange={(e) => setSearchTerm(e.target.value)} 
          className="pl-12 pr-4 py-3 w-full rounded-full bg-white border-2 border-slate-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
        />
        <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
      </div>

      {/* Controles y calendario */}
      <div className="bg-white p-6 rounded-2xl shadow-lg space-y-4">
        <div className="flex justify-between items-center mb-4 flex-wrap gap-4">          
          {/* Controles de navegación */}
          <div className="flex items-center space-x-2">
            <button onClick={goToPreviousWeek} className="p-2 rounded-full hover:bg-slate-200">
              <FiChevronLeft size={24} />
            </button>
            <h3 className="text-2xl font-semibold text-slate-900">
              Semana del {weekDates[0].getDate()} de {monthNames[weekDates[0].getMonth()]}
            </h3>
            <button onClick={goToNextWeek} className="p-2 rounded-full hover:bg-slate-200">
              <FiChevronRight size={24} />
            </button>
          </div>

          {/* Botón Hoy */}
          <div className="flex items-center space-x-4">
            <button
              onClick={goToToday}
              className="px-4 py-2 bg-sky-500 text-white rounded-lg hover:bg-sky-600 transition-colors font-medium"
            >
              Hoy
            </button>
          </div>
        </div>
        
        {/* Calendario Semanal - Mismo diseño visual que el código base */}
        <div className="border-t border-slate-200">
          {/* Header de días */}
          <div className="grid grid-cols-7 text-center font-semibold text-slate-600 border-b border-slate-200">
            {weekDates.map(day => (
              <div key={day.toISOString()} className="py-2">
                <p className="text-sm">{daysOfWeek[day.getDay()]}</p>
                <p className={`text-lg mt-1 ${
                  isToday(day) 
                    ? 'bg-sky-600 text-white rounded-full w-8 h-8 mx-auto flex items-center justify-center' 
                    : ''
                }`}>
                  {day.getDate()}
                </p>
              </div>
            ))}
          </div>

          {/* Citas por día - Mismo diseño visual */}
          <div className="grid grid-cols-7 gap-0 border-l border-slate-200 min-h-[500px]">
            {weekDates.map((day, dayIndex) => {
              const dailyAppointments = getAppointmentsForDay(day);
              
              return (
                <div key={day.toISOString()} className="border-r border-slate-200 p-1 space-y-2">
                  {dailyAppointments.map(appt => (
                    <motion.div 
                      key={appt.id} 
                      className={`p-2 rounded-lg text-xs shadow-md cursor-pointer ${
                        appt.status === 'cancelled' 
                          ? 'bg-red-100 text-red-700 opacity-70' 
                          : appt.type === 'consultation' 
                            ? 'bg-emerald-100 text-emerald-800' 
                            : 'bg-purple-100 text-purple-800'
                      }`} 
                      initial={{ opacity: 0, y: 10 }} 
                      animate={{ opacity: 1, y: 0 }} 
                      onClick={() => appt.status !== 'cancelled' && handleAppointmentClick(appt)}
                    >
                      <p className="font-bold text-sm truncate">{appt.patientName}</p>
                      <p className="font-semibold">{appt.time}</p>
                      <p className="truncate opacity-80 capitalize">
                        {appt.type === 'consultation' ? 'Consulta' : 'Terapia'}
                      </p>
                      {appt.status === 'cancelled' && (
                        <p className="font-bold text-center mt-1">CANCELADA</p>
                      )}
                    </motion.div>
                  ))}
                  
                  {/* Mostrar mensaje cuando no hay citas */}
                  {dailyAppointments.length === 0 && (
                    <div className="h-full flex items-center justify-center py-8">
                      <p className="text-slate-400 text-xs text-center">
                        No hay citas<br />programadas
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Información de la semana */}
        <div className="text-center text-slate-600 text-sm mt-4">
          Mostrando {filteredAppointments.length} citas para la semana
        </div>
      </div>

      {/* Modal de Detalles de Cita */}
      <AnimatePresence>
        {selectedAppointment && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => setSelectedAppointment(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-slate-900">Detalles de la Cita</h3>
                <button
                  onClick={() => setSelectedAppointment(null)}
                  className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-600"
                >
                  <FiChevronLeft size={20} />
                </button>
              </div>

              <div className="space-y-6">
                <div className="flex items-center space-x-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-sky-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                    <FiUser className="text-white" size={24} />
                  </div>
                  <div>
                    <p className="font-bold text-lg text-slate-900">{selectedAppointment.patientName}</p>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className="text-sm text-slate-600 capitalize">{selectedAppointment.type}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 rounded-lg p-4">
                    <div className="flex items-center space-x-3">
                      <FiCalendar className="text-slate-500" size={18} />
                      <div>
                        <p className="text-sm text-slate-600">Fecha</p>
                        <p className="font-semibold text-slate-900">
                          {new Date(selectedAppointment.date).toLocaleDateString('es-ES', { 
                            weekday: 'long', 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-slate-50 rounded-lg p-4">
                    <div className="flex items-center space-x-3">
                      <FiClock className="text-slate-500" size={18} />
                      <div>
                        <p className="text-sm text-slate-600">Hora</p>
                        <p className="font-semibold text-slate-900">{selectedAppointment.time}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {selectedAppointment.location && (
                  <div className="bg-slate-50 rounded-lg p-4">
                    <div className="flex items-center space-x-3">
                      <FiMapPin className="text-slate-500" size={18} />
                      <div>
                        <p className="text-sm text-slate-600">Ubicación</p>
                        <p className="font-semibold text-slate-900">{selectedAppointment.location}</p>
                      </div>
                    </div>
                  </div>
                )}

                {selectedAppointment.observations && (
                  <div>
                    <p className="text-sm font-medium text-slate-700 mb-2">Observaciones:</p>
                    <p className="text-slate-600 bg-slate-50 p-4 rounded-lg border border-slate-200">
                      {selectedAppointment.observations}
                    </p>
                  </div>
                )}

                <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200">
                  <button
                    onClick={() => setSelectedAppointment(null)}
                    className="px-6 py-3 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors font-medium"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default WeeklyCalendar;