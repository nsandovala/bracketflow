# UI Copy Rules

Estas reglas aplican a las pantallas del shell operator.

1. Cada pantalla tiene un solo H1.
2. Ningun panel puede repetir literalmente el H1.
3. No usar "Hub operativo" si la pantalla ya se llama Torneos, Dashboard u Operator.
4. El subtitle debe aportar contexto, no repetir navegacion.
5. Las secciones deben nombrar acciones o estado:
   - "Motores disponibles"
   - "Torneos activos"
   - "Setup de ruleta"
   - "Seed listo"
   - "Proxima accion"
6. Eliminar duplicados como:
   - "Torneos / Torneos"
   - "Hub operativo / Torneos"
   - "Crea, selecciona y opera torneos..." repetido.
7. En componentes con secciones internas, dejar comentario:
   `No duplicar el H1 en titulos internos.`

8. No repetir titulo + subtitulo con el mismo significado dentro de la misma vista.
   Ejemplo malo:
   - Header: "Torneos"
   - Card: "Torneos"
   - Subcopy 1: "Crea, selecciona y opera torneos..."
   - Subcopy 2: "Hub operativo para listar, seleccionar y crear torneos."
   Ejemplo bueno:
   - Header pagina: "Torneos"
   - Hero operativo: "Proxima accion"
   - Seccion motores: "Motores disponibles"
   - Lista: "Torneos activos"

Regla de oro: si una pantalla repite el mismo concepto dos veces, no esta explicando mejor; esta confesando que no sabe que rol cumple.
