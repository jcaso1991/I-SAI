---
name: backend-fastapi-datos
description: Activar cuando el pedido toque FastAPI, Mongo/Motor, Pydantic, JWT, permisos, Excel, OneDrive, PDFs, endpoints o datos.
---

# Backend FastAPI Datos

## Cuándo Activarse

- Cambios en API, endpoints o respuestas del servidor.
- Permisos, JWT o roles.
- Persistencia con Mongo/Motor.
- Modelos Pydantic o validaciones.
- Importación/exportación de Excel, OneDrive o PDFs.

## Cuándo NO Activarse

- Cambios visuales sin modificar datos ni API.
- Textos de documentación sin reglas de backend.
- Ajustes de estilos frontend.

## Convenciones Del Proyecto

- Validar entradas con modelos claros: como revisar una orden de trabajo antes de mandarla al taller.
- Mantener permisos cerca del flujo que protegen.
- Evitar efectos colaterales en datos reales.
- Preferir cambios chicos y verificables.
- Para tests de backend usar el wrapper seguro `.opencode/scripts/safe-backend-pytest.sh` cuando el pedido venga desde `/verificar backend`.

## No Tocar

- `.env`, credenciales, tokens, claves privadas o archivos `*credentials*`.
- Servicios remotos desde tests.
- Datos reales de clientes, presupuestos, planos o SAT sin autorización humana.
- Migraciones destructivas sin plan y confirmación.

## Ejemplos Para La Persona Usuaria

- "La API no devuelve los presupuestos."
- "Revisá permisos de técnicos."
- "Necesito importar un Excel de materiales."
- "El PDF sale incompleto."
