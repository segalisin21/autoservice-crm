const VEHICLE_NAME_MODES = new Set(["original", "cyrillic"]);

function resolveVehicleNameMode(value) {
  const v = String(value || "original").toLowerCase();
  return VEHICLE_NAME_MODES.has(v) ? v : "original";
}

function vehicleDisplayName(row, mode) {
  const latin = String(row?.name || "").trim();
  const cyrillic = String(row?.name_ru || "").trim();
  if (resolveVehicleNameMode(mode) === "cyrillic") return cyrillic || latin;
  return latin || cyrillic;
}

function withVehicleDisplayNames(rows, mode) {
  return (rows || []).map(function (row) {
    return Object.assign({}, row, { display_name: vehicleDisplayName(row, mode) });
  });
}

module.exports = {
  resolveVehicleNameMode,
  vehicleDisplayName,
  withVehicleDisplayNames
};
