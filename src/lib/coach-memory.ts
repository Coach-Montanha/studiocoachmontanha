// src/lib/coach-memory.ts

/**
 * Simple persistent memory for Coach AI Copilot per student.
 * Stores JSON in localStorage under key `coach_memory_{studentId}`.
 * In a real production app this could be synced with Supabase.
 */
export interface CoachMemory {
  lastFeedback?: string;
  preferredTone?: string;
  // add more fields as needed
}

export function loadCoachMemory(studentId: string): CoachMemory | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(`coach_memory_${studentId}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CoachMemory;
  } catch {
    return null;
  }
}

export function saveCoachMemory(studentId: string, data: CoachMemory): void {
  if (typeof window === "undefined") return;
  try {
    const serialized = JSON.stringify(data);
    localStorage.setItem(`coach_memory_${studentId}`, serialized);
  } catch {
    // ignore storage errors
  }
}
