let currentRole = null;

// --- SUPABASE CLIENT ---
const supabaseClient = window.supabase.createClient(
    'https://kdclsbscslklcypclohj.supabase.co',
    'sb_publishable_-jYliISAOxmckNHeoXMkpQ_7DIP0vp0'
);

let cachedTiposIncidencias = [];

// --- DOM REFS ---
const loginOverlay = document.getElementById('loginOverlay');
const loginErrorMsg = document.getElementById('loginErrorMsg');
const appWrapper = document.getElementById('appWrapper');
const headerControls = document.getElementById('headerControls');
const form = document.getElementById('agendaForm');
const proveedorInput = document.getElementById('proveedor');
const proveedoresList = document.getElementById('proveedoresList');
const fechaInput = document.getElementById('fecha');
const cantSkuInput = document.getElementById('cant_sku');
const cantCajasInput = document.getElementById('cant_cajas');
const horaInicioInput = document.getElementById('hora_inicio');
const horaFinInput = document.getElementById('hora_fin');
const btnSubmit = document.getElementById('btnSubmit');
const hologramModal = document.getElementById('hologramModal');
const hologramMsg = document.getElementById('hologramMsg');
const tipoDestinoGroup = document.getElementById('tipoDestinoGroup');
const tipoDestinoSelect = document.getElementById('tipo_destino');
const puertaManualGroup = document.getElementById('puertaManualGroup');
const puertaManualSel = document.getElementById('puerta_manual');
const btnIncidencia = document.getElementById('btnIncidencia');

// --- MODALS ---
const errorModal = document.getElementById('errorModal');
const errorModalTitle = document.getElementById('errorModalTitle');
const errorModalMsg = document.getElementById('errorModalMsg');
const errorBtnOk = document.getElementById('errorBtnOk');
const errorBtnYesNo = document.getElementById('errorBtnYesNo');
const errorBtnYes = document.getElementById('errorBtnYes');
const errorBtnNo = document.getElementById('errorBtnNo');

let modalYesCallback = null;
let modalNoCallback = null;

function showModal(msg, title = 'SISTEMA B100', type = 'ok', onYes = null, onNo = null) {
    if (!errorModal || !errorModalTitle || !errorModalMsg) return;
    errorModalTitle.textContent = title;
    errorModalMsg.textContent = msg;
    if (type === 'yesno') {
        if (errorBtnOk) errorBtnOk.style.display = 'none';
        if (errorBtnYesNo) errorBtnYesNo.style.display = 'flex';
        modalYesCallback = onYes;
        modalNoCallback = onNo;
    } else {
        if (errorBtnOk) errorBtnOk.style.display = 'block';
        if (errorBtnYesNo) errorBtnYesNo.style.display = 'none';
    }
    errorModal.style.display = 'flex';
}

function hideModal() {
    if (errorModal) errorModal.style.display = 'none';
    if (hologramModal) hologramModal.style.display = 'none';
}

document.addEventListener('DOMContentLoaded', () => {
    // Initial State: Hide all dashboards to prevent flickering before auth
    if (appWrapper) appWrapper.style.display = 'none';
    const dashboardContainer = document.getElementById('dashboardContainer');
    const panelsLayout = document.getElementById('panelsLayout');
    if (dashboardContainer) dashboardContainer.style.display = 'none';
    if (panelsLayout) panelsLayout.style.display = 'none';

    // Modal Handlers
    const okBtn = document.getElementById('errorBtnOk');
    const successBtn = document.getElementById('hologramCloseBtn');
    if (okBtn) okBtn.onclick = hideModal;
    if (successBtn) successBtn.onclick = hideModal;

    if (errorBtnYes) {
        errorBtnYes.onclick = () => {
            if (modalYesCallback) modalYesCallback();
            hideModal();
        };
    }
    if (errorBtnNo) {
        errorBtnNo.onclick = () => {
            if (modalNoCallback) modalNoCallback();
            hideModal();
        };
    }

    const btnHome = document.getElementById('btnHome');
    if (btnHome) btnHome.onclick = () => window.location.href = 'http://10.170.20.169:3004';

    // Auto-login removed for security - Always start at login screen
    checkAutoLogin();

    hideModal();
});

function timeToMinutes(t) {
    if (!t) return 0;
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
}

document.getElementById('btnLogin').addEventListener('click', () => {
    const u = document.getElementById('userInput').value.trim();
    const p = document.getElementById('passInput').value.trim();
    loginErrorMsg.style.display = 'none';
    if (u === 'supervisor' && p === 'recepcion') initSession(u, 'supervisor');
    else if (u === 'prov' && p === 'recepcion') initSession(u, 'proveedor');
    else if (u === 'operario' && p === 'recepcion') initSession(u, 'operario');
    else loginErrorMsg.style.display = 'block';
});

function initSession(user, role) {
    currentRole = role;
    localStorage.setItem('b100_role', role);
    localStorage.setItem('b100_user', user);
    loginOverlay.style.display = 'none';
    appWrapper.style.display = 'flex';
    if (headerControls) headerControls.style.display = 'flex';
    applyRoleUI();
    initApp();
}

function checkAutoLogin() {
    loginOverlay.style.display = 'flex';
    appWrapper.style.display = 'none';
}

function applyRoleUI() {
    const roleText = document.getElementById('roleText');
    const operarioView = document.getElementById('operarioView');
    const panelsLayout = document.getElementById('panelsLayout');
    const puertaSelect = document.getElementById('puerta_manual');
    const cancelContainer = document.getElementById('cancelContainer');

    const dashboardContainer = document.getElementById('dashboardContainer');

    if (roleText) {
        if (currentRole === 'supervisor') roleText.textContent = 'SUPERVISOR';
        else if (currentRole === 'operario') roleText.textContent = 'OPERARIO';
        else roleText.textContent = 'PROVEEDOR';
    }

    if (currentRole === 'operario') {
        if (dashboardContainer) {
            dashboardContainer.style.display = 'flex';
            dashboardContainer.style.justifyContent = 'center';
            dashboardContainer.style.alignItems = 'center';
            dashboardContainer.style.width = '100%';
        }
        if (panelsLayout) panelsLayout.style.display = 'none';
        loadIncidentCategories();
    } else {
        // Supervisors and Providers never see the incident panel
        if (dashboardContainer) dashboardContainer.style.display = 'none';
        if (panelsLayout) panelsLayout.style.display = 'flex';
        initSupervisorManagement();
    }

    if (puertaSelect) {
        puertaSelect.querySelectorAll('option').forEach(opt => {
            if (currentRole === 'proveedor' && (opt.value === 'Puerta 8' || opt.value === 'Puerta 9')) {
                opt.style.display = 'none'; opt.disabled = true;
            } else {
                opt.style.display = 'block'; opt.disabled = false;
            }
        });
    }

    if (currentRole === 'proveedor') {
        if (cancelContainer) cancelContainer.style.display = 'none';
        if (tipoDestinoGroup) tipoDestinoGroup.style.display = 'none';
        if (puertaManualGroup) puertaManualGroup.style.display = 'none';
    } else {
        if (cancelContainer) cancelContainer.style.display = 'block';
        if (tipoDestinoGroup) tipoDestinoGroup.style.display = 'block';
        if (puertaManualGroup) puertaManualGroup.style.display = 'block';
    }

    // Header incident button is now removed from HTML, but we keep the logic clean
    if (btnIncidencia) btnIncidencia.style.display = 'none';
}

async function initApp() {
    try {
        // Full static list loading removed to optimize performance (3k+ records)
        initMainAutocomplete();
        setupRealtimeSubscription();
    } catch (err) { console.error(err); }
}

function initMainAutocomplete() {
    const input = document.getElementById('proveedor');
    const results = document.getElementById('mainAutocompleteResults');
    if (!input) return;

    let debounceTimer;
    input.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        const term = input.value.trim();
        if (term.length < 3) {
            results.style.display = 'none';
            return;
        }
        debounceTimer = setTimeout(() => fetchMainProviders(term), 300);
    });

    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !results.contains(e.target)) {
            results.style.display = 'none';
        }
    });
}

async function fetchMainProviders(term) {
    const input = document.getElementById('proveedor');
    const resultsDiv = document.getElementById('mainAutocompleteResults');
    if (!input || !resultsDiv) return;

    resultsDiv.innerHTML = '<div style="padding:10px; font-size:0.7rem; color:var(--primary-color);">Cargando...</div>';
    resultsDiv.style.display = 'block';

    const { data } = await supabaseClient
        .from('maestros_proveedores')
        .select('nombre, codigo')
        .ilike('nombre', `%${term}%`)
        .limit(10);

    resultsDiv.innerHTML = '';
    if (data && data.length > 0) {
        data.forEach(m => {
            const item = document.createElement('div');
            item.className = 'autocomplete-item';
            item.innerHTML = `<strong>${m.nombre}</strong>`;
            item.onclick = () => {
                input.value = m.nombre;
                document.getElementById('mainSelectedProvCode').value = m.codigo;
                resultsDiv.style.display = 'none';
            };
            resultsDiv.appendChild(item);
        });
    } else {
        resultsDiv.innerHTML = '<div style="padding:10px; font-size:0.7rem; color:var(--text-muted);">Sin resultados. Use entrada manual.</div>';
    }
}

function setupRealtimeSubscription() {
    supabaseClient
        .channel('public:agenda_b100')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'agenda_b100' }, (payload) => {
            console.log('Realtime update received:', payload);
            const mgmtDate = document.getElementById('supMgmtDate');
            if (mgmtDate && mgmtDate.value) {
                fetchMgmtAgenda(mgmtDate.value);
            }
        })
        .subscribe();
}

async function findFreeDoor(fecha, startMin, endMin, role, manualDoor = 'auto') {
    const { data: existing } = await supabaseClient.from('agenda_b100').select('*').eq('fecha', fecha).neq('estado', 'Cancelado').neq('estado', 'Eliminado');
    const forbidden = role === 'proveedor' ? ['Puerta 8', 'Puerta 9'] : [];
    const groupB = ['Puerta 2', 'Puerta 3', 'Puerta 4', 'Puerta 7', 'Puerta 10'];
    if (manualDoor !== 'auto') {
        if (groupB.includes(manualDoor) && startMin < 510) return null;
        const col = existing.find(a => a.puerta === manualDoor && Math.max(startMin, timeToMinutes(a.hora_inicio)) < Math.min(endMin, timeToMinutes(a.hora_fin)));
        return col ? null : manualDoor;
    }
    for (let d = 1; d <= 10; d++) {
        const dName = `Puerta ${d}`;
        if (forbidden.includes(dName)) continue;
        if (groupB.includes(dName) && startMin < 510) continue;
        if (!existing.find(a => a.puerta === dName && Math.max(startMin, timeToMinutes(a.hora_inicio)) < Math.min(endMin, timeToMinutes(a.hora_fin)))) return dName;
    }
    return null;
}

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    btnSubmit.disabled = true; btnSubmit.innerHTML = 'AGENDANDO...';
    try {
        const p = proveedorInput.value.trim();
        const f = fechaInput.value;
        const hS = horaInicioInput.value;
        const hE = horaFinInput.value;
        if (!hS || !hE) { showModal('SELECCIONE HORARIOS'); btnSubmit.disabled = false; return; }
        const sM = timeToMinutes(hS), eM = timeToMinutes(hE);
        const door = await findFreeDoor(f, sM, eM, currentRole, (currentRole === 'supervisor' ? puertaManualSel.value : 'auto'));
        if (!door) { showModal('NO HAY PUERTAS DISPONIBLES'); btnSubmit.disabled = false; return; }
        const workload = (parseInt(cantSkuInput.value) * 4.5) + (parseInt(cantCajasInput.value) * 1.36) + 15;
        let per = Math.max(1, Math.round((workload / (eM - sM)) * 10) / 10);
        await supabaseClient.from('agenda_b100').insert({
            fecha: f, proveedor: p, puerta: door, hora_inicio: hS, hora_fin: hE,
            cant_sku: parseInt(cantSkuInput.value) || 0, cant_cajas: parseInt(cantCajasInput.value) || 0,
            estado: 'Agendado', tipo_destino: (currentRole === 'supervisor' ? tipoDestinoSelect.value : 'CDS'), personal_requerido: per
        });
        hologramMsg.textContent = `CITADO EN ${door} - ${hE}`; hologramModal.style.display = 'flex';

        // Full form reset after successful agenda
        form.reset();
        document.getElementById('mainSelectedProvCode').value = '';
        proveedorInput.value = '';

        // Refresh supervisors list if date matches
        const mgmtDate = document.getElementById('supMgmtDate');
        if (mgmtDate && mgmtDate.value === f) fetchMgmtAgenda(f);

    } catch (err) { console.error(err); }
    btnSubmit.disabled = false; btnSubmit.innerHTML = 'AGENDAR CITA';
});

// --- LOGOUT ---
document.getElementById('logoutBtn').onclick = () => {
    localStorage.removeItem('b100_user');
    localStorage.removeItem('b100_role');
    window.location.reload();
};

// =========================================================
// SUPERVISOR LIST MANAGEMENT logic
// =========================================================
function initSupervisorManagement() {
    const mgmtDatePicker = document.getElementById('supMgmtDate');
    if (mgmtDatePicker) {
        // Set today by default if empty
        if (!mgmtDatePicker.value) mgmtDatePicker.value = new Date().toISOString().split('T')[0];

        mgmtDatePicker.onchange = (e) => {
            if (e.target.value) fetchMgmtAgenda(e.target.value);
        };
        // Initial fetch
        fetchMgmtAgenda(mgmtDatePicker.value);
    }
}

async function fetchMgmtAgenda(date) {
    const container = document.getElementById('supMgmtResults');
    container.innerHTML = '<div style="text-align:center; padding:20px; color:var(--primary-color);">CONSULTANDO BASE...</div>';

    const { data, error } = await supabaseClient
        .from('agenda_b100')
        .select('*')
        .eq('fecha', date)
        .neq('estado', 'Eliminado')
        .order('hora_inicio', { ascending: true });

    if (error) { container.innerHTML = 'Error'; return; }
    if (!data || data.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted); font-size:0.7rem;">Sin citas para esta fecha.</div>';
        return;
    }

    renderManagementList(data);
}

function renderManagementList(appointments) {
    const container = document.getElementById('supMgmtResults');
    container.innerHTML = '';

    appointments.forEach(app => {
        const st = (app.estado || 'Agendado').toLowerCase();
        const row = document.createElement('div');
        row.className = `mgmt-row row-${st.replace(' ', '-')}`;

        const isCancelled = st === 'cancelado';
        const isReceived = st === 'recepcionado';
        const isOC = st === 'ingreso packing list';

        row.innerHTML = `
            <div class="mgmt-info">
                <span class="mgmt-name">${app.proveedor}</span>
                <span class="mgmt-meta"><i class="fas fa-clock"></i> ${app.hora_inicio} | ${app.puerta}</span>
            </div>
            <div class="mgmt-actions">
                <button class="btn-status ${isOC ? 'active-oc' : ''}" 
                        onclick="toggleStatus('${app.id_cita || app.id}', '${app.estado}', 'Packing')" 
                        ${isReceived || isCancelled ? 'disabled' : ''} title="Recibió Packing List">
                    <i class="fas fa-file-signature"></i>
                </button>
                <button class="btn-status ${isReceived ? 'active-rec' : ''}" 
                        onclick="toggleStatus('${app.id_cita || app.id}', '${app.estado}', 'Recepcionado')" 
                        ${isCancelled ? 'disabled' : ''} title="Recepcionado">
                    <i class="fas fa-warehouse"></i>
                </button>
                <button class="btn-status ${isCancelled ? 'active-can' : ''}" 
                        onclick="toggleStatus('${app.id_cita || app.id}', '${app.estado}', 'Cancelado')" title="Cancelado">
                    <i class="fas fa-ban"></i>
                </button>
                <button class="btn-status" style="border-color:var(--danger-color); color:var(--danger-color);" 
                        onclick="confirmDelete('${app.id_cita || app.id}')" title="Eliminar Permanentemente">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        container.appendChild(row);
    });
}

async function toggleStatus(id, currentStatus, targetStatus) {
    const nextStatus = (currentStatus === targetStatus) ? 'Agendado' : targetStatus;
    await updateGenericStatus(id, nextStatus);
    // Realtime will handle the refresh, but I'll call it for safety in case of latency
    const date = document.getElementById('supMgmtDate').value;
    fetchMgmtAgenda(date);
}

async function confirmDelete(id) {
    showModal('¿CONFIRMA ELIMINACIÓN PERMANENTE?', 'BORRADO DE REGISTRO', 'yesno', async () => {
        const { error } = await supabaseClient.from('agenda_b100').delete().eq('id_cita', id);
        if (error) await supabaseClient.from('agenda_b100').delete().eq('id', id);

        hideModal();
        const date = document.getElementById('supMgmtDate').value;
        fetchMgmtAgenda(date);
    });
}

// =========================================================
// OPERARIO MODULE logic (Reversible)
// =========================================================
function initOperarioPanel() {
    const datePicker = document.getElementById('opDatePicker');
    const searchInput = document.getElementById('opSearchInput');
    const btnSearch = document.getElementById('btnOpSearch');

    if (datePicker) {
        datePicker.onchange = (e) => {
            if (e.target.value) fetchOperarioAgenda(e.target.value, searchInput.value);
        };
    }

    if (btnSearch) {
        btnSearch.onclick = () => {
            if (datePicker.value) fetchOperarioAgenda(datePicker.value, searchInput.value);
        };
    }
}

async function fetchOperarioAgenda(date, search = '') {
    const res = document.getElementById('opResults');
    res.innerHTML = '<div style="text-align:center; padding:20px; color:var(--primary-color);">SINCRONIZANDO...</div>';

    let query = supabaseClient
        .from('agenda_b100')
        .select('*')
        .eq('fecha', date)
        .neq('estado', 'Eliminado')
        .order('hora_inicio', { ascending: true });

    if (search) query = query.ilike('proveedor', `%${search}%`);

    const { data } = await query;
    if (!data || data.length === 0) { res.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);">Sin registros.</div>'; return; }

    renderOperarioList(data);
}

function renderOperarioList(appointments) {
    const res = document.getElementById('opResults');
    res.innerHTML = '';

    appointments.forEach(app => {
        const st = (app.estado || 'Agendado').toLowerCase();
        const row = document.createElement('div');
        row.className = `mgmt-row row-${st.replace(' ', '-')}`;

        // Reversible Logic Ladder check
        const isCancelled = st === 'cancelado';
        const isReceived = st === 'recepcionado';
        const isOC = st === 'ingreso packing list';

        row.innerHTML = `
            <div class="mgmt-info">
                <span class="mgmt-name">${app.proveedor}</span>
                <span class="mgmt-meta"><i class="fas fa-clock"></i> ${app.hora_inicio} - ${app.hora_fin} | ${app.puerta}</span>
            </div>
            <div class="mgmt-actions">
                <button class="btn-status ${isOC ? 'active-oc' : ''}" 
                        onclick="toggleStatus('${app.id_cita || app.id}', '${app.estado}', 'Ingreso Packing List')" 
                        ${isReceived || isCancelled ? 'disabled' : ''} title="Ingreso Packing List">
                    <i class="fas fa-file-invoice"></i>
                </button>
                <button class="btn-status ${isReceived ? 'active-rec' : ''}" 
                        onclick="toggleStatus('${app.id_cita || app.id}', '${app.estado}', 'Recepcionado')" 
                        ${isCancelled ? 'disabled' : ''} title="Recepcionado">
                    <i class="fas fa-warehouse"></i>
                </button>
                <button class="btn-status ${isCancelled ? 'active-can' : ''}" 
                        onclick="toggleStatus('${app.id_cita || app.id}', '${app.estado}', 'Cancelado')" title="Cancelar">
                    <i class="fas fa-ban"></i>
                </button>
            </div>
        `;
        res.appendChild(row);
    });
}

async function toggleStatus(id, currentStatus, targetStatus) {
    // Reversible: If same button clicked, go back to Agendado
    const nextStatus = (currentStatus === targetStatus) ? 'Agendado' : targetStatus;
    await updateGenericStatus(id, nextStatus);

    const datePicker = document.getElementById('opDatePicker');
    const searchInput = document.getElementById('opSearchInput');
    fetchOperarioAgenda(datePicker.value, searchInput.value);
}

async function updateGenericStatus(id, newStatus) {
    const { error } = await supabaseClient.from('agenda_b100').update({ estado: newStatus }).eq('id_cita', id);
    if (error) {
        await supabaseClient.from('agenda_b100').update({ estado: newStatus }).eq('id', id);
    }
}

window.onload = () => {
    // Standard initialization
    initApp();
    initIncidentModule();

    // Forced reset for security on reload
    if (form) form.reset();
    const incFormSearch = document.getElementById('incProveedorSearch');
    if (incFormSearch) incFormSearch.value = '';
};

// =========================================================
// INCIDENT MODULE logic
// =========================================================
function initIncidentModule() {
    const incDate = document.getElementById('incDate');
    const incTipo = document.getElementById('incTipo');
    const incAtrasoSection = document.getElementById('incTimeFields'); // Corrected reference
    const btnSend = document.getElementById('btnSendIncident');

    // Load categories if role is authorized
    if (currentRole === 'operario' || currentRole === 'supervisor') {
        loadIncidentCategories();
        initIncAutocomplete();
    }

    if (incDate) {
        incDate.onchange = (e) => {
            const date = e.target.value;
            // Reset provider selection
            document.getElementById('incProveedorSearch').value = '';
            document.getElementById('selectedIdCita').value = '';
            document.getElementById('selectedProvName').value = '';
            document.getElementById('selectedHCita').value = '';
            document.getElementById('selectedHFinCita').value = '';
            document.getElementById('selectedProvCodigo').value = '';

            // If Operario, fetch today's agenda immediately
            if (currentRole === 'operario' && date) {
                fetchProvidersAutocomplete(""); // empty search to trigger "show all" logic
            }
        };
    }

    if (btnSend) {
        btnSend.onclick = submitIncident;
    }
}

function initIncAutocomplete() {
    const input = document.getElementById('incProveedorSearch');
    const results = document.getElementById('incAutocompleteResults');
    const incDate = document.getElementById('incDate');

    if (!input) return;

    let debounceTimer;
    input.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        const term = input.value.trim();

        // Operario can search within their pre-fetched/filtered daily list even with 0 chars if focused
        // But for consistency we use term length logic for fetching if not already loaded
        if (currentRole !== 'operario' && term.length < 2) {
            results.style.display = 'none';
            return;
        }

        debounceTimer = setTimeout(() => fetchProvidersAutocomplete(term), 300);
    });

    // Operario: Show all scheduled when focused/clicked
    input.addEventListener('click', () => {
        if (currentRole === 'operario') {
            fetchProvidersAutocomplete(input.value.trim());
        }
    });

    // Close results when clicking outside
    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !results.contains(e.target)) {
            results.style.display = 'none';
        }
    });
}

async function fetchProvidersAutocomplete(term) {
    const resultsDiv = document.getElementById('incAutocompleteResults');
    const date = document.getElementById('incDate').value;

    if (!date) {
        showModal('Seleccione una fecha de incidencia primero.', 'CALENDARIO REQUERIDO');
        return;
    }

    resultsDiv.innerHTML = '<div style="padding:10px; font-size:0.7rem; color:var(--primary-color);">Buscando...</div>';
    resultsDiv.style.display = 'block';

    try {
        // Build query
        let query = supabaseClient
            .from('agenda_b100')
            .select('id_cita, id, proveedor, hora_inicio, hora_fin, codigo') // Added codigo capture if available
            .eq('fecha', date)
            .neq('estado', 'Eliminado')
            .neq('estado', 'Cancelado');

        // If operario, we show everything for that date or filter by term if typing
        // If not operario, we require a term as per previous logic
        if (term) {
            query = query.ilike('proveedor', `%${term}%`);
        }

        const { data: scheduled } = await query;

        resultsDiv.innerHTML = '';

        // Render Scheduled
        if (scheduled && scheduled.length > 0) {
            scheduled.forEach(s => {
                const item = document.createElement('div');
                item.className = 'autocomplete-item';
                item.innerHTML = `
                    <span class="meta-tag tag-scheduled">Cita: ${s.hora_inicio}</span>
                    <strong>${s.proveedor}</strong>
                `;
                item.onclick = () => selectProv(s.proveedor, s.id_cita || s.id, s.hora_inicio, s.hora_fin, s.codigo);
                resultsDiv.appendChild(item);
            });
        }

        // Priority 2: Master providers (ONLY if NOT Operario)
        if (currentRole !== 'operario') {
            const { data: master } = await supabaseClient
                .from('maestros_proveedores')
                .select('nombre, codigo')
                .ilike('nombre', `%${term}%`)
                .limit(15);

            const scheduledNames = (scheduled || []).map(s => s.proveedor.toLowerCase());
            if (master && master.length > 0) {
                master.forEach(m => {
                    if (scheduledNames.includes(m.nombre.toLowerCase())) return;
                    const item = document.createElement('div');
                    item.className = 'autocomplete-item';
                    item.innerHTML = `
                        <span class="meta-tag tag-master">Maestro (Sin Cita)</span>
                        <strong>${m.nombre}</strong>
                    `;
                    item.onclick = () => selectProv(m.nombre, null, null, null);
                    resultsDiv.appendChild(item);
                });
            }
        }

        if (resultsDiv.innerHTML === '') {
            const emptyMsg = currentRole === 'operario'
                ? 'No hay proveedores con cita hoy que coincidan.'
                : 'Sin coincidencias exactas. Use el nombre escrito para entrada manual.';
            resultsDiv.innerHTML = `<div style="padding:10px; font-size:0.7rem; color:var(--text-muted);">${emptyMsg}</div>`;
        }

    } catch (err) {
        console.error('Autocomplete error:', err);
    }
}

function selectProv(name, idCita, hCita, hFinCita, codigo) {
    document.getElementById('incProveedorSearch').value = name;
    document.getElementById('selectedIdCita').value = idCita || '';
    document.getElementById('selectedProvName').value = name;
    document.getElementById('selectedHCita').value = hCita || '';
    document.getElementById('selectedHFinCita').value = hFinCita || '';
    document.getElementById('selectedProvCodigo').value = codigo || '';
    document.getElementById('incAutocompleteResults').style.display = 'none';
}

async function loadIncidentCategories() {
    try {
        const { data, error } = await supabaseClient
            .from('tipos_incidencias')
            .select('*')
            .order('nombre_incidencia', { ascending: true });

        cachedTiposIncidencias = (data || []).filter(item =>
            !item.nombre_incidencia.toLowerCase().includes('no vino')
        );

        const sel = document.getElementById('incTipo');
        if (!sel) return;
        sel.innerHTML = '<option value="">Seleccione incidencia...</option>';

        cachedTiposIncidencias.forEach(item => {
            const opt = document.createElement('option');
            opt.value = item.nombre_incidencia;
            opt.textContent = item.nombre_incidencia;
            sel.appendChild(opt);
        });
    } catch (err) { console.error('Error loading incident types:', err); }
}

async function submitIncident() {
    const btn = document.getElementById('btnSendIncident');
    const date = document.getElementById('incDate').value;
    const selectedName = document.getElementById('incTipo').value;
    const tArrival = document.getElementById('incHoraLlegada').value;

    // Get selection from autocomplete or manual entry
    const provNameInput = document.getElementById('incProveedorSearch').value.trim();
    const idCita = document.getElementById('selectedIdCita').value;
    const provName = document.getElementById('selectedProvName').value || provNameInput;
    const hCita = document.getElementById('selectedHCita').value;
    const hFinCita = document.getElementById('selectedHFinCita').value;

    if (!date || !provName || !selectedName) {
        showModal('Complete los campos obligatorios (Fecha, Proveedor, Incidencia).', 'DATOS INCOMPLETOS');
        return;
    }

    const incObj = cachedTiposIncidencias.find(i => i.nombre_incidencia === selectedName);
    if (!incObj) return;

    btn.disabled = true; btn.innerHTML = 'ENVIANDO...';

    try {
        // AUTOMATIC PROVIDER CODE MAPPING
        const capturedCodigo = document.getElementById('selectedProvCodigo').value;
        let provCodigo = capturedCodigo;

        if (!provCodigo) {
            const { data: provData } = await supabaseClient
                .from('maestros_proveedores')
                .select('codigo')
                .eq('nombre', provName)
                .maybeSingle();
            provCodigo = provData ? provData.codigo : 9999;
        }

        const payload = {
            id_cita: idCita || null,
            fecha: date,
            proveedor: provName,
            codigo: provCodigo,
            incidencias: selectedName,
            tipo: (incObj.tipo_categoria || 'GENERAL').toUpperCase(),
            motivos: incObj.motivo_agrupado || 'N/A',
            usuario_reporta: localStorage.getItem('b100_user'),
            timestamp: new Date().toISOString()
        };

        // LÓGICA DE TIEMPOS
        let delayStr = "00:00:00";
        let lossStr = "00:00:00";

        const isNoVino = payload.tipo.includes('NO VINO');

        if (isNoVino && hCita && hFinCita) {
            const duration = Math.max(0, timeToMinutes(hFinCita) - timeToMinutes(hCita));
            const hh = Math.floor(duration / 60).toString().padStart(2, '0');
            const mm = (duration % 60).toString().padStart(2, '0');
            lossStr = `${hh}:${mm}:00`;
        } else if (tArrival && hCita) {
            const diff = timeToMinutes(tArrival) - timeToMinutes(hCita);
            if (diff > 0) {
                const hh = Math.floor(diff / 60).toString().padStart(2, '0');
                const mm = (diff % 60).toString().padStart(2, '0');
                delayStr = `${hh}:${mm}:00`;
            }
        }

        payload.hr_atraso = delayStr;
        payload.hr_perdida = lossStr;

        const { error } = await supabaseClient.from('incidencias_proveedores').insert(payload);
        if (error) throw error;

        showModal('INCIDENCIA REGISTRADA CON ÉXITO', 'OPERACIÓN EXITOSA');

        // Reset specific fields
        document.getElementById('incProveedorSearch').value = '';
        document.getElementById('selectedIdCita').value = '';
        document.getElementById('selectedProvName').value = '';
        document.getElementById('selectedHCita').value = '';
        document.getElementById('selectedHFinCita').value = '';
        document.getElementById('selectedProvCodigo').value = '';
        document.getElementById('incTipo').value = '';
        document.getElementById('incHoraLlegada').value = '';

    } catch (err) {
        console.error(err);
        showModal('Error al registrar incidencia: ' + err.message);
    } finally {
        btn.disabled = false; btn.innerHTML = 'ENVIAR REPORTE';
    }
}
