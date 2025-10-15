'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from '@/lib/firebase';
import Image from 'next/image';
import Lottie from "lottie-react";

// Animación para el estado de carga
import loadingAnimationData from '../../public/hospital.json'; 

import { 
  FiEye,
  FiEyeOff,
  FiUser,
  FiLock,
} from 'react-icons/fi';

// --- Componente de Animación de Carga ---
const LoadingAnimation = () => (
  <div className="flex flex-col items-center justify-center">
    <Lottie animationData={loadingAnimationData} loop={true} style={{ width: 180, height: 180 }} />
    <p className="text-slate-500 mt-4 text-lg animate-pulse">Verificando credenciales...</p>
  </div>
);

// --- Componente Principal de la Página de Login ---
export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    // Simula una pequeña demora para apreciar la animación
    await new Promise(resolve => setTimeout(resolve, 1500));

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      const userDocRef = doc(db, "users", user.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();

        
        // Se verifica si el usuario tiene el estado 'inactive'
        if (userData.status === 'inactive') {
          setError('Su usuario ha sido bloqueado y sus credenciales ya no son permitidas en el sistema.');
          auth.signOut(); // Se cierra la sesión inmediatamente
          setIsLoading(false);
          return; // Se detiene la ejecución de la función aquí
        }
        

        const role = userData.role;
        switch (role) {
          case 'admin':
            router.push('/admin/dashboard');
            break;
          case 'recepcion':
            router.push('/recepcion/dashboard');
            break;
          case 'doctora':
            router.push('/doctora/dashboard');
            break;
          case 'terapeuta':
            router.push('/terapeuta/dashboard');
            break;
          default:
            setError('Rol de usuario no reconocido.');
            auth.signOut();
            setIsLoading(false);
            break;
        }
      } else {
        setError("No se pudo encontrar la información del usuario.");
        auth.signOut();
        setIsLoading(false);
      }
    } catch (err: any) {
      if (['auth/user-not-found', 'auth/wrong-password', 'auth/invalid-credential'].includes(err.code)) {
        setError('El correo o la contraseña son incorrectos.');
      } else {
        setError('Ocurrió un error. Por favor, inténtalo de nuevo.');
      }
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex relative overflow-hidden bg-slate-100">
      {/* --- Lado Izquierdo: Branding con Video de Fondo --- */}
      <div className="hidden lg:flex w-1/2 relative items-center justify-center bg-white">
        <video
          src="/Animacion.mp4"
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-contain z-10"
        />
        <div className="absolute -top-40 -left-20 w-80 h-80 rounded-full bg-sky-100 opacity-50"></div>
        <div className="absolute -bottom-40 -right-20 w-80 h-80 rounded-full bg-sky-100 opacity-50"></div>
      </div>

      {/* --- Lado Derecho: Formulario con fondo gris claro --- */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-12">
        <div className="hidden lg:block absolute -top-40 -left-20 w-80 h-80 rounded-full bg-sky-100 opacity-50 z-0"></div>
        <div className="hidden lg:block absolute -bottom-40 -right-20 w-80 h-80 rounded-full bg-sky-100 opacity-50 z-0"></div>

        <div className="w-full max-w-md z-10">
          {isLoading ? (
            <LoadingAnimation />
          ) : (
            <>
              <div className="lg:hidden mb-12 text-center">
                <Image
                  src="/Cre logoo.svg"
                  alt="Clínica CRE Logo"
                  width={150}
                  height={50}
                  priority
                  className="mx-auto"
                />
                <h1 className="text-2xl font-bold text-slate-900 mt-4">
                  Plataforma de Gestión Clínica
                </h1>
                <p className="text-sm text-slate-500 mt-2">
                  Innovación en Rehabilitación y Electrodiagnóstico.
                </p>
              </div>
              
              <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm">
                <h2 className="text-3xl font-bold text-slate-900 mb-2">Iniciar Sesión</h2>
                <p className="text-slate-500 mb-8">Bienvenido de nuevo. Accede a tu cuenta.</p>

                <form onSubmit={handleLogin} className="space-y-6">
                  {/* Campo de Correo Electrónico */}
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">
                      Correo Electrónico
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3"> <FiUser /> </span>
                      <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="ejemplo@clinicacre.com"
                        className="w-full bg-slate-50 text-slate-900 placeholder-slate-400 border border-slate-200 rounded-lg py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition" />
                    </div>
                  </div>

                  {/* Campo de Contraseña */}
                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-2">
                      Contraseña
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3"> <FiLock /> </span>
                      <input id="password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••"
                        className="w-full bg-slate-50 text-slate-900 placeholder-slate-400 border border-slate-200 rounded-lg py-3 pl-10 pr-10 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition" />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 flex items-center pr-3 cursor-pointer" aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}>
                        {showPassword ? <FiEye /> : <FiEyeOff />}
                      </button>
                    </div>
                  </div>

                  {error && <p className="text-red-600 text-sm text-center bg-red-100 border border-red-300 rounded-lg py-2">{error}</p>}

                  <div>
                    <button type="submit"
                      className="w-full bg-sky-600 hover:bg-sky-700 text-white font-bold py-3 px-4 rounded-lg transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white focus:ring-sky-500">
                      Ingresar
                    </button>
                  </div>
                </form>
              </div>
              
              <p className="text-center text-slate-500 text-sm mt-10">
                © 2025 Clínica CRE. Todos los derechos reservados.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
