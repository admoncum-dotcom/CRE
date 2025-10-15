'use client';

import React, { useState, useEffect } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { doc, updateDoc, collection, query, where, onSnapshot, orderBy, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db, storage } from '@/lib/firebase'; // 1. Importar storage
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage"; // 2. Importar funciones de storage
import BodySelector from './BodySelector';
import PrescriptionTemplate from './PrescriptionTemplate';
import { FiX, FiSave, FiCheckSquare, FiPlusCircle, FiPrinter, FiPaperclip, FiPlus, FiEdit, FiTrash2, FiFile, FiFileText, FiImage, FiDownload } from 'react-icons/fi';

// --- Interfaces y Tipos Actualizados ---
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

interface PatientData {
  personalHistory?: PersonalHistoryItem[];
  allergies?: string;
  currentIllness?: string;
  mainDiagnosis?: string;
  studies?: Study[];
  documents?: Document[];
}

interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  date: string;
  time: string;
  status?: string; 
  prescription?: string;
  indicatedTreatment?: SelectedTreatment[];
  reportedSymptoms?: string;
  bodyArea?: string[];
}

interface SelectedTreatment {
  name: string;
  details?: string;
}

interface Study {
  name: string;
  date: string;
  url: string;
}

interface AppointmentDetailsModalProps {
  appointment: Appointment;
  doctorName: string;
  onClose: () => void;
}

const AppointmentDetailsModal: React.FC<AppointmentDetailsModalProps> = ({ appointment, doctorName, onClose }) => {
  const [activeTab, setActiveTab] = useState<'current' | 'history'>('current');
  const [patientData, setPatientData] = useState<PatientData | null>(null);
  const [history, setHistory] = useState<Appointment[]>([]);
  const [treatmentPlans, setTreatmentPlans] = useState<string[]>([]); // 1. Nuevo estado para planes
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  
  // --- Estados para el Expediente Médico ---
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [editablePatientData, setEditablePatientData] = useState<PatientData>({});
  const [showAddHistoryForm, setShowAddHistoryForm] = useState(false);
  const [newHistoryItem, setNewHistoryItem] = useState<PersonalHistoryItem>({ date: '', description: '' });

  // --- Estados para Estudios ---
  const [showAddStudyForm, setShowAddStudyForm] = useState(false);
  const [newStudy, setNewStudy] = useState({ name: '', date: '' });
  const [studyFile, setStudyFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  // --- Estados para Documentos Generales ---
  const [showAddDocumentForm, setShowAddDocumentForm] = useState(false);
  const [newDocument, setNewDocument] = useState({ name: '', date: '' });
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentUploadProgress, setDocumentUploadProgress] = useState<number | null>(null);

  // --- Estados de la Sesión Actual ---
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [showPrescription, setShowPrescription] = useState(!!appointment.prescription);
  const [reportedSymptoms, setReportedSymptoms] = useState(appointment.reportedSymptoms || '');
  const [prescription, setPrescription] = useState(appointment.prescription || '');
  const [indicatedTreatment, setIndicatedTreatment] = useState<SelectedTreatment[]>(appointment.indicatedTreatment || []);
  const [bodyArea, setBodyArea] = useState<string[]>(appointment.bodyArea || []);

  useEffect(() => {
    const patientRef = doc(db, 'patients', appointment.patientId);
    const unsubPatient = onSnapshot(patientRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data() as PatientData;
        setPatientData(data);
        setEditablePatientData({ // Sincroniza el estado editable
          personalHistory: data.personalHistory || [],
          allergies: data.allergies || '',
          currentIllness: data.currentIllness || '',
          mainDiagnosis: data.mainDiagnosis || '',
        });
      }
    });

    const q = query(collection(db, 'appointments'), where('patientId', '==', appointment.patientId), orderBy('date', 'desc'));
    const unsubHistory = onSnapshot(q, (snapshot) => {
      const historicalData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment)).filter(appt => appt.id !== appointment.id && appt.status === 'completed');
      setHistory(historicalData);
      setIsLoadingHistory(false);
    });

    // Sincronización en tiempo real para los estudios del paciente
    const unsubStudies = onSnapshot(patientRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data() as PatientData;
        // Actualiza solo la parte de los estudios para no interferir con la edición
        setPatientData(prev => ({ ...prev, studies: data.studies || [] }));
      }
    });

    return () => { unsubPatient(); unsubHistory(); };
  }, [appointment.patientId, appointment.id]);

  // 2. Cargar los planes de tratamiento dinámicamente
  useEffect(() => {
    const plansCollection = collection(db, 'treatmentPlans');
    const q = query(plansCollection, orderBy('name'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const plansData = snapshot.docs.map(doc => doc.data().name as string);
      setTreatmentPlans(plansData);
    });
    return () => unsubscribe();
  }, []);

  // --- Manejadores para Terapias Múltiples ---
  const handleTherapyToggle = (therapyName: string) => {
    setIndicatedTreatment(prev => {
      const exists = prev.some(t => t.name === therapyName);
      if (exists) {
        return prev.filter(t => t.name !== therapyName);
      } else {
        return [...prev, { name: therapyName, details: '' }];
      }
    });
  };

  const handleTherapyDetailsChange = (therapyName: string, details: string) => {
    setIndicatedTreatment(prev => prev.map(t => t.name === therapyName ? { ...t, details } : t));
  };
  
  // --- Manejadores para el Expediente ---
  const handleAddPersonalHistory = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newHistoryItem.date || !newHistoryItem.description) return;
      const patientRef = doc(db, 'patients', appointment.patientId);
      await updateDoc(patientRef, { personalHistory: arrayUnion(newHistoryItem) });
      setNewHistoryItem({ date: '', description: '' });
      setShowAddHistoryForm(false);
  };

  const handleRemovePersonalHistory = async (itemToRemove: PersonalHistoryItem) => {
      const patientRef = doc(db, 'patients', appointment.patientId);
      await updateDoc(patientRef, { personalHistory: arrayRemove(itemToRemove) });
  };

  const handleSaveInfo = async () => {
      const patientRef = doc(db, 'patients', appointment.patientId);
      await updateDoc(patientRef, {
        personalHistory: editablePatientData.personalHistory,
        allergies: editablePatientData.allergies,
        currentIllness: editablePatientData.currentIllness,
        mainDiagnosis: editablePatientData.mainDiagnosis,
      });
      setIsEditingInfo(false);
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
  
  // --- Manejadores para Estudios y Sesión ---
  const handleAddStudy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudy.name || !newStudy.date || !studyFile) {
      setMessage('Por favor, complete todos los campos y seleccione un archivo.');
      return;
    }

    setIsLoading(true);
    setMessage('Subiendo archivo...');
    setUploadProgress(0);

    // Crear una referencia única para el archivo
    const filePath = `studies/${appointment.patientId}/${Date.now()}-${studyFile.name}`;
    const storageRef = ref(storage, filePath);
    const uploadTask = uploadBytesResumable(storageRef, studyFile);

    uploadTask.on('state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setUploadProgress(progress);
      },
      (error) => {
        console.error("Error al subir archivo:", error);
        setMessage('Error al subir el archivo. Inténtelo de nuevo.');
        setIsLoading(false);
        setUploadProgress(null);
      },
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        const patientRef = doc(db, 'patients', appointment.patientId);
        await updateDoc(patientRef, { studies: arrayUnion({ ...newStudy, url: downloadURL }) });
        
        // Resetear estados
        setNewStudy({ name: '', date: '' });
        setStudyFile(null);
        setShowAddStudyForm(false);
        setIsLoading(false);
        setUploadProgress(null);
        setMessage('Estudio guardado con éxito.');
        setTimeout(() => setMessage(''), 3000);
      }
    );
  };

  // --- Manejador para agregar documentos generales ---
  const handleAddDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDocument.name || !newDocument.date || !documentFile) {
      setMessage('Por favor, complete todos los campos y seleccione un archivo.');
      return;
    }

    setIsLoading(true);
    setMessage('Subiendo documento...');
    setDocumentUploadProgress(0);

    // Crear una referencia única para el archivo
    const filePath = `documents/${appointment.patientId}/${Date.now()}-${documentFile.name}`;
    const storageRef = ref(storage, filePath);
    const uploadTask = uploadBytesResumable(storageRef, documentFile);

    uploadTask.on('state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setDocumentUploadProgress(progress);
      },
      (error) => {
        console.error("Error al subir documento:", error);
        setMessage('Error al subir el documento. Inténtelo de nuevo.');
        setIsLoading(false);
        setDocumentUploadProgress(null);
      },
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        const patientRef = doc(db, 'patients', appointment.patientId);
        
        const documentData: Document = {
          name: newDocument.name,
          date: newDocument.date,
          url: downloadURL,
          type: documentFile.type,
          size: documentFile.size
        };
        
        await updateDoc(patientRef, { documents: arrayUnion(documentData) });
        
        // Resetear estados
        setNewDocument({ name: '', date: '' });
        setDocumentFile(null);
        setShowAddDocumentForm(false);
        setIsLoading(false);
        setDocumentUploadProgress(null);
        setMessage('Documento guardado con éxito.');
        setTimeout(() => setMessage(''), 3000);
      }
    );
  };

  // --- Manejador para eliminar documentos ---
  const handleRemoveDocument = async (documentToRemove: Document) => {
    if (!confirm('¿Está seguro de que desea eliminar este documento?')) return;
    try {
      const patientRef = doc(db, 'patients', appointment.patientId);
      await updateDoc(patientRef, { documents: arrayRemove(documentToRemove) });
      setMessage('Documento eliminado con éxito.');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error("Error al eliminar documento:", error);
      setMessage('Error al eliminar el documento.');
    }
  };

  const handleSaveSession = async (markCompleted: boolean) => {
      setIsLoading(true);
      setMessage('');
      try {
          const apptRef = doc(db, 'appointments', appointment.id);
          const updateData: Partial<Appointment> = {
              reportedSymptoms,
              prescription: showPrescription ? prescription : '',
              indicatedTreatment,
              bodyArea,
              // Solo actualiza el estado si se marca para completar
              ...(markCompleted && { status: 'completed' })
          };
          await updateDoc(apptRef, updateData);
          
          if (markCompleted && !patientData?.mainDiagnosis && reportedSymptoms) {
              const patientRef = doc(db, 'patients', appointment.patientId);
              await updateDoc(patientRef, { mainDiagnosis: reportedSymptoms });
          }

          setMessage(markCompleted ? 'Sesión completada y guardada.' : 'Cambios guardados con éxito.');
          setTimeout(() => {
              // No cierra automáticamente al solo guardar
              if (markCompleted) onClose();
              setMessage('');
          }, 2000);
      } catch (error) {
          console.error("Error al guardar:", error);
          setMessage('Error al guardar. Inténtelo de nuevo.');
      } finally {
          setIsLoading(false);
      }
  };

  const handlePrint = (textToPrint: string) => {
    if (!textToPrint) return;
    const today = new Date().toLocaleDateString('es-HN', { day: 'numeric', month: 'long', year: 'numeric' });
    const prescriptionData = {
        patientName: appointment.patientName,
        prescriptionText: textToPrint,
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

  return (
      <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-6xl flex flex-col h-[95vh]" initial={{ scale: 0.95, y: 30 }} animate={{ scale: 1, y: 0 }}>
              {/* Header y Pestañas */}
              <div className="flex-shrink-0 mb-6">
                  <div className="flex items-start justify-between">
                      <div><h3 className="text-2xl font-bold text-slate-900">Atendiendo a: {appointment.patientName}</h3><p className="text-slate-500">Consulta del {appointment.date} a las {appointment.time}</p></div>
                      <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-200 transition-colors -mt-2 -mr-2"><FiX size={24} /></button>
                  </div>
                  <div className="border-b border-slate-200 mt-4"><nav className="-mb-px flex space-x-6"><button onClick={() => setActiveTab('current')} className={`py-3 px-1 border-b-2 font-semibold text-sm transition-colors ${activeTab === 'current' ? 'border-sky-500 text-sky-600' : 'border-transparent text-slate-500 hover:border-slate-300'}`}>Atención Actual</button><button onClick={() => setActiveTab('history')} className={`py-3 px-1 border-b-2 font-semibold text-sm transition-colors ${activeTab === 'history' ? 'border-sky-500 text-sky-600' : 'border-transparent text-slate-500 hover:border-slate-300'}`}>Expediente Médico</button></nav></div>
              </div>
              
              <div className="flex-grow overflow-y-auto pr-4 -mr-4">
                  <AnimatePresence mode="wait">
                      {activeTab === 'current' && (
                          <motion.div key="current" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                              <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                                  <div className="lg:col-span-3 space-y-6">
                                      {/* --- SECCIÓN DE TERAPIAS MÚLTIPLES --- */}
                                      <div>
                                          <label className="text-lg font-semibold text-slate-800 mb-2 block">Plan de Tratamiento</label>
                                          <div className="flex flex-wrap gap-2 p-3 rounded-lg bg-sky-50 border-2 border-slate-200">
                                              {treatmentPlans.map(plan => (
                                                  <button
                                                      key={plan}
                                                      onClick={() => handleTherapyToggle(plan)}
                                                      className={`px-3 py-1.5 text-sm font-semibold rounded-full transition-colors ${indicatedTreatment.some(t => t.name === plan) ? 'bg-sky-600 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}
                                                  >
                                                      {plan}
                                                  </button>
                                              ))}
                                          </div>
                                      </div>
                                      
                                      <AnimatePresence>
                                          {indicatedTreatment.length > 0 && (
                                              <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                                                  {indicatedTreatment.map(treatment => (
                                                      <div key={treatment.name}>
                                                          <label className="font-semibold text-slate-700">{treatment.name}</label>
                                                          <textarea
                                                              value={treatment.details}
                                                              onChange={(e) => handleTherapyDetailsChange(treatment.name, e.target.value)}
                                                              placeholder={`Detalles para ${treatment.name}...`}
                                                              rows={3}
                                                              className="w-full mt-1 p-2 rounded-lg bg-white border-2 border-slate-200 focus:border-sky-500 focus:ring-sky-500 transition"
                                                          />
                                                      </div>
                                                  ))}
                                              </motion.div>
                                          )}
                                      </AnimatePresence>

                                      <div><label className="text-lg font-semibold text-slate-800 mb-2 block">Zona del Cuerpo</label><BodySelector selectedAreas={bodyArea} onSelectArea={(area) => setBodyArea(prev => prev.includes(area) ? prev.filter(a => a !== area) : [...prev, area])} /></div>
                                  </div>

                                  <div className="lg:col-span-2 space-y-6">
                                      <div><label className="text-lg font-semibold text-slate-800 mb-2 block">Enfermedad Actual / Síntomas</label><textarea value={reportedSymptoms} onChange={(e) => setReportedSymptoms(e.target.value)} placeholder="El paciente reporta..." rows={6} className="w-full p-3 rounded-lg bg-sky-50 border-2 border-slate-200 focus:border-sky-500 focus:ring-sky-500 transition" /></div>
                                      {!showPrescription ? (<motion.button layout onClick={() => setShowPrescription(true)} className="w-full flex items-center justify-center space-x-2 py-3 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 hover:bg-sky-50 hover:border-slate-400 transition-colors"><FiPlusCircle/><span>Añadir Receta Médica</span></motion.button>) : (<motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}><label className="text-lg font-semibold text-slate-800 mb-2 block">Receta Médica</label><textarea value={prescription} onChange={(e) => setPrescription(e.target.value)} placeholder="Ej: Ibuprofeno 600mg..." rows={8} className="w-full p-3 rounded-lg bg-sky-50 border-2 border-slate-200 focus:border-sky-500 focus:ring-sky-500 transition" /></motion.div>)}
                                  </div>
                              </div>
                          </motion.div>
                      )}

                      {/* --- PESTAÑA DE EXPEDIENTE REESTRUCTURADA Y COMPLETA --- */}
                      {activeTab === 'history' && (
                          <motion.div key="history" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-8">
                              {/* 1. Antecedentes Personales */}
                              <div className="bg-sky-50 p-6 rounded-2xl shadow-xl border border-sky-200/80">
                                  <div className="flex justify-between items-center mb-4">
                                      <h3 className="text-xl font-bold text-slate-800">1. Antecedentes Personales</h3>
                                      <button onClick={() => setShowAddHistoryForm(!showAddHistoryForm)} className="p-2 rounded-full hover:bg-slate-200 text-slate-500"><FiPlus /></button>
                                  </div>
                                  <AnimatePresence>
                                      {showAddHistoryForm && (
                                          <motion.form onSubmit={handleAddPersonalHistory} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-2 p-4 mb-4 bg-white rounded-lg border overflow-hidden">
                                              <input type="date" value={newHistoryItem.date} onChange={e => setNewHistoryItem({ ...newHistoryItem, date: e.target.value })} className="w-full p-2 border rounded-md" required />
                                              <textarea placeholder="Descripción del antecedente..." value={newHistoryItem.description} onChange={e => setNewHistoryItem({ ...newHistoryItem, description: e.target.value })} className="w-full p-2 border rounded-md" rows={3} required />
                                              <button type="submit" className="w-full py-2 bg-sky-600 text-white rounded-md">Guardar Antecedente</button>
                                          </motion.form>
                                      )}
                                  </AnimatePresence>
                                  <ul className="space-y-3 max-h-48 overflow-y-auto pr-2">
                                      {patientData?.personalHistory && patientData.personalHistory.length > 0 ? patientData.personalHistory.map((item, index) => (
                                          <li key={index} className="flex items-start justify-between p-3 bg-slate-100 rounded-lg">
                                              <div>
                                                  <p className="font-semibold text-slate-700">{new Date(item.date + 'T00:00:00-06:00').toLocaleDateString('es-HN', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                                                  <p className="text-sm text-slate-600 whitespace-pre-wrap">{item.description}</p>
                                              </div>
                                              <button onClick={() => handleRemovePersonalHistory(item)} className="p-1 text-red-500 hover:text-red-700"><FiTrash2 size={16}/></button>
                                          </li>
                                      )) : <p className="text-center text-slate-500 py-4">No hay antecedentes registrados.</p>}
                                  </ul>
                              </div>

                              {/* 2, 3 y 4. Información Clínica */}
                              <div className="bg-sky-50 p-6 rounded-2xl shadow-xl border border-sky-200/80">
                                  <div className="flex justify-between items-center mb-4"><h3 className="text-xl font-bold text-slate-800">Información Clínica</h3>{!isEditingInfo && <button onClick={() => setIsEditingInfo(true)} className="p-2 text-slate-500 hover:text-sky-600"><FiEdit /></button>}</div>
                                  <div className="space-y-4 text-sm">
                                      {isEditingInfo ? (
                                          <div className="space-y-4">
                                              <label className="font-semibold text-slate-600">2. Alergias</label><textarea value={editablePatientData.allergies} onChange={e => setEditablePatientData({ ...editablePatientData, allergies: e.target.value })} rows={2} className="w-full p-2 border rounded" />
                                              <label className="font-semibold text-slate-600">3. Enfermedad Actual</label><textarea value={editablePatientData.currentIllness} onChange={e => setEditablePatientData({ ...editablePatientData, currentIllness: e.target.value })} rows={3} className="w-full p-2 border rounded" />
                                              <label className="font-semibold text-slate-600">4. Diagnóstico Principal</label><textarea value={editablePatientData.mainDiagnosis} onChange={e => setEditablePatientData({ ...editablePatientData, mainDiagnosis: e.target.value })} rows={3} className="w-full p-2 border rounded" />
                                              <div className="flex gap-2"><button onClick={handleSaveInfo} className="py-2 px-4 bg-sky-600 text-white rounded">Guardar</button><button onClick={() => setIsEditingInfo(false)} className="py-2 px-4 bg-slate-200 rounded">Cancelar</button></div>
                                          </div>
                                      ) : (
                                        <>
                                            <div className="flex flex-col"><span className="font-semibold text-slate-500">2. Alergias:</span><span className="text-slate-700 whitespace-pre-wrap">{patientData?.allergies || 'No especificadas'}</span></div>
                                            <div className="flex flex-col"><span className="font-semibold text-slate-500">3. Enfermedad Actual:</span><span className="text-slate-700 whitespace-pre-wrap">{patientData?.currentIllness || 'No especificada'}</span></div>
                                            <div className="flex flex-col"><span className="font-semibold text-slate-500">4. Diagnóstico Principal:</span><span className="text-slate-700 whitespace-pre-wrap">{patientData?.mainDiagnosis || 'No especificado'}</span></div>
                                        </>
                                      )}
                                  </div>
                              </div>

                              {/* Estudios y Archivos */}
                              <div className="bg-sky-50 p-6 rounded-2xl shadow-xl border border-sky-200/80">
                                <div className="flex justify-between items-center mb-4"><h3 className="text-xl font-bold text-slate-800">Estudios Médicos</h3><button onClick={() => setShowAddStudyForm(!showAddStudyForm)} className="p-2 rounded-full hover:bg-slate-200 text-slate-500"><FiPlus /></button></div>
                                <AnimatePresence>
                                  {showAddStudyForm && (
                                    <motion.form onSubmit={handleAddStudy} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-3 p-4 mb-4 bg-white rounded-lg border overflow-hidden">
                                      <input type="text" placeholder="Nombre del estudio" value={newStudy.name} onChange={e => setNewStudy({ ...newStudy, name: e.target.value })} className="w-full p-2 border rounded-md" required />
                                      <input type="date" value={newStudy.date} onChange={e => setNewStudy({ ...newStudy, date: e.target.value })} className="w-full p-2 border rounded-md" required />
                                      <input type="file" onChange={e => setStudyFile(e.target.files ? e.target.files[0] : null)} className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-sky-50 file:text-sky-700 hover:file:bg-sky-100" required />
                                      {uploadProgress !== null && (
                                        <div className="w-full bg-slate-200 rounded-full h-2.5">
                                          <div className="bg-sky-600 h-2.5 rounded-full" style={{ width: `${uploadProgress}%` }}></div>
                                        </div>
                                      )}
                                      <button type="submit" disabled={isLoading} className="w-full py-2 bg-sky-600 text-white rounded-md disabled:bg-slate-400">Guardar Estudio</button>
                                    </motion.form>
                                  )}
                                </AnimatePresence>
                                <ul className="space-y-3 max-h-40 overflow-y-auto pr-2">
                                {patientData?.studies?.length ? (
                                    patientData.studies.map((study: Study, index: number) => (
                                    <li key={index} className="flex items-center justify-between p-3 bg-slate-100 rounded-lg">
                                        <div className="flex items-center space-x-3">
                                        <FiPaperclip className="text-slate-500" />
                                        <p className="font-semibold text-slate-700">{study.name} <span className="text-xs text-slate-400">({study.date})</span></p>
                                        </div>
                                        <a href={study.url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-sky-600 hover:underline">Ver</a>
                                    </li>
                                    ))
                                ) : (
                                    <p className="text-center text-slate-500 py-4">No hay estudios registrados.</p>
                                )}
                                </ul>
                              </div>

                              {/* Documentos del Expediente */}
                              <div className="bg-sky-50 p-6 rounded-2xl shadow-xl border border-sky-200/80">
                                <div className="flex justify-between items-center mb-4">
                                  <h3 className="text-xl font-bold text-slate-800">Documentos del Expediente</h3>
                                  <button onClick={() => setShowAddDocumentForm(!showAddDocumentForm)} className="p-2 rounded-full hover:bg-slate-200 text-slate-500"><FiPlus /></button>
                                </div>
                                <AnimatePresence>
                                  {showAddDocumentForm && (
                                    <motion.form onSubmit={handleAddDocument} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-3 p-4 mb-4 bg-white rounded-lg border overflow-hidden">
                                      <input type="text" placeholder="Nombre del documento" value={newDocument.name} onChange={e => setNewDocument({ ...newDocument, name: e.target.value })} className="w-full p-2 border rounded-md" required />
                                      <input type="date" value={newDocument.date} onChange={e => setNewDocument({ ...newDocument, date: e.target.value })} className="w-full p-2 border rounded-md" required />
                                      <div className="space-y-2">
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
                                      <button type="submit" disabled={isLoading} className="w-full py-2 bg-sky-600 text-white rounded-md disabled:bg-slate-400">Guardar Documento</button>
                                    </motion.form>
                                  )}
                                </AnimatePresence>
                                <ul className="space-y-3 max-h-48 overflow-y-auto pr-2">
                                  {patientData?.documents?.length ? (
                                    patientData.documents.map((document: Document, index: number) => (
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

                              {/* Historial de Citas Anteriores */}
                              <div className="bg-sky-50 p-6 rounded-2xl shadow-xl border border-sky-200/80">
                              <h3 className="text-xl font-bold text-slate-800">Historial de Citas</h3>
                              {isLoadingHistory ? <p className="text-center">Cargando historial...</p> : history.length > 0 ? (history.map(appt => (
                                <div key={appt.id} className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                                    <div className="flex justify-between items-center mb-2"><p className="font-bold text-slate-800">{appt.date}</p><span className={`px-2 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800`}>Completada</span></div>
                                    <h4 className="font-semibold text-slate-600">Síntomas Reportados:</h4><p className="text-sm text-slate-500 mb-3 whitespace-pre-wrap">{appt.reportedSymptoms || 'N/A'}</p>
                                    <h4 className="font-semibold text-slate-600">Plan de Tratamiento:</h4>
                                    {appt.indicatedTreatment && appt.indicatedTreatment.length > 0 ? (
                                        appt.indicatedTreatment.map((t, index) => <p key={index} className="text-sm text-slate-500 whitespace-pre-wrap"><span className="font-medium text-slate-700">{t.name}:</span> {t.details || 'Sin detalles.'}</p>)
                                    ) : <p className="text-sm text-slate-500">N/A</p>}
                                    {appt.prescription && <button onClick={() => handlePrint(appt.prescription!)} className="text-sm text-sky-600 font-semibold mt-2 flex items-center space-x-1 hover:underline"><FiPrinter/><span>Ver Receta</span></button>}
                                </div>
                              ))) : <p className="text-center text-slate-500 py-8">No hay citas previas en el historial.</p>}
                              </div>
                          </motion.div>
                      )}
                  </AnimatePresence>
              </div>

              {/* Botones de Acción */}
              <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t mt-6 flex-shrink-0">
                  <button type="button" onClick={() => handleSaveSession(false)} disabled={isLoading} className="flex-1 py-3 px-6 bg-slate-600 text-white font-semibold rounded-lg shadow-md hover:bg-slate-700 disabled:opacity-50 flex items-center justify-center space-x-2 transition-colors"><FiSave /><span>{appointment.status === 'completed' ? 'Actualizar Cambios' : 'Guardar'}</span></button>
                  {appointment.status !== 'completed' && <button type="button" onClick={() => handleSaveSession(true)} disabled={isLoading} className="flex-1 py-3 px-6 bg-emerald-600 text-white font-semibold rounded-lg shadow-md hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center space-x-2 transition-colors"><FiCheckSquare /><span>Completar Sesión</span></button>}
                  <button type="button" onClick={() => handlePrint(prescription)} disabled={isLoading || !prescription} className="flex-1 py-3 px-6 bg-sky-600 text-white font-semibold rounded-lg shadow-md hover:bg-sky-700 disabled:opacity-50 flex items-center justify-center space-x-2 transition-colors"><FiPrinter /><span>Imprimir Receta</span></button>
              </div>
              {message && <p className={`mt-2 text-center text-sm p-2 rounded-lg ${message.startsWith('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{message}</p>}
          </motion.div>
      </motion.div>
  );
};

export default AppointmentDetailsModal;
