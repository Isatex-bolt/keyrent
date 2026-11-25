import { cookies } from "next/headers";
import { leaveDemoAndRegister } from "@/app/accedi/actions";
import { DemoBarClient } from "./DemoBarClient";

/** Su tutto il sito, per chi sta provando la demo: barra "Stai provando la demo" + invito periodico a registrarsi. */
export async function DemoBar() {
  if ((await cookies()).get("kr_demo")?.value !== "1") return null;
  return <DemoBarClient register={leaveDemoAndRegister} />;
}
