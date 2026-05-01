# Manual Operativo

## Flujo Normal

1. La persona usuaria pide algo con un comando simple.
2. OpenCode investiga el repo y propone o ejecuta el cambio seguro.
3. OpenCode verifica sin build y sin datos reales.
4. La persona usuaria usa `/guardar`.
5. OpenCode muestra resumen, pide confirmación y hace commit en la rama actual.

## Escalación

Cuando uses `/pedir-ayuda` se abre un PR draft o issue en GitHub. La persona mantenedora del repo lo verá ahí. Si es urgente, avisá por el canal habitual del equipo.

Si hay cambios locales, se crea una rama `escalacion/<slug>`, se commitea, se pushea y se abre un PR draft.

Si no hay cambios locales, se abre un issue.

## Límites De Seguridad

- No usar PR salvo con `/pedir-ayuda`.
- No hacer commit salvo con `/guardar` o `/pedir-ayuda`.
- No correr builds.
- No leer `.env`, credenciales ni claves privadas.
- No usar `git restore`, `git reset` ni `git revert` para deshacer.

## Deshacer Cambios

Para deshacer el último cambio usá `/undo`, que es un comando incorporado de OpenCode (en inglés: undo). Este comando usa el sistema interno de snapshots para revertir, sin tocar `git restore`, `git reset` ni `git revert`.

## Backend Tests

Para verificar backend desde comandos de usuario, usar solo `.opencode/scripts/safe-backend-pytest.sh`.

Ese script aborta si la URL del backend no es local. Esto evita que una prueba toque datos reales por accidente.
