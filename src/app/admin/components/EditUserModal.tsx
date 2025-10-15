'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { FiX, FiSave } from 'react-icons/fi';

interface EditUserModalProps {
  user: any;
  onClose: () => void;
  onSave: (userId: string, data: any) => Promise<void>;
}

const EditUserModal: React.FC<EditUserModalProps> = ({ user, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    contact: user.contact || '',
    email: user.email || '',
    // Añadimos la duración de la consulta al estado, con '60' como valor por defecto.
    consultationDuration: user.consultationDuration || '60',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    let formattedValue = value;
    if (name === 'contact') {
      const numericValue = value.replace(/[^\d]/g, '');
      const truncatedValue = numericValue.slice(0, 8);
      if (truncatedValue.length > 4) {
        formattedValue = `${truncatedValue.slice(0, 4)}-${truncatedValue.slice(4)}`;
      } else {
        formattedValue = truncatedValue;
      }
    }
    setFormData(prev => ({ ...prev, [name]: formattedValue }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.contact || !formData.email) {
      setMessage("El número de celular y el correo no pueden estar vacíos.");
      return;
    }
    setIsLoading(true);
    setMessage('');
    try {
      // Preparamos los datos a guardar.
      const dataToSave: any = {
        contact: formData.contact,
        email: formData.email,
      };
      if (user.role === 'doctora') dataToSave.consultationDuration = formData.consultationDuration;
      await onSave(user.id, dataToSave);
      setMessage("¡Usuario actualizado con éxito!");
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error: any) {
      console.error("Error al actualizar el usuario:", error);
      if (error.code === 'auth/email-already-in-use') {
        setMessage("El correo electrónico ya está en uso por otro usuario.");
      } else if (error.code === 'auth/invalid-email') {
        setMessage("El formato del correo electrónico no es válido.");
      } else {
        setMessage("Ocurrió un error al actualizar el usuario.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md"
        initial={{ scale: 0.9, y: 30 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 30 }}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-slate-900">Editar Usuario</h3>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-200 transition-colors"><FiX size={24} /></button>
        </div>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-base font-medium text-slate-700">Nombre</label>
            <input type="text" value={user.name} disabled className="mt-1 w-full p-3 rounded-lg bg-slate-100 border-slate-300 cursor-not-allowed"/>
          </div>
          <div>
            <label htmlFor="contact" className="block text-base font-medium text-slate-700">Número de Celular</label>
            <input type="tel" id="contact" name="contact" value={formData.contact} onChange={handleChange} required placeholder="Ej: 8888-8888" maxLength={9} className="mt-1 w-full p-3 rounded-lg bg-sky-50 border-2 border-slate-200 focus:border-sky-500 focus:ring-sky-500"/>
          </div>
          <div>
            <label className="block text-base font-medium text-slate-700">Rol</label>
            <input type="text" value={user.role.charAt(0).toUpperCase() + user.role.slice(1)} disabled className="mt-1 w-full p-3 rounded-lg bg-slate-100 border-slate-300 cursor-not-allowed"/>
          </div>
          <div>
            <label htmlFor="email" className="block text-base font-medium text-slate-700">Correo Electrónico</label>
            <input type="email" id="email" name="email" value={formData.email} onChange={handleChange} required className="mt-1 w-full p-3 rounded-lg bg-sky-50 border-2 border-slate-200 focus:border-sky-500 focus:ring-sky-500"/>
          </div>
          {/* Campo condicional para editar la duración de la consulta si el rol es 'doctora' */}
          {user.role === 'doctora' && (
            <div>
              <label htmlFor="consultationDuration" className="block text-base font-medium text-slate-700">Duración de Consulta</label>
              <select id="consultationDuration" name="consultationDuration" value={formData.consultationDuration} onChange={handleChange} className="mt-1 w-full p-3 rounded-lg bg-sky-50 border-2 border-slate-200 focus:border-sky-500 focus:ring-sky-500">
                <option value="60">1 hora</option>
                <option value="30">30 minutos</option>
              </select>
            </div>
          )}
          <button type="submit" disabled={isLoading} className="w-full flex items-center justify-center space-x-2 py-3 mt-4 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-lg shadow-md disabled:opacity-50">
            {isLoading ? 'Guardando...' : 'Guardar Cambios'}
            <FiSave />
          </button>
          {message && <p className={`mt-4 text-center text-sm ${message.includes('éxito') ? 'text-green-600' : 'text-red-600'}`}>{message}</p>}
        </form>
      </motion.div>
    </motion.div>
  );
};

export default EditUserModal;