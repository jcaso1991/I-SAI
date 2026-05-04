---
name: qa-seguro
description: Activar cuando haya que verificar cambios, correr tests seguros, revisar riesgos, auditar o validar sin build ni datos reales.
---

# QA Seguro

## Cuándo Activarse

- Antes de entregar cambios.
- En `/verificar`, `/revisar`, `/mejorar`, `/arreglar`, `/pantalla` y `/datos`.
- Cuando el pedido mencione tests, QA, validación o revisión.
- Cuando haya riesgo de tocar datos reales o servicios remotos.

## Cuándo NO Activarse

- Preguntas conceptuales sin acción sobre el repo.
- Redacción de textos que no requiera validar código.

## Convenciones Del Proyecto

- No correr builds.
- No correr tests contra URLs remotas.
- Para backend desde `/verificar`, usar solo `.opencode/scripts/safe-backend-pytest.sh`.
- Verificar con el menor alcance útil: como probar una llave en una puerta antes de revisar todo el edificio.
- Si no se pudo verificar, decirlo claramente y explicar el riesgo.

## No Tocar

- `.env`, credenciales y secretos.
- Datos reales.
- Deploys, builds o merges.
- Comandos destructivos como `rm`, `git reset`, `git restore` o `git revert`.

## Checklist Humano

- El cambio responde al pedido.
- No toca datos reales ni secretos.
- No rompe permisos.
- No requiere build para validarse.
- La explicación final dice qué cambió, cómo se verificó y qué queda pendiente.

## Ejemplos Para La Persona Usuaria

- "Verificá backend."
- "Revisá si esto puede romper datos reales."
- "Probá que el arreglo no afecte presupuestos."
