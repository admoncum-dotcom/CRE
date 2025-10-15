'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiBell, FiClock, FiX, FiCheck, FiSave, FiInbox, FiTrash2, FiAlertCircle, FiInfo, FiMessageCircle } from 'react-icons/fi';
import { Timestamp } from 'firebase/firestore';

// --- Interfaces Mejoradas para Notificaciones ---
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

// --- Constantes y Helpers ---
const NOTIFICATION_CONFIG = {
  expiryDays: 7,
  autoCloseDelay: 5000,
  maxToastDisplay: 3,
} as const;

// ✅ CORRECCIÓN: Función mejorada que siempre retorna un componente válido
const getNotificationIcon = (type: Notification['type']) => {
  const icons = {
    new_appointment: FiBell,
    upcoming_appointment: FiClock,
    appointment_cancelled: FiAlertCircle,
    admin_message: FiInfo,
    system_alert: FiAlertCircle,
    patient_message: FiMessageCircle,
  };
  
  // ✅ Asegurar que siempre retorne un componente válido
  return icons[type] || FiBell; // Fallback a FiBell si el tipo no existe
};

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

// --- Componente de Item de Notificación Individual ---
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
  // ✅ CORRECCIÓN: Asegurar que IconComponent siempre tenga un valor válido
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
          {/* ✅ CORRECCIÓN: Verificación adicional para seguridad */}
          {IconComponent ? <IconComponent className="h-5 w-5" /> : <FiBell className="h-5 w-5" />}
        </div>
        <div className="flex-grow min-w-0">
          <p className="text-sm font-medium text-slate-900 truncate">
            {notification.type === 'new_appointment' && 'Nueva Cita'}
            {notification.type === 'upcoming_appointment' && 'Recordatorio'}
            {notification.type === 'appointment_cancelled' && 'Cita Cancelada'}
            {notification.type === 'admin_message' && 'Mensaje Importante'}
            {notification.type === 'system_alert' && 'Alerta del Sistema'}
            {notification.type === 'patient_message' && 'Mensaje del Paciente'}
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
          >
            <FiX className="h-4 w-4 text-slate-400" />
          </button>
        )}
      </motion.div>
    );
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
      className={`p-4 flex items-start gap-3 border-b border-slate-100 bg-white hover:bg-slate-50 transition-colors ${
        notification.metadata?.priority === 'high' ? 'border-l-4 border-l-red-400' : ''
      }`}
    >
      <div className={`mt-1 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${colors.bg} ${colors.text}`}>
        {/* ✅ CORRECCIÓN: Verificación adicional para seguridad */}
        {IconComponent ? <IconComponent className="h-4 w-4" /> : <FiBell className="h-4 w-4" />}
      </div>
      <div className="flex-grow min-w-0">
        <p className="text-sm text-slate-700 line-clamp-2">{notification.message}</p>
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-slate-500">
            {formatTimestamp(notification.timestamp)}
          </span>
          <div className="flex items-center space-x-3 text-xs">
            {!notification.read && (
              <button
                onClick={() => handleAction('read')}
                className="hover:text-emerald-600 flex items-center transition-colors"
              >
                <FiCheck className="mr-1" /> Leída
              </button>
            )}
            <button
              onClick={() => handleAction('save')}
              className={`flex items-center transition-colors ${
                notification.saved ? 'text-amber-600' : 'hover:text-sky-600'
              }`}
            >
              <FiSave className="mr-1" />
              {notification.saved ? 'Guardada' : 'Guardar'}
            </button>
            <button
              onClick={() => handleAction('delete')}
              className="hover:text-red-600 flex items-center transition-colors"
            >
              <FiTrash2 className="mr-1" /> Eliminar
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// --- Componente del Panel de Notificaciones Mejorado ---
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

  const filteredNotifications = useMemo(() => {
    const now = new Date();
    const expiryDate = new Date(now.setDate(now.getDate() - NOTIFICATION_CONFIG.expiryDays));

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
      {/* Header */}
      <div className="p-4 border-b border-slate-200 flex justify-between items-center">
        <h4 className="font-bold text-slate-800 text-lg">Notificaciones</h4>
        <div className="flex items-center space-x-2">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="text-sm text-sky-600 hover:text-sky-700 font-medium px-3 py-1 rounded-lg hover:bg-sky-50 transition-colors"
            >
              Marcar todas como leídas
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <FiX className="h-5 w-5 text-slate-400" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 px-4">
        <nav className="flex space-x-6">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.key
                  ? 'border-sky-500 text-sky-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <span className="flex items-center space-x-2">
                <span>{tab.label}</span>
                {tab.count > 0 && (
                  <span className={`px-1.5 py-0.5 text-xs rounded-full ${
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

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500"></div>
            <p className="mt-3 text-sm text-slate-500">Cargando notificaciones...</p>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="text-center py-12 px-4">
            <FiInbox className="mx-auto text-4xl text-slate-300 mb-3" />
            <p className="text-sm text-slate-500">
              {activeTab === 'unread' && 'No tienes notificaciones no leídas.'}
              {activeTab === 'saved' && 'No tienes notificaciones guardadas.'}
              {activeTab === 'all' && 'No tienes notificaciones recientes.'}
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

// --- Componente Mejorado para Notificaciones Flotantes (Toasts) ---
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
  const visibleNotifications = useMemo(() => 
    notifications.slice(0, NOTIFICATION_CONFIG.maxToastDisplay),
    [notifications]
  );

  return (
    <div className="fixed top-5 right-5 z-[100] space-y-3">
      <AnimatePresence>
        {visibleNotifications.map((notification, index) => (
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
  );
};

export default NotificationPanel;