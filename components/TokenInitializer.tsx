"use client";

import { useEffect } from "react";

export function TokenInitializer() {
  useEffect(() => {
    // Set JWT token in localStorage on app initialization
    const token = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhZG1pbkBhbGxpYW5jZS5jb20iLCJleHAiOjE3NzQ1MTMwNjIsInNjb3BlIjoiMjAyNS0wNS0xMC1BTk4xIn0.PcCJP5Lbhrp9wBVaAcIcM3z5ju9JhtVlxrxm69Tza0U";
    
    if (typeof localStorage !== "undefined") {
      const existingToken = localStorage.getItem("jwt_token");
      
      if (!existingToken || existingToken !== token) {
        localStorage.setItem("jwt_token", token);
        console.info("[SAMADHAAN] JWT token initialized successfully");
        console.info("[SAMADHAAN] Token expires: 2025-05-10 (24 hours)");
      }
    }
  }, []);

  return null;
}
