'use client';

import React, { useRef } from 'react';
import Lottie, { LottieRefCurrentProps } from 'lottie-react';
import animationData from '@/salir.json'; // Asegúrate que el JSON esté en /public

const buttonStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  width: '70px',
  height: '70px',
  padding: 0,
};

const AnimatedLogoutButton = () => {
  const lottieRef = useRef<LottieRefCurrentProps>(null);

  const handleLogout = () => {
    if (lottieRef.current) {
      lottieRef.current.stop();
      lottieRef.current.play();
    }
    console.log("Cerrando sesión...");
  };

  return (
    <button onClick={handleLogout} style={buttonStyle} aria-label="Cerrar sesión">
      <Lottie
        lottieRef={lottieRef}
        animationData={animationData}
        loop={false}
        autoplay={false}
      />
    </button>
  );
};

export default AnimatedLogoutButton;
