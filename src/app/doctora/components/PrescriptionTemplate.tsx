import React from 'react';
import Image from 'next/image';

interface PrescriptionTemplateProps {
  doctorName: string;
  patientName: string;
  prescriptionText: string;
  date: string;
}

// Este componente replica el diseño exacto de la imagen, ajustado a media página.
const PrescriptionTemplate: React.FC<PrescriptionTemplateProps> = ({ doctorName, patientName, prescriptionText, date }) => {
  return (
    // Contenedor principal ajustado a media página (5.5in de alto)
    <div id="prescription-to-print" className="w-[8.5in] h-[5.5in] p-8 bg-white text-black font-serif flex flex-row border border-slate-200">
      
      {/* --- COLUMNA IZQUIERDA --- */}
      <div className="w-1/3 pr-6 flex flex-col border-r border-slate-200">
        <Image src="/Cre logoo.svg" alt="Logo CRE" width={120} height={75} className="mb-2" />
        <h2 className="text-base font-bold">Centro de Rehabilitación y</h2>
        <h2 className="text-base font-bold mb-4">Electrodiagnóstico</h2>
        
        {/* 🔹 DIV AZUL FIJO PARA IMPRESIÓN 🔹 */}
        <div
          style={{
            backgroundColor: '#0284c7', // color azul fijo
            color: 'white',
            display: 'block',
            minHeight: '140px', // altura mínima para que no se colapse
            padding: '12px',
            borderRadius: '0.5rem',
          }}
        >
          <h3 className="font-bold text-center mb-1 text-base">HORARIO:</h3>
          <p className="font-bold text-xs">Atiende por Cita:</p>
          <p className="font-bold mt-1 text-xs">Lunes a viernes:</p>
          <p className="text-xs">De 8:00 a.m. a 12:00 m</p>
          <p className="text-xs">De 2:00 a 6:00 p.m.</p>
          <p className="font-bold mt-1 text-xs">Sábado:</p>
          <p className="text-xs">8:00 a.m. a 12:00 m.</p>
        </div>

        <div className="mt-auto text-center">
            {/* Placeholder para el Código QR (reescalado) */}
            <div className="w-28 h-28 mx-auto flex items-center justify-center mb-2">
                <Image src="/QR CRE.jpg" alt="Logo CRE" width={120} height={75} className="mb-2" />
            </div>
            <p className="font-bold text-sm">@CRE_HONDURAS</p>
        </div>
      </div>

      {/* --- COLUMNA DERECHA --- */}
      <div className="w-2/3 pl-8 flex flex-col">
        <div className="flex justify-between items-start">
            <div className="flex-grow">
                <h1 className="text-2xl font-bold">{doctorName}</h1>
                <p className="text-base border-b-2 border-sky-500 pb-1">Medicina Física, Rehabilitación y Electrodiagnóstico</p>
                <p className="text-[10px] mt-1">BARRIO RIO DE PIEDRAS, 20 AVE. "A", 1-2 CALLE, S.O. #8</p>
                <p className="text-[10px]">TELEFAX: (504) 2553-5019, (504) 2553-5051</p>
            </div>
            {/* Placeholder para el logo de Unidades Médicas (reescalado) */}
            <div className="w-20 h-20 ml-4 flex items-center justify-center text-center flex-shrink-0">
                <Image src="/LOGO RARO.jpg" alt="Logo CRE" width={120} height={75} className="mb-2" />
            </div>
        </div>

        {/* Información del Paciente */}
        <div className="mt-8 space-y-3">
            <div className="flex items-end">
                <span className="font-bold text-base mr-2">Nombre:</span>
                <span className="border-b border-black flex-grow text-base">{patientName}</span>
            </div>
            <div className="flex items-end">
                <span className="font-bold text-base mr-2">Lugar y fecha:</span>
                <span className="border-b border-black flex-grow text-base">San Pedro Sula, {date}</span>
            </div>
        </div>
        
        {/* Cuerpo de la Receta */}
        <div className="flex-grow mt-6">
            <div 
                className="whitespace-pre-wrap text-base"
                dangerouslySetInnerHTML={{ __html: prescriptionText.replace(/\n/g, '<br />') }}
            />
        </div>

        {/* Firma */}
        <div className="mt-auto pt-4 self-end">
            <div className="border-t-2 border-black px-16 text-center">
                <p className="text-base font-bold">FIRMA</p>
            </div>
        </div>
      </div>
    </div>
  );
};

export default PrescriptionTemplate;
