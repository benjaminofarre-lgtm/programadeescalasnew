/**
 * Escala Configuration
 */

const EscalaConfig = {
    firebaseConfig: {
        apiKey: "AIzaSyCbo5Ah_GmUf81LX7QUtThPf2aYioxgygY",
        authDomain: "programadeescalas.firebaseapp.com",
        projectId: "programadeescalas",
        storageBucket: "programadeescalas.firebasestorage.app",
        messagingSenderId: "225668786936",
        appId: "1:225668786936:web:d7ce404ca2cd94f88e690d",
        measurementId: "G-NSDG2176W7"
    },
    SYSTEM_START_DATE: '2026-02-21',
    AUTH_CREDENTIALS: {
        user: 'SUPERVISORSURFLAND',
        pass: 'meupapitobenja'
    }
};

// Global constants for legacy compatibility and module access
window.EscalaConfig = EscalaConfig;
window.SYSTEM_START_DATE = EscalaConfig.SYSTEM_START_DATE;
