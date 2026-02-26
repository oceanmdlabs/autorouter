export function formatTimestampWithMinutePrecision(date: Date) {
  const formattedDate = new Date(date).toLocaleString("en-ca", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return formattedDate;
}
