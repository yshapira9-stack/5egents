// client.mjs — קריאות גולמיות ל-Google Calendar API v3 (בלי googleapis SDK,
// עקבי לשאר השכבות בפרויקט הזה שמדברות ישירות מול REST עם fetch).

const API_BASE = "https://www.googleapis.com/calendar/v3";

async function api(pathAndQuery, { accessToken, ...options }) {
  const res = await fetch(`${API_BASE}${pathAndQuery}`, {
    ...options,
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("non-JSON response from Google Calendar: " + text.slice(0, 500));
  }
  if (!res.ok || data.error) {
    throw new Error("Google Calendar API error: " + JSON.stringify(data.error || data).slice(0, 800));
  }
  return data;
}

// שולף אירועים בטווח זמן נתון (timeMin/timeMax בפורמט ISO), ממוינים לפי זמן התחלה.
export async function listEvents(calendarId, { timeMin, timeMax, accessToken }) {
  const params = new URLSearchParams({ timeMin, timeMax, singleEvents: "true", orderBy: "startTime" });
  const data = await api(`/calendars/${encodeURIComponent(calendarId)}/events?${params}`, {
    method: "GET",
    accessToken,
  });
  return data.items || [];
}

// יוצר אירוע חדש ביומן. eventBody בפורמט Google Calendar (summary/description/start/end).
export async function createEvent(calendarId, eventBody, { accessToken }) {
  return api(`/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: "POST",
    accessToken,
    body: JSON.stringify(eventBody),
  });
}
