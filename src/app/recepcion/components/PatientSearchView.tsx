'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { renderToStaticMarkup } from 'react-dom/server';
import { collection, query, where, getDocs, orderBy, doc, updateDoc, limit, startAfter, QueryConstraint, arrayUnion, arrayRemove, DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import { db, storage } from '@/lib/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { FiSearch, FiChevronLeft, FiChevronRight, FiPrinter, FiEdit, FiSave, FiX, FiPaperclip, FiPlus, FiTrash2, FiHeart, FiMapPin, FiFile, FiFileText, FiImage, FiDownload } from 'react-icons/fi';
import PrescriptionTemplate from './PrescriptionTemplate';

// --- Interfaces Actualizadas ---
interface PersonalHistoryItem {
  date: string;
  description: string;
}

interface Document {
  name: string;
  date: string;
  url: string;
  type: string;
  size?: number;
}

interface Patient {
  id: string;
  name: string;
  idNumber: string;
  personalHistory?: PersonalHistoryItem[];
  allergies?: string;
  currentIllness?: string;
  mainDiagnosis?: string;
  studies?: Study[];
  documents?: Document[];
}

interface Appointment {
  id: string;
  date: string;
  reportedSymptoms?: string;
  indicatedTreatment?: { name: string; details?: string }[];
  bodyArea?: string[];
  prescription?: string;
  status?: string;
  type?: 'consultation' | 'therapy';
}

interface Study {
    name: string;
    date: string;
    url: string;
}

// --- Componente Principal ---
interface PatientSearchViewProps {
    doctorName: string; 
}

const PatientSearchView: React.FC<PatientSearchViewProps> = ({ doctorName }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [isLoadingSearch, setIsLoadingSearch] = useState(false);
  
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patientHistory, setPatientHistory] = useState<Appointment[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [latestConsultation, setLatestConsultation] = useState<Appointment | null>(null);

  // --- Estado para el Expediente Médico ---
  const [isEditing, setIsEditing] = useState(false);
  const [editableData, setEditableData] = useState<Omit<Patient, 'id' | 'name' | 'idNumber' | 'studies'>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [showAddHistoryForm, setShowAddHistoryForm] = useState(false);
  const [newHistoryItem, setNewHistoryItem] = useState<PersonalHistoryItem>({ date: '', description: '' });
  
  const [showAddStudyForm, setShowAddStudyForm] = useState(false);
  const [newStudy, setNewStudy] = useState({ name: '', date: '' });
  const [studyFile, setStudyFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  const [showAddDocumentForm, setShowAddDocumentForm] = useState(false);
  const [newDocument, setNewDocument] = useState({ name: '', date: '' });
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentUploadProgress, setDocumentUploadProgress] = useState<number | null>(null);
  
  const [dateFilter, setDateFilter] = useState({ start: '', end: '' });

  // --- Estado de Paginación ---
  const [historyPage, setHistoryPage] = useState(1);
  const [lastHistoryDoc, setLastHistoryDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [pageStartSnapshots, setPageStartSnapshots] = useState<(QueryDocumentSnapshot<DocumentData> | null)[]>([null]);
  const [isLastHistoryPage, setIsLastHistoryPage] = useState(false);
  
  const HISTORY_PER_PAGE = 3;

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearchTerm(searchTerm), 500);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  useEffect(() => {
    if (debouncedSearchTerm.trim() === '') {
      setSearchResults([]);
      return;
    }
    const searchPatients = async () => {
      setIsLoadingSearch(true);
      const term = debouncedSearchTerm.charAt(0).toUpperCase() + debouncedSearchTerm.slice(1);
      const q = query(collection(db, 'patients'), orderBy('name'), where('name', '>=', term), where('name', '<=', term + '\uf8ff'));
      const snapshot = await getDocs(q);
      setSearchResults(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Patient)));
      setIsLoadingSearch(false);
    };
    searchPatients();
  }, [debouncedSearchTerm]);

  // Función para obtener la última consulta del paciente
  const fetchLatestConsultation = useCallback(async (patientId: string) => {
    try {
      const q = query(
        collection(db, 'appointments'),
        where('patientId', '==', patientId),
        where('type', '==', 'consultation'),
        where('status', '==', 'completed'),
        orderBy('date', 'desc'),
        limit(1)
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const consultation = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Appointment;
        setLatestConsultation(consultation);
      } else {
        setLatestConsultation(null);
      }
    } catch (error) {
      console.error("Error fetching latest consultation:", error);
      setLatestConsultation(null);
    }
  }, []);

  const fetchPatientHistory = useCallback(async (direction: 'next' | 'prev' | 'first' = 'first') => {
    if (!selectedPatient) return;
    setIsLoadingHistory(true);
    let constraints: QueryConstraint[] = [where('patientId', '==', selectedPatient.id), orderBy('date', 'desc')];
    if (dateFilter.start) constraints.push(where('date', '>=', dateFilter.start));
    if (dateFilter.end) constraints.push(where('date', '<=', dateFilter.end));

    let newPage = historyPage;
    if (direction === 'first') {
        newPage = 1;
        setPageStartSnapshots([null]);
    } else if (direction === 'next' && lastHistoryDoc) {
        constraints.push(startAfter(lastHistoryDoc));
        newPage = historyPage + 1;
    } else if (direction === 'prev') {
        const prevPageStart = pageStartSnapshots[historyPage - 2];
        if (prevPageStart) constraints.push(startAfter(prevPageStart));
        newPage = historyPage - 1;
    }

    constraints.push(limit(HISTORY_PER_PAGE));
    
    try {
        const q = query(collection(db, 'appointments'), ...constraints);
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
            setPatientHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment)));
            const firstDoc = snapshot.docs[0];
            const lastDoc = snapshot.docs[snapshot.docs.length - 1];
            setLastHistoryDoc(lastDoc);
            setIsLastHistoryPage(snapshot.docs.length < HISTORY_PER_PAGE);
            setHistoryPage(newPage);

            if (direction === 'next') setPageStartSnapshots(prev => [...prev, firstDoc]);
            else if (direction === 'prev') setPageStartSnapshots(prev => prev.slice(0, -1));

        } else {
            if (direction === 'first') setPatientHistory([]);
            setIsLastHistoryPage(true);
        }
    } catch (error) {
        console.error("Error fetching patient history:", error);
        setPatientHistory([]);
    } finally {
        setIsLoadingHistory(false);
    }
  }, [selectedPatient, dateFilter, historyPage, lastHistoryDoc, pageStartSnapshots]);

  useEffect(() => {
    if (selectedPatient) {
      fetchPatientHistory('first');
      fetchLatestConsultation(selectedPatient.id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPatient, dateFilter]);

  // --- LÓGICA DE GESTIÓN DE DATOS DEL PACIENTE ACTUALIZADA ---
  const handleSelectPatient = useCallback((patient: Patient) => {
    setSelectedPatient(patient);
    setEditableData({
      personalHistory: patient.personalHistory || [],
      allergies: patient.allergies || '',
      currentIllness: patient.currentIllness || '',
      mainDiagnosis: patient.mainDiagnosis || ''
    });
  }, []);
  
  const handleSavePatientDetails = async () => {
    if (!selectedPatient) return;
    setIsSaving(true);
    try {
      const patientRef = doc(db, 'patients', selectedPatient.id);
      await updateDoc(patientRef, editableData);
      setSelectedPatient(prev => prev ? { ...prev, ...editableData } : null);
      setIsEditing(false);
    } catch (error) { 
      console.error("Error updating patient details:", error);
    } finally { 
      setIsSaving(false); 
    }
  };

  const handleAddPersonalHistory = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newHistoryItem.date || !newHistoryItem.description || !selectedPatient) return;
      
      try {
        const patientRef = doc(db, 'patients', selectedPatient.id);
        await updateDoc(patientRef, { personalHistory: arrayUnion(newHistoryItem) });
        const updatedHistory = [...(selectedPatient.personalHistory || []), newHistoryItem];
        setSelectedPatient({...selectedPatient, personalHistory: updatedHistory});
        setEditableData(prev => ({...prev, personalHistory: updatedHistory}));
        setNewHistoryItem({ date: '', description: '' });
        setShowAddHistoryForm(false);
      } catch (error) {
        console.error("Error adding personal history:", error);
      }
  };

  const handleRemovePersonalHistory = async (itemToRemove: PersonalHistoryItem) => {
      if (!selectedPatient) return;
      try {
        const patientRef = doc(db, 'patients', selectedPatient.id);
        await updateDoc(patientRef, { personalHistory: arrayRemove(itemToRemove) });
        const updatedHistory = selectedPatient.personalHistory?.filter(item => item.date !== itemToRemove.date || item.description !== itemToRemove.description);
        setSelectedPatient({...selectedPatient, personalHistory: updatedHistory});
        setEditableData(prev => ({...prev, personalHistory: updatedHistory}));
      } catch (error) {
        console.error("Error removing personal history:", error);
      }
  };

  const handleAddStudy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudy.name || !newStudy.date || !studyFile || !selectedPatient) {
      alert('Por favor, complete todos los campos y seleccione un archivo.');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    // Crear una referencia única para el archivo
    const filePath = `studies/${selectedPatient.id}/${Date.now()}-${studyFile.name}`;
    const storageRef = ref(storage, filePath);
    const uploadTask = uploadBytesResumable(storageRef, studyFile);

    uploadTask.on('state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setUploadProgress(progress);
      },
      (error) => {
        console.error("Error al subir archivo:", error);
        alert('Error al subir el archivo. Inténtelo de nuevo.');
        setIsUploading(false);
        setUploadProgress(null);
      },
      async () => {
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          const patientRef = doc(db, 'patients', selectedPatient.id);
          const studyData = { ...newStudy, url: downloadURL };
          
          await updateDoc(patientRef, { studies: arrayUnion(studyData) });
          
          const updatedStudies = [...(selectedPatient.studies || []), studyData];
          setSelectedPatient(prev => prev ? { ...prev, studies: updatedStudies } : null);

          // Resetear estados
          setNewStudy({ name: '', date: '' });
          setStudyFile(null);
          setShowAddStudyForm(false);
          setUploadProgress(null);
        } catch (error) {
          console.error("Error guardando el estudio:", error);
          alert("Error al guardar la referencia del estudio.");
        } finally {
          setIsUploading(false);
        }
      }
    );
  };

  // --- Función auxiliar para obtener el ícono según el tipo de archivo ---
  const getFileIcon = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(extension || '')) {
      return <FiImage className="text-blue-500" />;
    } else if (['pdf'].includes(extension || '')) {
      return <FiFileText className="text-red-500" />;
    } else if (['doc', 'docx'].includes(extension || '')) {
      return <FiFileText className="text-blue-600" />;
    } else if (['xls', 'xlsx'].includes(extension || '')) {
      return <FiFileText className="text-green-600" />;
    }
    return <FiFile className="text-slate-500" />;
  };

  // --- Función para formatear el tamaño del archivo ---
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
  };

  // --- Manejador para agregar documentos generales ---
  const handleAddDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDocument.name || !newDocument.date || !documentFile || !selectedPatient) {
      alert('Por favor, complete todos los campos y seleccione un archivo.');
      return;
    }

    setIsUploading(true);
    setDocumentUploadProgress(0);

    // Crear una referencia única para el archivo
    const filePath = `documents/${selectedPatient.id}/${Date.now()}-${documentFile.name}`;
    const storageRef = ref(storage, filePath);
    const uploadTask = uploadBytesResumable(storageRef, documentFile);

    uploadTask.on('state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setDocumentUploadProgress(progress);
      },
      (error) => {
        console.error("Error al subir documento:", error);
        alert('Error al subir el documento. Inténtelo de nuevo.');
        setIsUploading(false);
        setDocumentUploadProgress(null);
      },
      async () => {
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          const patientRef = doc(db, 'patients', selectedPatient.id);
          
          const documentData: Document = {
            name: newDocument.name,
            date: newDocument.date,
            url: downloadURL,
            type: documentFile.type,
            size: documentFile.size
          };
          
          await updateDoc(patientRef, { documents: arrayUnion(documentData) });
          
          const updatedDocuments = [...(selectedPatient.documents || []), documentData];
          setSelectedPatient(prev => prev ? { ...prev, documents: updatedDocuments } : null);

          // Resetear estados
          setNewDocument({ name: '', date: '' });
          setDocumentFile(null);
          setShowAddDocumentForm(false);
          setDocumentUploadProgress(null);
        } catch (error) {
          console.error("Error guardando el documento:", error);
          alert("Error al guardar la referencia del documento.");
        } finally {
          setIsUploading(false);
        }
      }
    );
  };

  // --- Manejador para eliminar documentos ---
  const handleRemoveDocument = async (documentToRemove: Document) => {
    if (!confirm('¿Está seguro de que desea eliminar este documento?') || !selectedPatient) return;
    try {
      const patientRef = doc(db, 'patients', selectedPatient.id);
      await updateDoc(patientRef, { documents: arrayRemove(documentToRemove) });
      const updatedDocuments = selectedPatient.documents?.filter(doc => 
        doc.url !== documentToRemove.url
      );
      setSelectedPatient({ ...selectedPatient, documents: updatedDocuments });
    } catch (error) {
      console.error("Error al eliminar documento:", error);
      alert('Error al eliminar el documento.');
    }
  };

  const handlePrint = (prescriptionText: string) => {
      if (!prescriptionText || !selectedPatient) return;
      const today = new Date().toLocaleDateString('es-HN', { day: 'numeric', month: 'long', year: 'numeric' });
      const prescriptionData = {
          patientName: selectedPatient.name,
          prescriptionText: prescriptionText,
          doctorName: doctorName,
          date: today
      };
      const printWindow = window.open('', '_blank');
      if (printWindow) {
          const html = renderToStaticMarkup(<html><head><title>Receta Médica</title><script src="https://cdn.tailwindcss.com"></script></head><body><PrescriptionTemplate {...prescriptionData} /></body></html>);
          printWindow.document.write(html);
          printWindow.document.close();
          printWindow.focus();
          setTimeout(() => { printWindow.print(); printWindow.close(); }, 1000);
      }
  };

  // --- RENDERIZADO CON EXPEDIENTE MÉDICO ACTUALIZADO ---
  if (selectedPatient) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <div className="flex items-center space-x-3 mb-6">
            <button onClick={() => setSelectedPatient(null)} className="p-2 rounded-full hover:bg-slate-200 transition-colors"><FiChevronLeft size={24} /></button>
            <div>
                <h2 className="text-3xl font-bold text-slate-900">Expediente de {selectedPatient.name}</h2>
                <p className="text-slate-500">Cédula: {selectedPatient.idNumber}</p>
            </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 flex flex-col gap-8 self-start">
                {/* Información de la Última Consulta */}
                {latestConsultation && (
                  <div className="bg-white p-6 rounded-2xl shadow-xl border border-slate-200/80">
                    <h3 className="text-xl font-bold text-slate-800 mb-4">Información de Última Consulta</h3>
                    <div className="space-y-4 text-sm">
                      {/* Tratamiento Indicado */}
                      {latestConsultation.indicatedTreatment && latestConsultation.indicatedTreatment.length > 0 && (
                        <div className="p-3 bg-sky-100 border-l-4 border-sky-500 rounded-r-lg">
                          <div className="flex items-start">
                            <FiHeart className="mr-3 mt-1 text-sky-600 flex-shrink-0" />
                            <div>
                              <strong className="text-sky-800">Tratamiento Indicado:</strong>
                              <ul className="mt-1 space-y-1">
                                {latestConsultation.indicatedTreatment.map((treatment, index) => (
                                  <li key={index} className="text-slate-700">
                                    • {treatment.name}
                                    {treatment.details && (
                                      <p className="text-xs text-slate-600 ml-2 mt-1">{treatment.details}</p>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Zona del Cuerpo */}
                      {latestConsultation.bodyArea && latestConsultation.bodyArea.length > 0 && (
                        <div className="p-3 bg-indigo-100 border-l-4 border-indigo-500 rounded-r-lg">
                          <div className="flex items-start">
                            <FiMapPin className="mr-3 mt-1 text-indigo-600 flex-shrink-0" />
                            <div>
                              <strong className="text-indigo-800">Zona del Cuerpo:</strong>
                              <p className="text-slate-700 mt-1">{latestConsultation.bodyArea.join(', ')}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Tipo de Terapia */}
                      <div className="p-3 bg-emerald-100 border-l-4 border-emerald-500 rounded-r-lg">
                        <div className="flex items-start">
                          <FiHeart className="mr-3 mt-1 text-emerald-600 flex-shrink-0" />
                          <div>
                            <strong className="text-emerald-800">Tipo de Cita:</strong>
                            <p className="text-slate-700 mt-1 capitalize">
                              {latestConsultation.type === 'consultation' ? 'Consulta Médica' : 
                               latestConsultation.type === 'therapy' ? 'Terapia' : 
                               latestConsultation.type || 'No especificado'}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Fecha de la Consulta */}
                      <div className="text-xs text-slate-500 text-center pt-2 border-t border-slate-200">
                        Consulta realizada el: {new Date(latestConsultation.date + 'T00:00:00-06:00').toLocaleDateString('es-HN', { 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Expediente Médico Reestructurado */}
                <div className="bg-white p-6 rounded-2xl shadow-xl border border-slate-200/80">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-slate-800">Expediente Médico</h3>
                    {!isEditing && (
                      <button onClick={() => setIsEditing(true)} className="p-2 text-slate-500 hover:text-sky-600">
                        <FiEdit />
                      </button>
                    )}
                  </div>
                  {isEditing ? (
                    // --- VISTA DE EDICIÓN ---
                    <div className="space-y-4 text-sm">
                        {/* 1. Antecedentes Personales (Edición) - No editable directamente aquí, se gestiona con añadir/quitar */}
                        <label className="font-semibold text-slate-600">Alergias</label>
                        <textarea 
                          value={editableData.allergies} 
                          onChange={e => setEditableData({...editableData, allergies: e.target.value})} 
                          rows={2} 
                          className="w-full mt-1 p-2 rounded-md border-slate-300"
                        />
                        <label className="font-semibold text-slate-600">Enfermedad Actual</label>
                        <textarea 
                          value={editableData.currentIllness} 
                          onChange={e => setEditableData({...editableData, currentIllness: e.target.value})} 
                          rows={3} 
                          className="w-full mt-1 p-2 rounded-md border-slate-300"
                        />
                        <label className="font-semibold text-slate-600">Diagnóstico Principal</label>
                        <textarea 
                          value={editableData.mainDiagnosis} 
                          onChange={e => setEditableData({...editableData, mainDiagnosis: e.target.value})} 
                          rows={3} 
                          className="w-full mt-1 p-2 rounded-md border-slate-300"
                        />
                        <div className="flex gap-2 pt-2">
                          <button 
                            onClick={handleSavePatientDetails} 
                            disabled={isSaving} 
                            className="flex-1 py-2 px-4 bg-sky-600 text-white rounded-lg hover:bg-sky-700 flex items-center justify-center space-x-2 disabled:opacity-50"
                          >
                            {isSaving ? 'Guardando...' : <><FiSave/><span>Guardar</span></>}
                          </button>
                          <button 
                            onClick={() => setIsEditing(false)} 
                            className="p-2 text-slate-600 hover:bg-slate-200 rounded-lg"
                          >
                            <FiX/>
                          </button>
                        </div>
                    </div>
                  ) : (
                    // --- VISTA DE LECTURA ---
                    <div className="space-y-4 text-sm">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-500">Alergias:</span>
                          <span className="text-slate-700 whitespace-pre-wrap">{editableData.allergies || 'No especificadas'}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-500">Enfermedad Actual:</span>
                          <span className="text-slate-700 whitespace-pre-wrap">{editableData.currentIllness || 'No especificada'}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-500">Diagnóstico Principal:</span>
                          <span className="text-slate-700 whitespace-pre-wrap">{editableData.mainDiagnosis || 'No especificado'}</span>
                        </div>
                    </div>
                  )}
                </div>

                {/* 1. Antecedentes Personales (Visualización y Gestión) */}
                <div className="bg-white p-6 rounded-2xl shadow-xl border border-slate-200/80">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-slate-800">Antecedentes Personales</h3>
                    <button 
                      onClick={() => setShowAddHistoryForm(!showAddHistoryForm)} 
                      className="p-2 rounded-full hover:bg-slate-200 text-slate-500"
                    >
                      <FiPlus />
                    </button>
                  </div>
                  <AnimatePresence>
                    {showAddHistoryForm && (
                      <motion.form 
                        onSubmit={handleAddPersonalHistory} 
                        initial={{ opacity: 0, height: 0 }} 
                        animate={{ opacity: 1, height: 'auto' }} 
                        exit={{ opacity: 0, height: 0 }} 
                        className="space-y-2 p-4 mb-4 bg-slate-50 rounded-lg border overflow-hidden"
                      >
                        <input 
                          type="date" 
                          value={newHistoryItem.date} 
                          onChange={e => setNewHistoryItem({ ...newHistoryItem, date: e.target.value })} 
                          className="w-full p-2 border rounded-md" 
                          required 
                        />
                        <textarea 
                          placeholder="Descripción del antecedente..." 
                          value={newHistoryItem.description} 
                          onChange={e => setNewHistoryItem({ ...newHistoryItem, description: e.target.value })} 
                          className="w-full p-2 border rounded-md" 
                          rows={3} 
                          required 
                        />
                        <button type="submit" className="w-full py-2 bg-sky-600 text-white rounded-md">
                          Guardar Antecedente
                        </button>
                      </motion.form>
                    )}
                  </AnimatePresence>
                  <ul className="space-y-3 max-h-48 overflow-y-auto pr-2">
                      {selectedPatient.personalHistory?.length ? selectedPatient.personalHistory.map((item, index) => (
                          <li key={index} className="flex items-start justify-between p-3 bg-slate-100 rounded-lg">
                              <div>
                                  <p className="font-semibold text-slate-700">
                                    {new Date(item.date + 'T00:00:00-06:00').toLocaleDateString('es-HN', { year: 'numeric', month: 'long', day: 'numeric' })}
                                  </p>
                                  <p className="text-sm text-slate-600 whitespace-pre-wrap">{item.description}</p>
                              </div>
                              <button 
                                onClick={() => handleRemovePersonalHistory(item)} 
                                className="p-1 text-red-500 hover:text-red-700 flex-shrink-0"
                              >
                                <FiTrash2 size={16}/>
                              </button>
                          </li>
                      )) : <p className="text-center text-slate-500 py-4">No hay antecedentes.</p>}
                  </ul>
                </div>
                
                {/* Estudios y Archivos (sin cambios) */}
                 <div className="bg-white p-6 rounded-2xl shadow-xl border border-slate-200/80">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-xl font-bold text-slate-800">Estudios y Archivos</h3>
                      <button 
                        onClick={() => setShowAddStudyForm(!showAddStudyForm)} 
                        className="p-2 rounded-full hover:bg-slate-200 text-slate-500"
                      >
                        <FiPlus />
                      </button>
                    </div>
                    <AnimatePresence>
                      {showAddStudyForm && (
                        <motion.form 
                          onSubmit={handleAddStudy} 
                          initial={{ opacity: 0, height: 0 }} 
                          animate={{ opacity: 1, height: 'auto' }} 
                          exit={{ opacity: 0, height: 0 }} 
                          className="space-y-2 p-4 mb-4 bg-slate-50 rounded-lg border overflow-hidden"
                        >
                          <input 
                            type="text" 
                            placeholder="Nombre del estudio" 
                            value={newStudy.name} 
                            onChange={e => setNewStudy({...newStudy, name: e.target.value})} 
                            className="w-full p-2 border rounded-md" 
                            required 
                          />
                          <input 
                            type="date" 
                            value={newStudy.date} 
                            onChange={e => setNewStudy({...newStudy, date: e.target.value})} 
                            className="w-full p-2 border rounded-md" 
                            required 
                          />
                          <input 
                            type="file"
                            onChange={e => setStudyFile(e.target.files ? e.target.files[0] : null)}
                            className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-sky-50 file:text-sky-700 hover:file:bg-sky-100"
                            accept="image/*,application/pdf,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                            required 
                          />
                          {uploadProgress !== null && (
                            <div className="w-full bg-slate-200 rounded-full h-2.5">
                              <div className="bg-sky-600 h-2.5 rounded-full" style={{ width: `${uploadProgress}%` }}></div>
                            </div>
                          )}
                          <button type="submit" disabled={isUploading} className="w-full py-2 bg-sky-600 text-white rounded-md disabled:bg-slate-400">
                            {isUploading ? `Subiendo... ${Math.round(uploadProgress || 0)}%` : 'Guardar Estudio'}
                          </button>
                        </motion.form>
                      )}
                    </AnimatePresence>
                    <ul className="space-y-3 max-h-40 overflow-y-auto pr-2">
                      {selectedPatient.studies?.length ? selectedPatient.studies.map((study: Study, index: number) => (
                        <li key={index} className="flex items-center justify-between p-3 bg-slate-100 rounded-lg">
                          <div className="flex items-center space-x-3">
                            <FiPaperclip className="text-slate-500"/>
                            <p className="font-semibold text-slate-700">
                              {study.name} 
                              <span className="text-xs text-slate-400"> ({new Date(study.date + 'T00:00:00-06:00').toLocaleDateString('es-HN')})</span>
                            </p>
                          </div>
                          <a 
                            href={study.url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-sm font-semibold text-sky-600 hover:underline"
                          >
                            Ver
                          </a>
                        </li>
                      )) : <p className="text-center text-slate-500 py-4">No hay estudios.</p>}
                    </ul>
                  </div>

                {/* Documentos del Expediente */}
                <div className="bg-white p-6 rounded-2xl shadow-xl border border-slate-200/80">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-slate-800">Documentos del Expediente</h3>
                    <button 
                      onClick={() => setShowAddDocumentForm(!showAddDocumentForm)} 
                      className="p-2 rounded-full hover:bg-slate-200 text-slate-500"
                    >
                      <FiPlus />
                    </button>
                  </div>
                  <AnimatePresence>
                    {showAddDocumentForm && (
                      <motion.form 
                        onSubmit={handleAddDocument} 
                        initial={{ opacity: 0, height: 0 }} 
                        animate={{ opacity: 1, height: 'auto' }} 
                        exit={{ opacity: 0, height: 0 }} 
                        className="space-y-2 p-4 mb-4 bg-slate-50 rounded-lg border overflow-hidden"
                      >
                        <input 
                          type="text" 
                          placeholder="Nombre del documento" 
                          value={newDocument.name} 
                          onChange={e => setNewDocument({...newDocument, name: e.target.value})} 
                          className="w-full p-2 border rounded-md" 
                          required 
                        />
                        <input 
                          type="date" 
                          value={newDocument.date} 
                          onChange={e => setNewDocument({...newDocument, date: e.target.value})} 
                          className="w-full p-2 border rounded-md" 
                          required 
                        />
                        <div className="space-y-1">
                          <input 
                            type="file"
                            onChange={e => setDocumentFile(e.target.files ? e.target.files[0] : null)}
                            accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.webp"
                            className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-sky-50 file:text-sky-700 hover:file:bg-sky-100"
                            required 
                          />
                          <p className="text-xs text-slate-500">Formatos: PDF, Word, Excel, imágenes (máx. 10MB)</p>
                        </div>
                        {documentUploadProgress !== null && (
                          <div className="w-full bg-slate-200 rounded-full h-2.5">
                            <div className="bg-sky-600 h-2.5 rounded-full" style={{ width: `${documentUploadProgress}%` }}></div>
                          </div>
                        )}
                        <button type="submit" disabled={isUploading} className="w-full py-2 bg-sky-600 text-white rounded-md disabled:bg-slate-400">
                          {isUploading && documentUploadProgress !== null ? `Subiendo... ${Math.round(documentUploadProgress)}%` : 'Guardar Documento'}
                        </button>
                      </motion.form>
                    )}
                  </AnimatePresence>
                  <ul className="space-y-3 max-h-48 overflow-y-auto pr-2">
                    {selectedPatient.documents?.length ? (
                      selectedPatient.documents.map((document: Document, index: number) => (
                        <li key={index} className="flex items-center justify-between p-3 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">
                          <div className="flex items-center space-x-3 flex-1 min-w-0">
                            {getFileIcon(document.name)}
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-slate-700 truncate">{document.name}</p>
                              <p className="text-xs text-slate-400">
                                {new Date(document.date + 'T00:00:00-06:00').toLocaleDateString('es-HN', { year: 'numeric', month: 'short', day: 'numeric' })}
                                {document.size && ` • ${formatFileSize(document.size)}`}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <a 
                              href={document.url} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="p-2 text-sky-600 hover:bg-sky-100 rounded-full transition-colors"
                              title="Descargar"
                            >
                              <FiDownload size={18} />
                            </a>
                            <button 
                              onClick={() => handleRemoveDocument(document)} 
                              className="p-2 text-red-500 hover:bg-red-100 rounded-full transition-colors"
                              title="Eliminar"
                            >
                              <FiTrash2 size={18} />
                            </button>
                          </div>
                        </li>
                      ))
                    ) : (
                      <p className="text-center text-slate-500 py-4">No hay documentos registrados.</p>
                    )}
                  </ul>
                </div>
            </div>
            {/* Historial de Citas (sin cambios lógicos) */}
            <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-xl border border-slate-200/80 space-y-6">
              <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <h3 className="text-xl font-bold text-slate-800">Historial de Citas</h3>
                <div className="flex gap-2 items-center text-sm">
                  <label htmlFor="startDate">Desde:</label>
                  <input 
                    type="date" 
                    id="startDate" 
                    value={dateFilter.start} 
                    onChange={e => setDateFilter({...dateFilter, start: e.target.value})} 
                    className="p-1 border rounded-md"
                  />
                  <label htmlFor="endDate">Hasta:</label>
                  <input 
                    type="date" 
                    id="endDate" 
                    value={dateFilter.end} 
                    onChange={e => setDateFilter({...dateFilter, end: e.target.value})} 
                    className="p-1 border rounded-md"
                  />
                </div>
              </div>
              <div className="space-y-4 min-h-[300px] relative">
                  <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-slate-200 rounded"></div>
                  {isLoadingHistory ? (
                      // --- LOADING SKELETON ---
                      Array.from({ length: 3 }).map((_, i) => (
                          <div key={i} className="pl-10 relative animate-pulse">
                              <div className="absolute left-1.5 top-1 w-5 h-5 bg-slate-200 rounded-full border-4 border-white"></div>
                              <div className="p-4 bg-slate-100 rounded-lg">
                                  <div className="h-4 bg-slate-200 rounded w-1/4 mb-3"></div>
                                  <div className="h-3 bg-slate-200 rounded w-1/2 mb-2"></div>
                                  <div className="h-3 bg-slate-200 rounded w-3/4"></div>
                              </div>
                          </div>
                      ))
                  ) : patientHistory.length > 0 ? (
                      patientHistory.map(appt => (
                          <div key={appt.id} className="pl-10 relative">
                              <div className="absolute left-1.5 top-1 w-5 h-5 bg-sky-500 rounded-full border-4 border-white"></div>
                              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 relative">
                                  <div className="flex justify-between items-center mb-2">
                                    <p className="font-bold text-slate-800">
                                      {new Date(appt.date + 'T00:00:00-06:00').toLocaleDateString('es-HN', { year: 'numeric', month: 'long', day: 'numeric' })}
                                    </p>
                                    <span className={`px-2 py-1 text-xs font-semibold rounded-full capitalize ${appt.status === 'completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                                      {appt.status || 'Programada'}
                                    </span>
                                  </div>
                                  <h4 className="font-semibold text-slate-600">Síntomas Reportados:</h4>
                                  <p className="text-sm text-slate-500 mb-3 whitespace-pre-wrap">{appt.reportedSymptoms || 'N/A'}</p>
                                  {appt.prescription && (
                                    <button 
                                      onClick={() => handlePrint(appt.prescription!)} 
                                      className="text-sm text-sky-600 font-semibold mt-2 flex items-center space-x-1 hover:underline"
                                    >
                                      <FiPrinter/>
                                      <span>Ver Receta</span>
                                    </button>
                                  )}
                              </div>
                          </div>
                      ))
                  ) : <div className="flex items-center justify-center h-full"><p className="text-center text-slate-500 py-8">No se encontraron citas para los filtros seleccionados.</p></div>}
              </div>
              <div className="flex justify-center items-center space-x-4 pt-4 border-t">
                <button 
                  onClick={() => fetchPatientHistory('prev')} 
                  disabled={historyPage <= 1 || isLoadingHistory} 
                  className="flex items-center space-x-2 px-4 py-2 bg-slate-200 rounded-lg disabled:opacity-50 transition-colors hover:bg-slate-300"
                >
                  <FiChevronLeft/>
                  <span>Anterior</span>
                </button>
                <span className="font-semibold text-slate-600">Página {historyPage}</span>
                <button 
                  onClick={() => fetchPatientHistory('next')} 
                  disabled={isLastHistoryPage || isLoadingHistory} 
                  className="flex items-center space-x-2 px-4 py-2 bg-slate-200 rounded-lg disabled:opacity-50 transition-colors hover:bg-slate-300"
                >
                  <span>Siguiente</span>
                  <FiChevronRight/>
                </button>
              </div>
            </div>
        </div>
      </motion.div>
    );
  }

  // --- Vista de Búsqueda (sin cambios) ---
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <h2 className="text-3xl font-bold text-slate-900 mb-6">Buscar Expediente de Paciente</h2>
      {/* Input de búsqueda */}
      <div className="relative mb-6">
        <input 
          type="text" 
          placeholder="Escribe el nombre del paciente..." 
          value={searchTerm} 
          onChange={(e) => setSearchTerm(e.target.value)} 
          className="pl-12 pr-4 py-3 w-full rounded-full bg-white border-2 border-slate-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
        />
        <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
      </div>
      {/* Resultados de búsqueda */}
      <div className="bg-white p-6 rounded-2xl shadow-xl border border-slate-200/80 min-h-[400px]">
        {isLoadingSearch ? <div className="text-center text-slate-500 pt-10">Buscando...</div> : searchResults.length > 0 ? (
          <ul className="space-y-3">
            {searchResults.map(patient => (
              <li 
                key={patient.id} 
                onClick={() => handleSelectPatient(patient)} 
                className="p-4 bg-slate-50 rounded-lg hover:bg-sky-100 cursor-pointer transition-colors"
              >
                <p className="font-semibold text-slate-800">{patient.name}</p>
                <p className="text-sm text-slate-500">{patient.idNumber}</p>
              </li>
            ))}
          </ul>
        ) : <p className="text-center text-slate-500 pt-10">{debouncedSearchTerm ? 'No se encontraron pacientes.' : 'Escribe un nombre para empezar a buscar.'}</p>}
      </div>
    </motion.div>
  );
};

export default PatientSearchView;