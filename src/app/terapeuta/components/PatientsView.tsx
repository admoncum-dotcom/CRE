'use client';

import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { FiUser, FiPhone, FiMail, FiCalendar, FiUsers, FiInbox, FiRepeat, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { motion } from 'framer-motion';

// --- INTERFAZ ACTUALIZADA ---
interface Patient {
  id: string;
  name: string;
  contact: string;
  email: string;
  dob: string;
  therapiesSinceConsult?: number; // Campo añadido para el contador de terapias
}

interface PatientsViewProps {
  therapistId: string;
  onSelectPatient: (patient: Patient) => void;
}

const PatientsView: React.FC<PatientsViewProps> = ({ therapistId, onSelectPatient }) => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [patientsPerPage] = useState(6); // 6 cards por página

  useEffect(() => {
    if (!therapistId) return;

    setIsLoading(true);

    const q = query(
      collection(db, 'patients'),
      where('therapistId', '==', therapistId) 
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const patientList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Patient));
      setPatients(patientList);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching patients:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [therapistId]);

  // Calcular índices para la paginación
  const indexOfLastPatient = currentPage * patientsPerPage;
  const indexOfFirstPatient = indexOfLastPatient - patientsPerPage;
  const currentPatients = patients.slice(indexOfFirstPatient, indexOfLastPatient);

  // Calcular total de páginas
  const totalPages = Math.ceil(patients.length / patientsPerPage);

  // Cambiar página
  const paginate = (pageNumber: number) => setCurrentPage(pageNumber);

  // Ir a página anterior
  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  // Ir a página siguiente
  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  // Generar números de página para mostrar
  const getPageNumbers = () => {
    const pageNumbers = [];
    const maxVisiblePages = 5; // Máximo de números de página visibles
    
    if (totalPages <= maxVisiblePages) {
      // Mostrar todas las páginas si son pocas
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i);
      }
    } else {
      // Lógica para mostrar páginas con ellipsis
      if (currentPage <= 3) {
        // Primeras páginas
        for (let i = 1; i <= 4; i++) {
          pageNumbers.push(i);
        }
        pageNumbers.push('...');
        pageNumbers.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        // Últimas páginas
        pageNumbers.push(1);
        pageNumbers.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) {
          pageNumbers.push(i);
        }
      } else {
        // Páginas intermedias
        pageNumbers.push(1);
        pageNumbers.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pageNumbers.push(i);
        }
        pageNumbers.push('...');
        pageNumbers.push(totalPages);
      }
    }
    
    return pageNumbers;
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <FiUsers className="text-3xl text-sky-600" />
          <h2 className="text-3xl font-bold text-slate-900">Mis Pacientes</h2>
        </div>
        
        {/* Contador de pacientes y paginación info */}
        {!isLoading && patients.length > 0 && (
          <div className="text-sm text-slate-600">
            Mostrando {indexOfFirstPatient + 1}-{Math.min(indexOfLastPatient, patients.length)} de {patients.length} pacientes
          </div>
        )}
      </div>

      {isLoading ? (
        // Skeleton Loading State
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white p-6 rounded-2xl shadow-lg animate-pulse">
              <div className="flex items-center space-x-4 mb-4">
                <div className="w-12 h-12 bg-slate-200 rounded-full"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                </div>
              </div>
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <div className="h-3 bg-slate-100 rounded"></div>
                <div className="h-3 bg-slate-100 rounded"></div>
              </div>
            </div>
          ))}
        </div>
      ) : patients.length === 0 ? (
        // Empty State
        <div className="text-center py-16 bg-white rounded-2xl shadow-md border border-slate-200/80">
          <FiInbox className="mx-auto text-5xl text-slate-300" />
          <h3 className="mt-4 text-xl font-semibold text-slate-700">No tienes pacientes asignados</h3>
          <p className="mt-1 text-slate-500">Cuando se te asigne un paciente, aparecerá aquí.</p>
        </div>
      ) : (
        // Patient Cards Grid con Paginación
        <div>
          {/* Grid de pacientes */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {currentPatients.map((patient, index) => {
              // --- LÓGICA DEL CONTADOR DE TERAPIAS ---
              const therapyCount = patient.therapiesSinceConsult || 0;
              const progressPercentage = (therapyCount / 10) * 100;

              return (
                <motion.div
                  key={patient.id}
                  onClick={() => onSelectPatient(patient)}
                  className="bg-white p-6 rounded-2xl shadow-lg flex flex-col justify-between hover:shadow-xl hover:bg-sky-100 hover:-translate-y-1 transition-all cursor-pointer"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <div>
                    <div className="flex items-center space-x-4 mb-4">
                      <div className="w-12 h-12 bg-sky-300 text-sky-900 rounded-full flex items-center justify-center font-bold text-xl">
                        {patient.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-slate-900">{patient.name}</h3>
                      </div>
                    </div>
                    <div className="space-y-3 text-sm text-slate-700 pt-4 border-t border-slate-200">
                      {patient.email && (
                        <p className="flex items-center space-x-2">
                          <FiMail size={14} className="text-sky-600" /> 
                          <span>{patient.email}</span>
                        </p>
                      )}
                      {patient.contact && (
                        <p className="flex items-center space-x-2">
                          <FiPhone size={14} className="text-sky-600" /> 
                          <span>{patient.contact}</span>
                        </p>
                      )}
                      {patient.dob && (
                        <p className="flex items-center space-x-2">
                          <FiCalendar size={14} className="text-sky-600" /> 
                          <span>Nacimiento: {patient.dob}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* --- SECCIÓN DEL CONTADOR DE TERAPIAS INTEGRADA --- */}
                  <div className="pt-4 mt-4 border-t border-slate-200">
                    <p className="flex items-center space-x-2 text-sm font-medium text-slate-800">
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
                </motion.div>
              );
            })}
          </div>

          {/* Componente de Paginación */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between space-y-4 sm:space-y-0">
              {/* Información de la página */}
              <div className="text-sm text-slate-600">
                Página {currentPage} de {totalPages}
              </div>

              {/* Controles de paginación */}
              <div className="flex items-center space-x-2">
                {/* Botón anterior */}
                <button
                  onClick={goToPreviousPage}
                  disabled={currentPage === 1}
                  className={`p-2 rounded-lg border border-slate-300 transition-colors ${
                    currentPage === 1 
                      ? 'text-slate-400 cursor-not-allowed' 
                      : 'text-slate-700 hover:bg-slate-100 hover:border-slate-400'
                  }`}
                >
                  <FiChevronLeft size={18} />
                </button>

                {/* Números de página */}
                <div className="flex items-center space-x-1">
                  {getPageNumbers().map((pageNumber, index) => (
                    <button
                      key={index}
                      onClick={() => typeof pageNumber === 'number' && paginate(pageNumber)}
                      className={`min-w-[40px] h-10 px-3 rounded-lg border transition-all ${
                        pageNumber === currentPage
                          ? 'bg-sky-500 text-white border-sky-500 shadow-sm'
                          : pageNumber === '...'
                          ? 'text-slate-500 border-transparent cursor-default'
                          : 'text-slate-700 border-slate-300 hover:bg-slate-100 hover:border-slate-400'
                      }`}
                      disabled={pageNumber === '...'}
                    >
                      {pageNumber}
                    </button>
                  ))}
                </div>

                {/* Botón siguiente */}
                <button
                  onClick={goToNextPage}
                  disabled={currentPage === totalPages}
                  className={`p-2 rounded-lg border border-slate-300 transition-colors ${
                    currentPage === totalPages 
                      ? 'text-slate-400 cursor-not-allowed' 
                      : 'text-slate-700 hover:bg-slate-100 hover:border-slate-400'
                  }`}
                >
                  <FiChevronRight size={18} />
                </button>
              </div>

              {/* Selector de página (opcional) */}
              <div className="flex items-center space-x-2 text-sm">
                <span className="text-slate-600">Ir a:</span>
                <select
                  value={currentPage}
                  onChange={(e) => paginate(Number(e.target.value))}
                  className="px-3 py-1 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                >
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <option key={page} value={page}>
                      {page}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
};

export default PatientsView;