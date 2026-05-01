# Guía De Usuario

Este proyecto está preparado para trabajar con OpenCode en español desde cualquier carpeta local donde tengas clonado el repo.

## Comandos Principales

- `/mejorar hacé más claro el calendario`: pide una mejora general.
- `/arreglar no guarda el presupuesto`: corrige un problema puntual.
- `/pantalla mejorar la vista de técnicos en celular`: trabaja sobre frontend.
- `/datos revisar permisos de presupuestos`: trabaja sobre backend, API o datos.
- `/verificar backend`: revisa sin modificar archivos.
- `/revisar`: audita y lista mejoras, sin tocar nada.
- `/guardar`: guarda cambios con commit después de confirmación humana.
- `/deshacer`: indica cómo usar `/undo`.
- `/pedir-ayuda no puedo resolver este error`: escala a GitHub.
- `/explicar este error`: traduce código o errores a lenguaje natural.
- `/ayuda`: muestra ayuda y revisa acceso a GitHub.

## Forma Segura De Trabajo

OpenCode primero investiga, después cambia y finalmente verifica. Es como revisar planos antes de picar una pared: evita romper cosas importantes.

Nunca debería leer archivos de secretos como `.env`, credenciales o claves privadas.

No corre builds. Un build (paquete final de la app) puede ser lento, caro o depender de servicios externos; por eso queda fuera de este flujo.
