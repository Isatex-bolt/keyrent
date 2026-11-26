/** KeyRent Select: mezzi esclusivi in una sezione a parte della ricerca (/cerca?select=1). */
export const SELECT_MAKES = ["ferrari", "lamborghini", "rolls-royce", "bentley", "mclaren", "aston-martin", "bugatti", "pagani", "koenigsegg", "maybach"];
export const isSelectMake = (slug?: string) => !!slug && SELECT_MAKES.includes(slug.toLowerCase());
