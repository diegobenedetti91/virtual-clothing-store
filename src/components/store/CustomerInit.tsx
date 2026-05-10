"use client";

import { useEffect } from "react";
import { useCustomer } from "@/hooks/useCustomer";

export default function CustomerInit() {
  const init = useCustomer((s) => s.init);

  useEffect(() => {
    init();
  }, [init]);

  return null;
}
