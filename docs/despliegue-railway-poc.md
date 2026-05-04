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
| Landing      | servicio `landing`                  |

### URLs de verificación

- **Backend**: la que genere Railway para el servicio `backend`.
- **Frontend**: la que genere Railway para el servicio `frontend`.
- **Landing**: la que genere Railway para el servicio `landing`.

Podés obtener las URLs con:

```bash
railway domain --service backend --environment poc
railway domain --service frontend --environment poc
railway domain --service landing --environment poc
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

### Landing

La landing es un despliegue separado y estático. Usá `landing/` como raíz del servicio y `python main.py` como comando de inicio.

```bash
railway up landing --path-as-root --service landing --environment poc --ci
```

## Verificación

Después de cada deploy, abrí la URL del servicio correspondiente y confirmá que responde correctamente. También podés revisar los logs:

```bash
railway logs --service backend --environment poc
railway logs --service frontend --environment poc
```

### Recorrido demo

Una vez ambos servicios están corriendo, confirmá que las partes clave funcionan:

1. **Login**: entrá al frontend e iniciá sesión con las credenciales demo (`DEMO_ADMIN_EMAIL` y `DEMO_ADMIN_PASSWORD`).
2. **Clientes/incidencias**: navegá a clientes y técnicos; verificá que los datos demo se cargan y podés crear o editar registros.
3. **Calendario desde hoy 8-18**: revisá que el calendario muestre eventos o citas en el rango laboral.
4. **Presupuestos con estados**: abrí presupuestos y confirmá que se visualizan, editan y cambian de estado correctamente.
5. **Proyectos/materiales desde OneDrive**: verificá que la integración con OneDrive lista carpetas, archivos o proyectos según corresponda, sin depender de `demo-material`.
6. **Landing pública**: abrí la URL del servicio `landing`, verificá que carga el video y que “Entrar a la app” abre el frontend.

### Verificación CORS

**`FRONTEND_URL` debe ser exactamente la URL pública del frontend** (la que devuelve `railway domain --service frontend --environment poc`). El backend la incluye automáticamente en CORS.

**`CORS_ORIGINS` es solo para dominios extra** (ej. un dominio personalizado, un staging). No dupliques `FRONTEND_URL` en `CORS_ORIGINS`, no hace falta y puede causar confusión.

Si las llamadas del frontend al backend fallan con errores de CORS:
- Verificá que `FRONTEND_URL` coincida con la URL real del frontend (protocolo `https://` incluido, sin barra al final).
- Confirmá que `CORS_ORIGINS` no tenga valores repetidos ni la misma URL que `FRONTEND_URL`.

## Variables necesarias

### Backend

- `MONGO_URL`: URL de MongoDB inyectada por Railway.
- `DB_NAME`: nombre de la base de datos de la PoC.
- `JWT_SECRET`: secreto para firmar sesiones.
- `FRONTEND_URL`: URL publica del frontend.
- `INITIAL_EXCEL_PATH`: ruta del Excel inicial de materiales, si se usa.
- `ENABLE_DEMO_SEED`: poner `true` solo en PoC si queres cargar datos demo.
- `DEMO_ADMIN_EMAIL`: email del usuario admin demo.
- `DEMO_ADMIN_PASSWORD`: password del usuario admin demo; requerida para crearlo.
- `DEMO_ADMIN_NAME`: nombre visible del admin demo.
- `DEMO_USER_PASSWORD`: password compartida para usuarios demo no admin; requerida para crearlos.
- `ONEDRIVE_TOKEN_ENCRYPTION_KEY`: clave de 32 bytes en base64 (url-safe) usada para cifrar los tokens de OneDrive en la base de datos. Generala con `python -c "import base64, os; print(base64.urlsafe_b64encode(os.urandom(32)).decode())"`. **⚠️ No la pierdas. Si se pierde o rota, hay que volver a vincular OneDrive desde cero porque los tokens guardados no se pueden descifrar.**
- `CORS_ORIGINS`: opcional. Orígenes adicionales separados por coma (ej. `https://otro-dominio.com,https://staging.app.com`). `FRONTEND_URL` se incluye siempre automáticamente.
- `TRUST_PROXY_HEADERS`: opcional. Usar `true` solo si el proxy limpia `x-forwarded-for`; si no, dejar en `false` para que el rate limit SAT no confíe en una IP declarada por el cliente.

### Frontend

- `EXPO_PUBLIC_BACKEND_URL`: URL publica del backend.
- `EXPO_PUBLIC_PORTFOLIO_URL`: URL publica de la landing.
- `HOST`: usar `0.0.0.0` en Railway.
- `PORT`: puerto usado por el servicio frontend.

### Landing

- `PORT`: puerto usado por Railway. Si no se define, `landing/main.py` usa `8000`.
- `FRONTEND_URL`: URL publica del frontend. La landing la usa para el botón “Entrar a la app”.

## Riesgos

- **No es producción real**: el entorno `poc` es para pruebas. No usarlo con datos reales ni clientes.
- **No exponer secretos**: nunca commities ni subas `.env`, credenciales o claves privadas.
- **Confirmar entorno**: siempre verificá que `--environment poc` esté presente. Equivocarse puede pisar otro entorno.
- **Variables de entorno**: si tocaste variables en Railway (panel web), asegurate de que el deploy no las sobrescriba ni las duplique.
- **Seeds demo**: `ENABLE_DEMO_SEED=true` crea datos de muestra. No lo actives en entornos con datos reales.

## Nota sobre GitHub auto-deploy

Railway puede configurarse para desplegar automáticamente desde GitHub (auto-deploy). Para activarlo se necesitan **permisos del dueño del repositorio**. Si no tenés esos permisos, usá los comandos de esta guía para desplegar manualmente.
