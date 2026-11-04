// Giris/kayit sonrasi donus yollari yalniz site ici olabilir (acik yonlendirme olmasin).
export function isSafeInternalPath(path: string): boolean {
  return path.startsWith("/") && !path.startsWith("//") && !path.startsWith("/\\");
}
