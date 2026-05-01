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
