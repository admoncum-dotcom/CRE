'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { collection, query, where, onSnapshot, orderBy, limit, addDoc, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { 
  FiX, FiPhone, FiMail, FiCalendar, FiClock, FiCheckCircle, 
  FiXCircle, FiAlertCircle, FiPlus, FiUser 
} from 'react-icons/fi';

interface Patient {
  id: string;
  name: string;
  contact: string;
  email: string;
  dob: string;
}

interface Appointment {
  id: string;
  date: string;
  time: string;
  type: string;
  status: 'scheduled' | 'completed' | 'cancelled' | 'no-show';
  therapistId?: string;
}

const statusInfo: { [key: string]: { style: string; icon: React.ReactNode; label: string } } = {
    scheduled: { style: 'bg-blue-100 text-blue-800', icon: <FiClock />, label: 'Programada' },
    completed: { style: 'bg-green-100 text-green-800', icon: <FiCheckCircle />, label: 'Completada' },
    cancelled: { style: 'bg-gray-100 text-gray-800', icon: <FiX />, label: 'Cancelada' },
    'no-show': { style: 'bg-red-100 text-red-800', icon: <FiXCircle />, label: 'No se presentó' },
};

const PatientHistoryModal = ({ patient, onClose }: { patient: Patient; onClose: () => void; }) => {
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'history' | 'new'>('history');
    
    // Estados para nueva cita
    const [newAppointmentDate, setNewAppointmentDate] = useState('');
    const [newAppointmentTime, setNewAppointmentTime] = useState('');
    const [isScheduling, setIsScheduling] = useState(false);
    const [scheduleMessage, setScheduleMessage] = useState('');
    const [therapistId, setTherapistId] = useState<string>('');
    const [allAppointments, setAllAppointments] = useState<Appointment[]>([]);

    // Obtener therapistId de la sesión
    useEffect(() => {
        const auth = getAuth();
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                setTherapistId(user.uid);
            }
        });
        return () => unsubscribe();
    }, []);

    // Cargar todas las citas para verificación de disponibilidad
    useEffect(() => {
        if (!therapistId) return;

        const q = query(
            collection(db, 'appointments'),
            where('therapistId', '==', therapistId),
            orderBy('date', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const allAppts = snapshot.docs.map(doc => ({ 
                id: doc.id, 
                ...doc.data() 
            } as Appointment));
            setAllAppointments(allAppts);
        });

        return () => unsubscribe();
    }, [therapistId]);

    // Cargar historial del paciente (solo 2 citas más recientes)
    useEffect(() => {
        if (!patient.id) return;

        const q = query(
            collection(db, 'appointments'),
            where('patientId', '==', patient.id),
            where('type', '==', 'therapy'),
            orderBy('date', 'desc'),
            orderBy('time', 'desc'),
            limit(2) // Solo 2 citas en el historial
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const appts = snapshot.docs.map(doc => ({ 
                id: doc.id, 
                ...doc.data() 
            } as Appointment));
            setAppointments(appts);
            setIsLoading(false);
        }, (error) => {
            console.error("Error fetching patient history:", error);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [patient.id]);

    // Lógica para horarios disponibles
    const todayString = useMemo(() => new Date().toISOString().split('T')[0], []);

    const timeOptions = useMemo(() => {
        const startHour = 6, endHour = 18;
        const allTimes = Array.from({ length: endHour - startHour + 1 }, (_, i) => 
            `${(startHour + i).toString().padStart(2, '0')}:00`
        );
        
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
            .filter(appt => 
                appt && 
                appt.date === newAppointmentDate && 
                appt.therapistId === therapistId && 
                appt.status !== 'cancelled'
            )
            .forEach(appt => { 
                counts[appt.time] = (counts[appt.time] || 0) + 1; 
            });
        return counts;
    }, [newAppointmentDate, therapistId, allAppointments]);

    // Función para agendar nueva cita
    const handleScheduleNewAppointment = async () => {
        if (!newAppointmentDate || !newAppointmentTime || !therapistId) {
            setScheduleMessage('Por favor complete todos los campos requeridos.');
            return;
        }

        setIsScheduling(true);
        setScheduleMessage('');

        try {
            const newAppointmentData = {
                patientId: patient.id,
                patientName: patient.name,
                therapistId: therapistId,
                date: newAppointmentDate,
                time: newAppointmentTime,
                type: 'therapy',
                status: 'scheduled',
                createdAt: new Date(),
            };
            
            await addDoc(collection(db, 'appointments'), newAppointmentData);
            
            setScheduleMessage(`¡Cita agendada con éxito para el ${newAppointmentDate} a las ${newAppointmentTime}!`);
            setNewAppointmentDate('');
            setNewAppointmentTime('');
            
            // Cambiar a pestaña de historial después de agendar
            setTimeout(() => {
                setActiveTab('history');
                setScheduleMessage('');
            }, 2000);
            
        } catch (error) {
            console.error("Error agendando nueva cita:", error);
            setScheduleMessage("Error al agendar la cita. Inténtelo de nuevo.");
        } finally {
            setIsScheduling(false);
        }
    };

    const isConfirmButtonEnabled = !isScheduling && 
                                  newAppointmentDate && 
                                  newAppointmentTime && 
                                  therapistId;

    return (
        <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
            <motion.div
                className="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
                initial={{ scale: 0.9, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 30 }}
            >
                {/* Header */}
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h3 className="text-2xl font-bold text-slate-900">{patient.name}</h3>
                        <p className="text-slate-500 text-sm">Historial Clínico</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-200">
                        <FiX size={24} />
                    </button>
                </div>

                {/* Información del paciente */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6 p-4 bg-sky-50 rounded-lg border border-sky-200">
                    {patient.email && (
                        <p className="flex items-center text-sm">
                            <FiMail className="mr-2 text-slate-400" /> 
                            {patient.email}
                        </p>
                    )}
                    {patient.contact && (
                        <p className="flex items-center text-sm">
                            <FiPhone className="mr-2 text-slate-400" /> 
                            {patient.contact}
                        </p>
                    )}
                    {patient.dob && (
                        <p className="flex items-center text-sm">
                            <FiCalendar className="mr-2 text-slate-400" /> 
                            {patient.dob}
                        </p>
                    )}
                    <p className="flex items-center text-sm">
                        <FiUser className="mr-2 text-slate-400" />
                        ID: {patient.id}
                    </p>
                </div>

                {/* Navegación de pestañas */}
                <div className="flex space-x-2 mb-6 border-b border-slate-200">
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`flex items-center space-x-2 py-2 px-4 rounded-t-lg text-sm font-semibold transition-colors ${
                            activeTab === 'history' 
                                ? 'bg-sky-100 text-sky-700 border-b-2 border-sky-500' 
                                : 'text-slate-600 hover:bg-slate-100'
                        }`}
                    >
                        <FiClock size={16} />
                        <span>Últimas 2 Citas</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('new')}
                        className={`flex items-center space-x-2 py-2 px-4 rounded-t-lg text-sm font-semibold transition-colors ${
                            activeTab === 'new' 
                                ? 'bg-sky-100 text-sky-700 border-b-2 border-sky-500' 
                                : 'text-slate-600 hover:bg-slate-100'
                        }`}
                    >
                        <FiPlus size={16} />
                        <span>Nueva Cita</span>
                    </button>
                </div>

                {/* Contenido de las pestañas */}
                <div className="flex-grow overflow-y-auto pr-2 -mr-2">
                    {activeTab === 'history' ? (
                        /* PESTAÑA DE HISTORIAL */
                        <div>
                            <h4 className="text-lg font-bold text-slate-900 mb-4">
                                Últimas 2 Terapias
                            </h4>

                            {isLoading ? (
                                <p className="text-center text-slate-500 py-4">Cargando historial...</p>
                            ) : appointments.length === 0 ? (
                                <div className="text-center text-slate-500 py-8">
                                    <FiAlertCircle className="mx-auto text-4xl mb-2" />
                                    <p>Este paciente no tiene citas de terapia registradas.</p>
                                </div>
                            ) : (
                                <ul className="space-y-3">
                                    {appointments.map(appt => {
                                        const status = statusInfo[appt.status] || { 
                                            style: 'bg-gray-100 text-gray-800', 
                                            icon: '?', 
                                            label: appt.status 
                                        };
                                        return (
                                            <li key={appt.id} className="flex items-center justify-between p-4 bg-sky-50 rounded-lg border border-sky-200 hover:bg-sky-100 transition-colors">
                                                <div>
                                                    <p className="font-semibold text-slate-800">
                                                        {appt.date} - {appt.time}
                                                    </p>
                                                    <p className="text-sm text-slate-600 capitalize">
                                                        Terapia
                                                    </p>
                                                </div>
                                                <div className={`flex items-center text-xs font-bold px-2.5 py-1 rounded-full ${status.style}`}>
                                                    {status.icon}
                                                    <span className="ml-1.5">{status.label}</span>
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>
                    ) : (
                        /* PESTAÑA DE NUEVA CITA */
                        <div className="space-y-6">
                            <h4 className="text-lg font-bold text-slate-900">
                                Agendar Nueva Terapia
                            </h4>

                            <div className="space-y-4">
                                <div>
                                    <label htmlFor="new-date" className="block text-sm font-medium text-slate-700 mb-2">
                                        1. Seleccione la Fecha
                                    </label>
                                    <input 
                                        type="date" 
                                        id="new-date" 
                                        value={newAppointmentDate} 
                                        min={todayString} 
                                        onChange={(e) => { 
                                            setNewAppointmentDate(e.target.value); 
                                            setNewAppointmentTime(''); 
                                        }} 
                                        className="w-full p-3 rounded-lg bg-sky-50 border-2 border-slate-200 focus:border-sky-500 focus:ring-sky-500" 
                                    />
                                </div>
                                
                                <div>
                                    <label htmlFor="new-time" className="block text-sm font-medium text-slate-700 mb-2">
                                        2. Seleccione la Hora
                                    </label>
                                    <select 
                                        id="new-time" 
                                        value={newAppointmentTime} 
                                        onChange={(e) => setNewAppointmentTime(e.target.value)} 
                                        disabled={!newAppointmentDate}
                                        className="w-full p-3 rounded-lg bg-sky-50 border-2 border-slate-200 focus:border-sky-500 focus:ring-sky-500 disabled:bg-slate-100"
                                    >
                                        <option value="" disabled>
                                            {!newAppointmentDate ? 'Seleccione una fecha primero' : 'Elija una hora disponible'}
                                        </option>
                                        {timeOptions.map(time => {
                                            const count = bookedTimes[time] || 0;
                                            const isAvailable = count < 2; // Máximo 2 citas por horario
                                            return (
                                                <option 
                                                    key={time} 
                                                    value={time} 
                                                    disabled={!isAvailable}
                                                >
                                                    {time} {isAvailable ? ` (${2 - count} disponible/s)` : ' (Ocupado)'}
                                                </option>
                                            );
                                        })}
                                    </select>
                                </div>
                            </div>

                            {/* Información de disponibilidad */}
                            {newAppointmentDate && (
                                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                    <p className="text-sm text-blue-800">
                                        <strong>Disponibilidad para el {newAppointmentDate}:</strong><br />
                                        • Horarios en verde: Disponibles<br />
                                        • Horarios en gris: Ocupados<br />
                                        • Máximo 2 citas por horario
                                    </p>
                                </div>
                            )}

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

                            {scheduleMessage && (
                                <p className={`p-3 rounded-lg text-center text-sm ${
                                    scheduleMessage.includes('Error') 
                                        ? 'bg-red-100 text-red-800' 
                                        : 'bg-green-100 text-green-800'
                                }`}>
                                    {scheduleMessage}
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </motion.div>
        </motion.div>
    );
};

export default PatientHistoryModal;