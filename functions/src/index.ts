// Importa los módulos necesarios de Firebase
import * as admin from "firebase-admin";
// En la V2, importamos las funciones de Firestore directamente
import { onDocumentUpdated } from "firebase-functions/v2/firestore";
// Se mantiene functions para el logger, pero ya no se usa para el trigger
import * as functions from "firebase-functions";

// Inicializa la app de admin para poder interactuar con Firestore
admin.initializeApp();
const db = admin.firestore();

// 1. Define una interfaz para tipar los datos del documento (SOLUCIÓN al error 'any')
interface AppointmentData {
  status: 'pending' | 'completed' | 'cancelled';
  patientId: string;
  type: 'consultation' | 'therapy';
  date: string; // Asumiendo que 'date' es un string ISO
}

/**
 * Se dispara cada vez que un documento en la colección 'appointments' es ACTUALIZADO.
 * Actualiza el contador de terapias del paciente correspondiente.
 */
export const updateTherapyCounter = onDocumentUpdated("appointments/{appointmentId}", async (event) => {
    // 2. Comprobación y tipado de los datos (SOLUCIÓN al error 'any')
    const snapshotBefore = event.data?.before;
    const snapshotAfter = event.data?.after;

    if (!snapshotBefore || !snapshotAfter) {
        functions.logger.error("Datos faltantes en el evento onDocumentUpdated.");
        return; // Usa 'return' sin valor en v2
    }

    const beforeData = snapshotBefore.data() as AppointmentData;
    const afterData = snapshotAfter.data() as AppointmentData;

    // --- LÓGICA PRINCIPAL ---
    // Solo nos interesa si el estado cambió A 'completed' Y no estaba 'completed' antes
    const hasCompleted = afterData.status === "completed";
    const wasCompleted = beforeData.status === "completed";

    // Si ya estaba completado O no cambió a completado, ignorar
    if (wasCompleted || !hasCompleted) {
      functions.logger.log("No es la primera finalización de la cita, no se hace nada.");
      return;
    }

    const patientId = afterData.patientId;
    const type = afterData.type;

    if (!patientId || !type) {
      functions.logger.error("La cita no tiene patientId o type.", afterData);
      return;
    }

    // Obtiene la referencia al documento del paciente
    const patientRef = db.collection("patients").doc(patientId);

    try {
      if (type === "consultation") {
        // Si fue una consulta de doctor, REINICIA el contador a 0
        functions.logger.log(`Reiniciando contador para paciente: ${patientId}`);
        await patientRef.update({
          therapiesSinceConsult: 0,
          lastConsultationDate: afterData.date,
        });
      } else if (type === "therapy") {
        // Si fue una terapia, INCREMENTA el contador en 1
        functions.logger.log(`Incrementando contador para paciente: ${patientId}`);
        await patientRef.update({
          therapiesSinceConsult: admin.firestore.FieldValue.increment(1),
        });
      }
    } catch (error) {
      functions.logger.error(
        `Error al actualizar el contador para el paciente ${patientId}:`,
        error
      );
    }
    
    // Las Cloud Functions v2 no necesitan devolver un valor (como 'return null;')
  });