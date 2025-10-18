'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { signOut, onAuthStateChanged, User } from 'firebase/auth';
import { 
  doc, getDoc, collection, query, where, onSnapshot, Timestamp, addDoc, updateDoc, deleteDoc,
  orderBy, getDocs
} from 'firebase/firestore';
import Image from 'next/image';
import { auth, db } from '@/lib/firebase';

// LIBRERÍA DE ANIMACIÓN LOTTIE
import Lottie from 'lottie-react';
import logoutAnimationData from '@/salir.json'; 

// Importar los componentes
import AppointmentsView from '../components/AppointmentsView';
import AppointmentDetailsModal from '../components/AppointmentDetailsModal';
import PatientSearchView from '../components/PatientSearchView';
import ProfileSettingsModal from '../../../components/ProfileSettingsModal';
import NotificationPanel, { ToastNotifications, type Notification } from '../../../components/NotificationHandler';

// Iconos
import { FiSettings,
  FiCalendar, FiGrid, FiBell, FiSearch, FiHome, FiLogOut, FiMenu, FiEye, FiClock, FiActivity, FiFileText
} from 'react-icons/fi';

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

// --- SUB-COMPONENTE PARA LA VISTA DE INICIO ---
const DashboardHomeContent = ({ userName, appointments, onSelectAppointment, onShowTodaysAppointments }: { userName: string; appointments: any[]; onSelectAppointment: (appt: any) => void; onShowTodaysAppointments: () => void; }) => {
    const today = new Date().toISOString().split('T')[0];
    const todayAppointments = appointments.filter(appt => appt.date === today && appt.status !== 'cancelled');
    const completedToday = todayAppointments.filter(appt => appt.status === 'completed').length;
    const upcomingAppointments = appointments
        .filter(appt => appt.date >= today && appt.status !== 'completed' && appt.status !== 'cancelled')
        .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
        .slice(0, 5);
    
    const StatCard = ({ title, value, icon, color }: { title: string; value: string; icon: React.ReactNode; color: string; }) => (
        <motion.div className={`bg-white p-6 rounded-2xl shadow-xl border border-slate-200/80 flex items-center justify-between border-l-4 ${color}`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div><h4 className="text-lg font-semibold text-slate-500">{title}</h4><p className="text-3xl font-bold text-slate-800 mt-1">{value}</p></div>
            <div className={`text-4xl p-3 rounded-full bg-gradient-to-br ${color.replace('border', 'from').replace('-500', '-100')} to-white ${color.replace('border', 'text')}`}>{icon}</div>
        </motion.div>
    );

    return (
        <div className="space-y-8">
            <motion.div className="relative p-8 rounded-3xl overflow-hidden bg-slate-800 text-white shadow-2xl">
                 <div className="absolute inset-0 bg-gradient-to-br from-sky-700 to-slate-900 opacity-80 z-0"></div>
                 <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-5"></div>
                 <div className="relative z-10">
                     <h2 className="text-4xl font-bold mb-2">¡Hola, {userName}!</h2>
                     <p className="text-sky-200 text-lg mb-6">Gestiona tus citas y atiende a tus pacientes de manera eficiente.</p>
                     <button onClick={onShowTodaysAppointments} className="py-3 px-6 bg-white/10 border border-white/20 backdrop-blur-lg text-white rounded-full shadow-lg hover:bg-white/20 transition-all flex items-center space-x-2"><FiCalendar /><span>Ver Agenda de Hoy</span></button>
                 </div>
            </motion.div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <StatCard title="Citas para Hoy" value={todayAppointments.length.toString()} icon={<FiClock />} color="border-emerald-500" />
                <StatCard title="Pacientes Atendidos Hoy" value={completedToday.toString()} icon={<FiActivity />} color="border-sky-500" />
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-xl border border-slate-200/80">
                <h3 className="text-2xl font-bold text-slate-900 mb-4">Próximas Citas</h3>
                {upcomingAppointments.length > 0 ? (
                    <ul className="space-y-3">
                        {upcomingAppointments.map(appt => (
                            <motion.li key={appt.id} className="p-4 bg-white rounded-lg shadow-md border border-slate-200/80 flex items-center justify-between space-x-4 transition-all hover:shadow-xl hover:-translate-y-1" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} whileHover={{ scale: 1.02 }}>
                                <div><p className="font-semibold text-slate-800">{appt.patientName}</p><p className="text-sm text-slate-500">{appt.date === today ? 'Hoy' : appt.date} a las {appt.time}</p></div>
                                <button onClick={() => onSelectAppointment(appt)} className="flex items-center space-x-2 py-2 px-4 bg-sky-100 text-sky-800 text-sm font-semibold rounded-lg hover:bg-sky-200 transition-colors"><FiEye size={16} /><span>Atender</span></button>
                            </motion.li>
                        ))}
                    </ul>
                ) : <p className="text-slate-500 text-center py-4">No tienes próximas citas programadas.</p>}
            </div>
        </div>
    );
};

// --- SISTEMA DE NOTIFICACIONES MEJORADO ---

// ✅ CORRECCIÓN: Verificar si ya existe una notificación para evitar duplicados
const checkExistingNotification = async (
  userId: string,
  appointmentId: string,
  type: string
): Promise<boolean> => {
  try {
    const notifQuery = query(
      collection(db, `users/${userId}/notifications`),
      where('type', '==', type),
      where('metadata.appointmentId', '==', appointmentId)
    );
    
    const snapshot = await getDocs(notifQuery);
    return !snapshot.empty;
  } catch (error) {
    console.error('❌ Error verificando notificación existente:', error);
    return false;
  }
};

// Helper function para crear notificaciones (MEJORADA)
const createNotification = async (
  userId: string, 
  type: Notification['type'],
  message: string, 
  metadata?: { appointmentId?: string; patientId?: string; priority?: 'low' | 'medium' | 'high'; }
): Promise<string> => {
  try {
    // ✅ CORRECCIÓN: Verificar si ya existe esta notificación
    if (metadata?.appointmentId) {
      const exists = await checkExistingNotification(userId, metadata.appointmentId, type);
      if (exists) {
        console.log('⚠️ Notificación ya existe, evitando duplicado');
        return ''; // Retornar vacío si ya existe
      }
    }

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
    console.log('✅ Notificación creada:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('❌ Error creando notificación:', error);
    throw error;
  }
};

// Validar datos de notificación
const validateNotificationData = (data: any): boolean => {
  return data && 
         typeof data.type === 'string' && 
         typeof data.message === 'string' &&
         typeof data.read === 'boolean' &&
         typeof data.saved === 'boolean' &&
         data.timestamp;
};

// --- PÁGINA PRINCIPAL DEL DASHBOARD ---
export default function DoctorDashboardPage() {
    const [isSidebarOpen, setSidebarOpen] = useState(true);
    const [user, setUser] = useState<User | null>(null);
    const [userData, setUserData] = useState<any | null>(null);
    const [view, setView] = useState('dashboard');
    const [allAppointments, setAllAppointments] = useState<any[]>([]);
    const [selectedAppointment, setSelectedAppointment] = useState<any | null>(null);
    const [appointmentViewMode, setAppointmentViewMode] = useState<'all' | 'today'>('all');
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    
    // ESTADO PARA LA ANIMACIÓN DE CIERRE DE SESIÓN
    const [isLogoutAnimating, setIsLogoutAnimating] = useState(false);
    
    const router = useRouter();
    
    // ESTADOS DE NOTIFICACIONES MEJORADOS
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [toastNotifications, setToastNotifications] = useState<Notification[]>([]);
    const [isNotificationPanelOpen, setNotificationPanelOpen] = useState(false);
    const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);
    
    // ✅ CORRECCIÓN: Referencias mejoradas para control de notificaciones
    const isInitialLoad = useRef(true);
    const notificationUnsubscribes = useRef<(() => void)[]>([]);
    const processedAppointments = useRef<Set<string>>(new Set()); // Para evitar procesar la misma cita múltiples veces
    const lastNotificationCheck = useRef<Date>(new Date());

    const unreadCount = notifications.filter(n => !n.read).length;

    const fetchUserData = async (uid: string) => {
        const userDocRef = doc(db, "users", uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) { 
            setUserData({ uid, ...userDoc.data() }); 
            return userDoc.data(); 
        }
        return null;
    };

    // Limpiar suscripciones
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

    // Configurar notificaciones del usuario
    const setupUserNotifications = useCallback(async (userId: string) => {
        if (!userId) return;
        
        setIsLoadingNotifications(true);

        try {
            // Limpiar suscripciones anteriores
            cleanupSubscriptions();

            // Suscripción a notificaciones del usuario
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

    // ✅ CORRECCIÓN: CONFIGURACIÓN DE CITAS SIMPLIFICADA (SIN CREAR NOTIFICACIONES AQUÍ)
    const setupAppointments = useCallback((userId: string) => {
        if (!userId) return;

        // Consulta para obtener todas las citas del doctor
        const apptsQuery = query(
            collection(db, 'appointments'), 
            where('doctorId', '==', userId)
        );

        const unsubscribeAppts = onSnapshot(apptsQuery, (snapshot) => {
            const appointmentsData = snapshot.docs.map(d => ({ 
                id: d.id, 
                ...d.data() 
            }));
            
            setAllAppointments(appointmentsData);

            // ✅ CORRECCIÓN: Solo procesar cambios después de la carga inicial
            if (isInitialLoad.current) {
                isInitialLoad.current = false;
                return;
            }

            // ✅ CORRECCIÓN: Solo notificar nuevas citas (NO recordatorios aquí)
            snapshot.docChanges().forEach(async (change) => {
                if (change.type === "added") {
                    try {
                        const newAppt = change.doc.data();
                        
                        // Verificar si ya procesamos esta cita
                        if (processedAppointments.current.has(change.doc.id)) {
                            return;
                        }
                        
                        processedAppointments.current.add(change.doc.id);
                        
                        // Crear notificación para nueva cita
                        const notifId = await createNotification(
                            userId,
                            'new_appointment',
                            `Nueva cita: ${newAppt.patientName} a las ${newAppt.time}`,
                            {
                                appointmentId: change.doc.id,
                                patientId: newAppt.patientId,
                                priority: 'medium'
                            }
                        );

                        // Solo agregar toast si se creó la notificación
                        if (notifId) {
                            setToastNotifications(prev => [
                                {
                                    id: notifId,
                                    type: 'new_appointment',
                                    message: `Nueva cita: ${newAppt.patientName} a las ${newAppt.time}`,
                                    read: false,
                                    saved: false,
                                    timestamp: Timestamp.now(),
                                    metadata: {
                                        appointmentId: change.doc.id,
                                        patientId: newAppt.patientId
                                    }
                                },
                                ...prev
                            ]);
                        }

                    } catch (error) {
                        console.error('❌ Error procesando nueva cita:', error);
                    }
                }
            });
        }, (error) => {
            console.error('❌ Error en suscripción a citas:', error);
        });

        notificationUnsubscribes.current.push(unsubscribeAppts);
    }, []);

    // ✅ CORRECCIÓN: SISTEMA ÚNICO Y MEJORADO DE RECORDATORIOS (SOLO 30 MINUTOS ANTES)
    const checkUpcomingAppointments = useCallback(async (userId: string) => {
        if (!userId || allAppointments.length === 0) return;

        const now = new Date();
        const thirtyMinutesFromNow = new Date(now.getTime() + 30 * 60 * 1000);
        const twentyFiveMinutesFromNow = new Date(now.getTime() + 25 * 60 * 1000); // Ventana de 5 minutos

        // ✅ CORRECCIÓN: Solo verificar cada 5 minutos
        if (now.getTime() - lastNotificationCheck.current.getTime() < 5 * 60 * 1000) {
            return;
        }

        lastNotificationCheck.current = now;
        console.log('🔔 Verificando citas próximas...');

        try {
            for (const appt of allAppointments) {
                // Saltar citas completadas o canceladas
                if (appt.status === 'completed' || appt.status === 'cancelled') {
                    continue;
                }

                const [year, month, day] = appt.date.split('-').map(Number);
                const [hour, minute] = appt.time.split(':').map(Number);
                const apptDateTime = new Date(year, month - 1, day, hour, minute);

                // ✅ CORRECCIÓN: Solo notificar si está entre 25 y 30 minutos antes
                if (apptDateTime >= twentyFiveMinutesFromNow && apptDateTime <= thirtyMinutesFromNow) {
                    console.log(`⏰ Cita próxima detectada: ${appt.patientName} a las ${appt.time}`);
                    
                    // ✅ CORRECCIÓN: Verificar si ya existe esta notificación de recordatorio
                    const exists = await checkExistingNotification(userId, appt.id, 'upcoming_appointment');
                    
                    if (!exists) {
                        const notifId = await createNotification(
                            userId,
                            'upcoming_appointment',
                            `⏰ Recordatorio: Cita con ${appt.patientName} en 30 minutos (${appt.time})`,
                            {
                                appointmentId: appt.id,
                                patientId: appt.patientId,
                                priority: 'high'
                            }
                        );

                        // Solo agregar toast si se creó la notificación
                        if (notifId) {
                            console.log('✅ Notificación de recordatorio creada');
                            setToastNotifications(prev => [
                                {
                                    id: notifId,
                                    type: 'upcoming_appointment',
                                    message: `⏰ Recordatorio: Cita con ${appt.patientName} en 30 minutos`,
                                    read: false,
                                    saved: false,
                                    timestamp: Timestamp.now(),
                                    metadata: {
                                        appointmentId: appt.id,
                                        patientId: appt.patientId,
                                        priority: 'high'
                                    }
                                },
                                ...prev
                            ]);
                        }
                    } else {
                        console.log('⚠️ Recordatorio ya existe para esta cita');
                    }
                }
            }
        } catch (error) {
            console.error('❌ Error verificando citas próximas:', error);
        }
    }, [allAppointments]);

    // EFECTO PRINCIPAL DE AUTENTICACIÓN
    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                const data = await fetchUserData(currentUser.uid);
                if (data && data.role === 'doctora') { 
                    setUser(currentUser);
                    // Configurar notificaciones y citas después de autenticar
                    await setupUserNotifications(currentUser.uid);
                    setupAppointments(currentUser.uid);
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
    }, [router, setupUserNotifications, setupAppointments, cleanupSubscriptions]);

    // ✅ CORRECCIÓN: EFECTO ÚNICO PARA RECORDATORIOS (cada 5 minutos)
    useEffect(() => {
        if (!user || allAppointments.length === 0) return;

        // Verificar inmediatamente
        checkUpcomingAppointments(user.uid);

        // ✅ CORRECCIÓN: Intervalo de 5 minutos (más eficiente)
        const interval = setInterval(() => {
            checkUpcomingAppointments(user.uid);
        }, 5 * 60 * 1000);

        return () => clearInterval(interval);
    }, [user, allAppointments, checkUpcomingAppointments]);

    // EFECTO MEJORADO PARA TOAST NOTIFICATIONS
    useEffect(() => {
        if (toastNotifications.length > 0) {
            const timers: NodeJS.Timeout[] = [];
            
            toastNotifications.forEach((notification, index) => {
                const timer = setTimeout(() => {
                    setToastNotifications(prev => prev.filter(n => n.id !== notification.id));
                }, 5000 + (index * 200)); // Escalonar la desaparición
                
                timers.push(timer);
            });

            return () => {
                timers.forEach(timer => clearTimeout(timer));
            };
        }
    }, [toastNotifications]);

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

    const handleShowTodaysAppointments = () => { 
        setAppointmentViewMode('today'); 
        setView('appointments'); 
    };
    
    const handleShowAllAppointments = () => { 
        setAppointmentViewMode('all'); 
        setView('appointments'); 
    };
    
    // MANEJADORES DE NOTIFICACIONES MEJORADOS
    const handleMarkAsRead = async (id: string) => {
        if (!user) return;
        try {
            await updateDoc(doc(db, `users/${user.uid}/notifications`, id), { read: true });
        } catch (error) {
            console.error('❌ Error marcando notificación como leída:', error);
        }
    };

    const handleMarkAllAsRead = async () => {
        if (!user) return;
        try {
            const unreadNotifications = notifications.filter(n => !n.read);
            const updatePromises = unreadNotifications.map(notification =>
                updateDoc(doc(db, `users/${user.uid}/notifications`, notification.id), { 
                    read: true 
                })
            );
            await Promise.all(updatePromises);
        } catch (error) {
            console.error('❌ Error marcando todas como leídas:', error);
        }
    };

    const handleSaveNotification = async (id: string, saved: boolean) => {
        if (!user) return;
        try {
            await updateDoc(doc(db, `users/${user.uid}/notifications`, id), { saved });
        } catch (error) {
            console.error('❌ Error guardando notificación:', error);
        }
    };

    const handleDeleteNotification = async (id: string) => {
        if (!user) return;
        try {
            await deleteDoc(doc(db, `users/${user.uid}/notifications`, id));
        } catch (error) {
            console.error('❌ Error eliminando notificación:', error);
        }
    };

    const handleCloseToast = (id: string) => {
        setToastNotifications(prev => prev.filter(n => n.id !== id));
    };
    
    const renderMainContent = () => {
        switch (view) {
            case 'appointments':
                return (
                    <AppointmentsView 
                        allAppointments={allAppointments} 
                        onSelectAppointment={setSelectedAppointment} 
                        viewMode={appointmentViewMode} 
                        onShowAll={handleShowAllAppointments} 
                        onShowToday={handleShowTodaysAppointments} 
                    />
                );
            case 'patient-search':
                return <PatientSearchView doctorName={userData?.name || 'Doctora'} />;
            default:
                return (
                    <DashboardHomeContent 
                        userName={userData?.name || 'Doctora'} 
                        appointments={allAppointments} 
                        onSelectAppointment={setSelectedAppointment} 
                        onShowTodaysAppointments={handleShowTodaysAppointments} 
                    />
                );
        }
    };

    return (
        <div className="flex min-h-screen bg-slate-50 font-sans text-slate-800">
            <motion.aside className="fixed top-0 left-0 h-full w-72 bg-white/80 backdrop-blur-xl border-r border-slate-200/80 shadow-2xl z-40 p-6 flex flex-col justify-between" animate={{ x: isSidebarOpen ? 0 : -288 }}>
                <div>
                    <div className="flex flex-col items-center space-y-4 mb-12">
                        <button onClick={() => setView('dashboard')} className="cursor-pointer transition-transform duration-200 hover:scale-105">
                            <img src="/CRE logoo.svg" alt="Logo Clínica CRE" width={100} height={70} />
                        </button>
                    </div>
                    <nav className="space-y-3">
                        <button onClick={() => setView('dashboard')} className={`w-full flex items-center space-x-4 py-3 px-4 rounded-xl font-semibold transition-all duration-200 ${view === 'dashboard' ? 'bg-sky-100 text-sky-800 shadow-sm' : 'text-slate-600 hover:bg-slate-200'}`}>
                            <FiHome className="text-2xl" /><span>Inicio</span>
                        </button>
                        <button onClick={handleShowAllAppointments} className={`w-full flex items-center space-x-4 py-3 px-4 rounded-xl font-semibold transition-all duration-200 ${view === 'appointments' ? 'bg-sky-100 text-sky-800 shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}>
                            <FiCalendar className="text-2xl" /><span>Mis Citas</span>
                        </button>
                        <button onClick={() => setView('patient-search')} className={`w-full flex items-center space-x-4 py-3 px-4 rounded-xl font-semibold transition-all duration-200 ${view === 'patient-search' ? 'bg-sky-100 text-sky-800 shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}>
                            <FiFileText className="text-2xl" /><span>Expedientes</span>
                        </button>
                    </nav>
                </div>
                <div className="space-y-3">
                    <button onClick={() => setIsProfileModalOpen(true)} className="w-full flex items-center justify-center space-x-3 py-3 px-4 rounded-xl bg-slate-200 text-slate-800 font-semibold hover:bg-slate-300 transition-colors">
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
                    <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="p-2 -ml-2 text-slate-600">
                        <FiMenu size={24} />
                    </button>
                    <div className="flex items-center space-x-6">
                        <div className="relative hidden md:block">
                            {/* Buscador opcional */}
                        </div>
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
                        <div onClick={() => setIsProfileModalOpen(true)} className="flex items-center space-x-3 cursor-pointer">
                            <Image src={userData?.avatarUrl || "/Doctor.jpg"} alt="Avatar" width={40} height={40} className="w-10 h-10 rounded-full object-cover" />
                            <div className="hidden md:block">
                                <p className="font-semibold text-sm text-slate-800">{userData?.name || 'Doctora'}</p>
                                <p className="text-xs text-slate-500">Doctora</p>
                            </div>
                        </div>
                    </div>
                </header>
                <main className="flex-grow p-6 md:p-10">
                    <AnimatePresence mode="wait">
                        <motion.div key={view} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                            {renderMainContent()}
                        </motion.div>
                    </AnimatePresence>
                </main>
            </div>
            
            <ToastNotifications notifications={toastNotifications} onClose={handleCloseToast} />
            
            {/* CAPA DE ANIMACIÓN DE CIERRE DE SESIÓN */}
            <AnimatePresence>
                {isLogoutAnimating && (
                    <LogoutAnimationOverlay onAnimationComplete={completeLogout} />
                )}
            </AnimatePresence>

            <AnimatePresence>
                {selectedAppointment && (
                    <AppointmentDetailsModal 
                        appointment={selectedAppointment}
                        doctorName={userData?.name || 'Doctora'}
                        onClose={() => setSelectedAppointment(null)}
                    />
                )}
                {isProfileModalOpen && user && (
                    <ProfileSettingsModal 
                        user={user} 
                        onClose={() => setIsProfileModalOpen(false)} 
                        onProfileUpdate={() => user && fetchUserData(user.uid)}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
