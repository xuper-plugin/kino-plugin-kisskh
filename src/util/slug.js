/** A title as a comparable key: no accents or case, runs of anything but letters and digits as one "-". */
export function slugify(title) {
  return String(title || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
