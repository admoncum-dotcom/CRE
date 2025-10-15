'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiArrowLeft, FiPlus, FiTrash2, FiUsers, FiHeart, FiShield, FiClipboard } from 'react-icons/fi';
import { collection, onSnapshot, orderBy, query, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import CreateAnnouncementModal from './CreateAnnouncementModal';

interface AnnouncementsViewProps {
  onBack: () => void;
  currentUser: any;
}

const AnnouncementsView: React.FC<AnnouncementsViewProps> = ({ onBack, currentUser }) => {
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    const q = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allAnnouncements = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAnnouncements(allAnnouncements);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleDelete = async (id: string) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este anuncio? Esta acción no se puede deshacer.')) {
      await deleteDoc(doc(db, 'announcements', id));
    }
  };

  const getTargetInfo = (target: string) => {
    switch (target) {
      case 'all': return { label: 'Todos', icon: <FiUsers />, color: 'bg-blue-100 text-blue-800' };
      case 'doctora': return { label: 'Doctores', icon: <FiHeart />, color: 'bg-emerald-100 text-emerald-800' };
      case 'terapeuta': return { label: 'Terapeutas', icon: <FiShield />, color: 'bg-amber-100 text-amber-800' };
      case 'recepcion': return { label: 'Recepción', icon: <FiClipboard />, color: 'bg-indigo-100 text-indigo-800' };
      default: return { label: 'Desconocido', icon: <FiUsers />, color: 'bg-slate-100 text-slate-800' };
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
            <button onClick={onBack} className="p-2 rounded-full hover:bg-slate-200 transition-colors"><FiArrowLeft size={24} /></button>
            <h2 className="text-3xl font-bold text-slate-900">Gestión de Anuncios</h2>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 py-2 px-4 bg-sky-600 text-white font-semibold rounded-lg shadow-md hover:bg-sky-700 transition-colors"
        >
          <FiPlus />
          <span>Crear Anuncio</span>
        </button>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-lg space-y-4">
        {isLoading ? (
          <p>Cargando anuncios...</p>
        ) : announcements.length > 0 ? (
          announcements.map(ann => {
            const targetInfo = getTargetInfo(ann.target);
            return (
              <motion.div
                key={ann.id}
                className="p-4 border border-slate-200 rounded-lg flex flex-col sm:flex-row justify-between sm:items-center gap-4"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="flex-grow">
                  <p className="text-slate-800">{ann.message}</p>
                  <div className="text-xs text-slate-500 mt-2 flex items-center gap-4">
                    <span>Enviado por: <strong>{ann.sentByName}</strong></span>
                    <span>{ann.createdAt.toDate().toLocaleString('es-HN')}</span>
                  </div>
                </div>
                <div className="flex items-center gap-4 flex-shrink-0">
                    <span className={`flex items-center gap-2 text-sm font-semibold px-3 py-1 rounded-full ${targetInfo.color}`}>
                        {targetInfo.icon}
                        {targetInfo.label}
                    </span>
                    <button onClick={() => handleDelete(ann.id)} className="p-2 text-slate-400 hover:text-red-600 rounded-full transition-colors">
                        <FiTrash2 />
                    </button>
                </div>
              </motion.div>
            );
          })
        ) : (
          <p className="text-center text-slate-500 py-10">No se han enviado anuncios todavía.</p>
        )}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <CreateAnnouncementModal
            onClose={() => setIsModalOpen(false)}
            onAnnouncementSent={() => { /* Could add a success toast here */ }}
            currentUser={currentUser}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default AnnouncementsView;