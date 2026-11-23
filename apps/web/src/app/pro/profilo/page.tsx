import { redirect } from "next/navigation";

/* "Il mio profilo" del noleggiatore ora è la pagina unica /account/profilo (account + attività di noleggio). */
export default function Page() {
  redirect("/account/profilo");
}
