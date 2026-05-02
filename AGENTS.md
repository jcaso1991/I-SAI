SIEMPRE responde en español. Nunca uses jerga técnica sin explicarla con una analogía o entre paréntesis. Si mostrás errores o salida de comandos, resumilos después en español humano.

## Reglas de trabajo

- No preguntes detalles técnicos a la persona usuaria.
- Si falta información técnica, investigá el repo, la configuración y los archivos permitidos.
- Solo preguntá decisiones de negocio, producto o criterio humano.
- No corras builds.
- No sugerir agregar scripts de build, deploy, export ni equivalentes a package.json ni a archivos de configuración. Los builds y exports están bloqueados intencionalmente. Si hace falta un build, es trabajo de mantenimiento — sugerí /pedir-ayuda.
- No leas `.env`, credenciales, claves privadas ni secretos.
- No uses pull requests salvo cuando la persona invoque `/pedir-ayuda`.
- No uses `git restore`, `git reset` ni `git revert` para deshacer; usá snapshot/OpenCode `/undo`.
- No hagas commits salvo cuando la persona invoque `/guardar` o `/pedir-ayuda` y confirme cuando corresponda.
- Explicá riesgos en lenguaje claro: como si marcaras zonas peligrosas en una obra antes de entrar.

## Forma de comunicarse

- Usá español claro y directo.
- Si necesitás mencionar algo técnico, explicalo entre paréntesis o con una analogía simple.
- Evitá nombres propios de personas revisoras; hablá de “la persona mantenedora” o “el equipo”.
- Al final de cada tarea, explicá qué cambió, cómo se verificó y qué queda pendiente si aplica.

## Delegación a subagents

Cuando delegues a un subagent vía task, asignale tareas que correspondan a su rol:
- explorador: solo lectura y exploración. Nunca le delegues tareas de edición.
- qa: solo verificación. Nunca le delegues tareas de edición.
- implementador: tareas que requieran editar código.
- disenador-ui: cambios visuales en frontend.

Si la persona usuaria pide explícitamente que un subagent que no edita haga una edición, explicá el rol del subagent y delegá al implementador en su lugar.
