function digitsForPhone(raw) {
  let digits = String(raw ?? "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 11 && digits.startsWith("8")) {
    digits = `7${digits.slice(1)}`;
  } else if (digits.length === 10) {
    digits = `7${digits}`;
  }
  return digits.length >= 10 ? digits : "";
}

function telHref(raw) {
  const digits = digitsForPhone(raw);
  return digits ? `tel:+${digits}` : null;
}

function whatsAppHref(raw) {
  const digits = digitsForPhone(raw);
  return digits ? `https://wa.me/${digits}` : null;
}

module.exports = { telHref, whatsAppHref, digitsForPhone };
