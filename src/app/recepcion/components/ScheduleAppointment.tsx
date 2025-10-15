'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiArrowLeft, FiCalendar, FiChevronLeft, FiChevronRight, FiX } from 'react-icons/fi';
import { collection, onSnapshot, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// --- Helper Function ---
// Esta función convierte una fecha a YYYY-MM-DD en la zona horaria local,
// evitando los problemas de conversión a UTC.
const toLocalDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
// -----------------------

interface ScheduleAppointmentProps {
  patient: any;
  onBack: () => void;
  doctors: any[];
  therapists: any[];
}

const ScheduleAppointment: React.FC<ScheduleAppointmentProps> = ({ patient, onBack, doctors, therapists }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showModal, setShowModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState('');
  const [message, setMessage] = useState('');
  const [appointmentType, setAppointmentType] = useState('consultation');
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [selectedTherapistId, setSelectedTherapistId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [appointments, setAppointments] = useState<any[]>([]);

  const daysOfWeek = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  useEffect(() => {
    const q = collection(db, 'appointments');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAppointments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (patient.therapistId) {
      setSelectedTherapistId(patient.therapistId);
    }
  }, [patient.therapistId]);

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return Array.from({ length: new Date(year, month + 1, 0).getDate() }, (_, i) => new Date(year, month, i + 1));
  };

  const days = getDaysInMonth(currentDate);
  const firstDay = days[0].getDay();

  const handleDayClick = (day: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (day < today) return;
    setSelectedDate(day);
    setSelectedTime('');
    setShowModal(true);
  };

  const handleSchedule = async () => {
    const isConsultation = appointmentType === 'consultation';
    const professionalSelected = isConsultation ? selectedDoctorId : selectedTherapistId;
    if (!selectedDate || !selectedTime || !professionalSelected) {
      setMessage('Por favor, selecciona fecha, hora y profesional.');
      return;
    }

    setIsLoading(true);
    setMessage('');

    try {
      // *** CORRECCIÓN CLAVE ***
      // Usamos nuestra nueva función para asegurar el formato correcto.
      const formattedDate = toLocalDateString(selectedDate);
      
      let appointmentData: any = {
        patientId: patient.id,
        patientName: patient.name,
        type: appointmentType,
        date: formattedDate, // Se guarda la fecha corregida
        time: selectedTime,
        status: 'scheduled'
      };

      if (isConsultation) {
        const selectedDoctor = doctors.find(d => d.id === selectedDoctorId);
        appointmentData.doctorId = selectedDoctor.id;
        appointmentData.doctorName = selectedDoctor.name;
      } else {
        const selectedTherapist = therapists.find(t => t.id === selectedTherapistId);
        appointmentData.therapistId = selectedTherapist.id;
        appointmentData.therapistName = selectedTherapist.name;
      }

      await addDoc(collection(db, 'appointments'), appointmentData);

      setMessage('¡Cita programada con éxito!');
      setTimeout(() => {
        setShowModal(false);
        onBack();
      }, 2000);

    } catch (error) {
      console.error("Error al guardar la cita:", error);
      setMessage('Ocurrió un error al programar la cita. Revisa la consola para más detalles.');
    } finally {
      setIsLoading(false);
    }
  };

  const timeOptions = useMemo(() => {
    const startHour = appointmentType === 'consultation' ? 8 : 6;
    const endHour = appointmentType === 'consultation' ? 16 : 18;
    
    if (appointmentType === 'consultation') {
      const selectedDoctor = doctors.find(d => d.id === selectedDoctorId);
      // Si no hay doctor seleccionado, no mostramos horarios.
      if (!selectedDoctor) return [];

      // Usamos la duración de la consulta del doctor, o 60 minutos por defecto.
      const duration = Number(selectedDoctor.consultationDuration) || 60;
      const options: string[] = [];

      // Generamos los horarios basados en la duración.
      let currentTime = new Date();
      currentTime.setHours(startHour, 0, 0, 0);

      while (currentTime.getHours() <= endHour) {
        // Si la hora actual supera la hora de fin, paramos.
        if (currentTime.getHours() === endHour && currentTime.getMinutes() > 0) break;
        
        options.push(currentTime.toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit', hour12: false }));
        currentTime.setMinutes(currentTime.getMinutes() + duration);
      }
      return options;
    }

    // Lógica para terapias
    if (appointmentType === 'therapy') {
      // Si no hay terapeuta seleccionado, no mostramos horarios.
      if (!selectedTherapistId) return [];

      // Lógica original para terapias (slots de 1 hora).
      return Array.from({ length: endHour - startHour + 1 }, (_, i) => {
        const hour = startHour + i;
        return `${String(hour).padStart(2, '0')}:00`;
      });
    }

    return [];
  }, [appointmentType, selectedDoctorId, doctors, selectedTherapistId]); // Se añaden dependencias

  const { bookedTimes, appointmentCounts } = useMemo(() => {
    if (!selectedDate || (appointmentType === 'consultation' && !selectedDoctorId) || (appointmentType === 'therapy' && !selectedTherapistId)) {
      return { bookedTimes: [], appointmentCounts: {} as Record<string, number> };
    }
    const formattedDay = toLocalDateString(selectedDate);
    const professionalId = appointmentType === 'consultation' ? selectedDoctorId : selectedTherapistId;
    const professionalIdKey = appointmentType === 'consultation' ? 'doctorId' : 'therapistId';

    const counts: Record<string, number> = {};
    appointments
      .filter(appt => appt.date === formattedDay && appt[professionalIdKey] === professionalId && appt.status !== 'cancelled')
      .forEach(appt => {
        counts[appt.time] = (counts[appt.time] || 0) + 1;
      });

    const maxAppointments = appointmentType === 'therapy' ? 2 : 1;
    const fullyBooked = Object.keys(counts).filter(time => counts[time] >= maxAppointments);
    return { bookedTimes: fullyBooked, appointmentCounts: counts };
  }, [selectedDate, selectedDoctorId, selectedTherapistId, appointmentType, appointments]);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex items-center space-x-4 mb-6">
        <button onClick={onBack} className="p-2 rounded-full hover:bg-slate-200 transition-colors"><FiArrowLeft size={24} /></button>
        <h2 className="text-3xl font-bold text-slate-900">Programar Cita para {patient.name}</h2>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-lg space-y-4">
        <div className="flex justify-between items-center mb-4">
          <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))} className="p-2 rounded-full hover:bg-slate-200"><FiChevronLeft size={24} /></button>
          <h3 className="text-2xl font-semibold text-slate-900">{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</h3>
          <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))} className="p-2 rounded-full hover:bg-slate-200"><FiChevronRight size={24} /></button>
        </div>
        
        <div className="grid grid-cols-7 text-center font-bold text-slate-600">{daysOfWeek.map(day => <span key={day} className="py-2">{day}</span>)}</div>
        
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} className="h-16"></div>)}
          {days.map((day) => {
            const isToday = day.toDateString() === new Date().toDateString();
            const isPast = day < new Date(new Date().setHours(0,0,0,0));
            return (
              <motion.div key={day.toISOString()} onClick={() => !isPast && handleDayClick(day)} className={`h-16 w-full flex items-center justify-center rounded-lg cursor-pointer transition-colors ${isPast ? 'text-slate-400 cursor-not-allowed' : isToday ? 'bg-sky-200 hover:bg-sky-300' : 'hover:bg-slate-100'}`}>
                <span className="font-semibold text-lg">{day.getDate()}</span>
              </motion.div>
            );
          })}
        </div>
      </div>
      
      <AnimatePresence>
        {showModal && selectedDate && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-lg space-y-6" initial={{ scale: 0.9, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 30 }}>
              <div className="flex justify-between items-center">
                <h3 className="text-2xl font-bold text-slate-900">Agendar para {selectedDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}</h3>
                <button onClick={() => setShowModal(false)} className="p-2 rounded-full hover:bg-slate-200"><FiX size={24}/></button>
              </div>
              <div className="flex justify-center space-x-2 bg-slate-100 p-1 rounded-full">
                <button onClick={() => setAppointmentType('consultation')} className={`px-4 py-2 text-base w-full rounded-full font-semibold ${appointmentType === 'consultation' ? 'bg-white shadow text-sky-700' : 'text-slate-600'}`}>
                  Consulta
                </button>
                <button onClick={() => setAppointmentType('therapy')} className={`px-4 py-2 text-base w-full rounded-full font-semibold ${appointmentType === 'therapy' ? 'bg-white shadow text-sky-700' : 'text-slate-600'}`}>Terapia</button>
              </div>
              
              {appointmentType === 'consultation' ? (
                <div><label htmlFor="doctor-select" className="block text-sm font-medium text-slate-700">Doctor/a</label><select id="doctor-select" value={selectedDoctorId} onChange={(e) => setSelectedDoctorId(e.target.value)} className="w-full mt-1 p-3 rounded-lg bg-slate-50 border-2 border-slate-200"><option value="" disabled>-- Elige un doctor/a --</option>{doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
              ) : patient.therapistId ? (
                <div>
                  <label htmlFor="therapist-select" className="block text-sm font-medium text-slate-700">Terapeuta Asignado</label>
                  <select 
                    id="therapist-select" 
                    value={selectedTherapistId} 
                    disabled 
                    className="w-full mt-1 p-3 rounded-lg bg-slate-100 border-2 border-slate-200 cursor-not-allowed"
                  >
                    <option value={patient.therapistId}>
                      {therapists.find(t => t.id === patient.therapistId)?.name || 'Terapeuta asignado'}
                    </option>
                  </select>
                </div>
              ) : (
                <div><label htmlFor="therapist-select" className="block text-sm font-medium text-slate-700">Terapeuta</label><select id="therapist-select" value={selectedTherapistId} onChange={(e) => setSelectedTherapistId(e.target.value)} className="w-full mt-1 p-3 rounded-lg bg-slate-50 border-2 border-slate-200"><option value="" disabled>-- Elige un terapeuta --</option>{therapists.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
              )}

              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 max-h-48 overflow-y-auto pr-2">
                {timeOptions.length > 0 ? (
                  timeOptions.map(time => {
                    const maxAppointments = appointmentType === 'therapy' ? 2 : 1;
                    const currentCount = appointmentCounts[time] || 0;
                    
                    const now = new Date();
                    const isToday = selectedDate.toDateString() === now.toDateString();
                    let isPastTime = false;
                    let isTooClose = false;

                    if (isToday) {
                      const [hour, minute] = time.split(':').map(Number);
                      const slotTime = new Date(selectedDate);
                      slotTime.setHours(hour, minute, 0, 0);

                      // Si la hora del slot ya pasó
                      if (slotTime < now) {
                        isPastTime = true;
                      } else {
                        // Si faltan menos de 30 minutos para la hora del slot
                        const diffInMinutes = (slotTime.getTime() - now.getTime()) / 1000 / 60;
                        if (diffInMinutes < 30) isTooClose = true;
                      }
                    }

                    const isDisabled = currentCount >= maxAppointments || isPastTime || isTooClose;
                    return <button key={time} onClick={() => !isDisabled && setSelectedTime(time)} disabled={isDisabled} className={`p-2 rounded-lg border-2 font-semibold text-sm ${isDisabled ? 'bg-slate-100 text-slate-400 cursor-not-allowed line-through' : selectedTime === time ? 'bg-sky-600 text-white border-sky-600' : 'bg-white hover:bg-sky-50 border-slate-300'}`}>{time}{appointmentType === 'therapy' && ` (${currentCount}/${maxAppointments})`}</button>;
                  })
                ) : (
                  <div className="col-span-full text-center py-4 text-slate-500 bg-slate-50 rounded-lg">
                    <p>Por favor, selecciona un profesional para ver los horarios disponibles.</p>
                  </div>
                )}
              </div>

              <div className="space-y-4 pt-4 border-t">
                <button onClick={handleSchedule} disabled={isLoading || !selectedTime || (appointmentType === 'consultation' && !selectedDoctorId) || (appointmentType === 'therapy' && !selectedTherapistId)} className="w-full flex items-center justify-center space-x-2 py-3 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-lg shadow-md disabled:opacity-50">
                  <span>{isLoading ? 'Programando...' : 'Confirmar Cita'}</span>
                  <FiCalendar/>
                  </button>
              </div>
              {message && <p className={`mt-4 p-3 rounded-lg text-center text-sm ${message.startsWith('¡') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{message}</p>}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default ScheduleAppointment;
