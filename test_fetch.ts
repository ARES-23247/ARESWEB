async function main() {
  const res = await fetch("http://127.0.0.1:8788/api/events/admin/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "Test Event",
      category: "internal",
      dateStart: "2026-04-26T12:00:00Z"
    })
  });
  const text = await res.text();
  console.log("Status:", res.status);
  console.log("Response:", text);
}
main();
