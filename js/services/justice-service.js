/**
 * Justice Service
 * Lógica pura de cálculos de rotatividade e penalidades.
 */

const JusticeService = {
    /**
     * Calcula as estatísticas de rotatividade a partir de uma data de reset.
     */
    calculateJustice(teamName, startDate = null, endDate = '2099-01-01') {
        const stats = {};
        const staff = window.staff || [];
        const schedules = window.schedules || {};
        
        // Define data inicial de busca (global se não passar nada)
        const dStart = startDate || localStorage.getItem('escala_ranking_reset_date') || (window.SYSTEM_START_DATE || '2026-02-21');

        staff.filter(s => s.team === teamName && s.role === 'ROTATIVO').forEach(s => {
            stats[s.id] = { id: s.id, name: s.name, total: 0, guides: 0, ratio: 0, lastRole: null, shiftsSinceGuide: 999 };
        });

        const sortedDates = Object.keys(schedules)
            .filter(d => d >= dStart && d <= endDate)
            .sort();

        sortedDates.forEach(date => {
            const sch = schedules[date];
            if (sch.team !== teamName) return;

            sch.guides.forEach(slot => {
                if (slot.staffId && stats[slot.staffId]) {
                    stats[slot.staffId].guides++;
                    stats[slot.staffId].total++;
                    stats[slot.staffId].lastRole = 'guia';
                    stats[slot.staffId].shiftsSinceGuide = 0;
                }
            });
            sch.gvs.forEach(slot => {
                if (slot.staffId && stats[slot.staffId]) {
                    stats[slot.staffId].total++;
                    stats[slot.staffId].lastRole = 'gv';
                    stats[slot.staffId].shiftsSinceGuide++;
                }
            });
        });

        Object.keys(stats).forEach(id => {
            const s = stats[id];
            s.ratio = s.total === 0 ? 0 : (s.guides / s.total);
        });
        return stats;
    },

    getPenalizedStatus(staffId, forDateISO = null) {
        const history = JSON.parse(localStorage.getItem('escala_alterations_history') || '{}')[staffId] || [];
        
        // Se não passar data, usa HOJE (no formato YYYY-MM-DD local)
        let refDate = forDateISO;
        if (!refDate) {
           const now = new Date();
           refDate = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
        }
        
        return history.some(item => {
            if (typeof item === 'object' && item.expires) {
                return refDate <= item.expires;
            }
            // Legado: 30 dias se for apenas uma string de data
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            return new Date(item) >= thirtyDaysAgo;
        }) ? 'penalized' : 'clean';
    }
};

window.JusticeService = JusticeService;
