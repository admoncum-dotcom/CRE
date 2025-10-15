'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { FiArrowLeft, FiUserPlus } from 'react-icons/fi';
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface CreatePatientFormProps {
  onCreatePatient: (patientData: any) => Promise<void>;
  onBack: () => void;
  onPatientExists: (patient: any) => void;
}

// Lista de municipios de Honduras para el campo de búsqueda de ciudad
const honduranCities = [ "Tegucigalpa", "Comayagüela", "San Pedro Sula", "Choloma", "La Ceiba", "El Progreso", "Choluteca", "Danlí", "Siguatepeque", "Juticalpa", "Catacamas", "Tocoa", "Villanueva", "Tela", "Puerto Cortés", "La Lima", "Santa Rosa de Copán", "Cofradía", "Olanchito", "Yoro", "Nacaome", "Santa Bárbara", "La Paz", "Gracias", "La Esperanza", "Roatán", "Nueva Ocotepeque", "Trujillo", "Puerto Lempira", "Yuscarán" ];

// --- Componente Combobox para Ciudades ---
const CityCombobox = ({ value, onChange }: { value: string; onChange: (value: string) => void; }) => {
  const [inputValue, setInputValue] = useState(value);
  const [filteredCities, setFilteredCities] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const comboboxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (comboboxRef.current && !comboboxRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setInputValue(text);
    if (text) {
      setFilteredCities(honduranCities.filter(city => city.toLowerCase().includes(text.toLowerCase())));
      setIsOpen(true);
    } else {
      setFilteredCities([]);
      setIsOpen(false);
    }
    onChange(text);
  };

  const handleSelectCity = (city: string) => {
    setInputValue(city);
    onChange(city);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={comboboxRef}>
      <input 
        type="text" 
        id="city" 
        name="city" 
        value={inputValue} 
        onChange={handleInputChange} 
        onFocus={() => setIsOpen(true)} 
        placeholder="Escribe para buscar..." 
        className="mt-1 block w-full px-4 py-3 rounded-lg bg-slate-50 border-2 border-slate-200 focus:border-sky-500 focus:ring-sky-500 transition-shadow"
      />
      {isOpen && filteredCities.length > 0 && (
        <motion.ul 
          initial={{ opacity: 0, y: -10 }} 
          animate={{ opacity: 1, y: 0 }} 
          className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto"
        >
          {filteredCities.map(city => (
            <li 
              key={city} 
              onClick={() => handleSelectCity(city)} 
              className="px-4 py-2 hover:bg-sky-100 cursor-pointer"
            >
              {city}
            </li>
          ))}
        </motion.ul>
      )}
    </div>
  );
};

const CreatePatientForm: React.FC<CreatePatientFormProps> = ({ onCreatePatient, onBack, onPatientExists }) => {
  const [formData, setFormData] = useState({
    name: '',
    contact: '',
    idNumber: '',
    dob: '',
    address: '',
    gender: '',
    city: '',
    insuranceProvider: '',
    referralSource: '',
    email: '' // Campo agregado para consistencia
  });
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
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
    } else if (name === 'idNumber') {
      const numericValue = value.replace(/[^\d]/g, '');
      const truncatedValue = numericValue.slice(0, 13);
      if (truncatedValue.length > 8) {
        formattedValue = `${truncatedValue.slice(0, 4)}-${truncatedValue.slice(4, 8)}-${truncatedValue.slice(8)}`;
      } else if (truncatedValue.length > 4) {
        formattedValue = `${truncatedValue.slice(0, 4)}-${truncatedValue.slice(4)}`;
      } else {
        formattedValue = truncatedValue;
      }
    }

    setFormData(prev => ({ ...prev, [name]: formattedValue }));
  };

  const handleCityChange = (city: string) => {
    setFormData(prev => ({ ...prev, city }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validación de campos obligatorios
    if (!formData.name || !formData.contact || !formData.dob || !formData.idNumber || !formData.address || !formData.gender) {
      setMessage('Por favor, complete todos los campos obligatorios.');
      return;
    }

    // Validación de formato de identidad
    const cleanIdNumber = formData.idNumber.replace(/[^\d]/g, '');
    if (cleanIdNumber.length !== 13) {
      setMessage('El número de identidad debe tener 13 dígitos.');
      return;
    }

    // Validación de formato de teléfono
    const cleanContact = formData.contact.replace(/[^\d]/g, '');
    if (cleanContact.length !== 8) {
      setMessage('El número de teléfono debe tener 8 dígitos.');
      return;
    }

    setIsLoading(true);
    setMessage('');

    try {
      console.log('🔍 Verificando si el paciente existe...', formData.idNumber);
      
      // Verificar si el paciente ya existe
      const patientsRef = collection(db, 'patients');
      const q = query(patientsRef, where("idNumber", "==", formData.idNumber));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        console.log('⚠️ Paciente ya existe:', querySnapshot.docs[0].data());
        setMessage('Este paciente ya existe. Redirigiendo para agendar cita...');
        const existingPatient = { 
          id: querySnapshot.docs[0].id, 
          ...querySnapshot.docs[0].data() 
        };
        setTimeout(() => onPatientExists(existingPatient), 2000);
        return;
      }

      console.log('📝 Creando nuevo paciente...', formData);
      
      // Preparar datos para Firebase
      const patientData = {
        name: formData.name.trim(),
        contact: formData.contact,
        idNumber: formData.idNumber,
        dob: formData.dob,
        address: formData.address.trim(),
        gender: formData.gender,
        city: formData.city.trim(),
        insuranceProvider: formData.insuranceProvider || 'Ninguno',
        referralSource: formData.referralSource || 'No especificado',
        email: formData.email || '', // Campo opcional
        createdAt: new Date(), // Timestamp de creación
        updatedAt: new Date()  // Timestamp de actualización
      };

      console.log('🚀 Enviando datos a Firebase:', patientData);

      // Llamar a la función proporcionada para crear el paciente
      await onCreatePatient(patientData);

      console.log('✅ Paciente creado exitosamente');

    } catch (error) {
      console.error("❌ Error creando o verificando paciente:", error);
      setMessage('Ocurrió un error al procesar la solicitud. Por favor, intente nuevamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }} 
      transition={{ duration: 0.5 }}
    >
      <div className="flex items-center space-x-4 mb-6">
        <button 
          onClick={onBack} 
          className="p-2 rounded-full hover:bg-slate-200 transition-colors" 
          aria-label="Volver a la vista de pacientes"
        >
          <FiArrowLeft size={24} />
        </button>
        <h2 className="text-3xl font-bold text-slate-900">Crear Nuevo Paciente</h2>
      </div>

      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-2xl shadow-lg space-y-8 max-w-4xl mx-auto">
        <fieldset className="p-4 border border-slate-200 rounded-lg">
          <legend className="px-2 font-semibold text-lg text-slate-800">Información Personal</legend>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1">
                Nombre Completo <span className="text-red-500">*</span>
              </label>
              <input 
                type="text" 
                id="name" 
                name="name" 
                value={formData.name} 
                onChange={handleChange} 
                required 
                placeholder="Ej: Juan Pérez" 
                className="mt-1 block w-full px-4 py-3 rounded-lg bg-slate-50 border-2 border-slate-200 focus:border-sky-500 focus:ring-sky-500 transition-shadow"
              />
            </div>
            <div>
              <label htmlFor="contact" className="block text-sm font-medium text-slate-700 mb-1">
                Teléfono <span className="text-red-500">*</span>
              </label>
              <input 
                type="text" 
                id="contact" 
                name="contact" 
                value={formData.contact} 
                onChange={handleChange} 
                required 
                placeholder="Ej: 8888-8888" 
                maxLength={9} 
                className="mt-1 block w-full px-4 py-3 rounded-lg bg-slate-50 border-2 border-slate-200 focus:border-sky-500 focus:ring-sky-500 transition-shadow"
              />
            </div>
            <div>
              <label htmlFor="dob" className="block text-sm font-medium text-slate-700 mb-1">
                Fecha de Nacimiento <span className="text-red-500">*</span>
              </label>
              <input 
                type="date" 
                id="dob" 
                name="dob" 
                value={formData.dob} 
                onChange={handleChange} 
                required 
                className="mt-1 block w-full px-4 py-3 rounded-lg bg-slate-50 border-2 border-slate-200 focus:border-sky-500 focus:ring-sky-500 transition-shadow"
              />
            </div>
            <div>
              <label htmlFor="gender" className="block text-sm font-medium text-slate-700 mb-1">
                Género <span className="text-red-500">*</span>
              </label>
              <select 
                id="gender" 
                name="gender" 
                value={formData.gender} 
                onChange={handleChange} 
                required 
                className="mt-1 block w-full px-4 py-3 rounded-lg bg-slate-50 border-2 border-slate-200 focus:border-sky-500 focus:ring-sky-500 transition-shadow"
              >
                <option value="" disabled>-- Seleccione --</option>
                <option value="masculino">Masculino</option>
                <option value="femenino">Femenino</option>
              </select>
            </div>
            <div>
              <label htmlFor="idNumber" className="block text-sm font-medium text-slate-700 mb-1">
                Número de Identidad <span className="text-red-500">*</span>
              </label>
              <input 
                type="text" 
                id="idNumber" 
                name="idNumber" 
                value={formData.idNumber} 
                onChange={handleChange} 
                required 
                placeholder="Ej: 0123-4567-89012" 
                maxLength={15} 
                className="mt-1 block w-full px-4 py-3 rounded-lg bg-slate-50 border-2 border-slate-200 focus:border-sky-500 focus:ring-sky-500 transition-shadow"
              />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="address" className="block text-sm font-medium text-slate-700 mb-1">
                Dirección <span className="text-red-500">*</span>
              </label>
              <input 
                type="text" 
                id="address" 
                name="address" 
                value={formData.address} 
                onChange={handleChange} 
                required 
                placeholder="Ej: Av. Principal, Casa #123" 
                className="mt-1 block w-full px-4 py-3 rounded-lg bg-slate-50 border-2 border-slate-200 focus:border-sky-500 focus:ring-sky-500 transition-shadow"
              />
            </div>
            <div>
              <label htmlFor="city" className="block text-sm font-medium text-slate-700 mb-1">
                Ciudad de Procedencia
              </label>
              <CityCombobox value={formData.city} onChange={handleCityChange} />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
                Email (Opcional)
              </label>
              <input 
                type="email" 
                id="email" 
                name="email" 
                value={formData.email} 
                onChange={handleChange} 
                placeholder="Ej: juan@email.com" 
                className="mt-1 block w-full px-4 py-3 rounded-lg bg-slate-50 border-2 border-slate-200 focus:border-sky-500 focus:ring-sky-500 transition-shadow"
              />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="insuranceProvider" className="block text-sm font-medium text-slate-700 mb-1">
                Seguro Médico
              </label>
              <select 
                id="insuranceProvider" 
                name="insuranceProvider" 
                value={formData.insuranceProvider} 
                onChange={handleChange} 
                className="mt-1 block w-full px-4 py-3 rounded-lg bg-slate-50 border-2 border-slate-200 focus:border-sky-500 focus:ring-sky-500 transition-shadow"
              >
                <option value="">Ninguno</option>
                <option value="Ficohsa">Ficohsa</option>
                <option value="Mapfre">Mapfre</option>
                <option value="Palig">Palig</option>
                <option value="Best-Doctor">Best Doctor</option>
                <option value="Bupa">Bupa</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label htmlFor="referralSource" className="block text-sm font-medium text-slate-700 mb-1">
                ¿Cómo nos conoció?
              </label>
              <select 
                id="referralSource" 
                name="referralSource" 
                value={formData.referralSource} 
                onChange={handleChange} 
                className="mt-1 block w-full px-4 py-3 rounded-lg bg-slate-50 border-2 border-slate-200 focus:border-sky-500 focus:ring-sky-500 transition-shadow"
              >
                <option value="" disabled>-- Seleccione una opción --</option>
                <option value="Redes Sociales">Redes Sociales</option>
                <option value="Recomendación de Doctor">Recomendación de Doctor</option>
                <option value="Amigos / Familiares">Amigos / Familiares</option>
                <option value="Otro">Otro</option>
              </select>
            </div>
          </div>
        </fieldset>

        <button 
          type="submit" 
          disabled={isLoading} 
          className="w-full flex items-center justify-center space-x-2 py-3 px-6 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-lg shadow-md transition-colors disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <motion.div 
                className="w-5 h-5 border-2 border-white border-t-transparent rounded-full" 
                animate={{ rotate: 360 }} 
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }} 
              />
              <span>Guardando...</span>
            </>
          ) : (
            <>
              <span>Siguiente: Agendar Cita</span>
              <FiUserPlus />
            </>
          )}
        </button>

        {message && (
          <div className={`mt-4 p-4 rounded-lg text-center ${
            message.includes('existe') ? 'bg-yellow-100 text-yellow-800' : 
            message.includes('éxito') ? 'bg-green-100 text-green-800' : 
            'bg-red-100 text-red-800'
          }`}>
            {message}
          </div>
        )}
      </form>
    </motion.div>
  );
};

export default CreatePatientForm;