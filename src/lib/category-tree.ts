export type CategoryTreeNode = { id: string; name: string; parentId: string | null };

// Kategori listesini ust-alt hiyerarsisine gore duzler, her satira derinligine
// gore girinti (em dash) ekler. Kategori dropdown'larinda ve kategori
// listesinde ayni siralama/gorunum icin ortak kullanilir.
export function buildCategoryOptions<T extends CategoryTreeNode>(
  categories: T[]
): { id: string; label: string; depth: number; category: T }[] {
  const byParent = new Map<string | null, T[]>();
  for (const c of categories) {
    const key = c.parentId ?? null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(c);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name, "tr"));
  }

  const result: { id: string; label: string; depth: number; category: T }[] = [];
  const visited = new Set<string>();

  function walk(parentId: string | null, depth: number) {
    const children = byParent.get(parentId) ?? [];
    for (const c of children) {
      if (visited.has(c.id)) continue; // dongu koruma (bozuk veri ihtimaline karsi)
      visited.add(c.id);
      result.push({ id: c.id, label: `${"— ".repeat(depth)}${c.name}`, depth, category: c });
      walk(c.id, depth + 1);
    }
  }
  walk(null, 0);

  return result;
}

type ParentLink = { id: string; parentId: string | null };

// id'nin candidateParentId'nin kendisi ya da bir atasi olup olmadigini kontrol eder -
// bir kategoriyi kendi alt kategorisinin altina tasiyip dongu olusturmayi engellemek icin.
export function isDescendantOf<T extends ParentLink>(
  categories: T[],
  id: string,
  candidateParentId: string
): boolean {
  const byId = new Map(categories.map((c) => [c.id, c]));
  let current: T | undefined = byId.get(candidateParentId);
  const seen = new Set<string>();
  while (current) {
    if (current.id === id) return true;
    if (seen.has(current.id)) break;
    seen.add(current.id);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return false;
}
