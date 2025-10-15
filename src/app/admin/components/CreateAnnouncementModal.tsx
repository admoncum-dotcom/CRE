'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { FiX, FiSend, FiUsers, FiHeart, FiShield, FiClipboard } from 'react-icons/fi';
import { collection, getDocs, query, where, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface CreateAnnouncementModalProps {
  onClose: () => void;
  onAnnouncementSent: () => void;
  currentUser: any; // The user sending the announcement
}

const CreateAnnouncementModal: React.FC<CreateAnnouncementModalProps> = ({ onClose, onAnnouncementSent, currentUser }) => {
  const [message, setMessage] = useState('');
  const [target, setTarget] = useState('all'); // 'all', 'doctora', 'terapeuta', 'recepcion'
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState('');

  const handleSend = async () => {
    if (!message.trim()) {
      setFeedback('El mensaje no puede estar vacío.');
      return;
    }
    setIsLoading(true);
    setFeedback('');

    try {
      // 1. Get target users
      const usersRef = collection(db, 'users');
      let usersQuery;
      if (target === 'all') {
        usersQuery = query(usersRef);
      } else {
        usersQuery = query(usersRef, where('role', '==', target));
      }
      const usersSnapshot = await getDocs(usersQuery);
      const targetUsers = usersSnapshot.docs.map(doc => doc.id);

      // 2. Create a notification for each target user
      const notificationPromises = targetUsers.map(userId => {
        const userNotifRef = collection(db, `users/${userId}/notifications`);
        return addDoc(userNotifRef, {
          type: 'announcement',
          message: message,
          read: false,
          saved: false,
          timestamp: Timestamp.now(),
          from: currentUser.name || 'Recepción'
        });
      });
      
      await Promise.all(notificationPromises);

      // 3. Save the announcement for historical record
      await addDoc(collection(db, 'announcements'), {
        message,
        target,
        sentBy: currentUser.uid,
        sentByName: currentUser.name || 'Recepción',
        createdAt: Timestamp.now(),
        recipientCount: targetUsers.length
      });

      setFeedback('¡Anuncio enviado con éxito!');
      onAnnouncementSent();
      setTimeout(onClose, 1500);

    } catch (error) {
      console.error("Error sending announcement:", error);
      setFeedback('Ocurrió un error al enviar el anuncio.');
    } finally {
      setIsLoading(false);
    }
  };

  const targetOptions = [
    { id: 'all', label: 'Todos', icon: <FiUsers /> },
    { id: 'doctora', label: 'Doctores', icon: <FiHeart /> },
    { id: 'terapeuta', label: 'Terapeutas', icon: <FiShield /> },
    { id: 'recepcion', label: 'Recepción', icon: <FiClipboard /> },
  ];

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      <motion.div
        className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-2xl space-y-6"
        initial={{ scale: 0.9, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 30 }}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-2xl font-bold text-slate-900 flex items-center gap-3"><FiSend /> Crear Anuncio</h3>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-200 transition-colors"><FiX size={24} /></button>
        </div>

        <div>
          <label htmlFor="announcement-message" className="block text-base font-medium text-slate-700 mb-2">Mensaje del Anuncio</label>
          <textarea
            id="announcement-message"
            rows={5}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Escribe tu anuncio aquí..."
            className="w-full p-3 rounded-lg bg-sky-50 border-2 border-slate-200 focus:border-sky-500 focus:ring-sky-500"
          />
        </div>

        <div>
          <label className="block text-base font-medium text-slate-700 mb-2">Enviar a:</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {targetOptions.map(option => (
              <button
                key={option.id}
                onClick={() => setTarget(option.id)}
                className={`flex flex-col items-center justify-center gap-2 p-4 rounded-lg border-2 transition-all ${target === option.id ? 'bg-sky-100 border-sky-500 text-sky-700' : 'bg-white hover:bg-slate-50 border-slate-200'}`}
              >
                {option.icon}
                <span className="text-sm font-semibold">{option.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="pt-4 border-t border-slate-200">
          <button
            onClick={handleSend}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 py-3 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-lg shadow-md disabled:opacity-50"
          >
            {isLoading ? 'Enviando...' : 'Enviar Anuncio'}
            <FiSend />
          </button>
          {feedback && <p className={`mt-4 text-center text-sm ${feedback.includes('Error') ? 'text-red-600' : 'text-green-600'}`}>{feedback}</p>}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default CreateAnnouncementModal;