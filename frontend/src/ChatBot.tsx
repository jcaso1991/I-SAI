import { useState, useMemo, useEffect } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, TextInput } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";
import { COLORS } from "./api";
import { usePermissions } from "./permissions";
import { ios } from "./ui/iosTheme";

interface FAQItem {
  q: string;
  r: string;
  tags: string[];
  keywords: string[];
  route?: string;     // e.g. "/materiales" or "/fichajes"
  routeLabel?: string; // e.g. "Ir a Proyectos"
  perm?: string;       // permission key required to show this FAQ
}

const FAQ: FAQItem[] = [
  // ═══════════ INICIO / DASHBOARD ═══════════
  { q: "¿Qué veo en la pantalla principal?", r: "Al iniciar sesión ves: un saludo con tu nombre, la fecha actual, los 'Módulos de Gestión' (accesos directos a todas las secciones), y si eres admin/gestor, widgets del dashboard con KPIs. Los módulos se pueden reordenar pulsando 'Editar'.", tags: ["inicio", "dashboard"], keywords: ["inicio", "pantalla", "principal", "home", "dashboard", "módulos"], route: "/", routeLabel: "Ir al Inicio", perm: null },
  { q: "¿Cómo reordeno los módulos de la pantalla principal?", r: "Junto al título 'Módulos de Gestión' hay un botón 'Editar'. Al pulsarlo entras en modo reordenación. Toca un módulo para seleccionarlo (borde azul punteado), luego toca otro para intercambiarlos. El orden se guarda automáticamente por usuario y persiste entre sesiones.", tags: ["inicio", "dashboard"], keywords: ["reordenar", "módulos", "editar", "orden", "mover", "cambiar", "organizar"], route: "/", routeLabel: "Ir al Inicio", perm: null },
  { q: "¿Cómo cierro sesión?", r: "En móvil: icono de puerta (↗) en la esquina superior derecha. En escritorio: mismo icono en la barra superior. También puedes cerrar sesión desde el icono de logout en el sidebar.", tags: ["inicio", "perfil"], keywords: ["cerrar", "sesión", "logout", "salir", "desconectar"], route: "/", routeLabel: "Ir al Inicio", perm: null },

  // ═══════════ PROYECTOS ═══════════
  { q: "¿Cómo creo un proyecto nuevo?", r: "1. Ve a 'Proyectos' en el menú lateral o módulos centrales.\n2. Pulsa el botón '+' en la esquina superior derecha.\n3. Rellena: código del proyecto, cliente, ubicación, horas previstas, comercial y gestor.\n4. Pulsa 'Crear'.\n\nTambién puedes crear proyectos desde la importación Excel o desde OneDrive sincronizado.", tags: ["proyectos"], keywords: ["crear", "nuevo", "proyecto", "obra", "alta", "añadir"], route: "/materiales", routeLabel: "Ir a Proyectos", perm: "proyectos.view" },
  { q: "¿Cómo edito un proyecto?", r: "Abre el proyecto desde la lista tocando su nombre. Dentro puedes editar:\n• Datos básicos: fechas, técnico, comentarios\n• Financiero: venta prevista materiales y mano de obra, costes previstos y reales, ingreso facturado\n• Logística: pedido realizado (sí/no), fecha entrega, nº pedido, planificación, facturación\n• Estado del proyecto\n• Adjuntos (arrastrar y soltar)\n\nPulsa 'GUARDAR CAMBIOS' al terminar. Los cambios quedan registrados en el historial.", tags: ["proyectos"], keywords: ["editar", "modificar", "cambiar", "proyecto", "actualizar", "estado"], route: "/materiales", routeLabel: "Ir a Proyectos", perm: "proyectos.view" },
  { q: "¿Cómo filtro proyectos?", r: "En la lista de proyectos tienes filtros combinados:\n• Por gestor asignado\n• Por estado: pendiente, planificado, a facturar, facturado, terminado, bloqueado, anulado\n• Por año y mes\n\nPuedes usar varios filtros a la vez. El botón 'Sin asignar' muestra proyectos sin gestor.", tags: ["proyectos"], keywords: ["filtrar", "buscar", "gestor", "estado", "año", "mes", "pendiente", "terminado"], route: "/materiales", routeLabel: "Ir a Proyectos", perm: "proyectos.view" },
  { q: "¿Cómo exporto proyectos a Excel?", r: "En la lista de proyectos, pulsa el botón de Excel (📥) en la barra superior. Se descarga un archivo .xlsx con todos los proyectos visibles según los filtros activos. Incluye 20+ columnas con todos los datos.", tags: ["proyectos"], keywords: ["exportar", "excel", "descargar", "lista", "xlsx"], route: "/materiales", routeLabel: "Ir a Proyectos", perm: "proyectos.view" },
  { q: "¿Cómo funciona el seguimiento de materiales del proyecto?", r: "Cada proyecto tiene una sección 'Materiales del proyecto' (bajo el historial de cambios). Aquí puedes:\n• Añadir materiales con nombre y cantidad prevista\n• Ver la cantidad instalada (se actualiza automáticamente)\n• Eliminar materiales\n\nLos materiales se vinculan con los eventos del calendario. Cuando un técnico completa un evento y marca materiales como instalados, la cantidad se suma automáticamente al proyecto.", tags: ["proyectos", "materiales"], keywords: ["materiales", "proyecto", "instalado", "prevista", "cantidad", "seguimiento", "lista"], route: "/materiales", routeLabel: "Ir a Proyectos", perm: "proyectos.view" },
  { q: "¿Qué pasa cuando un proyecto se marca como terminado?", r: "Al cambiar el estado del proyecto a 'terminado':\n1. Todos los materiales con cantidad instalada > 0 se copian al cliente\n2. El cliente acumula un historial de materiales instalados con fecha y proyecto\n3. Puedes ver este historial en la ficha del cliente > 'Materiales Instalados'\n\nSi vuelves a cambiar el estado, no se duplica la información.", tags: ["proyectos", "cliente"], keywords: ["terminado", "finalizado", "cerrar", "cliente", "materiales", "historial"], route: "/materiales", routeLabel: "Ir a Proyectos", perm: "proyectos.view" },
  { q: "¿Qué significan los estados de un proyecto?", r: "• Pendiente: recién creado, sin empezar\n• Planificado: asignado a técnicos, con fechas\n• A facturar: listo para emitir factura\n• Facturado: factura emitida\n• Terminado: obra finalizada\n• Bloqueado: pausado temporalmente\n• Anulado: cancelado\n\nEl estado se cambia desde la ficha del proyecto con los chips de colores.", tags: ["proyectos"], keywords: ["estado", "pendiente", "planificado", "facturado", "terminado", "bloqueado", "anulado"], route: "/materiales", routeLabel: "Ir a Proyectos", perm: "proyectos.view" },
  { q: "¿Cómo veo el historial de cambios de un proyecto?", r: "En la ficha del proyecto, al final hay una sección 'Historial de cambios'. Muestra: fecha, usuario, campo modificado, valor anterior y valor nuevo. Cada edición queda registrada.", tags: ["proyectos"], keywords: ["historial", "cambios", "registro", "auditoría", "quién", "cuándo"], route: "/materiales", routeLabel: "Ir a Proyectos", perm: "proyectos.view" },

  // ═══════════ CALENDARIO ═══════════
  { q: "¿Cómo creo un evento en el calendario?", r: "1. Ve a 'Calendario'\n2. Pulsa el botón '+'\n3. Puedes crear en modo 'texto libre' (título manual) o 'Desde proyecto' (vinculado a un proyecto existente)\n4. Si vinculas a proyecto: asigna técnicos, horas, tipo de mano de obra, gestor\n5. Puedes configurar repetición (diaria, semanal, etc.)\n6. Pulsa 'Crear evento'\n\nTambién puedes crear eventos arrastrando en la vista semanal.", tags: ["calendario"], keywords: ["crear", "evento", "cita", "calendario", "agenda", "planificar", "nuevo"], route: "/calendario", routeLabel: "Ir a Calendario", perm: "calendario.view" },
  { q: "¿Cómo completo un evento?", r: "1. Abre el evento en el calendario\n2. Rellena el campo 'Seguimiento' con las observaciones del trabajo realizado\n3. Indica las horas trabajadas\n4. Selecciona el tipo de mano de obra (obra, SAT, desplazamiento...)\n5. Cambia el estado a 'Completado' o 'Pendiente de terminar'\n6. Si el evento tiene proyecto vinculado, puedes marcar materiales como instalados\n\nNota: para completar un evento es obligatorio poner seguimiento, horas (>0) y tipo de mano de obra.", tags: ["calendario"], keywords: ["completar", "terminar", "evento", "seguimiento", "horas", "estado", "finalizar"], route: "/calendario", routeLabel: "Ir a Calendario", perm: "calendario.view" },
  { q: "¿Cómo funcionan las vistas del calendario?", r: "El calendario tiene 5 vistas:\n• Día: columnas horarias de 7:00 a 20:00\n• Semana: vista semanal con drag & drop\n• Equipo: columna por técnico\n• Mes: vista mensual compacta\n• Gestor: lista clasificable por proyecto\n\nUsa los botones superiores para cambiar de vista. En escritorio puedes arrastrar y redimensionar eventos.", tags: ["calendario"], keywords: ["vistas", "día", "semana", "mes", "equipo", "gestor", "arrastrar", "drag"], route: "/calendario", routeLabel: "Ir a Calendario", perm: "calendario.view" },
  { q: "¿Cómo se usan las guardias?", r: "Las guardias permiten asignar técnicos de guardia por día. Se gestionan desde el calendario en la sección de guardias. No cuentan como eventos normales ni afectan al cálculo de horas.", tags: ["calendario"], keywords: ["guardia", "guardias", "técnico", "día", "asignar"], route: "/calendario", routeLabel: "Ir a Calendario", perm: "calendario.view" },

  // ═══════════ FICHAJES ═══════════
  { q: "¿Cómo ficho la entrada y salida?", r: "Ve a 'Fichajes' > pestaña 'Fichar':\n1. Verás un reloj digital con la hora actual\n2. Pulsa 'Entrada' al comenzar tu jornada\n3. Pulsa 'Salida' al terminar\n4. La app registra la hora exacta\n\nDebajo del reloj verás:\n• Resumen semanal, mensual y anual de horas trabajadas\n• Lista de fichajes del día actual", tags: ["fichajes"], keywords: ["fichar", "entrada", "salida", "reloj", "hora", "jornada", "comenzar", "empezar"], route: "/fichajes", routeLabel: "Ir a Fichajes", perm: "fichajes.view" },
  { q: "¿Cómo funciona la pausa?", r: "Durante tu jornada puedes hacer pausas:\n1. Pulsa 'Pausa' para iniciar un descanso\n2. Pulsa 'Fin pausa' para reanudar el trabajo\n\nEl sistema registra cada pausa como un evento independiente. Las pausas no descuentan horas del cómputo total, solo separan bloques de trabajo.", tags: ["fichajes"], keywords: ["pausa", "descanso", "reanudar", "parar", "continuar"], route: "/fichajes", routeLabel: "Ir a Fichajes", perm: "fichajes.view" },
  { q: "¿Cómo solicito vacaciones?", r: "Ve a 'Fichajes' > pestaña 'Vacaciones':\n1. Verás tu saldo de días disponibles (22 días anuales por defecto)\n2. Introduce la fecha de inicio y fecha de fin (formato YYYY-MM-DD)\n3. Selecciona el tipo: 'Vacaciones' o 'Ausencia'\n4. Escribe un motivo\n5. Pulsa 'Enviar solicitud'\n\nUn administrador o gestor revisará tu solicitud y la aprobará o rechazará. Verás el estado en el historial.", tags: ["fichajes", "vacaciones"], keywords: ["vacaciones", "solicitar", "días", "saldo", "ausencia", "permiso", "libres"], route: "/fichajes", routeLabel: "Ir a Fichajes", perm: "fichajes.view" },
  { q: "¿Cómo veo mi calendario mensual de fichajes?", r: "Ve a 'Fichajes' > pestaña 'Mensual':\n• Verás un calendario del mes actual con navegación a meses anteriores (hasta 1 año)\n• Días en verde = jornada completa (entrada y salida registradas)\n• Días en amarillo = jornada incompleta (solo entrada)\n• Días en gris = sin fichajes\n• Debajo de cada día aparece el total de horas\n• Toca un día para ver el detalle de los fichajes de esa fecha\n• Arriba se muestran los totales del mes (horas y días trabajados)", tags: ["fichajes"], keywords: ["calendario", "mensual", "mes", "vista", "fichajes", "horas", "día"], route: "/calendario", routeLabel: "Ir a Calendario", perm: "calendario.view" },
  { q: "¿Puedo editar o borrar un fichaje?", r: "Sí, si tienes el permiso 'fichajes.edit_own':\n• En la lista 'Fichajes de hoy', cada registro tiene iconos de lápiz (editar) y papelera (borrar)\n• En la vista Mensual, toca un día y verás los mismos iconos\n• Sin el permiso, solo puedes borrar fichajes del día actual\n• Los administradores pueden editar/borrar cualquier fichaje desde el panel Admin", tags: ["fichajes"], keywords: ["editar", "borrar", "corregir", "error", "modificar", "eliminar", "fichaje"], route: "/fichajes", routeLabel: "Ir a Fichajes", perm: "fichajes.view" },
  { q: "¿Qué veo en el panel de administración de fichajes?", r: "El panel Admin (solo admin/gestor) tiene 4 pestañas:\n• Resumen: lista de todos los usuarios con sus horas hoy, semana y mes. KPIs interactivos (pulsa 'Fichados hoy' para filtrar)\n• Detalle: calendario por usuario. Toca un día para ver/editar/borrar sus fichajes. Botón 'Añadir' para crear fichajes manuales\n• Vacaciones: aprobar o rechazar solicitudes pendientes\n• Exportar: selecciona mes y usuario, previsualiza y descarga CSV", tags: ["fichajes", "admin"], keywords: ["admin", "administración", "gestionar", "usuarios", "csv", "exportar", "panel"], route: "/fichajes", routeLabel: "Ir a Fichajes", perm: "fichajes.view" },

  // ═══════════ CLIENTES ═══════════
  { q: "¿Cómo creo un cliente?", r: "Ve a 'Clientes' > botón '+':\n1. Rellena: nombre, razón social, tipo de documento (NIF/CIF), número de documento\n2. Dirección, provincia, población\n3. Representante, teléfono, email\n4. Datos de mantenimiento y Salto KS (opcionales)\n5. Pulsa 'Guardar'", tags: ["clientes"], keywords: ["crear", "cliente", "nuevo", "añadir", "alta", "registrar"], route: "/clientes", routeLabel: "Ir a Clientes", perm: "clientes.view" },
  { q: "¿Qué información veo en la ficha de un cliente?", r: "La ficha del cliente muestra:\n• Datos fiscales y de contacto\n• Direcciones múltiples\n• Mantenimiento contratado: tipo (Anual/Trimestral/Semestral/A medida), fecha alta, revisiones, alertas\n• Salto KS: activo, tipo de renovación, fecha de vencimiento\n• Proyectos asociados (clickables)\n• Incidencias SAT reportadas\n• Materiales instalados (historial de todos sus proyectos terminados)\n• Documentación adjunta", tags: ["clientes"], keywords: ["ficha", "cliente", "detalle", "ver", "información", "datos"], route: "/clientes", routeLabel: "Ir a Clientes", perm: "clientes.view" },
  { q: "¿Cómo funciona la alerta de mantenimiento?", r: "Cada cliente puede tener un mantenimiento contratado con fecha de alta. 30 días antes del aniversario de esa fecha, el sistema genera automáticamente una incidencia SAT de tipo 'Renovar mantenimiento'. Esto asegura que nunca se te pase una renovación.", tags: ["clientes"], keywords: ["mantenimiento", "alerta", "renovación", "automática", "30", "días", "aniversario"], route: "/clientes", routeLabel: "Ir a Clientes", perm: "clientes.view" },
  { q: "¿Cómo funciona Salto KS en clientes?", r: "Si un cliente tiene Salto KS activo, puedes configurar:\n• Tipo de renovación\n• Fecha de renovación del voucher\n\n30 días antes del vencimiento, el sistema genera una notificación y una solicitud de presupuesto automática para renovar el servicio.", tags: ["clientes"], keywords: ["salto", "ks", "voucher", "renovación", "caducidad", "vencimiento", "presupuesto"], route: "/clientes", routeLabel: "Ir a Clientes", perm: "clientes.view" },
  { q: "¿Cómo veo los materiales instalados de un cliente?", r: "En la ficha del cliente, sección 'Materiales Instalados'. Muestra una tabla con:\n• Material (nombre)\n• Cantidad instalada\n• Fecha de terminación del proyecto\n• Proyecto origen\n\nEsta lista se actualiza automáticamente cada vez que un proyecto del cliente pasa a estado 'terminado'. Acumula materiales de todos los proyectos del cliente.", tags: ["clientes", "materiales"], keywords: ["materiales", "instalados", "cliente", "historial", "proyecto", "terminado", "registro"], route: "/clientes", routeLabel: "Ir a Clientes", perm: "clientes.view" },

  // ═══════════ SAT ═══════════
  { q: "¿Cómo creo una incidencia SAT?", r: "Ve a 'SAT' > botón '+':\n1. Selecciona el cliente\n2. Describe la incidencia\n3. Asigna un técnico\n4. La incidencia empieza en estado 'pendiente'\n\nFlujo de estados: pendiente → agendada → resuelta. Cada cambio de estado queda registrado con usuario, fecha y comentario.", tags: ["sat"], keywords: ["sat", "incidencia", "ticket", "crear", "aviso", "técnico", "asistencia"], route: "/sat", routeLabel: "Ir a SAT", perm: "sat.view" },
  { q: "¿Cómo funciona el formulario público de SAT?", r: "Los clientes pueden reportar incidencias sin necesidad de iniciar sesión desde la ruta /aviso-sat. Es un formulario público que crea automáticamente una incidencia en el sistema.", tags: ["sat"], keywords: ["formulario", "público", "cliente", "externo", "aviso", "sat", "reportar"], route: "/sat", routeLabel: "Ir a SAT", perm: "sat.view" },
  { q: "¿Cómo gestiono los mantenimientos SAT?", r: "En SAT > sección Mantenimientos puedes:\n• Ver todos los mantenimientos contratados\n• Crear nuevos mantenimientos para clientes\n• Editar fechas y estados\n• Eliminar mantenimientos\n\nLos mantenimientos están vinculados a los clientes y generan alertas automáticas.", tags: ["sat"], keywords: ["mantenimiento", "sat", "contratado", "gestionar", "crear", "editar"], route: "/sat", routeLabel: "Ir a SAT", perm: "sat.view" },

  // ═══════════ PRESUPUESTOS ═══════════
  { q: "¿Cómo creo un presupuesto?", r: "Ve a 'Presupuestos' > 'Nuevo Presupuesto':\n1. Rellena los datos del proyecto: nº proyecto, cliente, nombre instalación, dirección, contactos\n2. Añade observaciones y fechas de instalación\n3. En 'Listado de Equipos', añade los materiales con cantidad, ubicación y observaciones\n4. Marca las entregas (tarjeta mantenimiento, llave Salto, EPS100)\n5. Firma digitalmente (cliente e I-SAI)\n6. Adjunta documentos\n\nEl presupuesto se crea en estado 'Pendiente'.", tags: ["presupuestos"], keywords: ["crear", "presupuesto", "nuevo", "pipeline", "kanban", "presupuestar"], route: "/presupuestos", routeLabel: "Ir a Presupuestos", perm: "presupuestos.view" },
  { q: "¿Cómo funciona el pipeline de presupuestos?", r: "Los presupuestos pasan por 4 estados:\n• Pendiente: recién creado\n• En Revisión: siendo revisado internamente\n• Enviado: enviado al cliente\n• Aceptado: aprobado por el cliente\n\nUsa el botón 'Avanzar etapa' en cada tarjeta. El backend valida que no se salten estados (no puedes aceptar sin haber enviado). También existen los estados 'Rechazado' y 'Facturado'.", tags: ["presupuestos"], keywords: ["pipeline", "estados", "kanban", "pendiente", "revisión", "enviado", "aceptado", "avanzar"], route: "/presupuestos", routeLabel: "Ir a Presupuestos", perm: "presupuestos.view" },
  { q: "¿Cómo exporto un presupuesto a PDF?", r: "Dentro del presupuesto, pulsa el botón de PDF en la barra superior. El sistema genera una 'Hoja de Instalación' con todos los datos: cliente, equipos, fechas, firmas y observaciones.", tags: ["presupuestos"], keywords: ["pdf", "exportar", "hoja", "instalación", "firma", "descargar"], route: "/presupuestos", routeLabel: "Ir a Presupuestos", perm: "presupuestos.view" },
  { q: "¿Cómo vinculo un presupuesto a un proyecto existente?", r: "Desde la lista de presupuestos, en cada tarjeta hay un botón para vincular a un proyecto existente. Busca el proyecto por código o nombre. Una vez vinculado, el presupuesto aparece en la ficha del proyecto.", tags: ["presupuestos"], keywords: ["vincular", "enlazar", "proyecto", "asociar", "presupuesto"], route: "/presupuestos", routeLabel: "Ir a Presupuestos", perm: "presupuestos.view" },

  // ═══════════ PLANOS ═══════════
  { q: "¿Cómo creo un plano?", r: "Ve a 'Planos' > botón '+':\n1. Pon un nombre al plano\n2. Opcionalmente, asígnale un proyecto\n3. El editor se abre con un lienzo en blanco\n\nEn el editor puedes:\n• Dibujar líneas, rectángulos y círculos\n• Añadir sellos predefinidos por categorías\n• Cargar un plano de fondo (PDF o JPG)\n• Usar capas para organizar elementos\n• Ajuste magnético (snap)\n• Deshacer/rehacer (Ctrl+Z / Ctrl+Y)\n• Selector de color en la barra de herramientas", tags: ["planos"], keywords: ["crear", "plano", "dibujo", "editor", "nuevo", "lienzo"], route: "/planos", routeLabel: "Ir a Planos", perm: "planos.view" },
  { q: "¿Cómo exporto un plano?", r: "En el editor de planos, barra superior derecha:\n• Botón de imagen: exporta a JPG\n• Botón de documento: exporta a PDF\n\nTambién puedes rotar el lienzo 90° con el botón de rotación.", tags: ["planos"], keywords: ["exportar", "plano", "jpg", "pdf", "imagen", "descargar", "rotar"], route: "/planos", routeLabel: "Ir a Planos", perm: "planos.view" },
  { q: "¿Cómo funcionan los sellos en planos?", r: "Los sellos son elementos predefinidos que puedes arrastrar al plano. Están organizados por categorías (cámaras, detectores, centrales, etc.). Puedes:\n• Seleccionar una categoría del desplegable\n• Tocar un sello para añadirlo al plano\n• Mover, redimensionar y rotar los sellos colocados\n• Cambiar el color de los sellos desde la barra de herramientas", tags: ["planos"], keywords: ["sellos", "stamps", "predefinidos", "cámaras", "detectores", "categorías"], route: "/planos", routeLabel: "Ir a Planos", perm: "planos.view" },

  // ═══════════ CHAT ═══════════
  { q: "¿Cómo uso el chat?", r: "Ve a 'Chat':\n• Para crear un chat nuevo, pulsa el botón '+' y selecciona los participantes\n• Los chats pueden ser 1-a-1 o en grupo\n• Envía mensajes de texto\n• Adjunta archivos (máx. 10MB)\n• Los mensajes no leídos muestran un badge azul\n• La lista se actualiza con polling", tags: ["chat"], keywords: ["chat", "mensaje", "grupo", "conversación", "adjunto", "archivo", "enviar"], route: "/chat", routeLabel: "Ir a Chat", perm: "chat.view" },

  // ═══════════ DOCUMENTOS ═══════════
  { q: "¿Qué hay en Documentos Internos?", r: "En 'Documentos Internos' encontrarás:\n• Preciario: más de 56.000 productos del sector con referencias, descripciones y precios\n• Fichas técnicas: documentación técnica de equipos\n• Manuales: guías de instalación y configuración\n• Documentos de proyecto: archivos asociados a obras\n\nUsa el buscador para encontrar productos por referencia o descripción.", tags: ["documentos"], keywords: ["documentos", "preciario", "fichas", "manuales", "productos", "referencia", "precio"], route: "/documentos", routeLabel: "Ir a Documentos", perm: "preciario.view" },

  // ═══════════ NOTAS ═══════════
  { q: "¿Cómo uso las notas?", r: "Ve a 'Notas':\n• Crea notas con título, contenido, fecha, prioridad (baja/media/alta/urgente) y etiquetas\n• Puedes anclar notas importantes\n• Archiva notas que ya no necesites\n• Vincula notas a proyectos específicos\n• Hay vista de calendario para notas con fecha\n• 'Notas libres' para texto sin estructura\n• Busca y filtra por prioridad, etiquetas o texto", tags: ["notas"], keywords: ["notas", "crear", "prioridad", "tags", "etiquetas", "anclar", "archivar", "vincular"], route: "/notas", routeLabel: "Ir a Notas", perm: "notas.view" },

  // ═══════════ ADMIN / ROLES / PERMISOS ═══════════
  { q: "¿Cómo gestiono usuarios?", r: "Ve a Ajustes (⚙️) > 'Usuarios':\n• Lista de todos los usuarios con su email, rol y color\n• Crear nuevo usuario: email, nombre, contraseña, rol\n• Editar usuario: cambiar nombre, rol, color\n• Eliminar usuario\n\nLos usuarios heredan los permisos de su rol asignado.", tags: ["admin"], keywords: ["usuarios", "crear", "editar", "eliminar", "gestionar", "roles", "permisos"], route: "/admin", routeLabel: "Ir a Ajustes", perm: null },
  { q: "¿Cómo funcionan los roles y permisos?", r: "I-SAI usa un sistema de permisos granular con 30+ permisos:\n\nRoles predefinidos:\n• Admin: todos los permisos\n• Gestor: todos excepto gestionar usuarios y roles\n• Técnico: ver proyectos asignados, calendario, planos, chat, fichajes, certificaciones\n• Comercial: presupuestos, chat, fichajes\n• SAT: incidencias SAT, chat, fichajes\n\nPuedes crear roles personalizados desde Ajustes > Roles con combinaciones específicas de permisos.", tags: ["admin", "permisos"], keywords: ["roles", "permisos", "admin", "gestor", "técnico", "comercial", "sat", "personalizado"], route: "/sat", routeLabel: "Ir a SAT", perm: "sat.view" },
  { q: "¿Cómo conecto OneDrive?", r: "Ve a Ajustes (⚙️) > 'OneDrive':\n1. Pulsa 'Conectar OneDrive'\n2. Inicia sesión con tu cuenta Microsoft\n3. El sistema sincronizará automáticamente los archivos Excel de proyectos\n\nLa sincronización se ejecuta cada 5 minutos. Puedes forzar una sincronización manual.", tags: ["admin"], keywords: ["onedrive", "conectar", "sincronizar", "microsoft", "excel", "nube"], route: "/admin", routeLabel: "Ir a Ajustes", perm: null },
  { q: "¿Dónde veo la documentación de la aplicación?", r: "Ve a Ajustes (⚙️) > 'Info App'. Aquí encontrarás:\n• Descripción completa de todos los módulos\n• Funcionalidades de cada módulo\n• Roles que pueden acceder\n• Datos técnicos (endpoints, permisos)\n• Relaciones entre módulos y fórmulas\n\nTambién puedes exportar un PDF completo con toda la documentación desde el botón 'Exportar PDF'.", tags: ["admin", "info"], keywords: ["documentación", "info", "app", "portfolio", "módulos", "pdf", "funcionalidades"], route: "/admin", routeLabel: "Ir a Ajustes", perm: null },

  // ═══════════ NAVEGACIÓN / BÚSQUEDA ═══════════
  { q: "¿Cómo busco algo rápidamente?", r: "Usa el atajo Cmd+K (Mac) o Ctrl+K (Windows) para abrir el buscador global. Escribe el nombre de un proyecto, cliente o sección y navega directamente.\n\nTambién puedes buscar desde:\n• La barra de búsqueda de cada módulo\n• Este mismo panel de ayuda (escribe tu duda arriba)", tags: ["navegación"], keywords: ["buscar", "búsqueda", "cmd", "ctrl", "k", "atajo", "global", "rápido"] },
  { q: "¿Cómo funciona la navegación en móvil?", r: "En móvil:\n• Barra inferior con los módulos principales (Inicio, Dashboard, Calendario, Proyectos, etc.)\n• Desliza hacia los lados para ver más pestañas\n• El gesto nativo de volver (swipe) funciona en todas las sub-páginas\n• Las páginas de detalle tienen un botón 'Atrás' en la cabecera", tags: ["navegación"], keywords: ["móvil", "navegación", "barra", "inferior", "pestañas", "swipe", "gesto"] },
  { q: "¿Cómo funciona la navegación en escritorio?", r: "En escritorio:\n• Menú lateral izquierdo con todas las secciones\n• La sección activa se resalta en azul\n• Las sub-páginas muestran un botón 'Atrás' en la cabecera\n• Puedes usar el botón 'Home' para volver al inicio", tags: ["navegación"], keywords: ["escritorio", "menú", "lateral", "sidebar", "web", "pc"] },
];

const SECTIONS = [
  { title: "Inicio / Dashboard", icon: "home", filter: "inicio" },
  { title: "Proyectos y Materiales", icon: "cube", filter: "proyectos" },
  { title: "Calendario y Eventos", icon: "calendar", filter: "calendario" },
  { title: "Fichajes y Vacaciones", icon: "time", filter: "fichajes" },
  { title: "Clientes y Mantenimiento", icon: "people", filter: "clientes" },
  { title: "SAT / Incidencias", icon: "headset", filter: "sat" },
  { title: "Presupuestos", icon: "document-text", filter: "presupuestos" },
  { title: "Planos", icon: "map", filter: "planos" },
  { title: "Chat / Docs / Notas", icon: "apps", filter: "chat" },
  { title: "Admin / Roles / Permisos", icon: "settings", filter: "admin" },
  { title: "Navegación / Búsqueda", icon: "compass", filter: "navegacion" },
];

export default function ChatBot() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const { has } = usePermissions();

  // Filter FAQs by user permissions
  const visibleFAQ = useMemo(() => {
    return FAQ.filter(f => !f.perm || has(f.perm));
  }, [has]);

  const visibleSections = useMemo(() => {
    return SECTIONS.filter(s => visibleFAQ.some(f => f.tags.includes(s.filter)));
  }, [visibleFAQ]);

  useEffect(() => {
    if (pathname === "/login") { setOpen(false); setActiveSection(null); setSearch(""); }
  }, [pathname]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return [];
    const words = q.split(/\s+/).filter((w: string) => w.length > 1);

    // Smart matching: score each FAQ by keyword matches + question text matches
    const scored = visibleFAQ.map(faq => {
      let score = 0;
      const searchText = (faq.keywords.join(" ") + " " + faq.q + " " + faq.tags.join(" ")).toLowerCase();
      for (const w of words) {
        if (searchText.includes(w)) score += 10;
        // Partial match (word starts with)
        for (const kw of faq.keywords) {
          if (kw.startsWith(w) || w.startsWith(kw)) score += 5;
        }
        // Match in question
        if (faq.q.toLowerCase().includes(w)) score += 3;
        // Match in answer
        if (faq.r.toLowerCase().includes(w)) score += 2;
      }
      return { faq, score };
    });

    return scored
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map(s => s.faq);
  }, [search]);

  const sectionFAQs = useMemo(() => {
    if (!activeSection) return [];
    return visibleFAQ.filter(f => f.tags.includes(activeSection));
  }, [activeSection, visibleFAQ]);

  if (!open) {
    return (
      <TouchableOpacity style={s.fab} onPress={() => setOpen(true)} activeOpacity={0.8}>
        <Ionicons name="help-circle" size={26} color="#FFFFFF" />
      </TouchableOpacity>
    );
  }

  return (
    <View style={s.overlay}>
      <View style={s.panel}>
        <View style={s.header}>
          <Text style={s.headerTitle}>Centro de Ayuda I-SAI</Text>
          <TouchableOpacity onPress={() => { setOpen(false); setActiveSection(null); setSearch(""); }}>
            <Ionicons name="close" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <View style={s.searchBar}>
          <Ionicons name="search" size={16} color="#FFFFFF" />
          <TextInput
            style={{ flex: 1, fontSize: 14, color: "#FFFFFF", padding: 0 }}
            placeholder="Escribe tu duda (ej: cómo crear un proyecto, fichar, vacaciones...)"
            placeholderTextColor="rgba(255,255,255,0.5)"
            value={search}
            onChangeText={setSearch}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={16} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
          ) : null}
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12, paddingBottom: 24 }}>
          {search ? (
            <View>
              <Text style={s.resultCount}>{filtered.length} resultado{filtered.length !== 1 ? "s" : ""} para "{search}"</Text>
              {filtered.length === 0 ? (
                <View style={{ padding: 20, alignItems: "center" }}>
                  <Ionicons name="search-outline" size={40} color="#CBD5E1" />
                  <Text style={{ fontSize: 14, color: "#94A3B8", textAlign: "center", marginTop: 8 }}>
                    No encontré resultados. Prueba con otras palabras o navega por categorías.
                  </Text>
                </View>
              ) : (
                filtered.map((faq, i) => (
                  <View key={i} style={s.faqCard}>
                    {faq.q ? <Text style={s.faqQuestion}>{faq.q}</Text> : null}
                    <Text style={s.faqAnswer}>{faq.r}</Text>
                    {faq.route ? (
                      <TouchableOpacity style={s.faqBtn} onPress={() => { setOpen(false); router.push(faq.route as any); }}>
                        <Ionicons name="arrow-forward" size={14} color="#fff" />
                        <Text style={s.faqBtnText}>{faq.routeLabel || "Ir"}</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ))
              )}
            </View>
          ) : activeSection ? (
            <View>
              <TouchableOpacity style={s.backBtn} onPress={() => setActiveSection(null)}>
                <Ionicons name="chevron-back" size={16} color={COLORS.primary} />
                <Text style={s.backBtnText}>Todas las categorías</Text>
              </TouchableOpacity>
              <Text style={{ fontSize: 13, color: "#94A3B8", marginBottom: 10 }}>
                {sectionFAQs.length} artículo{sectionFAQs.length !== 1 ? "s" : ""} en esta categoría
              </Text>
              {sectionFAQs.map((faq, i) => (
                <View key={i} style={s.faqCard}>
                  <Text style={s.faqAnswer}>{faq.r}</Text>
                  {faq.route ? (
                    <TouchableOpacity style={s.faqBtn} onPress={() => { setOpen(false); router.push(faq.route as any); }}>
                      <Ionicons name="arrow-forward" size={14} color="#fff" />
                      <Text style={s.faqBtnText}>{faq.routeLabel || "Ir"}</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ))}
            </View>
          ) : (
            <View>
              <Text style={s.sectionHint}>Selecciona una categoría o escribe tu duda en el buscador</Text>
              {visibleSections.map((sec, i) => (
                <TouchableOpacity
                  key={i}
                  style={s.sectionBtn}
                  onPress={() => setActiveSection(sec.filter)}
                >
                  <Ionicons name={sec.icon as any} size={18} color={COLORS.primary} />
                  <Text style={s.sectionBtnText}>{sec.title}</Text>
                  <Text style={{ fontSize: 12, color: "#94A3B8" }}>{visibleFAQ.filter(f => f.tags.includes(sec.filter)).length}</Text>
                  <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  overlay: { position: "fixed" as any, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 99999, justifyContent: "center", alignItems: "center" },
  panel: { width: 480, maxWidth: "95%", maxHeight: "85%", backgroundColor: "#FFFFFF", borderRadius: 16, overflow: "hidden", ...ios.shadow.elevated },
  fab: { position: "fixed" as any, bottom: 24, right: 24, width: 52, height: 52, borderRadius: 26, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center", zIndex: 99999, ...ios.shadow.elevated },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingVertical: 14 },
  headerTitle: { fontSize: 17, fontWeight: "700", color: "#FFFFFF" },
  searchBar: { flexDirection: "row", alignItems: "center", backgroundColor: "#1E293B", margin: 12, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  resultCount: { fontSize: 12, color: "#94A3B8", marginBottom: 10 },
  sectionHint: { fontSize: 13, color: "#94A3B8", textAlign: "center", padding: 20 },
  sectionBtn: { flexDirection: "row", alignItems: "center", padding: 14, backgroundColor: "#F8FAFC", borderRadius: 10, marginBottom: 6, gap: 10, borderWidth: 1, borderColor: "#E2E8F0" },
  sectionBtnText: { flex: 1, fontSize: 14, fontWeight: "600", color: "#1E293B" },
  backBtn: { flexDirection: "row", alignItems: "center", padding: 8, marginBottom: 8, gap: 4 },
  backBtnText: { fontSize: 14, fontWeight: "600", color: COLORS.primary },
  faqCard: { backgroundColor: "#F8FAFC", borderRadius: 10, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: "#E2E8F0" },
  faqQuestion: { fontSize: 13, fontWeight: "700", color: COLORS.primary, marginBottom: 6 },
  faqAnswer: { fontSize: 13, color: "#334155", lineHeight: 20 },
  faqBtn: {
    flexDirection: "row", alignItems: "center", alignSelf: "flex-start",
    backgroundColor: COLORS.primary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6,
    marginTop: 10, gap: 4,
  },
  faqBtnText: { fontSize: 12, fontWeight: "600", color: "#FFFFFF" },
});
