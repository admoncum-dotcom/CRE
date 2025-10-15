'use client';

import React, { useState } from 'react';
import { FiCheckCircle, FiTrash2 } from 'react-icons/fi';

interface BodySelectorProps {
  selectedAreas: string[];
  onSelectArea: (area: string) => void;
}

// --- CORRECCIÓN ---
// Se mueve el sub-componente fuera para optimizar y asegurar su actualización.
// Ahora recibe 'isSelected' y 'onToggle' como props directas.
const BodyPart = ({ name, d, isSelected, onToggle }: { name:string; d: string; isSelected: boolean; onToggle: (name: string) => void; }) => (
    <path
        d={d}
        className={`cursor-pointer transition-all duration-200 stroke-slate-600 stroke-[0.5] hover:stroke-sky-600 hover:stroke-2 ${isSelected ? 'fill-sky-500/70 stroke-sky-700 stroke-2' : 'fill-slate-400/30 hover:fill-sky-300/50'}`}
        onClick={() => onToggle(name)}
    >
        <title>{name}</title>
    </path>
);

const BodySelector: React.FC<BodySelectorProps> = ({ selectedAreas, onSelectArea }) => {
    const [view, setView] = useState<'front' | 'back'>('front');

    const handleToggleArea = (area: string) => {
        const newAreas = selectedAreas.includes(area)
            ? selectedAreas.filter(a => a !== area)
            : [...selectedAreas, area];
        // CORRECCIÓN: Cambiado de onSelectionChange a onSelectArea
        onSelectArea(area); // Esto selecciona/deselecciona una sola área
    };

    // Función para manejar la selección de todas las áreas
    const handleSelectAll = () => {
        // Para seleccionar todas las áreas, necesitamos pasar todas las partes
        const allParts = view === 'front' 
            ? frontParts.map(p => p.name) 
            : backParts.map(p => p.name);
        
        // Como onSelectArea solo maneja una área a la vez, necesitamos una solución diferente
        // Vamos a simular la selección de todas las áreas
        allParts.forEach(part => {
            if (!selectedAreas.includes(part)) {
                onSelectArea(part);
            }
        });
    };

    // Función para manejar la deselección de todas las áreas
    const handleDeselectAll = () => {
        // Para deseleccionar todas las áreas, necesitamos pasar todas las partes seleccionadas
        const partsToDeselect = view === 'front' 
            ? frontParts.filter(p => selectedAreas.includes(p.name)).map(p => p.name)
            : backParts.filter(p => selectedAreas.includes(p.name)).map(p => p.name);
        
        // Deseleccionar cada área seleccionada
        partsToDeselect.forEach(part => {
            onSelectArea(part);
        });
    };

    // Definición de las coordenadas SVG para cada parte del cuerpo (Vista Frontal)
    // Rediseñado para una apariencia más realista y con mayor detalle anatómico.
    const frontParts = [
        { name: 'Cabeza', d: 'M150 10 C135 10 125 25 125 50 C125 80 135 95 150 95 C165 95 175 80 175 50 C175 25 165 10 150 10 Z' },
        { name: 'Cuello', d: 'M144 95 L142 115 L158 115 L156 95 Z' },
        { name: 'Hombro Izquierdo', d: 'M142 115 C120 120 105 135 100 155 L130 150 Z' },
        { name: 'Hombro Derecho', d: 'M158 115 C180 120 195 135 200 155 L170 150 Z' },
        { name: 'Pecho', d: 'M130 150 C140 155, 160 155, 170 150 L170 195 L130 195 Z' },
        { name: 'Abdomen', d: 'M130 195 L170 195 L165 245 L135 245 Z' },
        { name: 'Pelvis', d: 'M135 245 L165 245 L170 265 L130 265 Z' },
        { name: 'Brazo Izquierdo', d: 'M100 155 C95 180 90 200 85 220 L95 225 L110 160 Z' },
        { name: 'Antebrazo Izquierdo', d: 'M85 220 C80 250 78 270 80 290 L90 295 L95 225 Z' },
        { name: 'Mano Izquierda', d: 'M80 290 C75 300 70 315 75 325 L85 320 L90 295 Z' },
        { name: 'Brazo Derecho', d: 'M200 155 C205 180 210 200 215 220 L205 225 L190 160 Z' },
        { name: 'Antebrazo Derecho', d: 'M215 220 C220 250 222 270 220 290 L210 295 L205 225 Z' },
        { name: 'Mano Derecha', d: 'M220 290 C225 300 230 315 225 325 L215 320 L210 295 Z' },
        { name: 'Muslo Izquierdo', d: 'M130 265 L150 265 L145 365 L128 365 Z' },
        { name: 'Rodilla Izquierda', d: 'M128 365 L145 365 L145 385 L128 385 Z' },
        { name: 'Pantorrilla Izquierda', d: 'M128 385 L145 385 C148 420 140 450 135 455 L130 455 Z' },
        { name: 'Pie Izquierdo', d: 'M130 455 L140 455 L140 475 L115 475 Z' },
        { name: 'Muslo Derecho', d: 'M170 265 L150 265 L155 365 L172 365 Z' },
        { name: 'Rodilla Derecha', d: 'M172 365 L155 365 L155 385 L172 385 Z' },
        { name: 'Pantorrilla Derecha', d: 'M172 385 L155 385 C152 420 160 450 165 455 L170 455 Z' },
        { name: 'Pie Derecho', d: 'M170 455 L160 455 L160 475 L185 475 Z' },
    ];
    
    // Definición de las coordenadas SVG para cada parte del cuerpo (Vista Trasera)
    const backParts = [
        { name: 'Cabeza Posterior', d: 'M150 10 C135 10 125 25 125 50 C125 80 135 95 150 95 C165 95 175 80 175 50 C175 25 165 10 150 10 Z' },
        { name: 'Cuello Posterior', d: 'M144 95 C142 105, 140 115, 140 115 L160 115 C160 115, 158 105, 156 95 Z' },
        { name: 'Hombro Izquierdo Posterior', d: 'M140 115 C120 120, 105 135, 100 155 L130 150 Z' },
        { name: 'Hombro Derecho Posterior', d: 'M160 115 C180 120, 195 135, 200 155 L170 150 Z' },
        { name: 'Omóplato Izquierdo', d: 'M130 150 C135 160, 138 180, 135 195 L148 195 L148 150 Z' },
        { name: 'Omóplato Derecho', d: 'M170 150 C165 160, 162 180, 165 195 L152 195 L152 150 Z' },
        { name: 'Espalda Media', d: 'M135 195 L165 195 L165 220 L135 220 Z' },
        { name: 'Espalda Inferior (Lumbar)', d: 'M135 220 L165 220 L162 260 L138 260 Z' },
        { name: 'Glúteo Izquierdo', d: 'M138 260 C128 265, 125 295, 138 300 L150 300 L150 260 Z' },
        { name: 'Glúteo Derecho', d: 'M162 260 C172 265, 175 295, 162 300 L150 300 L150 260 Z' },
        { name: 'Brazo Izquierdo Posterior', d: 'M100 155 C95 180 90 200 85 220 L95 225 L110 160 Z' },
        { name: 'Antebrazo Izquierdo Posterior', d: 'M85 220 C80 250 78 270 80 290 L90 295 L95 225 Z' },
        { name: 'Mano Izquierda Posterior', d: 'M80 290 C75 300 70 315 75 325 L85 320 L90 295 Z' },
        { name: 'Brazo Derecho Posterior', d: 'M200 155 C205 180 210 200 215 220 L205 225 L190 160 Z' },
        { name: 'Antebrazo Derecho Posterior', d: 'M215 220 C220 250 222 270 220 290 L210 295 L205 225 Z' },
        { name: 'Mano Derecha Posterior', d: 'M220 290 C225 300 230 315 225 325 L215 320 L210 295 Z' },
        { name: 'Muslo Izquierdo Posterior', d: 'M138 300 L150 300 L145 365 L128 365 Z' },
        { name: 'Corva Izquierda', d: 'M128 365 L145 365 L145 385 L128 385 Z' },
        { name: 'Pantorrilla Izquierda Posterior', d: 'M128 385 L145 385 C148 420 140 450 135 455 L130 455 Z' },
        { name: 'Talón Izquierdo', d: 'M130 455 L140 455 L140 475 L115 475 Z' },
        { name: 'Muslo Derecho Posterior', d: 'M162 300 L150 300 L155 365 L172 365 Z' },
        { name: 'Corva Derecha', d: 'M172 365 L155 365 L155 385 L172 385 Z' },
        { name: 'Pantorrilla Derecha Posterior', d: 'M172 385 L155 385 C152 420 160 450 165 455 L170 455 Z' },
        { name: 'Talón Derecho', d: 'M170 455 L160 455 L160 475 L185 475 Z' },
    ];

    return (
        <div className="flex flex-col items-center p-4 bg-slate-50 rounded-xl border">
            <div className="w-full flex justify-between items-center mb-3 px-1">
                <div className="flex gap-2">
                    <button type="button" onClick={handleSelectAll} className="text-xs font-semibold text-sky-700 hover:text-sky-900 flex items-center gap-1"><FiCheckCircle /> Seleccionar Todo</button>
                    <button type="button" onClick={handleDeselectAll} className="text-xs font-semibold text-slate-500 hover:text-red-600 flex items-center gap-1"><FiTrash2 /> Limpiar</button>
                </div>
                <div className="flex justify-center gap-2 bg-slate-200 p-1 rounded-full">
                    <button type="button" onClick={() => setView('front')} className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${view === 'front' ? 'bg-white shadow text-sky-700' : 'text-slate-600 hover:bg-slate-100'}`}>Frente</button>
                    <button type="button" onClick={() => setView('back')} className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${view === 'back' ? 'bg-white shadow text-sky-700' : 'text-slate-600 hover:bg-slate-100'}`}>Espalda</button>
                </div>
            </div>
            <svg viewBox="70 0 160 490" className="w-full h-auto max-h-96">
                <g style={{ display: view === 'front' ? 'block' : 'none' }}>
                    {frontParts.map(part => (
                        <BodyPart 
                            key={part.name} 
                            name={part.name} 
                            d={part.d} 
                            isSelected={selectedAreas.includes(part.name)} 
                            onToggle={handleToggleArea}
                        />
                    ))}
                </g>
                <g style={{ display: view === 'back' ? 'block' : 'none' }}>
                    {backParts.map(part => (
                        <BodyPart 
                            key={part.name} 
                            name={part.name} 
                            d={part.d} 
                            isSelected={selectedAreas.includes(part.name)} 
                            onToggle={handleToggleArea}
                        />
                    ))}
                </g>
            </svg>
        </div>
    );
};

export default BodySelector;