export async function suggestDishTagsFromName(dishName, dishMode = "anywhere") {
  const name = String(dishName || "").trim();
  if (name.length < 2) return [];
  try {
    const response = await fetch("/api/dish-tags/suggest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dishName: name, dishMode }),
    });
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data?.tags) ? data.tags : [];
  } catch {
    return [];
  }
}
