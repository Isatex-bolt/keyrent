import { CheckoutV2 } from "@/components/preview/CheckoutV2";
import { SCENARIOS } from "@/components/preview/scenarios";

export default function Page() {
  return <CheckoutV2 s={SCENARIOS.request} />;
}
