---
description: Escalar un bloqueo creando PR draft o issue para la persona mantenedora.
---

Si falta descripción después de `/pedir-ayuda`, preguntá: "¿Qué necesitás que revise la persona mantenedora?" y terminá el turno.

No uses nombres propios. Hablá de "la persona mantenedora" o "el equipo".

Flujo:

1. Ejecutá `git status`.
2. Si hay cambios:
   - Creá una rama `escalacion/<slug>`.
   - Hacé commit de los cambios con mensaje conventional commit.
   - Pusheá la rama.
   - Abrí PR draft con `gh pr create --draft`.
3. Si no hay cambios:
   - Abrí issue con `gh issue create`.

Plantilla obligatoria para PR draft:

```md
## Qué se pidió

## Qué intenté

## Por qué necesito ayuda

## Archivos que toqué

## Qué necesito que revises
```

Al final, compartí el enlace creado y explicá que si es urgente conviene avisar por el canal habitual del equipo.
