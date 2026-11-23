"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics";

export function GuideOpened() {
  useEffect(() => { track("guide_opened", { path: "scelta" }); }, []);
  return null;
}
