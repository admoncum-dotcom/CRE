'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiUser, FiShield, FiLink, FiSave, FiLock } from 'react-icons/fi';
import { User, reauthenticateWithCredential, EmailAuthProvider, updatePassword } from 'firebase/auth';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import Image from 'next/image';

interface ProfileSettingsModalProps {
  user: User;
  onClose: () => void;
  onProfileUpdate: () => void;
}

const ProfileSettingsModal: React.FC<ProfileSettingsModalProps> = ({ user, onClose, onProfileUpdate }) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'security'>('profile');
  const [avatarUrl, setAvatarUrl] = useState('');
  
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const fetchUserData = async () => {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        setAvatarUrl(userDoc.data().avatarUrl || '');
      }
    };
    fetchUserData();
  }, [user.uid]);

  const handleAvatarUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);
    try {
      new URL(avatarUrl); 
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { avatarUrl });
      setMessage({ type: 'success', text: '¡Foto de perfil actualizada!' });
      onProfileUpdate();
    } catch (error) {
      setMessage({ type: 'error', text: 'La URL ingresada no es válida.' });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handlePasswordUpdate = async (e: React.FormEvent) => {
      e.preventDefault();
      if (newPassword !== confirmPassword) {
          setMessage({ type: 'error', text: 'Las nuevas contraseñas no coinciden.' });
          return;
      }
      if (newPassword.length < 6) {
          setMessage({ type: 'error', text: 'La nueva contraseña debe tener al menos 6 caracteres.'});
          return;
      }

      setIsLoading(true);
      setMessage(null);
      
      try {
        if (user.email) {
            const credential = EmailAuthProvider.credential(user.email, currentPassword);
            await reauthenticateWithCredential(user, credential);
            await updatePassword(user, newPassword);
            setMessage({ type: 'success', text: '¡Contraseña actualizada con éxito!' });
            setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
        }
      } catch (error: any) {
          if (error.code === 'auth/wrong-password') {
             setMessage({ type: 'error', text: 'La contraseña actual es incorrecta.' });
          } else {
             setMessage({ type: 'error', text: 'Ocurrió un error. Inténtalo de nuevo.' });
          }
      } finally {
          setIsLoading(false);
      }
  };

  const checkPasswordStrength = (password: string) => {
    let strength = 0;
    if (password.length > 7) strength++;
    if (password.match(/([a-z].*[A-Z])|([A-Z].*[a-z])/)) strength++;
    if (password.match(/([0-9])/)) strength++;
    if (password.match(/([!,%,&,@,#,$,^,*,?,_,~])/)) strength++;
    return strength;
  };
  
  const passwordStrength = checkPasswordStrength(newPassword);

  return (
    <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-lg" initial={{ scale: 0.95, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 30 }}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-slate-800">Perfil y Configuración</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-200"><FiX /></button>
        </div>

        <div className="border-b border-slate-200">
            <nav className="-mb-px flex space-x-6">
                <button onClick={() => setActiveTab('profile')} className={`py-3 px-1 border-b-2 font-semibold text-sm ${activeTab === 'profile' ? 'border-sky-500 text-sky-600' : 'border-transparent text-slate-500'}`}><FiUser className="inline mr-2"/>Perfil</button>
                <button onClick={() => setActiveTab('security')} className={`py-3 px-1 border-b-2 font-semibold text-sm ${activeTab === 'security' ? 'border-sky-500 text-sky-600' : 'border-transparent text-slate-500'}`}><FiShield className="inline mr-2"/>Seguridad</button>
            </nav>
        </div>

        <AnimatePresence mode="wait">
            <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="pt-6">
                {activeTab === 'profile' && (
                    <form onSubmit={handleAvatarUpdate} className="space-y-4">
                        <h3 className="font-semibold text-lg text-slate-700">Foto de Perfil</h3>
                        <div className="flex items-center space-x-4">
                            <Image src={avatarUrl || '/Doctor.jpg'} alt="Avatar actual" width={80} height={80} className="w-20 h-20 rounded-full object-cover"/>
                            <div className="flex-grow">
                                <label htmlFor="avatarUrl" className="text-base font-medium text-slate-600">URL de la imagen</label>
                                <div className="relative mt-1">
                                    <FiLink className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                                    <input type="url" id="avatarUrl" placeholder="https://ejemplo.com/imagen.jpg" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} className="w-full p-2.5 pl-10 rounded-lg bg-sky-50 border-2 border-slate-200 focus:border-sky-500 focus:ring-sky-500"/>
                                </div>
                            </div>
                        </div>
                        <button type="submit" disabled={isLoading} className="w-full py-2.5 px-4 bg-sky-600 text-white font-semibold rounded-lg hover:bg-sky-700 disabled:opacity-50 flex items-center justify-center space-x-2"><FiSave/><span>{isLoading ? 'Guardando...' : 'Guardar Foto'}</span></button>
                    </form>
                )}
                {activeTab === 'security' && (
                     <form onSubmit={handlePasswordUpdate} className="space-y-6">
                        <h3 className="font-semibold text-lg text-slate-700">Cambiar Contraseña</h3>
                        <div>
                            <label htmlFor="currentPassword" className="text-base font-medium text-slate-600">Contraseña Actual</label>
                            <div className="relative mt-1">
                                <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                                <input type="password" id="currentPassword" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required className="w-full p-2.5 pl-10 rounded-lg bg-sky-50 border-2 border-slate-200 focus:border-sky-500 focus:ring-sky-500"/>
                            </div>
                        </div>
                         <div>
                            <label htmlFor="newPassword" className="text-base font-medium text-slate-600">Nueva Contraseña</label>
                            <div className="relative mt-1">
                                <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                                <input type="password" id="newPassword" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required className="w-full p-2.5 pl-10 rounded-lg bg-sky-50 border-2 border-slate-200 focus:border-sky-500 focus:ring-sky-500"/>
                            </div>
                             {newPassword && (
                                <div className="flex items-center space-x-2 mt-2">
                                    <div className={`h-1.5 flex-1 rounded-full transition-colors ${passwordStrength >= 1 ? 'bg-red-500' : 'bg-slate-200'}`}></div>
                                    <div className={`h-1.5 flex-1 rounded-full transition-colors ${passwordStrength >= 2 ? 'bg-yellow-500' : 'bg-slate-200'}`}></div>
                                    <div className={`h-1.5 flex-1 rounded-full transition-colors ${passwordStrength >= 3 ? 'bg-green-500' : 'bg-slate-200'}`}></div>
                                </div>
                            )}
                        </div>
                         <div>
                             <label htmlFor="confirmPassword" className="text-base font-medium text-slate-600">Confirmar Contraseña</label>
                             <div className="relative mt-1">
                                <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                                <input type="password" id="confirmPassword" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className="w-full p-2.5 pl-10 rounded-lg bg-sky-50 border-2 border-slate-200 focus:border-sky-500 focus:ring-sky-500"/>
                            </div>
                        </div>
                        <button type="submit" disabled={isLoading} className="w-full py-2.5 px-4 bg-slate-800 text-white font-semibold rounded-lg hover:bg-slate-900 shadow-md hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center space-x-2"><FiSave/><span>{isLoading ? 'Actualizando...' : 'Actualizar Contraseña'}</span></button>
                    </form>
                )}
            </motion.div>
        </AnimatePresence>

        {message && <p className={`mt-4 text-center text-sm p-3 rounded-lg ${message.type === 'success' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>{message.text}</p>}

      </motion.div>
    </motion.div>
  );
};

export default ProfileSettingsModal;
