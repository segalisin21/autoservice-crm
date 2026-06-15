(function () {
  "use strict";

  const grid = document.querySelector(".schedule-time-grid");
  const dayGrid = document.querySelector(".garage-day-grid");
  if (!grid && !dayGrid) return;

  let dragOrderId = null;
  let dragAssignedUserId = null;
  let dragStartTime = null;
  let dragEndTime = null;

  function padHour(h) {
    return `${String(h).padStart(2, "0")}:00`;
  }

  async function patchSchedule(orderId, body) {
    const res = await fetch(`/orders/${orderId}/schedule`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || "Не удалось обновить расписание");
    }
    return data;
  }

  function reloadOnSuccess() {
    window.location.reload();
  }

  document.querySelectorAll(".schedule-master-select").forEach((select) => {
    select.addEventListener("mousedown", (e) => e.stopPropagation());
    select.addEventListener("click", (e) => e.stopPropagation());
    select.addEventListener("change", async (e) => {
      e.stopPropagation();
      const orderId = select.dataset.orderId;
      const assigned_user_id = Number(select.value);
      if (!orderId || !assigned_user_id) return;
      const prev = select.dataset.prevValue || select.querySelector("option[selected]")?.value;
      select.disabled = true;
      try {
        await patchSchedule(orderId, { assigned_user_id });
        reloadOnSuccess();
      } catch (err) {
        alert(err.message || String(err));
        if (prev) select.value = prev;
        select.disabled = false;
      }
    });
    select.dataset.prevValue = select.value;
  });

  function onDragStart(e) {
    const block = e.target.closest(".schedule-order-block--draggable, .garage-order-block");
    if (!block) return;
    dragOrderId = block.dataset.orderId;
    dragAssignedUserId = block.dataset.assignedUserId;
    dragStartTime = block.dataset.startTime || null;
    dragEndTime = block.dataset.endTime || null;
    if (!dragOrderId) {
      e.preventDefault();
      return;
    }
    block.classList.add("schedule-order-block--dragging");
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", dragOrderId);
    }
  }

  function onDragEnd(e) {
    const block = e.target.closest(".schedule-order-block--draggable, .garage-order-block");
    if (block) block.classList.remove("schedule-order-block--dragging");
    document.querySelectorAll(".slot-cell--drop-target, .schedule-drop-zone--drop-target").forEach((el) => {
      el.classList.remove("slot-cell--drop-target", "schedule-drop-zone--drop-target");
    });
    dragOrderId = null;
  }

  function onDragOver(e) {
    const cell = e.target.closest(".slot-cell, .schedule-drop-zone");
    if (!cell || !dragOrderId) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
    cell.classList.add(cell.classList.contains("slot-cell") ? "slot-cell--drop-target" : "schedule-drop-zone--drop-target");
  }

  function onDragLeave(e) {
    const cell = e.target.closest(".slot-cell, .schedule-drop-zone");
    if (!cell) return;
    if (cell.contains(e.relatedTarget)) return;
    cell.classList.remove("slot-cell--drop-target", "schedule-drop-zone--drop-target");
  }

  async function onDrop(e) {
    const cell = e.target.closest(".slot-cell, .schedule-drop-zone");
    if (!cell || !dragOrderId) return;
    e.preventDefault();
    cell.classList.remove("slot-cell--drop-target", "schedule-drop-zone--drop-target");

    const column = cell.closest("[data-employee]") || cell;
    const assigned_user_id = Number(column.dataset.employee);
    if (!assigned_user_id) return;
    if (Number(dragAssignedUserId) === assigned_user_id && !cell.dataset.hour) return;

    const body = { assigned_user_id };
    if (cell.classList.contains("slot-cell") && cell.dataset.hour) {
      body.start_time = padHour(cell.dataset.hour);
      if (dragEndTime) body.end_time = dragEndTime;
    }

    try {
      await patchSchedule(dragOrderId, body);
      reloadOnSuccess();
    } catch (err) {
      alert(err.message || String(err));
    }
  }

  document.addEventListener("dragstart", onDragStart);
  document.addEventListener("dragend", onDragEnd);
  document.querySelectorAll(".slot-cell, .schedule-drop-zone").forEach((zone) => {
    zone.addEventListener("dragover", onDragOver);
    zone.addEventListener("dragleave", onDragLeave);
    zone.addEventListener("drop", onDrop);
  });
})();
