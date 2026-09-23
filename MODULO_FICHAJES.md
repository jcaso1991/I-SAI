# Módulo Fichajes — I-SAI ERP
## Documentación completa del código

---

## 1. Backend — `server.py`

### 1.1 Modelos

```python
8098: # ── Fichajes ──
8099: # Helper functions
8100: def _minutos_a_horas(total_minutos: float) -> str:
8101:     if total_minutos <= 0:
8102:         return "0h 0m"
8103:     h = int(total_minutos // 60)
8104:     m = int(total_minutos % 60)
8105:     return f"{h}h {m}m"
8106:
8107: def _calcular_total(entrada: Optional[str], salida: Optional[str]) -> str:
8108:     if not entrada or not salida:
8109:         return "0h 0m"
8110:     try:
8111:         e = datetime.fromisoformat(entrada)
8112:         s = datetime.fromisoformat(salida)
8113:         diff = (s - e).total_seconds() / 60
8114:         return _minutos_a_horas(diff)
8115:     except Exception:
8116:         return "0h 0m"
8117:
8118: def _fecha_str(dt=None) -> str:
8119:     d = dt or datetime.now(timezone.utc)
8120:     return d.strftime("%Y-%m-%d")
8121:
8122: def _inicio_semana(dt=None) -> str:
8123:     d = (dt or datetime.now(timezone.utc)).replace(hour=0, minute=0, second=0, microsecond=0)
8124:     lunes = d - timedelta(days=d.weekday())
8125:     return lunes.strftime("%Y-%m-%d")
8126:
8127: def _inicio_mes(dt=None) -> str:
8128:     d = dt or datetime.now(timezone.utc)
8129:     return f"{d.year}-{d.month:02d}-01"
8130:
8131: def _fin_mes(dt=None) -> str:
8132:     d = dt or datetime.now(timezone.utc)
8133:     if d.month == 12:
8134:         next_month = datetime(d.year + 1, 1, 1, tzinfo=timezone.utc)
8135:     else:
8136:         next_month = datetime(d.year, d.month + 1, 1, tzinfo=timezone.utc)
8137:     last_day = next_month - timedelta(days=1)
8138:     return last_day.strftime("%Y-%m-%d")
8139:
8140: def _fecha_limite_anio() -> str:
8141:     return (datetime.now(timezone.utc) - timedelta(days=365)).strftime("%Y-%m-%d")
8142:
8143: # Models
8144: class FichajeIn(BaseModel):
8145:     tipo: str = "entrada"  # "entrada" | "salida" | "pausa" | "reanudar"
8146:     lat: Optional[float] = None
8147:     lng: Optional[float] = None
8148:     dispositivo: Optional[str] = None
8149:
8150: class FichajeDetalle(BaseModel):
8151:     fecha: str
8152:     entrada: Optional[str] = None
8153:     salida: Optional[str] = None
8154:     total: str = "0h 0m"
8155:     tipo: str = "presencial"
8156:
8157: class TotalesFichaje(BaseModel):
```

### 1.2 Endpoints

**`@api_router.get("/fichajes")`**
```python
    async def fichajes_usuario_listar(
        user: dict = Depends(require_permission("fichajes.view")),
        user_id: Optional[str] = None,
        from_: Optional[str] = Query(None, alias="from"),
        to: Optional[str] = None,
    ):
        perms = user.get("permissions", [])
        uid = user_id if user_id and "fichajes.manage" in perms else user["id"]
        q: dict = {"user_id": uid, "deleted": {"$ne": True}}
        if from_:
            q["$or"] = [
                {"entrada": {"$gte": from_}},
                {"salida": {"$gte": from_}},
            ]
        if to:
            # Ensure both entrada and salida are within range
            q = {"user_id": uid, "deleted": {"$ne": True}}
            if from_ and to:
                q["entrada"] = {"$gte": from_, "$lte": to}
            elif to:
                q["entrada"] = {"$lte": to}
    
        fichajes = []
        async for f in db.fichajes.find(q, {"_id": 0}).sort("entrada", -1):
            entrada_full = f.get("entrada")
            salida_full = f.get("salida")
            f_tipo = f.get("tipo", "presencial")
            fecha = (entrada_full or "")[:10]
            hora = (entrada_full or "")[11:16] if f_tipo in ("entrada", "reanudar", "fin_pausa") else (salida_full or "")[11:16]
            fichajes.append({
                "id": f.get("id", str(f.get("_id", ""))),
                "user_id": f["user_id"],
                "fecha": fecha,
                "entrada": entrada_full,
                "salida": salida_full,
                "hora": hora or "--:--",
                "total": _calcular_total(entrada_full, salida_full),
                "tipo": f_tipo,
                "lat": f.get("lat"),
                "lng": f.get("lng"),
```

**`@api_router.post("/fichajes")`**
```python
    async def fichajes_usuario_crear(payload: FichajeIn, user: dict = Depends(require_permission("fichajes.view"))):
        uid = user["id"]
        ahora = datetime.now(timezone.utc).isoformat()
    
        if payload.tipo in ("entrada", "reanudar", "fin_pausa"):
            doc = {
                "id": str(uuid.uuid4()),
                "user_id": uid,
                "entrada": ahora,
                "salida": None,
                "tipo": payload.tipo,
                "lat": payload.lat,
                "lng": payload.lng,
                "dispositivo": payload.dispositivo,
                "deleted": False,
            }
            await db.fichajes.insert_one(doc)
            doc.pop("_id", None)
            return {"ok": True, "id": doc["id"], "entrada": ahora}
        elif payload.tipo in ("salida", "pausa", "inicio_pausa"):
            # "entrada" y "fin_pausa"/"reanudar" = abrir (arriba)
            # "salida", "pausa", "inicio_pausa" = cerrar el último abierto
            fichaje_abierto = await db.fichajes.find_one(
                {"user_id": uid, "salida": None, "deleted": {"$ne": True}},
                sort=[("entrada", -1)],
            )
            if fichaje_abierto:
                final_tipo = "pausa" if payload.tipo in ("inicio_pausa", "pausa") else payload.tipo
                await db.fichajes.update_one(
                    {"id": fichaje_abierto["id"]},
                    {"$set": {
                        "salida": ahora,
                        "tipo": fichaje_abierto.get("tipo", final_tipo),
                        "lat_salida": payload.lat,
                        "lng_salida": payload.lng,
                    }},
                )
                return {"ok": True, "id": fichaje_abierto["id"], "salida": ahora}
            else:
                raise HTTPException(400, "No hay un fichaje de entrada abierto para cerrar")
```

**`@api_router.delete("/fichajes/{fichaje_id}")`**
```python
    async def fichajes_usuario_eliminar(
        fichaje_id: str,
        user: dict = Depends(require_permission("fichajes.view")),
    ):
        uid = user["id"]
        fichaje = await db.fichajes.find_one({"id": fichaje_id, "user_id": uid, "deleted": {"$ne": True}})
        if not fichaje:
            raise HTTPException(404, "Fichaje no encontrado")
    
        hoy = _fecha_str()
        fecha_fichaje = (fichaje.get("entrada") or "")[:10]
        has_edit = _has_perm(user, "fichajes.edit_own") or _has_perm(user, "fichajes.manage")
        if not has_edit and fecha_fichaje != hoy:
            raise HTTPException(403, "Solo puedes borrar fichajes del día de hoy. Necesitas el permiso de editar fichajes propios para días anteriores.")
    
        await db.fichajes.update_one(
            {"id": fichaje_id},
            {"$set": {"deleted": True, "deleted_by": uid, "deleted_at": datetime.now(timezone.utc).isoformat()}},
        )
        return {"ok": True}
    
    # Usuario: editar un fichaje propio
    class FichajeEditarPropioIn(BaseModel):
        entrada: Optional[str] = None   # "HH:MM"
        salida: Optional[str] = None    # "HH:MM"
    
    def _has_perm(user: dict, perm: str) -> bool:
        perms = user.get("permissions", [])
        return perm in perms or user.get("role") == "admin"
    
```

**`@api_router.put("/fichajes/{fichaje_id}")`**
```python
    async def fichajes_usuario_editar(
        fichaje_id: str,
        body: FichajeEditarPropioIn,
        user: dict = Depends(require_permission("fichajes.view")),
    ):
        uid = user["id"]
        fichaje = await db.fichajes.find_one({"id": fichaje_id, "user_id": uid, "deleted": {"$ne": True}})
        if not fichaje:
            raise HTTPException(404, "Fichaje no encontrado")
    
        fecha_fichaje = (fichaje.get("entrada") or "")[:10]
        hoy = _fecha_str()
        has_edit = _has_perm(user, "fichajes.edit_own") or _has_perm(user, "fichajes.manage")
        if not has_edit and fecha_fichaje != hoy:
            raise HTTPException(403, "Necesitas el permiso 'Editar fichajes propios' para modificar fichajes de días anteriores")
    
        upd = {}
        if body.entrada is not None:
            upd["entrada"] = f"{fecha_fichaje}T{body.entrada}:00"
        if body.salida is not None:
            upd["salida"] = f"{fecha_fichaje}T{body.salida}:00"
    
        if upd:
            await db.fichajes.update_one({"id": fichaje_id}, {"$set": upd})
    
        return {"ok": True}
    
    # Config fichajes (festivos, horarios)
    class ConfigFichajesIn(BaseModel):
        festivos: Optional[List[str]] = None
        hora_entrada: Optional[str] = None
        hora_salida: Optional[str] = None
        horario_verano: Optional[bool] = None
    
```

**`@api_router.get("/config-fichajes")`**
```python
    async def config_fichajes_get(user: dict = Depends(require_permission("fichajes.view"))):
        doc = await db.config.find_one({"_id": "fichajes"}) or {}
        doc.pop("_id", None)
        return doc
    
```

**`@api_router.put("/config-fichajes")`**
```python
    async def config_fichajes_put(body: ConfigFichajesIn, user: dict = Depends(require_permission("fichajes.manage"))):
        upd = {k: v for k, v in body.dict().items() if v is not None}
        if upd:
            await db.config.update_one({"_id": "fichajes"}, {"$set": upd}, upsert=True)
        return {"ok": True}
    
    
    # Admin: listar usuarios con resumen
```

**`@api_router.get("/fichajes/admin/usuarios")`**
```python
    async def fichajes_admin_usuarios(user: dict = Depends(require_permission("fichajes.manage"))):
        users = await db.users.find({}, {"_id": 0, "id": 1, "name": 1, "email": 1}).to_list(1000)
    
        hoy = _fecha_str()
        inicio_sem = _inicio_semana()
        inicio_mes_d = _inicio_mes()
        fin_mes_d = _fin_mes()
    
        hoyd = hoy + "T00:00:00"
        hoyh = hoy + "T23:59:59"
        semd = inicio_sem + "T00:00:00"
        mesh = fin_mes_d + "T23:59:59"
    
        user_ids = [u["id"] for u in users]
    
        fichajes_hoy = {}
        async for f in db.fichajes.find({
            "user_id": {"$in": user_ids},
            "deleted": {"$ne": True},
            "entrada": {"$gte": hoyd, "$lte": hoyh},
        }, {"_id": 0}):
            uid = f["user_id"]
            fichajes_hoy.setdefault(uid, []).append(f)
    
        fichajes_semana = {}
        async for f in db.fichajes.find({
            "user_id": {"$in": user_ids},
            "deleted": {"$ne": True},
            "entrada": {"$gte": semd},
        }, {"_id": 0}):
            uid = f["user_id"]
            fichajes_semana.setdefault(uid, []).append(f)
    
        fichajes_mes = {}
        async for f in db.fichajes.find({
            "user_id": {"$in": user_ids},
            "deleted": {"$ne": True},
            "entrada": {"$gte": inicio_mes_d + "T00:00:00", "$lte": mesh},
        }, {"_id": 0}):
            uid = f["user_id"]
```

**`@api_router.get("/fichajes/admin/detalle/{user_id}")`**
```python
    async def fichajes_admin_detalle(
        user_id: str,
        desde: str = Query(...),
        hasta: str = Query(...),
        user: dict = Depends(require_permission("fichajes.manage")),
    ):
        target = await db.users.find_one({"id": user_id}, {"_id": 0, "id": 1, "name": 1, "email": 1})
        if not target:
            raise HTTPException(404, "Usuario no encontrado")
    
        todos = await db.fichajes.find({
            "user_id": user_id,
            "deleted": {"$ne": True},
            "entrada": {"$gte": desde + "T00:00:00", "$lte": hasta + "T23:59:59"},
        }, {"_id": 0}).sort("entrada", 1).to_list(5000)
    
        fichajes = []
        total_min = 0.0
        dias_set = set()
        for f in todos:
            entrada_str = f.get("entrada", "")[11:16] if f.get("entrada") else None
            salida_str = f.get("salida", "")[11:16] if f.get("salida") else None
            fichajes.append({
                "id": f.get("id", str(f.get("_id", ""))),
                "fecha": f.get("entrada", "")[:10] if f.get("entrada") else "",
                "entrada": entrada_str,
                "salida": salida_str,
                "total": _calcular_total(f.get("entrada"), f.get("salida")),
                "tipo": f.get("tipo", "presencial"),
            })
            if f.get("entrada") and f.get("salida"):
                total_min += (datetime.fromisoformat(f["salida"]) - datetime.fromisoformat(f["entrada"])).total_seconds() / 60
            if f.get("entrada"):
                dias_set.add(f["entrada"][:10])
    
        vac_count = await db.vacaciones.count_documents({
            "user_id": user_id,
            "estado": "aprobada",
            "fecha_inicio": {"$lte": hasta},
            "fecha_fin": {"$gte": desde},
```

**`@api_router.put("/fichajes/admin/editar/{fichaje_id}")`**
```python
    async def fichajes_admin_editar(
        fichaje_id: str,
        body: FichajeEditarIn,
        user: dict = Depends(require_permission("fichajes.manage")),
    ):
        fichaje = await db.fichajes.find_one({"id": fichaje_id})
        if not fichaje:
            raise HTTPException(404, "Fichaje no encontrado")
    
        upd = {}
        if body.entrada is not None:
            fecha_base = (fichaje.get("entrada") or "")[:10] if fichaje.get("entrada") else _fecha_str()
            upd["entrada"] = f"{fecha_base}T{body.entrada}:00"
        if body.salida is not None:
            fecha_base = (fichaje.get("salida") or fichaje.get("entrada") or "")[:10] if (fichaje.get("salida") or fichaje.get("entrada")) else _fecha_str()
            upd["salida"] = f"{fecha_base}T{body.salida}:00"
    
        if upd:
            await db.fichajes.update_one({"id": fichaje_id}, {"$set": upd})
    
        return {"ok": True}
    
    # Admin: crear fichaje manual
```

**`@api_router.post("/fichajes/admin/crear")`**
```python
    async def fichajes_admin_crear(
        body: FichajeCrearIn,
        user: dict = Depends(require_permission("fichajes.manage")),
    ):
        target = await db.users.find_one({"id": body.user_id})
        if not target:
            raise HTTPException(404, "Usuario no encontrado")
    
        doc = {
            "id": str(uuid.uuid4()),
            "user_id": body.user_id,
            "tipo": "presencial",
            "entrada": f"{body.fecha}T{body.entrada}:00",
            "salida": f"{body.fecha}T{body.salida}:00",
            "created_by": user["id"],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "deleted": False,
        }
        await db.fichajes.insert_one(doc)
        doc.pop("_id", None)
        return {"ok": True, "id": doc["id"]}
    
    # Admin: eliminar fichaje (soft delete)
```

**`@api_router.delete("/fichajes/admin/eliminar/{fichaje_id}")`**
```python
    async def fichajes_admin_eliminar(
        fichaje_id: str,
        user: dict = Depends(require_permission("fichajes.manage")),
    ):
        fichaje = await db.fichajes.find_one({"id": fichaje_id})
        if not fichaje:
            raise HTTPException(404, "Fichaje no encontrado")
    
        await db.fichajes.update_one(
            {"id": fichaje_id},
            {"$set": {"deleted": True, "deleted_by": user["id"], "deleted_at": datetime.now(timezone.utc).isoformat()}},
        )
        return {"ok": True}
    
    # Admin: exportar CSV
```

**`@api_router.get("/fichajes/admin/exportar")`**
```python
    async def fichajes_admin_exportar(
        desde: str = Query(...),
        hasta: str = Query(...),
        user_id: Optional[str] = Query(None),
        user: dict = Depends(require_permission("fichajes.manage")),
    ):
        query: dict = {
            "deleted": {"$ne": True},
            "entrada": {"$gte": desde + "T00:00:00", "$lte": hasta + "T23:59:59"},
        }
        if user_id:
            query["user_id"] = user_id
    
        users_map = {}
        async for u in db.users.find({}, {"_id": 0, "id": 1, "name": 1, "email": 1}):
            users_map[u["id"]] = u.get("name") or u.get("email", "")
    
        rows = []
        async for f in db.fichajes.find(query, {"_id": 0}).sort("entrada", 1):
            rows.append(f)
    
        csv_lines = ["Usuario,Fecha,Entrada,Salida,Total,Tipo"]
        for r in rows:
            nombre = users_map.get(r["user_id"], r["user_id"])
            fecha = r.get("entrada", "")[:10] if r.get("entrada") else ""
            entrada = r.get("entrada", "")[11:16] if r.get("entrada") else ""
            salida = r.get("salida", "")[11:16] if r.get("salida") else ""
            total = _calcular_total(r.get("entrada"), r.get("salida"))
            tipo = r.get("tipo", "presencial")
            csv_lines.append(f"{nombre},{fecha},{entrada},{salida},{total},{tipo}")
    
        return Response(
            content="\n".join(csv_lines),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=fichajes_{desde}_{hasta}.csv"},
        )
    
    # Admin: listar vacaciones
```

**`@api_router.get("/fichajes/admin/vacaciones")`**
```python
    async def fichajes_admin_vacaciones(
        user_id: Optional[str] = Query(None),
        user: dict = Depends(require_permission("fichajes.manage")),
    ):
        query: dict = {}
        if user_id:
            query["user_id"] = user_id
    
        vacs = []
        async for v in db.vacaciones.find(query, {"_id": 0}).sort("fecha_inicio", -1):
            target = await db.users.find_one({"id": v["user_id"]}, {"_id": 0, "name": 1, "email": 1})
            v["user_name"] = (target.get("name") or target.get("email", "")) if target else v.get("user_id", "")
            vacs.append(v)
    
        return vacs
    
    # Admin: gestionar vacacion (aprobar/rechazar)
```

**`@api_router.put("/fichajes/admin/vacaciones/{vac_id}")`**
```python
    async def fichajes_admin_vacaciones_gestionar(
        vac_id: str,
        body: VacacionGestionIn,
        user: dict = Depends(require_permission("fichajes.manage")),
    ):
        vac = await db.vacaciones.find_one({"id": vac_id})
        if not vac:
            raise HTTPException(404, "Solicitud no encontrada")
    
        await db.vacaciones.update_one(
            {"id": vac_id},
            {"$set": {"estado": body.estado, "gestionado_por": user["id"], "gestionado_at": datetime.now(timezone.utc).isoformat()}},
        )
        return {"ok": True}
    
    
    # ── Vacaciones (usuario) ──
    class VacacionIn(BaseModel):
        fecha_inicio: str
        fecha_fin: str
        tipo: str = "vacaciones"
        motivo: Optional[str] = None
    
```

**`@api_router.get("/vacaciones")`**
```python
    async def vacaciones_listar(
        estado: Optional[str] = None,
        user: dict = Depends(require_permission("fichajes.view")),
    ):
        uid = user["id"]
        q = {"user_id": uid}
        if estado:
            q["estado"] = estado
        vacs = []
        async for v in db.vacaciones.find(q, {"_id": 0}).sort("created_at", -1):
            vacs.append({
                "id": v["id"],
                "user_id": v["user_id"],
                "fecha_inicio": v.get("fecha_inicio"),
                "fecha_fin": v.get("fecha_fin"),
                "tipo": v.get("tipo", "vacaciones"),
                "motivo": v.get("motivo"),
                "estado": v.get("estado", "pendiente"),
                "created_at": v.get("created_at"),
            })
        return vacs
    
```


---

## 2. Frontend — 

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, TextInput, Platform, RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api, clearToken, COLORS } from "../src/api";
import ResponsiveLayout from "../src/ResponsiveLayout";
import { useBreakpoint } from "../src/useBreakpoint";
import IOSHeader from "../src/ui/IOSHeader";
import { useThemedStyles } from "../src/theme";
import { ios } from "../src/ui/iosTheme";



const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const DAYS_MONTH = ["L", "M", "X", "J", "V", "S", "D"];

function pad(n: number): string { return String(n).padStart(2, "0"); }
function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function fmtTimeNow(): string {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

type Tab = "fichar" | "vacaciones" | "mensual";

export default function FichajesScreen() {
  const router = useRouter();
  const { isWide } = useBreakpoint();
  const s = useThemedStyles(useS);
  const [tab, setTab] = useState<Tab>("fichar");
  const [me, setMe] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [fichajesHoy, setFichajesHoy] = useState<any[]>([]);
  const [horaActual, setHoraActual] = useState(fmtTimeNow());
  const [ubicacion, setUbicacion] = useState<{lat: number; lng: number} | null>(null);
  const [saldoDias, setSaldoDias] = useState<any>(null);
  const [vacacionesList, setVacacionesList] = useState<any[]>([]);
  const [fichajesMes, setFichajesMes] = useState<any[]>([]);
  const [fichajesAnio, setFichajesAnio] = useState<any[]>([]);
  const [config, setConfig] = useState<any>(null);

  // Vacaciones form
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [tipoSolicitud, setTipoSolicitud] = useState<"vacaciones" | "ausencia">("vacaciones");
  const [motivo, setMotivo] = useState("");

  // Calendario
  const [anchorMonth, setAnchorMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const hoyDia = useMemo(() => todayISO(), []);

  // Editar fichajes
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editEntrada, setEditEntrada] = useState("");
  const [editSalida, setEditSalida] = useState("");
  const limiteAno = useMemo(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    return d;
  }, []);

  const perms: string[] = (me?.permissions as string[]) || [];
  const has = (p: string) => perms.includes(p);
  const isAdmin = me?.role === "admin" || has("fichajes.manage");

  // Reloj en tiempo real
  useEffect(() => {
    const t = setInterval(() => setHoraActual(fmtTimeNow()), 1000);
    return () => clearInterval(t);
  }, []);

  const syncOfflineFichajes = useCallback(async () => {}, []);

  useEffect(() => {
  }, [syncOfflineFichajes]);

  const getLocation = async () => {
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUbicacion({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {},
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 60000 }
      );
    }
  };

  useFocusEffect(useCallback(() => {
    let alive = true;
    (async () => {
      try {
        const u = await api.me();
        if (!alive) return;
        setMe(u);
        await Promise.all([cargarFichajesHoy(), cargarVacaciones(), cargarConfig(), cargarResumen()]);
      } catch (e: any) {
        if (/401|Invalid|expired/i.test(e?.message || "")) {
          await clearToken();
          router.replace("/login");
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []));

  async function cargarFichajesHoy() {
    try {
      const hoy = todayISO();
      const items = await api.fichajesListar(undefined, `${hoy}T00:00:00`, `${hoy}T23:59:59`);
      setFichajesHoy(items || []);
    } catch {}
  }

  async function cargarFichajesMes() {
    const d = new Date(anchorMonth);
    const inicio = new Date(d.getFullYear(), d.getMonth(), 1);
    const fin = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
    const from = inicio.toISOString();
    const to = fin.toISOString();
    try {
      const items = await api.fichajesListar(undefined, from, to);
      setFichajesMes(items || []);
    } catch {}
  }

  async function cargarVacaciones() {
    try {
      if (!me?.id) return;
      const [lista, saldo] = await Promise.all([
        api.vacacionesListar(),
        api.vacacionesSaldo(me.id),
      ]);
      setVacacionesList(lista || []);
      setSaldoDias(saldo);
    } catch {}
  }

  async function cargarConfig() {
    try {
      const c = await api.configFichajes();
      setConfig(c);
    } catch {}
  }

  async function cargarResumen() {
    try {
      const ahora = new Date();
      const inicioAnio = `${ahora.getFullYear()}-01-01T00:00:00`;
      const finHoy = ahora.toISOString();
      const items = await api.fichajesListar(undefined, inicioAnio, finHoy);
      setFichajesAnio(items || []);
    } catch {}
  }

  // Resumen semanal / mensual / anual
  const resumenHoras = useMemo(() => {
    const ahora = new Date();
    const inicioSemana = new Date(ahora);
    inicioSemana.setDate(ahora.getDate() - (ahora.getDay() === 0 ? 6 : ahora.getDay() - 1));
    inicioSemana.setHours(0, 0, 0, 0);
    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);

    let minSemana = 0, minMes = 0, minAnio = 0;
    const diasSemana = new Set<string>();
    const diasMes = new Set<string>();
    const diasAnio = new Set<string>();

    for (const f of fichajesAnio) {
      if (!f.entrada) continue;
      const fechaDia = f.fecha || "";
      if (!fechaDia) continue;

      const d = new Date(fechaDia + "T00:00:00");
      let minutos = 0;
      if (f.entrada && f.salida) {
        const [h, m2] = (f.total || "0h 0m").replace("h ", ":").split(":");
        minutos = (parseInt(h) || 0) * 60 + (parseInt(m2) || 0);
      }

      if (d >= inicioSemana) { minSemana += minutos; if (minutos > 0) diasSemana.add(fechaDia); }
      if (d >= inicioMes) { minMes += minutos; if (minutos > 0) diasMes.add(fechaDia); }
      minAnio += minutos;
      if (minutos > 0) diasAnio.add(fechaDia);
    }

    return {
      semana: { horas: `${Math.floor(minSemana / 60)}h ${minSemana % 60}m`, dias: diasSemana.size },
      mes: { horas: `${Math.floor(minMes / 60)}h ${minMes % 60}m`, dias: diasMes.size },
      anio: { horas: `${Math.floor(minAnio / 60)}h ${minAnio % 60}m`, dias: diasAnio.size },
    };
  }, [fichajesAnio]);

  async function fichar(tipo: string) {
     try {
      await getLocation();
      await api.fichajeCrear({
        tipo,
        lat: ubicacion?.lat,
        lng: ubicacion?.lng,
        dispositivo: Platform.OS === "web" ? "web" : "mobile",
      });
      await cargarFichajesHoy();
      cargarResumen();
      Alert.alert("Fichaje registrado", `${tipo.replace("_", " ").toUpperCase()} registrado a las ${fmtTimeNow()}`);
    } catch (e: any) {
      Alert.alert("Error", e.message || "No se pudo crear el fichaje");
    }
  }

  async function editarFichaje(fichajeId: string) {
    try {
      await api.fichajeEditar(fichajeId, editEntrada || undefined, editSalida || undefined);
      setEditingId(null);
      await Promise.all([cargarFichajesHoy(), cargarResumen(), cargarFichajesMes()]);
    } catch (e: any) {
      Alert.alert("Error", e.message || "No se pudo editar el fichaje");
    }
  }

  async function borrarFichaje(fichajeId: string) {
    Alert.alert("Borrar fichaje", "¿Eliminar este registro?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Borrar", style: "destructive", onPress: async () => {
        try {
          await api.fichajeEliminar(fichajeId);
          await Promise.all([cargarFichajesHoy(), cargarResumen(), cargarFichajesMes()]);
        } catch (e: any) { Alert.alert("Error", e.message); }
      }},
    ]);
  }

  const puedeEditar = has("fichajes.edit_own") || has("fichajes.manage") || me?.role === "admin";

  async function solicitarVacaciones() {
    if (!fechaInicio || !fechaFin) {
      Alert.alert("Faltan datos", "Selecciona las fechas");
      return;
    }
    try {
      await api.vacacionesSolicitar({
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        tipo: tipoSolicitud,
        motivo,
      });
      setFechaInicio("");
      setFechaFin("");
      setMotivo("");
      await cargarVacaciones();
      Alert.alert("Enviada", "Solicitud enviada correctamente");
    } catch (e: any) {
      Alert.alert("Error", e.message || "No se pudo gestionar");
    }
  }

  // Cambiar mes
  function mesAnterior() {
    const target = new Date(anchorMonth.getFullYear(), anchorMonth.getMonth() - 1, 1);
    if (target >= limiteAno) { setAnchorMonth(target); setSelectedDay(null); }
  }
  function mesSiguiente() {
    const hoy = new Date();
    const target = new Date(anchorMonth.getFullYear(), anchorMonth.getMonth() + 1, 1);
    if (target <= new Date(hoy.getFullYear(), hoy.getMonth(), 1)) { setAnchorMonth(target); setSelectedDay(null); }
  }

  useEffect(() => { cargarFichajesMes(); }, [anchorMonth]);

  // Agrupar fichajes por dia para el calendario
  const fichajesPorDia = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const f of fichajesMes) {
      const dia = f.fecha || "";
      if (dia) {
        if (!map[dia]) map[dia] = [];
        map[dia].push(f);
      }
    }
    return map;
  }, [fichajesMes]);

  // Dias del calendario
  const vacacionesPorDia = useMemo(() => {
    const map: Record<string, string> = {};
    for (const v of vacacionesList) {
      const ini = new Date(v.fecha_inicio + "T00:00:00");
      const fin = new Date(v.fecha_fin + "T00:00:00");
      for (let d = new Date(ini); d <= fin; d.setDate(d.getDate() + 1)) {
        const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        map[key] = v.estado;
      }
    }
    return map;
  }, [vacacionesList]);

  const calendarioDias = useMemo(() => {
    const a = anchorMonth.getFullYear();
    const m = anchorMonth.getMonth();
    const primerDia = new Date(a, m, 1);
    const inicio = new Date(primerDia);
    inicio.setDate(inicio.getDate() - (primerDia.getDay() === 0 ? 6 : primerDia.getDay() - 1));

    const dias = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(inicio);
      d.setDate(d.getDate() + i);
      const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const enMes = d.getMonth() === m;
      const fichajesDia = fichajesPorDia[key] || [];
      const horasTotal = fichajesDia.reduce((sum, f) => {
        if (!f.entrada || !f.salida) return sum;
        const [h, mm] = (f.total || "0h 0m").replace("h ", ":").split(":");
        return sum + (parseInt(h) || 0) * 60 + (parseInt(mm) || 0);
      }, 0);
      const tieneEntrada = fichajesDia.some((f) => f.entrada);
      const tieneSalida = fichajesDia.some((f) => f.salida);
      const festivos = config?.festivos || [];
      const esFestivo = festivos.includes(key);
      const vacStatus = vacacionesPorDia[key];
      dias.push({
        key, dia: d.getDate(), enMes,
        fichajes: fichajesDia,
        horas: horasTotal > 0 ? `${Math.floor(horasTotal / 60)}h ${horasTotal % 60}m` : null,
        tieneEntrada, tieneSalida,
        esFestivo, vacStatus,
      });
    }
    return dias;
  }, [anchorMonth, fichajesPorDia, config, vacacionesPorDia]);

  // Totales del mes visible
  const totalesMes = useMemo(() => {
    let totalMin = 0;
    let diasSet = new Set<string>();
    for (const f of fichajesMes) {
      if (f.entrada) diasSet.add(f.fecha || "");
      if (f.entrada && f.salida) {
        const [h, m2] = (f.total || "0h 0m").replace("h ", ":").split(":");
        totalMin += (parseInt(h) || 0) * 60 + (parseInt(m2) || 0);
      }
    }
    return {
      horas: `${Math.floor(totalMin / 60)}h ${totalMin % 60}m`,
      dias: diasSet.size,
    };
  }, [fichajesMes]);

  const tipoLegible: Record<string, string> = {
    entrada: "Entrada",
    salida: "Salida",
    inicio_pausa: "Inicio pausa",
    fin_pausa: "Fin pausa",
  };

  const estadoIcon: Record<string, { color: string; icon: string }> = {
    pendiente: { color: ios.colors.yellow, icon: "time" },
    aprobada: { color: ios.colors.green, icon: "checkmark-circle" },
    rechazada: { color: ios.colors.red, icon: "close-circle" },
  };

  const content = (
    <SafeAreaView style={s.root} edges={isWide ? [] : ["top"]}>
      {!isWide && <IOSHeader title={"Fichajes"} showBack />}
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={COLORS.primary} />
      ) : (
        <View style={s.body}>
          {/* Tabs */}
          <View style={s.tabs}>
            {(["fichar", "vacaciones", "mensual"] as Tab[]).map((tabKey) => (
              <TouchableOpacity
                key={tabKey}
                style={[s.tab, tab === tabKey && s.tabActive]}
                onPress={() => setTab(tabKey)}
              >
                <Ionicons
                  name={tabKey === "fichar" ? "time" : tabKey === "vacaciones" ? "umbrella" : "calendar"}
                  size={16}
                  color={tab === tabKey ? COLORS.primary : COLORS.textSecondary}
                />
                <Text style={[s.tabLabel, tab === tabKey && s.tabLabelActive]}>
                  {tabKey === "fichar" ? "Fichar" : tabKey === "vacaciones" ? "Vacaciones" : "Mensual"}
                </Text>
              </TouchableOpacity>
            ))}
            {isAdmin && (
              <TouchableOpacity
                style={[s.tab, s.tabAdmin]}
                onPress={() => router.push("/fichajes/admin" as any)}
              >
                <Ionicons name="settings" size={16} color={COLORS.accent} />
                <Text style={[s.tabLabel, { color: COLORS.accent }]}>{"Admin"}</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* === FICHAR === */}
          {tab === "fichar" && (
            <ScrollView contentContainerStyle={s.ficharWrap} refreshControl={<RefreshControl refreshing={loading} onRefresh={cargarFichajesHoy} />}>
              {/* Reloj grande */}
              <View style={s.relojCard}>
                <Text style={s.relojLabel}>{"Hora actual"}</Text>
                <Text style={s.relojTiempo}>{horaActual}</Text>
                <Text style={s.relojFecha}>
                  {new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                </Text>
              </View>

              {/* Botones de fichar */}
              <View style={s.botonesRow}>
                <TouchableOpacity style={[s.btnFichaje, s.btnEntrada]} onPress={() => fichar("entrada")} activeOpacity={0.7}>
                  <Ionicons name="enter" size={28} color="#fff" />
                  <Text style={s.btnFichajeTxt}>{"Entrada"}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.btnFichaje, s.btnSalida]} onPress={() => fichar("salida")} activeOpacity={0.7}>
                  <Ionicons name="exit" size={28} color="#fff" />
                  <Text style={s.btnFichajeTxt}>{"Salida"}</Text>
                </TouchableOpacity>
              </View>
              <View style={s.botonesRow}>
                <TouchableOpacity style={[s.btnFichaje, s.btnPausa]} onPress={() => fichar("inicio_pausa")} activeOpacity={0.7}>
                  <Ionicons name="pause" size={28} color="#fff" />
                  <Text style={s.btnFichajeTxt}>{"Pausa"}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.btnFichaje, s.btnFinPausa]} onPress={() => fichar("fin_pausa")} activeOpacity={0.7}>
                  <Ionicons name="play" size={28} color="#fff" />
                  <Text style={s.btnFichajeTxt}>{"Fin pausa"}</Text>
                </TouchableOpacity>
              </View>

              {/* Ubicacion */}
              {ubicacion && (
                <View style={s.ubicacionRow}>
                  <Ionicons name="location" size={14} color={COLORS.primary} />
                  <Text style={s.ubicacionTxt}>
                    {ubicacion.lat.toFixed(5)}, {ubicacion.lng.toFixed(5)}
                  </Text>
                </View>
              )}

              {/* Resumen semanal / mensual / anual */}
              <View style={s.resumenRow}>
                <View style={[s.resumenCard, { borderLeftColor: ios.colors.green }]}>
                  <Text style={s.resumenHoras}>{resumenHoras.semana.horas}</Text>
                  <Text style={s.resumenLabel}>{"Semanal"}</Text>
                  <Text style={s.resumenDias}>{resumenHoras.semana.dias}{" días"}</Text>
                </View>
                <View style={[s.resumenCard, { borderLeftColor: COLORS.primary }]}>
                  <Text style={s.resumenHoras}>{resumenHoras.mes.horas}</Text>
                  <Text style={s.resumenLabel}>{"Mensual"}</Text>
                  <Text style={s.resumenDias}>{resumenHoras.mes.dias}{" días"}</Text>
                </View>
                <View style={[s.resumenCard, { borderLeftColor: ios.colors.indigo }]}>
                  <Text style={s.resumenHoras}>{resumenHoras.anio.horas}</Text>
                  <Text style={s.resumenLabel}>{"Anual"}</Text>
                  <Text style={s.resumenDias}>{resumenHoras.anio.dias}{" días"}</Text>
                </View>
              </View>

              {/* Fichajes de hoy */}
              <Text style={s.seccionTitulo}>{"Fichajes de hoy"}</Text>
              {fichajesHoy.length === 0 ? (
                <Text style={s.emptyText}>{"Sin fichajes"}</Text>
              ) : (
                fichajesHoy.map((f) => (
                  <View key={f.id} style={s.fichajeRow}>
                    <View style={[s.fichajeDot, { backgroundColor: f.tipo === "entrada" || f.tipo === "fin_pausa" ? ios.colors.green : f.tipo === "salida" || f.tipo === "inicio_pausa" ? ios.colors.red : ios.colors.yellow }]} />
                    <Text style={s.fichajeTipo}>{tipoLegible[f.tipo] || f.tipo}</Text>
                    {editingId === f.id ? (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <TextInput style={s.editInput} value={editEntrada} onChangeText={setEditEntrada} placeholder="HH:MM" placeholderTextColor={COLORS.textDisabled} />
                        <Text style={{ color: COLORS.textDisabled, fontSize: 12 }}>-</Text>
                        <TextInput style={s.editInput} value={editSalida} onChangeText={setEditSalida} placeholder="HH:MM" placeholderTextColor={COLORS.textDisabled} />
                        <TouchableOpacity onPress={() => editarFichaje(f.id)}><Ionicons name="checkmark" size={18} color={ios.colors.green} /></TouchableOpacity>
                        <TouchableOpacity onPress={() => setEditingId(null)}><Ionicons name="close" size={18} color={ios.colors.red} /></TouchableOpacity>
                      </View>
                    ) : (
                      <Text style={s.fichajeHora}>{f.hora}</Text>
                    )}
                    {f.fuera_horario && (
                      <View style={s.fueraPill}>
                        <Text style={s.fueraPillTxt}>{"Fuera de horario"}</Text>
                      </View>
                    )}
                    {puedeEditar && editingId !== f.id && f.id && (
                      <View style={{ flexDirection: "row", gap: 6, marginLeft: "auto" }}>
                        <TouchableOpacity onPress={() => { setEditingId(f.id); setEditEntrada(f.entrada ? f.entrada.slice(11, 16) : ""); setEditSalida(f.salida ? f.salida.slice(11, 16) : ""); }}>
                          <Ionicons name="create-outline" size={16} color={COLORS.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => borrarFichaje(f.id)}>
                          <Ionicons name="trash-outline" size={16} color={ios.colors.red} />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                ))
              )}
            </ScrollView>
          )}

          {/* === VACACIONES === */}
          {tab === "vacaciones" && (
            <ScrollView contentContainerStyle={s.vacacionesWrap} refreshControl={<RefreshControl refreshing={loading} onRefresh={cargarVacaciones} />}>
              {/* Saldo */}
              {saldoDias && (
                <View style={s.saldoCard}>
                  <Ionicons name="calendar" size={24} color={COLORS.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.saldoTitulo}>{"Dias disponibles"}</Text>
                    <Text style={s.saldoNum}>{saldoDias.dias_disponibles} / {saldoDias.dias_anuales}</Text>
                    <View style={s.saldoBarraBg}>
                      <View style={[s.saldoBarra, { width: `${Math.min(100, ((saldoDias.dias_usados || 0) / saldoDias.dias_anuales) * 100)}%` }]} />
                    </View>
                    <Text style={s.saldoUsados}>{saldoDias.dias_usados}{" usados"}</Text>
                  </View>
                </View>
              )}

              {/* Formulario */}
              <Text style={s.seccionTitulo}>{"Fichajes de hoy"}</Text>
              <View style={s.formCard}>
                <View style={s.tipoRow}>
                  <TouchableOpacity
                    style={[s.tipoBtn, tipoSolicitud === "vacaciones" && s.tipoBtnActive]}
                    onPress={() => setTipoSolicitud("vacaciones")}
                  >
                    <Ionicons name="umbrella" size={16} color={tipoSolicitud === "vacaciones" ? "#fff" : COLORS.textSecondary} />
                    <Text style={[s.tipoBtnTxt, tipoSolicitud === "vacaciones" && { color: "#fff" }]}>{"Vacaciones"}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.tipoBtn, tipoSolicitud === "ausencia" && s.tipoBtnActive]}
                    onPress={() => setTipoSolicitud("ausencia")}
                  >
                    <Ionicons name="medkit" size={16} color={tipoSolicitud === "ausencia" ? "#fff" : COLORS.textSecondary} />
                    <Text style={[s.tipoBtnTxt, tipoSolicitud === "ausencia" && { color: "#fff" }]}>{"Ausencia"}</Text>
                  </TouchableOpacity>
                </View>
                <Text style={s.inputLabel}>{"Fecha inicio"}</Text>
                <TextInput style={s.input} placeholder="YYYY-MM-DD" value={fechaInicio} onChangeText={setFechaInicio} placeholderTextColor={COLORS.textDisabled} />
                <Text style={s.inputLabel}>{"Fecha fin"}</Text>
                <TextInput style={s.input} placeholder="YYYY-MM-DD" value={fechaFin} onChangeText={setFechaFin} placeholderTextColor={COLORS.textDisabled} />
                <Text style={s.inputLabel}>{"Motivo"}</Text>
                <TextInput style={[s.input, s.inputMulti]} placeholder="Motivo de la solicitud..." value={motivo} onChangeText={setMotivo} multiline placeholderTextColor={COLORS.textDisabled} />
                <TouchableOpacity style={s.solicitarBtn} onPress={solicitarVacaciones} activeOpacity={0.7}>
                  <Text style={s.solicitarBtnTxt}>{"Enviar solicitud"}</Text>
                </TouchableOpacity>
              </View>

              {/* Historial */}
              <Text style={s.seccionTitulo}>{"Historial"}</Text>
              {vacacionesList.length === 0 ? (
                <Text style={s.emptyText}>{"Sin fichajes"}</Text>
              ) : (
                vacacionesList.map((v) => {
                  const e = estadoIcon[v.estado] || { color: COLORS.textSecondary, icon: "help-circle" };
                  return (
                    <View key={v.id} style={s.vacRow}>
                      <Ionicons name={e.icon as any} size={20} color={e.color} />
                      <View style={{ flex: 1 }}>
                        <Text style={s.vacTxt}>
                          {v.tipo === "vacaciones" ? "Vacaciones" : "Ausencia"}: {v.fecha_inicio} a {v.fecha_fin}
                        </Text>
                        {v.motivo ? <Text style={s.vacMotivo}>{v.motivo}</Text> : null}
                      </View>
                      <View style={[s.estadoPill, { backgroundColor: e.color + "20" }]}>
                        <Text style={[s.estadoPillTxt, { color: e.color }]}>{v.estado}</Text>
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>
          )}

          {/* === MENSUAL === */}
          {tab === "mensual" && (
            <ScrollView contentContainerStyle={s.calWrap} refreshControl={<RefreshControl refreshing={loading} onRefresh={cargarFichajesMes} />}>
              {/* Navegación mes */}
              <View style={s.calNav}>
                <TouchableOpacity onPress={mesAnterior} disabled={anchorMonth <= limiteAno} style={anchorMonth <= limiteAno && { opacity: 0.3 }}>
                  <Ionicons name="chevron-back" size={20} color={COLORS.text} />
                </TouchableOpacity>
                <Text style={s.calNavTitulo}>{MONTHS[anchorMonth.getMonth()]} {anchorMonth.getFullYear()}</Text>
                <TouchableOpacity onPress={mesSiguiente} disabled={anchorMonth >= new Date(new Date().getFullYear(), new Date().getMonth(), 1)} style={anchorMonth >= new Date(new Date().getFullYear(), new Date().getMonth(), 1) && { opacity: 0.3 }}>
                  <Ionicons name="chevron-forward" size={20} color={COLORS.text} />
                </TouchableOpacity>
              </View>

              {/* Totales */}
              <View style={s.mesTotales}>
                <View style={s.mesTotalCard}>
                  <Text style={s.mesTotalVal}>{totalesMes.horas}</Text>
                  <Text style={s.mesTotalLbl}>{"Horas mes"}</Text>
                </View>
                <View style={s.mesTotalCard}>
                  <Text style={s.mesTotalVal}>{totalesMes.dias}</Text>
                  <Text style={s.mesTotalLbl}>{"Días"}</Text>
                </View>
              </View>

              {/* Calendario */}
              <View style={s.calGridWrap}>
                <View style={s.calSemanaRow}>
                  {DAYS_MONTH.map((dd) => (
                    <View key={dd} style={s.calSemanaCell}>
                      <Text style={s.calSemanaTxt}>{dd}</Text>
                    </View>
                  ))}
                </View>
                <View style={s.calGrid}>
                  {calendarioDias.map((d) => {
                    const isToday = d.key === hoyDia;
                    const isSelected = d.key === selectedDay;
                    const completo = d.tieneEntrada && d.tieneSalida;
                    const incompleto = d.tieneEntrada && !d.tieneSalida;
                    let bg = "transparent";
                    if (isSelected) bg = COLORS.primary + "18";
                    else if (d.vacStatus === "aprobada") bg = "#10B98130";
                    else if (d.vacStatus === "pendiente") bg = "#8B5CF630";
                    else if (d.vacStatus === "rechazada") bg = "#EF444430";
                    else if (d.esFestivo) bg = ios.colors.red + "10";
                    else if (incompleto) bg = ios.colors.yellow + "18";
                    else if (completo) bg = ios.colors.green + "12";

                    return (
                      <TouchableOpacity
                        key={d.key}
                        style={[
                          s.calDay, { height: isWide ? 42 : 36 },
                          { backgroundColor: bg },
                          isToday && { borderColor: COLORS.primary, borderWidth: 2 },
                          !d.enMes && { opacity: 0.25 },
                        ]}
                        onPress={() => d.enMes && setSelectedDay(d.key === selectedDay ? null : d.key)}
                        activeOpacity={0.6}
                      >
                        <Text style={[
                          s.calDayNum,
                          isToday && { color: COLORS.primary, fontWeight: "800" },
                          d.esFestivo && { color: ios.colors.red },
                          !d.enMes && { color: COLORS.textDisabled },
                        ]}>{d.dia}</Text>
                        <View style={{ flexDirection: "row", gap: 1, flexWrap: "wrap", justifyContent: "center" }}>
                          {d.fichajes.filter((f: any) => f.entrada && f.salida).map((f: any, fi: number) => (
                            <View key={fi} style={[s.calDayDot, { backgroundColor: f.tipo === "entrada" || f.tipo === "fin_pausa" ? ios.colors.green : ios.colors.orange }]} />
                          ))}
                        </View>
                        {d.horas && (
                          <Text style={s.calDayHoras}>{d.horas}</Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Detalle día seleccionado */}
              {selectedDay && (
                <View style={s.dayDetailWrap}>
                  <View style={s.dayDetailHeader}>
                    <Text style={s.dayDetailTitulo}>{selectedDay}</Text>
                    <TouchableOpacity onPress={() => setSelectedDay(null)}>
                      <Ionicons name="close" size={18} color={COLORS.textSecondary} />
                    </TouchableOpacity>
                  </View>
                  {(fichajesPorDia[selectedDay] || []).length === 0 ? (
                    <Text style={s.emptyText}>{"Sin fichajes este día"}</Text>
                  ) : (
                    <View style={s.tablaWrap}>
                      <View style={s.tablaHRow}>
                        <Text style={[s.tablaH, { flex: 1 }]}>{"Tipo"}</Text>
                        <Text style={[s.tablaH, { flex: 1 }]}>{"Entrada"}</Text>
                        <Text style={[s.tablaH, { flex: 1 }]}>{"Salida"}</Text>
                        <Text style={[s.tablaH, { width: 55 }]}>{"Total"}</Text>
                        <Text style={[s.tablaH, { width: 24 }]}>{""}</Text>
                      </View>
                      {(fichajesPorDia[selectedDay] || []).map((f: any, idx: number) => {
                        const esHoy = selectedDay === todayISO();
                        return (
                        <View key={f.id || idx} style={[s.tablaRow, idx % 2 === 0 && { backgroundColor: COLORS.readonly }]}>
                          <Text style={[s.tablaTd, { flex: 1 }]}>{tipoLegible[f.tipo] || f.tipo}</Text>
                          {editingId === f.id ? (
                            <>
                              <TextInput style={[s.tablaTd, s.editInputSmall, { flex: 1 }]} value={editEntrada} onChangeText={setEditEntrada} placeholder="HH:MM" placeholderTextColor={COLORS.textDisabled} />
                              <TextInput style={[s.tablaTd, s.editInputSmall, { flex: 1 }]} value={editSalida} onChangeText={setEditSalida} placeholder="HH:MM" placeholderTextColor={COLORS.textDisabled} />
                              <Text style={[s.tablaTd, { width: 55 }]}>{f.total}</Text>
                              <View style={{ width: 50, flexDirection: "row", gap: 4 }}>
                                <TouchableOpacity onPress={() => editarFichaje(f.id)}><Ionicons name="checkmark" size={16} color={ios.colors.green} /></TouchableOpacity>
                                <TouchableOpacity onPress={() => setEditingId(null)}><Ionicons name="close" size={16} color={ios.colors.red} /></TouchableOpacity>
                              </View>
                            </>
                          ) : (
                            <>
                              <Text style={[s.tablaTd, { flex: 1 }]}>{f.entrada ? f.entrada.slice(11, 16) : "-"}</Text>
                              <Text style={[s.tablaTd, { flex: 1 }]}>{f.salida ? f.salida.slice(11, 16) : "-"}</Text>
                              <Text style={[s.tablaTd, { width: 55 }]}>{f.total}</Text>
                              <View style={{ width: 50, flexDirection: "row", gap: 4, alignItems: "center" }}>
                                {puedeEditar && f.id && (
                                  <>
                                    <TouchableOpacity onPress={() => { setEditingId(f.id); setEditEntrada(f.entrada ? f.entrada.slice(11, 16) : ""); setEditSalida(f.salida ? f.salida.slice(11, 16) : ""); }}>
                                      <Ionicons name="create-outline" size={14} color={COLORS.primary} />
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => borrarFichaje(f.id)}>
                                      <Ionicons name="trash-outline" size={14} color={ios.colors.red} />
                                    </TouchableOpacity>
                                  </>
                                )}
                                {(!puedeEditar && esHoy && f.id) && (
                                  <TouchableOpacity onPress={() => borrarFichaje(f.id)}>
                                    <Ionicons name="trash-outline" size={14} color={ios.colors.red} />
                                  </TouchableOpacity>
                                )}
                              </View>
                            </>
                          )}
                        </View>
                      )})}
                    </View>
                  )}
                </View>
              )}

              {/* Leyenda */}
              <View style={s.leyenda}>
                <View style={s.leyendaItem}>
                  <View style={[s.leyendaDot, { backgroundColor: ios.colors.green }]} />
                  <Text style={s.leyendaTxt}>{"Completado"}</Text>
                </View>
                <View style={s.leyendaItem}>
                  <View style={[s.leyendaDot, { backgroundColor: ios.colors.yellow }]} />
                  <Text style={s.leyendaTxt}>{"Pendiente"}</Text>
                </View>
                {config?.festivos?.length > 0 && (
                  <View style={s.leyendaItem}>
                    <View style={[s.leyendaDot, { backgroundColor: ios.colors.red }]} />
                    <Text style={s.leyendaTxt}>{config.festivos.length}{" festivos"}</Text>
                  </View>
                )}
              </View>
            </ScrollView>
          )}
        </View>
      )}
    </SafeAreaView>
  );

  return (
    <ResponsiveLayout active="fichajes">
      {content}
    </ResponsiveLayout>
  );
}

const useS = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  body: { flex: 1 },

  // Tabs
  tabs: { flexDirection: "row", paddingHorizontal: 12, paddingVertical: 10, gap: 6, borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: COLORS.surface },
  tab: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: COLORS.bg },
  tabActive: { backgroundColor: COLORS.primarySoft },
  tabAdmin: { marginLeft: "auto", backgroundColor: "transparent", borderWidth: 1, borderColor: COLORS.accent + "40" },
  tabLabel: { fontSize: 12, fontWeight: "600", color: COLORS.textSecondary },
  tabLabelActive: { color: COLORS.primary },

  // Fichar
  ficharWrap: { padding: 16, gap: 16 },
  relojCard: { alignItems: "center", padding: 28, borderRadius: ios.radius.card, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, ...ios.shadow.card },
  relojLabel: { fontSize: 13, color: COLORS.textSecondary, fontWeight: "500", textTransform: "uppercase", letterSpacing: 1 },
  relojTiempo: { fontSize: 48, fontWeight: "800", color: COLORS.text, fontFamily: Platform.OS === "web" ? "'SF Mono', 'Menlo', monospace" : "monospace", letterSpacing: 2, marginTop: 4 },
  relojFecha: { fontSize: 14, color: COLORS.textSecondary, marginTop: 6, textTransform: "capitalize" },

  botonesRow: { flexDirection: "row", gap: 12 },
  btnFichaje: { flex: 1, paddingVertical: 22, borderRadius: ios.radius.card, alignItems: "center", gap: 8, borderWidth: 1, borderColor: "transparent", ...ios.shadow.card },
  btnEntrada: { backgroundColor: ios.colors.green },
  btnSalida: { backgroundColor: ios.colors.red },
  btnPausa: { backgroundColor: ios.colors.yellow },
  btnFinPausa: { backgroundColor: ios.colors.indigo },
  btnFichajeTxt: { fontSize: 14, fontWeight: "700", color: "#fff", letterSpacing: 1 },

  ubicacionRow: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: COLORS.surface, borderRadius: 8, padding: 10, borderWidth: 1, borderColor: COLORS.border },
  ubicacionTxt: { fontSize: 12, color: COLORS.textSecondary, fontFamily: Platform.OS === "web" ? "'SF Mono', monospace" : "monospace" },

  seccionTitulo: { fontSize: 16, fontWeight: "700", color: COLORS.text, marginTop: 8 },

  resumenRow: { flexDirection: "row", gap: 8 },
  resumenCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 12,
    borderLeftWidth: 3,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    gap: 2,
  },
  resumenHoras: { fontSize: 18, fontWeight: "800", color: COLORS.text },
  resumenLabel: { fontSize: 10, color: COLORS.textDisabled, fontWeight: "500", textTransform: "uppercase", letterSpacing: 0.5 },
  resumenDias: { fontSize: 10, color: COLORS.textSecondary },

  emptyText: { fontSize: 13, color: COLORS.textDisabled, fontStyle: "italic", padding: 12 },

  fichajeRow: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.surface, borderRadius: 10, padding: 12, gap: 10, borderWidth: 1, borderColor: COLORS.border },
  fichajeDot: { width: 10, height: 10, borderRadius: 5 },
  fichajeTipo: { fontSize: 13, fontWeight: "600", color: COLORS.text, flex: 1 },
  fichajeHora: { fontSize: 13, fontWeight: "500", color: COLORS.textSecondary, fontFamily: Platform.OS === "web" ? "'SF Mono', monospace" : "monospace" },
  fueraPill: { backgroundColor: ios.colors.orange + "20", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  fueraPillTxt: { fontSize: 10, fontWeight: "600", color: ios.colors.orange },

  // Vacaciones
  vacacionesWrap: { padding: 16, gap: 16 },
  saldoCard: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: COLORS.surface, borderRadius: ios.radius.card, padding: 18, borderWidth: 1, borderColor: COLORS.border, ...ios.shadow.card },
  saldoTitulo: { fontSize: 13, color: COLORS.textSecondary, fontWeight: "500" },
  saldoNum: { fontSize: 26, fontWeight: "800", color: COLORS.text, marginTop: 2 },
  saldoBarraBg: { height: 6, backgroundColor: COLORS.border, borderRadius: 3, marginTop: 6, overflow: "hidden" },
  saldoBarra: { height: 6, backgroundColor: COLORS.primary, borderRadius: 3 },
  saldoUsados: { fontSize: 11, color: COLORS.textDisabled, marginTop: 3 },

  formCard: { backgroundColor: COLORS.surface, borderRadius: ios.radius.card, padding: 18, borderWidth: 1, borderColor: COLORS.border, gap: 10 },
  tipoRow: { flexDirection: "row", gap: 8 },
  tipoBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border },
  tipoBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tipoBtnTxt: { fontSize: 13, fontWeight: "600", color: COLORS.textSecondary },
  inputLabel: { fontSize: 12, fontWeight: "600", color: COLORS.textSecondary },
  input: { backgroundColor: COLORS.bg, borderRadius: 8, padding: 12, fontSize: 14, color: COLORS.text, borderWidth: 1, borderColor: COLORS.border },
  inputMulti: { minHeight: 70, textAlignVertical: "top" },
  solicitarBtn: { backgroundColor: COLORS.primary, borderRadius: 10, paddingVertical: 14, alignItems: "center" },
  solicitarBtnTxt: { fontSize: 14, fontWeight: "700", color: "#fff" },

  vacRow: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.surface, borderRadius: 10, padding: 12, gap: 10, borderWidth: 1, borderColor: COLORS.border },
  vacTxt: { fontSize: 13, fontWeight: "500", color: COLORS.text },
  vacMotivo: { fontSize: 11, color: COLORS.textDisabled, marginTop: 2 },
  estadoPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  estadoPillTxt: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },

  // Calendario
  calWrap: { padding: 12, gap: 10 },
  calNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: COLORS.surface, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: COLORS.border },
  calNavTitulo: { fontSize: 15, fontWeight: "700", color: COLORS.text, textTransform: "capitalize" },

  mesTotales: { flexDirection: "row", gap: 6 },
  mesTotalCard: { flex: 1, alignItems: "center", padding: 10, backgroundColor: COLORS.surface, borderRadius: 10, gap: 2, borderWidth: 1, borderColor: COLORS.border },
  mesTotalVal: { fontSize: 17, fontWeight: "800", color: COLORS.text },
  mesTotalLbl: { fontSize: 10, color: COLORS.textDisabled, fontWeight: "500" },

  calGridWrap: { backgroundColor: COLORS.surface, borderRadius: 10, padding: 6, borderWidth: 1, borderColor: COLORS.border },
  calSemanaRow: { flexDirection: "row", marginBottom: 2 },
  calSemanaCell: { width: "14.28%", alignItems: "center", paddingVertical: 3 },
  calSemanaTxt: { fontSize: 9, fontWeight: "700", color: COLORS.textDisabled, textTransform: "uppercase" },
  calGrid: { flexDirection: "row", flexWrap: "wrap" },
  calDay: { width: "14.28%", alignItems: "center", justifyContent: "center", borderRadius: 5, padding: 2, borderWidth: 1, borderColor: "transparent" },
  calDayOut: { opacity: 0.3 },
  calDayFestivo: { backgroundColor: ios.colors.red + "10" },
  calDayNum: { fontSize: 11, fontWeight: "600", color: COLORS.text },
  calDayNumOut: { color: COLORS.textDisabled },
  calDayDot: { width: 3, height: 3, borderRadius: 1.5 },
  calDayHoras: { fontSize: 7, fontWeight: "700", color: COLORS.primary, marginTop: 1 },

  dayDetailWrap: { backgroundColor: COLORS.surface, borderRadius: 10, padding: 12, gap: 8, borderWidth: 1, borderColor: COLORS.border },
  dayDetailHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  dayDetailTitulo: { fontSize: 14, fontWeight: "700", color: COLORS.text },

  tablaWrap: { gap: 2 },
  tablaHRow: { flexDirection: "row", backgroundColor: COLORS.primarySoft, paddingVertical: 6, paddingHorizontal: 8, borderRadius: 8 },
  tablaH: { fontSize: 10, fontWeight: "700", color: COLORS.text, textTransform: "uppercase" },
  tablaRow: { flexDirection: "row", alignItems: "center", paddingVertical: 6, paddingHorizontal: 8 },
  tablaTd: { fontSize: 11, color: COLORS.text },
  editInput: {
    backgroundColor: COLORS.surface,
    borderRadius: 4,
    padding: 4,
    paddingHorizontal: 6,
    fontSize: 12,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.primary,
    fontFamily: Platform.OS === "web" ? "'SF Mono', monospace" : "monospace",
    width: 55,
    textAlign: "center",
  },
  editInputSmall: {
    backgroundColor: COLORS.surface,
    borderRadius: 4,
    padding: 2,
    paddingHorizontal: 4,
    fontSize: 10,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.primary,
    fontFamily: Platform.OS === "web" ? "'SF Mono', monospace" : "monospace",
  },

  leyenda: { backgroundColor: COLORS.surface, borderRadius: 10, padding: 14, gap: 8, borderWidth: 1, borderColor: COLORS.border, marginTop: 12 },
  leyendaItem: { flexDirection: "row", alignItems: "center", gap: 8 },
  leyendaDot: { width: 8, height: 8, borderRadius: 4 },
  leyendaTxt: { fontSize: 12, color: COLORS.textSecondary },
});

---

## 3. Frontend — 

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, TextInput, Platform, FlatList, Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api, clearToken, COLORS } from "../../src/api";
import ResponsiveLayout from "../../src/ResponsiveLayout";
import { useBreakpoint } from "../../src/useBreakpoint";
import IOSHeader from "../../src/ui/IOSHeader";
import { useThemedStyles } from "../../src/theme";
import { ios } from "../../src/ui/iosTheme";


function pad(n: number): string { return String(n).padStart(2, "0"); }

function hoyStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function haceUnAno(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function mesesDropdown(): { label: string; desde: string; hasta: string }[] {
  const items: { label: string; desde: string; hasta: string }[] = [];
  const hoy = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    const desde = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
    const ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const hasta = `${ultimo.getFullYear()}-${pad(ultimo.getMonth() + 1)}-${pad(ultimo.getDate())}`;
    items.push({ label: `${MESES[d.getMonth()]} ${d.getFullYear()}`, desde, hasta });
  }
  return items;
}

export default function FichajesAdminScreen() {
  const t = { fichajes: { admin: "Admin", gestionar: "Gestionar", exportar: "Exportar", crear: "Crear", eliminar: "Eliminar", editar: "Editar", usuario: "Usuario", fecha: "Fecha", entrada: "Entrada", salida: "Salida", horas: "Horas", estado: "Estado", vacaciones: "Vacaciones", solicitudes: "Solicitudes" } };
  const router = useRouter();
  const { isWide } = useBreakpoint();
  const s = useThemedStyles(useS);
  const [me, setMe] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [tab, setTab] = useState<"resumen" | "detalle" | "vacaciones" | "exportar">("resumen");

  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [busqueda, setBusqueda] = useState("");

  const [selectedUserId, setSelectedUserId] = useState("");
  const [detalle, setDetalle] = useState<any>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editEntrada, setEditEntrada] = useState("");
  const [editSalida, setEditSalida] = useState("");

  const [modalVisible, setModalVisible] = useState(false);
  const [nuevoFecha, setNuevoFecha] = useState(() => hoyStr());
  const [nuevoEntrada, setNuevoEntrada] = useState("09:00");
  const [nuevoSalida, setNuevoSalida] = useState("18:00");

  const [vacaciones, setVacaciones] = useState<any[]>([]);
  const [vacLoading, setVacLoading] = useState(false);

  const [exportUsuario, setExportUsuario] = useState("");
  const [exportDesde, setExportDesde] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
  });
  const [exportHasta, setExportHasta] = useState(() => hoyStr());
  const [exportPreview, setExportPreview] = useState<any[]>([]);
  const [exportMesSel, setExportMesSel] = useState(-1);

  const [kpiUsuarios, setKpiUsuarios] = useState({ total: 0, fichadosHoy: 0, horasMes: "0h" });

  // Calendario para el detalle
  const [anchorMonth, setAnchorMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [fichajesMes, setFichajesMes] = useState<any[]>([]);
  const [mesLoading, setMesLoading] = useState(false);
  const MESES_CAL = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const DIAS_SEMANA = ["L", "M", "X", "J", "V", "S", "D"];

  const hoyDia = new Date();
  const limiteAno = new Date(hoyDia.getFullYear() - 1, hoyDia.getMonth(), 1);
  const today = useMemo(() => `${hoyDia.getFullYear()}-${pad(hoyDia.getMonth() + 1)}-${pad(hoyDia.getDate())}`, []);

  const usuariosFiltrados = useMemo(() => {
    const q = busqueda.toLowerCase().trim();
    if (!q) return usuarios;
    return usuarios.filter(
      (u) => (u.name || "").toLowerCase().includes(q) || (u.email || "").toLowerCase().includes(q)
    );
  }, [usuarios, busqueda]);

  useFocusEffect(useCallback(() => {
    let alive = true;
    (async () => {
      try {
        const u = await api.me();
        if (!alive) return;
        setMe(u);
        if (u?.role !== "admin" && !(u?.permissions || []).includes("fichajes.manage")) {
          router.replace("/fichajes");
          return;
        }
        await cargarUsuarios();
      } catch (e: any) {
        if (/401|Invalid|expired/i.test(e?.message || "")) {
          await clearToken();
          router.replace("/login");
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []));

  async function cargarUsuarios() {
    try {
      const data = await api.fichajesAdminUsuarios();
      setUsuarios(data || []);
      const fichadosHoy = (data || []).filter((u: any) => u.hoy?.entrada).length;
      let totalMinMes = 0;
      for (const u of data || []) {
        const m = u.mes?.match(/(\d+)h\s*(\d+)m/);
        if (m) totalMinMes += parseInt(m[1]) * 60 + parseInt(m[2]);
      }
      setKpiUsuarios({
        total: (data || []).length,
        fichadosHoy,
        horasMes: `${Math.floor(totalMinMes / 60)}h ${Math.round(totalMinMes % 60)}m`,
      });
    } catch {}
  }

  // Cargar todos los fichajes del mes para el usuario seleccionado
  async function cargarFichajesMes(userId: string, mes: Date) {
    if (!userId) return;
    setMesLoading(true);
    const a = mes.getFullYear();
    const m = mes.getMonth();
    const desde = `${a}-${pad(m + 1)}-01`;
    const hasta = `${a}-${pad(m + 1)}-${pad(new Date(a, m + 1, 0).getDate())}`;
    try {
      const d = await api.fichajesAdminDetalle(userId, desde, hasta);
      setFichajesMes((d as any)?.fichajes || []);
      setDetalle(d);
    } catch (e: any) {
      Alert.alert("Error", e.message || "Error al cargar el mes");
    } finally {
      setMesLoading(false);
    }
  }

  useEffect(() => {
    if (selectedUserId && tab === "detalle") {
      cargarFichajesMes(selectedUserId, anchorMonth);
    }
  }, [selectedUserId, anchorMonth, tab]);

  // Agrupar fichajes por dia para el calendario
  const fichajesPorDia = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const f of fichajesMes) {
      const dia = f.fecha || "";
      if (dia) {
        if (!map[dia]) map[dia] = [];
        map[dia].push(f);
      }
    }
    return map;
  }, [fichajesMes]);

  // Construir la cuadrícula del calendario
  const calendarioDias = useMemo(() => {
    const a = anchorMonth.getFullYear();
    const m = anchorMonth.getMonth();
    const primerDia = new Date(a, m, 1);
    const ultimoDia = new Date(a, m + 1, 0);
    const inicio = new Date(primerDia);
    inicio.setDate(inicio.getDate() - (primerDia.getDay() === 0 ? 6 : primerDia.getDay() - 1));

    const dias = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(inicio);
      d.setDate(d.getDate() + i);
      const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const enMes = d.getMonth() === m;
      const fichajesDia = fichajesPorDia[key] || [];
      const horas = fichajesDia.reduce((sum, f) => {
        if (!f.entrada || !f.salida) return sum;
        const [h, m2] = (f.total || "0h 0m").replace("h ", ":").split(":");
        return sum + (parseInt(h) || 0) * 60 + (parseInt(m2) || 0);
      }, 0);
      dias.push({
        key,
        dia: d.getDate(),
        enMes,
        fichajes: fichajesDia,
        horas: horas > 0 ? `${Math.floor(horas / 60)}h ${horas % 60}m` : null,
        tieneEntrada: fichajesDia.some((f) => f.entrada),
        tieneSalida: fichajesDia.some((f) => f.salida),
      });
    }
    return dias;
  }, [anchorMonth, fichajesPorDia]);

  function mesAnterior() {
    const target = new Date(anchorMonth.getFullYear(), anchorMonth.getMonth() - 1, 1);
    if (target >= limiteAno) setAnchorMonth(target);
  }
  function mesSiguiente() {
    const target = new Date(anchorMonth.getFullYear(), anchorMonth.getMonth() + 1, 1);
    if (target <= new Date(hoyDia.getFullYear(), hoyDia.getMonth(), 1)) setAnchorMonth(target);
  }

  async function guardarEdicion(fichajeId: string) {
    try {
      await api.fichajesAdminEditar(fichajeId, editEntrada || null, editSalida || null);
      setEditingId(null);
      if (selectedUserId) cargarFichajesMes(selectedUserId, anchorMonth);
    } catch (e: any) {
      Alert.alert("Error", e.message || "Error al realizar la operación");
    }
  }

  async function eliminarFichaje(fichajeId: string) {
    Alert.alert("Eliminar fichaje", "¿Seguro que quieres eliminar este fichaje?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar", style: "destructive",
        onPress: async () => {
          try {
            await api.fichajesAdminEliminar(fichajeId);
            cargarFichajesMes(selectedUserId, anchorMonth);
          } catch (e: any) {
            Alert.alert("Error", e.message || "Error al realizar la operación");
          }
        },
      },
    ]);
  }

  async function crearFichaje() {
    try {
      await api.fichajesAdminCrear(selectedUserId, nuevoFecha, nuevoEntrada, nuevoSalida);
      setModalVisible(false);
      cargarFichajesMes(selectedUserId, anchorMonth);
      cargarUsuarios();
    } catch (e: any) {
      Alert.alert("Error", e.message || "Error al realizar la operación");
    }
  }

  async function cargarVacaciones() {
    setVacLoading(true);
    try {
      const data = await api.fichajesAdminVacaciones();
      setVacaciones(data || []);
    } catch {}
    finally {
      setVacLoading(false);
    }
  }

  async function gestionarVacacion(vacId: string, estado: "aprobada" | "rechazada") {
    try {
      await api.fichajesAdminVacacionesGestionar(vacId, estado);
      cargarVacaciones();
    } catch (e: any) {
      Alert.alert("Error", e.message || "Error al realizar la operación");
    }
  }

  async function previewExportar() {
    try {
      const csv = await api.fichajesAdminExportar(exportDesde, exportHasta, exportUsuario || undefined);
      const lines = csv.split("\n").filter(Boolean);
      const headers = lines[0].split(",");
      const rows = lines.slice(1).map((l) => {
        const vals = l.split(",");
        const obj: any = {};
        headers.forEach((h, i) => { obj[h] = vals[i] || ""; });
        return obj;
      });
      setExportPreview(rows);
    } catch (e: any) {
      Alert.alert("Error", e.message || "Error al realizar la operación");
    }
  }

  async function descargarCSV() {
    try {
      const csv = await api.fichajesAdminExportar(exportDesde, exportHasta, exportUsuario || undefined);
      if (typeof document !== "undefined") {
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `fichajes_${exportDesde}_${exportHasta}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 15000);
      }
    } catch (e: any) {
      Alert.alert("Error", e.message || "Error al realizar la operación");
    }
  }

  useEffect(() => {
    if (tab === "vacaciones") cargarVacaciones();
  }, [tab]);

  useEffect(() => {
    if (tab === "exportar" && exportMesSel >= 0) {
      const m = mesesDropdown()[exportMesSel];
      if (m) {
        setExportDesde(m.desde);
        setExportHasta(m.hasta);
      }
    }
  }, [exportMesSel, tab]);

  if (loading) {
    return (
    <ResponsiveLayout active="fichajes-admin">
        <SafeAreaView style={s.root} edges={isWide ? [] : ["top"]}>
          <ActivityIndicator style={{ marginTop: 60 }} color={COLORS.primary} />
        </SafeAreaView>
      </ResponsiveLayout>
    );
  }

  const selectedUser = usuarios.find((u) => u.id === selectedUserId);

  const calDayH = isWide ? 42 : 36;
  const calDayNumS = isWide ? 12 : 11;
  const calHourS = isWide ? 8 : 7;

  const content = (
    <SafeAreaView style={s.root} edges={isWide ? [] : ["top"]}>
      {!isWide && <IOSHeader title={"Admin Fichajes"} showBack backLabel={"Fichajes"} />}

      <View style={s.headerBar}>
        {isWide && (
          <TouchableOpacity onPress={() => { if (router.canGoBack()) router.back(); else router.replace("/fichajes"); }} style={s.headerBack} activeOpacity={0.6}>
            <Ionicons name="arrow-back" size={20} color={COLORS.textSecondary} />
            <Text style={s.headerBackLabel}>{"Fichajes"}</Text>
          </TouchableOpacity>
        )}
        <Text style={s.headerTitle}>{"Gestión de fichajes"}</Text>
      </View>

      <View style={s.kpiRow}>
        <View style={s.kpiCard}>
          <Ionicons name="people" size={18} color={ios.colors.indigo} />
          <Text style={s.kpiVal}>{kpiUsuarios.total}</Text>
          <Text style={s.kpiLabel}>{"Usuarios"}</Text>
        </View>
        <View style={s.kpiCard}>
          <Ionicons name="time" size={18} color={ios.colors.green} />
          <Text style={s.kpiVal}>{kpiUsuarios.fichadosHoy}</Text>
          <Text style={s.kpiLabel}>{"Fichados hoy"}</Text>
        </View>
        <View style={s.kpiCard}>
          <Ionicons name="hourglass" size={18} color={ios.colors.orange} />
          <Text style={s.kpiVal}>{kpiUsuarios.horasMes}</Text>
          <Text style={s.kpiLabel}>{"Horas mes"}</Text>
        </View>
      </View>

      <View style={s.tabs}>
        {(["resumen", "detalle", "vacaciones", "exportar"] as const).map((tabKey) => (
          <TouchableOpacity
            key={tabKey}
            style={[s.tabBtn, tab === tabKey && s.tabBtnActive]}
            onPress={() => setTab(tabKey)}
          >
            <Text style={[s.tabBtnTxt, tab === tabKey && s.tabBtnTxtActive]}>
              {tabKey === "resumen" ? "Resumen" : tabKey === "detalle" ? "Detalle" : tabKey === "vacaciones" ? "Vacaciones" : "Exportar"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">

        {/* TAB 1: Resumen */}
        {tab === "resumen" && (
          <View style={{ gap: 12 }}>
            <TextInput
              style={s.searchInput}
              value={busqueda}
              onChangeText={setBusqueda}
              placeholder={"Buscar usuario..."}
              placeholderTextColor={COLORS.textDisabled}
            />
            {usuariosFiltrados.map((u) => (
              <TouchableOpacity
                key={u.id}
                style={s.userRow}
                onPress={() => { setSelectedUserId(u.id); setTab("detalle"); }}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1 }}>
                  <Text style={s.userName}>{u.name}</Text>
                  <Text style={s.userEmail}>{u.email}</Text>
                </View>
                <View style={s.userStats}>
                  <View style={s.statItem}>
                    <Text style={s.statLabel}>{"Hoy"}</Text>
                    <Text style={[s.statVal, u.hoy?.entrada ? { color: ios.colors.green } : { color: COLORS.textDisabled }]}>
                      {u.hoy?.entrada || "-"} / {u.hoy?.salida || "-"}
                    </Text>
                  </View>
                  <View style={s.statItem}>
                    <Text style={s.statLabel}>{"Semana"}</Text>
                    <Text style={s.statVal}>{u.semana}</Text>
                  </View>
                  <View style={s.statItem}>
                    <Text style={s.statLabel}>{"Mes"}</Text>
                    <Text style={s.statVal}>{u.mes}</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={COLORS.textDisabled} />
              </TouchableOpacity>
            ))}
            {usuariosFiltrados.length === 0 && (
              <Text style={s.emptyText}>{"Sin datos"}</Text>
            )}
          </View>
        )}

        {/* TAB 2: Detalle — Calendario */}
        {tab === "detalle" && (
          <View style={{ gap: 8 }}>
            {/* Selector usuario */}
            <View style={s.formRow}>
              <Text style={s.formLabel}>{"Usuario"}</Text>
              <View style={s.pickerWrap}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {usuarios.map((u) => (
                    <TouchableOpacity
                      key={u.id}
                      style={[s.chip, selectedUserId === u.id && s.chipActive]}
                      onPress={() => { setSelectedUserId(u.id); setSelectedDay(null); }}
                    >
                      <Text style={[s.chipText, selectedUserId === u.id && { color: "#fff" }]}>{u.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>

            {!selectedUserId ? (
              <Text style={s.emptyText}>{"Selecciona un usuario para ver su calendario"}</Text>
            ) : (
              <>
                {/* Navegación mes */}
                <View style={[s.calNav, !isWide && { paddingHorizontal: 8, paddingVertical: 4 }]}>
                  <TouchableOpacity onPress={mesAnterior} disabled={anchorMonth <= limiteAno} style={anchorMonth <= limiteAno && { opacity: 0.3 }}>
                    <Ionicons name="chevron-back" size={isWide ? 20 : 16} color={COLORS.text} />
                  </TouchableOpacity>
                  <Text style={[s.calNavTitulo, !isWide && { fontSize: 13 }]}>
                    {MESES_CAL[anchorMonth.getMonth()]} {anchorMonth.getFullYear()}
                  </Text>
                  <TouchableOpacity onPress={mesSiguiente} disabled={anchorMonth >= new Date(hoyDia.getFullYear(), hoyDia.getMonth(), 1)} style={anchorMonth >= new Date(hoyDia.getFullYear(), hoyDia.getMonth(), 1) && { opacity: 0.3 }}>
                    <Ionicons name="chevron-forward" size={isWide ? 20 : 16} color={COLORS.text} />
                  </TouchableOpacity>
                </View>

                {mesLoading ? (
                  <ActivityIndicator color={COLORS.primary} style={{ marginTop: 20 }} />
                ) : (
                  <>
                    {/* Totales del mes */}
                    <View style={[s.totalesRow, { gap: isWide ? 4 : 2 }]}>
                      <View style={[s.totalCard, { padding: isWide ? 8 : 5, borderRadius: 8 }]}>
                        <Text style={[s.totalVal, { fontSize: isWide ? 16 : 13 }]}>{detalle?.totales?.horas_trabajadas || "0h"}</Text>
                        <Text style={[s.totalLbl, { fontSize: isWide ? 9 : 8 }]}>{"Horas mes"}</Text>
                      </View>
                      <View style={[s.totalCard, { padding: isWide ? 8 : 5, borderRadius: 8 }]}>
                        <Text style={[s.totalVal, { fontSize: isWide ? 16 : 13 }]}>{detalle?.totales?.dias_trabajados || 0}</Text>
                        <Text style={[s.totalLbl, { fontSize: isWide ? 9 : 8 }]}>{"Días"}</Text>
                      </View>
                      <View style={[s.totalCard, { padding: isWide ? 8 : 5, borderRadius: 8 }]}>
                        <Text style={[s.totalVal, { fontSize: isWide ? 16 : 13 }]}>{detalle?.totales?.vacaciones || 0}</Text>
                        <Text style={[s.totalLbl, { fontSize: isWide ? 9 : 8 }]}>{"Vacaciones"}</Text>
                      </View>
                    </View>

                    {/* Calendario */}
                    <View style={[s.calGridWrap, !isWide && { padding: 3, borderRadius: 8 }]}>
                      <View style={[s.calSemanaRow, !isWide && { marginBottom: 0 }]}>
                        {DIAS_SEMANA.map((dd) => (
                          <View key={dd} style={[s.calSemanaCell, !isWide && { paddingVertical: 1 }]}>
                            <Text style={[s.calSemanaTxt, !isWide && { fontSize: 8 }]}>{dd}</Text>
                          </View>
                        ))}
                      </View>
                      <View style={s.calGrid}>
                        {calendarioDias.map((d) => {
                          const isToday = d.key === today.current;
                          const isSelected = d.key === selectedDay;
                          const tieneDatos = d.tieneEntrada && d.tieneSalida;
                          const incompleto = d.tieneEntrada && !d.tieneSalida;
                          let bg = "transparent";
                          if (isSelected) bg = COLORS.primary + "18";
                          else if (incompleto) bg = ios.colors.yellow + "18";
                          else if (tieneDatos) bg = ios.colors.green + "12";

                          return (
                            <TouchableOpacity
                              key={d.key}
                              style={[
                                s.calDay,
                                { height: calDayH },
                                isToday && { borderColor: COLORS.primary, borderWidth: 1.5 },
                                !d.enMes && { opacity: 0.25 },
                                { backgroundColor: bg },
                              ]}
                              onPress={() => {
                                if (d.enMes) setSelectedDay(d.key);
                              }}
                              activeOpacity={0.6}
                            >
                              <Text style={[
                                s.calDayNum,
                                { fontSize: calDayNumS },
                                isToday && { color: COLORS.primary, fontWeight: "800" },
                                !d.enMes && { color: COLORS.textDisabled },
                              ]}>{d.dia}</Text>
                              <View style={{ flexDirection: "row", gap: 1, flexWrap: "wrap", justifyContent: "center" }}>
                                {d.fichajes.filter((f: any) => f.entrada && f.salida).map((f: any, fi: number) => (
                                  <View key={fi} style={[s.calDayDot, { backgroundColor: f.tipo === "entrada" || f.tipo === "fin_pausa" ? ios.colors.green : ios.colors.orange }]} />
                                ))}
                              </View>
                              {d.horas && (
                                <Text style={[s.calDayHoras, { fontSize: calHourS }]}>{d.horas}</Text>
                              )}
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>

                    {/* Detalle del día seleccionado */}
                    {selectedDay && (
                      <View style={[s.dayDetailWrap, !isWide && { maxHeight: 220 }]}>
                        <View style={s.dayDetailHeader}>
                          <Text style={s.dayDetailTitulo}>{selectedDay}</Text>
                          <TouchableOpacity onPress={() => { setSelectedDay(null); }}>
                            <Ionicons name="close" size={18} color={COLORS.textSecondary} />
                          </TouchableOpacity>
                        </View>
                        <View style={s.detalleHeader}>
                          <TouchableOpacity style={s.addBtn} onPress={() => { setNuevoFecha(selectedDay); setModalVisible(true); }} activeOpacity={0.7}>
                            <Ionicons name="add" size={16} color="#fff" />
                            <Text style={s.addBtnText}>{"Añadir"}</Text>
                          </TouchableOpacity>
                        </View>
                        {(fichajesPorDia[selectedDay] || []).length === 0 ? (
                          <Text style={s.emptyText}>{"Sin fichajes este día"}</Text>
                        ) : (
                          <View style={s.tablaWrap}>
                            <View style={s.tablaHRow}>
                              <Text style={[s.tablaH, { flex: 1 }]}>{"Entrada"}</Text>
                              <Text style={[s.tablaH, { flex: 1 }]}>{"Salida"}</Text>
                              <Text style={[s.tablaH, { width: 60 }]}>{"Total"}</Text>
                              <Text style={[s.tablaH, { width: 70 }]}>{""}</Text>
                            </View>
                            {(fichajesPorDia[selectedDay] || []).map((f: any, idx: number) => (
                              <View key={f.id || idx} style={[s.tablaRow, idx % 2 === 0 && { backgroundColor: COLORS.readonly }]}>
                                {editingId === f.id ? (
                                  <>
                                    <TextInput style={[s.tablaTd, s.inputInline, { flex: 1 }]} value={editEntrada} onChangeText={setEditEntrada} placeholder="--:--" placeholderTextColor={COLORS.textDisabled} />
                                    <TextInput style={[s.tablaTd, s.inputInline, { flex: 1 }]} value={editSalida} onChangeText={setEditSalida} placeholder="--:--" placeholderTextColor={COLORS.textDisabled} />
                                    <Text style={[s.tablaTd, { width: 60 }]}>{f.total}</Text>
                                    <View style={[{ width: 70, flexDirection: "row", gap: 8 }]}>
                                      <TouchableOpacity onPress={() => guardarEdicion(f.id)}><Ionicons name="checkmark" size={18} color={ios.colors.green} /></TouchableOpacity>
                                      <TouchableOpacity onPress={() => setEditingId(null)}><Ionicons name="close" size={18} color={ios.colors.red} /></TouchableOpacity>
                                    </View>
                                  </>
                                ) : (
                                  <>
                                    <Text style={[s.tablaTd, { flex: 1 }]}>{f.entrada || "-"}</Text>
                                    <Text style={[s.tablaTd, { flex: 1 }]}>{f.salida || "-"}</Text>
                                    <Text style={[s.tablaTd, { width: 60 }]}>{f.total}</Text>
                                    <View style={[{ width: 70, flexDirection: "row", gap: 8 }]}>
                                      <TouchableOpacity onPress={() => { setEditingId(f.id); setEditEntrada(f.entrada || ""); setEditSalida(f.salida || ""); }}>
                                        <Ionicons name="create-outline" size={16} color={COLORS.primary} />
                                      </TouchableOpacity>
                                      <TouchableOpacity onPress={() => eliminarFichaje(f.id)}>
                                        <Ionicons name="trash-outline" size={16} color={ios.colors.red} />
                                      </TouchableOpacity>
                                    </View>
                                  </>
                                )}
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    )}
                  </>
                )}
              </>
            )}
          </View>
        )}

        {/* TAB 3: Vacaciones */}
        {tab === "vacaciones" && (
          <View style={{ gap: 12 }}>
            {vacLoading ? (
              <ActivityIndicator color={COLORS.primary} style={{ marginTop: 20 }} />
            ) : (
              <>
                <Text style={s.seccionTit}>{"Pendientes de aprobar"}</Text>
                {vacaciones.filter((v) => v.estado === "pendiente").length === 0 ? (
                  <Text style={s.emptyText}>{"Sin datos"}</Text>
                ) : (
                  vacaciones.filter((v) => v.estado === "pendiente").map((v) => (
                    <View key={v.id} style={s.vacCard}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.vacUser}>{v.user_name || v.user_id}</Text>
                        <Text style={s.vacFechas}>
                          {v.tipo === "vacaciones" ? "Vacaciones" : "Ausencia"}: {v.fecha_inicio} → {v.fecha_fin} ({v.dias || "?"}{" días"})
                        </Text>
                        {v.motivo ? <Text style={s.vacMotivo}>{v.motivo}</Text> : null}
                      </View>
                      <View style={s.vacBtns}>
                        <TouchableOpacity style={[s.vacBtn, { backgroundColor: ios.colors.green }]} onPress={() => gestionarVacacion(v.id, "aprobada")}>
                          <Ionicons name="checkmark" size={18} color="#fff" />
                        </TouchableOpacity>
                        <TouchableOpacity style={[s.vacBtn, { backgroundColor: ios.colors.red }]} onPress={() => gestionarVacacion(v.id, "rechazada")}>
                          <Ionicons name="close" size={18} color="#fff" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                )}

                <Text style={[s.seccionTit, { marginTop: 8 }]}>{"Historial de solicitudes"}</Text>
                {vacaciones.filter((v) => v.estado !== "pendiente").length === 0 ? (
                  <Text style={s.emptyText}>{"Sin datos"}</Text>
                ) : (
                  vacaciones.filter((v) => v.estado !== "pendiente").map((v) => (
                    <View key={v.id} style={[s.vacCard, v.estado === "aprobada" ? s.vacAprobada : s.vacRechazada]}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.vacUser}>{v.user_name || v.user_id}</Text>
                        <Text style={s.vacFechas}>
                          {v.tipo === "vacaciones" ? "Vacaciones" : "Ausencia"}: {v.fecha_inicio} → {v.fecha_fin}
                        </Text>
                      </View>
                      <View style={[s.estadoChip, v.estado === "aprobada" ? s.estadoAprob : s.estadoRech]}>
                        <Text style={s.estadoChipText}>{v.estado}</Text>
                      </View>
                    </View>
                  ))
                )}
              </>
            )}
          </View>
        )}

        {/* TAB 4: Exportar */}
        {tab === "exportar" && (
          <View style={{ gap: 14 }}>
            <Text style={s.seccionTit}>{"Exportar fichajes"}</Text>

            <View style={s.formCard}>
              <Text style={s.formLabel}>{"Mes"}:</Text>
              <View style={s.pickerWrap}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {mesesDropdown().map((m, i) => (
                    <TouchableOpacity
                      key={i}
                      style={[s.chip, exportMesSel === i && s.chipActive]}
                      onPress={() => setExportMesSel(i)}
                    >
                      <Text style={[s.chipText, exportMesSel === i && { color: "#fff" }]}>{m.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <Text style={s.formLabel}>{"Período"}:</Text>
              <View style={s.formRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.formLabelSm}>{"Desde"}</Text>
                  <TextInput
                    style={s.input}
                    value={exportDesde}
                    onChangeText={setExportDesde}
                    placeholder={"YYYY-MM-DD"}
                    placeholderTextColor={COLORS.textDisabled}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.formLabelSm}>{"Hasta"}</Text>
                  <TextInput
                    style={s.input}
                    value={exportHasta}
                    onChangeText={setExportHasta}
                    placeholder={"YYYY-MM-DD"}
                    placeholderTextColor={COLORS.textDisabled}
                  />
                </View>
              </View>

              <Text style={s.formLabel}>{"Usuario"}:</Text>              <View style={s.pickerWrap}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  <TouchableOpacity
                    style={[s.chip, !exportUsuario && s.chipActive]}
                    onPress={() => setExportUsuario("")}
                  >
                    <Text style={[s.chipText, !exportUsuario && { color: "#fff" }]}>{"Todos"}</Text>
                  </TouchableOpacity>
                  {usuarios.map((u) => (
                    <TouchableOpacity
                      key={u.id}
                      style={[s.chip, exportUsuario === u.id && s.chipActive]}
                      onPress={() => setExportUsuario(u.id)}
                    >
                      <Text style={[s.chipText, exportUsuario === u.id && { color: "#fff" }]}>{u.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity style={s.btnOutline} onPress={previewExportar} activeOpacity={0.7}>
                  <Ionicons name="eye" size={16} color={COLORS.primary} />
                  <Text style={s.btnOutlineText}>{"Previsualizar"}</Text>
                </TouchableOpacity>
                {typeof document !== "undefined" && (
                  <TouchableOpacity style={s.btnPrimary} onPress={descargarCSV} activeOpacity={0.7}>
                    <Ionicons name="download" size={16} color="#fff" />
                    <Text style={s.btnPrimaryText}>{"Descargar CSV"}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {exportPreview.length > 0 && (
              <View style={{ gap: 8 }}>
                <Text style={s.seccionTit}>{"Vista previa"} ({exportPreview.length} {"Vista previa"})</Text>
                <ScrollView horizontal>
                  <View>
                    <View style={s.tablaHRow}>
                      {Object.keys(exportPreview[0] || {}).map((k) => (
                        <Text key={k} style={[s.tablaH, { width: 110 }]}>{k}</Text>
                      ))}
                    </View>
                    {exportPreview.slice(0, 20).map((row, i) => (
                      <View key={i} style={[s.tablaRow, i % 2 === 0 && { backgroundColor: COLORS.readonly }]}>
                        {Object.values(row).map((v: any, j) => (
                          <Text key={j} style={[s.tablaTd, { width: 110 }]}>{String(v)}</Text>
                        ))}
                      </View>
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}
          </View>
        )}

      </ScrollView>

      {/* Modal crear fichaje */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>{"Nuevo fichaje"}</Text>
            <Text style={s.modalSub}>
              {"Crear fichaje para"} {selectedUser?.name || selectedUserId}
            </Text>

            <Text style={s.formLabel}>{"Fecha"}</Text>
            <TextInput
              style={s.input}
              value={nuevoFecha}
              onChangeText={setNuevoFecha}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={COLORS.textDisabled}
            />

            <Text style={s.formLabel}>{"Hora entrada"}</Text>
            <TextInput
              style={s.input}
              value={nuevoEntrada}
              onChangeText={setNuevoEntrada}
              placeholder="HH:MM"
              placeholderTextColor={COLORS.textDisabled}
            />

            <Text style={s.formLabel}>{"Hora salida"}</Text>
            <TextInput
              style={s.input}
              value={nuevoSalida}
              onChangeText={setNuevoSalida}
              placeholder="HH:MM"
              placeholderTextColor={COLORS.textDisabled}
            />

            <View style={s.modalBtns}>
              <TouchableOpacity
                style={s.btnOutline}
                onPress={() => setModalVisible(false)}
              >
                <Text style={s.btnOutlineText}>{"Cancelar"}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.btnPrimary} onPress={crearFichaje}>
                <Text style={s.btnPrimaryText}>{"Crear"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );

  return (
    <ResponsiveLayout active="fichajes">
      {content}
    </ResponsiveLayout>
  );
}

const useS = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },

  headerBar: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text,
  },
  headerBack: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingRight: 8,
  },
  headerBackLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: "500",
  },

  kpiRow: {
    flexDirection: "row",
    padding: 10,
    gap: 8,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  kpiCard: {
    flex: 1,
    alignItems: "center",
    padding: 10,
    backgroundColor: COLORS.bg,
    borderRadius: 10,
    gap: 2,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  kpiVal: { fontSize: 18, fontWeight: "800", color: COLORS.text },
  kpiLabel: { fontSize: 10, color: COLORS.textDisabled, fontWeight: "500" },

  tabs: {
    flexDirection: "row",
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tabBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: COLORS.bg,
  },
  tabBtnActive: { backgroundColor: COLORS.primary },
  tabBtnTxt: { fontSize: 12, fontWeight: "600", color: COLORS.textSecondary },
  tabBtnTxtActive: { color: "#fff" },

  body: { padding: 14, paddingBottom: 60 },

  searchInput: {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  userRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  userName: { fontSize: 15, fontWeight: "700", color: COLORS.text },
  userEmail: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  userStats: {
    flexDirection: "row",
    gap: 10,
    paddingRight: 4,
  },
  statItem: { alignItems: "center", gap: 2 },
  statLabel: { fontSize: 9, color: COLORS.textDisabled, fontWeight: "500", textTransform: "uppercase" },
  statVal: { fontSize: 12, fontWeight: "700", color: COLORS.text },

  formRow: { flexDirection: "row", gap: 10, alignItems: "flex-end" },
  formLabel: { fontSize: 12, fontWeight: "600", color: COLORS.textSecondary, marginBottom: 4 },
  formLabelSm: { fontSize: 11, fontWeight: "600", color: COLORS.textDisabled, marginBottom: 4 },
  formCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  pickerWrap: { flex: 1, maxHeight: 40 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 12, fontWeight: "500", color: COLORS.textSecondary },

  input: {
    backgroundColor: COLORS.bg,
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  totalesRow: { flexDirection: "row", gap: 8 },
  totalCard: {
    flex: 1,
    alignItems: "center",
    padding: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    gap: 2,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  totalVal: { fontSize: 18, fontWeight: "800", color: COLORS.text },
  totalLbl: { fontSize: 10, color: COLORS.textDisabled, fontWeight: "500" },

  detalleHeader: { flexDirection: "row", justifyContent: "flex-end" },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addBtnText: { fontSize: 13, fontWeight: "600", color: "#fff" },

  tablaWrap: { gap: 2 },
  tablaHRow: {
    flexDirection: "row",
    backgroundColor: COLORS.primarySoft,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  tablaH: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.text,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tablaRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  tablaTd: { fontSize: 12, color: COLORS.text },
  inputInline: {
    backgroundColor: COLORS.surface,
    borderRadius: 4,
    padding: 4,
    fontSize: 12,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },

  accionesCol: { flexDirection: "row", gap: 8, justifyContent: "center" },

  seccionTit: { fontSize: 16, fontWeight: "700", color: COLORS.text },
  emptyText: { fontSize: 13, color: COLORS.textDisabled, fontStyle: "italic", padding: 12, textAlign: "center" },

  vacCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  vacAprobada: { borderLeftWidth: 3, borderLeftColor: ios.colors.green },
  vacRechazada: { borderLeftWidth: 3, borderLeftColor: ios.colors.red },
  vacUser: { fontSize: 14, fontWeight: "700", color: COLORS.text },
  vacFechas: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  vacMotivo: { fontSize: 11, color: COLORS.textDisabled, marginTop: 2, fontStyle: "italic" },
  vacBtns: { flexDirection: "row", gap: 8 },
  vacBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },

  estadoChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  estadoAprob: { backgroundColor: ios.colors.green + "22" },
  estadoRech: { backgroundColor: ios.colors.red + "22" },
  estadoChipText: { fontSize: 11, fontWeight: "600", color: COLORS.text },

  btnPrimary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 12,
  },
  btnPrimaryText: { fontSize: 14, fontWeight: "700", color: "#fff" },
  btnOutline: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 10,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  btnOutlineText: { fontSize: 14, fontWeight: "600", color: COLORS.primary },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 20,
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: COLORS.text },
  modalSub: { fontSize: 13, color: COLORS.textSecondary },
  modalBtns: { flexDirection: "row", gap: 8, marginTop: 8 },

  // Calendario
  calNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  calNavTitulo: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text,
    textTransform: "capitalize",
  },
  calGridWrap: {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  calSemanaRow: {
    flexDirection: "row",
    marginBottom: 2,
  },
  calSemanaCell: {
    width: "14.28%",
    alignItems: "center",
    paddingVertical: 3,
  },
  calSemanaTxt: {
    fontSize: 9,
    fontWeight: "700",
    color: COLORS.textDisabled,
    textTransform: "uppercase",
  },
  calGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  calDay: {
    width: "14.28%",
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 4,
    padding: 1,
  },
  calDayNum: {
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.text,
  },
  calDayDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },
  calDayHoras: {
    fontSize: 7,
    fontWeight: "700",
    color: COLORS.primary,
    marginTop: 1,
  },
  dayDetailWrap: {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dayDetailHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dayDetailTitulo: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text,
  },
});

---

## 4. API Client —  (fragmentos fichajes)

  // Fichajes
  fichajeCrear: (body: { tipo: string; lat?: number; lng?: number; dispositivo?: string }) =>
    request("/fichajes", { method: "POST", body: JSON.stringify(body) }),
  fichajeEditar: (fichajeId: string, entrada?: string, salida?: string) =>
    request(`/fichajes/${fichajeId}`, { method: "PUT", body: JSON.stringify({ entrada: entrada || null, salida: salida || null }) }),
  fichajeEliminar: (fichajeId: string) =>
    request(`/fichajes/${fichajeId}`, { method: "DELETE" }),
  fichajesListar: (user_id?: string, from?: string, to?: string) => {
    const p = new URLSearchParams();
    if (user_id) p.set("user_id", user_id);
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    const qs = p.toString();
    return request(`/fichajes${qs ? "?" + qs : ""}`);
  },
  fichajesAdminUsuarios: () => request("/fichajes/admin/usuarios"),
  fichajesAdminDetalle: (userId: string, desde: string, hasta: string) =>
    request(`/fichajes/admin/detalle/${userId}?desde=${desde}&hasta=${hasta}`),
  fichajesAdminEditar: (fichajeId: string, entrada: string | null, salida: string | null) =>
    request(`/fichajes/admin/editar/${fichajeId}`, { method: "PUT", body: JSON.stringify({ entrada, salida }) }),
  fichajesAdminCrear: (userId: string, fecha: string, entrada: string, salida: string) =>
    request("/fichajes/admin/crear", { method: "POST", body: JSON.stringify({ user_id: userId, fecha, entrada, salida }) }),
  fichajesAdminEliminar: (fichajeId: string) =>
    request(`/fichajes/admin/eliminar/${fichajeId}`, { method: "DELETE" }),
  fichajesAdminVacaciones: (userId?: string) =>
    request(`/fichajes/admin/vacaciones${userId ? "?user_id=" + userId : ""}`),
  fichajesAdminVacacionesGestionar: (vacId: string, estado: string) =>
    request(`/fichajes/admin/vacaciones/${vacId}`, { method: "PUT", body: JSON.stringify({ estado }) }),
  fichajesAdminExportar: async (desde: string, hasta: string, userId?: string) => {
    const t = await getToken();
    const res = await fetch(apiUrl(`/fichajes/admin/exportar?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}${userId ? `&user_id=${encodeURIComponent(userId)}` : ""}`), { headers: t ? { Authorization: `Bearer ${t}` } : {} });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
  },
  vacacionesSolicitar: (body: { fecha_inicio: string; fecha_fin: string; tipo: string; motivo?: string }) =>
    request("/vacaciones", { method: "POST", body: JSON.stringify(body) }),
  vacacionesListar: () => request("/vacaciones"),
  vacacionesSaldo: (user_id: string) => request(`/vacaciones/saldo/${user_id}`),
  configFichajes: () => request("/config-fichajes"),
  updateConfigFichajes: (body: any) => request("/config-fichajes", { method: "PUT", body: JSON.stringify(body) }),

  // Muestrario
  getMuestrario: () => request("/muestrario"),

  // Solicitudes de presupuesto (cliente)

---

## 5. Permisos — 

/**
 * Permissions helper — provides a single source of truth for what
 * the current user can do, derived from `/api/auth/me`.
 *
 * Usage:
 *   const { perms, has, ready } = usePermissions();
 *   if (has("calendario.edit")) { ... }
 */
import { useEffect, useState, useCallback } from "react";
import { api } from "./api";

export type PermissionKey =
  | "proyectos.view" | "proyectos.edit" | "proyectos.editar_campo"
  | "calendario.view" | "calendario.edit" | "calendario.assign" | "events.edit"
  | "planos.view" | "planos.edit" | "planos.download"
  | "presupuestos.view" | "presupuestos.edit" | "presupuestos.export"
  | "sat.view" | "sat.edit" | "sat.export"
  | "chat.view" | "chat.edit"
  | "users.manage" | "roles.manage" | "onedrive.manage"
  | "preciario.view" | "preciario.ver_precios" | "preciario.edit"
  | "notas.view"
  | "documentos.manage"
  | "fichajes.view" | "fichajes.manage" | "fichajes.edit_own"
  | "certificaciones.view" | "certificaciones.edit"
  | "clientes.view" | "clientes.edit"
  | "dashboard.view"
  | "materiales.view_hours";

export type Me = {
  id: string;
  email: string;
  name?: string;
  role: string;          // legacy: "admin" | "user" | "comercial"
  role_id?: string | null;
  role_name?: string | null;
  permissions?: string[] | null;
  color?: string | null;
};

export function usePermissions() {
  const [me, setMe] = useState<Me | null>(null);
  const [ready, setReady] = useState(false);

  const reload = useCallback(async () => {
    try {
      const u = await api.me();
      setMe(u as Me);
    } catch {
      setMe(null);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const perms: string[] = me?.permissions || [];
  const has = useCallback((p: PermissionKey | string) => perms.includes(p), [perms]);
  const isAdmin = me?.role === "admin"; // legacy/full-access flag
  const isSuperAdmin = !!(me?.permissions || []).includes("users.manage")
    && !!(me?.permissions || []).includes("roles.manage");

  return { me, perms, has, isAdmin, isSuperAdmin, ready, reload };
}

/**
 * Given a list of permissions, decide which tab keys to show in the
 * bottom/side navigation. Order is the global navigation order.
 */
export type NavItem =
  | "home" | "dashboard" | "calendario" | "planos" | "proyectos"
  | "presupuestos" | "chat" | "sat" | "ajustes" | "fichajes";

export function visibleNav(perms: string[]): NavItem[] {
  const items: NavItem[] = ["home", "dashboard"]; // home + dashboard siempre visibles
  if (perms.includes("calendario.view")) items.push("calendario");
  if (perms.includes("planos.view")) items.push("planos");
  if (perms.includes("proyectos.view")) items.push("proyectos");
  if (perms.includes("presupuestos.view")) items.push("presupuestos");
  if (perms.includes("chat.view")) items.push("chat");
  if (perms.includes("sat.view")) items.push("sat");
  if (perms.includes("fichajes.view")) items.push("fichajes");
  // Ajustes is visible to everyone (theme + portfolio etc)
  items.push("ajustes");
  return items;
}

## 2. Frontend — `app/fichajes.tsx`
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, TextInput, Platform, RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api, clearToken, COLORS } from "../src/api";
import ResponsiveLayout from "../src/ResponsiveLayout";
import { useBreakpoint } from "../src/useBreakpoint";
import IOSHeader from "../src/ui/IOSHeader";
import { useThemedStyles } from "../src/theme";
import { ios } from "../src/ui/iosTheme";



const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const DAYS_MONTH = ["L", "M", "X", "J", "V", "S", "D"];

function pad(n: number): string { return String(n).padStart(2, "0"); }
function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function fmtTimeNow(): string {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

type Tab = "fichar" | "vacaciones" | "mensual";

export default function FichajesScreen() {
  const router = useRouter();
  const { isWide } = useBreakpoint();
  const s = useThemedStyles(useS);
  const [tab, setTab] = useState<Tab>("fichar");
  const [me, setMe] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [fichajesHoy, setFichajesHoy] = useState<any[]>([]);
  const [horaActual, setHoraActual] = useState(fmtTimeNow());
  const [ubicacion, setUbicacion] = useState<{lat: number; lng: number} | null>(null);
  const [saldoDias, setSaldoDias] = useState<any>(null);
  const [vacacionesList, setVacacionesList] = useState<any[]>([]);
  const [fichajesMes, setFichajesMes] = useState<any[]>([]);
  const [fichajesAnio, setFichajesAnio] = useState<any[]>([]);
  const [config, setConfig] = useState<any>(null);

  // Vacaciones form
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [tipoSolicitud, setTipoSolicitud] = useState<"vacaciones" | "ausencia">("vacaciones");
  const [motivo, setMotivo] = useState("");

  // Calendario
  const [anchorMonth, setAnchorMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const hoyDia = useMemo(() => todayISO(), []);

  // Editar fichajes
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editEntrada, setEditEntrada] = useState("");
  const [editSalida, setEditSalida] = useState("");
  const limiteAno = useMemo(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    return d;
  }, []);

  const perms: string[] = (me?.permissions as string[]) || [];
  const has = (p: string) => perms.includes(p);
  const isAdmin = me?.role === "admin" || has("fichajes.manage");

  // Reloj en tiempo real
  useEffect(() => {
    const t = setInterval(() => setHoraActual(fmtTimeNow()), 1000);
    return () => clearInterval(t);
  }, []);

  const syncOfflineFichajes = useCallback(async () => {}, []);

  useEffect(() => {
  }, [syncOfflineFichajes]);

  const getLocation = async () => {
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUbicacion({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {},
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 60000 }
      );
    }
  };

  useFocusEffect(useCallback(() => {
    let alive = true;
    (async () => {
      try {
        const u = await api.me();
        if (!alive) return;
        setMe(u);
        await Promise.all([cargarFichajesHoy(), cargarVacaciones(), cargarConfig(), cargarResumen()]);
      } catch (e: any) {
        if (/401|Invalid|expired/i.test(e?.message || "")) {
          await clearToken();
          router.replace("/login");
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []));

  async function cargarFichajesHoy() {
    try {
      const hoy = todayISO();
      const items = await api.fichajesListar(undefined, `${hoy}T00:00:00`, `${hoy}T23:59:59`);
      setFichajesHoy(items || []);
    } catch {}
  }

  async function cargarFichajesMes() {
    const d = new Date(anchorMonth);
    const inicio = new Date(d.getFullYear(), d.getMonth(), 1);
    const fin = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
    const from = inicio.toISOString();
    const to = fin.toISOString();
    try {
      const items = await api.fichajesListar(undefined, from, to);
      setFichajesMes(items || []);
    } catch {}
  }

  async function cargarVacaciones() {
    try {
      if (!me?.id) return;
      const [lista, saldo] = await Promise.all([
        api.vacacionesListar(),
        api.vacacionesSaldo(me.id),
      ]);
      setVacacionesList(lista || []);
      setSaldoDias(saldo);
    } catch {}
  }

  async function cargarConfig() {
    try {
      const c = await api.configFichajes();
      setConfig(c);
    } catch {}
  }

  async function cargarResumen() {
    try {
      const ahora = new Date();
      const inicioAnio = `${ahora.getFullYear()}-01-01T00:00:00`;
      const finHoy = ahora.toISOString();
      const items = await api.fichajesListar(undefined, inicioAnio, finHoy);
      setFichajesAnio(items || []);
    } catch {}
  }

  // Resumen semanal / mensual / anual
  const resumenHoras = useMemo(() => {
    const ahora = new Date();
    const inicioSemana = new Date(ahora);
    inicioSemana.setDate(ahora.getDate() - (ahora.getDay() === 0 ? 6 : ahora.getDay() - 1));
    inicioSemana.setHours(0, 0, 0, 0);
    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);

    let minSemana = 0, minMes = 0, minAnio = 0;
    const diasSemana = new Set<string>();
    const diasMes = new Set<string>();
    const diasAnio = new Set<string>();

    for (const f of fichajesAnio) {
      if (!f.entrada) continue;
      const fechaDia = f.fecha || "";
      if (!fechaDia) continue;

      const d = new Date(fechaDia + "T00:00:00");
      let minutos = 0;
      if (f.entrada && f.salida) {
        const [h, m2] = (f.total || "0h 0m").replace("h ", ":").split(":");
        minutos = (parseInt(h) || 0) * 60 + (parseInt(m2) || 0);
      }

      if (d >= inicioSemana) { minSemana += minutos; if (minutos > 0) diasSemana.add(fechaDia); }
      if (d >= inicioMes) { minMes += minutos; if (minutos > 0) diasMes.add(fechaDia); }
      minAnio += minutos;
      if (minutos > 0) diasAnio.add(fechaDia);
    }

    return {
      semana: { horas: `${Math.floor(minSemana / 60)}h ${minSemana % 60}m`, dias: diasSemana.size },
      mes: { horas: `${Math.floor(minMes / 60)}h ${minMes % 60}m`, dias: diasMes.size },
      anio: { horas: `${Math.floor(minAnio / 60)}h ${minAnio % 60}m`, dias: diasAnio.size },
    };
  }, [fichajesAnio]);

  async function fichar(tipo: string) {
     try {
      await getLocation();
      await api.fichajeCrear({
        tipo,
        lat: ubicacion?.lat,
        lng: ubicacion?.lng,
        dispositivo: Platform.OS === "web" ? "web" : "mobile",
      });
      await cargarFichajesHoy();
      cargarResumen();
      Alert.alert("Fichaje registrado", `${tipo.replace("_", " ").toUpperCase()} registrado a las ${fmtTimeNow()}`);
    } catch (e: any) {
      Alert.alert("Error", e.message || "No se pudo crear el fichaje");
    }
  }

  async function editarFichaje(fichajeId: string) {
    try {
      await api.fichajeEditar(fichajeId, editEntrada || undefined, editSalida || undefined);
      setEditingId(null);
      await Promise.all([cargarFichajesHoy(), cargarResumen(), cargarFichajesMes()]);
    } catch (e: any) {
      Alert.alert("Error", e.message || "No se pudo editar el fichaje");
    }
  }

  async function borrarFichaje(fichajeId: string) {
    Alert.alert("Borrar fichaje", "¿Eliminar este registro?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Borrar", style: "destructive", onPress: async () => {
        try {
          await api.fichajeEliminar(fichajeId);
          await Promise.all([cargarFichajesHoy(), cargarResumen(), cargarFichajesMes()]);
        } catch (e: any) { Alert.alert("Error", e.message); }
      }},
    ]);
  }

  const puedeEditar = has("fichajes.edit_own") || has("fichajes.manage") || me?.role === "admin";

  async function solicitarVacaciones() {
    if (!fechaInicio || !fechaFin) {
      Alert.alert("Faltan datos", "Selecciona las fechas");
      return;
    }
    try {
      await api.vacacionesSolicitar({
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        tipo: tipoSolicitud,
        motivo,
      });
      setFechaInicio("");
      setFechaFin("");
      setMotivo("");
      await cargarVacaciones();
      Alert.alert("Enviada", "Solicitud enviada correctamente");
    } catch (e: any) {
      Alert.alert("Error", e.message || "No se pudo gestionar");
    }
  }

  // Cambiar mes
  function mesAnterior() {
    const target = new Date(anchorMonth.getFullYear(), anchorMonth.getMonth() - 1, 1);
    if (target >= limiteAno) { setAnchorMonth(target); setSelectedDay(null); }
  }
  function mesSiguiente() {
    const hoy = new Date();
    const target = new Date(anchorMonth.getFullYear(), anchorMonth.getMonth() + 1, 1);
    if (target <= new Date(hoy.getFullYear(), hoy.getMonth(), 1)) { setAnchorMonth(target); setSelectedDay(null); }
  }

  useEffect(() => { cargarFichajesMes(); }, [anchorMonth]);

  // Agrupar fichajes por dia para el calendario
  const fichajesPorDia = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const f of fichajesMes) {
      const dia = f.fecha || "";
      if (dia) {
        if (!map[dia]) map[dia] = [];
        map[dia].push(f);
      }
    }
    return map;
  }, [fichajesMes]);

  // Dias del calendario
  const vacacionesPorDia = useMemo(() => {
    const map: Record<string, string> = {};
    for (const v of vacacionesList) {
      const ini = new Date(v.fecha_inicio + "T00:00:00");
      const fin = new Date(v.fecha_fin + "T00:00:00");
      for (let d = new Date(ini); d <= fin; d.setDate(d.getDate() + 1)) {
        const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        map[key] = v.estado;
      }
    }
    return map;
  }, [vacacionesList]);

  const calendarioDias = useMemo(() => {
    const a = anchorMonth.getFullYear();
    const m = anchorMonth.getMonth();
    const primerDia = new Date(a, m, 1);
    const inicio = new Date(primerDia);
    inicio.setDate(inicio.getDate() - (primerDia.getDay() === 0 ? 6 : primerDia.getDay() - 1));

    const dias = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(inicio);
      d.setDate(d.getDate() + i);
      const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const enMes = d.getMonth() === m;
      const fichajesDia = fichajesPorDia[key] || [];
      const horasTotal = fichajesDia.reduce((sum, f) => {
        if (!f.entrada || !f.salida) return sum;
        const [h, mm] = (f.total || "0h 0m").replace("h ", ":").split(":");
        return sum + (parseInt(h) || 0) * 60 + (parseInt(mm) || 0);
      }, 0);
      const tieneEntrada = fichajesDia.some((f) => f.entrada);
      const tieneSalida = fichajesDia.some((f) => f.salida);
      const festivos = config?.festivos || [];
      const esFestivo = festivos.includes(key);
      const vacStatus = vacacionesPorDia[key];
      dias.push({
        key, dia: d.getDate(), enMes,
        fichajes: fichajesDia,
        horas: horasTotal > 0 ? `${Math.floor(horasTotal / 60)}h ${horasTotal % 60}m` : null,
        tieneEntrada, tieneSalida,
        esFestivo, vacStatus,
      });
    }
    return dias;
  }, [anchorMonth, fichajesPorDia, config, vacacionesPorDia]);

  // Totales del mes visible
  const totalesMes = useMemo(() => {
    let totalMin = 0;
    let diasSet = new Set<string>();
    for (const f of fichajesMes) {
      if (f.entrada) diasSet.add(f.fecha || "");
      if (f.entrada && f.salida) {
        const [h, m2] = (f.total || "0h 0m").replace("h ", ":").split(":");
        totalMin += (parseInt(h) || 0) * 60 + (parseInt(m2) || 0);
      }
    }
    return {
      horas: `${Math.floor(totalMin / 60)}h ${totalMin % 60}m`,
      dias: diasSet.size,
    };
  }, [fichajesMes]);

  const tipoLegible: Record<string, string> = {
    entrada: "Entrada",
    salida: "Salida",
    inicio_pausa: "Inicio pausa",
    fin_pausa: "Fin pausa",
  };

  const estadoIcon: Record<string, { color: string; icon: string }> = {
    pendiente: { color: ios.colors.yellow, icon: "time" },
    aprobada: { color: ios.colors.green, icon: "checkmark-circle" },
    rechazada: { color: ios.colors.red, icon: "close-circle" },
  };

  const content = (
    <SafeAreaView style={s.root} edges={isWide ? [] : ["top"]}>
      {!isWide && <IOSHeader title={"Fichajes"} showBack />}
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={COLORS.primary} />
      ) : (
        <View style={s.body}>
          {/* Tabs */}
          <View style={s.tabs}>
            {(["fichar", "vacaciones", "mensual"] as Tab[]).map((tabKey) => (
              <TouchableOpacity
                key={tabKey}
                style={[s.tab, tab === tabKey && s.tabActive]}
                onPress={() => setTab(tabKey)}
              >
                <Ionicons
                  name={tabKey === "fichar" ? "time" : tabKey === "vacaciones" ? "umbrella" : "calendar"}
                  size={16}
                  color={tab === tabKey ? COLORS.primary : COLORS.textSecondary}
                />
                <Text style={[s.tabLabel, tab === tabKey && s.tabLabelActive]}>
                  {tabKey === "fichar" ? "Fichar" : tabKey === "vacaciones" ? "Vacaciones" : "Mensual"}
                </Text>
              </TouchableOpacity>
            ))}
            {isAdmin && (
              <TouchableOpacity
                style={[s.tab, s.tabAdmin]}
                onPress={() => router.push("/fichajes/admin" as any)}
              >
                <Ionicons name="settings" size={16} color={COLORS.accent} />
                <Text style={[s.tabLabel, { color: COLORS.accent }]}>{"Admin"}</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* === FICHAR === */}
          {tab === "fichar" && (
            <ScrollView contentContainerStyle={s.ficharWrap} refreshControl={<RefreshControl refreshing={loading} onRefresh={cargarFichajesHoy} />}>
              {/* Reloj grande */}
              <View style={s.relojCard}>
                <Text style={s.relojLabel}>{"Hora actual"}</Text>
                <Text style={s.relojTiempo}>{horaActual}</Text>
                <Text style={s.relojFecha}>
                  {new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                </Text>
              </View>

              {/* Botones de fichar */}
              <View style={s.botonesRow}>
                <TouchableOpacity style={[s.btnFichaje, s.btnEntrada]} onPress={() => fichar("entrada")} activeOpacity={0.7}>
                  <Ionicons name="enter" size={28} color="#fff" />
                  <Text style={s.btnFichajeTxt}>{"Entrada"}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.btnFichaje, s.btnSalida]} onPress={() => fichar("salida")} activeOpacity={0.7}>
                  <Ionicons name="exit" size={28} color="#fff" />
                  <Text style={s.btnFichajeTxt}>{"Salida"}</Text>
                </TouchableOpacity>
              </View>
              <View style={s.botonesRow}>
                <TouchableOpacity style={[s.btnFichaje, s.btnPausa]} onPress={() => fichar("inicio_pausa")} activeOpacity={0.7}>
                  <Ionicons name="pause" size={28} color="#fff" />
                  <Text style={s.btnFichajeTxt}>{"Pausa"}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.btnFichaje, s.btnFinPausa]} onPress={() => fichar("fin_pausa")} activeOpacity={0.7}>
                  <Ionicons name="play" size={28} color="#fff" />
                  <Text style={s.btnFichajeTxt}>{"Fin pausa"}</Text>
                </TouchableOpacity>
              </View>

              {/* Ubicacion */}
              {ubicacion && (
                <View style={s.ubicacionRow}>
                  <Ionicons name="location" size={14} color={COLORS.primary} />
                  <Text style={s.ubicacionTxt}>
                    {ubicacion.lat.toFixed(5)}, {ubicacion.lng.toFixed(5)}
                  </Text>
                </View>
              )}

              {/* Resumen semanal / mensual / anual */}
              <View style={s.resumenRow}>
                <View style={[s.resumenCard, { borderLeftColor: ios.colors.green }]}>
                  <Text style={s.resumenHoras}>{resumenHoras.semana.horas}</Text>
                  <Text style={s.resumenLabel}>{"Semanal"}</Text>
                  <Text style={s.resumenDias}>{resumenHoras.semana.dias}{" días"}</Text>
                </View>
                <View style={[s.resumenCard, { borderLeftColor: COLORS.primary }]}>
                  <Text style={s.resumenHoras}>{resumenHoras.mes.horas}</Text>
                  <Text style={s.resumenLabel}>{"Mensual"}</Text>
                  <Text style={s.resumenDias}>{resumenHoras.mes.dias}{" días"}</Text>
                </View>
                <View style={[s.resumenCard, { borderLeftColor: ios.colors.indigo }]}>
                  <Text style={s.resumenHoras}>{resumenHoras.anio.horas}</Text>
                  <Text style={s.resumenLabel}>{"Anual"}</Text>
                  <Text style={s.resumenDias}>{resumenHoras.anio.dias}{" días"}</Text>
                </View>
              </View>

              {/* Fichajes de hoy */}
              <Text style={s.seccionTitulo}>{"Fichajes de hoy"}</Text>
              {fichajesHoy.length === 0 ? (
                <Text style={s.emptyText}>{"Sin fichajes"}</Text>
              ) : (
                fichajesHoy.map((f) => (
                  <View key={f.id} style={s.fichajeRow}>
                    <View style={[s.fichajeDot, { backgroundColor: f.tipo === "entrada" || f.tipo === "fin_pausa" ? ios.colors.green : f.tipo === "salida" || f.tipo === "inicio_pausa" ? ios.colors.red : ios.colors.yellow }]} />
                    <Text style={s.fichajeTipo}>{tipoLegible[f.tipo] || f.tipo}</Text>
                    {editingId === f.id ? (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <TextInput style={s.editInput} value={editEntrada} onChangeText={setEditEntrada} placeholder="HH:MM" placeholderTextColor={COLORS.textDisabled} />
                        <Text style={{ color: COLORS.textDisabled, fontSize: 12 }}>-</Text>
                        <TextInput style={s.editInput} value={editSalida} onChangeText={setEditSalida} placeholder="HH:MM" placeholderTextColor={COLORS.textDisabled} />
                        <TouchableOpacity onPress={() => editarFichaje(f.id)}><Ionicons name="checkmark" size={18} color={ios.colors.green} /></TouchableOpacity>
                        <TouchableOpacity onPress={() => setEditingId(null)}><Ionicons name="close" size={18} color={ios.colors.red} /></TouchableOpacity>
                      </View>
                    ) : (
                      <Text style={s.fichajeHora}>{f.hora}</Text>
                    )}
                    {f.fuera_horario && (
                      <View style={s.fueraPill}>
                        <Text style={s.fueraPillTxt}>{"Fuera de horario"}</Text>
                      </View>
                    )}
                    {puedeEditar && editingId !== f.id && f.id && (
                      <View style={{ flexDirection: "row", gap: 6, marginLeft: "auto" }}>
                        <TouchableOpacity onPress={() => { setEditingId(f.id); setEditEntrada(f.entrada ? f.entrada.slice(11, 16) : ""); setEditSalida(f.salida ? f.salida.slice(11, 16) : ""); }}>
                          <Ionicons name="create-outline" size={16} color={COLORS.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => borrarFichaje(f.id)}>
                          <Ionicons name="trash-outline" size={16} color={ios.colors.red} />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                ))
              )}
            </ScrollView>
          )}

          {/* === VACACIONES === */}
          {tab === "vacaciones" && (
            <ScrollView contentContainerStyle={s.vacacionesWrap} refreshControl={<RefreshControl refreshing={loading} onRefresh={cargarVacaciones} />}>
              {/* Saldo */}
              {saldoDias && (
                <View style={s.saldoCard}>
                  <Ionicons name="calendar" size={24} color={COLORS.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.saldoTitulo}>{"Dias disponibles"}</Text>
                    <Text style={s.saldoNum}>{saldoDias.dias_disponibles} / {saldoDias.dias_anuales}</Text>
                    <View style={s.saldoBarraBg}>
                      <View style={[s.saldoBarra, { width: `${Math.min(100, ((saldoDias.dias_usados || 0) / saldoDias.dias_anuales) * 100)}%` }]} />
                    </View>
                    <Text style={s.saldoUsados}>{saldoDias.dias_usados}{" usados"}</Text>
                  </View>
                </View>
              )}

              {/* Formulario */}
              <Text style={s.seccionTitulo}>{"Fichajes de hoy"}</Text>
              <View style={s.formCard}>
                <View style={s.tipoRow}>
                  <TouchableOpacity
                    style={[s.tipoBtn, tipoSolicitud === "vacaciones" && s.tipoBtnActive]}
                    onPress={() => setTipoSolicitud("vacaciones")}
                  >
                    <Ionicons name="umbrella" size={16} color={tipoSolicitud === "vacaciones" ? "#fff" : COLORS.textSecondary} />
                    <Text style={[s.tipoBtnTxt, tipoSolicitud === "vacaciones" && { color: "#fff" }]}>{"Vacaciones"}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.tipoBtn, tipoSolicitud === "ausencia" && s.tipoBtnActive]}
                    onPress={() => setTipoSolicitud("ausencia")}
                  >
                    <Ionicons name="medkit" size={16} color={tipoSolicitud === "ausencia" ? "#fff" : COLORS.textSecondary} />
                    <Text style={[s.tipoBtnTxt, tipoSolicitud === "ausencia" && { color: "#fff" }]}>{"Ausencia"}</Text>
                  </TouchableOpacity>
                </View>
                <Text style={s.inputLabel}>{"Fecha inicio"}</Text>
                <TextInput style={s.input} placeholder="YYYY-MM-DD" value={fechaInicio} onChangeText={setFechaInicio} placeholderTextColor={COLORS.textDisabled} />
                <Text style={s.inputLabel}>{"Fecha fin"}</Text>
                <TextInput style={s.input} placeholder="YYYY-MM-DD" value={fechaFin} onChangeText={setFechaFin} placeholderTextColor={COLORS.textDisabled} />
                <Text style={s.inputLabel}>{"Motivo"}</Text>
                <TextInput style={[s.input, s.inputMulti]} placeholder="Motivo de la solicitud..." value={motivo} onChangeText={setMotivo} multiline placeholderTextColor={COLORS.textDisabled} />
                <TouchableOpacity style={s.solicitarBtn} onPress={solicitarVacaciones} activeOpacity={0.7}>
                  <Text style={s.solicitarBtnTxt}>{"Enviar solicitud"}</Text>
                </TouchableOpacity>
              </View>

              {/* Historial */}
              <Text style={s.seccionTitulo}>{"Historial"}</Text>
              {vacacionesList.length === 0 ? (
                <Text style={s.emptyText}>{"Sin fichajes"}</Text>
              ) : (
                vacacionesList.map((v) => {
                  const e = estadoIcon[v.estado] || { color: COLORS.textSecondary, icon: "help-circle" };
                  return (
                    <View key={v.id} style={s.vacRow}>
                      <Ionicons name={e.icon as any} size={20} color={e.color} />
                      <View style={{ flex: 1 }}>
                        <Text style={s.vacTxt}>
                          {v.tipo === "vacaciones" ? "Vacaciones" : "Ausencia"}: {v.fecha_inicio} a {v.fecha_fin}
                        </Text>
                        {v.motivo ? <Text style={s.vacMotivo}>{v.motivo}</Text> : null}
                      </View>
                      <View style={[s.estadoPill, { backgroundColor: e.color + "20" }]}>
                        <Text style={[s.estadoPillTxt, { color: e.color }]}>{v.estado}</Text>
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>
          )}

          {/* === MENSUAL === */}
          {tab === "mensual" && (
            <ScrollView contentContainerStyle={s.calWrap} refreshControl={<RefreshControl refreshing={loading} onRefresh={cargarFichajesMes} />}>
              {/* Navegación mes */}
              <View style={s.calNav}>
                <TouchableOpacity onPress={mesAnterior} disabled={anchorMonth <= limiteAno} style={anchorMonth <= limiteAno && { opacity: 0.3 }}>
                  <Ionicons name="chevron-back" size={20} color={COLORS.text} />
                </TouchableOpacity>
                <Text style={s.calNavTitulo}>{MONTHS[anchorMonth.getMonth()]} {anchorMonth.getFullYear()}</Text>
                <TouchableOpacity onPress={mesSiguiente} disabled={anchorMonth >= new Date(new Date().getFullYear(), new Date().getMonth(), 1)} style={anchorMonth >= new Date(new Date().getFullYear(), new Date().getMonth(), 1) && { opacity: 0.3 }}>
                  <Ionicons name="chevron-forward" size={20} color={COLORS.text} />
                </TouchableOpacity>
              </View>

              {/* Totales */}
              <View style={s.mesTotales}>
                <View style={s.mesTotalCard}>
                  <Text style={s.mesTotalVal}>{totalesMes.horas}</Text>
                  <Text style={s.mesTotalLbl}>{"Horas mes"}</Text>
                </View>
                <View style={s.mesTotalCard}>
                  <Text style={s.mesTotalVal}>{totalesMes.dias}</Text>
                  <Text style={s.mesTotalLbl}>{"Días"}</Text>
                </View>
              </View>

              {/* Calendario */}
              <View style={s.calGridWrap}>
                <View style={s.calSemanaRow}>
                  {DAYS_MONTH.map((dd) => (
                    <View key={dd} style={s.calSemanaCell}>
                      <Text style={s.calSemanaTxt}>{dd}</Text>
                    </View>
                  ))}
                </View>
                <View style={s.calGrid}>
                  {calendarioDias.map((d) => {
                    const isToday = d.key === hoyDia;
                    const isSelected = d.key === selectedDay;
                    const completo = d.tieneEntrada && d.tieneSalida;
                    const incompleto = d.tieneEntrada && !d.tieneSalida;
                    let bg = "transparent";
                    if (isSelected) bg = COLORS.primary + "18";
                    else if (d.vacStatus === "aprobada") bg = "#10B98130";
                    else if (d.vacStatus === "pendiente") bg = "#8B5CF630";
                    else if (d.vacStatus === "rechazada") bg = "#EF444430";
                    else if (d.esFestivo) bg = ios.colors.red + "10";
                    else if (incompleto) bg = ios.colors.yellow + "18";
                    else if (completo) bg = ios.colors.green + "12";

                    return (
                      <TouchableOpacity
                        key={d.key}
                        style={[
                          s.calDay, { height: isWide ? 42 : 36 },
                          { backgroundColor: bg },
                          isToday && { borderColor: COLORS.primary, borderWidth: 2 },
                          !d.enMes && { opacity: 0.25 },
                        ]}
                        onPress={() => d.enMes && setSelectedDay(d.key === selectedDay ? null : d.key)}
                        activeOpacity={0.6}
                      >
                        <Text style={[
                          s.calDayNum,
                          isToday && { color: COLORS.primary, fontWeight: "800" },
                          d.esFestivo && { color: ios.colors.red },
                          !d.enMes && { color: COLORS.textDisabled },
                        ]}>{d.dia}</Text>
                        <View style={{ flexDirection: "row", gap: 1, flexWrap: "wrap", justifyContent: "center" }}>
                          {d.fichajes.filter((f: any) => f.entrada && f.salida).map((f: any, fi: number) => (
                            <View key={fi} style={[s.calDayDot, { backgroundColor: f.tipo === "entrada" || f.tipo === "fin_pausa" ? ios.colors.green : ios.colors.orange }]} />
                          ))}
                        </View>
                        {d.horas && (
                          <Text style={s.calDayHoras}>{d.horas}</Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Detalle día seleccionado */}
              {selectedDay && (
                <View style={s.dayDetailWrap}>
                  <View style={s.dayDetailHeader}>
                    <Text style={s.dayDetailTitulo}>{selectedDay}</Text>
                    <TouchableOpacity onPress={() => setSelectedDay(null)}>
                      <Ionicons name="close" size={18} color={COLORS.textSecondary} />
                    </TouchableOpacity>
                  </View>
                  {(fichajesPorDia[selectedDay] || []).length === 0 ? (
                    <Text style={s.emptyText}>{"Sin fichajes este día"}</Text>
                  ) : (
                    <View style={s.tablaWrap}>
                      <View style={s.tablaHRow}>
                        <Text style={[s.tablaH, { flex: 1 }]}>{"Tipo"}</Text>
                        <Text style={[s.tablaH, { flex: 1 }]}>{"Entrada"}</Text>
                        <Text style={[s.tablaH, { flex: 1 }]}>{"Salida"}</Text>
                        <Text style={[s.tablaH, { width: 55 }]}>{"Total"}</Text>
                        <Text style={[s.tablaH, { width: 24 }]}>{""}</Text>
                      </View>
                      {(fichajesPorDia[selectedDay] || []).map((f: any, idx: number) => {
                        const esHoy = selectedDay === todayISO();
                        return (
                        <View key={f.id || idx} style={[s.tablaRow, idx % 2 === 0 && { backgroundColor: COLORS.readonly }]}>
                          <Text style={[s.tablaTd, { flex: 1 }]}>{tipoLegible[f.tipo] || f.tipo}</Text>
                          {editingId === f.id ? (
                            <>
                              <TextInput style={[s.tablaTd, s.editInputSmall, { flex: 1 }]} value={editEntrada} onChangeText={setEditEntrada} placeholder="HH:MM" placeholderTextColor={COLORS.textDisabled} />
                              <TextInput style={[s.tablaTd, s.editInputSmall, { flex: 1 }]} value={editSalida} onChangeText={setEditSalida} placeholder="HH:MM" placeholderTextColor={COLORS.textDisabled} />
                              <Text style={[s.tablaTd, { width: 55 }]}>{f.total}</Text>
                              <View style={{ width: 50, flexDirection: "row", gap: 4 }}>
                                <TouchableOpacity onPress={() => editarFichaje(f.id)}><Ionicons name="checkmark" size={16} color={ios.colors.green} /></TouchableOpacity>
                                <TouchableOpacity onPress={() => setEditingId(null)}><Ionicons name="close" size={16} color={ios.colors.red} /></TouchableOpacity>
                              </View>
                            </>
                          ) : (
                            <>
                              <Text style={[s.tablaTd, { flex: 1 }]}>{f.entrada ? f.entrada.slice(11, 16) : "-"}</Text>
                              <Text style={[s.tablaTd, { flex: 1 }]}>{f.salida ? f.salida.slice(11, 16) : "-"}</Text>
                              <Text style={[s.tablaTd, { width: 55 }]}>{f.total}</Text>
                              <View style={{ width: 50, flexDirection: "row", gap: 4, alignItems: "center" }}>
                                {puedeEditar && f.id && (
                                  <>
                                    <TouchableOpacity onPress={() => { setEditingId(f.id); setEditEntrada(f.entrada ? f.entrada.slice(11, 16) : ""); setEditSalida(f.salida ? f.salida.slice(11, 16) : ""); }}>
                                      <Ionicons name="create-outline" size={14} color={COLORS.primary} />
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => borrarFichaje(f.id)}>
                                      <Ionicons name="trash-outline" size={14} color={ios.colors.red} />
                                    </TouchableOpacity>
                                  </>
                                )}
                                {(!puedeEditar && esHoy && f.id) && (
                                  <TouchableOpacity onPress={() => borrarFichaje(f.id)}>
                                    <Ionicons name="trash-outline" size={14} color={ios.colors.red} />
                                  </TouchableOpacity>
                                )}
                              </View>
                            </>
                          )}
                        </View>
                      )})}
                    </View>
                  )}
                </View>
              )}

              {/* Leyenda */}
              <View style={s.leyenda}>
                <View style={s.leyendaItem}>
                  <View style={[s.leyendaDot, { backgroundColor: ios.colors.green }]} />
                  <Text style={s.leyendaTxt}>{"Completado"}</Text>
                </View>
                <View style={s.leyendaItem}>
                  <View style={[s.leyendaDot, { backgroundColor: ios.colors.yellow }]} />
                  <Text style={s.leyendaTxt}>{"Pendiente"}</Text>
                </View>
                {config?.festivos?.length > 0 && (
                  <View style={s.leyendaItem}>
                    <View style={[s.leyendaDot, { backgroundColor: ios.colors.red }]} />
                    <Text style={s.leyendaTxt}>{config.festivos.length}{" festivos"}</Text>
                  </View>
                )}
              </View>
            </ScrollView>
          )}
        </View>
      )}
    </SafeAreaView>
  );

  return (
    <ResponsiveLayout active="fichajes">
      {content}
    </ResponsiveLayout>
  );
}

const useS = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  body: { flex: 1 },

  // Tabs
  tabs: { flexDirection: "row", paddingHorizontal: 12, paddingVertical: 10, gap: 6, borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: COLORS.surface },
  tab: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: COLORS.bg },
  tabActive: { backgroundColor: COLORS.primarySoft },
  tabAdmin: { marginLeft: "auto", backgroundColor: "transparent", borderWidth: 1, borderColor: COLORS.accent + "40" },
  tabLabel: { fontSize: 12, fontWeight: "600", color: COLORS.textSecondary },
  tabLabelActive: { color: COLORS.primary },

  // Fichar
  ficharWrap: { padding: 16, gap: 16 },
  relojCard: { alignItems: "center", padding: 28, borderRadius: ios.radius.card, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, ...ios.shadow.card },
  relojLabel: { fontSize: 13, color: COLORS.textSecondary, fontWeight: "500", textTransform: "uppercase", letterSpacing: 1 },
  relojTiempo: { fontSize: 48, fontWeight: "800", color: COLORS.text, fontFamily: Platform.OS === "web" ? "'SF Mono', 'Menlo', monospace" : "monospace", letterSpacing: 2, marginTop: 4 },
  relojFecha: { fontSize: 14, color: COLORS.textSecondary, marginTop: 6, textTransform: "capitalize" },

  botonesRow: { flexDirection: "row", gap: 12 },
  btnFichaje: { flex: 1, paddingVertical: 22, borderRadius: ios.radius.card, alignItems: "center", gap: 8, borderWidth: 1, borderColor: "transparent", ...ios.shadow.card },
  btnEntrada: { backgroundColor: ios.colors.green },
  btnSalida: { backgroundColor: ios.colors.red },
  btnPausa: { backgroundColor: ios.colors.yellow },
  btnFinPausa: { backgroundColor: ios.colors.indigo },
  btnFichajeTxt: { fontSize: 14, fontWeight: "700", color: "#fff", letterSpacing: 1 },

  ubicacionRow: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: COLORS.surface, borderRadius: 8, padding: 10, borderWidth: 1, borderColor: COLORS.border },
  ubicacionTxt: { fontSize: 12, color: COLORS.textSecondary, fontFamily: Platform.OS === "web" ? "'SF Mono', monospace" : "monospace" },

  seccionTitulo: { fontSize: 16, fontWeight: "700", color: COLORS.text, marginTop: 8 },

  resumenRow: { flexDirection: "row", gap: 8 },
  resumenCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 12,
    borderLeftWidth: 3,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    gap: 2,
  },
  resumenHoras: { fontSize: 18, fontWeight: "800", color: COLORS.text },
  resumenLabel: { fontSize: 10, color: COLORS.textDisabled, fontWeight: "500", textTransform: "uppercase", letterSpacing: 0.5 },
  resumenDias: { fontSize: 10, color: COLORS.textSecondary },

  emptyText: { fontSize: 13, color: COLORS.textDisabled, fontStyle: "italic", padding: 12 },

  fichajeRow: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.surface, borderRadius: 10, padding: 12, gap: 10, borderWidth: 1, borderColor: COLORS.border },
  fichajeDot: { width: 10, height: 10, borderRadius: 5 },
  fichajeTipo: { fontSize: 13, fontWeight: "600", color: COLORS.text, flex: 1 },
  fichajeHora: { fontSize: 13, fontWeight: "500", color: COLORS.textSecondary, fontFamily: Platform.OS === "web" ? "'SF Mono', monospace" : "monospace" },
  fueraPill: { backgroundColor: ios.colors.orange + "20", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  fueraPillTxt: { fontSize: 10, fontWeight: "600", color: ios.colors.orange },

  // Vacaciones
  vacacionesWrap: { padding: 16, gap: 16 },
  saldoCard: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: COLORS.surface, borderRadius: ios.radius.card, padding: 18, borderWidth: 1, borderColor: COLORS.border, ...ios.shadow.card },
  saldoTitulo: { fontSize: 13, color: COLORS.textSecondary, fontWeight: "500" },
  saldoNum: { fontSize: 26, fontWeight: "800", color: COLORS.text, marginTop: 2 },
  saldoBarraBg: { height: 6, backgroundColor: COLORS.border, borderRadius: 3, marginTop: 6, overflow: "hidden" },
  saldoBarra: { height: 6, backgroundColor: COLORS.primary, borderRadius: 3 },
  saldoUsados: { fontSize: 11, color: COLORS.textDisabled, marginTop: 3 },

  formCard: { backgroundColor: COLORS.surface, borderRadius: ios.radius.card, padding: 18, borderWidth: 1, borderColor: COLORS.border, gap: 10 },
  tipoRow: { flexDirection: "row", gap: 8 },
  tipoBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border },
  tipoBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tipoBtnTxt: { fontSize: 13, fontWeight: "600", color: COLORS.textSecondary },
  inputLabel: { fontSize: 12, fontWeight: "600", color: COLORS.textSecondary },
  input: { backgroundColor: COLORS.bg, borderRadius: 8, padding: 12, fontSize: 14, color: COLORS.text, borderWidth: 1, borderColor: COLORS.border },
  inputMulti: { minHeight: 70, textAlignVertical: "top" },
  solicitarBtn: { backgroundColor: COLORS.primary, borderRadius: 10, paddingVertical: 14, alignItems: "center" },
  solicitarBtnTxt: { fontSize: 14, fontWeight: "700", color: "#fff" },

  vacRow: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.surface, borderRadius: 10, padding: 12, gap: 10, borderWidth: 1, borderColor: COLORS.border },
  vacTxt: { fontSize: 13, fontWeight: "500", color: COLORS.text },
  vacMotivo: { fontSize: 11, color: COLORS.textDisabled, marginTop: 2 },
  estadoPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  estadoPillTxt: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },

  // Calendario
  calWrap: { padding: 12, gap: 10 },
  calNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: COLORS.surface, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: COLORS.border },
  calNavTitulo: { fontSize: 15, fontWeight: "700", color: COLORS.text, textTransform: "capitalize" },

  mesTotales: { flexDirection: "row", gap: 6 },
  mesTotalCard: { flex: 1, alignItems: "center", padding: 10, backgroundColor: COLORS.surface, borderRadius: 10, gap: 2, borderWidth: 1, borderColor: COLORS.border },
  mesTotalVal: { fontSize: 17, fontWeight: "800", color: COLORS.text },
  mesTotalLbl: { fontSize: 10, color: COLORS.textDisabled, fontWeight: "500" },

  calGridWrap: { backgroundColor: COLORS.surface, borderRadius: 10, padding: 6, borderWidth: 1, borderColor: COLORS.border },
  calSemanaRow: { flexDirection: "row", marginBottom: 2 },
  calSemanaCell: { width: "14.28%", alignItems: "center", paddingVertical: 3 },
  calSemanaTxt: { fontSize: 9, fontWeight: "700", color: COLORS.textDisabled, textTransform: "uppercase" },
  calGrid: { flexDirection: "row", flexWrap: "wrap" },
  calDay: { width: "14.28%", alignItems: "center", justifyContent: "center", borderRadius: 5, padding: 2, borderWidth: 1, borderColor: "transparent" },
  calDayOut: { opacity: 0.3 },
  calDayFestivo: { backgroundColor: ios.colors.red + "10" },
  calDayNum: { fontSize: 11, fontWeight: "600", color: COLORS.text },
  calDayNumOut: { color: COLORS.textDisabled },
  calDayDot: { width: 3, height: 3, borderRadius: 1.5 },
  calDayHoras: { fontSize: 7, fontWeight: "700", color: COLORS.primary, marginTop: 1 },

  dayDetailWrap: { backgroundColor: COLORS.surface, borderRadius: 10, padding: 12, gap: 8, borderWidth: 1, borderColor: COLORS.border },
  dayDetailHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  dayDetailTitulo: { fontSize: 14, fontWeight: "700", color: COLORS.text },

  tablaWrap: { gap: 2 },
  tablaHRow: { flexDirection: "row", backgroundColor: COLORS.primarySoft, paddingVertical: 6, paddingHorizontal: 8, borderRadius: 8 },
  tablaH: { fontSize: 10, fontWeight: "700", color: COLORS.text, textTransform: "uppercase" },
  tablaRow: { flexDirection: "row", alignItems: "center", paddingVertical: 6, paddingHorizontal: 8 },
  tablaTd: { fontSize: 11, color: COLORS.text },
  editInput: {
    backgroundColor: COLORS.surface,
    borderRadius: 4,
    padding: 4,
    paddingHorizontal: 6,
    fontSize: 12,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.primary,
    fontFamily: Platform.OS === "web" ? "'SF Mono', monospace" : "monospace",
    width: 55,
    textAlign: "center",
  },
  editInputSmall: {
    backgroundColor: COLORS.surface,
    borderRadius: 4,
    padding: 2,
    paddingHorizontal: 4,
    fontSize: 10,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.primary,
    fontFamily: Platform.OS === "web" ? "'SF Mono', monospace" : "monospace",
  },

  leyenda: { backgroundColor: COLORS.surface, borderRadius: 10, padding: 14, gap: 8, borderWidth: 1, borderColor: COLORS.border, marginTop: 12 },
  leyendaItem: { flexDirection: "row", alignItems: "center", gap: 8 },
  leyendaDot: { width: 8, height: 8, borderRadius: 4 },
  leyendaTxt: { fontSize: 12, color: COLORS.textSecondary },
});

---
## 3. Frontend — `app/fichajes/admin.tsx`
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, TextInput, Platform, FlatList, Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api, clearToken, COLORS } from "../../src/api";
import ResponsiveLayout from "../../src/ResponsiveLayout";
import { useBreakpoint } from "../../src/useBreakpoint";
import IOSHeader from "../../src/ui/IOSHeader";
import { useThemedStyles } from "../../src/theme";
import { ios } from "../../src/ui/iosTheme";


function pad(n: number): string { return String(n).padStart(2, "0"); }

function hoyStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function haceUnAno(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function mesesDropdown(): { label: string; desde: string; hasta: string }[] {
  const items: { label: string; desde: string; hasta: string }[] = [];
  const hoy = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    const desde = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
    const ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const hasta = `${ultimo.getFullYear()}-${pad(ultimo.getMonth() + 1)}-${pad(ultimo.getDate())}`;
    items.push({ label: `${MESES[d.getMonth()]} ${d.getFullYear()}`, desde, hasta });
  }
  return items;
}

export default function FichajesAdminScreen() {
  const t = { fichajes: { admin: "Admin", gestionar: "Gestionar", exportar: "Exportar", crear: "Crear", eliminar: "Eliminar", editar: "Editar", usuario: "Usuario", fecha: "Fecha", entrada: "Entrada", salida: "Salida", horas: "Horas", estado: "Estado", vacaciones: "Vacaciones", solicitudes: "Solicitudes" } };
  const router = useRouter();
  const { isWide } = useBreakpoint();
  const s = useThemedStyles(useS);
  const [me, setMe] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [tab, setTab] = useState<"resumen" | "detalle" | "vacaciones" | "exportar">("resumen");

  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [busqueda, setBusqueda] = useState("");

  const [selectedUserId, setSelectedUserId] = useState("");
  const [detalle, setDetalle] = useState<any>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editEntrada, setEditEntrada] = useState("");
  const [editSalida, setEditSalida] = useState("");

  const [modalVisible, setModalVisible] = useState(false);
  const [nuevoFecha, setNuevoFecha] = useState(() => hoyStr());
  const [nuevoEntrada, setNuevoEntrada] = useState("09:00");
  const [nuevoSalida, setNuevoSalida] = useState("18:00");

  const [vacaciones, setVacaciones] = useState<any[]>([]);
  const [vacLoading, setVacLoading] = useState(false);

  const [exportUsuario, setExportUsuario] = useState("");
  const [exportDesde, setExportDesde] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
  });
  const [exportHasta, setExportHasta] = useState(() => hoyStr());
  const [exportPreview, setExportPreview] = useState<any[]>([]);
  const [exportMesSel, setExportMesSel] = useState(-1);

  const [kpiUsuarios, setKpiUsuarios] = useState({ total: 0, fichadosHoy: 0, horasMes: "0h" });

  // Calendario para el detalle
  const [anchorMonth, setAnchorMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [fichajesMes, setFichajesMes] = useState<any[]>([]);
  const [mesLoading, setMesLoading] = useState(false);
  const MESES_CAL = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const DIAS_SEMANA = ["L", "M", "X", "J", "V", "S", "D"];

  const hoyDia = new Date();
  const limiteAno = new Date(hoyDia.getFullYear() - 1, hoyDia.getMonth(), 1);
  const today = useMemo(() => `${hoyDia.getFullYear()}-${pad(hoyDia.getMonth() + 1)}-${pad(hoyDia.getDate())}`, []);

  const usuariosFiltrados = useMemo(() => {
    const q = busqueda.toLowerCase().trim();
    if (!q) return usuarios;
    return usuarios.filter(
      (u) => (u.name || "").toLowerCase().includes(q) || (u.email || "").toLowerCase().includes(q)
    );
  }, [usuarios, busqueda]);

  useFocusEffect(useCallback(() => {
    let alive = true;
    (async () => {
      try {
        const u = await api.me();
        if (!alive) return;
        setMe(u);
        if (u?.role !== "admin" && !(u?.permissions || []).includes("fichajes.manage")) {
          router.replace("/fichajes");
          return;
        }
        await cargarUsuarios();
      } catch (e: any) {
        if (/401|Invalid|expired/i.test(e?.message || "")) {
          await clearToken();
          router.replace("/login");
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []));

  async function cargarUsuarios() {
    try {
      const data = await api.fichajesAdminUsuarios();
      setUsuarios(data || []);
      const fichadosHoy = (data || []).filter((u: any) => u.hoy?.entrada).length;
      let totalMinMes = 0;
      for (const u of data || []) {
        const m = u.mes?.match(/(\d+)h\s*(\d+)m/);
        if (m) totalMinMes += parseInt(m[1]) * 60 + parseInt(m[2]);
      }
      setKpiUsuarios({
        total: (data || []).length,
        fichadosHoy,
        horasMes: `${Math.floor(totalMinMes / 60)}h ${Math.round(totalMinMes % 60)}m`,
      });
    } catch {}
  }

  // Cargar todos los fichajes del mes para el usuario seleccionado
  async function cargarFichajesMes(userId: string, mes: Date) {
    if (!userId) return;
    setMesLoading(true);
    const a = mes.getFullYear();
    const m = mes.getMonth();
    const desde = `${a}-${pad(m + 1)}-01`;
    const hasta = `${a}-${pad(m + 1)}-${pad(new Date(a, m + 1, 0).getDate())}`;
    try {
      const d = await api.fichajesAdminDetalle(userId, desde, hasta);
      setFichajesMes((d as any)?.fichajes || []);
      setDetalle(d);
    } catch (e: any) {
      Alert.alert("Error", e.message || "Error al cargar el mes");
    } finally {
      setMesLoading(false);
    }
  }

  useEffect(() => {
    if (selectedUserId && tab === "detalle") {
      cargarFichajesMes(selectedUserId, anchorMonth);
    }
  }, [selectedUserId, anchorMonth, tab]);

  // Agrupar fichajes por dia para el calendario
  const fichajesPorDia = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const f of fichajesMes) {
      const dia = f.fecha || "";
      if (dia) {
        if (!map[dia]) map[dia] = [];
        map[dia].push(f);
      }
    }
    return map;
  }, [fichajesMes]);

  // Construir la cuadrícula del calendario
  const calendarioDias = useMemo(() => {
    const a = anchorMonth.getFullYear();
    const m = anchorMonth.getMonth();
    const primerDia = new Date(a, m, 1);
    const ultimoDia = new Date(a, m + 1, 0);
    const inicio = new Date(primerDia);
    inicio.setDate(inicio.getDate() - (primerDia.getDay() === 0 ? 6 : primerDia.getDay() - 1));

    const dias = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(inicio);
      d.setDate(d.getDate() + i);
      const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const enMes = d.getMonth() === m;
      const fichajesDia = fichajesPorDia[key] || [];
      const horas = fichajesDia.reduce((sum, f) => {
        if (!f.entrada || !f.salida) return sum;
        const [h, m2] = (f.total || "0h 0m").replace("h ", ":").split(":");
        return sum + (parseInt(h) || 0) * 60 + (parseInt(m2) || 0);
      }, 0);
      dias.push({
        key,
        dia: d.getDate(),
        enMes,
        fichajes: fichajesDia,
        horas: horas > 0 ? `${Math.floor(horas / 60)}h ${horas % 60}m` : null,
        tieneEntrada: fichajesDia.some((f) => f.entrada),
        tieneSalida: fichajesDia.some((f) => f.salida),
      });
    }
    return dias;
  }, [anchorMonth, fichajesPorDia]);

  function mesAnterior() {
    const target = new Date(anchorMonth.getFullYear(), anchorMonth.getMonth() - 1, 1);
    if (target >= limiteAno) setAnchorMonth(target);
  }
  function mesSiguiente() {
    const target = new Date(anchorMonth.getFullYear(), anchorMonth.getMonth() + 1, 1);
    if (target <= new Date(hoyDia.getFullYear(), hoyDia.getMonth(), 1)) setAnchorMonth(target);
  }

  async function guardarEdicion(fichajeId: string) {
    try {
      await api.fichajesAdminEditar(fichajeId, editEntrada || null, editSalida || null);
      setEditingId(null);
      if (selectedUserId) cargarFichajesMes(selectedUserId, anchorMonth);
    } catch (e: any) {
      Alert.alert("Error", e.message || "Error al realizar la operación");
    }
  }

  async function eliminarFichaje(fichajeId: string) {
    Alert.alert("Eliminar fichaje", "¿Seguro que quieres eliminar este fichaje?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar", style: "destructive",
        onPress: async () => {
          try {
            await api.fichajesAdminEliminar(fichajeId);
            cargarFichajesMes(selectedUserId, anchorMonth);
          } catch (e: any) {
            Alert.alert("Error", e.message || "Error al realizar la operación");
          }
        },
      },
    ]);
  }

  async function crearFichaje() {
    try {
      await api.fichajesAdminCrear(selectedUserId, nuevoFecha, nuevoEntrada, nuevoSalida);
      setModalVisible(false);
      cargarFichajesMes(selectedUserId, anchorMonth);
      cargarUsuarios();
    } catch (e: any) {
      Alert.alert("Error", e.message || "Error al realizar la operación");
    }
  }

  async function cargarVacaciones() {
    setVacLoading(true);
    try {
      const data = await api.fichajesAdminVacaciones();
      setVacaciones(data || []);
    } catch {}
    finally {
      setVacLoading(false);
    }
  }

  async function gestionarVacacion(vacId: string, estado: "aprobada" | "rechazada") {
    try {
      await api.fichajesAdminVacacionesGestionar(vacId, estado);
      cargarVacaciones();
    } catch (e: any) {
      Alert.alert("Error", e.message || "Error al realizar la operación");
    }
  }

  async function previewExportar() {
    try {
      const csv = await api.fichajesAdminExportar(exportDesde, exportHasta, exportUsuario || undefined);
      const lines = csv.split("\n").filter(Boolean);
      const headers = lines[0].split(",");
      const rows = lines.slice(1).map((l) => {
        const vals = l.split(",");
        const obj: any = {};
        headers.forEach((h, i) => { obj[h] = vals[i] || ""; });
        return obj;
      });
      setExportPreview(rows);
    } catch (e: any) {
      Alert.alert("Error", e.message || "Error al realizar la operación");
    }
  }

  async function descargarCSV() {
    try {
      const csv = await api.fichajesAdminExportar(exportDesde, exportHasta, exportUsuario || undefined);
      if (typeof document !== "undefined") {
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `fichajes_${exportDesde}_${exportHasta}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 15000);
      }
    } catch (e: any) {
      Alert.alert("Error", e.message || "Error al realizar la operación");
    }
  }

  useEffect(() => {
    if (tab === "vacaciones") cargarVacaciones();
  }, [tab]);

  useEffect(() => {
    if (tab === "exportar" && exportMesSel >= 0) {
      const m = mesesDropdown()[exportMesSel];
      if (m) {
        setExportDesde(m.desde);
        setExportHasta(m.hasta);
      }
    }
  }, [exportMesSel, tab]);

  if (loading) {
    return (
    <ResponsiveLayout active="fichajes-admin">
        <SafeAreaView style={s.root} edges={isWide ? [] : ["top"]}>
          <ActivityIndicator style={{ marginTop: 60 }} color={COLORS.primary} />
        </SafeAreaView>
      </ResponsiveLayout>
    );
  }

  const selectedUser = usuarios.find((u) => u.id === selectedUserId);

  const calDayH = isWide ? 42 : 36;
  const calDayNumS = isWide ? 12 : 11;
  const calHourS = isWide ? 8 : 7;

  const content = (
    <SafeAreaView style={s.root} edges={isWide ? [] : ["top"]}>
      {!isWide && <IOSHeader title={"Admin Fichajes"} showBack backLabel={"Fichajes"} />}

      <View style={s.headerBar}>
        {isWide && (
          <TouchableOpacity onPress={() => { if (router.canGoBack()) router.back(); else router.replace("/fichajes"); }} style={s.headerBack} activeOpacity={0.6}>
            <Ionicons name="arrow-back" size={20} color={COLORS.textSecondary} />
            <Text style={s.headerBackLabel}>{"Fichajes"}</Text>
          </TouchableOpacity>
        )}
        <Text style={s.headerTitle}>{"Gestión de fichajes"}</Text>
      </View>

      <View style={s.kpiRow}>
        <View style={s.kpiCard}>
          <Ionicons name="people" size={18} color={ios.colors.indigo} />
          <Text style={s.kpiVal}>{kpiUsuarios.total}</Text>
          <Text style={s.kpiLabel}>{"Usuarios"}</Text>
        </View>
        <View style={s.kpiCard}>
          <Ionicons name="time" size={18} color={ios.colors.green} />
          <Text style={s.kpiVal}>{kpiUsuarios.fichadosHoy}</Text>
          <Text style={s.kpiLabel}>{"Fichados hoy"}</Text>
        </View>
        <View style={s.kpiCard}>
          <Ionicons name="hourglass" size={18} color={ios.colors.orange} />
          <Text style={s.kpiVal}>{kpiUsuarios.horasMes}</Text>
          <Text style={s.kpiLabel}>{"Horas mes"}</Text>
        </View>
      </View>

      <View style={s.tabs}>
        {(["resumen", "detalle", "vacaciones", "exportar"] as const).map((tabKey) => (
          <TouchableOpacity
            key={tabKey}
            style={[s.tabBtn, tab === tabKey && s.tabBtnActive]}
            onPress={() => setTab(tabKey)}
          >
            <Text style={[s.tabBtnTxt, tab === tabKey && s.tabBtnTxtActive]}>
              {tabKey === "resumen" ? "Resumen" : tabKey === "detalle" ? "Detalle" : tabKey === "vacaciones" ? "Vacaciones" : "Exportar"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">

        {/* TAB 1: Resumen */}
        {tab === "resumen" && (
          <View style={{ gap: 12 }}>
            <TextInput
              style={s.searchInput}
              value={busqueda}
              onChangeText={setBusqueda}
              placeholder={"Buscar usuario..."}
              placeholderTextColor={COLORS.textDisabled}
            />
            {usuariosFiltrados.map((u) => (
              <TouchableOpacity
                key={u.id}
                style={s.userRow}
                onPress={() => { setSelectedUserId(u.id); setTab("detalle"); }}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1 }}>
                  <Text style={s.userName}>{u.name}</Text>
                  <Text style={s.userEmail}>{u.email}</Text>
                </View>
                <View style={s.userStats}>
                  <View style={s.statItem}>
                    <Text style={s.statLabel}>{"Hoy"}</Text>
                    <Text style={[s.statVal, u.hoy?.entrada ? { color: ios.colors.green } : { color: COLORS.textDisabled }]}>
                      {u.hoy?.entrada || "-"} / {u.hoy?.salida || "-"}
                    </Text>
                  </View>
                  <View style={s.statItem}>
                    <Text style={s.statLabel}>{"Semana"}</Text>
                    <Text style={s.statVal}>{u.semana}</Text>
                  </View>
                  <View style={s.statItem}>
                    <Text style={s.statLabel}>{"Mes"}</Text>
                    <Text style={s.statVal}>{u.mes}</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={COLORS.textDisabled} />
              </TouchableOpacity>
            ))}
            {usuariosFiltrados.length === 0 && (
              <Text style={s.emptyText}>{"Sin datos"}</Text>
            )}
          </View>
        )}

        {/* TAB 2: Detalle — Calendario */}
        {tab === "detalle" && (
          <View style={{ gap: 8 }}>
            {/* Selector usuario */}
            <View style={s.formRow}>
              <Text style={s.formLabel}>{"Usuario"}</Text>
              <View style={s.pickerWrap}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {usuarios.map((u) => (
                    <TouchableOpacity
                      key={u.id}
                      style={[s.chip, selectedUserId === u.id && s.chipActive]}
                      onPress={() => { setSelectedUserId(u.id); setSelectedDay(null); }}
                    >
                      <Text style={[s.chipText, selectedUserId === u.id && { color: "#fff" }]}>{u.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>

            {!selectedUserId ? (
              <Text style={s.emptyText}>{"Selecciona un usuario para ver su calendario"}</Text>
            ) : (
              <>
                {/* Navegación mes */}
                <View style={[s.calNav, !isWide && { paddingHorizontal: 8, paddingVertical: 4 }]}>
                  <TouchableOpacity onPress={mesAnterior} disabled={anchorMonth <= limiteAno} style={anchorMonth <= limiteAno && { opacity: 0.3 }}>
                    <Ionicons name="chevron-back" size={isWide ? 20 : 16} color={COLORS.text} />
                  </TouchableOpacity>
                  <Text style={[s.calNavTitulo, !isWide && { fontSize: 13 }]}>
                    {MESES_CAL[anchorMonth.getMonth()]} {anchorMonth.getFullYear()}
                  </Text>
                  <TouchableOpacity onPress={mesSiguiente} disabled={anchorMonth >= new Date(hoyDia.getFullYear(), hoyDia.getMonth(), 1)} style={anchorMonth >= new Date(hoyDia.getFullYear(), hoyDia.getMonth(), 1) && { opacity: 0.3 }}>
                    <Ionicons name="chevron-forward" size={isWide ? 20 : 16} color={COLORS.text} />
                  </TouchableOpacity>
                </View>

                {mesLoading ? (
                  <ActivityIndicator color={COLORS.primary} style={{ marginTop: 20 }} />
                ) : (
                  <>
                    {/* Totales del mes */}
                    <View style={[s.totalesRow, { gap: isWide ? 4 : 2 }]}>
                      <View style={[s.totalCard, { padding: isWide ? 8 : 5, borderRadius: 8 }]}>
                        <Text style={[s.totalVal, { fontSize: isWide ? 16 : 13 }]}>{detalle?.totales?.horas_trabajadas || "0h"}</Text>
                        <Text style={[s.totalLbl, { fontSize: isWide ? 9 : 8 }]}>{"Horas mes"}</Text>
                      </View>
                      <View style={[s.totalCard, { padding: isWide ? 8 : 5, borderRadius: 8 }]}>
                        <Text style={[s.totalVal, { fontSize: isWide ? 16 : 13 }]}>{detalle?.totales?.dias_trabajados || 0}</Text>
                        <Text style={[s.totalLbl, { fontSize: isWide ? 9 : 8 }]}>{"Días"}</Text>
                      </View>
                      <View style={[s.totalCard, { padding: isWide ? 8 : 5, borderRadius: 8 }]}>
                        <Text style={[s.totalVal, { fontSize: isWide ? 16 : 13 }]}>{detalle?.totales?.vacaciones || 0}</Text>
                        <Text style={[s.totalLbl, { fontSize: isWide ? 9 : 8 }]}>{"Vacaciones"}</Text>
                      </View>
                    </View>

                    {/* Calendario */}
                    <View style={[s.calGridWrap, !isWide && { padding: 3, borderRadius: 8 }]}>
                      <View style={[s.calSemanaRow, !isWide && { marginBottom: 0 }]}>
                        {DIAS_SEMANA.map((dd) => (
                          <View key={dd} style={[s.calSemanaCell, !isWide && { paddingVertical: 1 }]}>
                            <Text style={[s.calSemanaTxt, !isWide && { fontSize: 8 }]}>{dd}</Text>
                          </View>
                        ))}
                      </View>
                      <View style={s.calGrid}>
                        {calendarioDias.map((d) => {
                          const isToday = d.key === today.current;
                          const isSelected = d.key === selectedDay;
                          const tieneDatos = d.tieneEntrada && d.tieneSalida;
                          const incompleto = d.tieneEntrada && !d.tieneSalida;
                          let bg = "transparent";
                          if (isSelected) bg = COLORS.primary + "18";
                          else if (incompleto) bg = ios.colors.yellow + "18";
                          else if (tieneDatos) bg = ios.colors.green + "12";

                          return (
                            <TouchableOpacity
                              key={d.key}
                              style={[
                                s.calDay,
                                { height: calDayH },
                                isToday && { borderColor: COLORS.primary, borderWidth: 1.5 },
                                !d.enMes && { opacity: 0.25 },
                                { backgroundColor: bg },
                              ]}
                              onPress={() => {
                                if (d.enMes) setSelectedDay(d.key);
                              }}
                              activeOpacity={0.6}
                            >
                              <Text style={[
                                s.calDayNum,
                                { fontSize: calDayNumS },
                                isToday && { color: COLORS.primary, fontWeight: "800" },
                                !d.enMes && { color: COLORS.textDisabled },
                              ]}>{d.dia}</Text>
                              <View style={{ flexDirection: "row", gap: 1, flexWrap: "wrap", justifyContent: "center" }}>
                                {d.fichajes.filter((f: any) => f.entrada && f.salida).map((f: any, fi: number) => (
                                  <View key={fi} style={[s.calDayDot, { backgroundColor: f.tipo === "entrada" || f.tipo === "fin_pausa" ? ios.colors.green : ios.colors.orange }]} />
                                ))}
                              </View>
                              {d.horas && (
                                <Text style={[s.calDayHoras, { fontSize: calHourS }]}>{d.horas}</Text>
                              )}
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>

                    {/* Detalle del día seleccionado */}
                    {selectedDay && (
                      <View style={[s.dayDetailWrap, !isWide && { maxHeight: 220 }]}>
                        <View style={s.dayDetailHeader}>
                          <Text style={s.dayDetailTitulo}>{selectedDay}</Text>
                          <TouchableOpacity onPress={() => { setSelectedDay(null); }}>
                            <Ionicons name="close" size={18} color={COLORS.textSecondary} />
                          </TouchableOpacity>
                        </View>
                        <View style={s.detalleHeader}>
                          <TouchableOpacity style={s.addBtn} onPress={() => { setNuevoFecha(selectedDay); setModalVisible(true); }} activeOpacity={0.7}>
                            <Ionicons name="add" size={16} color="#fff" />
                            <Text style={s.addBtnText}>{"Añadir"}</Text>
                          </TouchableOpacity>
                        </View>
                        {(fichajesPorDia[selectedDay] || []).length === 0 ? (
                          <Text style={s.emptyText}>{"Sin fichajes este día"}</Text>
                        ) : (
                          <View style={s.tablaWrap}>
                            <View style={s.tablaHRow}>
                              <Text style={[s.tablaH, { flex: 1 }]}>{"Entrada"}</Text>
                              <Text style={[s.tablaH, { flex: 1 }]}>{"Salida"}</Text>
                              <Text style={[s.tablaH, { width: 60 }]}>{"Total"}</Text>
                              <Text style={[s.tablaH, { width: 70 }]}>{""}</Text>
                            </View>
                            {(fichajesPorDia[selectedDay] || []).map((f: any, idx: number) => (
                              <View key={f.id || idx} style={[s.tablaRow, idx % 2 === 0 && { backgroundColor: COLORS.readonly }]}>
                                {editingId === f.id ? (
                                  <>
                                    <TextInput style={[s.tablaTd, s.inputInline, { flex: 1 }]} value={editEntrada} onChangeText={setEditEntrada} placeholder="--:--" placeholderTextColor={COLORS.textDisabled} />
                                    <TextInput style={[s.tablaTd, s.inputInline, { flex: 1 }]} value={editSalida} onChangeText={setEditSalida} placeholder="--:--" placeholderTextColor={COLORS.textDisabled} />
                                    <Text style={[s.tablaTd, { width: 60 }]}>{f.total}</Text>
                                    <View style={[{ width: 70, flexDirection: "row", gap: 8 }]}>
                                      <TouchableOpacity onPress={() => guardarEdicion(f.id)}><Ionicons name="checkmark" size={18} color={ios.colors.green} /></TouchableOpacity>
                                      <TouchableOpacity onPress={() => setEditingId(null)}><Ionicons name="close" size={18} color={ios.colors.red} /></TouchableOpacity>
                                    </View>
                                  </>
                                ) : (
                                  <>
                                    <Text style={[s.tablaTd, { flex: 1 }]}>{f.entrada || "-"}</Text>
                                    <Text style={[s.tablaTd, { flex: 1 }]}>{f.salida || "-"}</Text>
                                    <Text style={[s.tablaTd, { width: 60 }]}>{f.total}</Text>
                                    <View style={[{ width: 70, flexDirection: "row", gap: 8 }]}>
                                      <TouchableOpacity onPress={() => { setEditingId(f.id); setEditEntrada(f.entrada || ""); setEditSalida(f.salida || ""); }}>
                                        <Ionicons name="create-outline" size={16} color={COLORS.primary} />
                                      </TouchableOpacity>
                                      <TouchableOpacity onPress={() => eliminarFichaje(f.id)}>
                                        <Ionicons name="trash-outline" size={16} color={ios.colors.red} />
                                      </TouchableOpacity>
                                    </View>
                                  </>
                                )}
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    )}
                  </>
                )}
              </>
            )}
          </View>
        )}

        {/* TAB 3: Vacaciones */}
        {tab === "vacaciones" && (
          <View style={{ gap: 12 }}>
            {vacLoading ? (
              <ActivityIndicator color={COLORS.primary} style={{ marginTop: 20 }} />
            ) : (
              <>
                <Text style={s.seccionTit}>{"Pendientes de aprobar"}</Text>
                {vacaciones.filter((v) => v.estado === "pendiente").length === 0 ? (
                  <Text style={s.emptyText}>{"Sin datos"}</Text>
                ) : (
                  vacaciones.filter((v) => v.estado === "pendiente").map((v) => (
                    <View key={v.id} style={s.vacCard}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.vacUser}>{v.user_name || v.user_id}</Text>
                        <Text style={s.vacFechas}>
                          {v.tipo === "vacaciones" ? "Vacaciones" : "Ausencia"}: {v.fecha_inicio} → {v.fecha_fin} ({v.dias || "?"}{" días"})
                        </Text>
                        {v.motivo ? <Text style={s.vacMotivo}>{v.motivo}</Text> : null}
                      </View>
                      <View style={s.vacBtns}>
                        <TouchableOpacity style={[s.vacBtn, { backgroundColor: ios.colors.green }]} onPress={() => gestionarVacacion(v.id, "aprobada")}>
                          <Ionicons name="checkmark" size={18} color="#fff" />
                        </TouchableOpacity>
                        <TouchableOpacity style={[s.vacBtn, { backgroundColor: ios.colors.red }]} onPress={() => gestionarVacacion(v.id, "rechazada")}>
                          <Ionicons name="close" size={18} color="#fff" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                )}

                <Text style={[s.seccionTit, { marginTop: 8 }]}>{"Historial de solicitudes"}</Text>
                {vacaciones.filter((v) => v.estado !== "pendiente").length === 0 ? (
                  <Text style={s.emptyText}>{"Sin datos"}</Text>
                ) : (
                  vacaciones.filter((v) => v.estado !== "pendiente").map((v) => (
                    <View key={v.id} style={[s.vacCard, v.estado === "aprobada" ? s.vacAprobada : s.vacRechazada]}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.vacUser}>{v.user_name || v.user_id}</Text>
                        <Text style={s.vacFechas}>
                          {v.tipo === "vacaciones" ? "Vacaciones" : "Ausencia"}: {v.fecha_inicio} → {v.fecha_fin}
                        </Text>
                      </View>
                      <View style={[s.estadoChip, v.estado === "aprobada" ? s.estadoAprob : s.estadoRech]}>
                        <Text style={s.estadoChipText}>{v.estado}</Text>
                      </View>
                    </View>
                  ))
                )}
              </>
            )}
          </View>
        )}

        {/* TAB 4: Exportar */}
        {tab === "exportar" && (
          <View style={{ gap: 14 }}>
            <Text style={s.seccionTit}>{"Exportar fichajes"}</Text>

            <View style={s.formCard}>
              <Text style={s.formLabel}>{"Mes"}:</Text>
              <View style={s.pickerWrap}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {mesesDropdown().map((m, i) => (
                    <TouchableOpacity
                      key={i}
                      style={[s.chip, exportMesSel === i && s.chipActive]}
                      onPress={() => setExportMesSel(i)}
                    >
                      <Text style={[s.chipText, exportMesSel === i && { color: "#fff" }]}>{m.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <Text style={s.formLabel}>{"Período"}:</Text>
              <View style={s.formRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.formLabelSm}>{"Desde"}</Text>
                  <TextInput
                    style={s.input}
                    value={exportDesde}
                    onChangeText={setExportDesde}
                    placeholder={"YYYY-MM-DD"}
                    placeholderTextColor={COLORS.textDisabled}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.formLabelSm}>{"Hasta"}</Text>
                  <TextInput
                    style={s.input}
                    value={exportHasta}
                    onChangeText={setExportHasta}
                    placeholder={"YYYY-MM-DD"}
                    placeholderTextColor={COLORS.textDisabled}
                  />
                </View>
              </View>

              <Text style={s.formLabel}>{"Usuario"}:</Text>              <View style={s.pickerWrap}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  <TouchableOpacity
                    style={[s.chip, !exportUsuario && s.chipActive]}
                    onPress={() => setExportUsuario("")}
                  >
                    <Text style={[s.chipText, !exportUsuario && { color: "#fff" }]}>{"Todos"}</Text>
                  </TouchableOpacity>
                  {usuarios.map((u) => (
                    <TouchableOpacity
                      key={u.id}
                      style={[s.chip, exportUsuario === u.id && s.chipActive]}
                      onPress={() => setExportUsuario(u.id)}
                    >
                      <Text style={[s.chipText, exportUsuario === u.id && { color: "#fff" }]}>{u.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity style={s.btnOutline} onPress={previewExportar} activeOpacity={0.7}>
                  <Ionicons name="eye" size={16} color={COLORS.primary} />
                  <Text style={s.btnOutlineText}>{"Previsualizar"}</Text>
                </TouchableOpacity>
                {typeof document !== "undefined" && (
                  <TouchableOpacity style={s.btnPrimary} onPress={descargarCSV} activeOpacity={0.7}>
                    <Ionicons name="download" size={16} color="#fff" />
                    <Text style={s.btnPrimaryText}>{"Descargar CSV"}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {exportPreview.length > 0 && (
              <View style={{ gap: 8 }}>
                <Text style={s.seccionTit}>{"Vista previa"} ({exportPreview.length} {"Vista previa"})</Text>
                <ScrollView horizontal>
                  <View>
                    <View style={s.tablaHRow}>
                      {Object.keys(exportPreview[0] || {}).map((k) => (
                        <Text key={k} style={[s.tablaH, { width: 110 }]}>{k}</Text>
                      ))}
                    </View>
                    {exportPreview.slice(0, 20).map((row, i) => (
                      <View key={i} style={[s.tablaRow, i % 2 === 0 && { backgroundColor: COLORS.readonly }]}>
                        {Object.values(row).map((v: any, j) => (
                          <Text key={j} style={[s.tablaTd, { width: 110 }]}>{String(v)}</Text>
                        ))}
                      </View>
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}
          </View>
        )}

      </ScrollView>

      {/* Modal crear fichaje */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>{"Nuevo fichaje"}</Text>
            <Text style={s.modalSub}>
              {"Crear fichaje para"} {selectedUser?.name || selectedUserId}
            </Text>

            <Text style={s.formLabel}>{"Fecha"}</Text>
            <TextInput
              style={s.input}
              value={nuevoFecha}
              onChangeText={setNuevoFecha}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={COLORS.textDisabled}
            />

            <Text style={s.formLabel}>{"Hora entrada"}</Text>
            <TextInput
              style={s.input}
              value={nuevoEntrada}
              onChangeText={setNuevoEntrada}
              placeholder="HH:MM"
              placeholderTextColor={COLORS.textDisabled}
            />

            <Text style={s.formLabel}>{"Hora salida"}</Text>
            <TextInput
              style={s.input}
              value={nuevoSalida}
              onChangeText={setNuevoSalida}
              placeholder="HH:MM"
              placeholderTextColor={COLORS.textDisabled}
            />

            <View style={s.modalBtns}>
              <TouchableOpacity
                style={s.btnOutline}
                onPress={() => setModalVisible(false)}
              >
                <Text style={s.btnOutlineText}>{"Cancelar"}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.btnPrimary} onPress={crearFichaje}>
                <Text style={s.btnPrimaryText}>{"Crear"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );

  return (
    <ResponsiveLayout active="fichajes">
      {content}
    </ResponsiveLayout>
  );
}

const useS = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },

  headerBar: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text,
  },
  headerBack: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingRight: 8,
  },
  headerBackLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: "500",
  },

  kpiRow: {
    flexDirection: "row",
    padding: 10,
    gap: 8,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  kpiCard: {
    flex: 1,
    alignItems: "center",
    padding: 10,
    backgroundColor: COLORS.bg,
    borderRadius: 10,
    gap: 2,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  kpiVal: { fontSize: 18, fontWeight: "800", color: COLORS.text },
  kpiLabel: { fontSize: 10, color: COLORS.textDisabled, fontWeight: "500" },

  tabs: {
    flexDirection: "row",
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tabBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: COLORS.bg,
  },
  tabBtnActive: { backgroundColor: COLORS.primary },
  tabBtnTxt: { fontSize: 12, fontWeight: "600", color: COLORS.textSecondary },
  tabBtnTxtActive: { color: "#fff" },

  body: { padding: 14, paddingBottom: 60 },

  searchInput: {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  userRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  userName: { fontSize: 15, fontWeight: "700", color: COLORS.text },
  userEmail: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  userStats: {
    flexDirection: "row",
    gap: 10,
    paddingRight: 4,
  },
  statItem: { alignItems: "center", gap: 2 },
  statLabel: { fontSize: 9, color: COLORS.textDisabled, fontWeight: "500", textTransform: "uppercase" },
  statVal: { fontSize: 12, fontWeight: "700", color: COLORS.text },

  formRow: { flexDirection: "row", gap: 10, alignItems: "flex-end" },
  formLabel: { fontSize: 12, fontWeight: "600", color: COLORS.textSecondary, marginBottom: 4 },
  formLabelSm: { fontSize: 11, fontWeight: "600", color: COLORS.textDisabled, marginBottom: 4 },
  formCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  pickerWrap: { flex: 1, maxHeight: 40 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 12, fontWeight: "500", color: COLORS.textSecondary },

  input: {
    backgroundColor: COLORS.bg,
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  totalesRow: { flexDirection: "row", gap: 8 },
  totalCard: {
    flex: 1,
    alignItems: "center",
    padding: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    gap: 2,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  totalVal: { fontSize: 18, fontWeight: "800", color: COLORS.text },
  totalLbl: { fontSize: 10, color: COLORS.textDisabled, fontWeight: "500" },

  detalleHeader: { flexDirection: "row", justifyContent: "flex-end" },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addBtnText: { fontSize: 13, fontWeight: "600", color: "#fff" },

  tablaWrap: { gap: 2 },
  tablaHRow: {
    flexDirection: "row",
    backgroundColor: COLORS.primarySoft,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  tablaH: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.text,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tablaRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  tablaTd: { fontSize: 12, color: COLORS.text },
  inputInline: {
    backgroundColor: COLORS.surface,
    borderRadius: 4,
    padding: 4,
    fontSize: 12,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },

  accionesCol: { flexDirection: "row", gap: 8, justifyContent: "center" },

  seccionTit: { fontSize: 16, fontWeight: "700", color: COLORS.text },
  emptyText: { fontSize: 13, color: COLORS.textDisabled, fontStyle: "italic", padding: 12, textAlign: "center" },

  vacCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  vacAprobada: { borderLeftWidth: 3, borderLeftColor: ios.colors.green },
  vacRechazada: { borderLeftWidth: 3, borderLeftColor: ios.colors.red },
  vacUser: { fontSize: 14, fontWeight: "700", color: COLORS.text },
  vacFechas: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  vacMotivo: { fontSize: 11, color: COLORS.textDisabled, marginTop: 2, fontStyle: "italic" },
  vacBtns: { flexDirection: "row", gap: 8 },
  vacBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },

  estadoChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  estadoAprob: { backgroundColor: ios.colors.green + "22" },
  estadoRech: { backgroundColor: ios.colors.red + "22" },
  estadoChipText: { fontSize: 11, fontWeight: "600", color: COLORS.text },

  btnPrimary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 12,
  },
  btnPrimaryText: { fontSize: 14, fontWeight: "700", color: "#fff" },
  btnOutline: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 10,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  btnOutlineText: { fontSize: 14, fontWeight: "600", color: COLORS.primary },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 20,
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: COLORS.text },
  modalSub: { fontSize: 13, color: COLORS.textSecondary },
  modalBtns: { flexDirection: "row", gap: 8, marginTop: 8 },

  // Calendario
  calNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  calNavTitulo: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text,
    textTransform: "capitalize",
  },
  calGridWrap: {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  calSemanaRow: {
    flexDirection: "row",
    marginBottom: 2,
  },
  calSemanaCell: {
    width: "14.28%",
    alignItems: "center",
    paddingVertical: 3,
  },
  calSemanaTxt: {
    fontSize: 9,
    fontWeight: "700",
    color: COLORS.textDisabled,
    textTransform: "uppercase",
  },
  calGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  calDay: {
    width: "14.28%",
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 4,
    padding: 1,
  },
  calDayNum: {
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.text,
  },
  calDayDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },
  calDayHoras: {
    fontSize: 7,
    fontWeight: "700",
    color: COLORS.primary,
    marginTop: 1,
  },
  dayDetailWrap: {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dayDetailHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dayDetailTitulo: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text,
  },
});

---
## 4. API Client — `src/api.ts` (fragmentos)
  getModulosOrder: () => request("/auth/modulos-order"),
  updateModulosOrder: (modulos_order: string[]) =>
    request("/auth/modulos-order", { method: "PATCH", body: JSON.stringify({ modulos_order }) }),
  listMateriales: (q?: string, pendingOnly?: boolean, managerId?: string, unassigned?: boolean, projectStatus?: string, year?: string, month?: string) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (pendingOnly) p.set("pending_only", "true");
--
  // Fichajes
  fichajeCrear: (body: { tipo: string; lat?: number; lng?: number; dispositivo?: string }) =>
    request("/fichajes", { method: "POST", body: JSON.stringify(body) }),
  fichajeEditar: (fichajeId: string, entrada?: string, salida?: string) =>
    request(`/fichajes/${fichajeId}`, { method: "PUT", body: JSON.stringify({ entrada: entrada || null, salida: salida || null }) }),
  fichajeEliminar: (fichajeId: string) =>
    request(`/fichajes/${fichajeId}`, { method: "DELETE" }),
  fichajesListar: (user_id?: string, from?: string, to?: string) => {
    const p = new URLSearchParams();
    if (user_id) p.set("user_id", user_id);
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    const qs = p.toString();
    return request(`/fichajes${qs ? "?" + qs : ""}`);
  },
  fichajesAdminUsuarios: () => request("/fichajes/admin/usuarios"),
  fichajesAdminDetalle: (userId: string, desde: string, hasta: string) =>
    request(`/fichajes/admin/detalle/${userId}?desde=${desde}&hasta=${hasta}`),
  fichajesAdminEditar: (fichajeId: string, entrada: string | null, salida: string | null) =>
    request(`/fichajes/admin/editar/${fichajeId}`, { method: "PUT", body: JSON.stringify({ entrada, salida }) }),
  fichajesAdminCrear: (userId: string, fecha: string, entrada: string, salida: string) =>
    request("/fichajes/admin/crear", { method: "POST", body: JSON.stringify({ user_id: userId, fecha, entrada, salida }) }),
  fichajesAdminEliminar: (fichajeId: string) =>
    request(`/fichajes/admin/eliminar/${fichajeId}`, { method: "DELETE" }),
  fichajesAdminVacaciones: (userId?: string) =>
    request(`/fichajes/admin/vacaciones${userId ? "?user_id=" + userId : ""}`),
  fichajesAdminVacacionesGestionar: (vacId: string, estado: string) =>
    request(`/fichajes/admin/vacaciones/${vacId}`, { method: "PUT", body: JSON.stringify({ estado }) }),
  fichajesAdminExportar: async (desde: string, hasta: string, userId?: string) => {
    const t = await getToken();
    const res = await fetch(apiUrl(`/fichajes/admin/exportar?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}${userId ? `&user_id=${encodeURIComponent(userId)}` : ""}`), { headers: t ? { Authorization: `Bearer ${t}` } : {} });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
  },
  vacacionesSolicitar: (body: { fecha_inicio: string; fecha_fin: string; tipo: string; motivo?: string }) =>
    request("/vacaciones", { method: "POST", body: JSON.stringify(body) }),
  vacacionesListar: () => request("/vacaciones"),
  vacacionesSaldo: (user_id: string) => request(`/vacaciones/saldo/${user_id}`),
  configFichajes: () => request("/config-fichajes"),
  updateConfigFichajes: (body: any) => request("/config-fichajes", { method: "PUT", body: JSON.stringify(body) }),

  // Muestrario
  getMuestrario: () => request("/muestrario"),

  // Solicitudes de presupuesto (cliente)

---
## 5. Permisos — `src/permissions.ts`
/**
 * Permissions helper — provides a single source of truth for what
 * the current user can do, derived from `/api/auth/me`.
 *
 * Usage:
 *   const { perms, has, ready } = usePermissions();
 *   if (has("calendario.edit")) { ... }
 */
import { useEffect, useState, useCallback } from "react";
import { api } from "./api";

export type PermissionKey =
  | "proyectos.view" | "proyectos.edit" | "proyectos.editar_campo"
  | "calendario.view" | "calendario.edit" | "calendario.assign" | "events.edit"
  | "planos.view" | "planos.edit" | "planos.download"
  | "presupuestos.view" | "presupuestos.edit" | "presupuestos.export"
  | "sat.view" | "sat.edit" | "sat.export"
  | "chat.view" | "chat.edit"
  | "users.manage" | "roles.manage" | "onedrive.manage"
  | "preciario.view" | "preciario.ver_precios" | "preciario.edit"
  | "notas.view"
  | "documentos.manage"
  | "fichajes.view" | "fichajes.manage" | "fichajes.edit_own"
  | "certificaciones.view" | "certificaciones.edit"
  | "clientes.view" | "clientes.edit"
  | "dashboard.view"
  | "materiales.view_hours";

export type Me = {
  id: string;
  email: string;
  name?: string;
  role: string;          // legacy: "admin" | "user" | "comercial"
  role_id?: string | null;
  role_name?: string | null;
  permissions?: string[] | null;
  color?: string | null;
};

export function usePermissions() {
  const [me, setMe] = useState<Me | null>(null);
  const [ready, setReady] = useState(false);

  const reload = useCallback(async () => {
    try {
      const u = await api.me();
      setMe(u as Me);
    } catch {
      setMe(null);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const perms: string[] = me?.permissions || [];
  const has = useCallback((p: PermissionKey | string) => perms.includes(p), [perms]);
  const isAdmin = me?.role === "admin"; // legacy/full-access flag
  const isSuperAdmin = !!(me?.permissions || []).includes("users.manage")
    && !!(me?.permissions || []).includes("roles.manage");

  return { me, perms, has, isAdmin, isSuperAdmin, ready, reload };
}

/**
 * Given a list of permissions, decide which tab keys to show in the
 * bottom/side navigation. Order is the global navigation order.
 */
export type NavItem =
  | "home" | "dashboard" | "calendario" | "planos" | "proyectos"
  | "presupuestos" | "chat" | "sat" | "ajustes" | "fichajes";

export function visibleNav(perms: string[]): NavItem[] {
  const items: NavItem[] = ["home", "dashboard"]; // home + dashboard siempre visibles
  if (perms.includes("calendario.view")) items.push("calendario");
  if (perms.includes("planos.view")) items.push("planos");
  if (perms.includes("proyectos.view")) items.push("proyectos");
  if (perms.includes("presupuestos.view")) items.push("presupuestos");
  if (perms.includes("chat.view")) items.push("chat");
  if (perms.includes("sat.view")) items.push("sat");
  if (perms.includes("fichajes.view")) items.push("fichajes");
  // Ajustes is visible to everyone (theme + portfolio etc)
  items.push("ajustes");
  return items;
}
