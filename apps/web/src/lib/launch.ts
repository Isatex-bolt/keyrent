/**
 * Fase di pre-lancio: il sito si visita, i noleggiatori si registrano e pubblicano (con approvazione dello staff),
 * ma i clienti non possono ancora prenotare. Per aprire le prenotazioni: variabile BOOKINGS_OPEN=1 su Vercel.
 */
export const bookingsOpen = () => process.env.BOOKINGS_OPEN === "1";
