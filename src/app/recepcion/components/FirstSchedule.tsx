'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiArrowLeft, FiCalendar, FiChevronLeft, FiChevronRight, FiX, FiClock, FiCheckCircle } from 'react-icons/fi';
import { collection, onSnapshot, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// --- Helper Function ---
const toLocalDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

interface FirstScheduleProps {
  patient: any;
  onBack: () => void;
  doctors: any[];
  therapists: any[];
}

const FirstSchedule: React.FC<FirstScheduleProps> = ({ patient, onBack, doctors, therapists }) => {
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
  
  // Nuevos estados para manejar ambas citas
  const [completedConsultation, setCompletedConsultation] = useState(false);
  const [completedTherapy, setCompletedTherapy] = useState(false);
  const [consultationData, setConsultationData] = useState<any>(null);
  const [therapyData, setTherapyData] = useState<any>(null);

  const daysOfWeek = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  useEffect(() => {
    const q = collection(db, 'appointments');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAppointments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

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
      const formattedDate = toLocalDateString(selectedDate);
      
      let appointmentData: any = {
        patientId: patient.id,
        patientName: patient.name,
        type: appointmentType,
        date: formattedDate,
        time: selectedTime,
        status: 'scheduled',
        createdAt: new Date()
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

      const docRef = await addDoc(collection(db, 'appointments'), appointmentData);
      
      // Guardar los datos de la cita creada
      if (isConsultation) {
        setConsultationData({ ...appointmentData, id: docRef.id });
        setCompletedConsultation(true);
        setMessage('✅ Consulta programada con éxito. Ahora programa la terapia.');
        
        // Cambiar automáticamente a terapia después de agendar consulta
        setTimeout(() => {
          setAppointmentType('therapy');
          setSelectedTime('');
          setSelectedTherapistId('');
        }, 1500);
      } else {
        setTherapyData({ ...appointmentData, id: docRef.id });
        setCompletedTherapy(true);
        setMessage('✅ Terapia programada con éxito. Ambas citas han sido agendadas.');
        
        // Cerrar modal automáticamente después de 2 segundos
        setTimeout(() => {
          setShowModal(false);
          onBack();
        }, 2000);
      }

    } catch (error) {
      console.error("Error al guardar la cita:", error);
      setMessage('❌ Ocurrió un error al programar la cita.');
    } finally {
      setIsLoading(false);
    }
  };

  const timeOptions = useMemo(() => {
    const startHour = appointmentType === 'consultation' ? 8 : 6;
    const endHour = appointmentType === 'consultation' ? 16 : 18;
    
    if (appointmentType === 'consultation') {
      const selectedDoctor = doctors.find(d => d.id === selectedDoctorId);
      if (!selectedDoctor) return [];

      const duration = Number(selectedDoctor.consultationDuration) || 60;
      const options: string[] = [];

      let currentTime = new Date();
      currentTime.setHours(startHour, 0, 0, 0);

      while (currentTime.getHours() <= endHour) {
        if (currentTime.getHours() === endHour && currentTime.getMinutes() > 0) break;
        
        options.push(currentTime.toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit', hour12: false }));
        currentTime.setMinutes(currentTime.getMinutes() + duration);
      }
      return options;
    }

    if (appointmentType === 'therapy') {
      if (!selectedTherapistId) return [];

      return Array.from({ length: endHour - startHour + 1 }, (_, i) => {
        const hour = startHour + i;
        return `${String(hour).padStart(2, '0')}:00`;
      });
    }

    return [];
  }, [appointmentType, selectedDoctorId, doctors, selectedTherapistId]);

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

  // Función para resetear el modal cuando se cierra
  const handleCloseModal = () => {
    if (!completedConsultation || !completedTherapy) {
      setMessage('⚠️ Debes completar ambas citas (consulta y terapia) antes de cerrar.');
      return;
    }
    setShowModal(false);
    setCompletedConsultation(false);
    setCompletedTherapy(false);
    setConsultationData(null);
    setTherapyData(null);
    setAppointmentType('consultation');
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex items-center space-x-4 mb-6">
        <button onClick={onBack} className="p-2 rounded-full hover:bg-slate-200 transition-colors">
          <FiArrowLeft size={24} />
        </button>
        <h2 className="text-3xl font-bold text-slate-900">Primera Programación - {patient.name}</h2>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-lg space-y-4">
        <div className="flex justify-between items-center mb-4">
          <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))} className="p-2 rounded-full hover:bg-slate-200">
            <FiChevronLeft size={24} />
          </button>
          <h3 className="text-2xl font-semibold text-slate-900">{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</h3>
          <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))} className="p-2 rounded-full hover:bg-slate-200">
            <FiChevronRight size={24} />
          </button>
        </div>
        
        <div className="grid grid-cols-7 text-center font-bold text-slate-600">
          {daysOfWeek.map(day => <span key={day} className="py-2">{day}</span>)}
        </div>
        
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} className="h-16"></div>)}
          {days.map((day) => {
            const isToday = day.toDateString() === new Date().toDateString();
            const isPast = day < new Date(new Date().setHours(0,0,0,0));
            return (
              <motion.div 
                key={day.toISOString()} 
                onClick={() => !isPast && handleDayClick(day)} 
                className={`h-16 w-full flex items-center justify-center rounded-lg cursor-pointer transition-colors ${
                  isPast ? 'text-slate-400 cursor-not-allowed' : 
                  isToday ? 'bg-sky-200 hover:bg-sky-300' : 
                  'hover:bg-slate-100'
                }`}
              >
                <span className="font-semibold text-lg">{day.getDate()}</span>
              </motion.div>
            );
          })}
        </div>
      </div>
      
      <AnimatePresence>
        {showModal && selectedDate && (
          <motion.div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
          >
            <motion.div 
              className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-lg space-y-6" 
              initial={{ scale: 0.9, y: 30 }} 
              animate={{ scale: 1, y: 0 }} 
              exit={{ scale: 0.9, y: 30 }}
            >
              <div className="flex justify-between items-center">
                <h3 className="text-2xl font-bold text-slate-900">
                  Primera Programación - {selectedDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}
                </h3>
                <button 
                  onClick={handleCloseModal} 
                  disabled={!completedConsultation || !completedTherapy}
                  className={`p-2 rounded-full transition-colors ${
                    (!completedConsultation || !completedTherapy) 
                      ? 'text-slate-400 cursor-not-allowed' 
                      : 'hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  <FiX size={24}/>
                </button>
              </div>

              {/* Indicador de progreso */}
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-slate-700">Progreso de programación:</span>
                  <span className="text-sm font-bold text-sky-600">
                    {completedConsultation && completedTherapy ? '2/2 Completado' : 
                     completedConsultation ? '1/2 Completado' : '0/2 Completado'}
                  </span>
                </div>
                <div className="flex space-x-2">
                  <div className={`flex-1 p-3 rounded-lg text-center ${
                    completedConsultation ? 'bg-green-100 text-green-800 border border-green-300' : 'bg-slate-100 text-slate-600'
                  }`}>
                    <div className="flex items-center justify-center space-x-2">
                      {completedConsultation ? <FiCheckCircle className="text-green-600" /> : <FiClock className="text-slate-400" />}
                      <span className="text-sm font-medium">Consulta</span>
                    </div>
                  </div>
                  <div className={`flex-1 p-3 rounded-lg text-center ${
                    completedTherapy ? 'bg-green-100 text-green-800 border border-green-300' : 'bg-slate-100 text-slate-600'
                  }`}>
                    <div className="flex items-center justify-center space-x-2">
                      {completedTherapy ? <FiCheckCircle className="text-green-600" /> : <FiClock className="text-slate-400" />}
                      <span className="text-sm font-medium">Terapia</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Mostrar información de citas ya programadas */}
              {completedConsultation && consultationData && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center space-x-2 text-green-800 mb-2">
                    <FiCheckCircle className="text-green-600" />
                    <span className="font-semibold">Consulta Programada</span>
                  </div>
                  <p className="text-sm text-green-700">
                    📅 {consultationData.date} a las {consultationData.time} con Dr. {consultationData.doctorName}
                  </p>
                </div>
              )}

              {completedTherapy && therapyData && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center space-x-2 text-green-800 mb-2">
                    <FiCheckCircle className="text-green-600" />
                    <span className="font-semibold">Terapia Programada</span>
                  </div>
                  <p className="text-sm text-green-700">
                    📅 {therapyData.date} a las {therapyData.time} con {therapyData.therapistName}
                  </p>
                </div>
              )}

              {/* Selector de tipo de cita (solo mostrar si no está completado) */}
              {(!completedConsultation || !completedTherapy) && (
                <>
                  <div className="flex justify-center space-x-2 bg-slate-100 p-1 rounded-full">
                    <button 
                      onClick={() => !completedConsultation && setAppointmentType('consultation')} 
                      disabled={completedConsultation}
                      className={`px-4 py-2 text-base w-full rounded-full font-semibold transition-colors ${
                        appointmentType === 'consultation' 
                          ? 'bg-white shadow text-sky-700' 
                          : completedConsultation 
                            ? 'text-slate-400 cursor-not-allowed' 
                            : 'text-slate-600 hover:text-slate-800'
                      }`}
                    >
                      Consulta {completedConsultation && '✓'}
                    </button>
                    <button 
                      onClick={() => !completedTherapy && setAppointmentType('therapy')} 
                      disabled={completedTherapy || !completedConsultation}
                      className={`px-4 py-2 text-base w-full rounded-full font-semibold transition-colors ${
                        appointmentType === 'therapy' 
                          ? 'bg-white shadow text-sky-700' 
                          : completedTherapy || !completedConsultation
                            ? 'text-slate-400 cursor-not-allowed' 
                            : 'text-slate-600 hover:text-slate-800'
                      }`}
                    >
                      Terapia {completedTherapy && '✓'}
                    </button>
                  </div>
                  
                  {/* Selector de profesional */}
                  {appointmentType === 'consultation' && !completedConsultation ? (
                    <div>
                      <label htmlFor="doctor-select" className="block text-sm font-medium text-slate-700">Doctor/a</label>
                      <select 
                        id="doctor-select" 
                        value={selectedDoctorId} 
                        onChange={(e) => setSelectedDoctorId(e.target.value)} 
                        className="w-full mt-1 p-3 rounded-lg bg-slate-50 border-2 border-slate-200 focus:border-sky-500"
                      >
                        <option value="" disabled>-- Elige un doctor/a --</option>
                        {doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    </div>
                  ) : appointmentType === 'therapy' && !completedTherapy && (
                    <div>
                      <label htmlFor="therapist-select" className="block text-sm font-medium text-slate-700">Terapeuta</label>
                      <select 
                        id="therapist-select" 
                        value={selectedTherapistId} 
                        onChange={(e) => setSelectedTherapistId(e.target.value)} 
                        className="w-full mt-1 p-3 rounded-lg bg-slate-50 border-2 border-slate-200 focus:border-sky-500"
                      >
                        <option value="" disabled>-- Elige un terapeuta --</option>
                        {therapists.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </div>
                  )}

                  {/* Selector de horarios */}
                  {(!completedConsultation && appointmentType === 'consultation') || (!completedTherapy && appointmentType === 'therapy') ? (
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

                            if (slotTime < now) {
                              isPastTime = true;
                            } else {
                              const diffInMinutes = (slotTime.getTime() - now.getTime()) / 1000 / 60;
                              if (diffInMinutes < 30) isTooClose = true;
                            }
                          }

                          const isDisabled = currentCount >= maxAppointments || isPastTime || isTooClose;
                          return (
                            <button 
                              key={time} 
                              onClick={() => !isDisabled && setSelectedTime(time)} 
                              disabled={isDisabled}
                              className={`p-2 rounded-lg border-2 font-semibold text-sm transition-colors ${
                                isDisabled 
                                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed line-through' 
                                  : selectedTime === time 
                                    ? 'bg-sky-600 text-white border-sky-600' 
                                    : 'bg-white hover:bg-sky-50 border-slate-300'
                              }`}
                            >
                              {time}
                              {appointmentType === 'therapy' && ` (${currentCount}/${maxAppointments})`}
                            </button>
                          );
                        })
                      ) : (
                        <div className="col-span-full text-center py-4 text-slate-500 bg-slate-50 rounded-lg">
                          <p>Por favor, selecciona un profesional para ver los horarios disponibles.</p>
                        </div>
                      )}
                    </div>
                  ) : null}

                  {/* Botón de confirmación */}
                  <div className="space-y-4 pt-4 border-t">
                    <button 
                      onClick={handleSchedule} 
                      disabled={
                        isLoading || 
                        !selectedTime || 
                        (appointmentType === 'consultation' && !selectedDoctorId) || 
                        (appointmentType === 'therapy' && !selectedTherapistId) ||
                        (appointmentType === 'consultation' && completedConsultation) ||
                        (appointmentType === 'therapy' && completedTherapy)
                      } 
                      className="w-full flex items-center justify-center space-x-2 py-3 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-lg shadow-md disabled:opacity-50 transition-colors"
                    >
                      <span>
                        {isLoading 
                          ? 'Programando...' 
                          : appointmentType === 'consultation' 
                            ? 'Confirmar Consulta' 
                            : 'Confirmar Terapia'
                        }
                      </span>
                      <FiCalendar/>
                    </button>
                  </div>
                </>
              )}

              {message && (
                <p className={`mt-4 p-3 rounded-lg text-center text-sm ${
                  message.includes('✅') ? 'bg-green-100 text-green-800' : 
                  message.includes('❌') ? 'bg-red-100 text-red-800' : 
                  message.includes('⚠️') ? 'bg-yellow-100 text-yellow-800' : 
                  'bg-blue-100 text-blue-800'
                }`}>
                  {message}
                </p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default FirstSchedule;