'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiCalendar, FiList, FiArrowLeft, FiArrowRight, FiEye, FiSearch, FiInbox, FiHeart, FiUserPlus, FiZap } from 'react-icons/fi';

// --- Interfaces ---
interface Appointment {
  id: string; // Agregado para que coincida con el uso
  patientId: string;
  patientName: string;
  date: string;
  time: string;
  type: 'consultation' | 'therapy';
  status?: string;
}

// --- Helper Function ---
const toLocalDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// --- Sub-componente para la Vista de Calendario (Mejorado) ---
const CalendarView = ({ appointments, onSelectAppointment }: { appointments: Appointment[]; onSelectAppointment: (appt: Appointment) => void; }) => {
    const today = new Date();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);

    const daysOfWeek = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

    const getDaysInMonth = (date: Date) => {
      const year = date.getFullYear();
      const month = date.getMonth();
      return Array.from({ length: new Date(year, month + 1, 0).getDate() }, (_, i) => new Date(year, month, i + 1));
    };

    const firstDayOfMonth = getDaysInMonth(currentDate)[0].getDay();
    const days = getDaysInMonth(currentDate);

    const goToPreviousMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
    const goToNextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
    
    const handleDayClick = (day: Date) => {
        setSelectedDate(prevDate => prevDate && prevDate.getTime() === day.getTime() ? null : day);
    };

    const selectedDayAppointments = useMemo(() => {
        if (!selectedDate) return [];
        const formattedDate = toLocalDateString(selectedDate);
        return appointments.filter(appt => appt.date === formattedDate).sort((a,b) => a.time.localeCompare(b.time));
    }, [selectedDate, appointments]);

    return (
        <motion.div 
            className="bg-white p-6 rounded-2xl shadow-xl border border-slate-200/80"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
        >
            <div className="flex justify-between items-center mb-4">
                <button onClick={goToPreviousMonth} className="p-2 rounded-full hover:bg-slate-200"><FiArrowLeft /></button>
                <h3 className="text-xl font-bold">{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</h3>
                <button onClick={goToNextMonth} className="p-2 rounded-full hover:bg-slate-200"><FiArrowRight /></button>
            </div>
            <div className="grid grid-cols-7 gap-2 text-center text-sm font-semibold text-slate-500 mb-2">
                {daysOfWeek.map(day => <span key={day}>{day}</span>)}
            </div>
            <div className="grid grid-cols-7 gap-2">
                {Array.from({ length: firstDayOfMonth }).map((_, i) => <div key={`empty-${i}`} />)}
                {days.map(day => {
                    const formattedDate = toLocalDateString(day);
                    const dailyAppointments = appointments.filter(appt => appt.date === formattedDate);
                    const isSelectedForList = selectedDate?.toDateString() === day.toDateString();
                    const isToday = day.toDateString() === today.toDateString();

                    let dayStyle = 'border-slate-200 hover:bg-slate-50';
                    if (isToday) {
                      dayStyle = 'border-sky-400 bg-sky-50 hover:bg-sky-100';
                    }
                    if (isSelectedForList) {
                      dayStyle = 'bg-sky-100 border-sky-400 ring-2 ring-sky-500';
                    }

                    return (
                        <div key={day.toISOString()} onClick={() => handleDayClick(day)} className={`h-32 p-2 flex flex-col rounded-lg border-2 cursor-pointer transition-all ${dayStyle}`}>
                            <span className="font-bold">{day.getDate()}</span>
                            <div className="mt-1 flex flex-col text-left text-xs space-y-1 overflow-y-auto pr-1">
                                {dailyAppointments.sort((a, b) => a.time.localeCompare(b.time)).slice(0, 3).map(appt => (
                                    <div key={appt.id} className={`w-full p-1 rounded-md truncate ${appt.type === 'consultation' ? 'bg-emerald-100 text-emerald-800' : 'bg-purple-100 text-purple-800'}`}>
                                        <p className="font-semibold">{appt.patientName.split(' ')[0]}</p><p className="text-xs opacity-80">{appt.time}</p>
                                    </div>
                                ))}
                                {dailyAppointments.length > 3 && (
                                    <p className="text-center text-slate-500 font-semibold text-xs mt-1">+{dailyAppointments.length - 3} más...</p>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            <AnimatePresence>
                {selectedDate && (
                    <motion.div className="mt-6 pt-4 border-t border-slate-200" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                        <h4 className="font-bold text-slate-800 mb-2">Citas para el {selectedDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}</h4>
                        {selectedDayAppointments.length > 0 ? (
                             <ul className="space-y-2 max-h-40 overflow-y-auto pr-2">
                                {selectedDayAppointments.map(appt => (
                                    <li
                                        key={appt.id}
                                        onClick={() => onSelectAppointment(appt)}
                                        className="p-3 bg-slate-100 rounded-lg flex items-center justify-between cursor-pointer hover:bg-sky-100 hover:ring-2 hover:ring-sky-200 transition-all"
                                    >
                                        <div>
                                            <p className="font-semibold text-slate-700">{appt.patientName}</p>
                                            <p className="text-sm text-slate-500">{appt.time}</p>
                                        </div>
                                        <FiEye className="text-slate-400"/>
                                    </li>
                                ))}
                            </ul>
                        ) : (<p className="text-center text-slate-500 py-4">No hay citas para este día.</p>)}
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};


// --- Componente Principal de la Vista ---
interface AppointmentsViewProps {
  allAppointments: Appointment[];
  onSelectAppointment: (appointment: Appointment) => void;
  viewMode: 'all' | 'today';
  onShowAll: () => void;
  onShowToday: () => void;
}

const AppointmentsView: React.FC<AppointmentsViewProps> = ({ allAppointments, onSelectAppointment, viewMode, onShowAll, onShowToday }) => {
  const [isCalendarView, setIsCalendarView] = useState(viewMode === 'all');
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'upcoming' | 'today' | 'past' | 'all'>(viewMode === 'today' ? 'today' : 'upcoming');

  useEffect(() => {
    if (viewMode === 'today') {
      setIsCalendarView(false);
      setFilter('today');
    }
  }, [viewMode]);

  const displayedAppointments = useMemo(() => {
    const todayStr = toLocalDateString(new Date());
    let filtered = allAppointments;

    switch (filter) {
        case 'upcoming': filtered = allAppointments.filter(appt => appt.date >= todayStr && appt.status !== 'completed'); break;
        case 'today': filtered = allAppointments.filter(appt => appt.date === todayStr); break;
        case 'past': filtered = allAppointments.filter(appt => appt.date < todayStr); break;
        default: break;
    }

    if (searchTerm) {
      const lowerCaseSearch = searchTerm.toLowerCase();
      filtered = filtered.filter(appt => appt.patientName.toLowerCase().includes(lowerCaseSearch));
    }

    return filtered;
  }, [allAppointments, filter, searchTerm]);
  
  const sortedAppointments = [...displayedAppointments].sort((a, b) => {
    if (filter === 'upcoming' || filter === 'today') {
        return a.date.localeCompare(b.date) || a.time.localeCompare(b.time);
    }
    return b.date.localeCompare(b.date) || b.time.localeCompare(b.time);
  });

  const FilterButton = ({ activeFilter, value, children }: { activeFilter: string, value: string, children: React.ReactNode }) => (
    <button onClick={() => setFilter(value as any)} className={`px-4 py-2 text-sm font-semibold rounded-full transition-colors ${activeFilter === value ? 'bg-sky-600 text-white shadow-md' : 'bg-white text-slate-600 hover:bg-slate-100'}`}>{children}</button>
  );

  const EmptyState = () => (
    <div className="text-center py-16"><FiInbox className="mx-auto text-5xl text-slate-300" /><h3 className="mt-4 text-xl font-semibold text-slate-700">No hay citas que mostrar</h3><p className="mt-1 text-slate-500">No se encontraron citas que coincidan con los filtros actuales.</p></div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <h2 className="text-3xl font-bold text-slate-900">Mis Citas</h2>
        <div className="flex items-center space-x-2 p-1 bg-slate-200 rounded-full">
            <button onClick={() => setIsCalendarView(true)} className={`p-2 rounded-full transition-colors ${isCalendarView ? 'bg-white shadow text-sky-600' : 'text-slate-600'}`} title="Vista de Calendario"><FiCalendar size={20} /></button>
            <button onClick={() => setIsCalendarView(false)} className={`p-2 rounded-full transition-colors ${!isCalendarView ? 'bg-white shadow text-sky-600' : 'text-slate-600'}`} title="Vista de Lista"><FiList size={20} /></button>
        </div>
      </div>
      
      {isCalendarView ? (
        <CalendarView appointments={allAppointments} onSelectAppointment={onSelectAppointment} />
      ) : (
        <motion.div className="bg-white p-6 rounded-2xl shadow-xl border border-slate-200/80 space-y-4" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
             <div className="flex flex-col md:flex-row justify-between gap-4">
                <div className="relative"><input type="text" placeholder="Buscar por nombre..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 pr-4 py-2 w-full md:w-80 rounded-full bg-slate-100 border-2 border-transparent focus:border-sky-500 focus:ring-0 transition" /><FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" /></div>
                <div className="flex items-center space-x-2 bg-slate-100 p-1 rounded-full">
                    <FilterButton activeFilter={filter} value="upcoming">Próximas</FilterButton>
                    <FilterButton activeFilter={filter} value="today">Hoy</FilterButton>
                    <FilterButton activeFilter={filter} value="past">Pasadas</FilterButton>
                    <FilterButton activeFilter={filter} value="all">Todas</FilterButton>
                </div>
             </div>
            <div className="max-h-[60vh] overflow-y-auto pr-2 -mr-2">
                {sortedAppointments.length > 0 ? (
                    <ul className="space-y-3 pt-2">
                        <AnimatePresence>
                        {sortedAppointments.map(appt => (
                            <motion.li
                                layout
                                key={appt.id} 
                                onClick={() => onSelectAppointment(appt)}
                                className="p-4 bg-white rounded-lg shadow-md border border-slate-200/80 flex items-center justify-between space-x-4 cursor-pointer hover:shadow-xl hover:border-sky-300 transition-all"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                            >
                                <div className="flex items-center space-x-4">
                                    <div className={`p-3 rounded-full ${appt.type === 'consultation' ? 'bg-emerald-100 text-emerald-600' : 'bg-purple-100 text-purple-600'}`}>{appt.type === 'consultation' ? <FiUserPlus size={20}/> : <FiHeart size={20}/>}</div>
                                    <div className="flex-1 min-w-0"><p className="font-semibold text-slate-800 truncate">{appt.patientName}</p><p className="text-sm text-slate-500">{appt.date} a las {appt.time}</p></div>
                                </div>
                                <div className="flex items-center space-x-4">
                                    <span className={`text-xs font-semibold px-3 py-1 rounded-full capitalize ${appt.status === 'completed' ? 'bg-emerald-100 text-emerald-800' : appt.status === 'cancelled' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>{appt.status || 'Programada'}</span>
                                    <FiEye className="text-slate-400" size={20} />
                                </div>
                            </motion.li>
                        ))}
                        </AnimatePresence>
                    </ul>
                ) : <EmptyState />}
            </div>
        </motion.div>
      )}
    </div>
  );
};

export default AppointmentsView;
