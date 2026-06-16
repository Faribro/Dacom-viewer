"use client";

import { useEffect } from "react";

export function TokenInitializer() {
  useEffect(() => {
    // Initialize JWT token if not present
    // The token should ideally be fetched from the backend (tb-engine.allianceindia.org)
    // or passed via environment variables, but we keep the fallback for now.
    const fallbackToken = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhZG1pbkBhbGxpYW5jZS5jb20iLCJleHAiOjE3NzQ1MTMwNjIsInNjb3BlIjoiMjAyNS0wNS0xMC1BTk4xIn0.PcCJP5Lbhrp9wBVaAcIcM3z5ju9JhtVlxrxm69Tza0U";
    
    if (typeof localStorage !== "undefined") {
      const existingToken = localStorage.getItem("jwt_token");
      
      if (!existingToken) {
        localStorage.setItem("jwt_token", fallbackToken);
        console.info("[SAMADHAAN] Fallback JWT token initialized successfully");
      }
    }
  }, []);

  return null;
}
