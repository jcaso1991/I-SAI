---
description: Trabajar backend, API, Excel, OneDrive, PDFs, permisos y datos con cuidado extra.
---

Si no hay pedido después de `/datos`, preguntá: "¿Qué necesitás hacer con datos, API o archivos?" y terminá el turno.

Aplicá las skills `backend-fastapi-datos`, `dominio-proyecto` y `qa-seguro`.

Flujo:

1. Identificá qué datos toca el pedido y qué riesgo tiene.
2. No leas `.env`, credenciales ni secretos.
3. No ejecutes pruebas contra servicios remotos ni datos reales.
4. Cambiá lo mínimo necesario.
5. Verificá de forma local y segura.
6. Explicá qué zona peligrosa se evitó, como marcar una obra antes de entrar.
