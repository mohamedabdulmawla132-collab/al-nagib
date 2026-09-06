const GOOGLE_SHEET_PUBLISHED_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRBBlbvVWc2ctTEj0jL3d--HU3cX7tHc1hASg4gVuUTX_mzoXYTghp8S-BsjtZ5TJoT06x1EwE408dn/pubhtml";

function csvUrl() {
  const url = new URL(GOOGLE_SHEET_PUBLISHED_URL);
  url.pathname = url.pathname.replace(/\/pubhtml$/, "/pub");
  url.search = "?output=csv";
  return url.toString();
}

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && line[index + 1] === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += char;
    }
  }
  cells.push(cell.trim());
  return cells;
}

function normalize(value: string) {
  return value
    .replace(/[\u200E\u200F]/g, "")
    .replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 1776))
    .replace(/[\s\-()]/g, "")
    .trim()
    .toLocaleLowerCase("ar");
}

function findColumn(headers: string[], kind: "name" | "number") {
  return headers.findIndex(header => {
    const value = normalize(header);
    if (kind === "name") return value.includes("اسم");
    return value.includes("رقم") || value.includes("كشف") || value.includes("هاتف");
  });
}

export async function verifyStudentInRoster(studentName: string, recordNumber: string) {
  try {
    const response = await fetch(csvUrl(), { headers: { Accept: "text/csv" } });
    if (!response.ok) return { valid: false, reason: "roster_unavailable" as const };
    const csv = await response.text();
    const rows = csv.split(/\r?\n/).map(parseCsvLine).filter(row => row.some(Boolean));
    if (rows.length < 2) return { valid: false, reason: "student_not_found" as const };
    const headers = rows[0].map(value => value.replace(/^\uFEFF/, ""));
    const nameColumn = findColumn(headers, "name");
    const numberColumn = findColumn(headers, "number");
    if (nameColumn < 0 || numberColumn < 0) return { valid: false, reason: "roster_columns_missing" as const };
    const normalizedName = normalize(studentName);
    const normalizedRecordNumber = normalize(recordNumber);
    const valid = rows.slice(1).some(row => normalize(row[nameColumn] ?? "") === normalizedName && normalize(row[numberColumn] ?? "") === normalizedRecordNumber);
    return { valid, reason: valid ? "matched" as const : "student_not_found" as const };
  } catch {
    return { valid: false, reason: "roster_unavailable" as const };
  }
}

export { GOOGLE_SHEET_PUBLISHED_URL };
