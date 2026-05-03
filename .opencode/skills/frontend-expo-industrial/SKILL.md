---
name: frontend-expo-industrial
description: Activar cuando el pedido mencione pantallas, Expo, React Native Web, frontend, mobile, accesibilidad o diseño industrial.
---

# Frontend Expo Industrial

## Cuándo Activarse

- Cambios en pantallas dentro de `frontend/app`.
- Componentes o lógica visual dentro de `frontend/src`.
- Pedidos de diseño, usabilidad, mobile-first o accesibilidad.
- Ajustes para Expo Router o React Native Web.

## Cuándo NO Activarse

- Cambios solo de backend o base de datos.
- Scripts operativos sin impacto visual.
- Documentación que no describa pantallas.

## Convenciones Del Proyecto

- Pantallas en `frontend/app`.
- Componentes reutilizables en `frontend/src`.
- Diseñar primero para celular: como armar una herramienta que entre en la mano antes de pensar en una mesa grande.
- Mantener accesibilidad: textos legibles, botones claros, foco visible y nombres comprensibles para lectores de pantalla.
- Respetar un lenguaje industrial: claro, robusto, sin decoración que tape la tarea.

## No Tocar

- Builds (`npm run build`, `yarn build`, EAS, Expo build).
- Secretos, `.env` o credenciales.
- Cambios grandes de navegación sin revisar el flujo completo.

## Ejemplos Para La Persona Usuaria

- "Mejorá la pantalla de técnicos en celular."
- "Quiero que el calendario sea más fácil de leer."
- "Hacé más claro el botón para subir planos."
- "La pantalla se ve rota en web."
