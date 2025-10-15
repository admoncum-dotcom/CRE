'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  collection, query, where, orderBy, limit, getDocs, doc, updateDoc, 
  startAfter, startAt
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import AddUserModal from './AddUserModal';
import EditUserModal from './EditUserModal';
import { 
  FiUserPlus, FiArrowLeft, FiBriefcase, FiTrash2, FiAlertTriangle, FiSearch, 
  FiRefreshCw, FiChevronLeft, FiChevronRight, FiPhone, FiUsers, 
  FiChevronDown, FiMail 
} from 'react-icons/fi';

// --- TIPOS DE DATOS ---
interface User {
  id: string;
  name: string;
  email?: string;
  contact?: string;
  role: 'admin' | 'doctora' | 'terapeuta' | 'recepcion';
  status: 'active' | 'inactive';
}

interface UserViewProps {
  onBack: () => void;
  onSaveUser: (userData: any) => Promise<void>;
}

const UserView: React.FC<UserViewProps> = ({ onBack, onSaveUser }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddUserModalOpen, setAddUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deactivatingUser, setDeactivatingUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchTerm);
  const [roleFilter, setRoleFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'active' | 'inactive'>('active');

  // --- Estados para paginación ---
  const [page, setPage] = useState(1);
  const [pageStartDocs, setPageStartDocs] = useState<any[]>([]); 
  const [isLastPage, setIsLastPage] = useState(false);
  const [lastFetchedDoc, setLastFetchedDoc] = useState<any>(null);

  const USERS_PER_PAGE = 7;
  const QUERY_LIMIT = USERS_PER_PAGE + 1; // Fetch one extra to check for next page

  // --- LÓGICA DE FIREBASE (Asegurando el rol 'recepcion') ---

  const fetchUsers = useCallback(async (direction: 'next' | 'prev' | 'first' = 'first') => {
    setIsLoading(true);
    
    const isSearching = !!debouncedSearchTerm;

    try {
      const usersRef = collection(db, 'users');
      const orderField = 'name'; 

      let queryConstraints: any[] = [
        where('status', '==', viewMode)
      ];

      // APLICACIÓN DEL FILTRO DE ROL
      if (roleFilter !== 'all') {
        // Si se selecciona un rol específico (incluido 'recepcion'), se añade la restricción where
        queryConstraints.push(where('role', '==', roleFilter));
      }
      // NOTA: Si roleFilter es 'all', no se añade ninguna restricción de rol, permitiendo todos los roles
      // que cumplan con el 'status'. La exclusión de 'admin' se hace después en el cliente.

      let startDoc = null;

      if (isSearching) {
        const term = debouncedSearchTerm.charAt(0).toUpperCase() + debouncedSearchTerm.slice(1);
        queryConstraints.push(
          orderBy(orderField), 
          where(orderField, '>=', term), 
          where(orderField, '<=', term + '\uf8ff')
        );
        queryConstraints.push(limit(QUERY_LIMIT));
      } else {
        queryConstraints.push(orderBy(orderField));
        
        if (direction === 'next' && lastFetchedDoc) {
          startDoc = lastFetchedDoc;
          queryConstraints.push(startAfter(startDoc));
        } else if (direction === 'prev' && page > 1 && pageStartDocs.length >= page - 1) {
          startDoc = pageStartDocs[page - 2];
          queryConstraints.push(startAt(startDoc));
        } 
        
        queryConstraints.push(limit(QUERY_LIMIT));
      }
      
      const q = query(usersRef, ...queryConstraints);
      const snapshot = await getDocs(q);

      // 1. Determinar documentos y si hay más
      const hasMore = snapshot.docs.length === QUERY_LIMIT;
      const docsToShow = snapshot.docs.slice(0, USERS_PER_PAGE); 

      // 2. Procesar y setear los usuarios que se van a mostrar
      const rawUsers = docsToShow.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // La clave: EXCLUIMOS EL ROL 'admin' EN EL CLIENTE. 
      // Si el rol 'recepcion' existe en Firestore, pasará la consulta y solo será filtrado 'admin' aquí.
      const newUsers = rawUsers.filter((u: any) => u.role && u.role !== 'admin') as User[];
      setUsers(newUsers);

      // 3. Lógica de Manejo de Estado de Paginación
      if (!isSearching && !snapshot.empty) {
        
        const firstVisible = snapshot.docs[0];

        setIsLastPage(!hasMore); 
        
        setLastFetchedDoc(docsToShow.length > 0 ? docsToShow[docsToShow.length - 1] : null);

        if (direction === 'next') { 
          setPageStartDocs(prev => [...prev, firstVisible]); 
          setPage(p => p + 1); 
        } 
        else if (direction === 'prev') { 
          setPageStartDocs(prev => prev.slice(0, -1)); 
          setPage(p => p - 1); 
        } 
        else if (direction === 'first') { 
          setPage(1); 
          setPageStartDocs([firstVisible]); 
        }

      } else {
        setPage(1);
        setPageStartDocs([]);
        setLastFetchedDoc(null);
        setIsLastPage(true);
      }
      
    } catch (error) {
      console.error("Error al obtener usuarios:", error);
      setUsers([]);
      setIsLastPage(true);
    } finally {
      setIsLoading(false);
    }
  }, [viewMode, roleFilter, debouncedSearchTerm, lastFetchedDoc, page, pageStartDocs]); 

  // --- Efectos y Handlers (Mantenidos) ---

  useEffect(() => {
    const handler = setTimeout(() => { setDebouncedSearchTerm(searchTerm); }, 500);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  useEffect(() => {
    fetchUsers('first'); 
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, roleFilter, debouncedSearchTerm]);

  const handleUpdateUser = async (userId: string, data: { contact: string; email: string; }) => {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, data);
    fetchUsers('first');
    setEditingUser(null);
  };

  const handleDeactivateUser = async (userId: string) => {
    setDeactivatingUser(null);
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, { status: 'inactive' });
    fetchUsers('first');
  };

  const handleReactivateUser = async (userId: string) => {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, { status: 'active' });
    fetchUsers('first');
  };
  
  const roleTranslations: { [key: string]: string } = {
    admin: 'Administrador',
    doctora: 'Doctor/a',
    terapeuta: 'Terapeuta',
    recepcion: 'Recepción',
  };

  // --- RENDERIZADO (Mantenido) ---

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        
        {/* Encabezado Principal */}
        <div className="flex items-center space-x-4 mb-6">
          <button onClick={onBack} className="p-2 rounded-full hover:bg-slate-200 transition-colors">
            <FiArrowLeft size={24} />
          </button>
          <h2 className="text-3xl font-bold text-slate-900 flex items-center">
             Gestión de Usuarios
          </h2>
        </div>

        {/* Controles: Toggles, Búsqueda y Filtro */}
        <div className="flex flex-col xl:flex-row justify-between gap-4 mb-6">
          
          {/* 1. Toggle de Vista (Activos/Inactivos) */}
          <div className="flex space-x-1 bg-slate-200 p-1 rounded-full shadow-inner self-start">
            <button 
              onClick={() => setViewMode('active')} 
              className={`px-5 py-2 text-sm font-semibold rounded-full transition-all ${viewMode === 'active' ? 'bg-white shadow text-sky-700' : 'text-slate-600 hover:bg-white/60'}`}
            >
              Activos
            </button>
            <button 
              onClick={() => setViewMode('inactive')} 
              className={`px-5 py-2 text-sm font-semibold rounded-full transition-all ${viewMode === 'inactive' ? 'bg-white shadow text-sky-700' : 'text-slate-600 hover:bg-white/60'}`}
            >
              Inactivos
            </button>
          </div>
          
          {/* 2. Búsqueda y Filtro */}
          <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto">
            
            {/* Campo de Búsqueda */}
            <div className="relative flex-grow">
              <input 
                type="text" 
                placeholder="Buscar por nombre..." 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
                className="pl-12 pr-4 py-3 w-full rounded-full bg-white border-2 border-slate-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            </div>
            
            {/* Selector de Rol */}
            <div className="relative w-full sm:w-auto">
              <select 
                value={roleFilter} 
                onChange={(e) => setRoleFilter(e.target.value)} 
                className="appearance-none w-full pl-4 pr-10 py-3 rounded-full bg-white border-2 border-slate-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
              >
                <option value="all">Todos los Roles</option>
                <option value="doctora">Doctor/a</option>
                <option value="terapeuta">Terapeuta</option>
                <option value="recepcion">Recepción</option> {/* Asegurado que existe */}
              </select>
              <FiChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={20} />
            </div>
          </div>
        </div>

        {/* Grid de Tarjetas de Usuarios */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {isLoading ? (
            /* Skeleton Loading State */
            Array.from({ length: USERS_PER_PAGE }).map((_, i) => (
              <div key={i} className="bg-white p-6 rounded-2xl shadow-lg animate-pulse">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-slate-200 rounded-full"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-5 bg-slate-200 rounded-lg w-4/5"></div>
                    <div className="h-4 bg-slate-200 rounded w-1/2"></div>
                  </div>
                </div>
              </div>
            ))
          ) : users.length > 0 ? (
            /* Tarjetas de Usuario */
            users.map(user => (
              <motion.div 
                key={user.id} 
                onClick={() => viewMode === 'active' ? setEditingUser(user) : null}
                className={`bg-white p-6 rounded-2xl shadow-lg flex flex-col justify-between transition-all duration-300 ${viewMode === 'active' ? 'hover:shadow-xl hover:bg-sky-100 hover:-translate-y-1 cursor-pointer' : 'cursor-default opacity-80'}`}
                initial={{ opacity: 0, scale: 0.95 }} 
                animate={{ opacity: 1, scale: 1 }}
              >
                <div>
                  <div className="flex items-center space-x-4">
                    {/* Avatar */}
                    <div className={`w-12 h-12 ${viewMode === 'active' ? 'bg-sky-300 text-sky-900' : 'bg-slate-300 text-slate-600'} rounded-full flex items-center justify-center font-bold text-xl shadow-sm`}>
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">{user.name}</h3>
                      {/* Rol */}
                      <p className={`flex items-center space-x-2 text-sm font-medium mt-1 ${viewMode === 'active' ? 'text-teal-600' : 'text-slate-500'}`}>
                        <FiBriefcase size={14} /><span>{roleTranslations[user.role] || user.role}</span>
                      </p>
                    </div>
                  </div>
                  {/* Contacto */}
                  <div className="space-y-2 text-sm text-slate-700 pt-4 border-t border-slate-100 mt-4">
                    {user.email && (
                        <p className="flex items-center space-x-3">
                          <FiMail size={14} className="text-sky-600" />
                          <span className='truncate'>{user.email}</span>
                        </p>
                    )}
                    {user.contact && (
                      <p className="flex items-center space-x-3">
                        <FiPhone size={14} className="text-sky-600" />
                        <span>{user.contact}</span>
                      </p>
                    )}
                  </div>
                </div>
                
                {/* Botones de Acción */}
                <div className="mt-4 pt-4 border-t border-slate-300 flex justify-between items-center">
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${viewMode === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {viewMode === 'active' ? 'Activo' : 'Inactivo'}
                  </span>

                  {viewMode === 'active' ? (
                    <>
                      {/* Botón Deactivar (solo en vista Activos) */}
                      <motion.button 
                        onClick={(e) => { e.stopPropagation(); setDeactivatingUser(user); }} 
                        className="p-2 text-red-500 hover:bg-red-100 rounded-full transition-colors" 
                        aria-label="Desactivar usuario"
                      >
                        <FiTrash2 size={18} />
                      </motion.button>
                    </>
                  ) : (
                    /* Botón Reactivar (solo en vista Inactivos) */
                    <motion.button 
                      onClick={(e) => { e.stopPropagation(); handleReactivateUser(user.id); }} 
                      className="flex items-center space-x-2 text-sm py-2 px-4 bg-green-500 text-white font-semibold rounded-lg shadow-md hover:bg-green-600 transition-colors"
                    >
                      <FiRefreshCw size={14} />
                      <span>Reactivar</span>
                    </motion.button>
                  )}
                </div>
              </motion.div>
            ))
          ) : (
            /* Estado Sin Resultados */
            <div className="col-span-full text-center py-16 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-300">
                <p className="text-xl font-semibold text-slate-600">
                    No se encontraron usuarios {viewMode === 'active' ? 'activos' : 'inactivos'}.
                </p>
                <p className="text-slate-500 mt-2">Asegúrate de que los filtros y la búsqueda sean correctos.</p>
            </div>
          )}
        </div>

        {/* Paginación (Estilo mejorado) */}
        {!debouncedSearchTerm && users.length > 0 && (
          <div className="flex justify-center items-center space-x-4 pt-8">
            <motion.button
              onClick={() => fetchUsers('prev')}
              disabled={page === 1 || isLoading}
              className="flex items-center space-x-2 py-2 px-4 bg-white text-slate-700 rounded-lg shadow-md hover:bg-slate-100 disabled:opacity-50"
            >
              <FiChevronLeft size={20} /><span>Anterior</span>
            </motion.button>
            
            <span className="font-semibold text-slate-600 px-2">
              {page}
            </span>
            
            <motion.button
              onClick={() => fetchUsers('next')}
              disabled={isLastPage || isLoading}
              className="flex items-center space-x-2 py-2 px-4 bg-white text-slate-700 rounded-lg shadow-md hover:bg-slate-100 disabled:opacity-50"
            >
              <span>Siguiente</span><FiChevronRight size={20} />
            </motion.button>
          </div>
        )}
      </motion.div>

      {/* Botón Flotante para Añadir Usuario */}
      <motion.button
        onClick={() => setAddUserModalOpen(true)}
        className="fixed bottom-10 right-10 z-30 bg-sky-600 text-white p-4 rounded-full shadow-2xl hover:bg-sky-700 transition-all transform hover:scale-110 focus:outline-none focus:ring-4 focus:ring-sky-300"
        aria-label="Añadir nuevo usuario"
      >
        <FiUserPlus size={24} />
      </motion.button>

      {/* Modales */}
      <AnimatePresence>
        {isAddUserModalOpen && <AddUserModal onClose={() => setAddUserModalOpen(false)} onSave={onSaveUser} />}
        {editingUser && <EditUserModal user={editingUser} onClose={() => setEditingUser(null)} onSave={handleUpdateUser} />}
        
        {/* Modal de Confirmación de Desactivación */}
        {deactivatingUser && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md text-center"
              initial={{ scale: 0.9, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 30 }}
            >
              <FiAlertTriangle size={48} className="mx-auto text-red-500 mb-5" />
              <h3 className="text-2xl font-bold text-slate-900">Confirmar Desactivación</h3>
              <p className="text-slate-600 mt-2 mb-6">
                ¿Estás seguro de que quieres desactivar a <span className="font-bold text-red-600">{deactivatingUser.name}</span>? 
                Esto removerá su acceso. Podrás reactivarlo desde la vista "Inactivos".
              </p>
              <div className="flex justify-center space-x-4">
                <button 
                  onClick={() => setDeactivatingUser(null)} 
                  className="py-2 px-5 bg-slate-200 text-slate-700 font-semibold rounded-lg hover:bg-slate-300 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={() => handleDeactivateUser(deactivatingUser.id)} 
                  className="py-2 px-5 bg-red-600 text-white font-bold rounded-lg shadow-md hover:bg-red-700 transition-colors"
                >
                  Sí, Desactivar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default UserView;