(function () {
  var form = document.querySelector('form[action*="/catalog"]');
  if (!form) return;

  var articleInput = form.querySelector('input[name="article"]');
  var typeSelect = form.querySelector('select[name="type"]');
  var suggestBtn = document.getElementById('catalog-suggest-article');
  var banner = document.getElementById('catalog-article-conflict');
  var submitBtn = form.querySelector('button[type="submit"]');
  if (!articleInput) return;

  var excludeId = form.getAttribute('data-item-id') || '';
  var debounceTimer = null;
  var articleBlocked = false;

  function setBlocked(blocked, existing) {
    articleBlocked = blocked;
    if (submitBtn) submitBtn.disabled = blocked;
    if (!banner) return;
    if (!blocked || !existing) {
      banner.hidden = true;
      banner.textContent = '';
      return;
    }
    banner.hidden = false;
    banner.innerHTML =
      'Артикул уже занят: <a href="/catalog/' +
      existing.id +
      '/edit">' +
      (existing.name || 'позиция') +
      '</a>';
  }

  function checkArticle() {
    var article = (articleInput.value || '').trim();
    if (!article) {
      setBlocked(false);
      return;
    }
    var url =
      '/api/catalog/check-article?article=' +
      encodeURIComponent(article) +
      (excludeId ? '&exclude_id=' + encodeURIComponent(excludeId) : '');
    fetch(url, { credentials: 'same-origin' })
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        if (data.available) {
          setBlocked(false);
        } else if (data.existing) {
          setBlocked(true, data.existing);
        } else {
          setBlocked(false);
        }
      })
      .catch(function () {
        setBlocked(false);
      });
  }

  function scheduleCheck() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(checkArticle, 350);
  }

  articleInput.addEventListener('input', scheduleCheck);
  articleInput.addEventListener('blur', checkArticle);

  if (typeSelect) {
    typeSelect.addEventListener('change', function () {
      if (!articleInput.value.trim()) {
        fetch('/api/catalog/suggest-article?type=' + encodeURIComponent(typeSelect.value), {
          credentials: 'same-origin'
        })
          .then(function (r) {
            return r.json();
          })
          .then(function (data) {
            if (data.article) {
              articleInput.value = data.article;
              checkArticle();
            }
          })
          .catch(function () {});
      }
    });
  }

  if (suggestBtn) {
    suggestBtn.addEventListener('click', function (e) {
      e.preventDefault();
      var type = typeSelect ? typeSelect.value : 'work';
      fetch('/api/catalog/suggest-article?type=' + encodeURIComponent(type), { credentials: 'same-origin' })
        .then(function (r) {
          return r.json();
        })
        .then(function (data) {
          if (data.article) {
            articleInput.value = data.article;
            checkArticle();
          }
        })
        .catch(function () {});
    });
  }

  form.addEventListener('submit', function (e) {
    if (articleBlocked) {
      e.preventDefault();
    }
  });

  if (articleInput.value.trim()) {
    checkArticle();
  }
})();
