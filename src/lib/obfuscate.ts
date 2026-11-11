// Writes every character as a decimal HTML character reference, so the text
// never appears literally in the page source. Browsers decode it, so readers
// see and click exactly the same thing; most simple address harvesters don't.
// No JavaScript, so it changes nothing about the CSP.
export function toCharRefs(text: string): string {
  return Array.from(text, (ch) => `&#${ch.codePointAt(0)};`).join("");
}

// A mailto link whose href and text are both character references.
export function obfuscatedMailto(address: string): string {
  return `<a href="${toCharRefs(`mailto:${address}`)}">${toCharRefs(address)}</a>`;
}
