/**
 * Escala Storage Service
 * Gerencia o estado e as persistências (Firestore, LocalStorage).
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let db;

const EscalaStorage = {
    staff: [],
    freelancers: [],
    schedules: {},
    periods: [], // Lista de períodos salvos {id, name, start, end}
    activePeriodId: null,
    isSupervisor: false,
    currentDate: new Date(),
    selectedDateISO: null,

async init() {
    if (!window.EscalaConfig || !window.EscalaConfig.firebaseConfig) {
        console.warn("Firebase config not found. Defaulting to empty data.");
        this.staff = [];
        this.schedules = {};
        window.staff = this.staff;
        window.schedules = this.schedules;
        return;
    }

    try {
        const app = initializeApp(window.EscalaConfig.firebaseConfig);
        db = getFirestore(app);
        
        // Carrega dados iniciais
        await this.loadInitialData();
        return { success: true };
    } catch (error) {
        console.error("Firebase Init Error:", error);
        // Fallback to local storage or empty data to allow app to run
        this.staff = JSON.parse(localStorage.getItem('escala_fallback_staff') || '[]');
        this.schedules = JSON.parse(localStorage.getItem('escala_fallback_schedules') || '{}');
        window.staff = this.staff;
        window.schedules = this.schedules;
        return { success: false, error: error.message };
    }
},

async loadInitialData() {
    try {
        const staffDoc = await getDoc(doc(db, "settings", "staff"));
        this.staff = staffDoc.exists() ? staffDoc.data().list || [] : [];
        window.staff = this.staff;

        const freelancersDoc = await getDoc(doc(db, "settings", "freelancers"));
        this.freelancers = freelancersDoc.exists() ? freelancersDoc.data().list || [] : [];
        window.freelancers = this.freelancers;

        // Carrega períodos
        const periodsSnapshot = await getDocs(collection(db, "periods"));
        this.periods = [];
        periodsSnapshot.forEach(doc => {
            const data = doc.data();
            if (data) this.periods.push({ id: doc.id, ...data });
        });
        window.periods = this.periods;

        // Carrega escalas individuais (schedules)
        const schedulesSnapshot = await getDocs(collection(db, "schedules"));
        this.schedules = {};
        schedulesSnapshot.forEach(doc => {
            this.schedules[doc.id] = doc.data();
        });
        window.schedules = this.schedules;

        // Save locally as fallback
        localStorage.setItem('escala_fallback_staff', JSON.stringify(this.staff));
        localStorage.setItem('escala_fallback_freelancers', JSON.stringify(this.freelancers));
        localStorage.setItem('escala_fallback_schedules', JSON.stringify(this.schedules));
        localStorage.setItem('escala_fallback_periods', JSON.stringify(this.periods));

    } catch (error) {
        console.error("Erro DB Load:", error);
        throw error;
    }
},

    async saveStaff() {
        await setDoc(doc(db, "settings", "staff"), { list: this.staff });
    },

    async saveFreelancers() {
        await setDoc(doc(db, "settings", "freelancers"), { list: this.freelancers });
    },

    async saveSchedule(isoDate, data) {
        await setDoc(doc(db, "schedules", isoDate), data);
        this.schedules[isoDate] = data;
    },

    async savePeriod(period) {
        const id = period.id || Date.now().toString();
        const periodData = { name: period.name, start: period.start, end: period.end };
        await setDoc(doc(db, "periods", id), periodData);
        
        const idx = this.periods.findIndex(p => p.id === id);
        if (idx >= 0) this.periods[idx] = { id, ...periodData };
        else this.periods.push({ id, ...periodData });
        
        window.periods = this.periods;
        return id;
    },

    async deletePeriod(id) {
        try {
            await deleteDoc(doc(db, "periods", id));
            this.periods = this.periods.filter(p => p.id !== id);
            window.periods = this.periods;
        } catch (e) {
            console.error("Erro ao deletar período:", e);
            throw e;
        }
    },

    async saveAllPeriods(list) {
        // Para simplificar, poderíamos salvar cada um, mas para o Undo, 
        // o mais seguro seria limpar a coleção e resalvar. 
        // Neste sistema simplificado, apenas iteramos:
        for (const p of list) {
             const periodData = { name: p.name, start: p.start, end: p.end };
             await setDoc(doc(db, "periods", p.id), periodData);
        }
    },

    // Alurações (30 Dias) - LocalStorage para simplicidade ou Firestore opcional
    getAlterations() {
        return JSON.parse(localStorage.getItem('escala_alterations_history') || '{}');
    },

    saveAlteration(staffId, dateStr, weeks = 4) {
        const history = this.getAlterations();
        if (!history[staffId]) history[staffId] = [];
        
        // Calcula data de expiração (dateStr + semanas)
        const parts = dateStr.split('-').map(Number);
        const d = new Date(parts[0], parts[1] - 1, parts[2]);
        d.setDate(d.getDate() + (weeks * 7));
        
        // Formato YYYY-MM-DD sem shift de timezone
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const expiresStr = `${y}-${m}-${day}`;

        history[staffId].push({ date: dateStr, expires: expiresStr });
        localStorage.setItem('escala_alterations_history', JSON.stringify(history));
    },

    // Ranking Reset date (atrelado ao supervisor localmente)
    getRankingResetDate() {
        return localStorage.getItem('escala_ranking_reset_date') || EscalaConfig.SYSTEM_START_DATE;
    },

    saveRankingResetDate(date) {
        localStorage.setItem('escala_ranking_reset_date', date);
    }
};

// Export to window for global access (legacy compatibility)
window.EscalaStorage = EscalaStorage;

export { EscalaStorage };
