'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation'; 
import { signOut, onAuthStateChanged, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDoc, onSnapshot, collection, query, where, getDocs, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import Image from 'next/image';
import { auth, db } from '@/lib/firebase';

// LIBRERÍA DE ANIMACIÓN LOTTIE
import Lottie from 'lottie-react';
import logoutAnimationData from '@/salir.json'; 

// Componentes
import UserView from '../components/UserView';
import AppointmentsView from '../components/AppointmentsView';
import PatientsView from '../components/PatientsView';
import ReportsView from '../components/ReportsView';
import AnnouncementsView from '../components/AnnouncementsView';
import WeeklyStatsChart from '../components/WeeklyStatsChart';
import ReferralSourceChart from '../components/ReferralSourceChart';
import ProfileSettingsModal from '../../../components/ProfileSettingsModal';
import TreatmentPlansManager from '../components/TreatmentPlansManager'; // 1. Importar el nuevo componente
import NotificationPanel, { Notification } from '../../../components/NotificationHandler';
import { 
  FiUserPlus, FiHome, FiUsers, FiLogOut, FiBell, FiSearch, FiMenu, FiCalendar, FiBarChart, FiTrendingUp, FiUserCheck, FiSettings, FiUser, FiSend
, FiClipboard } from 'react-icons/fi'; // 2. Añadir el ícono FiClipboard

// -----------------------------------------------------------------
// --- COMPONENTE: Capa de animación para cerrar sesión ---
// -----------------------------------------------------------------
const LogoutAnimationOverlay = ({ onAnimationComplete }: { onAnimationComplete: () => void }) => {
    const [animationFinished, setAnimationFinished] = useState(false);
    
    // Timeout de respaldo de 3 segundos
    useEffect(() => {
        const backupTimer = setTimeout(() => {
            console.log('Redirección por timeout');
            setAnimationFinished(true);
            onAnimationComplete();
        }, 3000);

        return () => clearTimeout(backupTimer);
    }, [onAnimationComplete]);

    // Cuando la animación termina
    const handleAnimationComplete = () => {
        console.log('Animación completada');
        if (!animationFinished) {
            setAnimationFinished(true);
            onAnimationComplete();
        }
    };

    return (
        <motion.div
            className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-[9999] flex flex-col items-center justify-center text-white"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
        >
            <Lottie
                animationData={logoutAnimationData}
                loop={false} 
                autoplay={true}
                style={{ width: 250, height: 250 }}
                onComplete={handleAnimationComplete}
            />
            <motion.p 
                className="text-2xl font-bold mt-4"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.5 }}
            >
                Cerrando Sesión...
            </motion.p>
            {animationFinished && (
                <motion.p 
                    className="text-sm mt-2 text-sky-200"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                >
                    Redirigiendo al login...
                </motion.p>
            )}
        </motion.div>
    );
};
// -----------------------------------------------------------------

const toLocalDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const StatCard = ({ title, value, icon, isLoading }: { title: string; value: string; icon: React.ReactNode; isLoading: boolean; }) => (
  <motion.div 
    className="bg-white p-6 rounded-2xl shadow-lg flex items-center justify-between" 
    initial={{ opacity: 0, y: 20 }} 
    animate={{ opacity: 1, y: 0 }}
  >
    {isLoading ? (
      <div className="w-full h-20 animate-pulse flex items-center justify-between">
        <div className="w-2/3 space-y-3">
          <div className="h-5 bg-slate-200 rounded w-3/4"></div>
          <div className="h-8 bg-slate-300 rounded w-1/2"></div>
        </div>
        <div className="h-14 w-14 bg-slate-200 rounded-full"></div>
      </div>
    ) : (
      <>
        <div>
          <h4 className="text-lg font-semibold text-slate-500">{title}</h4>
          <p className="text-4xl font-bold text-slate-800 mt-1">{value}</p>
        </div>
        <div className="text-4xl text-sky-500">
          {icon}
        </div>
      </>
    )}
  </motion.div>
);

// --- SUB-COMPONENTE PARA LA VISTA DE INICIO DEL DASHBOARD ---
const DashboardHomeContent = () => {
    const [stats, setStats] = useState({ completedToday: 0, scheduledToday: 0, totalPatients: 0 });
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
      const today = toLocalDateString(new Date());
      let appointmentDataLoaded = false;
      let patientDataLoaded = false;

      const checkLoading = () => {
        if (appointmentDataLoaded && patientDataLoaded) {
          setIsLoading(false);
        }
      };

      const appointmentsQuery = query(collection(db, 'appointments'), where('date', '==', today));
      const unsubscribeAppointments = onSnapshot(appointmentsQuery, (snapshot) => {
        const dailyCounts = snapshot.docs.reduce((acc, doc) => {
          if (doc.data().status === 'scheduled') acc.scheduled++;
          if (doc.data().status === 'completed') acc.completed++;
          return acc;
        }, { scheduled: 0, completed: 0 });
        setStats(prev => ({ ...prev, scheduledToday: dailyCounts.scheduled, completedToday: dailyCounts.completed }));
        appointmentDataLoaded = true;
        checkLoading();
      });

      const patientsQuery = query(collection(db, 'patients'));
      const unsubscribePatients = onSnapshot(patientsQuery, (snapshot) => {
        setStats(prev => ({ ...prev, totalPatients: snapshot.size }));
        patientDataLoaded = true;
        checkLoading();
      });

      return () => {
        unsubscribeAppointments();
        unsubscribePatients();
      };
    }, []);

    return (
        <div className="space-y-8">
            <motion.div 
              className="relative p-8 rounded-3xl overflow-hidden bg-slate-800 text-white shadow-2xl"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
                 <div className="absolute inset-0 bg-gradient-to-br from-sky-700 to-slate-900 opacity-80 z-0"></div>
                 <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-5"></div>
                 <div className="relative z-10">
                     <h2 className="text-4xl font-bold mb-2">Bienvenido, Administrador.</h2>
                     <p className="text-sky-200 text-lg">Desde aquí puedes gestionar los usuarios y la configuración del sistema.</p>
                 </div>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatCard title="Consultas Completadas Hoy" value={stats.completedToday.toString()} icon={<FiUserCheck />} isLoading={isLoading} />
              <StatCard title="Consultas para Hoy" value={stats.scheduledToday.toString()} icon={<FiCalendar />} isLoading={isLoading} />
              <StatCard title="Pacientes Registrados" value={stats.totalPatients.toString()} icon={<FiUserCheck />} isLoading={isLoading} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              <div className="lg:col-span-3"><WeeklyStatsChart /></div>
              <div className="lg:col-span-2"><ReferralSourceChart /></div>
            </div>
        </div>
    );
};

export default function AdminDashboard() {
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [userName, setUserName] = useState<string>('Administrador');
  const [view, setView] = useState('dashboard');
  const [doctors, setDoctors] = useState<any[]>([]);
  const [therapists, setTherapists] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [isSettingsModalOpen, setSettingsModalOpen] = useState(false);
  const [userData, setUserData] = useState<any | null>(null);
  
  // ESTADO PARA LA ANIMACIÓN DE CIERRE DE SESIÓN
  const [isLogoutAnimating, setIsLogoutAnimating] = useState(false);
  
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isNotificationPanelOpen, setNotificationPanelOpen] = useState(false);
  const unreadCount = notifications.filter(n => !n.read).length;

  const router = useRouter();

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userDoc = await getDoc(doc(db, `users/${user.uid}`));
        if (userDoc.exists() && userDoc.data().role === 'admin') {
          setCurrentUser(user);
          const data = userDoc.data();
          setUserData({ uid: user.uid, ...data });
          setUserName(data.name || 'Administrador');
        } else { router.push('/'); }
      } else { router.push('/'); }
    });

    const fetchProfessionals = async () => {
        const usersRef = collection(db, 'users');
        const docsQuery = query(usersRef, where('role', '==', 'doctora'));
        const thersQuery = query(usersRef, where('role', '==', 'terapeuta'));
        const [docsSnap, thersSnap] = await Promise.all([getDocs(docsQuery), getDocs(thersQuery)]);
        setDoctors(docsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setTherapists(thersSnap.docs.map(t => ({ id: t.id, ...t.data() })));
    };
    fetchProfessionals();

    return () => unsubscribeAuth();
  }, [router]);

  useEffect(() => {
    if (!currentUser) return;

    const notifQuery = query(collection(db, `users/${currentUser.uid}/notifications`));
    const unsubscribeNotifs = onSnapshot(notifQuery, (snapshot) => {
        setNotifications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification)));
    });

    return () => unsubscribeNotifs();
  }, [currentUser]);

  const handleProfileUpdate = useCallback(async () => {
    if (currentUser) {
      const userDoc = await getDoc(doc(db, `users/${currentUser.uid}`));
      const data = userDoc.data();
      if (data) setUserData({ uid: currentUser.uid, ...data });
      if (data) setUserName(data.name || 'Administrador');
    }
  }, [currentUser]);

  const handleSaveUser = async (userData: any) => {
    const { email, password, name, role, contact } = userData;
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    await setDoc(doc(db, 'users', user.uid), {
      name,
      role,
      contact,
      status: 'active',
    });
  };

  // LÓGICA DE CIERRE DE SESIÓN CON ANIMACIÓN
  const animatedLogout = () => {
    console.log('Iniciando animación de cierre de sesión');
    setIsLogoutAnimating(true);
  };
  
  const completeLogout = async () => {
    try {
      console.log('Ejecutando cierre de sesión...');
      await signOut(auth); 
      console.log('Sesión cerrada, redirigiendo...');
      router.push('/');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
      router.push('/');
    }
  };

  const handleMarkAsRead = async (id: string) => {
    if (!currentUser) return;
    const notifRef = doc(db, `users/${currentUser.uid}/notifications`, id);
    await updateDoc(notifRef, { read: true });
  };

  const handleSaveNotification = async (id: string, saved: boolean) => {
      if (!currentUser) return;
      const notifRef = doc(db, `users/${currentUser.uid}/notifications`, id);
      await updateDoc(notifRef, { saved });
  };

  const handleDeleteNotification = async (id: string) => {
      if (!currentUser) return;
      const notifRef = doc(db, `users/${currentUser.uid}/notifications`, id);
      await deleteDoc(notifRef);
  };

  const renderMainContent = () => {
    switch (view) {
      case 'users':
        return <UserView onBack={() => setView('dashboard')} onSaveUser={handleSaveUser} />;
      case 'appointments':
        return <AppointmentsView onBack={() => setView('dashboard')} doctors={doctors} therapists={therapists} />;
      case 'patients':
        return <PatientsView onBack={() => setView('dashboard')} />;
      case 'reports':
        return <ReportsView onBack={() => setView('dashboard')} />;
      case 'announcements':
        return <AnnouncementsView onBack={() => setView('dashboard')} currentUser={userData} />;
      case 'treatment-plans': // 4. Añadir el caso para la nueva vista
        return <TreatmentPlansManager onBack={() => setView('dashboard')} />;
     
      default: return <DashboardHomeContent />;
    }
  };

  return (
    <div className="flex min-h-screen bg-sky-50 font-sans text-slate-800">
      <motion.aside 
        className="fixed top-0 left-0 h-full w-72 bg-white/80 backdrop-blur-xl border-r border-slate-200/80 shadow-2xl z-40 p-6 flex flex-col justify-between"
        animate={{ x: isSidebarOpen ? 0 : -288 }}
      >
        <div>
          <div className="flex flex-col items-center space-y-4 mb-12">
            <button onClick={() => setView('dashboard')} className="cursor-pointer transition-transform duration-200 hover:scale-105">
              <Image src="/CRE logoo.svg" alt="Logo Clínica CRE" width={100} height={70} priority />
            </button>
          </div>
          <nav className="space-y-3">
            <button onClick={() => setView('dashboard')} className={`w-full flex items-center space-x-4 py-3 px-4 rounded-xl font-semibold transition-all duration-200 ${view === 'dashboard' ? 'bg-sky-100 text-sky-800 shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}><FiHome className="text-2xl" /><span>Inicio</span></button>
            <button onClick={() => setView('appointments')} className={`w-full flex items-center space-x-4 py-3 px-4 rounded-xl font-semibold transition-all duration-200 ${view === 'appointments' ? 'bg-sky-100 text-sky-800 shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}><FiCalendar className="text-2xl" /><span>Citas</span></button>
            <button onClick={() => setView('patients')} className={`w-full flex items-center space-x-4 py-3 px-4 rounded-xl font-semibold transition-all duration-200 ${view === 'patients' ? 'bg-sky-100 text-sky-800 shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}><FiUsers className="text-2xl" /><span>Pacientes</span></button>
            <button onClick={() => setView('reports')} className={`w-full flex items-center space-x-4 py-3 px-4 rounded-xl font-semibold transition-all duration-200 ${view === 'reports' ? 'bg-sky-100 text-sky-800 shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}><FiTrendingUp className="text-2xl" /><span>Estadisticas</span></button>
            <button onClick={() => setView('users')} className={`w-full flex items-center space-x-4 py-3 px-4 rounded-xl font-semibold transition-all duration-200 ${view === 'users' ? 'bg-sky-100 text-sky-800 shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}><FiUsers className="text-2xl" /><span>Gestionar Usuarios</span></button>
            <button onClick={() => setView('announcements')} className={`w-full flex items-center space-x-4 py-3 px-4 rounded-xl font-semibold transition-all duration-200 ${view === 'announcements' ? 'bg-sky-100 text-sky-800 shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}><FiSend className="text-2xl" /><span>Anuncios</span></button>
            {/* 3. Añadir el nuevo botón al menú de navegación */}
            <button onClick={() => setView('treatment-plans')} className={`w-full flex items-center space-x-4 py-3 px-4 rounded-xl font-semibold transition-all duration-200 ${view === 'treatment-plans' ? 'bg-sky-100 text-sky-800 shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}><FiClipboard className="text-2xl" /><span>Planes de Tratamiento</span></button>
          </nav>
        </div>
        <div className="space-y-3">
          <button onClick={() => setSettingsModalOpen(true)} className="w-full flex items-center justify-center space-x-3 py-3 px-4 rounded-xl bg-slate-200 text-slate-800 font-semibold hover:bg-slate-300 transition-colors">
            <span>Configuración</span><FiSettings />
          </button>
          <button 
            onClick={animatedLogout} 
            disabled={isLogoutAnimating}
            className="w-full flex items-center justify-center space-x-3 py-3 px-4 rounded-xl bg-slate-800 text-white font-semibold hover:bg-slate-900 transition-colors shadow-lg"
          >
            <span>{isLogoutAnimating ? 'Cerrando...' : 'Cerrar Sesión'}</span>
            <FiLogOut />
          </button>
        </div>
      </motion.aside>

      <div className={`flex-1 flex flex-col transition-all duration-300 ${isSidebarOpen ? 'lg:ml-72' : 'lg:ml-0'}`}>
        <header className="sticky top-0 w-full bg-white/80 backdrop-blur-xl shadow-md z-20 py-4 px-6 md:px-10 flex justify-between items-center border-b border-slate-200/80">
            <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="p-2 -ml-2 text-slate-600"><FiMenu size={24} /></button>
            <div className="flex items-center space-x-6">
                <div className="relative">
                    <button onClick={() => setNotificationPanelOpen(prev => !prev)} className="relative text-slate-500 hover:text-slate-700">
                        <FiBell size={24} />
                        {unreadCount > 0 && <span className="absolute -top-1 -right-1 flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-sky-500"></span></span>}
                    </button>
                    <AnimatePresence>
                        {isNotificationPanelOpen && (
                          <NotificationPanel
                            notifications={notifications}
                            onMarkAsRead={handleMarkAsRead}
                            onSave={handleSaveNotification}
                            onDelete={handleDeleteNotification}
                            onClose={() => setNotificationPanelOpen(false)}
                            onMarkAllAsRead={async () => {
                              if (!currentUser) return;
                              const notifRef = collection(db, `users/${currentUser.uid}/notifications`);
                              const notifSnap = await getDocs(notifRef);
                              notifSnap.forEach(async (docSnap) => {
                                if (!docSnap.data().read) {
                                  await updateDoc(docSnap.ref, { read: true });
                                }
                              });
                            }}
                          />
                        )}
                    </AnimatePresence>
                </div>
                <button onClick={() => setSettingsModalOpen(true)} className="flex items-center space-x-3 cursor-pointer p-2 rounded-lg hover:bg-slate-100 transition-colors group">
                    {userData?.avatarUrl ? (
                        <Image src={userData.avatarUrl} alt="Avatar" width={40} height={40} className="w-10 h-10 rounded-full object-cover border-2 border-transparent group-hover:border-sky-300 transition-all" />
                    ) : (
                        <div className="w-10 h-10 rounded-full bg-sky-600 flex items-center justify-center text-white font-bold text-lg border-2 border-transparent group-hover:border-sky-300 transition-all">
                            {userName.charAt(0).toUpperCase()}
                        </div>
                    )}
                    <span className="font-semibold hidden md:inline text-slate-700 group-hover:text-sky-600 transition-colors">{userName}</span>
                </button>
            </div>
        </header>
        <main className="flex-grow p-6 md:p-10 relative">
            <AnimatePresence mode="wait">
                <motion.div key={view} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                    {renderMainContent()}
                </motion.div>
            </AnimatePresence>

            <AnimatePresence>
              {isSettingsModalOpen && currentUser && (
                <ProfileSettingsModal user={currentUser} onClose={() => setSettingsModalOpen(false)} onProfileUpdate={handleProfileUpdate} />
              )} 
            </AnimatePresence>
        </main>
      </div>

      {/* CAPA DE ANIMACIÓN DE CIERRE DE SESIÓN */}
      <AnimatePresence>
          {isLogoutAnimating && (
              <LogoutAnimationOverlay onAnimationComplete={completeLogout} />
          )}
      </AnimatePresence>
    </div>
  );
}
