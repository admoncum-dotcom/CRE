'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { FiEdit, FiX, FiCalendar, FiClock, FiUser } from 'react-icons/fi';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// Helper para formatear fechas a YYYY-MM-DD
const formatDate = (date: Date): string => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Helper para obtener la fecha de hoy en formato YYYY-MM-DD
const getTodayDate = (): string => {
  const today = new Date();
  return formatDate(today);
};

interface EditAppointmentModalProps {
  appointment: any;
  onClose: () => void;
  doctors: any[];
  therapists: any[];
  appointments: any[];
}

const EditAppointmentModal: React.FC<EditAppointmentModalProps> = ({ appointment, onClose, doctors, therapists, appointments }) => {
  const [newDate, setNewDate] = useState(appointment.date);
  const [newTime, setNewTime] = useState(appointment.time);
  const [selectedProfessionalId, setSelectedProfessionalId] = useState(
    appointment.type === 'consultation' ? appointment.doctorId : appointment.therapistId
  );
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Una cita no se puede editar si está completada, no presentada o cancelada.
  const isCompleted = appointment.status === 'completed' || appointment.status === 'no-show' || appointment.status === 'cancelled';

  // --- Lógica para calcular Horas Disponibles (Mantenida) ---
  const timeOptions = useMemo(() => {
    const startHour = appointment.type === 'consultation' ? 8 : 6;
    const endHour = appointment.type === 'consultation' ? 16 : 18;
    const interval = 60;

    const options: string[] = [];
    for (let hour = startHour; hour <= endHour; hour++) {
      for (let minute = 0; minute < 60; minute += interval) {
        options.push(`${hour < 10 ? '0' + hour : hour}:${minute < 10 ? '0' + minute : minute}`);
      }
    }
    return options;
  }, [appointment.type]);

  const getBookedTimes = useCallback((date: string, professionalId: string) => {
    if (!date || !professionalId) return {};

    const professionalKey = appointment.type === 'consultation' ? 'doctorId' : 'therapistId';
    const counts: Record<string, number> = {};

    appointments
      .filter(appt =>
        appt.id !== appointment.id &&
        appt.date === date &&
        appt[professionalKey] === professionalId &&
        appt.status !== 'cancelled' &&
        appt.status !== 'no-show'
      )
      .forEach(appt => {
        counts[appt.time] = (counts[appt.time] || 0) + 1;
      });
    return counts;
  }, [appointments, appointment.id, appointment.type]);

  const availableTimeSlots = useMemo(() => {
    const booked = getBookedTimes(newDate, selectedProfessionalId);
    const maxAppointmentsPerSlot = appointment.type === 'consultation' ? 1 : 2;

    return timeOptions.filter(time => {
      const currentBookings = booked[time] || 0;
      // Permitir la hora de la cita original incluso si está "llena", ya que se moverá.
      const isOriginalTime = time === appointment.time;
      
      // La hora está disponible si hay menos de maxAppointments O si es la hora original
      return currentBookings < maxAppointmentsPerSlot || isOriginalTime;
    });
  }, [newDate, selectedProfessionalId, timeOptions, getBookedTimes, appointment.type, appointment.time]);

  useEffect(() => {
    if (newDate && selectedProfessionalId) {
        const booked = getBookedTimes(newDate, selectedProfessionalId);
        const maxAppointmentsPerSlot = appointment.type === 'consultation' ? 1 : 2;
        const currentBookings = booked[newTime] || 0;
        const isOriginalTime = newTime === appointment.time;

        // Caso 1: La hora actual (que no es la original) ya no es válida.
        if (currentBookings >= maxAppointmentsPerSlot && !isOriginalTime) {
            setNewTime(''); 
        } 
        // Caso 2: La hora actual no está en las disponibles (y no es la original), y hay otras disponibles.
        else if (newTime && !availableTimeSlots.includes(newTime) && availableTimeSlots.length > 0) {
             setNewTime(availableTimeSlots[0]);
        }
        // Caso 3: Si no hay nada seleccionado, seleccionar el primero disponible.
        else if (!newTime && availableTimeSlots.length > 0) {
             setNewTime(availableTimeSlots[0]);
        }
        // Caso 4: No hay horas disponibles.
        else if (availableTimeSlots.length === 0) {
            setNewTime(''); 
        }
    } else {
      setNewTime('');
    }
  }, [newDate, selectedProfessionalId, availableTimeSlots, getBookedTimes, newTime, appointment.time, appointment.type]);


  const handleSave = async () => {
    const today = getTodayDate();
    if (newDate < today) {
      setMessage("¡No puedes seleccionar una fecha anterior a hoy!");
      return;
    }

    if (!newDate || !newTime || !selectedProfessionalId) {
      setMessage("Fecha, hora y profesional son campos obligatorios.");
      return;
    }

    setIsLoading(true);
    try {
      const apptRef = doc(db, 'appointments', appointment.id);
      const dataToUpdate: any = { date: newDate, time: newTime };

      // Se verifica si se ha seleccionado una nueva hora que realmente esté disponible
      const bookedOnNewTime = getBookedTimes(newDate, selectedProfessionalId)[newTime] || 0;
      const maxSlots = appointment.type === 'consultation' ? 1 : 2;
      
      if (bookedOnNewTime >= maxSlots && newTime !== appointment.time) {
         setMessage("La hora seleccionada ya no está disponible. Por favor, elige otra.");
         setIsLoading(false);
         return;
      }


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
      setMessage("¡Cita actualizada con éxito! ✅");
      setTimeout(onClose, 2000);
    } catch (error) {
      console.error("Error al actualizar la cita:", error);
      setMessage("Error al actualizar la cita. ❌");
    } finally {
      setIsLoading(false);
    }
  };

  const todayMinDate = getTodayDate();

  // Colores de la paleta mejorada para el modal
  const primaryColorDark = 'sky-700';
  const primaryColorLight = 'sky-100';
  const neutralDark = 'slate-800';
  const neutralLight = 'slate-200';

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-lg space-y-7 border border-slate-100"
        initial={{ scale: 0.9, y: 30 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 30 }}
        transition={{ type: "spring", damping: 20, stiffness: 300 }}
      >
        {/* Encabezado del Modal */}
        <div className="flex justify-between items-center border-b pb-4 border-slate-100">
          <h3 className={`text-3xl font-extrabold text-${neutralDark}`}>
            {isCompleted ? 'Detalles de Cita' : 'Editar Cita'} de <span className={`text-${primaryColorDark}`}>{appointment.patientName}</span>
          </h3>
          <button onClick={onClose} className={`p-2 rounded-full text-slate-500 hover:bg-${neutralLight} transition-colors`}>
            <FiX size={26} />
          </button>
        </div>

        {/* Controles de Formulario */}
        <div className="space-y-5">
          {/* Campo de Fecha */}
          <div className="relative">
            <label htmlFor="edit-date" className={`block text-lg font-semibold text-${neutralDark} mb-2`}>
              <FiCalendar className="inline-block mr-2 text-slate-500" size={20} /> Fecha
            </label>
            <input
              type="date"
              id="edit-date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              disabled={isCompleted}
              min={todayMinDate}
              className={`mt-1 block w-full p-3 rounded-xl bg-${primaryColorLight}/40 border-2 border-slate-200 focus:border-${primaryColorDark} focus:ring-2 focus:ring-sky-200 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed transition-all text-lg`}
            />
          </div>

          {/* Selector de Profesional (Doctor/Terapeuta) */}
          <div className="relative">
            <label className={`block text-lg font-semibold text-${neutralDark} mb-2`}>
              <FiUser className="inline-block mr-2 text-slate-500" size={20} /> Profesional
            </label>
            {appointment.type === 'consultation' ? (
              <select
                id="doctor-select-edit"
                value={selectedProfessionalId}
                onChange={(e) => setSelectedProfessionalId(e.target.value)}
                disabled={isCompleted}
                className={`mt-1 block w-full p-3 rounded-xl bg-${primaryColorLight}/40 border-2 border-slate-200 focus:border-${primaryColorDark} focus:ring-2 focus:ring-sky-200 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed transition-all text-lg`}
              >
                {doctors.map(doctor => (
                  <option key={doctor.id} value={doctor.id}>{doctor.name}</option>
                ))}
              </select>
            ) : (
              <select
                id="therapist-select-edit"
                value={selectedProfessionalId}
                onChange={(e) => setSelectedProfessionalId(e.target.value)}
                disabled={isCompleted}
                className={`mt-1 block w-full p-3 rounded-xl bg-${primaryColorLight}/40 border-2 border-slate-200 focus:border-${primaryColorDark} focus:ring-2 focus:ring-sky-200 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed transition-all text-lg`}
              >
                {therapists.map(therapist => (
                  <option key={therapist.id} value={therapist.id}>{therapist.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Selector de Hora (Dinámico y Filtrado) */}
          <div className="relative">
            <label className={`block text-lg font-semibold text-${neutralDark} mb-2`}>
              <FiClock className="inline-block mr-2 text-slate-500" size={20} /> Hora Disponible
            </label>
            <select
              value={newTime}
              onChange={(e) => setNewTime(e.target.value)}
              disabled={isCompleted || !newDate || !selectedProfessionalId || availableTimeSlots.length === 0}
              className={`mt-1 block w-full p-3 rounded-xl bg-${primaryColorLight}/40 border-2 border-slate-200 focus:border-${primaryColorDark} focus:ring-2 focus:ring-sky-200 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed transition-all text-lg`}
            >
              <option value="" disabled>
                {(!newDate || !selectedProfessionalId) ? 'Selecciona fecha y profesional' : (availableTimeSlots.length === 0 ? 'No hay horas disponibles' : 'Selecciona una hora')}
              </option>
              {availableTimeSlots.map(time => (
                <option key={time} value={time}>
                  {time}
                </option>
              ))}
            </select>
            {availableTimeSlots.length === 0 && newDate && selectedProfessionalId && (
              <p className="mt-2 text-sm text-red-600 font-medium">No hay horas disponibles para esta fecha y profesional.</p>
            )}
          </div>
        </div>

        {/* Botones de Acción (CORREGIDO: Siempre visibles) */}
        <div className="space-y-4 pt-6 border-t border-slate-100">
            {/* Botón Guardar (Solo habilitado si no está completada) */}
            <motion.button
              onClick={handleSave}
              disabled={isCompleted || isLoading || !newDate || !newTime || !selectedProfessionalId || newDate < getTodayDate()}
              className={`w-full flex items-center justify-center space-x-3 py-3.5 bg-sky-700 hover:bg-sky-800 text-white font-extrabold rounded-xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 text-lg`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <span>{isLoading ? 'Guardando...' : (isCompleted ? 'Cita Finalizada' : 'Guardar Cambios')}</span>
              <FiEdit size={20} />
            </motion.button>
          
          {/* Botón Cancelar/Cerrar */}
          <motion.button
            onClick={onClose}
            className={`w-full py-3.5 font-semibold rounded-xl transition-colors duration-200 text-lg ${isCompleted ? `bg-${primaryColorDark} text-white hover:bg-sky-800 shadow-lg` : `bg-${neutralLight} text-${neutralDark} hover:bg-slate-300`}`}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {isCompleted ? 'Cerrar Detalles' : 'Cancelar Edición'}
          </motion.button>
        </div>

        {/* Mensajes de Estado */}
        {message && (
          <motion.p
            className={`mt-4 p-3 rounded-xl text-center text-base font-semibold ${message.includes('Error') || message.includes('No puedes') ? 'bg-red-100 text-red-700 border border-red-300' : 'bg-green-100 text-green-700 border border-green-300'}`}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            {message}
          </motion.p>
        )}
      </motion.div>
    </motion.div>
  );
};

export default EditAppointmentModal;