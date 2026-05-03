# Guía de despliegue — Railway PoC

## Objetivo

Actualizar el entorno de PoC en Railway con los cambios locales, **sin usar GitHub auto-deploy**. Esto sirve para probar cambios rápido sin depender del pipeline automático.

## Requisitos

- **Railway CLI** instalada y funcionando (`railway version`).
- **Sesión iniciada** en Railway (`railway login`).
- **Acceso al proyecto** `i-sai-poc` en Railway.
- **Repositorio clonado** en tu máquina. Ejecutá los comandos desde la raíz del repo.

## Proyecto y entorno

| Dato         | Valor                               |
| ------------ | ----------------------------------- |
| Proyecto     | `i-sai-poc`                         |
| Entorno      | `poc`                               |
| Backend      | servicio `backend`                  |
| Frontend     | servicio `frontend`                 |

### URLs de verificación

- **Backend**: la que genere Railway para el servicio `backend`.
- **Frontend**: la que genere Railway para el servicio `frontend`.

Podés obtener las URLs con:

```bash
railway domain --service backend --environment poc
railway domain --service frontend --environment poc
```

## Comandos de deploy

### Backend

```bash
railway up backend --path-as-root --service backend --environment poc --ci
```

### Frontend

```bash
railway up frontend --path-as-root --service frontend --environment poc --ci
```

## Verificación

Después de cada deploy, abrí la URL del servicio correspondiente y confirmá que responde correctamente. También podés revisar los logs:

```bash
railway logs --service backend --environment poc
railway logs --service frontend --environment poc
```

## Riesgos

- **No es producción real**: el entorno `poc` es para pruebas. No usarlo con datos reales ni clientes.
- **No exponer secretos**: nunca commities ni subas `.env`, credenciales o claves privadas.
- **Confirmar entorno**: siempre verificá que `--environment poc` esté presente. Equivocarse puede pisar otro entorno.
- **Variables de entorno**: si tocaste variables en Railway (panel web), asegurate de que el deploy no las sobrescriba ni las duplique.

## Nota sobre GitHub auto-deploy

Railway puede configurarse para desplegar automáticamente desde GitHub (auto-deploy). Para activarlo se necesitan **permisos del dueño del repositorio**. Si no tenés esos permisos, usá los comandos de esta guía para desplegar manualmente.
