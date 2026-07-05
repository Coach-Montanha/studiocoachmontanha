const SCOPES = "https://www.googleapis.com/auth/calendar.events";

export async function getGcalToken(): Promise<string | null> {
  const clientId = localStorage.getItem("edufinance.gcalClientId");
  if (!clientId) return null;

  return new Promise((resolve) => {
    if (!(window as any).google) {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.onload = () => initTokenClient(clientId, resolve);
      script.onerror = () => resolve(null);
      document.head.appendChild(script);
    } else {
      initTokenClient(clientId, resolve);
    }
  });
}

function initTokenClient(clientId: string, resolve: (token: string | null) => void) {
  const tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: SCOPES,
    callback: (response: any) => {
      if (response.error) {
        resolve(null);
        return;
      }
      resolve(response.access_token);
    },
  });
  tokenClient.requestAccessToken({ prompt: "consent" });
}

export async function addSessionToCalendar(params: {
  studentName: string;
  sessionDate: string;
  sessionTime: string;
  durationMinutes: number;
  notes?: string;
}): Promise<boolean> {
  const token = await getGcalToken();
  if (!token) return false;

  const calendarId = localStorage.getItem("edufinance.gcalId") ?? "primary";
  const { studentName, sessionDate, sessionTime, durationMinutes, notes } = params;

  const time = sessionTime.length >= 5 ? sessionTime.slice(0, 5) : sessionTime;
  const startDateTime = `${sessionDate}T${time}`;
  const endDate = new Date(`${sessionDate}T${time}`);
  endDate.setMinutes(endDate.getMinutes() + durationMinutes);
  const pad = (n: number) => String(n).padStart(2, "0");
  const endDateTime = `${endDate.getFullYear()}-${pad(endDate.getMonth() + 1)}-${pad(
    endDate.getDate(),
  )}T${pad(endDate.getHours())}:${pad(endDate.getMinutes())}`;

  const event = {
    summary: `Aula PT — ${studentName}`,
    description: notes ?? `Sessão de Personal Trainer com ${studentName}`,
    start: { dateTime: startDateTime + ":00", timeZone: "America/Sao_Paulo" },
    end: { dateTime: endDateTime + ":00", timeZone: "America/Sao_Paulo" },
    reminders: {
      useDefault: false,
      overrides: [{ method: "popup", minutes: 30 }],
    },
  };

  try {
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(event),
      },
    );
    return res.ok;
  } catch {
    return false;
  }
}
