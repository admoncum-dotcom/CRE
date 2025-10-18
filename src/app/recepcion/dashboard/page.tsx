'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { signOut, onAuthStateChanged, User } from 'firebase/auth';
import { 
  doc, getDoc, collection, query, where, addDoc, onSnapshot, getDocs, Timestamp, updateDoc, deleteDoc
} from 'firebase/firestore';
import Image from 'next/image';
import { auth, db } from '@/lib/firebase';

// LIBRERÍA DE ANIMACIÓN LOTTIE
import Lottie from 'lottie-react';
import logoutAnimationData from '@/salir.json'; 

// Componentes (VERIFICAR RUTAS)
import WeeklyAppointmentsChart from '../components/WeeklyAppointmentsChart';
import CreatePatientForm from '../components/CreatePatientForm';
import ScheduleAppointment from '../components/ScheduleAppointment';
import FirstSchedule from '../components/FirstSchedule'; // NUEVO COMPONENTE IMPORTADO
import PatientsView from '../components/PatientsView'; 
import AppointmentsView from '../components/AppointmentView';
import ProfileSettingsModal from '../../../components/ProfileSettingsModal';
import NotificationPanel, { ToastNotifications } from '../../../components/NotificationHandler';
import PatientSearchView from '../components/PatientSearchView';

// Iconos
import { 
  FiUsers, FiHome, FiUserPlus, FiCalendar, FiLogOut, FiBell, FiMenu, FiSettings, FiHeart, FiShield,
  FiFileText
} from 'react-icons/fi';

// --- Helper Function para Fechas ---
const toLocalDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// --- Interfaces para Notificaciones ---
interface Notification {
  id: string;
  type: 'new_appointment' | 'upcoming_appointment' | 'appointment_cancelled' | 'admin_message' | 'system_alert' | 'patient_message';
  message: string;
  read: boolean;
  saved: boolean;
  timestamp: Timestamp;
}

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

// --- SUB-COMPONENTE PARA LA VISTA DE INICIO DEL DASHBOARD ---
const DashboardHomeContent = ({ setView, doctors, therapists }: { setView: (v: string) => void, doctors: any[], therapists: any[] }) => {
    const [stats, setStats] = useState({ total: 0, consultations: 0, therapies: 0 });
    const [isLoadingStats, setIsLoadingStats] = useState(true);
    const [weeklyData, setWeeklyData] = useState<any[]>([]);
    const [isLoadingChart, setIsLoadingChart] = useState(true);
    const [filter, setFilter] = useState('all');

    useEffect(() => {
      const today = toLocalDateString(new Date());
      const q = query(collection(db, 'appointments'), where('date', '==', today), where('status', '==', 'scheduled'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        let consultations = 0, therapies = 0;
        snapshot.forEach(doc => {
          if (doc.data().type === 'consultation') consultations++;
          if (doc.data().type === 'therapy') therapies++;
        });
        setStats({ total: snapshot.size, consultations, therapies });
        setIsLoadingStats(false);
      });
      return () => unsubscribe();
    }, []);

    useEffect(() => {
        setIsLoadingChart(true);
        const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        const dailyCounts: { [key: string]: { name: string, pacientes: number } } = {};
        const today = new Date();
        
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(today.getDate() - i);
            const formattedDate = toLocalDateString(date);
            dailyCounts[formattedDate] = { name: dayNames[date.getDay()], pacientes: 0 };
        }
        
        const firstDay = Object.keys(dailyCounts)[0];
        const lastDay = Object.keys(dailyCounts)[Object.keys(dailyCounts).length - 1];

        const constraints = [where('date', '>=', firstDay), where('date', '<=', lastDay)];
        if (filter.startsWith('doc-')) constraints.push(where('doctorId', '==', filter.split('-')[1]));
        if (filter.startsWith('ther-')) constraints.push(where('therapistId', '==', filter.split('-')[1]));

        const q = query(collection(db, 'appointments'), ...constraints);
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const newCounts = { ...dailyCounts };
            Object.keys(newCounts).forEach(date => {
                newCounts[date] = {
                    ...newCounts[date],
                    pacientes: 0
                };
            })
            snapshot.forEach(doc => {
                const appt = doc.data();
                if (newCounts[appt.date] && appt.status !== 'cancelled') {
                    newCounts[appt.date].pacientes++;
                }
            });
            setWeeklyData(Object.values(newCounts));
            setIsLoadingChart(false);
        });
        return () => unsubscribe();
    }, [filter]);

    const StatCard = ({ title, value, icon, color }: { title: string; value: string; icon: React.ReactNode; color: string; }) => (
      <motion.div 
        className={`bg-white p-6 rounded-2xl shadow-xl border border-slate-200/80 flex items-center justify-between border-l-4 ${color}`} 
        initial={{ opacity: 0, y: 20 }} 
        animate={{ opacity: 1, y: 0 }}
      >
        <div>
          <h4 className="text-lg font-semibold text-slate-500">{title}</h4>
          <p className="text-3xl font-bold text-slate-800 mt-1">{value}</p>
        </div>
        <div className={`text-4xl p-3 rounded-full bg-gradient-to-br ${color.replace('border', 'from').replace('-500', '-100')} to-white ${color.replace('border', 'text')}`}>
          {icon}
        </div>
      </motion.div>
    );
    
    const SkeletonStatCard = () => (
      <div className="bg-white p-6 rounded-2xl shadow-lg flex items-center justify-between border-l-4 border-slate-200 animate-pulse">
        <div className="w-2/3 space-y-3">
          <div className="h-5 bg-slate-200 rounded w-3/4"></div>
          <div className="h-8 bg-slate-300 rounded w-1/2"></div>
          </div>
        <div className="h-14 w-14 bg-slate-200 rounded-full"></div>
      </div>
    );

    return (
        <div className="space-y-8">
            <motion.div className="relative p-8 rounded-3xl overflow-hidden bg-slate-800 text-white shadow-2xl">
                 <div className="absolute inset-0 bg-gradient-to-br from-sky-700 to-slate-900 opacity-80 z-0"></div>
                 <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-5"></div>
                 <div className="relative z-10">
                     <h2 className="text-4xl font-bold mb-2">Bienvenida de nuevo.</h2>
                     <p className="text-sky-200 text-lg mb-6">Gestiona el flujo de pacientes y citas de manera eficiente.</p>
                     <div className="flex flex-wrap gap-4">
                         <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setView('patients')} className="py-3 px-6 bg-white/10 border border-white/20 backdrop-blur-lg text-white rounded-full shadow-lg hover:bg-white/20 transition-all flex items-center space-x-2"><FiUsers /><span>Ver Pacientes</span></motion.button>
                         <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setView('create-patient')} className="py-3 px-6 bg-white/10 border border-white/20 backdrop-blur-lg text-white rounded-full shadow-lg hover:bg-white/20 transition-all flex items-center space-x-2"><FiUserPlus /><span>Crear Nuevo Paciente</span></motion.button>
                     </div>
                 </div>
            </motion.div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {isLoadingStats ? <><SkeletonStatCard /><SkeletonStatCard /><SkeletonStatCard /></> : <>
                <StatCard title="Total Citas Hoy" value={stats.total.toString()} icon={<FiUsers />} color="border-sky-500" />
                <StatCard title="Consultas de Hoy" value={stats.consultations.toString()} icon={<FiHeart />} color="border-emerald-500" />
                <StatCard title="Terapias de Hoy" value={stats.therapies.toString()} icon={<FiShield />} color="border-amber-500" />
                </>}
            </div>
            <WeeklyAppointmentsChart data={weeklyData} isLoading={isLoadingChart} doctors={doctors} therapists={therapists} filter={filter} onFilterChange={setFilter}/>
        </div>
    );
};

// --- PÁGINA PRINCIPAL DEL DASHBOARD ---
export default function ReceptionistDashboardPage() {
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<any | null>(null);
  const [view, setView] = useState('dashboard');
  const [previousView, setPreviousView] = useState('dashboard');
  const [doctors, setDoctors] = useState<any[]>([]);
  const [therapists, setTherapists] = useState<any[]>([]);
  const [patientToSchedule, setPatientToSchedule] = useState<any | null>(null);
  const [isSettingsModalOpen, setSettingsModalOpen] = useState(false);
  
  // Estados para notificaciones
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [toastNotifications, setToastNotifications] = useState<Notification[]>([]);
  const [isNotificationPanelOpen, setNotificationPanelOpen] = useState(false);
  const isInitialAppointmentsLoad = useRef(true);
  const unreadCount = notifications.filter(n => !n.read).length;
  
  // ESTADO PARA LA ANIMACIÓN DE CIERRE DE SESIÓN
  const [isLogoutAnimating, setIsLogoutAnimating] = useState(false); 
  
  const router = useRouter();

  const fetchUserData = async (uid: string) => {
    const userDocRef = doc(db, "users", uid);
    const userDoc = await getDoc(userDocRef);
    if (userDoc.exists()) { 
      setUserData({ uid, ...userDoc.data() }); 
      return userDoc.data(); 
    }
    return null;
  };

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const data = await fetchUserData(currentUser.uid);
        if (data && data.role === 'recepcion') {
          setUser(currentUser);
        } else { 
          router.push('/'); 
        }
      } else { 
        router.push('/'); 
      }
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

  // Sistema de notificaciones
  useEffect(() => {
    if (!user) return;
    
    const notifQuery = query(collection(db, `users/${user.uid}/notifications`));
    const unsubscribeNotifs = onSnapshot(notifQuery, (snapshot) => {
        setNotifications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification)));
    });

    // Escuchar por nuevas citas creadas después de la carga inicial
    const apptsQuery = query(collection(db, 'appointments'), where('createdAt', '>', new Date().toISOString()));
    const unsubscribeAppts = onSnapshot(apptsQuery, (snapshot) => {
        if (isInitialAppointmentsLoad.current) { 
          isInitialAppointmentsLoad.current = false; 
          return; 
        }
        
        snapshot.docChanges().forEach(async (change) => {
            if (change.type === "added") {
                const newAppt = change.doc.data();
                // Notificar a la recepcionista actual
                const notifRef = collection(db, `users/${user.uid}/notifications`);
                const newNotifDoc: Omit<Notification, 'id'> = { 
                  type: 'new_appointment', 
                  message: `Nueva cita para ${newAppt.patientName} a las ${newAppt.time}`, 
                  read: false, 
                  saved: false, 
                  timestamp: Timestamp.now() 
                };
                const docRef = await addDoc(notifRef, newNotifDoc);
                setToastNotifications(prev => [{id: docRef.id, ...newNotifDoc}, ...prev]);

                // Notificar a la doctora asignada
                if (newAppt.doctorId) {
                    const doctorNotifRef = collection(db, `users/${newAppt.doctorId}/notifications`);
                    await addDoc(doctorNotifRef, {
                        type: 'new_appointment',
                        message: `Te han asignado a ${newAppt.patientName} a las ${newAppt.time}`,
                        read: false, 
                        saved: false, 
                        timestamp: Timestamp.now()
                    });
                }
            }
        });
    });

    return () => { unsubscribeNotifs(); unsubscribeAppts(); };
  }, [user]);

  useEffect(() => {
    if (toastNotifications.length > 0) {
        const timer = setTimeout(() => { 
          setToastNotifications(prev => prev.slice(0, prev.length - 1)); 
        }, 5000);
        return () => clearTimeout(timer);
    }
  }, [toastNotifications]);

  // Funciones de manejo de notificaciones
  const handleMarkAsRead = async (id: string) => { 
    if (!user) return; 
    await updateDoc(doc(db, `users/${user.uid}/notifications`, id), { read: true }); 
  };

  const handleSaveNotification = async (id: string, saved: boolean) => { 
    if (!user) return; 
    await updateDoc(doc(db, `users/${user.uid}/notifications`, id), { saved }); 
  };

  const handleDeleteNotification = async (id: string) => { 
    if (!user) return; 
    await deleteDoc(doc(db, `users/${user.uid}/notifications`, id)); 
  };

  const handleCloseToast = (id: string) => setToastNotifications(prev => prev.filter(n => n.id !== id));

  const navigateTo = (newView: string) => {
    setPreviousView(view);
    setView(newView);
  };
  
  // FUNCIÓN MODIFICADA: Ahora lleva a FirstSchedule en lugar de ScheduleAppointment
  const handleCreatePatient = async (patientData: any) => {
    const patientRef = await addDoc(collection(db, 'patients'), {
      ...patientData,
      createdAt: new Date().toISOString()
    });
    const newPatient = { id: patientRef.id, ...patientData };
    setPatientToSchedule(newPatient);
    navigateTo('first-schedule'); // CAMBIO AQUÍ: 'first-schedule' en lugar de 'schedule-appointment'
  };

  const handleScheduleExistingPatient = (patient: any) => {
    setPatientToSchedule(patient);
    navigateTo('schedule-appointment');
  };

  // LÓGICA DE CIERRE DE SESIÓN CON ANIMACIÓN - CORREGIDA
  const animatedLogout = () => {
    console.log('Iniciando animación de cierre de sesión');
    setIsLogoutAnimating(true);
  };
  
  const completeLogout = async () => {
    try {
      console.log('Ejecutando cierre de sesión...');
      await signOut(auth); 
      console.log('Sesión cerrada, redirigiendo...');
      router.push('/'); // Esto te llevará al login
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
      // Redirigir incluso si hay error
      router.push('/');
    }
  };

  const renderMainContent = () => {
    switch (view) {
      case 'create-patient':
        return <CreatePatientForm onBack={() => setView(previousView)} onCreatePatient={handleCreatePatient} onPatientExists={handleScheduleExistingPatient} />;
      case 'schedule-appointment':
        if (!patientToSchedule) { setView('patients'); return null; }
        return <ScheduleAppointment patient={patientToSchedule} onBack={() => setView(previousView)} doctors={doctors} therapists={therapists} />;
      case 'first-schedule': // NUEVO CASO AÑADIDO
        if (!patientToSchedule) { setView('patients'); return null; }
        return <FirstSchedule patient={patientToSchedule} onBack={() => setView(previousView)} doctors={doctors} therapists={therapists} />;
      case 'patients':
        return <PatientsView onBack={() => navigateTo('dashboard')} onSchedule={handleScheduleExistingPatient} therapists={therapists} />;
      case 'appointments':
         return <AppointmentsView onBack={() => navigateTo('dashboard')} doctors={doctors} therapists={therapists} />;
      case 'patient-search':
          return <PatientSearchView doctorName={userData?.name || 'Doctora'} />;
      default:
        return <DashboardHomeContent setView={navigateTo} doctors={doctors} therapists={therapists} />;
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
            <button onClick={() => navigateTo('dashboard')} className={`w-full flex items-center space-x-4 py-3 px-4 rounded-xl font-semibold transition-all duration-200 ${view === 'dashboard' ? 'bg-sky-100 text-sky-800 shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}><FiHome className="text-2xl" /><span>Inicio</span></button>
            <button onClick={() => navigateTo('patients')} className={`w-full flex items-center space-x-4 py-3 px-4 rounded-xl font-semibold transition-all duration-200 ${view === 'patients' || view.includes('create') || view.includes('schedule') || view.includes('first') ? 'bg-sky-100 text-sky-800 shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}><FiUsers className="text-2xl" /><span>Pacientes</span></button>
            <button onClick={() => navigateTo('appointments')} className={`w-full flex items-center space-x-4 py-3 px-4 rounded-xl font-semibold transition-all duration-200 ${view === 'appointments' ? 'bg-sky-100 text-sky-800 shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}><FiCalendar className="text-2xl" /><span>Citas</span></button>
            <button onClick={() => setView('patient-search')} className={`w-full flex items-center space-x-4 py-3 px-4 rounded-xl font-semibold transition-all duration-200 ${view === 'patient-search' ? 'bg-sky-100 text-sky-800 shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}><FiFileText className="text-2xl" /><span>Expedientes</span></button>
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
                {/* Botón de notificaciones */}
                <div className="relative">
                    <button onClick={() => setNotificationPanelOpen(prev => !prev)} className="relative text-slate-500 hover:text-slate-700">
                        <FiBell size={24} />
                        {unreadCount > 0 && (
                          <span className="absolute -top-1 -right-1 flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-sky-500"></span>
                          </span>
                        )}
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
                            if (!user) return;
                            const notifRef = collection(db, `users/${user.uid}/notifications`);
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
                
                {/* Avatar */}
                <div className="relative">
                    <button onClick={() => setSettingsModalOpen(true)} className="flex items-center space-x-3 cursor-pointer">
                        <Image 
                          src={userData?.avatarUrl || "/Receptionist.jpg"} 
                          alt="Avatar" 
                          width={40} 
                          height={40} 
                          className="w-10 h-10 rounded-full object-cover" 
                        />
                        <div className="hidden md:block">
                            <span className="font-semibold">{userData?.name || 'Recepcionista'}</span>
                        </div>
                    </button>
                </div>
            </div>
        </header>
        <main className="flex-grow p-6 md:p-10 relative">
            <AnimatePresence mode="wait">
                <motion.div key={view} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                    {renderMainContent()}
                </motion.div>
            </AnimatePresence>
            
            <AnimatePresence>
              {view === 'patients' && (
                <motion.button
                  onClick={() => navigateTo('create-patient')}
                  className="fixed bottom-10 right-10 z-30 bg-sky-600 text-white p-4 rounded-full shadow-lg hover:bg-sky-700 transition-all transform hover:scale-110 focus:outline-none"
                  aria-label="Añadir nuevo paciente"
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.5 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                  whileHover={{ scale: 1.1 }}
                >
                  <FiUserPlus size={24} />
                </motion.button>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {isSettingsModalOpen && user && (
                <ProfileSettingsModal 
                  user={user} 
                  onClose={() => setSettingsModalOpen(false)} 
                  onProfileUpdate={() => user && fetchUserData(user.uid)} 
                />
              )}
            </AnimatePresence>
        </main>
      </div>
      
      {/* Notificaciones toast */}
      <ToastNotifications notifications={toastNotifications} onClose={handleCloseToast} />

      {/* CAPA DE ANIMACIÓN DE CIERRE DE SESIÓN */}
      <AnimatePresence>
          {isLogoutAnimating && (
              <LogoutAnimationOverlay onAnimationComplete={completeLogout} />
          )}
      </AnimatePresence>
    </div>
  );
}
