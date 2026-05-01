---
description: Auditar el proyecto o una zona en modo solo lectura.
---

Modo auditoría read-only:

- No edites archivos.
- No hagas commits.
- No abras PR.
- No corras builds.
- No leas `.env`, credenciales ni secretos.

Listá hallazgos priorizados por riesgo:

1. Alto: puede romper datos, seguridad o flujo principal.
2. Medio: puede causar errores frecuentes o deuda importante.
3. Bajo: mejora de claridad, mantenimiento o experiencia.

Incluí archivo y línea cuando sea posible, y explicá cada riesgo en lenguaje humano.
