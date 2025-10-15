'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  limit,
  addDoc,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import {
  FiX, FiSave, FiUser, FiClock, FiFileText, FiCalendar, FiCheckCircle,
  FiXCircle, FiHeart, FiMapPin, FiRepeat, FiBriefcase, FiPlusCircle
} from 'react-icons/fi';

// --- Tipos UNIFICADOS ---
interface BaseAppointment {
  id: string;
  patientId: string;
  patientName: string;
  therapistId?: string;
  doctorId?: string;
  date: string;
  time: string;
  type: 'therapy' | 'consultation' | string;
  status: 'scheduled' | 'completed' | 'no-show' | 'cancelled';
  observations?: string;
  indicatedTreatment?: boolean | { name: string; details?: string }[];
  bodyArea?: string[];
  createdAt?: any; // ✅ HACER OPCIONAL PARA COMPATIBILIDAD
}

// Tipo específico para uso interno del modal
interface ModalAppointment extends Omit<BaseAppointment, 'type' | 'indicatedTreatment'> {
  type: 'therapy' | 'consultation';
  indicatedTreatment?: { name: string; details?: string }[];
}

interface Patient {
  id: string;
  name: string;
  dob: string;
  contact: string;
  therapiesSinceConsult?: number;
}

interface Therapist {
  id: string;
  name: string;
  email: string;
}

// Props actualizadas para usar tipos compatibles
interface AppointmentDetailsModalProps {
  appointment: BaseAppointment;
  onClose: () => void;
  allAppointments: BaseAppointment[];
}

const AppointmentDetailsModal: React.FC<AppointmentDetailsModalProps> = ({
  appointment,
  onClose,
  allAppointments,
}) => {
  const [activeTab, setActiveTab] = useState<'attend' | 'schedule'>('attend');
  const [patient, setPatient] = useState<Patient | null>(null);
  
  // ✅ CONVERTIR el appointment al tipo específico del modal
  const [appointmentForDisplay, setAppointmentForDisplay] = useState<ModalAppointment>(() => ({
    ...appointment,
    type: (appointment.type as 'therapy' | 'consultation') || 'consultation',
    indicatedTreatment: Array.isArray(appointment.indicatedTreatment) 
      ? appointment.indicatedTreatment 
      : (appointment.indicatedTreatment ? [{ name: 'Tratamiento indicado' }] : []),
    createdAt: appointment.createdAt || Timestamp.now() // ✅ PROPORCIONAR VALOR POR DEFECTO
  }));
  
  const [observations, setObservations] = useState(appointment.observations || '');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  // --- Estados para el agendador de nueva cita ---
  const [newAppointmentDate, setNewAppointmentDate] = useState('');
  const [newAppointmentTime, setNewAppointmentTime] = useState('');
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduleMessage, setScheduleMessage] = useState('');

  // --- Estado para el therapistId desde la sesión ---
  const [therapistId, setTherapistId] = useState<string>('');
  const [therapist, setTherapist] = useState<Therapist | null>(null);

  // --- OBTENER THERAPIST ID DESDE LA SESIÓN ---
  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setTherapistId(user.uid);
        
        try {
          const therapistDoc = await getDoc(doc(db, 'therapists', user.uid));
          if (therapistDoc.exists()) {
            setTherapist({ id: therapistDoc.id, ...therapistDoc.data() } as Therapist);
          }
        } catch (error) {
          console.error('Error obteniendo datos del terapeuta:', error);
        }
      } else {
        console.error('No hay usuario logueado');
      }
    });

    return () => unsubscribe();
  }, []);

  // --- CARGAR OBSERVACIONES ACTUALIZADAS AL ABRIR LA CITA ---
  useEffect(() => {
    const loadCurrentObservations = async () => {
      try {
        console.log('Cargando observaciones para cita:', appointment.id);
        const appointmentDoc = await getDoc(doc(db, 'appointments', appointment.id));
        if (appointmentDoc.exists()) {
          const currentAppointment = appointmentDoc.data() as BaseAppointment;
          console.log('Observaciones cargadas desde Firebase:', currentAppointment.observations);
          setObservations(currentAppointment.observations || '');
          setAppointmentForDisplay(prev => ({
            ...prev,
            observations: currentAppointment.observations,
            createdAt: currentAppointment.createdAt || prev.createdAt
          }));
        }
      } catch (error) {
        console.error('Error cargando observaciones:', error);
      }
    };

    loadCurrentObservations();
  }, [appointment.id]);

  // --- LÓGICA PRINCIPAL ---
  useEffect(() => {
    const fetchPatientData = async () => {
      if (appointment.patientId) {
        const patientDoc = await getDoc(doc(db, 'patients', appointment.patientId));
        if (patientDoc.exists()) {
          setPatient({ id: patientDoc.id, ...patientDoc.data() } as Patient);
        }
      }
    };
    fetchPatientData();

    const isNewTherapy = appointmentForDisplay.type === 'therapy' && 
                        (!Array.isArray(appointmentForDisplay.indicatedTreatment) || 
                         appointmentForDisplay.indicatedTreatment.length === 0);
    
    if (isNewTherapy) {
        const q = query(
          collection(db, 'appointments'), 
          where('patientId', '==', appointment.patientId), 
          where('status', '==', 'completed'), 
          where('type', '==', 'consultation'), 
          orderBy('date', 'desc'), 
          limit(1)
        );
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (!snapshot.empty) {
                const latestConsultation = snapshot.docs[0].data() as BaseAppointment;
                setAppointmentForDisplay((prev) => ({
                    ...prev,
                    indicatedTreatment: Array.isArray(latestConsultation.indicatedTreatment) 
                      ? latestConsultation.indicatedTreatment 
                      : [],
                    bodyArea: latestConsultation.bodyArea,
                }));
            }
        });
        return () => unsubscribe();
    }
  }, [appointment.patientId, appointmentForDisplay.type, appointmentForDisplay.indicatedTreatment]);

  // --- LÓGICA PARA EL AGENDADOR ---
  const todayString = useMemo(() => new Date().toISOString().split('T')[0], []);

  const timeOptions = useMemo(() => {
    const startHour = 6, endHour = 18;
    const allTimes = Array.from({ length: endHour - startHour + 1 }, (_, i) => `${(startHour + i).toString().padStart(2, '0')}:00`);
    
    if (newAppointmentDate === todayString) {
      const currentHour = new Date().getHours();
      return allTimes.filter(time => parseInt(time.split(':')[0]) > currentHour);
    }
    return allTimes;
  }, [newAppointmentDate, todayString]);

  const bookedTimes = useMemo(() => {
    if (!newAppointmentDate || !allAppointments) return {};
    const counts: Record<string, number> = {};
    allAppointments
      .filter(appt => appt && appt.date === newAppointmentDate && appt.therapistId === therapistId && appt.status !== 'cancelled')
      .forEach(appt => { counts[appt.time] = (counts[appt.time] || 0) + 1; });
    return counts;
  }, [newAppointmentDate, therapistId, allAppointments]);

  // --- MANEJADORES DE EVENTOS COMPLETOS ---
  const handleSaveObservations = async () => {
    if (!observations.trim()) {
      setMessage('Las observaciones no pueden estar vacías.');
      return;
    }

    setIsLoading(true);
    setMessage('');
    try {
      console.log('Guardando observaciones:', observations);
      const appointmentRef = doc(db, 'appointments', appointment.id);
      await updateDoc(appointmentRef, { 
        observations: observations.trim()
      });
      
      const updatedDoc = await getDoc(appointmentRef);
      if (updatedDoc.exists()) {
        const savedObservations = updatedDoc.data().observations;
        console.log('Observaciones guardadas en Firebase:', savedObservations);
        setMessage('Observaciones guardadas con éxito.');
        
        setAppointmentForDisplay(prev => ({
          ...prev,
          observations: savedObservations
        }));
      }
      
      setTimeout(() => setMessage(''), 2000);
    } catch (error) {
      console.error('Error guardando observaciones:', error);
      setMessage('Error al guardar las observaciones.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateStatus = async (newStatus: 'completed' | 'no-show') => {
    setIsLoading(true);
    setMessage('');
    try {
      const appointmentRef = doc(db, 'appointments', appointment.id);
      await updateDoc(appointmentRef, { status: newStatus });
      setMessage(`Cita marcada como ${newStatus === 'completed' ? 'completada' : 'no presentada'}.`);
      setTimeout(onClose, 1500);
    } catch (error) {
      console.error('Error actualizando estado de la cita:', error);
      setMessage('Error al actualizar el estado.');
      setIsLoading(false);
    }
  };

  const handleScheduleNewAppointment = async () => {
    console.log('Intentando agendar cita con therapistId:', therapistId);
    
    if (!newAppointmentDate || !newAppointmentTime || !therapistId || !patient) {
      console.log('Faltan datos requeridos:', {
        newAppointmentDate, 
        newAppointmentTime, 
        therapistId, 
        patient: !!patient
      });
      return;
    }
    
    setIsScheduling(true);
    setScheduleMessage('');
    try {
      // ✅ CORREGIDO: Tipo compatible
      const newAppointmentData: Omit<BaseAppointment, 'id'> = {
        patientId: patient.id,
        patientName: patient.name,
        therapistId: therapistId,
        date: newAppointmentDate,
        time: newAppointmentTime,
        type: 'therapy',
        status: 'scheduled',
        createdAt: Timestamp.now(), // ✅ USAR Timestamp EN LUGAR DE Date
      };
      
      console.log('Datos a guardar:', newAppointmentData);
      
      await addDoc(collection(db, 'appointments'), newAppointmentData);
      setScheduleMessage(`¡Cita para ${patient.name} agendada con éxito para el ${newAppointmentDate} a las ${newAppointmentTime}!`);
      setNewAppointmentDate('');
      setNewAppointmentTime('');
    } catch (error) {
      console.error("Error agendando nueva cita:", error);
      setScheduleMessage("Error al agendar la cita. Inténtelo de nuevo.");
    } finally {
      setIsScheduling(false);
    }
  };

  const therapyCount = patient?.therapiesSinceConsult || 0;
  const progressPercentage = (therapyCount / 10) * 100;

  const isConfirmButtonEnabled = !isScheduling && 
                                newAppointmentDate && 
                                newAppointmentTime && 
                                therapistId && 
                                patient;

  return (
    <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]" initial={{ scale: 0.9, y: 30 }} animate={{ scale: 1, y: 0 }}>
        {/* Header y Navbar */}
        <div className="p-6 border-b flex-shrink-0">
          <div className="flex justify-between items-start">
            <div>
                <h3 className="text-2xl font-bold text-slate-900">Cita de {patient?.name || '...'}</h3>
                <p className="text-slate-500">{appointment.date} a las {appointment.time}</p>
                {therapist && (
                  <p className="text-sm text-slate-600">Terapeuta: {therapist.name}</p>
                )}
            </div>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-200"><FiX size={24} /></button>
          </div>
          <div className="border-b border-slate-200 mt-4 -mb-6"></div>
          <nav className="mt-6 flex space-x-4">
            <button onClick={() => setActiveTab('attend')} className={`flex items-center space-x-2 py-2 px-3 rounded-md text-sm font-semibold transition-colors ${activeTab === 'attend' ? 'bg-sky-100 text-sky-700' : 'text-slate-600 hover:bg-slate-100'}`}><FiBriefcase /><span>Atender Sesión</span></button>
            <button onClick={() => setActiveTab('schedule')} className={`flex items-center space-x-2 py-2 px-3 rounded-md text-sm font-semibold transition-colors ${activeTab === 'schedule' ? 'bg-sky-100 text-sky-700' : 'text-slate-600 hover:bg-slate-100'}`}><FiPlusCircle /><span>Agendar Próxima Cita</span></button>
          </nav>
        </div>

        {/* Contenido Scrollable */}
        <div className="overflow-y-auto px-6 py-4 flex-1 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
          <AnimatePresence mode="wait">
            {/* PESTAÑA DE ATENDER */}
            {activeTab === 'attend' && (
              <motion.div key="attend" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
                {patient ? (
                  <>
                    {/* Contador de Terapias */}
                    <div className="p-4 bg-slate-50 rounded-lg">
                      <p className="flex items-center space-x-2 text-sm font-medium text-slate-800"><FiRepeat size={14} className="text-teal-600" /><span>{therapyCount} de 10 Terapias</span></p>
                      <div className="w-full bg-slate-200 rounded-full h-2 mt-1.5"><div className="bg-teal-500 h-2 rounded-full" style={{ width: `${progressPercentage}%` }}></div></div>
                    </div>
                    {/* Detalles de la Cita */}
                    <div>
                      <h4 className="font-bold text-lg text-slate-800 mb-2">Detalles</h4>
                      <div className="p-4 bg-slate-50 rounded-lg grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-4">
                        <p className="flex items-center"><FiClock className="mr-2 text-sky-500" /> <strong>Hora:</strong> <span className="ml-2">{appointmentForDisplay.time}</span></p>
                        <p className="flex items-center"><FiFileText className="mr-2 text-sky-500" /> <strong>Tipo:</strong><span className="ml-2 capitalize">{appointmentForDisplay.type === 'therapy' && Array.isArray(appointmentForDisplay.indicatedTreatment) && appointmentForDisplay.indicatedTreatment.length > 0 ? appointmentForDisplay.indicatedTreatment[0].name : appointmentForDisplay.type}</span></p>
                        {appointmentForDisplay.type === 'therapy' && Array.isArray(appointmentForDisplay.indicatedTreatment) && appointmentForDisplay.indicatedTreatment.length > 0 && appointmentForDisplay.indicatedTreatment[0].details && (
                          <div className="md:col-span-2 p-3 bg-sky-100 border-l-4 border-sky-500 rounded-r-lg"><div className="flex items-start"><FiHeart className="mr-3 mt-1 text-sky-600 flex-shrink-0" /><div><strong className="text-sky-800">Detalles del Tratamiento:</strong><br /><span className="text-slate-700">{appointmentForDisplay.indicatedTreatment[0].details}</span></div></div></div>
                        )}
                        {appointmentForDisplay.type === 'therapy' && Array.isArray(appointmentForDisplay.bodyArea) && appointmentForDisplay.bodyArea.length > 0 && (
                          <div className="md:col-span-2 p-3 bg-indigo-100 border-l-4 border-indigo-500 rounded-r-lg"><div className="flex items-start"><FiMapPin className="mr-3 mt-1 text-indigo-600 flex-shrink-0" /><div><strong className="text-indigo-800">Zona del Cuerpo Indicada:</strong><br /><span className="text-slate-700">{appointmentForDisplay.bodyArea.join(', ')}</span></div></div></div>
                        )}
                      </div>
                    </div>
                    {/* Observaciones */}
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="font-bold text-lg text-slate-800">Observaciones</h4>
                        <button 
                          onClick={handleSaveObservations} 
                          disabled={isLoading || !observations.trim()}
                          className="flex items-center space-x-1 px-3 py-1 bg-sky-600 text-white text-sm rounded-lg hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <FiSave size={14} />
                          <span>{isLoading ? 'Guardando...' : 'Guardar'}</span>
                        </button>
                      </div>
                      <textarea 
                        value={observations} 
                        onChange={(e) => setObservations(e.target.value)} 
                        rows={5} 
                        className="w-full p-3 rounded-lg bg-slate-50 border-2 border-slate-200 focus:border-sky-500 focus:ring-sky-500" 
                        placeholder="Añadir observaciones sobre la sesión..." 
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        Caracteres: {observations.length} | 
                        Última guardada: {appointmentForDisplay.observations ? 'Sí' : 'No'}
                      </p>
                    </div>
                  </>
                ) : (
                  <p>Cargando información del paciente...</p>
                )}
              </motion.div>
            )}

            {/* PESTAÑA DE AGENDAR */}
            {activeTab === 'schedule' && (
              <motion.div key="schedule" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
                <h4 className="font-bold text-lg text-slate-800">Agendar nueva cita de terapia</h4>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="new-date" className="block text-sm font-medium text-slate-700">1. Seleccione la Fecha</label>
                    <input type="date" id="new-date" value={newAppointmentDate} min={todayString} onChange={(e) => { setNewAppointmentDate(e.target.value); setNewAppointmentTime(''); }} className="mt-1 block w-full p-3 rounded-lg bg-sky-50 border-2 border-slate-200" />
                  </div>
                  <div>
                    <label htmlFor="new-time" className="block text-sm font-medium text-slate-700">2. Seleccione la Hora</label>
                    <select id="new-time" value={newAppointmentTime} onChange={(e) => setNewAppointmentTime(e.target.value)} disabled={!newAppointmentDate} className="mt-1 block w-full p-3 rounded-lg bg-sky-50 border-2 border-slate-200 disabled:bg-slate-100">
                      <option value="" disabled>{!newAppointmentDate ? 'Seleccione una fecha' : 'Elija una hora'}</option>
                      {timeOptions.map(time => {
                        const count = bookedTimes[time] || 0;
                        const isAvailable = count < 2;
                        return <option key={time} value={time} disabled={!isAvailable}>{time}{isAvailable ? ` (${2-count} disponible/s)` : ' (Ocupado)'}</option>
                      })}
                    </select>
                  </div>
                </div>

                <button 
                  onClick={handleScheduleNewAppointment} 
                  disabled={!isConfirmButtonEnabled}
                  className={`w-full flex items-center justify-center space-x-2 py-3 font-semibold rounded-lg shadow-md transition-all ${
                    isConfirmButtonEnabled 
                      ? 'bg-sky-600 hover:bg-sky-700 text-white cursor-pointer' 
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  <FiCalendar />
                  <span>{isScheduling ? 'Agendando...' : 'Confirmar Cita'}</span>
                </button>
                {scheduleMessage && <p className={`p-3 rounded-lg text-center text-sm ${scheduleMessage.includes('Error') ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>{scheduleMessage}</p>}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer Fijo */}
        {activeTab === 'attend' && (
          <div className="p-6 border-t bg-white flex justify-between items-center flex-shrink-0">
             <div className="flex space-x-2">
                <button onClick={() => handleUpdateStatus('completed')} disabled={isLoading || appointmentForDisplay.status !== 'scheduled'} className="py-2 px-4 bg-green-100 text-green-800 font-semibold rounded-lg hover:bg-green-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center transition-colors"><FiCheckCircle className="mr-2" />Completada</button>
                <button onClick={() => handleUpdateStatus('no-show')} disabled={isLoading || appointmentForDisplay.status !== 'scheduled'} className="py-2 px-4 bg-red-100 text-red-800 font-semibold rounded-lg hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center transition-colors"><FiXCircle className="mr-2" />No se presentó</button>
            </div>
            <div className="flex space-x-4">
                <button onClick={handleSaveObservations} disabled={isLoading || !observations.trim()} className="py-2 px-6 bg-sky-600 text-white font-semibold rounded-lg hover:bg-sky-700 disabled:opacity-50 flex items-center">{isLoading ? 'Guardando...' : 'Guardar Observaciones'}<FiSave className="ml-2" /></button>
            </div>
          </div>
        )}
         {message && <p className={`p-3 text-center text-sm ${message.includes('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{message}</p>}
      </motion.div>
    </motion.div>
  );
};

export default AppointmentDetailsModal;