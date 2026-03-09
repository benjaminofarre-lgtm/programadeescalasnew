/**
 * Calendar Renderer UI
 * Gerencia a renderização do Calendário, Estatísticas e Lista de Equipe.
 */

const CalendarRenderer = {
    renderCalendar() {
        this.renderPeriods();
    },

    renderPeriods() {
        const listContainer = document.getElementById('periodsList');
        if (!listContainer) return;
        
        // Garante a visibilidade do botão apenas para supervisores na dashboard
        const btnNew = document.getElementById('btnNewPeriod');
        if (btnNew) btnNew.style.display = window.isSupervisor ? 'inline-block' : 'none';

        listContainer.innerHTML = '';
        const periods = window.periods || [];

        if (periods.length === 0) {
            listContainer.innerHTML = '<p style="grid-column:1/-1; text-align:center; color:#999; padding:40px;">Nenhuma escala salva. Clique no botão acima para criar sua primeira escala mensal.</p>';
            return;
        }

        periods.sort((a, b) => b.id - a.id).forEach(p => {
            const card = document.createElement('div');
            card.className = 'col-panel';
            card.style = 'cursor:pointer; position:relative; transition: 0.2s; border-top: 5px solid var(--accent);';
            
            const deleteBtn = window.isSupervisor ? `
                <button class="btn-warn-small" style="position:absolute; top:10px; right:10px; background:#e74c3c;" 
                onclick="event.stopPropagation(); window.deletePeriod('${p.id}')" title="Excluir Período">X</button>` : '';

            card.onclick = () => this.openPeriod(p.id);
            card.innerHTML = `
                ${deleteBtn}
                <div style="font-size:0.8em; color:#7f8c8d; margin-bottom:5px;">ID: ${p.id}</div>
                <h3 style="margin:0 0 10px 0; color:var(--primary);">${p.name}</h3>
                <div style="font-size:0.9em; color:#555;">
                    📅 <b>Início:</b> ${p.start.split('-').reverse().join('/')}<br>
                    🏁 <b>Fim:</b> ${p.end.split('-').reverse().join('/')}
                </div>
                <div style="margin-top:15px; text-align:right;">
                    <span style="color:var(--accent); font-weight:bold; font-size:0.9em;">ABRIR ESCALA →</span>
                </div>
            `;
            listContainer.appendChild(card);
        });
    },

    openPeriod(id) {
        const p = (window.periods || []).find(item => item.id === id);
        if (!p) return;

        window.activePeriodId = id;
        document.getElementById('periodsList').style.display = 'none';
        document.getElementById('btnNewPeriod').style.display = 'none';
        document.getElementById('periodTitle').style.display = 'none';
        
        const activeView = document.getElementById('activePeriodView');
        activeView.style.display = 'block';
        document.getElementById('activePeriodLabel').innerText = `Visualizando: ${p.name}`;

        const btnRegen = document.getElementById('btnRegenerateActive');
        if (btnRegen) btnRegen.style.display = window.isSupervisor ? 'inline-block' : 'none';

        this.renderTimeline(p.start, p.end);
    },

    backToDashboard() {
        window.activePeriodId = null;
        document.getElementById('activePeriodView').style.display = 'none';
        
        const btnRegen = document.getElementById('btnRegenerateActive');
        if (btnRegen) btnRegen.style.display = 'none';

        document.getElementById('periodsList').style.display = 'grid';
        document.getElementById('btnNewPeriod').style.display = window.isSupervisor ? 'inline-block' : 'none';
        document.getElementById('periodTitle').style.display = 'block';
        this.renderPeriods();
    },

    renderTimeline(start, end) {
        const grid = document.getElementById('scheduleTimeline');
        if (!grid) return;
        grid.innerHTML = '';

        let pointer = new Date(start.split('-').map(Number).join(','));
        const stopDate = new Date(end.split('-').map(Number).join(','));

        const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

        while (pointer <= stopDate) {
            const iso = window.getBrasiliaISO(pointer);
            const team = window.getTeam(iso);
            const hasSchedule = window.schedules[iso];
            
            const div = document.createElement('div');
            div.className = `day-card ${iso === window.getTodayISO() ? 'today' : ''}`;
            div.style = "min-height: 120px; display:flex; flex-direction:column; justify-content:space-between;";
            div.onclick = () => window.openDayEditor(iso);
            
            div.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <b style="font-size:1.1em;">${pointer.getDate()}</b>
                    <span style="font-size:0.7em; color:#999; text-transform:uppercase;">${dayNames[pointer.getDay()]}</span>
                </div>
                <div style="text-align:center;">
                    <span class="team-badge ${team === 'KIRRA' ? 'bg-kirra' : 'bg-mundaka'}">${team}</span>
                </div>
                <div style="height:10px; display:flex; justify-content:center; gap:5px;">
                    ${hasSchedule ? '<div class="status-generated" style="position:static;" title="Escala Salva"></div>' : ''}
                    ${this.hasPenaltyOnDay(iso) ? '<div style="width:8px; height:8px; background:#e74c3c; border-radius:50%;" title="Aviso: Alguém com alteração neste dia"></div>' : ''}
                </div>
            `;
            grid.appendChild(div);
            pointer.setDate(pointer.getDate() + 1);
        }
    },

    hasPenaltyOnDay(iso) {
        const sch = window.schedules[iso];
        if (!sch) return false;
        
        const allSlots = [...(sch.guides || []), ...(sch.gvs || [])];
        return allSlots.some(slot => {
            if (!slot.staffId) return false;
            return JusticeService.getPenalizedStatus(slot.staffId, iso) === 'penalized';
        });
    },

    openDayEditor(iso) {
        window.selectedDateISO = iso;
        document.getElementById('dayEditor').style.display = 'block';
        document.getElementById('editorTitle').innerText = `Escala: ${iso.split('-').reverse().join('/')}`;
        
        const team = window.getTeam(iso);
        const badge = document.getElementById('editorTeamBadge');
        badge.innerText = team;
        badge.className = `team-badge ${team === 'KIRRA' ? 'bg-kirra' : 'bg-mundaka'}`;
        
        const dateIsPast = window.isPast(iso);
        const warningDiv = document.getElementById('pastWarning');

        if (window.isSupervisor && !dateIsPast) {
            warningDiv.style.display = 'none';
            document.getElementById('btnMother').style.display = 'inline-block';
            document.getElementById('btnSave').style.display = 'inline-block';
            document.getElementById('btnGenerate').style.display = 'inline-block';
        } else {
            warningDiv.style.display = 'block';
            warningDiv.innerText = dateIsPast ? "⚠ Data Anterior a 21/02/2026. Edição Bloqueada." : "⚠ Modo Leitura. Faça login para editar.";
            document.getElementById('btnMother').style.display = 'none';
            document.getElementById('btnSave').style.display = 'none';
            document.getElementById('btnGenerate').style.display = 'none';
        }
        
        if (window.schedules[iso]) {
            const sch = window.schedules[iso];
            this.renderEditorSlots(sch.guides, sch.gvs);
            document.getElementById('editorFaltas').value = sch.faltas || '';
            // Se houver snapshot salvo nesta escala, mostra ele na aba de estatísticas
            if (sch.justiceSnapshot) {
                this.renderStats(team, sch.justiceSnapshot);
            }
        } else {
            const numGuias = parseInt(document.getElementById('configGuias').value) || 8;
            const numGVs = parseInt(document.getElementById('configGVs').value) || 12;
            const emptyGuides = Array(numGuias).fill({staffId: null, name: '', originalRole: 'VAGO', info: ''});
            const emptyGVs = Array(numGVs).fill({staffId: null, name: '', originalRole: 'VAGO', info: ''});
            this.renderEditorSlots(emptyGuides, emptyGVs);
            document.getElementById('editorFaltas').value = '';
        }
        this.renderFreelancerStats();
    },

    renderEditorSlots(guides, gvs) {
        const canEdit = window.isSupervisor && !window.isPast(window.selectedDateISO);
        const currentTeam = window.getTeam(window.selectedDateISO);
        const teamMembers = window.staff.filter(s => s.team === currentTeam).sort((a,b) => a.name.localeCompare(b.name));
        
        document.getElementById('headerGuias').innerText = `🏄 GUÍAS (${guides.length})`;
        document.getElementById('headerGVs').innerText = `🏊 GUARDA-VIDAS (${gvs.length})`;

        const makeHTML = (list, type) => list.map((slot, i) => {
            let options = `<option value="" data-role="VAGO">-- Vazio --</option>`;
            let selectedStatus = 'clean';
            
            teamMembers.forEach(s => {
                const isSelected = s.id === slot.staffId ? 'selected' : '';
                // Passa a data selecionada do calendário para o check de penalidade
                const staffStatus = JusticeService.getPenalizedStatus(s.id, window.selectedDateISO);
                if (isSelected) selectedStatus = staffStatus;
                
                const optColor = staffStatus === 'penalized' ? '#c0392b' : '#27ae60';
                options += `<option value="${s.id}" data-role="${s.role}" ${isSelected} style="color:${optColor}">${s.name} (${formatRole(s.role)})</option>`;
            });

            // Adiciona Freelancers no final do select
            if (window.freelancers && window.freelancers.length > 0) {
                options += `<optgroup label="--- Freelancers ---">`;
                window.freelancers.forEach(f => {
                    const isSelected = f.id === slot.staffId ? 'selected' : '';
                    if (isSelected) selectedStatus = 'clean';
                    options += `<option value="${f.id}" data-role="FREELANCER" ${isSelected} style="color:#9b59b6;">${f.name} (FREELA)</option>`;
                });
                options += `</optgroup>`;
            }

            if (slot.name && !slot.staffId) {
                options += `<option value="" data-role="${slot.originalRole}" selected>${slot.name} (Manual)</option>`;
            }

            const rowBg = selectedStatus === 'penalized' ? '#fff0f0' : '#f0fff0';
            const textCol = selectedStatus === 'penalized' ? '#c0392b' : '#27ae60';

            return `
            <div class="slot-row role-${type} ${slot.originalRole === 'VAGO' ? 'empty-slot' : ''}" style="background:${rowBg}; border-left: 5px solid ${textCol}">
                <span class="slot-pos">${type === 'guia' ? 'GD' : 'GV'}${i + 1}</span>
                <select class="slot-select" id="${type}-${i}" ${canEdit ? '' : 'disabled'} 
                    style="color:${textCol}; font-weight:bold;" 
                    onchange="CalendarRenderer.updateSlotColor(this)">
                    ${options}
                </select>
                <span class="slot-info">${slot.info || formatRole(slot.originalRole)}</span>
            </div>`;
        }).join('');
            
        document.getElementById('listGuides').innerHTML = makeHTML(guides, 'guia');
        document.getElementById('listGVs').innerHTML = makeHTML(gvs, 'gv');
    },

    renderStats(teamName, snapshotData = null) {
        let stats;
        
        // Se estamos dentro de um período ativo, o ranking deve ser calculado 
        // apenas entre a data inicial e final desse período específico.
        const activePeriod = (window.periods || []).find(p => p.id === window.activePeriodId);
        
        if (snapshotData) {
            stats = snapshotData;
        } else if (activePeriod) {
            stats = JusticeService.calculateJustice(teamName, activePeriod.start, activePeriod.end);
        } else {
            stats = JusticeService.calculateJustice(teamName);
        }

        const tbody = document.getElementById('statsTableBody');
        if (!tbody) return;
        tbody.innerHTML = '';
        
        Object.keys(stats).sort((a,b) => stats[a].ratio - stats[b].ratio).forEach((id, idx) => {
            const s = stats[id];
            const status = JusticeService.getPenalizedStatus(id);
            const color = status === 'penalized' ? '#c0392b' : '#27ae60';
            const pct = (s.ratio * 100).toFixed(0);
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${idx < 5 ? '<b style="color:red">ALTA</b>' : 'Normal'}</td>
                <td style="color:${color}; font-weight:bold;">${s.name}</td>
                <td>${s.total}</td>
                <td>${s.guides}</td>
                <td>
                    <div style="display:flex; align-items:center; gap:5px;">
                        <div class="bar-container"><div class="bar-fill" style="width:${pct}%"></div></div> ${pct}%
                        ${!snapshotData && window.isSupervisor ? `<button class="btn-warn-small" onclick="window.reportAlteration('${id}', '${s.name}')" title="Marcar Alteração">⚠️</button>` : ''}
                    </div>
                </td>`;
            tbody.appendChild(tr);
        });

        // Se for snapshot, atualizar o rótulo da data
        const label = document.getElementById('rankingStartDateLabel');
        if (snapshotData && label) {
            label.innerHTML = `<span style="color:var(--accent); font-weight:bold;">📍 Mostrando Ranking SALVO (conforme estava no dia da escala)</span>`;
        } else if (activePeriod && label) {
            label.innerHTML = `Período Ativo: <b>${activePeriod.start.split('-').reverse().join('/')}</b> até <b>${activePeriod.end.split('-').reverse().join('/')}</b>`;
        } else if (label) {
            label.innerText = JusticeService.getRankingResetDate().split('-').reverse().join('/');
        }
    },

    renderTeamList() {
        const div = document.getElementById('teamList');
        if (!div) return;
        div.innerHTML = '';
        
        if (window.staff.length === 0) {
            div.innerHTML = '<p style="grid-column: 1/-1; text-align:center; color:#999;">Nenhum funcionário cadastrado.</p>';
            return;
        }

        window.staff.sort((a,b) => a.name.localeCompare(b.name)).forEach((s, idx) => {
            const status = JusticeService.getPenalizedStatus(s.id);
            const bgColor = status === 'penalized' ? '#ffcccc' : '#ccffcc';
            const textColor = status === 'penalized' ? '#c0392b' : '#27ae60';

            const el = document.createElement('div');
            el.style = `background:${bgColor}; padding:10px; border:1px solid #ddd; border-radius:4px; display:flex; justify-content:space-between; align-items:center;`;
            
            const actionBtns = window.isSupervisor ? `
                <div style="display:flex; flex-direction:column; gap:5px;">
                    <div style="display:flex; gap:5px;">
                        <button class="btn" style="background:#e67e22; color:white; padding:4px 8px; font-size:10px; font-weight:bold;" onclick="window.reportAlteration('${s.id}', '${s.name}')">MARCAR ALTERAÇÃO</button>
                        ${status === 'penalized' ? `<button class="btn" style="background:#34495e; color:white; padding:4px 8px; font-size:10px; font-weight:bold;" onclick="window.cancelAlteration('${s.id}')">CANCELAR ALTERAÇÃO</button>` : ''}
                    </div>
                    <button class="btn btn-danger" style="padding:2px 10px; width:100%; font-size:10px;" onclick="window.removeStaff(${idx})">REMOVER FUNCIONÁRIO</button>
                </div>` : '';
            
            el.innerHTML = `
                <div><strong style="color:${textColor}">${s.name}</strong><br>
                <span style="font-size:0.8em; color:#666">${s.team} - ${formatRole(s.role)}</span></div>
                ${actionBtns}
            `;
            div.appendChild(el);
        });

        // Renderiza Freelancers
        const freeDiv = document.getElementById('freelancerList');
        if (freeDiv) {
            freeDiv.innerHTML = '';
            if (window.freelancers.length === 0) {
                freeDiv.innerHTML = '<p style="grid-column: 1/-1; text-align:center; color:#999;">Nenhum freelancer cadastrado.</p>';
            } else {
                window.freelancers.forEach((f, idx) => {
                    const el = document.createElement('div');
                    el.style = `background:#f3e5f5; padding:10px; border:1px solid #ddd; border-top: 3px solid #9b59b6; border-radius:4px; display:flex; justify-content:space-between; align-items:center;`;
                    el.innerHTML = `
                        <div><strong style="color:#8e44ad">${f.name}</strong><br>
                        <span style="font-size:0.8em; color:#666">Freelancer</span></div>
                        ${window.isSupervisor ? `<button class="btn btn-danger" style="padding:2px 10px; font-size:10px;" onclick="window.removeFreelancer(${idx})">REMOVER</button>` : ''}
                    `;
                    freeDiv.appendChild(el);
                });
            }
        }
    },

    renderFreelancerStats() {
        const container = document.getElementById('freelancerCountList');
        if (!container) return;
        container.innerHTML = '';

        const activePeriod = (window.periods || []).find(p => p.id === window.activePeriodId);
        if (!activePeriod) {
            container.innerHTML = '<i>Abra um período para ver estatísticas do lote.</i>';
            return;
        }

        const counts = {};
        window.freelancers.forEach(f => counts[f.id] = 0);

        // Percorre escalas do período
        Object.keys(window.schedules).forEach(iso => {
            if (iso >= activePeriod.start && iso <= activePeriod.end) {
                const sch = window.schedules[iso];
                const allUsed = [...sch.guides, ...sch.gvs];
                allUsed.forEach(slot => {
                    if (slot.staffId && slot.staffId.startsWith('freela_')) {
                        counts[slot.staffId] = (counts[slot.staffId] || 0) + 1;
                    }
                });
            }
        });

        const sorted = window.freelancers.slice().sort((a,b) => counts[b.id] - counts[a.id]);
        if (sorted.length === 0) {
            container.innerHTML = 'Nenhum freelancer cadastrado.';
            return;
        }

        sorted.forEach(f => {
            const count = counts[f.id] || 0;
            const div = document.createElement('div');
            div.style = "display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid #eee;";
            div.innerHTML = `<span>${f.name}</span> <b>${count}</b>`;
            container.appendChild(div);
        });
    },

    updateSlotColor(select) {
        let color = select.options[select.selectedIndex].style.color || '#27ae60';
        // Se for freela, a cor vem do style mas o style.color pode estar vazio se não for setado explicitamente em alguns browsers
        // Forçamos a cor se for freela
        if (select.options[select.selectedIndex].getAttribute('data-role') === 'FREELANCER') {
            color = '#9b59b6';
        }
        select.style.color = color;
        const row = select.parentElement;
        if (row && row.classList.contains('slot-row')) {
            row.style.background = (color === '#c0392b' ? '#fff0f0' : '#f0fff0');
            row.style.borderLeftColor = color;
        }
    }
};

function formatRole(r) { 
    return r.replace('FIXO_', 'Fixo ').replace('ROTATIVO', 'Rotativo').replace('GUIA', 'Guia'); 
}

// Global Aliases
window.renderCalendar = () => CalendarRenderer.renderCalendar();
window.openDayEditor = (iso) => CalendarRenderer.openDayEditor(iso);
window.renderTeamList = () => CalendarRenderer.renderTeamList();
window.renderStats = (team) => CalendarRenderer.renderStats(team);
