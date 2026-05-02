# Zonas De Riesgo

Estas zonas son como áreas marcadas con cinta en una obra: se puede trabajar cerca, pero no entrar sin mirar dos veces.

## Secretos

- `.env`
- Credenciales
- Claves `.pem` o `.key`
- Tokens

No se leen ni se editan.

## Datos Reales

- Presupuestos
- Planos
- SAT
- Archivos Excel
- PDFs
- OneDrive

No se prueban cambios contra datos reales salvo indicación humana explícita.

## Publicación

- Builds
- Deploys
- PR merge
- Cierres de PR

No forman parte del flujo normal de OpenCode en este repo.

## Git

- No usar `git restore`.
- No usar `git reset`.
- No usar `git revert`.
- Para deshacer, usar `/undo`.

## Backend Tests

Los tests de backend solo deben correr contra localhost. Si una URL apunta a preview, producción u otro servicio remoto, se aborta.

## Limitación conocida de OpenCode

Los subagents qa y explorador técnicamente pueden editar archivos cuando el lider-producto les delega esa tarea, aunque su rol es solo verificación o lectura. Es una limitación de la versión actual de OpenCode (bug upstream conocido en issues #20549 y #12566): los permisos definidos por agente no se propagan a subagents invocados vía task. Las defensas críticas siguen vigentes a nivel global: el archivo .env no se lee, la rama main no se pushea sin pasar por PR, y los builds están bloqueados. Si OpenCode resuelve este bug en futuras versiones, se puede endurecer agregando `edit: deny` al config de qa y explorador en opencode.json.

Como mitigación adicional contra fan-out descontrolado, los subagents tienen `permission.task: deny` declarado en su config. Por el mismo bug, este override no se respeta hoy, pero la regla en AGENTS.md instruye explícitamente a los subagents a no delegar entre sí. Cuando el bug se resuelva, el override empezará a funcionar y la mitigación será doble: prompt + permission.
