/**
 * Undo Service
 * Gerencia a pilha de ações para permitir desfazer (Ctrl+Z).
 */

const UndoService = {
    stack: [],
    maxSize: 10,

    /**
     * Registra uma ação antes de ser executada.
     * @param {string} type - 'schedule', 'staff', 'alteration'
     * @param {string} key - ISO date ou null
     * @param {any} oldData - O dado antes da alteração
     */
    push(type, key, oldData) {
        // 深拷贝 data para evitar referências
        const snapshot = JSON.parse(JSON.stringify(oldData));
        this.stack.push({ type, key, snapshot });
        if (this.stack.length > this.maxSize) this.stack.shift();
        this.updateUI();
    },

    async undo() {
        if (this.stack.length === 0) return;

        const action = this.stack.pop();
        document.getElementById('loadingOverlay').style.display = 'flex';

        try {
            switch (action.type) {
                case 'schedule':
                    await window.EscalaStorage.saveSchedule(action.key, action.snapshot);
                    window.renderCalendar();
                    if (window.selectedDateISO === action.key) window.openDayEditor(action.key);
                    break;
                
                case 'staff':
                    window.EscalaStorage.staff = action.snapshot;
                    window.staff = action.snapshot;
                    await window.EscalaStorage.saveStaff();
                    window.renderTeamList();
                    break;

                case 'periods':
                    window.EscalaStorage.periods = action.snapshot;
                    window.periods = action.snapshot;
                    // Persiste a lista completa de períodos revertida
                    window.EscalaStorage.saveAllPeriods(action.snapshot);
                    window.renderPeriods();
                    break;

                case 'alteration':
                    localStorage.setItem('escala_alterations_history', JSON.stringify(action.snapshot));
                    window.renderTeamList();
                    if (window.activePeriodId) window.renderStats('KIRRA'); // Tenta atualizar ranking se houver time
                    window.renderCalendar();
                    break;
                
                case 'batch':
                    // Para lote, action.snapshot é um objeto com múltiplos ISOs antigos
                    for (const iso in action.snapshot) {
                        await window.EscalaStorage.saveSchedule(iso, action.snapshot[iso]);
                    }
                    window.renderCalendar();
                    break;
            }
            console.log(`Undo: ${action.type} revertido.`);
        } catch (e) {
            console.error("Erro no Undo:", e);
            alert("Erro ao desfazer ação.");
        } finally {
            document.getElementById('loadingOverlay').style.display = 'none';
            this.updateUI();
        }
    },

    updateUI() {
        const btn = document.getElementById('undoBtn');
        if (btn) {
            btn.style.display = this.stack.length > 0 ? 'inline-block' : 'none';
            btn.title = `Desfazer última alteração (${this.stack.length})`;
        }
    }
};

window.UndoService = UndoService;

// Atalho de teclado
window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        UndoService.undo();
    }
});
