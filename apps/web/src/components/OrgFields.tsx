type Org = { legal_name?: string; vat_number?: string; trade_name?: string | null; business_email?: string | null;
  business_phone?: string | null; pec?: string | null; sdi_code?: string | null; legal_address?: Record<string, string> | null };

export function OrgFields({ org, lockLegal = false }: { org?: Org; lockLegal?: boolean }) {
  const a = org?.legal_address ?? {};
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2"><label className="label" htmlFor="legal_name">Ragione sociale</label>
        <input id="legal_name" name="legal_name" required defaultValue={org?.legal_name} disabled={lockLegal} className="field disabled:bg-canvas" /></div>
      <div><label className="label" htmlFor="vat_number">Partita IVA</label>
        <input id="vat_number" name="vat_number" required placeholder="IT01234567890" defaultValue={org?.vat_number} disabled={lockLegal} className="field disabled:bg-canvas" /></div>
      <div><label className="label" htmlFor="trade_name">Nome commerciale (facoltativo)</label>
        <input id="trade_name" name="trade_name" defaultValue={org?.trade_name ?? ""} className="field" /></div>
      <div className="sm:col-span-2"><label className="label" htmlFor="street">Sede legale: indirizzo</label>
        <input id="street" name="street" defaultValue={a.street} className="field" /></div>
      <div><label className="label" htmlFor="city">Città</label><input id="city" name="city" defaultValue={a.city} className="field" /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label" htmlFor="postal_code">CAP</label><input id="postal_code" name="postal_code" defaultValue={a.postal_code} className="field" /></div>
        <div><label className="label" htmlFor="province">Prov.</label><input id="province" name="province" maxLength={2} defaultValue={a.province} className="field uppercase" /></div>
      </div>
      <div><label className="label" htmlFor="business_email">Email aziendale</label>
        <input id="business_email" name="business_email" type="email" defaultValue={org?.business_email ?? ""} className="field" /></div>
      <div><label className="label" htmlFor="business_phone">Telefono aziendale</label>
        <input id="business_phone" name="business_phone" type="tel" defaultValue={org?.business_phone ?? ""} className="field" /></div>
      <div><label className="label" htmlFor="pec">PEC</label><input id="pec" name="pec" defaultValue={org?.pec ?? ""} className="field" /></div>
      <div><label className="label" htmlFor="sdi_code">Codice SDI</label><input id="sdi_code" name="sdi_code" defaultValue={org?.sdi_code ?? ""} className="field" /></div>
    </div>
  );
}
