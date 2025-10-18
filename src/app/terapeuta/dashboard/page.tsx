'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  Timestamp,
  orderBy,
  addDoc
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';

// LIBRERÍA DE ANIMACIÓN LOTTIE
import Lottie from 'lottie-react';
import logoutAnimationData from '@/salir.json'; 

import {
  FiLogOut,
  FiSettings,
  FiClock,
  FiFileText,
  FiCheckCircle,
  FiHome,
  FiUsers,
  FiMenu,
  FiBell,
  FiCalendar
} from 'react-icons/fi';

// --- Componentes Reutilizados ---
import ProfileSettingsModal from '../../../components/ProfileSettingsModal';
import AppointmentDetailsModal from '../components/AppointmentDetailsModal';
import PatientsView from '@/app/terapeuta/components/PatientsView';
import PatientHistoryModal from '../components/PatientHistoryModal';
import NotificationPanel, { ToastNotifications, type Notification } from '../../../components/NotificationHandler';
import WeeklyCalendar from '../components/WeeklyCalendar';

// -----------------------------------------------------------------
// --- COMPONENTE: Capa de animación para cerrar sesión ---
// -----------------------------------------------------------------
const LogoutAnimationOverlay = ({ onAnimationComplete }: { onAnimationComplete: () => void }) => {
    const [animationFinished, setAnimationFinished] = useState(false);
    
    useEffect(() => {
        const backupTimer = setTimeout(() => {
            console.log('Redirección por timeout');
            setAnimationFinished(true);
            onAnimationComplete();
        }, 3000);

        return () => clearTimeout(backupTimer);
    }, [onAnimationComplete]);

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

// --- Helper Functions ---
const toLocalDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// --- Tipos UNIFICADOS ---
interface BaseAppointment {
  id: string;
  patientId: string;
  patientName: string;
  therapistId?: string;
  date: string;
  time: string;
  type: 'therapy' | 'consultation' | string;
  status: 'scheduled' | 'completed' | 'cancelled' | 'no-show';
  observations?: string;
  indicatedTreatment?: boolean | { name: string; details?: string }[];
  bodyArea?: string[];
  createdAt?: any; // ✅ HACER OPCIONAL
}

interface Patient {
  id: string;
  name: string;
  contact: string;
  email: string;
  dob: string;
}

interface UserData {
  uid: string;
  name: string;
  role: string;
  avatarUrl?: string;
}

// --- SISTEMA DE NOTIFICACIONES MEJORADO ---
const createNotification = async (
  userId: string, 
  type: Notification['type'],
  message: string, 
  metadata?: { appointmentId?: string; patientId?: string; priority?: 'low' | 'medium' | 'high'; }
): Promise<string> => {
  try {
    const notifRef = collection(db, `users/${userId}/notifications`);
    const newNotifDoc: Omit<Notification, 'id'> = {
      type,
      message,
      read: false,
      saved: false,
      timestamp: Timestamp.now(),
      metadata
    };
    
    const docRef = await addDoc(notifRef, newNotifDoc);
    return docRef.id;
  } catch (error) {
    console.error('❌ Error creando notificación:', error);
    throw error;
  }
};

const validateNotificationData = (data: any): boolean => {
  return data && 
         typeof data.type === 'string' && 
         typeof data.message === 'string' &&
         typeof data.read === 'boolean' &&
         typeof data.saved === 'boolean' &&
         data.timestamp;
};

// --- Sub-componente para la vista de Inicio ---
const DashboardHomeContent = ({ appointments, isLoading, onSelectAppointment, userName }: {
  appointments: BaseAppointment[];
  isLoading: boolean;
  onSelectAppointment: (appt: BaseAppointment) => void;
  userName: string;
}) => (
  <div className="space-y-8">
    <motion.div
      className="relative p-8 rounded-3xl overflow-hidden bg-slate-800 text-white shadow-2xl"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-sky-700 to-slate-900 opacity-80 z-0"></div>
      <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-5"></div>
      <div className="relative z-10">
        <h2 className="text-4xl font-bold mb-2">Hola, {userName.split(' ')[0]}.</h2>
        <p className="text-sky-200 text-lg">Aquí tienes un resumen de tus citas para hoy.</p>
      </div>
    </motion.div>

    <div className="bg-white p-6 rounded-2xl shadow-xl border border-slate-200/80">
      <h3 className="text-2xl font-bold text-slate-800 mb-6">Citas del Día</h3>
      {isLoading ? (
        <div className="text-center text-slate-500 py-10">Cargando citas...</div>
      ) : appointments.length === 0 ? (
        <div className="text-center text-slate-500 py-10 bg-slate-50 rounded-xl">
          <p className="font-semibold">No tienes citas programadas para hoy.</p>
          <p className="text-sm mt-1">¡Disfruta de tu día!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {appointments.map((appt) => (
            <motion.div
              key={appt.id}
              className={`p-5 rounded-2xl shadow-lg cursor-pointer transition-all border-l-4 ${
                appt.status === 'completed' ? 'bg-slate-50 border-slate-300 opacity-70' : 'bg-white border-sky-500'
              }`}
              onClick={() => onSelectAppointment(appt)}
              whileHover={{ y: -5, boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)' }}
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-bold text-lg text-slate-800">{appt.patientName}</p>
                  <div className="flex items-center space-x-2 mt-1">
                    <FiClock className="text-sky-600" />
                    <span className="text-sky-600 font-semibold">{appt.time}</span>
                  </div>
                  <p className="text-sm text-slate-500 mt-2 capitalize">{appt.type === 'consultation' ? 'Consulta' : 'Terapia'}</p>
                </div>
                {appt.status === 'completed' &&
                  <FiCheckCircle className="text-emerald-500 flex-shrink-0" size={22} title="Completada" />}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  </div>
);

// --- Componente Principal del Dashboard ---
export default function TherapistDashboardPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [appointments, setAppointments] = useState<BaseAppointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [view, setView] = useState('dashboard');
  const [selectedAppointment, setSelectedAppointment] = useState<BaseAppointment | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [isSettingsModalOpen, setSettingsModalOpen] = useState(false);
  
  const [isLogoutAnimating, setIsLogoutAnimating] = useState(false);
  
  const router = useRouter();

  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [toastNotifications, setToastNotifications] = useState<Notification[]>([]);
  const [isNotificationPanelOpen, setNotificationPanelOpen] = useState(false);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);
  
  const isInitialLoad = useRef(true);
  const notificationUnsubscribes = useRef<(() => void)[]>([]);
  const sentUpcomingNotifications = useRef<Set<string>>(new Set());
  const lastNotificationCheck = useRef<Date>(new Date());

  const unreadCount = notifications.filter(n => !n.read).length;

  const fetchUserData = useCallback(async (uid: string): Promise<UserData | null> => {
    const userDocRef = doc(db, "users", uid);
    const userDoc = await getDoc(userDocRef);
    if (userDoc.exists()) {
      const data = { uid, ...userDoc.data() } as UserData;
      setUserData(data);
      return data;
    }
    return null;
  }, []);

  const cleanupSubscriptions = useCallback(() => {
    notificationUnsubscribes.current.forEach(unsubscribe => {
      try {
        unsubscribe();
      } catch (error) {
        console.error('Error cleaning up subscription:', error);
      }
    });
    notificationUnsubscribes.current = [];
  }, []);

  const setupUserNotifications = useCallback(async (userId: string) => {
    if (!userId) return;
    
    setIsLoadingNotifications(true);

    try {
      cleanupSubscriptions();

      const notifQuery = query(
        collection(db, `users/${userId}/notifications`),
        orderBy('timestamp', 'desc')
      );
      
      const unsubscribeNotifs = onSnapshot(notifQuery, 
        (snapshot) => {
          const validNotifications: Notification[] = [];
          snapshot.forEach(doc => {
            const data = doc.data();
            if (validateNotificationData(data)) {
              validNotifications.push({ id: doc.id, ...data } as Notification);
            } else {
              console.warn('⚠️ Notificación con datos inválidos:', doc.id, data);
            }
          });
          setNotifications(validNotifications);
          setIsLoadingNotifications(false);
        },
        (error) => {
          console.error('❌ Error en suscripción a notificaciones:', error);
          setIsLoadingNotifications(false);
        }
      );

      notificationUnsubscribes.current.push(unsubscribeNotifs);

    } catch (error) {
      console.error('❌ Error configurando notificaciones:', error);
      setIsLoadingNotifications(false);
    }
  }, [cleanupSubscriptions]);

  const checkUpcomingAppointments = useCallback(async (userId: string) => {
    if (!userId) return;

    const now = new Date();
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
    const thirtyMinutesFromNow = new Date(now.getTime() + 30 * 60 * 1000);

    if (now.getTime() - lastNotificationCheck.current.getTime() < 2 * 60 * 1000) {
      return;
    }

    lastNotificationCheck.current = now;

    try {
      const upcomingNotifications: Promise<string>[] = [];

      appointments.forEach(async (appt) => {
        if (appt.status === 'completed' || appt.status === 'cancelled') {
          return;
        }

        const today = toLocalDateString(new Date());
        const [hour, minute] = appt.time.split(':').map(Number);
        const apptDateTime = new Date(`${today}T${appt.time}`);
        apptDateTime.setHours(hour, minute, 0, 0);

        const notificationKey = `upcoming-${appt.id}-${apptDateTime.getTime()}`;

        if (sentUpcomingNotifications.current.has(notificationKey)) {
          return;
        }

        if (apptDateTime > now && apptDateTime <= thirtyMinutesFromNow) {
          const notifPromise = createNotification(
            userId,
            'upcoming_appointment',
            `⏰ Cita en 30 min: ${appt.patientName} a las ${appt.time}`,
            {
              appointmentId: appt.id,
              patientId: appt.patientId,
              priority: 'high'
            }
          );
          upcomingNotifications.push(notifPromise);
          sentUpcomingNotifications.current.add(notificationKey);
        }
        else if (apptDateTime > thirtyMinutesFromNow && apptDateTime <= oneHourFromNow) {
          const notifPromise = createNotification(
            userId,
            'upcoming_appointment',
            `📅 Cita en 1 hora: ${appt.patientName} a las ${appt.time}`,
            {
              appointmentId: appt.id,
              patientId: appt.patientId,
              priority: 'medium'
            }
          );
          upcomingNotifications.push(notifPromise);
          sentUpcomingNotifications.current.add(notificationKey);
        }
      });

      if (upcomingNotifications.length > 0) {
        const notifIds = await Promise.all(upcomingNotifications);
        
        notifIds.forEach((notifId, index) => {
          const appt = appointments[index];
          if (appt) {
            setToastNotifications(prev => [
              {
                id: notifId,
                type: 'upcoming_appointment',
                message: `Recordatorio: ${appt.patientName} a las ${appt.time}`,
                read: false,
                saved: false,
                timestamp: Timestamp.now(),
                metadata: {
                  appointmentId: appt.id,
                  patientId: appt.patientId
                }
              },
              ...prev
            ]);
          }
        });
      }

    } catch (error) {
      console.error('❌ Error verificando citas próximas:', error);
    }
  }, [appointments]);
  
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const data = await fetchUserData(user.uid);
        if (data && data.role === 'terapeuta') {
          setCurrentUser(user);
          await setupUserNotifications(user.uid);
        } else {
          router.push('/');
        }
      } else {
        router.push('/');
      }
    });
    return () => {
      unsubscribeAuth();
      cleanupSubscriptions();
    };
  }, [router, fetchUserData, setupUserNotifications, cleanupSubscriptions]);

  useEffect(() => {
    if (!currentUser) return;

    setIsLoading(true);
    const today = toLocalDateString(new Date());
    const q = query(
      collection(db, 'appointments'),
      where('therapistId', '==', currentUser.uid),
      where('date', '==', today),
      where('status', 'in', ['scheduled', 'completed']),
      orderBy('time')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const appts = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(),
        indicatedTreatment: doc.data().indicatedTreatment || false,
        createdAt: doc.data().createdAt || Timestamp.now(),
        therapistId: doc.data().therapistId || currentUser.uid
      } as BaseAppointment));
      setAppointments(appts);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching appointments:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser || appointments.length === 0) return;

    checkUpcomingAppointments(currentUser.uid);

    const interval = setInterval(() => {
      checkUpcomingAppointments(currentUser.uid);
    }, 2 * 60 * 1000);

    return () => clearInterval(interval);
  }, [currentUser, appointments, checkUpcomingAppointments]);

  useEffect(() => {
    if (toastNotifications.length > 0) {
      const timers: NodeJS.Timeout[] = [];
      
      toastNotifications.forEach((notification, index) => {
        const timer = setTimeout(() => {
          setToastNotifications(prev => prev.filter(n => n.id !== notification.id));
        }, 5000 + (index * 200));
        
        timers.push(timer);
      });

      return () => {
        timers.forEach(timer => clearTimeout(timer));
      };
    }
  }, [toastNotifications]);

  const handleSelectAppointment = (appointment: BaseAppointment) => {
    setSelectedAppointment(appointment);
  };

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
    try {
      await updateDoc(doc(db, `users/${currentUser.uid}/notifications`, id), { read: true });
    } catch (error) {
      console.error('❌ Error marcando notificación como leída:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!currentUser) return;
    try {
      const unreadNotifications = notifications.filter(n => !n.read);
      const updatePromises = unreadNotifications.map(notification =>
        updateDoc(doc(db, `users/${currentUser.uid}/notifications`, notification.id), { 
          read: true 
        })
      );
      await Promise.all(updatePromises);
    } catch (error) {
      console.error('❌ Error marcando todas como leídas:', error);
    }
  };

  const handleSaveNotification = async (id: string, saved: boolean) => {
    if (!currentUser) return;
    try {
      await updateDoc(doc(db, `users/${currentUser.uid}/notifications`, id), { saved });
    } catch (error) {
      console.error('❌ Error guardando notificación:', error);
    }
  };

  const handleDeleteNotification = async (id: string) => {
    if (!currentUser) return;
    try {
      await deleteDoc(doc(db, `users/${currentUser.uid}/notifications`, id));
    } catch (error) {
      console.error('❌ Error eliminando notificación:', error);
    }
  };

  const handleCloseToast = (id: string) => {
    setToastNotifications(prev => prev.filter(n => n.id !== id));
  };

  const handleBackToDashboard = () => {
    setView('dashboard');
  };

  const renderMainContent = () => {
    switch (view) {
      case 'patients':
        return <PatientsView therapistId={currentUser!.uid} onSelectPatient={setSelectedPatient} />;
      case 'calendar':
        return (
          <WeeklyCalendar 
            therapistId={currentUser!.uid} 
            onBackToDashboard={handleBackToDashboard}
            onSelectAppointment={handleSelectAppointment}
          />
        );
      case 'dashboard':
      default:
        return (
          <DashboardHomeContent
            appointments={appointments}
            isLoading={isLoading}
            onSelectAppointment={handleSelectAppointment}
            userName={userData?.name || 'Terapeuta'}
          />
        );
    }
  };

  if (!currentUser || !userData) {
    return <div className="flex h-screen w-full items-center justify-center">Cargando...</div>;
  }

  return (
    <div className="flex min-h-screen bg-sky-50 font-sans text-slate-800">
      <motion.aside 
        className="fixed top-0 left-0 h-full w-64 bg-white/80 backdrop-blur-xl border-r border-slate-200/80 shadow-2xl z-40 p-6 flex flex-col justify-between"
        animate={{ x: isSidebarOpen ? 0 : -256 }}
      >
        <div>
          <div className="flex flex-col items-center space-y-4 mb-12">
            <button onClick={() => setView('dashboard')} className="cursor-pointer transition-transform duration-200 hover:scale-105">
              <Image src="/CRE logoo.svg" alt="Logo Clínica CRE" width={100} height={70} priority />
            </button>
          </div>
          <nav className="space-y-3">
            <button 
              onClick={() => setView('dashboard')} 
              className={`w-full flex items-center space-x-4 py-3 px-4 rounded-xl font-semibold transition-all duration-200 ${
                view === 'dashboard' ? 'bg-sky-100 text-sky-800 shadow-sm' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <FiHome className="text-2xl" />
              <span>Inicio</span>
            </button>
            
            <button 
              onClick={() => setView('calendar')} 
              className={`w-full flex items-center space-x-4 py-3 px-4 rounded-xl font-semibold transition-all duration-200 ${
                view === 'calendar' ? 'bg-sky-100 text-sky-800 shadow-sm' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <FiCalendar className="text-2xl" />
              <span>Calendario</span>
            </button>
            
            <button 
              onClick={() => setView('patients')} 
              className={`w-full flex items-center space-x-4 py-3 px-4 rounded-xl font-semibold transition-all duration-200 ${
                view === 'patients' ? 'bg-sky-100 text-sky-800 shadow-sm' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <FiUsers className="text-2xl" />
              <span>Pacientes</span>
            </button>
          </nav>
        </div>
        <div className="space-y-3">
          <button 
            onClick={() => setSettingsModalOpen(true)} 
            className="w-full flex items-center justify-center space-x-3 py-3 px-4 rounded-xl bg-slate-200 text-slate-800 font-semibold hover:bg-slate-300 transition-colors"
          >
            <span>Configuración</span>
            <FiSettings />
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

      <div className={`flex-1 flex flex-col transition-all duration-300 ${isSidebarOpen ? 'lg:ml-64' : 'lg:ml-0'}`}>
        <header className="sticky top-0 w-full bg-white/80 backdrop-blur-xl shadow-md z-20 py-4 px-6 md:px-10 flex justify-between items-center border-b border-slate-200/80">
          <button 
            onClick={() => setSidebarOpen(!isSidebarOpen)} 
            className="p-2 -ml-2 text-slate-600"
          >
            <FiMenu size={24} />
          </button>
          <div className="flex items-center space-x-6">
            <div className="relative">
              <button 
                onClick={() => setNotificationPanelOpen(prev => !prev)} 
                className="relative text-slate-500 hover:text-slate-700 transition-colors"
                disabled={isLoadingNotifications}
              >
                <FiBell size={24} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-sky-500"></span>
                  </span>
                )}
                {isLoadingNotifications && (
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-slate-400"></span>
                  </span>
                )}
              </button>
              <AnimatePresence>
                {isNotificationPanelOpen && (
                  <NotificationPanel
                    notifications={notifications}
                    isLoading={isLoadingNotifications}
                    onMarkAsRead={handleMarkAsRead}
                    onMarkAllAsRead={handleMarkAllAsRead}
                    onSave={handleSaveNotification}
                    onDelete={handleDeleteNotification}
                    onClose={() => setNotificationPanelOpen(false)}
                  />
                )}
              </AnimatePresence>
            </div>
            
            <div className="relative">
              <button 
                onClick={() => setSettingsModalOpen(true)} 
                className="flex items-center space-x-3 cursor-pointer"
              >
                <Image 
                  src={userData?.avatarUrl || "/Doctor.jpg"} 
                  alt="Avatar" 
                  width={40} 
                  height={40} 
                  className="w-10 h-10 rounded-full object-cover" 
                />
                <div className="hidden md:block">
                  <span className="font-semibold">{userData?.name || 'Terapeuta'}</span>
                </div>
              </button>
            </div>
          </div>
        </header>

        <main className="flex-grow p-6 md:p-10 relative">
          <AnimatePresence mode="wait">
            <motion.div 
              key={view} 
              initial={{ opacity: 0, y: 20 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: -20 }}
            >
              {renderMainContent()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <AnimatePresence>
          {isLogoutAnimating && (
              <LogoutAnimationOverlay onAnimationComplete={completeLogout} />
          )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedAppointment && (
          <AppointmentDetailsModal
            appointment={selectedAppointment}
            onClose={() => setSelectedAppointment(null)}
            allAppointments={appointments}
          />
        )}
        {isSettingsModalOpen && currentUser && (
          <ProfileSettingsModal
            user={currentUser}
            onClose={() => setSettingsModalOpen(false)}
            onProfileUpdate={() => currentUser && fetchUserData(currentUser.uid)}
          />
        )}
        {selectedPatient && (
          <PatientHistoryModal
            patient={selectedPatient}
            onClose={() => setSelectedPatient(null)}
          />
        )}
      </AnimatePresence>
      
      <ToastNotifications notifications={toastNotifications} onClose={handleCloseToast} />
    </div>
  );
}
