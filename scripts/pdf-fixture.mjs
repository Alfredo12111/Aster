// Small deterministic PDF with text, mixed page sizes and an intrinsic 90-degree rotation.
export function makePdfFixture() {
  const objects = [];
  const add = (s) => {
    objects.push(s);
    return objects.length;
  };
  add("<< /Type /Catalog /Pages 2 0 R >>");
  add("<< /Type /Pages /Kids [4 0 R 6 0 R 8 0 R] /Count 3 >>");
  add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const texts = [
    "Alpha research evidence for retrieval.",
    "Second page with rotated evidence.",
    "Third page has a smaller crop region.",
  ];
  for (let i = 0; i < 3; i++) {
    const contentId = 5 + i * 2;
    add(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ${i === 1 ? "/Rotate 90" : i === 2 ? "/CropBox [20 40 590 740]" : ""} /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`,
    );
    const stream = `BT /F1 19 Tf 60 690 Td (${texts[i]}) Tj 0 -35 Td /F1 14 Tf (Highlight this passage and save a comment.) Tj 0 -28 Td (Underline or strike through this sentence.) Tj ET`;
    add(
      `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    );
  }
  let output = "%PDF-1.7\n",
    offsets = [0];
  objects.forEach((obj, i) => {
    offsets.push(Buffer.byteLength(output));
    output += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xref = Buffer.byteLength(output);
  output +=
    `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` +
    offsets
      .slice(1)
      .map((n) => `${String(n).padStart(10, "0")} 00000 n \n`)
      .join("") +
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(output);
}
