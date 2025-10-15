'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiPlus, FiTrash2, FiLoader, FiEdit, FiX, FiSave, FiAlertTriangle, FiClipboard, FiArrowLeft } from 'react-icons/fi';
import { collection, onSnapshot, addDoc, deleteDoc, doc, query, orderBy, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface TreatmentPlan {
  id: string;
  name: string;
  description?: string;
}

interface TreatmentPlansManagerProps {
  onBack: () => void;
}

const TreatmentPlansManager: React.FC<TreatmentPlansManagerProps> = ({ onBack }) => {
  const [plans, setPlans] = useState<TreatmentPlan[]>([]);
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingPlan, setEditingPlan] = useState<TreatmentPlan | null>(null);
  const [planToDelete, setPlanToDelete] = useState<TreatmentPlan | null>(null);

  const handleOpenEditModal = (plan: TreatmentPlan) => {
    setEditingPlan(plan);
    setFormData({ name: plan.name, description: plan.description || '' });
  };
  const handleOpenDeleteModal = (plan: TreatmentPlan) => setPlanToDelete(plan);
  const handleCloseDeleteModal = () => setPlanToDelete(null);

  const handleCloseEditModal = () => setEditingPlan(null);

  useEffect(() => {
    const plansCollection = collection(db, 'treatmentPlans');
    const q = query(plansCollection, orderBy('name'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const plansData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as TreatmentPlan));
      setPlans(plansData);
      setIsLoading(false);
    }, (error) => {
      console.error("Error al obtener los planes de tratamiento:", error);
      setMessage({ type: 'error', text: 'No se pudieron cargar los planes.' });
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setMessage({ type: 'error', text: 'El nombre del plan no puede estar vacío.' });
      return;
    }
    setIsSaving(true);
    setMessage({ type: '', text: '' });

    try {
      if (editingPlan) {
        // Actualizar plan existente
        const planRef = doc(db, 'treatmentPlans', editingPlan.id);
        await updateDoc(planRef, {
          name: formData.name.trim(),
          description: formData.description.trim(),
        });
        setMessage({ type: 'success', text: '¡Plan actualizado con éxito!' });
        handleCloseEditModal();
      } else {
        // Agregar nuevo plan
        await addDoc(collection(db, 'treatmentPlans'), {
          name: formData.name.trim(),
          description: formData.description.trim(),
        });
        setMessage({ type: 'success', text: '¡Plan agregado con éxito!' });
      }
      // Limpiar formulario en ambos casos
      setFormData({ name: '', description: '' });

    } catch (error) {
      console.error("Error al guardar el plan:", error);
      setMessage({ type: 'error', text: 'Ocurrió un error al guardar el plan.' });
    } finally {
      setIsSaving(false);
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    }
  };

  const confirmDeletePlan = async () => {
    if (!planToDelete) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'treatmentPlans', planToDelete.id));
      setMessage({ type: 'success', text: 'Plan eliminado correctamente.' });
      handleCloseDeleteModal();
    } catch (error) {
      console.error("Error al eliminar el plan:", error);
      setMessage({ type: 'error', text: 'Ocurrió un error al eliminar el plan.' });
    } finally {
      setIsDeleting(false);
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex items-center space-x-4 mb-6">
        <button onClick={onBack} className="p-2 rounded-full hover:bg-slate-200 transition-colors">
          <FiArrowLeft size={24} />
        </button>
        <h2 className="text-3xl font-bold text-slate-900">Planes de Tratamiento</h2>
      </div>
      
      {/* Formulario para agregar nuevos planes */}
      <form onSubmit={handleSavePlan} className="space-y-4 mb-8 p-6 bg-white border border-slate-200/80 rounded-2xl shadow-lg">
        <h3 className="font-bold text-xl text-slate-800">Agregar Nuevo Plan</h3>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="Nombre del nuevo plan"
          className="block w-full px-4 py-3 rounded-lg bg-slate-100 border-2 border-transparent focus:border-sky-500 focus:ring-sky-500 transition-all"
        />
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Descripción del plan (opcional)"
          rows={3}
          className="block w-full px-4 py-3 rounded-lg bg-slate-100 border-2 border-transparent focus:border-sky-500 focus:ring-sky-500 transition-all"
        />
        <button type="submit" disabled={isSaving} className="w-full flex items-center justify-center space-x-2 py-3 px-5 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-lg shadow-md transition-colors disabled:opacity-50">
          {isSaving && !editingPlan ? <FiLoader className="animate-spin" /> : <FiPlus />}
          <span>Agregar Plan</span>
        </button>
      </form>

      {message.text && (
        <p className={`mb-4 p-3 rounded-lg text-center text-sm ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {message.text}
        </p>
      )}

      <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-200/80">
        <h3 className="font-bold text-xl text-slate-800 mb-4">Planes Existentes</h3>
        <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2 -mr-2">
          {isLoading ? (
            <p className="text-center text-slate-500 py-8">Cargando planes...</p>
          ) : plans.length > 0 ? (
            plans.map(plan => (
              <motion.div key={plan.id} layout className="p-4 bg-slate-50 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors">
                <div className="flex justify-between items-start">
                  <div className="flex-grow">
                    <span className="font-bold text-lg text-slate-800">{plan.name}</span>
                    {plan.description && <p className="text-sm text-slate-600 mt-1 max-w-prose">{plan.description}</p>}
                  </div>
                  <div className="flex items-center space-x-2 flex-shrink-0 ml-4">
                    <button onClick={() => handleOpenEditModal(plan)} aria-label={`Editar ${plan.name}`} className="p-2 text-slate-500 hover:text-sky-600 hover:bg-sky-100 rounded-full transition-colors"><FiEdit /></button>
                    <button onClick={() => handleOpenDeleteModal(plan)} aria-label={`Eliminar ${plan.name}`} className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-100 rounded-full transition-colors"><FiTrash2 /></button>
                  </div>
                </div>
              </motion.div>
            ))
          ) : <p className="text-center text-slate-500 py-8">No hay planes de tratamiento definidos.</p>}
        </div>
      </div>

      {/* Modal de Edición */}
      <AnimatePresence>
        {editingPlan && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md" initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-slate-900">Editar Plan</h3>
                <button onClick={handleCloseEditModal} className="p-2 rounded-full hover:bg-slate-200 transition-colors"><FiX size={24} /></button>
              </div>
              <form onSubmit={handleSavePlan} className="space-y-4">
                <div>
                  <label htmlFor="edit-name" className="block text-base font-medium text-slate-700">Nombre del Plan</label>
                  <input type="text" id="edit-name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="mt-1 w-full p-3 rounded-lg bg-slate-100 border-2 border-slate-200 focus:border-sky-500 focus:ring-sky-500"/>
                </div>
                <div>
                  <label htmlFor="edit-description" className="block text-base font-medium text-slate-700">Descripción</label>
                  <textarea id="edit-description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={4} className="mt-1 w-full p-3 rounded-lg bg-slate-100 border-2 border-slate-200 focus:border-sky-500 focus:ring-sky-500"/>
                </div>
                <button type="submit" disabled={isSaving} className="w-full flex items-center justify-center space-x-2 py-3 mt-4 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-lg shadow-md disabled:opacity-50">
                  {isSaving ? <FiLoader className="animate-spin" /> : <FiSave />}
                  <span>Guardar Cambios</span>
                </button>
                {message.text && (
                  <p className={`mt-4 text-center text-sm ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>{message.text}</p>
                )}
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de Confirmación de Eliminación */}
      <AnimatePresence>
        {planToDelete && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md text-center" initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                <FiAlertTriangle className="h-6 w-6 text-red-600" aria-hidden="true" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mt-4">Eliminar Plan</h3>
              <p className="text-slate-600 mt-2">¿Estás seguro de que quieres eliminar el plan <span className="font-bold">"{planToDelete.name}"</span>? Esta acción no se puede deshacer.</p>
              <div className="mt-8 flex justify-center gap-4">
                <button onClick={handleCloseDeleteModal} disabled={isDeleting} className="py-2 px-6 rounded-lg bg-slate-200 text-slate-800 font-semibold hover:bg-slate-300 transition-colors">
                  Cancelar
                </button>
                <button onClick={confirmDeletePlan} disabled={isDeleting} className="flex items-center justify-center space-x-2 py-2 px-6 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 transition-colors disabled:opacity-50">
                  {isDeleting ? <FiLoader className="animate-spin" /> : <span>Eliminar</span>}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default TreatmentPlansManager;