// lead-fields.mjs — עדכון שדה בודד בתוך סעיף Markdown של קובץ ליד (למשל "## Handoff").
// פועל על טקסט בזיכרון בלבד (לא נוגע בדיסק) כדי שיהיה קל לבדוק ולהשתמש חוזר.

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sectionRegex(title) {
  return new RegExp(`(^##\\s*${escapeRegExp(title)}[^\\n]*\\n)([\\s\\S]*?)(?=\\n## |$)`, "m");
}

// מעדכן/מוסיף שדה `- **key:** value` בתוך סעיף `## sectionTitle` (ה-heading יכול
// להמשיך אחרי הכותרת, כמו "## Handoff — מסירה ליניב המעצב 📞" — מספיק ש-sectionTitle
// יהיה תחילת הכותרת). אם השדה כבר קיים בתוך הסעיף — מחליף את הערך. אחרת — מוסיף
// שורה חדשה בתחילת גוף הסעיף, מעל התוכן הקיים. אם הסעיף לא קיים בכלל בקובץ — זורק
// שגיאה ברורה (סימן שקובץ הליד ישן/לא תקין).
export function setField(markdown, sectionTitle, key, value) {
  const match = markdown.match(sectionRegex(sectionTitle));
  if (!match) {
    throw new Error(`section not found: "## ${sectionTitle}"`);
  }
  const [full, heading, body] = match;
  const fieldRe = new RegExp(`^(-\\s*\\*\\*\\s*${escapeRegExp(key)}\\s*:\\*\\*\\s*).*$`, "m");
  const newBody = fieldRe.test(body)
    ? body.replace(fieldRe, (_, prefix) => `${prefix}${value}`)
    : `- **${key}:** ${value}\n${body}`;
  return markdown.replace(full, heading + newBody);
}
