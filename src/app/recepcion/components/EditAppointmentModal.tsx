'use client';

import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { FiEdit, FiX } from 'react-icons/fi';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface EditAppointmentModalProps {
  appointment: any;
  onClose: () => void;
  doctors: any[];
  therapists: any[];
  appointments: any[];
}

const EditAppointmentModal: React.FC<EditAppointmentModalProps> = ({ appointment, onClose, doctors, therapists, appointments }) => {
  // --- ESTADOS ---
  const [newDate, setNewDate] = useState(appointment.date);
  const [newTime, setNewTime] = useState(appointment.time);
  const [selectedProfessionalId, setSelectedProfessionalId] = useState(
    appointment.type === 'consultation' ? appointment.doctorId : appointment.therapistId
  );
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  const isCompleted = appointment.status === 'completed' || appointment.status === 'no-show' || appointment.status === 'cancelled';

  // --- LÓGICA DE VALIDACIÓN Y GENERACIÓN DE OPCIONES ---

  // Obtiene la fecha de hoy en formato YYYY-MM-DD para deshabilitar fechas pasadas
  const todayString = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Genera las opciones de hora, filtrando las horas pasadas si la fecha es hoy
  const timeOptions = useMemo(() => {
    if (!newDate) return []; // No mostrar horas si no hay fecha

    const startHour = appointment.type === 'consultation' ? 8 : 6;
    const endHour = appointment.type === 'consultation' ? 16 : 18;
    const allTimes = Array.from({ length: endHour - startHour + 1 }, (_, i) => {
        const hour = startHour + i;
        return `${hour < 10 ? '0' + hour : hour}:00`;
    });

    // Si la fecha seleccionada no es hoy, devuelve todas las horas
    if (newDate > todayString) {
        return allTimes;
    }

    // Si la fecha es hoy, filtra las horas que ya pasaron
    if (newDate === todayString) {
        const currentHour = new Date().getHours();
        return allTimes.filter(time => {
            const timeHour = parseInt(time.split(':')[0]);
            return timeHour > currentHour;
        });
    }

    return []; // Para fechas pasadas (aunque el input lo previene)
  }, [newDate, appointment.type, todayString]);

  // Verifica las horas ya reservadas para el profesional y fecha seleccionados
  const bookedTimes = useMemo(() => {
    if (!newDate || !selectedProfessionalId) return {};
    const professionalIdKey = appointment.type === 'consultation' ? 'doctorId' : 'therapistId';
    const counts: Record<string, number> = {};
    appointments
      .filter(appt => 
        appt.id !== appointment.id && 
        appt.date === newDate && 
        appt[professionalIdKey] === selectedProfessionalId && 
        appt.status !== 'cancelled'
      )
      .forEach(appt => { counts[appt.time] = (counts[appt.time] || 0) + 1; });
    return counts;
  }, [newDate, selectedProfessionalId, appointment.id, appointment.type, appointments]);
  
  // --- MANEJADORES DE EVENTOS ---

  const handleProfessionalChange = (id: string) => {
    setSelectedProfessionalId(id);
    // Reinicia la fecha y hora para forzar una nueva selección válida
    setNewDate('');
    setNewTime('');
  };

  const handleDateChange = (date: string) => {
    setNewDate(date);
    // Reinicia la hora al cambiar la fecha
    setNewTime('');
  };

  const handleSave = async () => {
    if (!newDate || !newTime || !selectedProfessionalId) {
      setMessage("Debe seleccionar un profesional, una fecha y una hora válidos.");
      return;
    }
    setIsLoading(true);
    try {
      const apptRef = doc(db, 'appointments', appointment.id);
      const dataToUpdate: any = { date: newDate, time: newTime };

      if (appointment.type === 'consultation') {
        const selectedDoctor = doctors.find(d => d.id === selectedProfessionalId);
        dataToUpdate.doctorId = selectedProfessionalId;
        dataToUpdate.doctorName = selectedDoctor?.name;
      } else {
        const selectedTherapist = therapists.find(t => t.id === selectedProfessionalId);
        dataToUpdate.therapistId = selectedProfessionalId;
        dataToUpdate.therapistName = selectedTherapist?.name;
      }

      await updateDoc(apptRef, dataToUpdate);
      setMessage("¡Cita actualizada con éxito!");
      setTimeout(onClose, 2000);
    } catch (error) {
      console.error("Error al actualizar la cita:", error);
      setMessage("Error al actualizar la cita.");
    } finally {
      setIsLoading(false);
    }
  };

  // --- RENDERIZADO DEL MODAL ---
  return (
    <motion.div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      <motion.div 
        className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-lg space-y-6" 
        initial={{ scale: 0.9, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 30 }}
      >
        <div className="flex justify-between items-center">
            <h3 className="text-2xl font-bold text-slate-900">{isCompleted ? 'Detalles de Cita' : 'Editar Cita'} de {appointment.patientName}</h3>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-200"><FiX size={24}/></button>
        </div>
        
        {/* --- FORMULARIO CON FLUJO GUIADO --- */}
        <div className="space-y-4">
            {/* 1. SELECCIÓN DE PROFESIONAL */}
            <div>
              <label htmlFor="professional-select-edit" className="block text-sm font-medium text-slate-700">
                {appointment.type === 'consultation' ? 'Doctor/a' : 'Terapeuta'}
              </label>
              <select 
                id="professional-select-edit" 
                value={selectedProfessionalId} 
                onChange={(e) => handleProfessionalChange(e.target.value)} 
                disabled={isCompleted} 
                className="mt-1 block w-full p-3 rounded-lg bg-sky-50 border-2 border-slate-200 disabled:bg-slate-100 disabled:cursor-not-allowed"
              >
                {appointment.type === 'consultation' 
                  ? doctors.map(doctor => <option key={doctor.id} value={doctor.id}>{doctor.name}</option>)
                  : therapists.map(therapist => <option key={therapist.id} value={therapist.id}>{therapist.name}</option>)
                }
              </select>
            </div>

            {/* 2. SELECCIÓN DE FECHA */}
            <div>
              <label htmlFor="edit-date" className="block text-sm font-medium text-slate-700">Fecha</label>
              <input
                type="date"
                id="edit-date"
                value={newDate}
                min={todayString} // Impide seleccionar fechas anteriores
                onChange={(e) => handleDateChange(e.target.value)}
                disabled={isCompleted || !selectedProfessionalId} // Deshabilitado si no hay profesional
                className="mt-1 block w-full p-3 rounded-lg bg-sky-50 border-2 border-slate-200 disabled:bg-slate-100 disabled:cursor-not-allowed"
              />
            </div>

            {/* 3. SELECCIÓN DE HORA */}
            <div>
              <label className="block text-sm font-medium text-slate-700">Hora</label>
              <select
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)} 
                disabled={isCompleted || !newDate} // Deshabilitado si no hay fecha
                className="mt-1 block w-full p-3 rounded-lg bg-slate-50 border-2 border-slate-200 disabled:bg-slate-100 disabled:cursor-not-allowed"
              >
                <option value="" disabled>{!newDate ? 'Seleccione una fecha primero' : 'Seleccione una hora'}</option>
                {timeOptions.map(time => {
                    const maxAppointments = appointment.type === 'therapy' ? 2 : 1;
                    const currentCount = bookedTimes[time] || 0;
                    const isBooked = currentCount >= maxAppointments;
                    let label = `${time}`;
                    if (appointment.type === 'therapy') {
                        label += ` (${maxAppointments - currentCount} disponible/s)`;
                    }
                    if(isBooked) label = `${time} (Ocupado)`;
                    
                    return <option key={time} value={time} disabled={isBooked}>{label}</option>
                })}
              </select>
            </div>
        </div>

        {/* --- BOTONES DE ACCIÓN --- */}
        <div className="space-y-4 pt-4 border-t">
          {!isCompleted && (
            <button onClick={handleSave} disabled={isLoading || !newTime} className="w-full flex items-center justify-center space-x-2 py-3 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-lg shadow-md disabled:opacity-50">{isLoading ? 'Guardando...' : 'Guardar Cambios'}<FiEdit /></button>
          )}
          <button 
            onClick={onClose} 
            className={`w-full py-3 font-semibold rounded-lg transition-colors ${isCompleted ? 'bg-sky-600 text-white hover:bg-sky-700' : 'bg-slate-200 text-slate-800 hover:bg-slate-300'}`}
          >
            {isCompleted ? 'Cerrar' : 'Cancelar'}
          </button>
        </div>
        {message && <p className={`mt-4 p-3 rounded-lg text-center text-sm ${message.includes('Error') || message.includes('Debe') ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>{message}</p>}
      </motion.div>
    </motion.div>
  );
};

export default EditAppointmentModal;

