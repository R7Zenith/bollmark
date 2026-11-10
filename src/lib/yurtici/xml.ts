// Yurtici SOAP cevaplari icin kucuk XML okuyucu. Agir "soap" / XML paketleri
// yerine: cevaplar duz eleman agaci, attribute'lara ihtiyacimiz yok. Etiket
// adlarindaki namespace oneki (ns1:, env:) atilir.

export type XmlNode = { name: string; children: XmlNode[]; text: string };

const TOKEN =
  /<!\[CDATA\[([\s\S]*?)\]\]>|<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!DOCTYPE[^>]*>|<(\/?)([A-Za-z_][\w.\-:]*)((?:\s+[^\s=/>]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g;

export function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-fA-F]+|#\d+|lt|gt|amp|quot|apos);/g, (_, entity: string) => {
    if (entity[0] === "#") {
      const code = entity[1] === "x" ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return String.fromCodePoint(code);
    }
    return { lt: "<", gt: ">", amp: "&", quot: '"', apos: "'" }[entity as "lt"]!;
  });
}

function localName(name: string): string {
  const i = name.indexOf(":");
  return i === -1 ? name : name.slice(i + 1);
}

export function parseXml(xml: string): XmlNode {
  const root: XmlNode = { name: "#root", children: [], text: "" };
  const stack: XmlNode[] = [root];
  for (const m of xml.matchAll(TOKEN)) {
    const [, cdata, closing, tag, , selfClosing, text] = m;
    const top = stack[stack.length - 1];
    if (cdata !== undefined) {
      top.text += cdata;
    } else if (tag !== undefined) {
      const name = localName(tag);
      if (closing) {
        if (stack.length > 1 && top.name === name) stack.pop();
        else throw new Error(`XML kapanış etiketi beklenmiyordu: ${tag}`);
      } else {
        const node: XmlNode = { name, children: [], text: "" };
        top.children.push(node);
        if (!selfClosing) stack.push(node);
      }
    } else if (text !== undefined) {
      top.text += decodeEntities(text);
    }
  }
  if (stack.length !== 1) throw new Error("XML eksik: kapanmamış etiket var.");
  return root;
}

// Agacta (derinlemesine) adi eslesen tum dugumler.
export function findAll(node: XmlNode, name: string): XmlNode[] {
  const out: XmlNode[] = [];
  const walk = (n: XmlNode) => {
    for (const c of n.children) {
      if (c.name === name) out.push(c);
      walk(c);
    }
  };
  walk(node);
  return out;
}

export function findFirst(node: XmlNode, name: string): XmlNode | null {
  return findAll(node, name)[0] ?? null;
}

// Yalniz dogrudan cocuklar arasinda; ic ice ayni adli alanlar (or. hareket
// listesindeki docId) karismasin diye.
export function childText(node: XmlNode | null, name: string): string {
  if (!node) return "";
  const c = node.children.find((x) => x.name === name);
  return c ? c.text.trim() : "";
}
