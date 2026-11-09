/* =============================================================
   VOLTA — Comportamiento de la página
   -------------------------------------------------------------
   ÍNDICE
   01. Utilidades
   02. Almacenamiento (carrito y favoritos)
   03. Índice de productos
   04. Catálogo: filtros, búsqueda y orden
   05. Tarjetas: tallas, favoritos y ficha rápida
   06. Carrito lateral
   07. Ficha rápida (modal)
   08. Cuenta atrás de la oferta
   09. Guía de tallas
   10. Preguntas frecuentes
   11. Boletín
   12. Interfaz general (nav, buscador, volver arriba, animaciones)
   13. Arranque
   ============================================================= */

(function () {
  'use strict';

  /* ============================================================
     01. UTILIDADES
     ============================================================ */

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

  const money = (value) => '$' + value.toFixed(2);

  const slug = (text) => text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  /** Bloquea el desplazamiento del fondo mientras hay un panel abierto. */
  const scrollLock = {
    count: 0,
    on() {
      this.count += 1;
      document.body.classList.add('no-scroll');
    },
    off() {
      this.count = Math.max(0, this.count - 1);
      if (this.count === 0) document.body.classList.remove('no-scroll');
    }
  };

  /** Mantiene el foco dentro de un panel abierto (accesibilidad). */
  function trapFocus(container, event) {
    const focusables = $$(
      'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
      container
    ).filter((el) => el.offsetParent !== null);

    if (!focusables.length) return;

    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  /** Aviso flotante temporal. */
  const toast = (() => {
    const el = $('#toast');
    const message = $('#toast-message');
    let timer = null;

    return function show(text) {
      message.textContent = text;
      el.classList.add('is-visible');
      window.clearTimeout(timer);
      timer = window.setTimeout(() => el.classList.remove('is-visible'), 2400);
    };
  })();

  /* ============================================================
     02. ALMACENAMIENTO (CARRITO Y FAVORITOS)
     ============================================================ */

  const STORAGE = {
    cart: 'volta.cart.v1',
    wishlist: 'volta.wishlist.v1',
    offer: 'volta.offerEnd.v1'
  };

  const store = {
    read(key, fallback) {
      try {
        const raw = window.localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch (error) {
        return fallback;
      }
    },
    write(key, value) {
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
      } catch (error) {
        /* Almacenamiento no disponible: la página sigue funcionando en memoria. */
      }
    }
  };

  /* ============================================================
     03. ÍNDICE DE PRODUCTOS
     ============================================================ */

  /** Construye el catálogo leyendo las tarjetas ya presentes en el HTML. */
  const productIndex = $$('.product').reduce((accumulator, card) => {
    const data = card.dataset;
    accumulator[data.id] = {
      id: data.id,
      name: data.name,
      category: data.cat,
      categoryLabel: $('.product__cat', card).textContent.trim(),
      price: parseFloat(data.price),
      oldPrice: data.old ? parseFloat(data.old) : null,
      rating: Number(data.rating),
      reviews: Number(data.reviews),
      description: data.desc,
      image: $('img', card).getAttribute('src')
    };
    return accumulator;
  }, {});

  /* ============================================================
     04. CATÁLOGO: FILTROS, BÚSQUEDA Y ORDEN
     ============================================================ */

  const grid = $('#products');
  const emptyState = $('#empty-state');
  const resultCount = $('#result-count');
  const sortSelect = $('#sort');

  const view = {
    category: 'all',
    query: '',
    sort: 'featured'
  };

  /** Aplica filtros, orden y visibilidad de las tarjetas. */
  function applyView() {
    const cards = $$('.product', grid);
    const query = slug(view.query.trim());

    const matching = cards.filter((card) => {
      const matchesCategory = view.category === 'all' || card.dataset.cat === view.category;
      const haystack = slug(card.dataset.name + ' ' + card.dataset.cat);
      const matchesQuery = !query || haystack.includes(query);
      return matchesCategory && matchesQuery;
    });

    cards.forEach((card) => {
      card.hidden = !matching.includes(card);
    });

    const sorters = {
      'price-asc': (a, b) => parseFloat(a.dataset.price) - parseFloat(b.dataset.price),
      'price-desc': (a, b) => parseFloat(b.dataset.price) - parseFloat(a.dataset.price),
      rating: (a, b) => Number(b.dataset.rating) - Number(a.dataset.rating) ||
        Number(b.dataset.reviews) - Number(a.dataset.reviews),
      featured: null
    };

    const ordered = sorters[view.sort] ? matching.slice().sort(sorters[view.sort]) : matching;

    ordered.forEach((card) => grid.appendChild(card));
    grid.appendChild(emptyState);

    emptyState.hidden = ordered.length > 0;

    const total = ordered.length;
    resultCount.innerHTML = 'Mostrando <b>' + total + '</b> ' + (total === 1 ? 'producto' : 'productos');
  }

  /** Activa una categoría del filtro, con o sin desplazamiento al catálogo. */
  function setCategory(category, scrollToGrid) {
    view.category = category;

    $$('.filter').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.filter === category));
    });

    applyView();

    if (scrollToGrid) {
      $('#productos').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  $$('.filter').forEach((button) => {
    button.addEventListener('click', () => setCategory(button.dataset.filter, false));
  });

  sortSelect.addEventListener('change', () => {
    view.sort = sortSelect.value;
    applyView();
  });

  // Los accesos rápidos de las categorías activan su filtro correspondiente.
  $$('[data-jump-filter]').forEach((link) => {
    link.addEventListener('click', () => setCategory(link.dataset.jumpFilter, true));
  });

  const searchPanel = $('#search-panel');
  const searchToggle = $('#search-toggle');
  const searchInput = $('#search-input');

  function openSearch() {
    searchPanel.classList.add('is-open');
    searchToggle.setAttribute('aria-expanded', 'true');
    searchInput.focus();
  }

  function closeSearch() {
    searchPanel.classList.remove('is-open');
    searchToggle.setAttribute('aria-expanded', 'false');
  }

  searchToggle.addEventListener('click', () => {
    if (searchPanel.classList.contains('is-open')) {
      closeSearch();
    } else {
      openSearch();
    }
  });

  $('#search-form').addEventListener('submit', (event) => {
    event.preventDefault();
    view.query = searchInput.value;
    applyView();
    closeSearch();
    $('#productos').scrollIntoView({ behavior: 'smooth', block: 'start' });
    toast(view.query.trim() ? 'Resultados para «' + view.query.trim() + '»' : 'Mostrando todo el catálogo');
  });

  // La búsqueda se aplica también en vivo mientras se escribe.
  searchInput.addEventListener('input', () => {
    view.query = searchInput.value;
    applyView();
  });

  /* ============================================================
     05. TARJETAS: TALLAS, FAVORITOS Y FICHA RÁPIDA
     ============================================================ */

  let wishlist = store.read(STORAGE.wishlist, []);
  const wishBadge = $('#wish-badge');

  function syncWishlistUi() {
    wishBadge.textContent = wishlist.length;
    wishBadge.hidden = wishlist.length === 0;

    $$('[data-wish]').forEach((button) => {
      button.setAttribute('aria-pressed', String(wishlist.includes(button.dataset.wish)));
    });
  }

  function toggleWishlist(id) {
    const product = productIndex[id];
    if (!product) return;

    const index = wishlist.indexOf(id);
    if (index === -1) {
      wishlist.push(id);
      toast(product.name + ' guardado en favoritos');
    } else {
      wishlist.splice(index, 1);
      toast(product.name + ' eliminado de favoritos');
    }

    store.write(STORAGE.wishlist, wishlist);
    syncWishlistUi();
  }

  // Delegación de eventos para todo lo que ocurre dentro de las tarjetas.
  grid.addEventListener('click', (event) => {
    const sizeButton = event.target.closest('.size');
    if (sizeButton) {
      const group = sizeButton.parentElement;
      $$('.size', group).forEach((other) => other.setAttribute('aria-pressed', 'false'));
      sizeButton.setAttribute('aria-pressed', 'true');
      return;
    }

    const wishButton = event.target.closest('[data-wish]');
    if (wishButton) {
      toggleWishlist(wishButton.dataset.wish);
      return;
    }

    const quickButton = event.target.closest('[data-quick]');
    if (quickButton) {
      openModal(quickButton.dataset.quick);
      return;
    }

    const addButton = event.target.closest('[data-add]');
    if (addButton) {
      handleAddToCart(addButton);
    }
  });

  /** Lee la talla seleccionada en una tarjeta. */
  function selectedSizeIn(card) {
    const chosen = $('.size[aria-pressed="true"]', card);
    return chosen ? chosen.dataset.size : null;
  }

  function handleAddToCart(button) {
    const card = button.closest('.product');
    const id = button.dataset.add;
    const size = selectedSizeIn(card);

    if (!size) {
      toast('Selecciona tu talla antes de continuar');
      const firstSize = $('.size', card);
      if (firstSize) firstSize.focus();
      return;
    }

    addToCart(id, size);

    const original = button.innerHTML;
    button.classList.add('is-added');
    button.textContent = '¡Añadido!';

    window.setTimeout(() => {
      button.classList.remove('is-added');
      button.innerHTML = original;
    }, 1400);
  }

  /* ============================================================
     06. CARRITO LATERAL
     ============================================================ */

  const FREE_SHIPPING_FROM = 80;
  const SHIPPING_COST = 6.9;

  const cartEl = $('#cart');
  const overlay = $('#overlay');
  const cartBody = $('#cart-body');
  const cartBadge = $('#cart-badge');
  const cartToggle = $('#cart-toggle');

  /** Carrito en memoria: { 'p1-42': { id, size, qty } } */
  let cart = store.read(STORAGE.cart, {});
  let focusBeforeOpen = null;

  function cartTotals() {
    return Object.values(cart).reduce(
      (accumulator, item) => {
        const product = productIndex[item.id];
        if (!product) return accumulator;
        accumulator.subtotal += product.price * item.qty;
        accumulator.count += item.qty;
        return accumulator;
      },
      { subtotal: 0, count: 0 }
    );
  }

  function renderCart() {
    const totals = cartTotals();
    const keys = Object.keys(cart);

    totals.shipping = totals.subtotal === 0 || totals.subtotal >= FREE_SHIPPING_FROM ? 0 : SHIPPING_COST;
    totals.total = totals.subtotal + totals.shipping;

    cartBadge.textContent = totals.count;
    cartBadge.hidden = totals.count === 0;
    $('#cart-count').textContent = totals.count;

    if (!keys.length) {
      cartBody.innerHTML =
        '<div class="cart__empty">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4H6Z"/><path d="M3 6h18M16 10a4 4 0 0 1-8 0"/></svg>' +
          '<b>Tu carrito está vacío</b>' +
          '<p>Añade tu par favorito y aprovecha el envío gratis desde $80.</p>' +
        '</div>';
    } else {
      cartBody.innerHTML = keys
        .map((key) => {
          const item = cart[key];
          const product = productIndex[item.id];
          return (
            '<article class="cart-item">' +
              '<img src="' + product.image + '" alt="' + product.name + '" width="72" height="72">' +
              '<div class="cart-item__info">' +
                '<h3>' + product.name + '</h3>' +
                '<p class="cart-item__meta">Talla ' + item.size + ' · ' + product.categoryLabel + '</p>' +
                '<div class="cart-item__row">' +
                  '<div class="qty">' +
                    '<button type="button" data-action="decrease" data-key="' + key + '" aria-label="Quitar una unidad de ' + product.name + '">−</button>' +
                    '<span aria-live="polite">' + item.qty + '</span>' +
                    '<button type="button" data-action="increase" data-key="' + key + '" aria-label="Añadir una unidad de ' + product.name + '">+</button>' +
                  '</div>' +
                  '<span class="cart-item__price">' + money(product.price * item.qty) + '</span>' +
                '</div>' +
                '<button class="link-btn" type="button" data-action="remove" data-key="' + key + '">Eliminar</button>' +
              '</div>' +
            '</article>'
          );
        })
        .join('');
    }

    $('#cart-subtotal').textContent = money(totals.subtotal);
    $('#cart-shipping').textContent = totals.subtotal === 0
      ? '—'
      : totals.shipping === 0
        ? 'Gratis'
        : money(totals.shipping);
    $('#cart-total').textContent = money(totals.total);

    const percent = Math.min(100, (totals.subtotal / FREE_SHIPPING_FROM) * 100);
    $('#ship-bar').style.width = percent + '%';
    $('#ship-progress').setAttribute('aria-valuenow', String(Math.round(percent)));

    $('#ship-note').textContent = totals.subtotal === 0
      ? 'Añade productos para calcular tu envío.'
      : totals.subtotal >= FREE_SHIPPING_FROM
        ? '¡Felicidades! Tu pedido tiene envío gratis.'
        : 'Te faltan ' + money(FREE_SHIPPING_FROM - totals.subtotal) + ' para el envío gratis.';
  }

  function addToCart(id, size) {
    const key = id + '-' + size;

    if (cart[key]) {
      cart[key].qty += 1;
    } else {
      cart[key] = { id: id, size: size, qty: 1 };
    }

    store.write(STORAGE.cart, cart);
    renderCart();

    const product = productIndex[id];
    toast(product.name + ' (talla ' + size + ') añadido al carrito');
    openCart();
  }

  function openCart() {
    focusBeforeOpen = document.activeElement;
    cartEl.inert = false;
    cartEl.classList.add('is-open');
    cartEl.setAttribute('aria-hidden', 'false');
    overlay.classList.add('is-open');
    cartToggle.setAttribute('aria-expanded', 'true');
    scrollLock.on();
    $('#cart-close').focus();
  }

  function closeCart() {
    if (!cartEl.classList.contains('is-open')) return;
    cartEl.classList.remove('is-open');
    cartEl.setAttribute('aria-hidden', 'true');
    cartEl.inert = true;
    overlay.classList.remove('is-open');
    cartToggle.setAttribute('aria-expanded', 'false');
    scrollLock.off();
    if (focusBeforeOpen) focusBeforeOpen.focus();
  }

  cartToggle.addEventListener('click', openCart);
  $('#cart-close').addEventListener('click', closeCart);
  overlay.addEventListener('click', closeCart);

  cartBody.addEventListener('click', (event) => {
    const action = event.target.closest('[data-action]');
    if (!action) return;

    const key = action.dataset.key;
    const item = cart[key];
    if (!item) return;

    if (action.dataset.action === 'increase') {
      item.qty += 1;
    } else if (action.dataset.action === 'decrease') {
      item.qty -= 1;
      if (item.qty <= 0) delete cart[key];
    } else if (action.dataset.action === 'remove') {
      delete cart[key];
    }

    store.write(STORAGE.cart, cart);
    renderCart();
  });

  $('#checkout').addEventListener('click', () => {
    if (cartTotals().count === 0) {
      toast('Tu carrito está vacío');
      return;
    }
    toast('Redirigiendo a la pasarela de pago segura…');
  });

  /* ============================================================
     07. FICHA RÁPIDA (MODAL)
     ============================================================ */

  const modal = $('#modal');
  const modalContent = $('#modal-content');
  let modalProduct = null;

  function openModal(id) {
    const product = productIndex[id];
    if (!product) return;

    modalProduct = product;

    const oldPrice = product.oldPrice
      ? '<span class="product__old">' + money(product.oldPrice) + '</span>'
      : '';

    const sizes = ['38', '39', '40', '41', '42', '43']
      .map(
        (size) =>
          '<button class="size" type="button" data-modal-size="' + size + '" aria-pressed="false">' + size + '</button>'
      )
      .join('');

    modalContent.innerHTML =
      '<div class="modal__media">' +
        '<img src="' + product.image + '" alt="' + product.name + '" width="600" height="600">' +
      '</div>' +
      '<div class="modal__body">' +
        '<span class="product__cat">' + product.categoryLabel + '</span>' +
        '<h2 id="modal-title">' + product.name + '</h2>' +
        '<p class="stars">' + '★'.repeat(product.rating) + '☆'.repeat(5 - product.rating) +
          '<span style="color:var(--muted);letter-spacing:0;margin-left:6px">(' + product.reviews + ' opiniones)</span></p>' +
        '<p class="product__prices"><span class="product__price">' + money(product.price) + '</span>' + oldPrice + '</p>' +
        '<p class="modal__desc">' + product.description + '</p>' +
        '<div>' +
          '<p style="font-size:.85rem;font-weight:600;margin-bottom:8px">Elige tu talla</p>' +
          '<div class="modal__sizes">' + sizes + '</div>' +
        '</div>' +
        '<button class="btn btn--accent btn--block" type="button" data-modal-add>' +
          'Añadir al carrito · ' + money(product.price) +
        '</button>' +
        '<p style="font-size:.78rem;color:var(--muted)">Envío gratis desde $80 · Cambio de talla sin costo durante 30 días.</p>' +
      '</div>';

    focusBeforeOpen = document.activeElement;
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    scrollLock.on();
    $('#modal-close').focus();
  }

  function closeModal() {
    if (!modal.classList.contains('is-open')) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    modalProduct = null;
    scrollLock.off();
    if (focusBeforeOpen) focusBeforeOpen.focus();
  }

  $('#modal-close').addEventListener('click', closeModal);
  $('[data-close-modal]').addEventListener('click', closeModal);

  modalContent.addEventListener('click', (event) => {
    const sizeButton = event.target.closest('[data-modal-size]');
    if (sizeButton) {
      $$('[data-modal-size]', modalContent).forEach((other) => other.setAttribute('aria-pressed', 'false'));
      sizeButton.setAttribute('aria-pressed', 'true');
      return;
    }

    if (event.target.closest('[data-modal-add]')) {
      const chosen = $('[data-modal-size][aria-pressed="true"]', modalContent);
      if (!chosen) {
        toast('Selecciona tu talla antes de continuar');
        return;
      }
      addToCart(modalProduct.id, chosen.dataset.modalSize);
      closeModal();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeModal();
      closeCart();
      closeSearch();
      return;
    }

    if (event.key === 'Tab') {
      if (modal.classList.contains('is-open')) trapFocus(modal, event);
      else if (cartEl.classList.contains('is-open')) trapFocus(cartEl, event);
    }
  });

  /* ============================================================
     08. CUENTA ATRÁS DE LA OFERTA
     ============================================================ */

  function offerDeadline() {
    const stored = Number(store.read(STORAGE.offer, 0));
    if (stored && stored > Date.now()) return stored;

    const deadline = new Date();
    deadline.setHours(23, 59, 59, 999);
    deadline.setDate(deadline.getDate() + 2);

    store.write(STORAGE.offer, deadline.getTime());
    return deadline.getTime();
  }

  function startCountdown() {
    const deadline = offerDeadline();
    const pad = (value) => String(value).padStart(2, '0');

    const days = $('#cd-days');
    const hours = $('#cd-hours');
    const minutes = $('#cd-minutes');
    const seconds = $('#cd-seconds');

    function tick() {
      const remaining = Math.max(0, deadline - Date.now());
      const total = Math.floor(remaining / 1000);

      days.textContent = pad(Math.floor(total / 86400));
      hours.textContent = pad(Math.floor((total % 86400) / 3600));
      minutes.textContent = pad(Math.floor((total % 3600) / 60));
      seconds.textContent = pad(total % 60);
    }

    tick();
    window.setInterval(tick, 1000);
  }

  /* ============================================================
     09. GUÍA DE TALLAS
     ============================================================ */

  const unitToggle = $('#unit-toggle');

  unitToggle.addEventListener('click', () => {
    const tableCm = $('#table-cm');
    const tableInches = $('#table-inches');
    const showInches = !tableCm.hidden;

    tableCm.hidden = showInches;
    tableInches.hidden = !showInches;

    unitToggle.setAttribute('aria-pressed', String(showInches));
    unitToggle.textContent = showInches ? 'Ver tabla en centímetros' : 'Ver tabla en pulgadas';
  });

  /* ============================================================
     10. PREGUNTAS FRECUENTES
     ============================================================ */

  $$('.faq__item').forEach((item) => {
    const question = $('.faq__q', item);
    const answer = $('.faq__a', item);

    question.addEventListener('click', () => {
      const isOpen = item.classList.contains('is-open');

      $$('.faq__item.is-open').forEach((other) => {
        other.classList.remove('is-open');
        $('.faq__q', other).setAttribute('aria-expanded', 'false');
        $('.faq__a', other).style.maxHeight = '';
      });

      if (!isOpen) {
        item.classList.add('is-open');
        question.setAttribute('aria-expanded', 'true');
        answer.style.maxHeight = answer.scrollHeight + 'px';
      }
    });
  });

  /* ============================================================
     11. BOLETÍN
     ============================================================ */

  const newsletterForm = $('#newsletter-form');
  const newsletterEmail = $('#newsletter-email');
  const newsletterMessage = $('#newsletter-msg');

  newsletterForm.addEventListener('submit', (event) => {
    event.preventDefault();

    const email = newsletterEmail.value.trim();
    const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);

    newsletterMessage.classList.toggle('form-msg--error', !isValid);

    if (!isValid) {
      newsletterMessage.textContent = 'Ingresa un correo válido, por favor.';
      newsletterEmail.focus();
      return;
    }

    newsletterMessage.textContent = '¡Listo! Tu cupón BIENVENIDA10 va en camino a ' + email;
    newsletterForm.reset();
  });

  /* ============================================================
     12. INTERFAZ GENERAL
     ============================================================ */

  // Año dinámico en el pie de página.
  $('#year').textContent = new Date().getFullYear();

  // Cinta infinita: se duplica el contenido para que el bucle sea continuo.
  const marquee = $('#marquee-track');
  marquee.innerHTML += marquee.innerHTML;

  // Sombra de la cabecera y botón «volver arriba».
  const header = $('#site-header');
  const toTop = $('#to-top');

  function onScroll() {
    const scrolled = window.scrollY > 10;
    header.classList.toggle('is-stuck', scrolled);
    toTop.classList.toggle('is-visible', window.scrollY > 600);
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  toTop.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // Menú móvil.
  const burger = $('#burger');
  const navLinks = $('#nav-links');

  burger.addEventListener('click', () => {
    const isOpen = navLinks.classList.toggle('is-open');
    burger.setAttribute('aria-expanded', String(isOpen));
  });

  navLinks.addEventListener('click', (event) => {
    if (event.target.tagName === 'A') {
      navLinks.classList.remove('is-open');
      burger.setAttribute('aria-expanded', 'false');
    }
  });

  // Cerrar el buscador al hacer clic fuera de la cabecera.
  document.addEventListener('click', (event) => {
    if (!searchPanel.classList.contains('is-open')) return;
    if (!event.target.closest('#site-header')) closeSearch();
  });

  // Animación de aparición progresiva.
  const revealItems = $$('.reveal');

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );

    revealItems.forEach((item, index) => {
      item.style.transitionDelay = (index % 5) * 70 + 'ms';
      observer.observe(item);
    });
  } else {
    revealItems.forEach((item) => item.classList.add('is-visible'));
  }

  /* ============================================================
     13. ARRANQUE
     ============================================================ */

  // Se descartan del almacenamiento los artículos cuyo producto ya no existe.
  Object.keys(cart).forEach((key) => {
    if (!productIndex[cart[key].id]) delete cart[key];
  });
  wishlist = wishlist.filter((id) => Boolean(productIndex[id]));

  syncWishlistUi();
  renderCart();
  applyView();
  startCountdown();
})();
