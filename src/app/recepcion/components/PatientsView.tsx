'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiArrowLeft, FiSearch, FiPhone, FiCreditCard, FiMapPin,
  FiShield, FiChevronLeft, FiChevronRight, FiX, FiEdit, FiUser,
  FiRepeat, FiMail, FiCalendar, FiMap, FiLock
} from 'react-icons/fi';
import { 
  collection, query, orderBy, limit, getDocs, startAfter, where, startAt, doc, updateDoc, getDoc
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

// --- Sub-componente para el Modal de Edición (CON CAMPOS BLOQUEADOS) ---
const EditPatientModal = ({ patient, onClose, onSave, therapists }: { patient: any; onClose: () => void; onSave: (patientId: string, data: any) => void; therapists: any[]; }) => {
  const [formData, setFormData] = useState({
    name: '',
    contact: '',
    email: '',
    idNumber: '',
    dob: '',
    address: '',
    city: '',
    gender: '',
    insuranceProvider: '',
    referralSource: '',
    therapistId: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isLoadingPatient, setIsLoadingPatient] = useState(true);

  // Cargar datos actualizados del paciente al abrir el modal
  useEffect(() => {
    const loadPatientData = async () => {
      try {
        setIsLoadingPatient(true);
        console.log('🔄 Cargando datos del paciente:', patient.id);
        
        const patientDoc = await getDoc(doc(db, 'patients', patient.id));
        if (patientDoc.exists()) {
          const patientData = patientDoc.data();
          console.log('📋 Datos cargados de Firebase:', patientData);
          
          setFormData({
            name: patientData.name || '',
            contact: patientData.contact || '',
            email: patientData.email || '',
            idNumber: patientData.idNumber || '',
            dob: patientData.dob || '',
            address: patientData.address || '',
            city: patientData.city || '',
            gender: patientData.gender || '',
            insuranceProvider: patientData.insuranceProvider || '',
            referralSource: patientData.referralSource || '',
            therapistId: patientData.therapistId || '',
          });
        } else {
          console.error('❌ No se encontró el paciente en Firebase');
          setMessage('Error: No se pudo cargar la información del paciente');
        }
      } catch (error) {
        console.error('❌ Error cargando datos del paciente:', error);
        setMessage('Error al cargar los datos del paciente');
      } finally {
        setIsLoadingPatient(false);
      }
    };

    if (patient && patient.id) {
      loadPatientData();
    }
  }, [patient]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');
    
    try {
      console.log('💾 Guardando cambios:', formData);
      await onSave(patient.id, formData);
      setMessage("✅ Paciente actualizado con éxito!");
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error) {
      console.error('❌ Error guardando cambios:', error);
      setMessage("❌ Ocurrió un error al actualizar el paciente.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoadingPatient) {
    return (
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      >
        <motion.div
          className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-2xl"
          initial={{ scale: 0.9, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 30 }}
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-bold text-slate-900">Cargando información...</h3>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-200 transition-colors">
              <FiX size={24} />
            </button>
          </div>
          <div className="flex justify-center py-8">
            <motion.div 
              className="w-8 h-8 border-2 border-sky-600 border-t-transparent rounded-full"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            />
          </div>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      <motion.div
        className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto"
        initial={{ scale: 0.9, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 30 }}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-slate-900">Editar Paciente: {patient.name}</h3>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-200 transition-colors">
            <FiX size={24} />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Información Básica */}
            <div className="md:col-span-2">
              <h4 className="text-lg font-semibold text-slate-800 mb-4 border-b pb-2">
                Información Personal (No editable)
              </h4>
            </div>
            
            <div className="relative">
              <label htmlFor="name" className="block text-base font-medium text-slate-700 mb-2">
                Nombre Completo <span className="text-red-500">*</span>
                <span className="ml-2 text-xs text-amber-600 bg-amber-100 px-2 py-1 rounded-full flex items-center w-fit mt-1">
                  <FiLock size={10} className="mr-1" /> No editable
                </span>
              </label>
              <input 
                type="text" 
                id="name" 
                name="name" 
                value={formData.name} 
                readOnly
                disabled
                className="mt-1 w-full p-3 rounded-lg bg-slate-100 border-2 border-slate-300 cursor-not-allowed opacity-70"
              />
            </div>

            <div className="relative">
              <label htmlFor="idNumber" className="block text-base font-medium text-slate-700 mb-2">
                Número de Identidad <span className="text-red-500">*</span>
                <span className="ml-2 text-xs text-amber-600 bg-amber-100 px-2 py-1 rounded-full flex items-center w-fit mt-1">
                  <FiLock size={10} className="mr-1" /> No editable
                </span>
              </label>
              <input 
                type="text" 
                id="idNumber" 
                name="idNumber" 
                value={formData.idNumber} 
                readOnly
                disabled
                className="mt-1 w-full p-3 rounded-lg bg-slate-100 border-2 border-slate-300 cursor-not-allowed opacity-70"
              />
            </div>

            <div className="relative">
              <label htmlFor="dob" className="block text-base font-medium text-slate-700 mb-2">
                Fecha de Nacimiento <span className="text-red-500">*</span>
                <span className="ml-2 text-xs text-amber-600 bg-amber-100 px-2 py-1 rounded-full flex items-center w-fit mt-1">
                  <FiLock size={10} className="mr-1" /> No editable
                </span>
              </label>
              <input 
                type="date" 
                id="dob" 
                name="dob" 
                value={formData.dob} 
                readOnly
                disabled
                className="mt-1 w-full p-3 rounded-lg bg-slate-100 border-2 border-slate-300 cursor-not-allowed opacity-70"
              />
            </div>

            <div className="relative">
              <label htmlFor="gender" className="block text-base font-medium text-slate-700 mb-2">
                Género <span className="text-red-500">*</span>
                <span className="ml-2 text-xs text-amber-600 bg-amber-100 px-2 py-1 rounded-full flex items-center w-fit mt-1">
                  <FiLock size={10} className="mr-1" /> No editable
                </span>
              </label>
              <select 
                id="gender" 
                name="gender" 
                value={formData.gender} 
                disabled
                className="mt-1 w-full p-3 rounded-lg bg-slate-100 border-2 border-slate-300 cursor-not-allowed opacity-70"
              >
                <option value="">Seleccione...</option>
                <option value="masculino">Masculino</option>
                <option value="femenino">Femenino</option>
                <option value="otro">Otro</option>
              </select>
            </div>

            {/* Información de Contacto (EDITABLE) */}
            <div className="md:col-span-2">
              <h4 className="text-lg font-semibold text-slate-800 mb-4 border-b pb-2">
                Información de Contacto (Editable)
              </h4>
            </div>

            <div>
              <label htmlFor="contact" className="block text-base font-medium text-slate-700 mb-2">
                Teléfono <span className="text-red-500">*</span>
              </label>
              <input 
                type="text" 
                id="contact" 
                name="contact" 
                value={formData.contact} 
                onChange={handleChange} 
                required 
                className="mt-1 w-full p-3 rounded-lg bg-slate-50 border-2 border-slate-200 focus:border-sky-500 focus:ring-sky-500"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-base font-medium text-slate-700 mb-2">
                Email
              </label>
              <input 
                type="email" 
                id="email" 
                name="email" 
                value={formData.email} 
                onChange={handleChange} 
                className="mt-1 w-full p-3 rounded-lg bg-slate-50 border-2 border-slate-200 focus:border-sky-500 focus:ring-sky-500"
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="address" className="block text-base font-medium text-slate-700 mb-2">
                Dirección Completa
              </label>
              <textarea 
                id="address" 
                name="address" 
                value={formData.address} 
                onChange={handleChange} 
                rows={3}
                className="mt-1 w-full p-3 rounded-lg bg-slate-50 border-2 border-slate-200 focus:border-sky-500 focus:ring-sky-500"
              />
            </div>

            <div>
              <label htmlFor="city" className="block text-base font-medium text-slate-700 mb-2">
                Ciudad
              </label>
              <input 
                type="text" 
                id="city" 
                name="city" 
                value={formData.city} 
                onChange={handleChange} 
                className="mt-1 w-full p-3 rounded-lg bg-slate-50 border-2 border-slate-200 focus:border-sky-500 focus:ring-sky-500"
              />
            </div>

            {/* Información Médica y Asignación (EDITABLE) */}
            <div className="md:col-span-2">
              <h4 className="text-lg font-semibold text-slate-800 mb-4 border-b pb-2">
                Información Médica y Asignación (Editable)
              </h4>
            </div>

            <div>
              <label htmlFor="insuranceProvider" className="block text-base font-medium text-slate-700 mb-2">
                Seguro Médico
              </label>
              <select 
                id="insuranceProvider" 
                name="insuranceProvider" 
                value={formData.insuranceProvider} 
                onChange={handleChange} 
                className="mt-1 w-full p-3 rounded-lg bg-slate-50 border-2 border-slate-200 focus:border-sky-500 focus:ring-sky-500"
              >
                <option value="">Ninguno</option>
                <option value="Ficohsa">Ficohsa</option>
                <option value="Mapfre">Mapfre</option>
                <option value="Palig">Palig</option>
                <option value="Best-Doctor">Best Doctor</option>
                <option value="Bupa">Bupa</option>
              </select>
            </div>

            <div>
              <label htmlFor="referralSource" className="block text-base font-medium text-slate-700 mb-2">
                ¿Cómo nos conoció?
              </label>
              <select 
                id="referralSource" 
                name="referralSource" 
                value={formData.referralSource} 
                onChange={handleChange} 
                className="mt-1 w-full p-3 rounded-lg bg-slate-50 border-2 border-slate-200 focus:border-sky-500 focus:ring-sky-500"
              >
                <option value="">No especificado</option>
                <option value="Redes Sociales">Redes Sociales</option>
                <option value="Recomendación de Doctor">Recomendación de Doctor</option>
                <option value="Amigos / Familiares">Amigos / Familiares</option>
                <option value="Otro">Otro</option>
              </select>
            </div>

            <div>
              <label htmlFor="therapistId" className="block text-base font-medium text-slate-700 mb-2">
                Terapeuta Asignado
              </label>
              <select 
                id="therapistId" 
                name="therapistId" 
                value={formData.therapistId} 
                onChange={handleChange} 
                className="mt-1 w-full p-3 rounded-lg bg-slate-50 border-2 border-slate-200 focus:border-sky-500 focus:ring-sky-500"
              >
                <option value="">Ninguno</option>
                {therapists.map(therapist => (
                  <option key={therapist.id} value={therapist.id}>
                    {therapist.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
            <div className="flex items-start space-x-3">
              <FiLock className="text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm text-blue-800 font-medium">Información protegida</p>
                <p className="text-xs text-blue-600 mt-1">
                  Los campos de información personal (Nombre, Identidad, Fecha de Nacimiento y Género) no pueden ser modificados por políticas de seguridad y consistencia de datos.
                </p>
              </div>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full py-3 mt-6 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-lg shadow-md disabled:opacity-50 transition-colors"
          >
            {isLoading ? 'Guardando...' : 'Guardar Cambios'}
          </button>

          {message && (
            <p className={`mt-4 text-center text-sm font-medium ${
              message.includes('Error') || message.includes('❌') 
                ? 'text-red-600 bg-red-50 p-3 rounded-lg' 
                : 'text-green-600 bg-green-50 p-3 rounded-lg'
            }`}>
              {message}
            </p>
          )}
        </form>
      </motion.div>
    </motion.div>
  );
};

// --- Componente Principal de la Vista de Pacientes ---
interface PatientsViewProps {
  onBack: () => void;
  onSchedule: (patient: any) => void;
  therapists: any[];
}

const PatientsView: React.FC<PatientsViewProps> = ({ onBack, onSchedule, therapists }) => {
  const [patients, setPatients] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<any | null>(null);
  const [page, setPage] = useState(1);
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [pageHistory, setPageHistory] = useState<any[]>([]);
  const [isLastPage, setIsLastPage] = useState(false);
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchTerm);

  const PATIENTS_PER_PAGE = 6;

  const fetchPatients = useCallback(async (direction: 'next' | 'prev' | 'first' = 'first') => {
      setIsLoading(true);
      let q;
      const patientsRef = collection(db, 'patients');

      if (debouncedSearchTerm) {
        const term = debouncedSearchTerm.charAt(0).toUpperCase() + debouncedSearchTerm.slice(1);
        q = query(patientsRef, orderBy('name'), where('name', '>=', term), where('name', '<=', term + '\uf8ff'), limit(PATIENTS_PER_PAGE));
      } else {
        if (direction === 'first') { q = query(patientsRef, orderBy('createdAt', 'desc'), limit(PATIENTS_PER_PAGE)); } 
        else if (direction === 'next') { q = query(patientsRef, orderBy('createdAt', 'desc'), startAfter(lastDoc), limit(PATIENTS_PER_PAGE)); } 
        else {
            const prevPageFirstDoc = pageHistory[page - 2];
            q = query(patientsRef, orderBy('createdAt', 'desc'), startAt(prevPageFirstDoc), limit(PATIENTS_PER_PAGE));
        }
      }

      try {
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            const newPatients = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setPatients(newPatients);
            const firstVisible = snapshot.docs[0];
            const lastVisible = snapshot.docs[snapshot.docs.length - 1];
            setLastDoc(lastVisible);
            if (direction === 'next' && !debouncedSearchTerm) { setPageHistory(prev => [...prev, firstVisible]); setPage(p => p + 1); } 
            else if (direction === 'prev' && !debouncedSearchTerm) { setPageHistory(prev => prev.slice(0, -1)); setPage(p => p - 1); } 
            else { setPage(1); setPageHistory([firstVisible]); }
            setIsLastPage(snapshot.docs.length < PATIENTS_PER_PAGE);
        } else {
            if (direction === 'first' || debouncedSearchTerm) setPatients([]);
            setIsLastPage(true);
        }
      } catch (error) {
        console.error("Error al obtener pacientes:", error);
      } finally {
        setIsLoading(false);
      }
  }, [debouncedSearchTerm, lastDoc, page, pageHistory]);

  useEffect(() => {
    const handler = setTimeout(() => { setDebouncedSearchTerm(searchTerm); }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  useEffect(() => {
    fetchPatients('first');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearchTerm]);

  const handleSavePatient = async (patientId: string, data: any) => {
    const patientRef = doc(db, 'patients', patientId);
    
    // Agregar timestamp de actualización
    const updateData = {
      ...data,
      updatedAt: new Date()
    };
    
    await updateDoc(patientRef, updateData);
    setPatients(prev => prev.map(p => p.id === patientId ? { ...p, ...updateData } : p));
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex items-center space-x-4 mb-6">
        <button onClick={onBack} className="p-2 rounded-full hover:bg-slate-200 transition-colors"><FiArrowLeft size={24} /></button>
        <h2 className="text-3xl font-bold text-slate-900">Gestión de Pacientes</h2>
      </div>

      <div className="relative mb-6">
        <input type="text" placeholder="Buscar paciente por nombre..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-12 pr-4 py-3 w-full rounded-full bg-white border-2 border-slate-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500"/>
        <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white p-6 rounded-2xl shadow-lg animate-pulse"><div className="flex items-center space-x-4 mb-4"><div className="w-12 h-12 bg-slate-200 rounded-full"></div><div className="flex-1 space-y-2"><div className="h-4 bg-slate-200 rounded w-3/4"></div><div className="h-3 bg-slate-200 rounded w-1/2"></div></div></div><div className="space-y-3"><div className="h-3 bg-slate-100 rounded"></div><div className="h-3 bg-slate-100 rounded"></div></div><div className="mt-4 pt-4 border-t border-slate-200 flex justify-end space-x-2"><div className="h-8 w-24 bg-slate-200 rounded-lg"></div></div></div>
          ))
        ) : patients.length > 0 ? (
          patients.map(patient => {
            const assignedTherapist = patient.therapistId ? therapists.find(t => t.id === patient.therapistId) : null;

            // Lógica para el contador de terapias
            const therapyCount = patient.therapiesSinceConsult || 0;
            const progressPercentage = (therapyCount / 10) * 100;

            return (
              <motion.div 
                key={patient.id} 
                className="bg-white p-6 rounded-2xl shadow-lg flex flex-col justify-between hover:shadow-xl hover:bg-sky-100 hover:-translate-y-1 transition-all cursor-pointer" 
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                onClick={() => onSchedule(patient)}>
                <div>
                  <div className="flex items-center space-x-4 mb-4">
                    <div className="w-12 h-12 bg-sky-300 text-sky-900 rounded-full flex items-center justify-center font-bold text-xl">{patient.name.charAt(0).toUpperCase()}</div>
                    <div><h3 className="text-lg font-bold text-slate-900">{patient.name}</h3></div>
                  </div>
                  <div className="space-y-3 text-sm text-slate-700">
                    <p className="flex items-center space-x-2"><FiPhone size={14} className="text-sky-600" /><span>{patient.contact}</span></p>
                    <p className="flex items-center space-x-2"><FiCreditCard size={14} className="text-sky-600" /><span>Cédula: {patient.idNumber || 'No registrada'}</span></p>
                    <p className="flex items-center space-x-2"><FiShield size={14} className="text-sky-600" /><span>Seguro: {patient.insuranceProvider || 'Ninguno'}</span></p>
                    
                    {/* Contador de terapias */}
                    <div className="pt-2">
                      <p className="flex items-center space-x-2 font-medium text-slate-800">
                        <FiRepeat size={14} className="text-teal-600" />
                        <span>{therapyCount} de 10 Terapias</span>
                      </p>
                      <div className="w-full bg-slate-200 rounded-full h-2 mt-1.5">
                        <div 
                          className="bg-teal-500 h-2 rounded-full transition-all duration-500" 
                          style={{ width: `${progressPercentage}%` }}
                        ></div>
                      </div>
                    </div>

                    {assignedTherapist && (
                      <div className="pt-3 mt-3 border-t border-slate-200">
                        <p className="flex items-center space-x-2 text-purple-800">
                          <FiUser size={14} />
                          <span className="font-semibold">Terapeuta: {assignedTherapist.name.split(' ')[0]}</span>
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-300 flex justify-end space-x-2">
                  <button 
                    onClick={(e) => { e.stopPropagation(); setSelectedPatient(patient); }} 
                    className="flex items-center space-x-2 text-sm py-2 px-4 bg-slate-300 text-slate-800 rounded-lg hover:bg-slate-400 transition-colors">
                    <FiEdit size={14} /><span>Editar</span>
                  </button>
                </div>
              </motion.div>
            )
          })
        ) : (
          <p className="text-slate-500 col-span-full text-center py-10">No se encontraron pacientes.</p>
        )}
      </div>
      
      {!debouncedSearchTerm && patients.length > 0 && (
        <div className="flex justify-center items-center space-x-4 pt-6">
          <button onClick={() => fetchPatients('prev')} disabled={page === 1 || isLoading} className="flex items-center space-x-2 py-2 px-4 bg-white text-slate-700 rounded-lg shadow-md hover:bg-slate-100 disabled:opacity-50"><FiChevronLeft /><span>Anterior</span></button>
          <span className="font-semibold text-slate-600">Página {page}</span>
          <button onClick={() => fetchPatients('next')} disabled={isLastPage || isLoading} className="flex items-center space-x-2 py-2 px-4 bg-white text-slate-700 rounded-lg shadow-md hover:bg-slate-100 disabled:opacity-50"><span>Siguiente</span><FiChevronRight /></button>
        </div>
      )}

      <AnimatePresence>
        {selectedPatient && <EditPatientModal patient={selectedPatient} onClose={() => setSelectedPatient(null)} onSave={handleSavePatient} therapists={therapists} />}
      </AnimatePresence>
    </motion.div>
  );
};

export default PatientsView;