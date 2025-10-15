// No necesitamos importar 'Inter' ni metadata aquí, eso se maneja en el layout raíz.
// Solo importamos los estilos globales.
import '../globals.css';

// Este es un componente simple que recibe a sus "hijos" (las páginas) y los muestra.
export default function ReceptionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
    </>
  );
}