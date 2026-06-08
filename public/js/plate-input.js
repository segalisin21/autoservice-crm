(function () {
  var PLATE_LETTERS = "АВЕКМНОРСТУХ";
  var LATIN = { A: "А", B: "В", C: "С", E: "Е", H: "Н", K: "К", M: "М", O: "О", P: "Р", T: "Т", X: "Х", Y: "У" };

  function mapChar(ch) {
    var upper = ch.toUpperCase();
    if (PLATE_LETTERS.indexOf(upper) >= 0) return upper;
    if (LATIN[upper]) return LATIN[upper];
    return null;
  }

  function formatValue(raw) {
    var letters = [];
    var digits = [];
    var s = String(raw || "");
    for (var i = 0; i < s.length; i++) {
      var ch = s[i];
      if (/\d/.test(ch)) {
        digits.push(ch);
        continue;
      }
      var mapped = mapChar(ch);
      if (mapped) letters.push(mapped);
    }
    var l = letters;
    var d = digits;
    var out = (l[0] || "") + d.slice(0, 3).join("") + l.slice(1, 3).join("") + d.slice(3, 8).join("");
    return out;
  }

  function initPlateInput(input) {
    if (!input || input.dataset.plateInit) return;
    input.dataset.plateInit = "1";
    input.setAttribute("autocomplete", "off");
    input.setAttribute("inputmode", "text");
    if (!input.placeholder) input.placeholder = "А123ВС777";

    input.addEventListener("input", function () {
      var pos = input.selectionStart;
      var before = input.value;
      var formatted = formatValue(before);
      if (formatted !== before) {
        input.value = formatted;
        var diff = formatted.length - before.length;
        var newPos = Math.max(0, (pos || formatted.length) + diff);
        try {
          input.setSelectionRange(newPos, newPos);
        } catch (_e) {
          /* ignore */
        }
      }
    });

    if (input.value) {
      input.value = formatValue(input.value);
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll(".plate-search-input, input[data-plate-input]").forEach(initPlateInput);
  });
})();
