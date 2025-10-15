'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiArrowLeft, FiSearch, FiPhone, FiCreditCard, FiShield, FiChevronLeft, FiChevronRight, FiRepeat 
} from 'react-icons/fi';
import {
  collection, query, orderBy, limit, getDocs, startAfter, where, startAt
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import PatientDetailsModal from './PatientDetailsModal';

interface PatientsViewProps {
  onBack: () => void;
}

const PatientsView: React.FC<PatientsViewProps> = ({ onBack }) => {
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

  // --- Paleta de Colores (Azul Mejorado) ---
  const primaryColor = 'sky';
  const primaryColorDark = 'sky-600';
  const primaryColorLight = 'sky-100';
  const neutralDark = 'slate-900';
  const neutralLight = 'slate-100';
  const secondaryColor = 'teal'; // Color para la barra de progreso
  // ----------------------------------------

  // --- LÓGICA DE PAGINACIÓN Y BÚSQUEDA (Mantenida) ---

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

  // --- RENDERIZADO (Visualmente Mejorado con barra de progreso) ---

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        {/* Encabezado */}
        <div className="flex items-center space-x-4 mb-6">
          <button onClick={onBack} className="p-2 rounded-full hover:bg-slate-200 transition-colors">
            <FiArrowLeft size={24} />
          </button>
          <h2 className="text-3xl font-bold text-slate-900">
            Gestión de Pacientes
          </h2>
        </div>

        {/* Barra de Búsqueda */}
        <div className="relative mb-10">
          <input
            type="text"
            placeholder="Buscar paciente por nombre..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-12 pr-4 py-3 w-full rounded-full bg-white border-2 border-slate-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
          <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
        </div>

        {/* Grid de Tarjetas de Pacientes */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading ? (
            /* Skeleton Loading State */
            Array.from({ length: PATIENTS_PER_PAGE }).map((_, i) => (
              <div key={i} className="bg-white p-6 rounded-2xl shadow-lg animate-pulse">
                <div className="flex items-center space-x-4 mb-4">
                  <div className="w-12 h-12 bg-slate-200 rounded-full"></div>
                  <div className="flex-1 space-y-3">
                    <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                    <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                  </div>
                </div>
                <div className="space-y-4 pt-2">
                  <div className="h-3 bg-slate-100 rounded"></div>
                  <div className="h-3 bg-slate-100 rounded"></div>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-200 flex justify-end space-x-2">
                  <div className="h-8 w-24 bg-slate-200 rounded-lg"></div>
                </div>
              </div>
            ))
          ) : patients.length > 0 ? (
            /* Tarjetas de Pacientes */
            patients.map(patient => {
              // --- LÓGICA DE PROGRESO DE TERAPIAS (INTEGRADA) ---
              const therapyCount = patient.therapiesSinceConsult || 0;
              const maxTherapies = 10;
              const progressPercentage = (therapyCount / maxTherapies) * 100;
              const progressClamped = Math.min(100, progressPercentage); // Asegura que no pase del 100%

              // Clase dinámica para el color de la barra
              let progressBarColor = 'bg-teal-500'; // Teal por defecto
              if (progressClamped >= 100) {
                  progressBarColor = 'bg-green-500'; // Verde si está completado
              } else if (progressClamped < 25) {
                  progressBarColor = 'bg-amber-500'; // Ámbar si recién empieza
              }
              // ---------------------------------------------------
              return (
                <motion.div
                  key={patient.id}
                  className="bg-white p-6 rounded-2xl shadow-lg flex flex-col justify-between hover:shadow-xl hover:bg-sky-100 hover:-translate-y-1 transition-all cursor-pointer"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  onClick={() => setSelectedPatient(patient)}
                >
                  <div>
                    {/* Avatar y Nombre */}
                    <div className="flex items-center space-x-4 mb-4">
                      <div className="w-12 h-12 bg-sky-300 text-sky-900 rounded-full flex items-center justify-center font-bold text-xl">
                        {patient.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-slate-900">{patient.name}</h3>
                      </div>
                    </div>

                    {/* Detalles de Contacto */}
                    <div className="space-y-3 text-sm text-slate-700">
                      <p className="flex items-center space-x-2">
                        <FiPhone size={14} className="text-sky-600" />
                        <span className="font-semibold">{patient.contact || 'No especificado'}</span>
                      </p>
                      <p className="flex items-center space-x-2">
                        <FiCreditCard size={14} className="text-sky-600" />
                        <span>Cédula: {patient.idNumber || 'No registrada'}</span>
                      </p>
                      <p className="flex items-center space-x-2">
                        <FiShield size={14} className="text-sky-600" />
                        <span>Seguro: {patient.insuranceProvider || 'Ninguno'}</span>
                      </p>
                    </div>

                    {/* BARRA DE PROGRESO (VISUALIZACIÓN INTEGRADA) */}
                    <div className="pt-2">
                        <p className={`flex items-center space-x-2 font-medium text-slate-800 ${progressClamped === 100 ? 'text-green-600' : 'text-teal-600'}`}>
                          <FiRepeat size={14} className="text-teal-600" />
                          <span>
                              {progressClamped === 100 ? 'Tratamiento Completo' : `${therapyCount} de ${maxTherapies} Terapias`}
                          </span>
                        </p>
                        <div className="w-full bg-slate-200 rounded-full h-2 mt-1.5">
                          <div
                            className={`${progressBarColor} h-2 rounded-full transition-all duration-500`}
                            style={{ width: `${progressClamped}%` }}
                          ></div>
                        </div>
                    </div>
                  </div>

                  {/* Botón Ver Historial */}
                  <div className="mt-4 pt-4 border-t border-slate-300 flex justify-end space-x-2">
                      <span className="text-sm py-2 px-4 bg-slate-300 text-slate-800 rounded-lg hover:bg-slate-400 transition-colors">
                          Ver Historial
                      </span>
                  </div>
                </motion.div>
              );
            })
          ) : (
            /* Estado Sin Resultados */
            <div className="text-slate-500 col-span-full text-center py-10">
                <p className="text-slate-500 col-span-full text-center py-10">
                    No se encontraron pacientes para "{searchTerm}" 😔
                </p>
                <p className="text-slate-600 mt-2">Intenta con otro nombre o revisa la ortografía.</p>
            </div>
          )}
        </div>

        {/* Paginación */}
        {!debouncedSearchTerm && patients.length > 0 && (
          <div className="flex justify-center items-center space-x-4 pt-6">
            <motion.button
              onClick={() => fetchPatients('prev')}
              disabled={page === 1 || isLoading}
              className="flex items-center space-x-2 py-2 px-4 bg-white text-slate-700 rounded-lg shadow-md hover:bg-slate-100 disabled:opacity-50"
              // Removed whileHover and whileTap as they are not in the recepcion version
            >
              <FiChevronLeft size={20} /><span>Anterior</span>
            </motion.button>

            <span className="font-semibold text-slate-600">
              {page}
            </span>

            <motion.button
              onClick={() => fetchPatients('next')}
              disabled={isLastPage || isLoading}
              className="flex items-center space-x-2 py-2 px-4 bg-white text-slate-700 rounded-lg shadow-md hover:bg-slate-100 disabled:opacity-50"
              // Removed whileHover and whileTap as they are not in the recepcion version
            >
              <span>Siguiente</span><FiChevronRight size={20} />
            </motion.button>
          </div>
        )}
      </motion.div>

      <AnimatePresence>
        {selectedPatient && <PatientDetailsModal patient={selectedPatient} onClose={() => setSelectedPatient(null)} />}
      </AnimatePresence>
    </>
  );
};

export default PatientsView;