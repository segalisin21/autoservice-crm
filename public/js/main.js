// ============================================
// Белка Парк CRM — клиентский JavaScript
// ============================================

document.addEventListener('DOMContentLoaded', function() {
  initDateDisplay();
  initSearch();
  initFlashMessages();
  initMobileNav();
  initClientQuickView();
  initNewBookingModal();
  initQuickActions();
  initDashboardQuick();
});

/** CSRF для fetch и динамических форм (см. meta[name="csrf-token"] в header). */
function getCsrfToken() {
  var meta = document.querySelector('meta[name="csrf-token"]');
  return meta && meta.content ? String(meta.content).trim() : '';
}

function csrfHeaders(base) {
  var h = {};
  if (base && typeof base === 'object') {
    for (var k in base) {
      if (Object.prototype.hasOwnProperty.call(base, k)) h[k] = base[k];
    }
  }
  var t = getCsrfToken();
  if (t) h['X-CSRF-Token'] = t;
  return h;
}

function closeMobileNav() {
  document.body.classList.remove('layout-nav-open');
  const overlay = document.getElementById('layout-overlay');
  if (overlay) overlay.setAttribute('aria-hidden', 'true');
}

function openMobileNav() {
  document.body.classList.add('layout-nav-open');
  const overlay = document.getElementById('layout-overlay');
  if (overlay) overlay.setAttribute('aria-hidden', 'false');
}

function initMobileNav() {
  const openBtn = document.getElementById('btn-nav-open');
  const closeBtn = document.getElementById('btn-nav-close');
  const overlay = document.getElementById('layout-overlay');
  const sidebar = document.getElementById('app-sidebar');

  if (openBtn) {
    openBtn.addEventListener('click', function () {
      openMobileNav();
    });
  }
  if (closeBtn) {
    closeBtn.addEventListener('click', function () {
      closeMobileNav();
    });
  }
  if (overlay) {
    overlay.addEventListener('click', function () {
      closeMobileNav();
    });
  }
  if (sidebar) {
    sidebar.querySelectorAll('a.nav-item').forEach(function (link) {
      link.addEventListener('click', function () {
        if (window.matchMedia('(max-width: 1023px)').matches) {
          closeMobileNav();
        }
      });
    });
  }
}

// Отображение текущей даты в sidebar
function initDateDisplay() {
  const dateElement = document.getElementById('current-date');
  if (dateElement) {
    const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    const date = new Date().toLocaleDateString('ru-RU', options);
    dateElement.textContent = date.charAt(0).toUpperCase() + date.slice(1);
  }
}

// Глобальный поиск
function initSearch() {
  const searchInput = document.getElementById('global-search');
  const searchResults = document.getElementById('search-results');
  
  if (!searchInput || !searchResults) return;
  
  let searchTimeout;
  
  searchInput.addEventListener('input', function(e) {
    const query = e.target.value.trim();
    
    clearTimeout(searchTimeout);
    
    if (query.length < 2) {
      searchResults.classList.remove('active');
      return;
    }
    
    searchTimeout = setTimeout(() => {
      performSearch(query);
    }, 300);
  });
  
  searchInput.addEventListener('focus', function() {
    if (searchResults.classList.contains('active')) {
      searchResults.style.display = 'block';
    }
  });
  
  document.addEventListener('click', function(e) {
    if (!e.target.closest('.search-box')) {
      searchResults.classList.remove('active');
    }
  });
}

function performSearch(query) {
  const searchResults = document.getElementById('search-results');
  
  fetch(`/clients/search?q=${encodeURIComponent(query)}`)
    .then(response => response.json())
    .then(data => {
      if (data.length === 0) {
        searchResults.innerHTML = '<div class="search-result-item">Ничего не найдено</div>';
      } else {
        searchResults.innerHTML = data.slice(0, 5).map(client => `
          <a href="/clients/${client.id}" class="search-result-item">
            <div class="search-result-name">${escapeHtml(client.full_name)}</div>
            <div class="search-result-phone">${escapeHtml(client.phone)}</div>
          </a>
        `).join('');
      }
      
      searchResults.classList.add('active');
    })
    .catch(error => {
      console.error('Ошибка поиска:', error);
    });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Автоматическое скрытие flash сообщений
function initFlashMessages() {
  const flashes = document.querySelectorAll('.flash');
  
  flashes.forEach(flash => {
    setTimeout(() => {
      flash.style.opacity = '0';
      flash.style.transform = 'translateX(100%)';
      flash.style.transition = 'all 0.3s ease';
      
      setTimeout(() => {
        flash.remove();
      }, 300);
    }, 5000);
  });
}

// Модальное окно удаления
function showDeleteModal(deleteUrl) {
  const modal = document.getElementById('delete-modal');
  const confirmBtn = document.getElementById('confirm-delete-btn');
  
  modal.classList.add('active');
  
  confirmBtn.onclick = function() {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = deleteUrl + '?_method=DELETE';
    const token = getCsrfToken();
    if (token) {
      const inp = document.createElement('input');
      inp.type = 'hidden';
      inp.name = '_csrf';
      inp.value = token;
      form.appendChild(inp);
    }
    document.body.appendChild(form);
    form.submit();
  };
}

function closeDeleteModal() {
  const modal = document.getElementById('delete-modal');
  modal.classList.remove('active');
}

// Закрытие модального окна по клику вне его
document.addEventListener('click', function(e) {
  const modal = document.getElementById('delete-modal');
  if (modal && e.target === modal) {
    closeDeleteModal();
  }
});

// Закрытие модального окна по Escape
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    closeDeleteModal();
  }
});

// Quick client view (Make-like modal; progressive enhancement)
function initClientQuickView() {
  document.querySelectorAll('[data-client-quick]').forEach(function (el) {
    el.addEventListener('click', function (e) {
      e.preventDefault();
      try {
        const payload = JSON.parse(el.getAttribute('data-client-quick') || '{}');
        showClientQuickModal(payload);
      } catch (_) {}
    });
  });
}

function showClientQuickModal(client) {
  const modal = document.getElementById('client-quick-modal');
  if (!modal || !client) return;
  const title = document.getElementById('client-quick-title');
  const body = document.getElementById('client-quick-body');
  const openLink = document.getElementById('client-quick-open');

  if (title) title.textContent = client.full_name || 'Клиент';
  if (openLink && client.id) openLink.href = '/clients/' + client.id;

  if (body) {
    const rows = [];
    if (client.phone) rows.push({ label: 'Телефон', value: client.phone, href: 'tel:' + client.phone });
    if (client.email) rows.push({ label: 'Email', value: client.email });
    if (client.birthday) rows.push({ label: 'Дата рождения', value: client.birthday });
    if (client.child_name) rows.push({ label: 'Ребёнок', value: client.child_name });
    if (client.child_birth_date) rows.push({ label: 'ДР ребёнка', value: client.child_birth_date });
    if (client.child_turning_age !== null && client.child_turning_age !== undefined && client.child_turning_age !== '') {
      rows.push({ label: 'Исполняется', value: String(client.child_turning_age) });
    }

    body.innerHTML = rows.length
      ? rows
          .map(function (r) {
            const v = r.href
              ? '<a href="' + escapeHtml(r.href) + '">' + escapeHtml(String(r.value)) + '</a>'
              : escapeHtml(String(r.value));
            return (
              '<div class="info-item">' +
              '<span class="info-label">' +
              escapeHtml(r.label) +
              '</span>' +
              '<span class="info-value">' +
              v +
              '</span>' +
              '</div>'
            );
          })
          .join('')
      : '<div class="text-muted">Нет данных</div>';
  }

  modal.classList.add('active');
  modal.setAttribute('aria-hidden', 'false');
}

function hideClientQuickModal() {
  const modal = document.getElementById('client-quick-modal');
  if (!modal) return;
  modal.classList.remove('active');
  modal.setAttribute('aria-hidden', 'true');
}

// New booking modal (Make-like)
function initNewBookingModal() {
  const btn = document.getElementById('btn-new-booking');
  if (btn) btn.addEventListener('click', function () { showNewBookingModal(); });
}

function clearNbNewClientFields() {
  const ids = [
    'nb-new-fullname',
    'nb-new-phone',
    'nb-new-birthday',
    'nb-new-child-name',
    'nb-new-child-birthdate',
    'nb-new-child-turning-age'
  ];
  ids.forEach(function (id) {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const panel = document.getElementById('nb-new-client-fields');
  if (panel) panel.style.display = 'none';
  const toggle = document.getElementById('nb-toggle-new-client');
  if (toggle) toggle.setAttribute('aria-expanded', 'false');
}

function toggleNbNewClientFields() {
  const panel = document.getElementById('nb-new-client-fields');
  const toggle = document.getElementById('nb-toggle-new-client');
  if (!panel) return;
  const hidden =
    !panel.style.display ||
    panel.style.display === 'none' ||
    window.getComputedStyle(panel).display === 'none';
  if (hidden) {
    panel.style.display = 'block';
    if (toggle) toggle.setAttribute('aria-expanded', 'true');
    const clientId = document.getElementById('nb-client-id');
    const clientSearch = document.getElementById('nb-client-search');
    if (clientId) clientId.value = '';
    if (clientSearch) clientSearch.value = '';
    const results = document.getElementById('nb-client-results');
    if (results) {
      results.style.display = 'none';
      results.innerHTML = '';
    }
  } else {
    clearNbNewClientFields();
  }
}

function showNewBookingModal() {
  const modal = document.getElementById('new-booking-modal');
  if (!modal) return;
  const err = document.getElementById('new-booking-error');
  if (err) err.style.display = 'none';

  const today = new Date().toISOString().slice(0, 10);
  const dateEl = document.getElementById('nb-date');
  if (dateEl && !dateEl.value) dateEl.value = today;

  const startEl = document.getElementById('nb-start');
  const endEl = document.getElementById('nb-end');
  if (startEl && !startEl.value) startEl.value = '10:00';
  if (endEl && !endEl.value) endEl.value = '12:00';

  const peopleEl = document.getElementById('nb-people');
  if (peopleEl && !peopleEl.value) peopleEl.value = '1';

  const clientSearch = document.getElementById('nb-client-search');
  if (clientSearch) clientSearch.value = '';
  const clientId = document.getElementById('nb-client-id');
  if (clientId) clientId.value = '';

  const serviceId = document.getElementById('nb-service-id');
  if (serviceId) serviceId.value = '';

  clearNbNewClientFields();

  setupClientSearch();
  loadBookingCatalog();

  modal.classList.add('active');
  modal.setAttribute('aria-hidden', 'false');
}

function hideNewBookingModal() {
  const modal = document.getElementById('new-booking-modal');
  if (!modal) return;
  modal.classList.remove('active');
  modal.setAttribute('aria-hidden', 'true');
}

function setupClientSearch() {
  const input = document.getElementById('nb-client-search');
  const results = document.getElementById('nb-client-results');
  const clientId = document.getElementById('nb-client-id');
  if (!input || !results || !clientId) return;

  let t;
  input.oninput = function () {
    const q = input.value.trim();
    clientId.value = '';
    clearTimeout(t);
    if (q.length < 2) {
      results.style.display = 'none';
      results.innerHTML = '';
      return;
    }
    t = setTimeout(function () {
      fetch('/clients/search?q=' + encodeURIComponent(q))
        .then(function (r) { return r.json(); })
        .then(function (data) {
          const list = Array.isArray(data) ? data.slice(0, 8) : [];
          results.innerHTML = list.length
            ? list
                .map(function (c) {
                  return (
                    '<button type="button" class="nb-client-item" data-id="' +
                    escapeHtml(String(c.id)) +
                    '" data-name="' +
                    escapeHtml(String(c.full_name || '')) +
                    '">' +
                    '<div class="nb-client-name">' +
                    escapeHtml(String(c.full_name || '')) +
                    '</div>' +
                    '<div class="nb-client-phone">' +
                    escapeHtml(String(c.phone || '')) +
                    '</div>' +
                    '</button>'
                  );
                })
                .join('')
            : '<div class="nb-client-empty">Ничего не найдено</div>';
          results.style.display = 'block';
          results.querySelectorAll('button.nb-client-item').forEach(function (btn) {
            btn.onclick = function () {
              clientId.value = btn.getAttribute('data-id') || '';
              input.value = btn.getAttribute('data-name') || '';
              results.style.display = 'none';
              clearNbNewClientFields();
            };
          });
        })
        .catch(function () {});
    }, 250);
  };

  document.addEventListener('click', function (e) {
    if (!e.target.closest('#new-booking-modal')) return;
    if (e.target.closest('#nb-client-results') || e.target.closest('#nb-client-search')) return;
    results.style.display = 'none';
  });
}

function loadBookingCatalog() {
  const grid = document.getElementById('nb-activities');
  if (!grid) return;
  grid.innerHTML = '<div class="text-muted">Загрузка…</div>';
  fetch('/bookings/api/catalog')
    .then(function (r) { return r.json(); })
    .then(function (data) {
      const services = Array.isArray(data.services) ? data.services.filter(function (s) { return s && s.is_active !== 0; }) : [];
      grid.innerHTML = services.length
        ? services
            .map(function (s) {
              const price =
                s.price_per_person != null
                  ? (Number(s.price_per_person).toLocaleString('ru-RU') + ' ₽/чел')
                  : s.price_fixed != null
                    ? (Number(s.price_fixed).toLocaleString('ru-RU') + ' ₽')
                    : s.price_per_hour != null
                      ? (Number(s.price_per_hour).toLocaleString('ru-RU') + ' ₽/час')
                      : '';
              return (
                '<button type="button" class="nb-activity" data-id="' +
                escapeHtml(String(s.id)) +
                '" data-category="' +
                escapeHtml(String(s.category || '')) +
                '">' +
                '<div class="nb-activity-name">' +
                escapeHtml(String(s.name || '')) +
                '</div>' +
                (price ? '<div class="nb-activity-price">' + escapeHtml(price) + '</div>' : '') +
                '</button>'
              );
            })
            .join('')
        : '<div class="text-muted">Нет активных услуг</div>';

      grid.querySelectorAll('button.nb-activity').forEach(function (btn) {
        btn.onclick = function () {
          grid.querySelectorAll('button.nb-activity').forEach(function (b) { b.classList.remove('active'); });
          btn.classList.add('active');
          const serviceId = document.getElementById('nb-service-id');
          if (serviceId) serviceId.value = btn.getAttribute('data-id') || '';
        };
      });
    })
    .catch(function () {
      grid.innerHTML = '<div class="text-muted">Не удалось загрузить услуги</div>';
    });
}

function createBookingFromModal() {
  const err = document.getElementById('new-booking-error');
  const setErr = function (msg) {
    if (!err) return;
    err.textContent = msg;
    err.style.display = 'block';
  };

  let clientId = (document.getElementById('nb-client-id') || {}).value || '';
  const serviceId = (document.getElementById('nb-service-id') || {}).value || '';
  const date = (document.getElementById('nb-date') || {}).value || '';
  const start = (document.getElementById('nb-start') || {}).value || '';
  const end = (document.getElementById('nb-end') || {}).value || '';
  const people = (document.getElementById('nb-people') || {}).value || '1';

  const panel = document.getElementById('nb-new-client-fields');
  const newClientOpen =
    panel &&
    panel.style.display !== 'none' &&
    window.getComputedStyle(panel).display !== 'none';

  const submitBooking = function (cid) {
    if (!serviceId) return setErr('Выберите активность');
    if (!date) return setErr('Укажите дату');
    if (!start || !end) return setErr('Укажите время начала и окончания');

    const toMin = function (hhmm) {
      const parts = String(hhmm).split(':');
      const h = parseInt(parts[0] || '0', 10) || 0;
      const m = parseInt(parts[1] || '0', 10) || 0;
      return h * 60 + m;
    };
    const dur = Math.max(0, toMin(end) - toMin(start));
    if (dur <= 0) return setErr('Окончание должно быть позже начала');

    const item = {
      item_type: 'service',
      item_id: parseInt(serviceId, 10),
      item_category: null,
      name: '',
      quantity: 1,
      price_type: '',
      price: 0,
      start_time: start,
      end_time: end,
      duration_minutes: dur,
      notes: null
    };

    const body =
      'client_id=' + encodeURIComponent(cid) +
      '&booking_date=' + encodeURIComponent(date) +
      '&people_count=' + encodeURIComponent(people) +
      '&status=pending&payment_status=unpaid&notes=' +
      encodeURIComponent('') +
      '&items_json=' + encodeURIComponent(JSON.stringify([item])) +
      '&bonus_spent=' + encodeURIComponent('0');

    fetch('/bookings', {
      method: 'POST',
      headers: csrfHeaders({ 'Content-Type': 'application/x-www-form-urlencoded' }),
      body: body
    })
      .then(function (r) {
        if (r.redirected) {
          window.location.href = r.url;
          return;
        }
        setErr('Ошибка при создании. Проверьте данные и пересечения по времени.');
      })
      .catch(function (e) {
        setErr('Ошибка: ' + e.message);
      });
  };

  if (clientId) {
    return submitBooking(clientId);
  }

  if (!newClientOpen) {
    return setErr('Выберите клиента из списка или нажмите «Добавить нового клиента»');
  }

  const full_name = ((document.getElementById('nb-new-fullname') || {}).value || '').trim();
  const phone = ((document.getElementById('nb-new-phone') || {}).value || '').trim();
  const birthday = (document.getElementById('nb-new-birthday') || {}).value || '';
  const child_name = ((document.getElementById('nb-new-child-name') || {}).value || '').trim();
  const child_birth_date = (document.getElementById('nb-new-child-birthdate') || {}).value || '';
  const child_turning_age = (document.getElementById('nb-new-child-turning-age') || {}).value || '';

  if (!full_name || !phone) {
    return setErr('Укажите ФИО и телефон нового клиента');
  }

  const clientBody = new URLSearchParams();
  clientBody.set('full_name', full_name);
  clientBody.set('phone', phone);
  clientBody.set('email', '');
  clientBody.set('birthday', birthday);
  clientBody.set('notes', '');
  clientBody.set('child_name', child_name);
  clientBody.set('child_birth_date', child_birth_date);
  clientBody.set('child_turning_age', child_turning_age);

  fetch('/clients', {
    method: 'POST',
    headers: csrfHeaders({
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json'
    }),
    body: clientBody.toString()
  })
    .then(function (r) {
      return r.json().then(function (j) {
        return { r: r, j: j };
      });
    })
    .then(function (_ref) {
      const r = _ref.r;
      const j = _ref.j;
      if (!r.ok) {
        return setErr((j && j.error) || 'Не удалось создать клиента');
      }
      if (!j || j.id == null) {
        return setErr('Не удалось создать клиента');
      }
      submitBooking(String(j.id));
    })
    .catch(function () {
      setErr('Не удалось создать клиента');
    });
}

// ============================================
// QUICK ACTIONS: «Расход» / «Смена»
// ============================================

function initQuickActions() {
  var btnExp = document.getElementById('btn-quick-expense');
  if (btnExp) btnExp.addEventListener('click', openQuickExpenseModal);
  var btnShift = document.getElementById('btn-quick-shift');
  if (btnShift) btnShift.addEventListener('click', openQuickShiftModal);

  // Toggle vendor input для категории "custom"
  var radios = document.querySelectorAll('input[name="qe-category"]');
  radios.forEach(function (r) {
    r.addEventListener('change', function () {
      var vendor = document.getElementById('qe-vendor');
      if (!vendor) return;
      vendor.style.display = r.value === 'custom' && r.checked ? '' : 'none';
    });
  });
}

function openQuickExpenseModal() {
  var modal = document.getElementById('quick-expense-modal');
  if (!modal) return;
  var err = document.getElementById('quick-expense-error');
  if (err) { err.style.display = 'none'; err.textContent = ''; }
  var amount = document.getElementById('qe-amount');
  if (amount) amount.value = '';
  var note = document.getElementById('qe-note');
  if (note) note.value = '';
  var vendor = document.getElementById('qe-vendor');
  if (vendor) { vendor.value = ''; vendor.style.display = 'none'; }
  var defaultRadio = document.querySelector('input[name="qe-category"][value="purchase"]');
  if (defaultRadio) defaultRadio.checked = true;
  var pm = document.getElementById('qe-payment-method');
  if (pm) pm.value = 'cash';
  modal.classList.add('active');
  modal.setAttribute('aria-hidden', 'false');
  if (amount) amount.focus();
}

function hideQuickExpenseModal() {
  var modal = document.getElementById('quick-expense-modal');
  if (!modal) return;
  modal.classList.remove('active');
  modal.setAttribute('aria-hidden', 'true');
}

function submitQuickExpense() {
  var err = document.getElementById('quick-expense-error');
  function setErr(msg) {
    if (!err) return;
    err.textContent = msg;
    err.style.display = 'block';
  }

  var amount = parseFloat((document.getElementById('qe-amount') || {}).value || '');
  if (!isFinite(amount) || amount <= 0) return setErr('Сумма должна быть больше 0');
  var checked = document.querySelector('input[name="qe-category"]:checked');
  if (!checked) return setErr('Выберите категорию');
  var category = checked.value;
  var vendor = (document.getElementById('qe-vendor') || {}).value || '';
  if (category === 'custom' && !vendor.trim()) {
    return setErr('Укажите название/получателя');
  }
  var paymentMethod = (document.getElementById('qe-payment-method') || {}).value || 'cash';
  var note = (document.getElementById('qe-note') || {}).value || '';

  fetch('/quick/expenses', {
    method: 'POST',
    headers: csrfHeaders({ 'Content-Type': 'application/json', Accept: 'application/json' }),
    body: JSON.stringify({
      amount: amount,
      category: category,
      vendor: category === 'custom' ? vendor.trim() : null,
      payment_method: paymentMethod,
      note: note
    })
  })
    .then(function (r) { return r.json().then(function (j) { return { r: r, j: j }; }); })
    .then(function (x) {
      if (!x.r.ok) return setErr((x.j && x.j.error) || 'Не удалось сохранить расход');
      hideQuickExpenseModal();
      loadMyQuickToday();
    })
    .catch(function () { setErr('Сетевая ошибка'); });
}

function openQuickShiftModal() {
  var modal = document.getElementById('quick-shift-modal');
  if (!modal) return;
  var err = document.getElementById('quick-shift-error');
  if (err) { err.style.display = 'none'; err.textContent = ''; }
  var date = document.getElementById('qs-date');
  if (date) {
    var d = new Date();
    var ymd = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    date.value = ymd;
  }
  var note = document.getElementById('qs-note');
  if (note) note.value = '';
  var start = document.getElementById('qs-start');
  if (start) start.value = '';
  var end = document.getElementById('qs-end');
  if (end) end.value = '';

  // Подгружаем сотрудников
  var sel = document.getElementById('qs-user-id');
  if (sel) {
    sel.innerHTML = '<option value="">— загрузка…</option>';
    fetch('/quick/users', { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (users) {
        sel.innerHTML = '';
        var ph = document.createElement('option');
        ph.value = '';
        ph.textContent = '— выберите —';
        sel.appendChild(ph);
        (users || []).forEach(function (u) {
          var opt = document.createElement('option');
          opt.value = String(u.id);
          opt.textContent = u.name + (u.role ? ' (' + u.role + ')' : '');
          sel.appendChild(opt);
        });
      })
      .catch(function () {
        sel.innerHTML = '<option value="">— ошибка загрузки —</option>';
      });
  }
  modal.classList.add('active');
  modal.setAttribute('aria-hidden', 'false');
}

function hideQuickShiftModal() {
  var modal = document.getElementById('quick-shift-modal');
  if (!modal) return;
  modal.classList.remove('active');
  modal.setAttribute('aria-hidden', 'true');
}

function submitQuickShift() {
  var err = document.getElementById('quick-shift-error');
  function setErr(msg) {
    if (!err) return;
    err.textContent = msg;
    err.style.display = 'block';
  }

  var userId = (document.getElementById('qs-user-id') || {}).value || '';
  if (!userId) return setErr('Выберите сотрудника');
  var date = (document.getElementById('qs-date') || {}).value || '';
  if (!date) return setErr('Укажите дату');
  var start = (document.getElementById('qs-start') || {}).value || '';
  var end = (document.getElementById('qs-end') || {}).value || '';
  if (!start || !end) return setErr('Укажите время начала и окончания смены');
  if (end <= start) return setErr('Время «до» должно быть больше «с»');
  var note = (document.getElementById('qs-note') || {}).value || '';

  fetch('/quick/shifts', {
    method: 'POST',
    headers: csrfHeaders({ 'Content-Type': 'application/json', Accept: 'application/json' }),
    body: JSON.stringify({
      user_id: Number(userId),
      shift_date: date,
      start_time: start,
      end_time: end,
      note: note
    })
  })
    .then(function (r) { return r.json().then(function (j) { return { r: r, j: j }; }); })
    .then(function (x) {
      if (!x.r.ok) return setErr((x.j && x.j.error) || 'Не удалось сохранить смену');
      hideQuickShiftModal();
      loadMyQuickToday();
    })
    .catch(function () { setErr('Сетевая ошибка'); });
}

// ============================================
// DASHBOARD «Мои записи за сегодня»
// ============================================

function initDashboardQuick() {
  if (document.getElementById('dashboard-quick')) {
    loadMyQuickToday();
  }
}

function loadMyQuickToday() {
  var box = document.getElementById('dashboard-quick');
  if (!box) return;
  fetch('/quick/today', { headers: { Accept: 'application/json' } })
    .then(function (r) { return r.json(); })
    .then(function (data) { renderMyQuickToday(box, data || {}); })
    .catch(function () {});
}

function renderMyQuickToday(box, data) {
  var expBox = box.querySelector('[data-quick-list="expenses"]');
  var shBox = box.querySelector('[data-quick-list="shifts"]');
  var fmtMoney = function (n) { return Number(n || 0).toLocaleString('ru-RU') + ' ₽'; };
  var fmtTime = function (s) {
    if (!s) return '';
    var d = new Date(s);
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    }
    return String(s).slice(11, 16);
  };
  var ageHours = function (s) {
    if (!s) return Infinity;
    var d = new Date(s);
    if (isNaN(d.getTime())) return Infinity;
    return (Date.now() - d.getTime()) / 3600000;
  };
  var canDelete = function (createdAt) { return ageHours(createdAt) <= 1; };

  var expCategoryLabel = {
    salary: 'Зарплата',
    purchase: 'Закупка',
    other: 'Прочее',
    prepayment_refund: 'Возврат аванса',
    custom: 'Другое'
  };

  if (expBox) {
    var exps = data.expenses || [];
    if (!exps.length) {
      expBox.innerHTML = '<p class="muted">Сегодня расходов ещё не добавлено.</p>';
    } else {
      expBox.innerHTML = exps.map(function (e) {
        var cat = expCategoryLabel[e.category] || e.category;
        var vendor = e.vendor ? ' · ' + escapeHtmlSafe(e.vendor) : '';
        var note = e.note ? '<div class="quick-record-note">' + escapeHtmlSafe(e.note) + '</div>' : '';
        var del = canDelete(e.spent_at)
          ? '<button class="btn btn-text btn-sm btn-danger" type="button" onclick="deleteQuickRecord(\'expense\',' + Number(e.id) + ')">Удалить</button>'
          : '';
        return '<div class="quick-record-item">' +
          '<div class="quick-record-main">' +
          '<strong>' + fmtMoney(e.amount) + '</strong> · ' + escapeHtmlSafe(cat) + vendor +
          ' <span class="muted">' + fmtTime(e.spent_at) + '</span>' +
          '</div>' + note +
          '<div class="quick-record-actions">' + del + '</div>' +
          '</div>';
      }).join('');
    }
  }

  if (shBox) {
    var shifts = data.shifts || [];
    if (!shifts.length) {
      shBox.innerHTML = '<p class="muted">Сегодня смен ещё не записано.</p>';
    } else {
      shBox.innerHTML = shifts.map(function (s) {
        var time = (s.start_time && s.end_time) ? (String(s.start_time).slice(0, 5) + '–' + String(s.end_time).slice(0, 5)) : '';
        var who = s.user_name || ('id ' + s.user_id);
        var note = s.note ? '<div class="quick-record-note">' + escapeHtmlSafe(s.note) + '</div>' : '';
        var hours = s.hours != null ? (' · ' + Number(s.hours).toFixed(1) + ' ч') : '';
        var del = canDelete(s.created_at)
          ? '<button class="btn btn-text btn-sm btn-danger" type="button" onclick="deleteQuickRecord(\'shift\',' + Number(s.id) + ')">Удалить</button>'
          : '';
        return '<div class="quick-record-item">' +
          '<div class="quick-record-main">' +
          '<strong>' + escapeHtmlSafe(who) + '</strong>' + (time ? ' · ' + time : '') + hours +
          '</div>' + note +
          '<div class="quick-record-actions">' + del + '</div>' +
          '</div>';
      }).join('');
    }
  }
}

function escapeHtmlSafe(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function deleteQuickRecord(kind, id) {
  if (!confirm('Удалить запись?')) return;
  var url = kind === 'shift' ? '/quick/shifts/' + id : '/quick/expenses/' + id;
  fetch(url, { method: 'DELETE', headers: csrfHeaders({ Accept: 'application/json' }) })
    .then(function (r) { return r.json().then(function (j) { return { r: r, j: j }; }); })
    .then(function (x) {
      if (!x.r.ok) {
        alert((x.j && x.j.error) || 'Не удалось удалить');
        return;
      }
      loadMyQuickToday();
    })
    .catch(function () { alert('Сетевая ошибка'); });
}
