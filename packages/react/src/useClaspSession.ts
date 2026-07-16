"use client";

import { useContext } from "react";
import { ClaspContext, type ClaspContextValue } from "./context";

export function useClaspSession(): ClaspContextValue {
  const context = useContext(ClaspContext);
  if (!context) throw new Error("useClaspSession must be used within a <ClaspProvider>");
  return context;
}
