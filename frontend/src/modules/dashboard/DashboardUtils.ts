export function greetingForNow(): string {
  const h = new Date().getHours();
  if (h < 6) return "Buenas noches";
  if (h < 13) return "Buenos días";
  if (h < 20) return "Buenas tardes";
  return "Buenas noches";
}

export function spanishToday(): string {
  try {
    const d = new Date().toLocaleDateString("es-ES", {
      weekday: "long", day: "2-digit", month: "long",
    });
    return d.charAt(0).toUpperCase() + d.slice(1);
  } catch {
    return "";
  }
}
