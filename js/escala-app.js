/**
 * Escala Application Main
 * Orquestra a lógica de login, geração de escalas e utilitários.
 */

import { EscalaStorage } from "./services/escala-storage.js";

const EscalaApp = {
    async init() {
        // Inicialização básica de estado global
        window.currentDate = new Date();
        window.isSupervisor = false;

        document.getElementById('loadingOverlay').style.display = 'flex';
        try {
            const status = await EscalaStorage.init();
            
            if (!status || !status.success) {
                console.warn("Iniciando em modo Offline/Fallback:", status ? status.error : "Sem resposta de status");
                // Opcional: Avisar o usuário mas não bloquear a app
                const errorBanner = document.createElement('div');
                errorBanner.style = "background:#ffc107; color:black; padding:5px; text-align:center; font-size:12px; font-weight:bold;";
                errorBanner.innerText = "⚠ Modo Offline: Usando dados locais do navegador.";
                document.body.prepend(errorBanner);
            }

            const defaultEnd = new Date();
            defaultEnd.setMonth(defaultEnd.getMonth() + 2);
            defaultEnd.setDate(0); 
            const endInput = document.getElementById('configEndDate');
            if (endInput) endInput.value = defaultEnd.toISOString().split('T')[0];
            
            const startInput = document.getElementById('configStartDate');
            if (startInput) startInput.value = new Date().toISOString().split('T')[0];

            window.renderPeriods(); 
            window.renderTeamList();
        } catch (error) {
            console.error("Erro Crítico na inicialização:", error);
            alert("Erro fatal ao iniciar aplicação.\n\nDetalhes: " + error.message);
        } finally {
            document.getElementById('loadingOverlay').style.display = 'none';
        }
    },

    // --- Autenticação ---
    toggleAuth() {
        if (window.isSupervisor) {
            window.isSupervisor = false;
            document.getElementById('appTitle').innerText = "GUARDA-VIDAS MONSTRAO DA SURFLAND";
            document.getElementById('authBtn').innerText = "🔒 Login Supervisor";
        } else {
            document.getElementById('loginModal').style.display = 'flex';
        }
        window.renderTeamList();
        window.renderCalendar();
    },

    attemptLogin() {
        const u = document.getElementById('loginUser').value;
        const p = document.getElementById('loginPass').value;
        if (u === EscalaConfig.AUTH_CREDENTIALS.user && p === EscalaConfig.AUTH_CREDENTIALS.pass) {
            window.isSupervisor = true;
            document.getElementById('loginModal').style.display = 'none';
            alert("Login realizado como Supervisor!");
            document.getElementById('appTitle').innerText = "SUPERVISOR";
            document.getElementById('authBtn').innerText = "🔓 Sair";
            window.renderPeriods(); 
            window.renderTeamList();
            window.renderCalendar();
        } else {
            alert("Senha incorreta.");
        }
    },

    // --- Utilitários de Data ---
    getBrasiliaISO(d) {
        return d.toLocaleDateString('pt-BR', {timeZone: 'America/Sao_Paulo'}).split('/').reverse().join('-');
    },
    getTodayISO() { return this.getBrasiliaISO(new Date()); },
    isPast(iso) { return iso < this.getTodayISO() || iso < EscalaConfig.SYSTEM_START_DATE; },
    getTeam(iso) {
        const parts = iso.split('-').map(Number);
        const refParts = EscalaConfig.SYSTEM_START_DATE.split('-').map(Number);
        const refDate = Date.UTC(refParts[0], refParts[1]-1, refParts[2]);
        const targetDate = Date.UTC(parts[0], parts[1]-1, parts[2]);
        const diffDays = Math.floor((targetDate - refDate) / (1000 * 60 * 60 * 24));
        return (Math.abs(diffDays) % 2 === 0) ? 'KIRRA' : 'MUNDAKA';
    },

    // --- Lógica de Geração ---
    computeScheduleForDate(isoDate, numGuias = 8, numGVs = 12) {
        const teamName = this.getTeam(isoDate);
        const teamMembers = (window.staff || []).filter(s => s.team === teamName);
        
        // Determina o intervalo do ranking: apenas o período aberto
        const activePeriod = (window.periods || []).find(p => p.id === window.activePeriodId);
        const startDate = activePeriod ? activePeriod.start : null;
        const endDate = activePeriod ? activePeriod.end : isoDate;

        const justiceStats = JusticeService.calculateJustice(teamName, startDate, endDate);
        
        const rotativos = teamMembers.filter(s => s.role === 'ROTATIVO');
        
        rotativos.sort((a, b) => {
            const statA = justiceStats[a.id] || { ratio: 0, lastRole: null, shiftsSinceGuide: 999 };
            const statB = justiceStats[b.id] || { ratio: 0, lastRole: null, shiftsSinceGuide: 999 };
            
            const aWasG = statA.lastRole === 'guia' ? 1 : 0;
            const bWasG = statB.lastRole === 'guia' ? 1 : 0;
            if (aWasG !== bWasG) return aWasG - bWasG;
            if (Math.abs(statA.ratio - statB.ratio) > 0.05) return statA.ratio - statB.ratio;
            return statB.shiftsSinceGuide - statA.shiftsSinceGuide || (Math.random() - 0.5);
        });

        const finalGuides = teamMembers.filter(s => s.role === 'FIXO_GUIA').map(p => ({ staffId: p.id, name: p.name, originalRole: p.role, info: '' }));
        while (finalGuides.length < numGuias && rotativos.length > 0) {
            const p = rotativos.shift();
            finalGuides.push({ staffId: p.id, name: p.name, originalRole: p.role, info: `(${(justiceStats[p.id].ratio*100).toFixed(0)}%)` });
        }
        const finalGVs = teamMembers.filter(s => s.role === 'FIXO_GV').map(p => ({ staffId: p.id, name: p.name, originalRole: p.role, info: '' }));
        while (finalGVs.length < numGVs && rotativos.length > 0) {
            const p = rotativos.shift();
            finalGVs.push({ staffId: p.id, name: p.name, originalRole: p.role, info: '' });
        }
        while (finalGuides.length < numGuias) finalGuides.push({ staffId: null, name: '', originalRole: 'VAGO', info: 'Vazio' });
        while (finalGVs.length < numGVs) finalGVs.push({ staffId: null, name: '', originalRole: 'VAGO', info: 'Vazio' });
        return { team: teamName, guides: finalGuides, gvs: finalGVs, justiceSnapshot: justiceStats };
    },

    async saveDay() {
        if (!window.isSupervisor) return alert("🔒 Login necessário.");
        document.getElementById('loadingOverlay').style.display = 'flex';
        try {
            const getSlots = (type) => [...document.querySelectorAll(`.slot-row.role-${type} .slot-select`)].map(select => {
                const opt = select.options[select.selectedIndex];
                const cleanName = opt.text.split(' (')[0].replace(/✅ \[LIMPO\]|🚩 \[ALTERAÇÃO\]/g, '').trim();
                return { staffId: opt.value || null, name: cleanName, originalRole: opt.getAttribute('data-role') || 'VAGO', info: '' };
            });
            const oldData = EscalaStorage.schedules[window.selectedDateISO];
            UndoService.push('schedule', window.selectedDateISO, oldData || null);

            // Calcula estatísticas atuais para o snapshot
            const currentStats = JusticeService.calculateJustice(this.getTeam(window.selectedDateISO), window.selectedDateISO);

            const data = { 
                team: this.getTeam(window.selectedDateISO), 
                guides: getSlots('guia'), 
                gvs: getSlots('gv'),
                faltas: document.getElementById('editorFaltas').value,
                justiceSnapshot: currentStats
            };
            await EscalaStorage.saveSchedule(window.selectedDateISO, data);
            alert("Salvo!");
            window.renderCalendar();
            window.closeDayEditor();
        } catch (e) { alert("Erro: " + e.message); }
        finally { document.getElementById('loadingOverlay').style.display = 'none'; }
    },

    async generateFromMother() {
        if (!window.isSupervisor) return alert("🔒 Login necessário.");
        const dateLimit = document.getElementById('configEndDate').value;
        if (!dateLimit) return alert("Selecione uma data limite.");
        if (!confirm("Gerar escalas futuras?")) return;
        document.getElementById('loadingOverlay').style.display = 'flex';
        try {
            const numG = parseInt(document.getElementById('configGuias').value) || 8;
            const numV = parseInt(document.getElementById('configGVs').value) || 12;
            let pointer = new Date(window.selectedDateISO.split('-').map(Number).join(','));
            const end = new Date(dateLimit.split('-').map(Number).join(','));
            
            // Backup before batch
            const batchBackup = {};
            let tempPointer = new Date(pointer);
            while(tempPointer <= end) {
                const iso = this.getBrasiliaISO(tempPointer);
                batchBackup[iso] = EscalaStorage.schedules[iso] || null;
                tempPointer.setDate(tempPointer.getDate() + 1);
            }
            UndoService.push('batch', null, batchBackup);

            while (pointer <= end) {
                const iso = this.getBrasiliaISO(pointer);
                await EscalaStorage.saveSchedule(iso, this.computeScheduleForDate(iso, numG, numV));
                pointer.setDate(pointer.getDate() + 1);
            }
            alert("Escalas geradas!");
            window.renderCalendar();
            window.closeDayEditor();
        } catch (e) { alert("Erro: " + e.message); }
        finally { document.getElementById('loadingOverlay').style.display = 'none'; }
    },

    // --- Gestão de Períodos ---
    showNewPeriodForm() {
        if (!window.isSupervisor) return alert("🔒 Login necessário.");
        document.getElementById('newPeriodForm').style.display = 'block';
        window.scrollTo(0, 0);
    },

    async createPeriod() {
        const name = document.getElementById('newPeriodName').value;
        const start = document.getElementById('configStartDate').value;
        const end = document.getElementById('configEndDate').value;

        if (!name || !start || !end) return alert("Preencha o Nome, Início e Fim do Período.");
        if (start > end) return alert("Data início não pode ser maior que fim.");

        document.getElementById('loadingOverlay').style.display = 'flex';
        try {
            // Salva o Período
            const periodId = await EscalaStorage.savePeriod({ name, start, end });
            
            // Gera as Escalas (Lote)
            const numG = parseInt(document.getElementById('configGuias').value) || 8;
            const numV = parseInt(document.getElementById('configGVs').value) || 12;
            
            let pointer = new Date(start.split('-').map(Number).join(','));
            const stopDate = new Date(end.split('-').map(Number).join(','));

            let countNew = 0;
            let countExisting = 0;

            while (pointer <= stopDate) {
                const iso = this.getBrasiliaISO(pointer);
                // SÓ GERA SE NÃO EXISTIR NADA NESTA DATA
                if (!EscalaStorage.schedules[iso]) {
                    await EscalaStorage.saveSchedule(iso, this.computeScheduleForDate(iso, numG, numV));
                    countNew++;
                } else {
                    countExisting++;
                }
                pointer.setDate(pointer.getDate() + 1);
            }

            alert(`Escala de "${name}" criada com sucesso!\n\n✅ ${countExisting} dias já existentes foram recuperados.\n✨ ${countNew} novos dias foram gerados.`);
            document.getElementById('newPeriodForm').style.display = 'none';
            document.getElementById('newPeriodName').value = '';
            
            window.renderPeriods();
            CalendarRenderer.openPeriod(periodId);
        } catch (e) {
            alert("Erro ao criar: " + e.message);
        } finally {
            document.getElementById('loadingOverlay').style.display = 'none';
        }
    },

    async regenerateActivePeriod() {
        if (!window.activePeriodId) return;
        const p = EscalaStorage.periods.find(item => item.id === window.activePeriodId);
        if (!p) return;

        if (!confirm(`🚀 Deseja (re)gerar todas as escalas para o período "${p.name}"?\nIsso substituirá as escalas diárias existentes neste intervalo.`)) return;

        document.getElementById('loadingOverlay').style.display = 'flex';
        try {
            const numG = parseInt(document.getElementById('configGuias').value) || 8;
            const numV = parseInt(document.getElementById('configGVs').value) || 12;

            let pointer = new Date(p.start.split('-').map(Number).join(','));
            const stopDate = new Date(p.end.split('-').map(Number).join(','));

            while (pointer <= stopDate) {
                const iso = this.getBrasiliaISO(pointer);
                await EscalaStorage.saveSchedule(iso, this.computeScheduleForDate(iso, numG, numV));
                pointer.setDate(pointer.getDate() + 1);
            }
            alert("Escalas do período geradas com sucesso!");
            CalendarRenderer.openPeriod(p.id);
        } catch (e) {
            alert("Erro ao gerar: " + e.message);
        } finally {
            document.getElementById('loadingOverlay').style.display = 'none';
        }
    },

    async deletePeriod(id) {
        if (!confirm("Tem certeza que deseja excluir esta escala salva do programa?")) return;
        
        const oldPeriods = JSON.parse(JSON.stringify(EscalaStorage.periods)); 
        UndoService.push('periods', null, oldPeriods); 
        
        document.getElementById('loadingOverlay').style.display = 'flex';
        try {
            await EscalaStorage.deletePeriod(id);
            alert("Escala excluída com sucesso.");
            window.renderPeriods();
        } catch (e) {
            alert("Erro ao excluir: " + e.message);
        } finally {
            document.getElementById('loadingOverlay').style.display = 'none';
        }
    },

    cancelAlteration(staffId) {
        if (!confirm("Deseja cancelar a última alteração registrada para este funcionário?")) return;
        
        const history = EscalaStorage.getAlterations();
        if (!history[staffId] || history[staffId].length === 0) return;

        UndoService.push('alteration', null, JSON.parse(JSON.stringify(history)));
        
        // Remove a última entrada do histórico
        history[staffId].pop();
        if (history[staffId].length === 0) delete history[staffId];
        
        localStorage.setItem('escala_alterations_history', JSON.stringify(history));
        
        window.renderTeamList();
        const staff = (EscalaStorage.staff || []).find(s => s.id === staffId);
        if (staff) window.renderStats(staff.team);
        alert("Alteração cancelada!");
    },

    async addStaff() {
        if (!window.isSupervisor) return alert("Login necessário.");
        const name = document.getElementById('addName').value;
        const team = document.getElementById('addTeam').value;
        const role = document.getElementById('addRole').value;
        if (!name) return alert("Digite o nome.");
        document.getElementById('loadingOverlay').style.display = 'flex';
        try {
            UndoService.push('staff', null, EscalaStorage.staff);
            EscalaStorage.staff.push({ id: Date.now().toString(), name, team, role });
            await EscalaStorage.saveStaff();
            window.renderTeamList();
            document.getElementById('addName').value = '';
        } catch (e) { alert("Erro: " + e.message); }
        finally { document.getElementById('loadingOverlay').style.display = 'none'; }
    },
    async removeStaff(idx) {
        if (!window.isSupervisor) return alert("Login necessário.");
        if (!confirm('Tem certeza?')) return;
        document.getElementById('loadingOverlay').style.display = 'flex';
        try {
            UndoService.push('staff', null, EscalaStorage.staff);
            EscalaStorage.staff.splice(idx, 1);
            await EscalaStorage.saveStaff();
            window.renderTeamList();
        } catch (e) { alert("Erro: " + e.message); }
        finally { document.getElementById('loadingOverlay').style.display = 'none'; }
    },

    async addFreelancer() {
        if (!window.isSupervisor) return alert("Login necessário.");
        const name = document.getElementById('addFreelaName').value;
        if (!name) return alert("Digite o nome do freelancer.");
        document.getElementById('loadingOverlay').style.display = 'flex';
        try {
            UndoService.push('freelancers', null, EscalaStorage.freelancers);
            EscalaStorage.freelancers.push({ id: 'freela_' + Date.now(), name, role: 'FREELANCER' });
            await EscalaStorage.saveFreelancers();
            window.renderTeamList();
            document.getElementById('addFreelaName').value = '';
        } catch (e) { alert("Erro: " + e.message); }
        finally { document.getElementById('loadingOverlay').style.display = 'none'; }
    },

    async removeFreelancer(idx) {
        if (!window.isSupervisor) return alert("Login necessário.");
        if (!confirm('Tem certeza?')) return;
        document.getElementById('loadingOverlay').style.display = 'flex';
        try {
            UndoService.push('freelancers', null, EscalaStorage.freelancers);
            EscalaStorage.freelancers.splice(idx, 1);
            await EscalaStorage.saveFreelancers();
            window.renderTeamList();
        } catch (e) { alert("Erro: " + e.message); }
        finally { document.getElementById('loadingOverlay').style.display = 'none'; }
    }
};

// --- Exposições Globais ---
window.toggleAuth = () => EscalaApp.toggleAuth();
window.attemptLogin = () => EscalaApp.attemptLogin();
window.copyToClipboard = () => {
    const iso = window.selectedDateISO;
    EscalaExport.copyDailyScale(iso, EscalaStorage.schedules[iso]);
};
window.downloadBatch = () => {
    const start = document.getElementById('configStartDate').value;
    const end = document.getElementById('configEndDate').value;
    if (!start || !end) return alert("Selecione o período.");
    EscalaExport.exportSchedulesBatch(start, end);
};
window.saveDay = () => EscalaApp.saveDay();
window.generateBatch = () => EscalaApp.generateBatch();
window.generateFromMother = () => EscalaApp.generateFromMother();
window.addStaff = () => EscalaApp.addStaff();
window.removeStaff = (idx) => EscalaApp.removeStaff(idx);
window.addFreelancer = () => EscalaApp.addFreelancer();
window.removeFreelancer = (idx) => EscalaApp.removeFreelancer(idx);

// Period UI
window.showNewPeriodForm = () => EscalaApp.showNewPeriodForm();
window.createPeriod = () => EscalaApp.createPeriod();
window.deletePeriod = (id) => EscalaApp.deletePeriod(id);
window.renderPeriods = () => CalendarRenderer.renderPeriods();
window.backToDashboard = () => CalendarRenderer.backToDashboard();
window.regenerateActivePeriod = () => EscalaApp.regenerateActivePeriod();
window.cancelAlteration = (id) => EscalaApp.cancelAlteration(id);

window.generateSingleDayUI = () => {
    const numG = parseInt(document.getElementById('configGuias').value) || 8;
    const numV = parseInt(document.getElementById('configGVs').value) || 12;
    const sch = EscalaApp.computeScheduleForDate(window.selectedDateISO, numG, numV);
    window.renderEditorSlots(sch.guides, sch.gvs);
};
window.resetRankingDate = () => {
    if (confirm("Zerar ranking?")) {
        EscalaStorage.saveRankingResetDate(EscalaApp.getTodayISO());
        window.renderStats('KIRRA');
    }
};
window.reportAlteration = (id, name) => {
    const today = EscalaApp.getTodayISO();
    const weeks = prompt(`Marcar alteração para ${name}?\n\nDigite a duração:\n1 - Uma semana\n2 - Duas semanas\n3 - Três semanas\n4 - Um mês (Padrão)`, "4");
    
    if (weeks === null) return;
    const numWeeks = parseInt(weeks);
    if (isNaN(numWeeks) || numWeeks < 1 || numWeeks > 52) {
        return alert("Duração inválida. Use um número de 1 a 4.");
    }

    UndoService.push('alteration', null, EscalaStorage.getAlterations());
    EscalaStorage.saveAlteration(id, today, numWeeks);
    window.renderTeamList();
    const staff = (EscalaStorage.staff || []).find(s => s.id === id);
    if (staff) window.renderStats(staff.team);
    
    if (document.getElementById('dayEditor').style.display !== 'none') {
        window.openDayEditor(window.selectedDateISO);
    }
    window.renderCalendar();
    alert(`Alteração registrada para ${name} por ${numWeeks} semana(s).`);
};

window.switchTab = (id, event) => {
    document.querySelectorAll('.tab-content, .nav-item').forEach(el => el.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    if (event && event.currentTarget) {
        event.currentTarget.classList.add('active');
    }
    const label = document.getElementById('rankingStartDateLabel');
    if (label) label.innerText = EscalaStorage.getRankingResetDate().split('-').reverse().join('/');
    if (id === 'tabStats') window.renderStats('KIRRA');
};
window.changeMonth = (n) => { window.currentDate.setMonth(window.currentDate.getMonth() + n); window.renderCalendar(); };
window.closeDayEditor = () => document.getElementById('dayEditor').style.display = 'none';
window.getBrasiliaISO = (d) => EscalaApp.getBrasiliaISO(d);
window.getTodayISO = () => EscalaApp.getTodayISO();
window.isPast = (iso) => EscalaApp.isPast(iso);
window.getTeam = (iso) => EscalaApp.getTeam(iso);

EscalaApp.init();
