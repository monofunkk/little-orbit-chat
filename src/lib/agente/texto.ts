/** Limpia la respuesta: sin signos de exclamación ni emojis, como pidió el equipo. */
export function sanear(texto: string) {
  return texto
    .replace(/\p{Extended_Pictographic}(\uFE0F|\u200D\p{Extended_Pictographic})*/gu, '')
    .replace(/¡/g, '')
    .replace(/!+/g, '.')
    .replace(/\.{2,}(?!\.)/g, '.')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/ {2,}/g, ' ')
    .trim();
}
