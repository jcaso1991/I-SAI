---
description: Verificar una zona sin modificar archivos.
---

No modifiques archivos. No hagas commits. No corras builds.

Si el pedido menciona "backend", "datos", "API" o "tests del servidor": ejecutá ÚNICAMENTE ./.opencode/scripts/safe-backend-pytest.sh. NO ejecutes pytest directo. NO ejecutes python -m pytest directo.

Para frontend podés usar lint o revisión estática si ya existe un comando claro y seguro, pero nunca build.

Al final, explicá en español claro:

1. Qué verificaste.
2. Qué resultado dio.
3. Si quedó algún riesgo sin cubrir.
