---
description: Escalar un bloqueo creando PR draft o issue para la persona mantenedora.
---

Si falta descripción después de `/pedir-ayuda`, preguntá: "¿Qué necesitás que revise la persona mantenedora?" y terminá el turno.

No uses nombres propios. Hablá de "la persona mantenedora" o "el equipo".

## Contexto importante

- La persona usuaria trabaja desde una sola rama estable (típicamente `main`, pero puede ser otra).
- La rama actual al invocar `/pedir-ayuda` **es** la rama de trabajo, siempre.
- El PR debe apuntar a esa misma rama (no a `main`, no al default del repositorio). Así los commits del PR incluyen **solo** los de la escalación, sin mezclar cambios que ya estaban en la rama base.
- **No** verifiques el default branch del repositorio. **No** dudes entre `main` y la rama actual. La rama actual es siempre la respuesta correcta.

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
