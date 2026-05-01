---
description: Guardar cambios con commit directo tras confirmación humana.
---

Flujo obligatorio:

1. Ejecutá `git status`.
2. Si no hay cambios, respondé exactamente: "No hay nada para guardar todavía. Podés seguir trabajando y usar `/guardar` más tarde."
3. Si hay cambios, mostrale a la persona un resumen humano de lo que se va a guardar.
4. Pedí confirmación antes de hacer `git add` y `git commit`.
5. Si confirma, ejecutá `git add` y `git commit` con mensaje conventional commit.
6. No agregues atribución de IA ni `Co-Authored-By`.
7. No pushees.
