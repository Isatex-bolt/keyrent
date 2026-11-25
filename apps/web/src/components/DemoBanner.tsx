import { getUser } from "@/lib/auth";
import { demoAutoapproveSoon, isDemoUser } from "@/lib/demo";
import { leaveDemoAndRegister } from "@/app/accedi/actions";

/** Nell'account di prova: cosa è simulato, quanto restano online gli annunci, e il passo per registrarsi davvero. */
export async function DemoBanner() {
  const user = await getUser().catch(() => null);
  if (!user || !(await isDemoUser(user.id))) return null;
  demoAutoapproveSoon(); // approva gli annunci in verifica da più di 30 secondi
  return (
    <>
    <div className="mb-5 overflow-hidden rounded-2xl bg-gradient-to-r from-navy-900 to-navy-800 text-white shadow-sm">
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-teal-300">Account di prova</p>
          <p className="mt-1 font-semibold">Così sarebbe la tua area noleggiatore su KeyRent.</p>
          <p className="mt-1 text-sm text-white/75">
            Annunci di esempio e noleggi sono simulati. Prova a creare un annuncio: viene approvato in 30 secondi, lo vedi solo tu nella tua area e dopo 24 ore si cancella da solo.
          </p>
        </div>
        <form action={leaveDemoAndRegister} className="flex-none">
          <button className="w-full rounded-xl bg-teal-400 px-5 py-3 font-semibold text-navy-950 hover:bg-teal-300 sm:w-auto">Registra la tua attività</button>
        </form>
      </div>
    </div>
    </>
  );
}
