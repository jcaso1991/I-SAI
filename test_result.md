#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: |
  App de gestión de materiales con OneDrive sync, roles Admin/Técnico, editor de Planos
  y Calendario interactivo. Tarea actual: verificar funciones avanzadas del Calendario:
  - Recurrencia de eventos (daily/weekly/monthly con `until`)
  - Arrastre horizontal entre días en vista Semana
  - Invitar técnicos específicos (assigned_user_ids)
  - Los usuarios NO admin solo ven sus eventos asignados

backend:
  - task: "Events CRUD - Create with recurrence and assigned_user_ids"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: |
          POST /api/events ahora acepta campos opcionales `recurrence` ({type, until})
          y `assigned_user_ids`. Validar creación simple, daily, weekly y enriquecimiento.
        -working: true
        -agent: "testing"
        -comment: |
          PASS. POST /api/events funciona correctamente:
          - Creación simple (sin recurrence, sin assigned_user_ids) → 200 con id,
            assigned_users=[], recurrence=null.
          - Creación con recurrence.type='daily' + until='YYYY-MM-DD' → recurrence
            se devuelve como dict {type, until}.
          - Creación con assigned_user_ids=[techA.id] → la respuesta incluye
            assigned_users enriquecidos con {id, email, name} y sin exponer password.
          - Validación de fechas: end_at <= start_at → 400 (ambos casos < y ==).
          - Permisos: non-admin → 403, sin token → 401.

  - task: "Events listing with date window and recurrence expansion"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: |
          GET /api/events?from=<iso>&to=<iso> expande recurrencias vía _expand_recurrence.
        -working: true
        -agent: "testing"
        -comment: |
          PASS. _expand_recurrence funciona correctamente:
          - Daily con until 2026-05-08, ventana 7 días desde 2026-05-04 → 5 ocurrencias
            exactas (May 4,5,6,7,8). Base usa el id original; las demás usan
            `<base_id>:YYYY-MM-DD` con base_event_id poblado.
          - Todas las ocurrencias tienen duración = 3600s (1h) y start_at distinto.
          - Weekly con until 2026-06-22, ventana 2026-06-01→2026-06-15T23:59:59Z →
            3 ocurrencias (Jun 1, 8, 15). Nota: el bucle usa `cur >= to_dt: break`,
            por lo que si `to` es exactamente 2026-06-15T00:00:00Z y el evento es
            a las 09:00, la 3ª ocurrencia queda fuera; ampliando el `to` hasta el
            final del día se obtienen las 3 esperadas. Comportamiento es correcto
            según la semántica half-open del window.
          - Ventana acotada excluye ocurrencias fuera.

  - task: "Events visibility filter - non-admin sees only assigned"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: |
          GET /api/events filtra por assigned_user_ids == user.id cuando role != admin.
        -working: true
        -agent: "testing"
        -comment: |
          PASS (CRITICAL). Filtro de visibilidad verificado:
          - Admin creó E1(→techA), E2(→techB), E3(sin asignar).
          - techA token → GET devuelve SOLO E1.
          - techB token → GET devuelve SOLO E2.
          - admin token → GET devuelve los 3 (E1, E2, E3).

  - task: "Events PATCH supports recurrence and assigned_user_ids updates"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: |
          PATCH /api/events/{eid} acepta recurrence y assigned_user_ids. eid virtual
          con ":fecha" se resuelve al evento base.
        -working: true
        -agent: "testing"
        -comment: |
          PASS. PATCH funciona correctamente:
          - Cambiar assigned_user_ids de un evento existente → persiste y se refleja
            inmediatamente en GET como techA (el usuario asignado).
          - Cambiar recurrence de none → weekly con until → GET expande y devuelve
            4 ocurrencias en la ventana (3 semanas desde la base).
          - PATCH con id virtual `<base>:<YYYY-MM-DD>` → afecta al evento base
            (respuesta devuelve id=base_id y el cambio de title aplicado).

frontend:
  - task: "Calendario: horizontal drag between days (week view)"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/calendario.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: |
          PanResponder calcula shift horizontal con Math.round(dx/colW) y al soltar
          selecciona weekDays[dayIndex+shift] como el nuevo día del evento. Pendiente
          de verificación manual o con testing frontend agent.

  - task: "Calendario: recurrence UI + assigned users picker"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/calendario.tsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: |
          Modal del evento expone selector de recurrencia (none/daily/weekly/monthly),
          input de fecha "until" y chips de técnicos asignables.

metadata:
  created_by: "main_agent"
  version: "1.1"
  test_sequence: 1
  run_ui: false

test_plan:
  current_focus:
    - "Events CRUD - Create with recurrence and assigned_user_ids"
    - "Events listing with date window and recurrence expansion"
    - "Events visibility filter - non-admin sees only assigned"
    - "Events PATCH supports recurrence and assigned_user_ids updates"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
    -agent: "main"
    -message: |
      Reinicié backend y expo. Por favor testear los 4 tasks de backend del
      módulo Calendario. Credenciales admin en /app/memory/test_credentials.md
      (admin@materiales.com / Admin1234). Para los tests de visibilidad crea
      usuarios nuevos vía POST /api/users con role='user' (admin token) y
      login-eando con ellos. Limpia events creados al final si es posible.
    -agent: "testing"
    -message: |
      Backend calendar tests COMPLETE. 24/24 assertions passed via
      /app/backend_test.py (targeting http://localhost:8001/api).
      Results per focus task:
      - Events CRUD (create with recurrence + assigned_user_ids): PASS.
        Simple/daily/weekly creation, assigned_users enrichment (no password leak),
        date validation (end<=start → 400), admin-only permissions (403/401).
      - Events listing + recurrence expansion: PASS. Daily 5-occurrence expansion
        with correct `<base_id>:YYYY-MM-DD` virtual ids and base_event_id,
        durations preserved (1h), weekly 3-occurrence in widened 14-day window.
        Note: window is half-open [from, to); for the weekly test the 3rd
        occurrence at 09:00 UTC on Jun 15 is included only if `to` > Jun 15 09:00.
        This matches the implementation's semantics (cur >= to_dt: break).
      - Visibility filter (CRITICAL): PASS. Non-admin user only sees events
        where their id is in assigned_user_ids; admin sees all.
      - PATCH updates: PASS. assigned_user_ids change persists and is reflected
        in next GET; recurrence change none→weekly is expanded by GET; virtual
        id `<base>:<date>` correctly resolves to base event.
      Cleanup executed (events + test users deleted). All 4 focus tasks marked
      working: true and needs_retesting: false.