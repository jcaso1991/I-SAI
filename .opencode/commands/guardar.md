---
description: Guardar cambios con commit y push directos.
---

Flujo obligatorio:

1. Ejecutá `git status`.
2. Si no hay cambios, respondé exactamente: "No hay nada para guardar todavía. Podés seguir trabajando y usar `/guardar` más tarde."
3. Si hay cambios, mostrale a la persona un resumen humano de lo que se va a guardar.
4. No pidas confirmación extra: la invocación de `/guardar` ya confirma `git add`, `git commit` y `git push`.
5. Ejecutá `git add`, `git commit` con mensaje conventional commit en español y después `git push`.
6. No agregues atribución de IA ni `Co-Authored-By`.
7. Si detectás secretos, credenciales o archivos sensibles, frená antes de agregarlos y avisá el riesgo en lenguaje claro.
