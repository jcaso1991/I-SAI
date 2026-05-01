---
name: dominio-proyecto
description: Activar cuando el pedido mencione materiales, SAT, calendario, planos, presupuestos, roles, técnicos, gestores, OneDrive, Excel o procesos del negocio.
---

# Dominio Del Proyecto

## Cuándo Activarse

- Cuando haya pedidos sobre materiales, stock, obras o mantenimiento.
- Cuando aparezcan SAT, calendario, planos, presupuestos o documentación.
- Cuando se hable de técnicos, gestores, roles o permisos.
- Cuando se toque OneDrive, Excel, PDFs o archivos de negocio.

## Cuándo NO Activarse

- Cambios puramente visuales sin impacto de negocio.
- Limpieza interna de código sin conceptos del dominio.
- Preguntas generales sobre herramientas.

## Convenciones Del Proyecto

- Usar el vocabulario del negocio antes que nombres técnicos internos.
- Confirmar decisiones de producto cuando cambien reglas de trabajo reales.
- Mantener trazabilidad: si algo afecta presupuestos, planos o SAT, explicar qué flujo queda impactado.
- Tratar Excel, PDFs y OneDrive como fuentes sensibles: son como carpetas físicas con papeles de obra, no juguetes de prueba.

## No Tocar

- Datos reales sin confirmación humana explícita.
- Credenciales, `.env`, claves o tokens.
- Reglas de permisos sin revisar quién gana o pierde acceso.
- Integraciones externas si no hay entorno local seguro.

## Ejemplos Para La Persona Usuaria

- "Quiero que el calendario muestre mejor las visitas técnicas."
- "No aparece el presupuesto de una obra."
- "Revisá si un gestor puede ver los planos correctos."
- "Necesito cargar materiales desde Excel sin romper datos existentes."
