// VARIABLE GLOBAL PARA EL ESCUDO DE MB
let ultimaActualizacionExitosa = null;

console.log("Conectado al Servidor Local");

document.addEventListener("DOMContentLoaded", function () {
  const btnHome = document.getElementById('btnHome');
  if (btnHome) {
    btnHome.onclick = () => window.location.href = 'http://10.170.20.169:3004';
  }

  loadData();
  setInterval(loadData, 1800000); // Actualiza cada 30 minuto
});

async function loadData() {
  const now = new Date();
  const currentHour = now.getHours();
  // Validar si la hora está fuera del rango de 08:00 a 20:59 (8 AM a 8 PM)
  if (currentHour < 8 || currentHour >= 20) {
    console.log("😴 Fuera de horario competitivo (08:00 - 20:00). Ahorro masivo de MB activo.");
    return;
  }

  try {
    const response = await fetch('/api/data');
    const data = await response.json();

    if (!data || !data.registros) {
      console.log("Esperando estructura de registros...");
      return;
    }

    // === EL ESCUDO DE MB ===
    const marcaTiempoActual = data.metadatos ? data.metadatos.actualizacion : null;

    if (marcaTiempoActual && marcaTiempoActual === ultimaActualizacionExitosa) {
      console.log("🛡️ Escudo Activo: Datos idénticos. Ahorrando MB.");
      return;
    }

    ultimaActualizacionExitosa = marcaTiempoActual;
    console.log("🚀 ¡Nuevos datos detectados! Procesando...");

    // === INICIO DE PROCESAMIENTO ===
    const agg = {};
    let skusSet = new Set();
    let provSet = new Set();

    // CLAVE: Entramos a la subcarpeta 'registros' que viene de Firebase
    const misRegistros = data.registros || {};

    // Total LPN garantizado: Cantidad exacta de objetos (filas) en Firebase
    let totalGlobalLpns = Object.keys(misRegistros).length;

    for (let key in misRegistros) {
      let current = misRegistros[key] || {};

      // 1. Identificar al Operador
      let uid = "ANONIMO";
      if (current.usuario_id && typeof current.usuario_id === "string" && current.usuario_id.trim() !== "") {
        uid = current.usuario_id.trim().toUpperCase();
      }

      // 2. Contadores Globales (Ajusta los nombres según tus columnas de Excel)
      if (current["Cod Barra Product"]) skusSet.add(current["Cod Barra Product"]);
      if (current["Proveedor"]) provSet.add(current["Proveedor"]);

      // 3. Crear el objeto del Operador si no existe
      if (!agg[uid]) {
        let fotoPlaceholder = "https://ui-avatars.com/api/?name=" + encodeURIComponent(uid) + "&background=1e293b&color=00f3ff&rounded=false";
        let realFoto = fotoPlaceholder;

        if (current.usuario_foto && typeof current.usuario_foto === "string" && current.usuario_foto.includes("http")) {
          realFoto = current.usuario_foto;
        }

        agg[uid] = {
          count: 0,
          foto: realFoto,
          userSkus: new Set(),
          userProv: new Set(),
          horas: new Set(),
          origenDP: 0,
          origenCDS: 0,
          totalOrigen: 0,
          prodPorHora: {}
        };
      }

      agg[uid].count += 1;

      // GALA STATS OBTENTION (SAFE)
      try {
        if (current["Cod Barra Product"]) agg[uid].userSkus.add(current["Cod Barra Product"]);
        if (current["Proveedor"]) agg[uid].userProv.add(current["Proveedor"]);

        // Mapeo Columna "hora_limpia" (Productividad)
        let hlKey = Object.keys(current).find(function (k) {
          return k.toLowerCase().replace(/_/g, "").replace(/ /g, "") === "horalimpia";
        });

        let prodHoraExito = false;
        if (hlKey && current[hlKey] !== undefined && current[hlKey] !== "") {
          let hLimpia = parseInt(current[hlKey], 10);
          if (!isNaN(hLimpia)) {
            // Limitar rango 08-21
            if (hLimpia >= 8 && hLimpia <= 21) {
              let horaStr = String(hLimpia).padStart(2, '0');
              agg[uid].prodPorHora[horaStr] = (agg[uid].prodPorHora[horaStr] || 0) + 1;
              prodHoraExito = true;
            } else if (hLimpia < 8 || hLimpia > 21) {
              prodHoraExito = true; // Registró pero ignoramos si es fuera del rango para no invocar fallback
            }
          }
        }

        let recpHora = "";
        for (let k in current) {
          if (k.toUpperCase().includes("HORA") && k.toUpperCase().includes("RECEP")) {
            recpHora = current[k];
            break;
          }
        }

        // Fallback Productividad pura: Sin new Date() para horas enviadas desde Google
        if (!prodHoraExito && recpHora) {
          let hInt = -1;
          let strVal = String(recpHora).trim();

          // Regex infalible universal: Encuentra el primer par de dígitos antes de los dos puntos
          // Abarca "14:30", "2026-03-24 14:30:00", o "2026-03-24T14:30"
          let match = strVal.match(/(\d{1,2}):\d{2}/);
          if (match) {
            hInt = parseInt(match[1], 10);
          }

          if (hInt >= 0 && hInt <= 23 && !isNaN(hInt)) {
            let horaStr = String(hInt).padStart(2, '0');
            agg[uid].prodPorHora[horaStr] = (agg[uid].prodPorHora[horaStr] || 0) + 1;
          }
        }

        // Gala Horas Total (Mantener string fecha para min/max ms loop)
        if (recpHora) {
          agg[uid].horas.add(recpHora);
        } else if (hlKey && current[hlKey] !== "") {
          let hfmt = String(current[hlKey]).padStart(2, '0') + ":00";
          agg[uid].horas.add(hfmt);
        }

        let origen = "";
        if (current["INFORMACION DE ORIGEN"]) origen = current["INFORMACION DE ORIGEN"].toString().toUpperCase();
        else if (current["Informacion de Origen"]) origen = current["Informacion de Origen"].toString().toUpperCase();
        else if (current["Origen"]) origen = current["Origen"].toString().toUpperCase();
        else if (current["ORIGEN"]) origen = current["ORIGEN"].toString().toUpperCase();

        if (origen.indexOf("DP") !== -1) {
          agg[uid].origenDP++;
        } else if (origen.indexOf("CDS") !== -1) {
          agg[uid].origenCDS++;
        }
      } catch (e) { } // Error boundaries per user strict rule
    }

    const totLpnEl = document.getElementById("tot-lpn");
    const totSkuEl = document.getElementById("tot-sku");
    const totProvEl = document.getElementById("tot-prov");

    if (totLpnEl) totLpnEl.innerText = totalGlobalLpns.toLocaleString();
    if (totSkuEl) totSkuEl.innerText = skusSet.size.toLocaleString();
    if (totProvEl) totProvEl.innerText = provSet.size.toLocaleString();

    const sortedUsers = Object.entries(agg)
      .map(function (entry) {
        let dataObj = entry[1];
        return {
          username: entry[0],
          lpns: dataObj.count,
          foto: dataObj.foto,
          userSkus: dataObj.userSkus || new Set(),
          userProv: dataObj.userProv || new Set(),
          horas: dataObj.horas || new Set(),
          origenDP: dataObj.origenDP || 0,
          origenCDS: dataObj.origenCDS || 0,
          totalOrigen: dataObj.totalOrigen || 0,
          prodPorHora: dataObj.prodPorHora || {}
        };
      })
      .sort(function (a, b) { return b.lpns - a.lpns; });

    renderPodium(sortedUsers.slice(0, 3));
    renderTable(sortedUsers, totalGlobalLpns);

    // Solo arranca el ciclo si NO hay un cronómetro activo (Evita el salto al dashboard)
    if (!dashboardTimeout && !galaInterval && !prodTimeout) {
      if (typeof startGalaCycle === "function") {
        startGalaCycle(sortedUsers);
      }
    }
  } catch (error) {
    console.error("Error en conexión local:", error);
  }
}

function renderPodium(top3) {
  const pod = document.getElementById("podium");
  const order = [
    { data: top3[1], rank: 2 },
    { data: top3[0], rank: 1 },
    { data: top3[2], rank: 3 }
  ];

  let html = "";

  // Multi-line builder avoids absolutely ANY string termination syntax errors
  for (let i = 0; i < order.length; i++) {
    let item = order[i];
    if (!item.data) continue;

    // Exact styling string to prevent any complex quote overlaps
    let bgStyle = "background-image: url('" + item.data.foto + "');";

    html += '<div class="podium-item">';
    html += '<div class="podium-card-wrapper rank-' + item.rank + '">';
    html += '<div class="podium-card" style="' + bgStyle + '">';
    html += '<div class="rank-badge">#' + item.rank + '</div>';
    html += '<div class="username">' + item.data.username + '</div>';
    html += '</div></div>';
    // Note: Medals entirely bypassed manually, showing large numbers and text
    html += '<div class="lpn-total glow-' + item.rank + '">' + item.data.lpns.toLocaleString() + ' <span class="lbl-lpn">LPN</span></div>';
    html += '</div>';
  }

  pod.innerHTML = html;
}

function renderTable(allUsers, totalGlobalLpns) {
  const tbody = document.getElementById("table-body");
  const tclone = document.getElementById("table-body-clone");

  if (allUsers.length === 0) {
    tbody.innerHTML = "<tr><td colspan='4'>No users found.</td></tr>";
    return;
  }

  const maxLpns = allUsers[0].lpns;

  let html = "";

  // Rebuilt safely, using multi-line pure concatenation
  for (let i = 0; i < allUsers.length; i++) {
    let user = allUsers[i];
    const rank = i + 1;
    const barPct = Math.max(1, (user.lpns / maxLpns) * 100);
    const partPct = ((user.lpns / totalGlobalLpns) * 100).toFixed(2);

    html += '<tr>';
    html += '<td class="table-rank" style="width: 15%; text-align: center;">#' + rank + '</td>';
    html += '<td class="table-name" style="width: 25%;">' + user.username + '</td>';
    html += '<td style="width: 45%;">';
    html += '<div style="display: flex; align-items: center; gap: 20px;">';
    html += '<div class="bar-container" style="flex: 1;">';
    html += '<div class="bar-fill" style="width: ' + barPct + '%;"></div>';
    html += '</div>';
    html += '<span class="table-lpn">' + user.lpns.toLocaleString() + '</span>';
    html += '</div></td>';
    html += '<td class="table-pct" style="width: 15%; text-align: right;">' + partPct + '%</td>';
    html += '</tr>';
  }

  // Inicialmente inyectamos solo en tbody. Si usamos JS, vaciamos el clon HTML estático.
  tbody.innerHTML = html;
  if (tclone) tclone.innerHTML = "";

  // --- SCROLL INDEPENDIENTE PARA EL DASHBOARD PRINCIPAL (0.6 Velocidad) ---
  const tableWrapper = document.querySelector(".table-scroll-wrapper");
  if (tableWrapper) {
    // Si tenemos pocos datos, calculamos cuántas copias necesitamos para llenar 2 veces la pantalla
    // para que el ciclo infinito no se corte brusco.
    requestAnimationFrame(function () {
      let originalHeight = tbody.offsetHeight;
      if (originalHeight > 0) {
        let requiredCopies = Math.ceil((tableWrapper.offsetHeight * 2) / originalHeight);
        if (requiredCopies < 2) requiredCopies = 2; // Original + Clone

        let extraHtml = "";
        for (let i = 1; i < requiredCopies; i++) {
          extraHtml += html;
        }
        // Inyectamos LOS CLONES al mismo contenedor para que hereden el border-collapse exacto
        tbody.innerHTML += extraHtml;
        tbody.dataset.originalHeight = originalHeight;
      }

      // Detenemos animación CSS para tomar el control absoluto con JS
      const scrollContent = document.querySelector(".scroll-content");
      if (scrollContent) scrollContent.style.animation = "none";

      if (window.mainScrollInterval) cancelAnimationFrame(window.mainScrollInterval);

      let mainScrollPos = 0;
      const mainVelocidad = 0.6; // Manteniendo tú velocidad actual

      function animateMainScroll() {
        const galaOverlay = document.getElementById("gala-overlay");
        const prodOverlay = document.getElementById("productivity-overlay");

        let isGalaVisible = galaOverlay && !galaOverlay.classList.contains("hidden") && galaOverlay.style.display !== "none";
        let isProdVisible = prodOverlay && !prodOverlay.classList.contains("hidden") && prodOverlay.style.display !== "none";

        // Si estamos viendo la Tabla Principal (no hay overlays encendidos) scrolleamos
        if (!isGalaVisible && !isProdVisible) {
          mainScrollPos += mainVelocidad;
          tableWrapper.scrollTop = Math.round(mainScrollPos);

          const limit = parseFloat(tbody.dataset.originalHeight || 0);
          if (limit > 0 && mainScrollPos >= limit) {
            mainScrollPos -= limit;
            tableWrapper.scrollTop = Math.round(mainScrollPos);
          }
        }
        window.mainScrollInterval = requestAnimationFrame(animateMainScroll);
      }

      window.mainScrollInterval = requestAnimationFrame(animateMainScroll);
    });
  } else if (tclone) {
    tclone.innerHTML = html;
  }
}

// ==========================================
// GALA DE RECONOCIMIENTO (CAROUSEL)
// ==========================================
let galaInterval = null;
let dashboardTimeout = null;

function startGalaCycle(sortedUsers) {
  stopGala();
  showDashboardFull();

  // Solo este reloj: esperar 20s para ver las olas y luego saltar a la Gala
  dashboardTimeout = setTimeout(function () {
    showGala(sortedUsers);
  }, 60000);
}

function showDashboardFull() {
  let bg = document.querySelector(".bg-layer"); if (bg) bg.style.display = "block";
  let oc = document.querySelector(".ocean"); if (oc) oc.style.display = "block";
  let sm = document.querySelector(".summary-container"); if (sm) sm.style.display = "flex";
  let pd = document.getElementById("podium"); if (pd) pd.style.display = "flex";
  let tb = document.querySelector(".table-container"); if (tb) tb.style.display = "block";
  let prod = document.getElementById("productivity-overlay");
  if (prod) { prod.classList.add("hidden"); prod.style.display = "none"; }
}

function showGala(sortedUsers) {
  try {
    const overlay = document.getElementById("gala-overlay");
    const content = document.getElementById("gala-content");
    if (!overlay || !content) return;

    // Hide Main Dashboard explicitly to avoid overlap
    let bg = document.querySelector(".bg-layer"); if (bg) bg.style.display = "none";
    let oc = document.querySelector(".ocean"); if (oc) oc.style.display = "none";
    let sm = document.querySelector(".summary-container"); if (sm) sm.style.display = "none";
    let pd = document.getElementById("podium"); if (pd) pd.style.display = "none";
    let tb = document.querySelector(".table-container"); if (tb) tb.style.display = "none";

    let prod = document.getElementById("productivity-overlay");
    if (prod) { prod.classList.add("hidden"); prod.style.display = "none"; }

    overlay.style.display = "flex";
    overlay.classList.remove("hidden");

    let currentIndex = 0;

    function renderCurrentOperator() {
      if (currentIndex >= sortedUsers.length) {
        // IMPORTANTE: Limpiamos antes de pasar al mapa
        clearTimeout(galaInterval);
        galaInterval = null;
        showProductivity(sortedUsers);
        return;
      }

      let user = sortedUsers[currentIndex];
      let rank = currentIndex + 1;

      // Calculate Hours via strict regex exactly as required for string-time formats
      let horasTxt = "0H 0M";
      let totalHrsFloat = 0;

      if (user.horas && user.horas.size > 0) {
        let minMs = Infinity;
        let maxMs = -Infinity;

        user.horas.forEach(function (h) {
          if (typeof h !== "string") return;
          // Regex puro capturando horas, minutos y (opcional) segundos sin importar formato de fecha previo
          let match = h.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
          if (match) {
            let hr = parseInt(match[1], 10);
            let mn = parseInt(match[2], 10);
            let sc = match[3] ? parseInt(match[3], 10) : 0;
            // Convertimos puramente a milisegundos desde las "00:00:00"
            let t = (hr * 3600000) + (mn * 60000) + (sc * 1000);
            if (t < minMs) minMs = t;
            if (t > maxMs) maxMs = t;
          }
        });

        if (minMs !== Infinity && maxMs !== -Infinity) {
          let diffMs = maxMs - minMs;
          if (diffMs < 0) diffMs = 0;

          totalHrsFloat = diffMs / 3600000;
          let totalMins = Math.floor(diffMs / 60000);
          let hrOut = Math.floor(totalMins / 60);
          let mnOut = totalMins % 60;

          if (hrOut === 0 && mnOut === 0) {
            horasTxt = "0H 1M";
            totalHrsFloat = 1 / 60; // Para evitar infinito en cálculo de velocidad
          } else {
            horasTxt = hrOut + "H " + mnOut + "M";
          }
        }
      }

      // Nuevas Métricas Técnicas
      let velocidadVal = totalHrsFloat > 0 ? Math.round(user.lpns / totalHrsFloat) : user.lpns;
      let factorSku = user.lpns > 0 ? Math.round((user.userSkus.size / user.lpns) * 100) + "%" : "0%";

      let rankColorClass = rank === 1 ? "gala-gold" : (rank === 2 ? "gala-silver" : "gala-bronze");

      let html = `
                <div class="gala-slide">
                    <!-- Columna Izquierda: Foto y Nombre separados geometricamente -->
                    <div class="gala-left-column">
                        <div class="gala-photo-container">
                            <div class="gala-rank">#${rank}</div>
                            <img src="${user.foto}" class="gala-photo" />
                        </div>
                        <div class="gala-name-box">
                            <div class="gala-name-text">${user.username}</div>
                        </div>
                    </div>
                    
                    <!-- Columna Derecha: Estadisticas Simetricas (Optimizadas) -->
                    <div class="gala-stats-container">
                        <h2 class="gala-stats-title">ESTADÍSTICAS</h2>
                        <div class="gala-stat-row"><span>TOTAL LPN</span> <span class="gala-stat-val">${user.lpns.toLocaleString()}</span></div>
                        <div class="gala-stat-row"><span>TOTAL SKU</span> <span class="gala-stat-val">${user.userSkus.size}</span></div>
                        <div class="gala-stat-row"><span>PROVEEDORES</span> <span class="gala-stat-val">${user.userProv.size}</span></div>
                        <div class="gala-stat-row"><span>HORAS RECEPCIONANDO</span> <span class="gala-stat-val">${horasTxt}</span></div>
                        <div class="gala-stat-row"><span>ORIGEN:</span> <span class="gala-stat-val">${user.origenDP} DP / ${user.origenCDS} CDS</span></div>
                        <div class="gala-stat-row"><span>LPN / HORA</span> <span class="gala-stat-val">${velocidadVal}</span></div>
                        <div class="gala-stat-row"><span>DIFICULTAD LPN/SKU</span> <span class="gala-stat-val">${factorSku}</span></div>
                    </div>
                </div>
            `;
      content.innerHTML = html;

      currentIndex++;
      // Si tienes 9 usuarios, les dará 5 segundos a cada uno (9 * 5 = 45s)
      let perUserTime = 5000;
      galaInterval = setTimeout(renderCurrentOperator, perUserTime);
    }

    renderCurrentOperator();

  } catch (e) {
    console.error("Gala error", e);
    if (document.getElementById("gala-overlay")) {
      document.getElementById("gala-overlay").classList.add("hidden");
    }
  }
}

function stopGala() {
  clearTimeout(dashboardTimeout);
  clearTimeout(galaInterval);
  clearTimeout(prodTimeout);
  if (prodScrollInterval) clearInterval(prodScrollInterval);

  // Reseteamos a null para que loadData sepa que terminó el ciclo
  dashboardTimeout = null;
  galaInterval = null;
  prodTimeout = null;

  const gala = document.getElementById("gala-overlay");
  const prod = document.getElementById("productivity-overlay");
  if (gala) { gala.style.display = "none"; gala.classList.add("hidden"); }
  if (prod) { prod.style.display = "none"; prod.classList.add("hidden"); }
}

// ==========================================
// MÓDULO DE PRODUCTIVIDAD ESTRATÉGICA
// ==========================================
let prodTimeout = null;
let prodScrollInterval = null;

function showProductivity(sortedUsers) {
  try {
    const prodOverlay = document.getElementById("productivity-overlay");
    if (!prodOverlay) {
      startGalaCycle(sortedUsers);
      return;
    }

    // El Puente: Seguridad para cerrar la capa Gala anterior
    const galaOverlay = document.getElementById("gala-overlay");
    if (galaOverlay) {
      galaOverlay.classList.add("hidden");
      galaOverlay.style.display = "none";
    }

    let totalLPNs = 0;
    let globalSkus = new Set();
    let globalProv = new Set();
    let minHour = 24;
    let maxHour = -1;
    let hoursSet = new Set();
    let globalMaxVal = 1;

    sortedUsers.forEach(function (u) {
      totalLPNs += u.lpns;
      u.userSkus.forEach(s => globalSkus.add(s));
      u.userProv.forEach(p => globalProv.add(p));

      Object.keys(u.prodPorHora).forEach(function (h) {
        let hr = parseInt(h);
        if (hr < minHour) minHour = hr;
        if (hr > maxHour) maxHour = hr;
        hoursSet.add(hr);
        if (u.prodPorHora[h] > globalMaxVal) globalMaxVal = u.prodPorHora[h];
      });
    });

    // Tabla Fluida: Rango automático basado en datos reales
    if (minHour === 24) minHour = 8;
    if (maxHour === -1) maxHour = 18;

    let totalElapsedHours = (maxHour - minHour) + 1;
    if (totalElapsedHours < 1) totalElapsedHours = 1;

    let flowEff = (totalLPNs / totalElapsedHours).toFixed(0);
    let effUsuario = sortedUsers.length > 0 ? (totalLPNs / sortedUsers.length).toFixed(0) : "0";

    let globalDP = 0, globalCDS = 0;
    sortedUsers.forEach(function (u) {
      globalDP += (u.origenDP || 0);
      globalCDS += (u.origenCDS || 0);
    });
    let totalOrigins = globalDP + globalCDS;
    let pctDP = totalOrigins > 0 ? ((globalDP / totalOrigins) * 100).toFixed(0) : 0;
    let pctCDS = totalOrigins > 0 ? ((globalCDS / totalOrigins) * 100).toFixed(0) : 0;

    let elLpn = document.getElementById("kpi-lpn");
    if (elLpn) elLpn.innerText = totalLPNs.toLocaleString();

    let elSku = document.getElementById("kpi-sku");
    if (elSku) elSku.innerText = globalSkus.size.toLocaleString();

    let elProv = document.getElementById("kpi-prov");
    if (elProv) elProv.innerText = globalProv.size.toLocaleString();

    let elEffHr = document.getElementById("kpi-eff-hr");
    if (elEffHr) elEffHr.innerText = flowEff;

    let elEffUsr = document.getElementById("kpi-eff-usr");
    if (elEffUsr) elEffUsr.innerText = effUsuario;

    let elHrs = document.getElementById("kpi-hrs");
    if (elHrs) elHrs.innerText = totalElapsedHours.toString();

    let elMix = document.getElementById("kpi-mix");
    if (elMix) elMix.innerText = pctDP + "% / " + pctCDS + "%";

    let elUsers = document.getElementById("kpi-users");
    if (elUsers) elUsers.innerText = sortedUsers.length.toString();

    // Armar Headers Heatmap (Con Columna Posición y Horas Fijas)
    let headerHtml = '<th style="width: 5%;">POS</th><th style="width: 20%;">OPERADOR</th>';
    let activeHours = [];
    for (let h = minHour; h <= maxHour; h++) {
      let hStr = String(h).padStart(2, '0');
      activeHours.push(hStr);
      headerHtml += '<th>' + hStr + 'h</th>';
    }

    const headEl = document.getElementById("prod-heatmap-header");
    if (headEl) headEl.innerHTML = headerHtml;

    // Armar Body Heatmap
    let bodyHtml = "";
    let globalRank = 1;
    sortedUsers.forEach(function (u) {
      if (u.lpns === 0) return; // Saltamos inactivos

      let cleanName = String(u.username).replace(/[-.]/g, ' ').trim();

      bodyHtml += '<tr>';
      bodyHtml += '<td class="prod-td-rank">#' + globalRank + '</td>';
      bodyHtml += '<td class="prod-td-user">';
      bodyHtml += '<span>' + cleanName + '</span>';
      bodyHtml += '</td>';

      activeHours.forEach(function (hStr) {
        let val = u.prodPorHora[hStr] || 0;
        if (val === 0) {
          bodyHtml += '<td class="prod-empty" style="background: transparent;">-</td>';
        } else {
          // Verde Neón Proporcional
          let ratio = globalMaxVal > 0 ? (val / globalMaxVal) : 0;

          // Colores automáticos: de verde oscuro a verde neón chillón
          let gValue = Math.max(77, Math.floor(255 * ratio)); // #004d00 a #00FF00
          let bgColor = `rgb(0, ${gValue}, 0)`;

          let glowCSS = "";
          if (ratio >= 0.9) {
            glowCSS = "box-shadow: 0 0 15px #00FF00; z-index: 2; position: relative;";
          }

          let textColor = ratio > 0.5 ? "#000" : "#FFF";

          bodyHtml += `<td class="prod-cell" style="background-color: ${bgColor}; color: ${textColor}; ${glowCSS}">${val}</td>`;
        }
      });
      bodyHtml += '</tr>';
      globalRank++;
    });

    const bodyEl = document.getElementById("prod-heatmap-body");
    if (bodyEl) bodyEl.innerHTML = bodyHtml;

    // === SCROLL INFINITO REPARADO ===
    let prodScroll = document.querySelector(".prod-heatmap-scroll");
    if (prodScroll) {
      const tableBody = document.getElementById("prod-heatmap-body");

      tableBody.dataset.cloned = "";

      // Usamos requestAnimationFrame para asegurar que el DOM pintó las alturas reales
      requestAnimationFrame(function () {
        if (tableBody && !tableBody.dataset.cloned) {
          let originalHeight = tableBody.offsetHeight;
          let originalHTML = tableBody.innerHTML;

          if (originalHeight > 0) {
            // Para solucionar el problema de pocos datos (ej. 4 filas), calculamos la cantidad de clones dinámica
            // para llenar el contenedor al menos el doble y tener un loop infinito real y fluido
            let requiredCopies = Math.ceil((prodScroll.offsetHeight * 2) / originalHeight);
            if (requiredCopies < 2) requiredCopies = 2; // Al menos original + 1 copia

            for (let i = 1; i < requiredCopies; i++) {
              tableBody.innerHTML += originalHTML;
            }
            tableBody.dataset.cloned = "true";
            tableBody.dataset.originalHeight = originalHeight;
          }
        }

        let scrollPos = 0;
        const velocidad = 0.8; // Velocidad independiente mantenida para Mapa de Calor

        function animateScroll() {
          const overlay = document.getElementById("productivity-overlay");
          if (!overlay || overlay.style.display === "none" || overlay.classList.contains("hidden")) {
            return;
          }

          scrollPos += velocidad;
          prodScroll.scrollTop = Math.round(scrollPos);

          // El límite de cruce ahora es estrictamente la altura original, 
          // permitiendo fluidez absoluta incluso con poquísimos datos multiplicados.
          const limit = parseFloat(tableBody.dataset.originalHeight || 0);
          if (limit > 0 && scrollPos >= limit) {
            scrollPos -= limit;
            prodScroll.scrollTop = Math.round(scrollPos);
          }

          prodScrollInterval = requestAnimationFrame(animateScroll);
        }

        if (window.prodScrollInterval) cancelAnimationFrame(window.prodScrollInterval);
        window.prodScrollInterval = requestAnimationFrame(animateScroll);
      });
    }

    // Encender el contenedor con display: flex (Puente)
    prodOverlay.classList.remove("hidden");
    prodOverlay.style.display = "flex";

    // El Timer de 60s - Duración de la Pantalla
    prodTimeout = setTimeout(function () {
      stopGala();
      startGalaCycle(sortedUsers); // Vuelve a empezar todo el ciclo
    }, 50000); // 45 segundos viendo el mapa de calor

  } catch (e) {
    console.error("Productivity Error", e);
    startGalaCycle(sortedUsers);
  }
}

/* Configuración Fondo de Partículas Cinéticas */
if (typeof particlesJS !== "undefined") {
  particlesJS("particles-js", {
    "particles": {
      "number": { "value": 100, "density": { "enable": true, "value_area": 800 } },
      "color": { "value": "#00f2ff" },
      "shape": { "type": "circle" },
      "opacity": { "value": 0.5, "random": true, "anim": { "enable": true, "speed": 1, "opacity_min": 0.1, "sync": false } },
      "size": { "value": 3, "random": true, "anim": { "enable": false, "speed": 40, "size_min": 0.1, "sync": false } },
      "line_linked": { "enable": true, "distance": 150, "color": "#00f2ff", "opacity": 0.2, "width": 1 },
      "move": { "enable": true, "speed": 2, "direction": "none", "random": true, "straight": false, "out_mode": "out", "bounce": false, "attract": { "enable": false, "rotateX": 600, "rotateY": 1200 } }
    },
    "interactivity": {
      "detect_on": "canvas",
      "events": { "onhover": { "enable": true, "mode": "grab" }, "onclick": { "enable": true, "mode": "push" }, "resize": true },
      "modes": { "grab": { "distance": 140, "line_linked": { "opacity": 1 } }, "bubble": { "distance": 400, "size": 40, "duration": 2, "opacity": 8, "speed": 3 }, "repulse": { "distance": 200, "duration": 0.4 }, "push": { "particles_nb": 4 }, "remove": { "particles_nb": 2 } }
    },
    "retina_detect": true
  });
}
