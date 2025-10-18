'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiBell, FiClock, FiX, FiCheck, FiSave, FiInbox, FiTrash2, FiAlertCircle, FiInfo, FiMessageCircle } from 'react-icons/fi';
import { Timestamp } from 'firebase/firestore';

// =====================================================
// INTERFACES Y TIPOS
// =====================================================

export interface NotificationMetadata {
  appointmentId?: string;
  patientId?: string;
  priority?: 'low' | 'medium' | 'high';
  actionUrl?: string;
  expiryDate?: Timestamp;
}

export interface Notification {
  id: string;
  type: 'new_appointment' | 'upcoming_appointment' | 'appointment_cancelled' | 'admin_message' | 'system_alert' | 'patient_message';
  message: string;
  read: boolean;
  saved: boolean;
  timestamp: Timestamp;
  metadata?: NotificationMetadata;
}

// =====================================================
// CONSTANTES Y CONFIGURACIÓN
// =====================================================

const NOTIFICATION_CONFIG = {
  expiryDays: 7,
  autoCloseDelay: 5000,
  maxToastDisplay: 3,
} as const;

// =====================================================
// FUNCIONES HELPER
// =====================================================

/**
 * Obtiene el icono correspondiente al tipo de notificación
 * @param type - Tipo de notificación
 * @returns Componente de icono de react-icons
 */
const getNotificationIcon = (type: Notification['type']) => {
  const icons = {
    new_appointment: FiBell,
    upcoming_appointment: FiClock,
    appointment_cancelled: FiAlertCircle,
    admin_message: FiInfo,
    system_alert: FiAlertCircle,
    patient_message: FiMessageCircle,
  };
  
  return icons[type] || FiBell;
};

/**
 * Obtiene los colores de estilo para cada tipo de notificación
 * @param type - Tipo de notificación
 * @param priority - Prioridad de la notificación
 * @returns Objeto con clases de Tailwind para bg, text y border
 */
const getNotificationColor = (type: Notification['type'], priority?: string) => {
  if (priority === 'high') {
    return { bg: 'bg-red-100', text: 'text-red-600', border: 'border-red-200' };
  }
  
  const colors = {
    new_appointment: { bg: 'bg-sky-100', text: 'text-sky-600', border: 'border-sky-200' },
    upcoming_appointment: { bg: 'bg-amber-100', text: 'text-amber-600', border: 'border-amber-200' },
    appointment_cancelled: { bg: 'bg-red-100', text: 'text-red-600', border: 'border-red-200' },
    admin_message: { bg: 'bg-emerald-100', text: 'text-emerald-600', border: 'border-emerald-200' },
    system_alert: { bg: 'bg-orange-100', text: 'text-orange-600', border: 'border-orange-200' },
    patient_message: { bg: 'bg-purple-100', text: 'text-purple-600', border: 'border-purple-200' },
  };
  
  return colors[type] || { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200' };
};

/**
 * Formatea el timestamp de la notificación en texto relativo
 * @param timestamp - Timestamp de Firestore
 * @returns String formateado (ej: "Hace 5 min", "Ayer")
 */
const formatTimestamp = (timestamp: Timestamp): string => {
  const date = timestamp.toDate();
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Ahora mismo';
  if (diffMins < 60) return `Hace ${diffMins} min`;
  if (diffHours < 24) return `Hace ${diffHours} h`;
  if (diffDays === 1) return 'Ayer';
  if (diffDays < 7) return `Hace ${diffDays} días`;
  
  return date.toLocaleDateString('es-ES', { 
    day: 'numeric', 
    month: 'short',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  });
};

/**
 * Obtiene el título descriptivo según el tipo de notificación
 * @param type - Tipo de notificación
 * @returns Título descriptivo
 */
const getNotificationTitle = (type: Notification['type']): string => {
  const titles = {
    new_appointment: 'Nueva Cita',
    upcoming_appointment: 'Recordatorio',
    appointment_cancelled: 'Cita Cancelada',
    admin_message: 'Mensaje Importante',
    system_alert: 'Alerta del Sistema',
    patient_message: 'Mensaje del Paciente',
  };
  
  return titles[type] || 'Notificación';
};

// =====================================================
// COMPONENTE: NOTIFICATION ITEM
// =====================================================

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead: (id: string) => void;
  onSave: (id: string, saved: boolean) => void;
  onDelete: (id: string) => void;
  variant?: 'panel' | 'toast';
  onClose?: (id: string) => void;
}

const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onMarkAsRead,
  onSave,
  onDelete,
  variant = 'panel',
  onClose
}) => {
  const IconComponent = getNotificationIcon(notification.type);
  const colors = getNotificationColor(notification.type, notification.metadata?.priority);
  
  const handleAction = useCallback((action: 'read' | 'save' | 'delete') => {
    switch (action) {
      case 'read':
        onMarkAsRead(notification.id);
        break;
      case 'save':
        onSave(notification.id, !notification.saved);
        break;
      case 'delete':
        onDelete(notification.id);
        break;
    }
  }, [notification.id, notification.saved, onMarkAsRead, onSave, onDelete]);

  // VARIANTE TOAST (Notificaciones flotantes)
  if (variant === 'toast') {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, x: 300, scale: 0.8 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        exit={{ opacity: 0, x: 300, scale: 0.8, transition: { duration: 0.2 } }}
        className={`p-4 max-w-sm bg-white rounded-2xl shadow-2xl flex items-start space-x-3 border-l-4 ${colors.border} relative`}
      >
        <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${colors.bg} ${colors.text}`}>
          <IconComponent className="h-5 w-5" />
        </div>
        <div className="flex-grow min-w-0">
          <p className="text-sm font-medium text-slate-900 truncate">
            {getNotificationTitle(notification.type)}
          </p>
          <p className="text-slate-600 text-sm mt-1 line-clamp-2">{notification.message}</p>
          <p className="text-xs text-slate-400 mt-2">
            {formatTimestamp(notification.timestamp)}
          </p>
        </div>
        {onClose && (
          <button
            onClick={() => onClose(notification.id)}
            className="ml-2 p-1 rounded-full hover:bg-slate-100 flex-shrink-0 transition-colors"
            aria-label="Cerrar notificación"
          >
            <FiX className="h-4 w-4 text-slate-400" />
          </button>
        )}
      </motion.div>
    );
  }

  // VARIANTE PANEL (Lista de notificaciones)
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
      className={`p-4 flex items-start gap-3 border-b border-slate-100 bg-white hover:bg-slate-50 transition-colors ${
        notification.metadata?.priority === 'high' ? 'border-l-4 border-l-red-400' : ''
      } ${!notification.read ? 'bg-sky-50/30' : ''}`}
    >
      <div className={`mt-1 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${colors.bg} ${colors.text}`}>
        <IconComponent className="h-4 w-4" />
      </div>
      
      <div className="flex-grow min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-sm ${!notification.read ? 'font-semibold text-slate-900' : 'text-slate-700'} line-clamp-2`}>
            {notification.message}
          </p>
          {!notification.read && (
            <span className="flex-shrink-0 w-2 h-2 bg-sky-500 rounded-full mt-1"></span>
          )}
        </div>
        
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-slate-500">
            {formatTimestamp(notification.timestamp)}
          </span>
          
          <div className="flex items-center space-x-3 text-xs">
            {!notification.read && (
              <button
                onClick={() => handleAction('read')}
                className="hover:text-emerald-600 flex items-center transition-colors"
                aria-label="Marcar como leída"
              >
                <FiCheck className="mr-1" /> Leída
              </button>
            )}
            <button
              onClick={() => handleAction('save')}
              className={`flex items-center transition-colors ${
                notification.saved ? 'text-amber-600' : 'hover:text-sky-600'
              }`}
              aria-label={notification.saved ? 'Quitar de guardadas' : 'Guardar'}
            >
              <FiSave className="mr-1" />
              {notification.saved ? 'Guardada' : 'Guardar'}
            </button>
            <button
              onClick={() => handleAction('delete')}
              className="hover:text-red-600 flex items-center transition-colors"
              aria-label="Eliminar"
            >
              <FiTrash2 className="mr-1" /> Eliminar
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// =====================================================
// COMPONENTE: NOTIFICATION PANEL
// =====================================================

interface NotificationPanelProps {
  notifications: Notification[];
  isLoading?: boolean;
  onMarkAllAsRead: () => void;
  onMarkAsRead: (id: string) => void;
  onSave: (id: string, saved: boolean) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

const NotificationPanel: React.FC<NotificationPanelProps> = ({
  notifications,
  isLoading = false,
  onMarkAllAsRead,
  onMarkAsRead,
  onSave,
  onDelete,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'saved'>('all');

  // Filtrar notificaciones según el tab activo y fecha de expiración
  const filteredNotifications = useMemo(() => {
    const now = new Date();
    const expiryDate = new Date(now.getTime() - (NOTIFICATION_CONFIG.expiryDays * 24 * 60 * 60 * 1000));

    return notifications
      .filter(notif => notif.timestamp.toDate() > expiryDate)
      .filter(notif => {
        switch (activeTab) {
          case 'unread':
            return !notif.read;
          case 'saved':
            return notif.saved;
          default:
            return true;
        }
      })
      .sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis());
  }, [notifications, activeTab]);

  // Contadores para los badges
  const unreadCount = useMemo(() => 
    notifications.filter(n => !n.read).length,
    [notifications]
  );

  const savedCount = useMemo(() => 
    notifications.filter(n => n.saved).length,
    [notifications]
  );

  const handleMarkAllAsRead = useCallback(() => {
    if (unreadCount > 0) {
      onMarkAllAsRead();
    }
  }, [unreadCount, onMarkAllAsRead]);

  // Configuración de tabs
  const tabs = [
    { key: 'all' as const, label: 'Todas', count: filteredNotifications.length },
    { key: 'unread' as const, label: 'No leídas', count: unreadCount },
    { key: 'saved' as const, label: 'Guardadas', count: savedCount },
  ];

  return (
    <motion.div 
      className="absolute top-full right-0 mt-2 w-96 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 overflow-hidden flex flex-col max-h-[80vh]"
      initial={{ opacity: 0, y: -10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
    >
      {/* HEADER */}
      <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-gradient-to-r from-slate-50 to-white">
        <h4 className="font-bold text-slate-800 text-lg flex items-center space-x-2">
          <FiBell className="text-sky-600" />
          <span>Notificaciones</span>
        </h4>
        <div className="flex items-center space-x-2">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="text-sm text-sky-600 hover:text-sky-700 font-medium px-3 py-1 rounded-lg hover:bg-sky-50 transition-colors"
              aria-label="Marcar todas como leídas"
            >
              Marcar todas
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-100 transition-colors"
            aria-label="Cerrar panel"
          >
            <FiX className="h-5 w-5 text-slate-400" />
          </button>
        </div>
      </div>

      {/* TABS */}
      <div className="border-b border-slate-200 px-4 bg-white">
        <nav className="flex space-x-6" role="tablist">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              role="tab"
              aria-selected={activeTab === tab.key}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.key
                  ? 'border-sky-500 text-sky-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <span className="flex items-center space-x-2">
                <span>{tab.label}</span>
                {tab.count > 0 && (
                  <span className={`px-1.5 py-0.5 text-xs rounded-full font-semibold ${
                    activeTab === tab.key
                      ? 'bg-sky-100 text-sky-600'
                      : 'bg-slate-100 text-slate-600'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </span>
            </button>
          ))}
        </nav>
      </div>

      {/* CONTENT */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500"></div>
            <p className="mt-3 text-sm text-slate-500">Cargando notificaciones...</p>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="text-center py-12 px-4">
            <FiInbox className="mx-auto text-4xl text-slate-300 mb-3" />
            <p className="text-sm text-slate-500 font-medium">
              {activeTab === 'unread' && 'No tienes notificaciones no leídas'}
              {activeTab === 'saved' && 'No tienes notificaciones guardadas'}
              {activeTab === 'all' && 'No tienes notificaciones recientes'}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {activeTab === 'all' && 'Las notificaciones aparecerán aquí'}
            </p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {filteredNotifications.map(notification => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onMarkAsRead={onMarkAsRead}
                onSave={onSave}
                onDelete={onDelete}
                variant="panel"
              />
            ))}
          </AnimatePresence>
        )}
      </div>
    </motion.div>
  );
};

// =====================================================
// COMPONENTE: TOAST NOTIFICATIONS
// =====================================================

interface ToastNotificationsProps {
  notifications: Notification[];
  onClose: (id: string) => void;
  autoClose?: boolean;
}

export const ToastNotifications: React.FC<ToastNotificationsProps> = ({
  notifications,
  onClose,
  autoClose = true
}) => {
  // Limitar a máximo 3 notificaciones visibles
  const visibleNotifications = useMemo(() => 
    notifications.slice(0, NOTIFICATION_CONFIG.maxToastDisplay),
    [notifications]
  );

  return (
    <div className="fixed top-5 right-5 z-[100] space-y-3 pointer-events-none">
      <div className="pointer-events-auto">
        <AnimatePresence>
          {visibleNotifications.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onMarkAsRead={() => {}} // No-op en toasts
              onSave={() => {}} // No-op en toasts
              onDelete={() => {}} // No-op en toasts
              variant="toast"
              onClose={onClose}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default NotificationPanel;
