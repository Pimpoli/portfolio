// products.js
document.addEventListener('DOMContentLoaded', () => {
  const productsContainer = document.getElementById('products-container');
  const loadMoreBtn = document.getElementById('load-more-products');
  const moreProductsContainer = document.getElementById('more-products');

  console.log('loadMoreBtn encontrado:', loadMoreBtn);
  console.log('moreProductsContainer encontrado:', moreProductsContainer);

  /**
   * Define aquí todos tus productos de forma manual. Cada objeto contiene:
   *   - img:     Ruta local o externa de la imagen del producto (por ejemplo 'img/producto1.jpg')
   *   - name:    Nombre que aparece en <h3>
   *   - desc:    Descripción que aparece en <p>
   *   - price:   Precio que aparece en <span class="price">
   */
  const PRODUCTS = [
    {
      img: 'img/producto1.jpg',
      name: 'Proximamente',
      desc: 'Proximamente',
      price: '$Proximamente USD'
    },
    {
      img: 'img/producto2.jpg',
      name: 'Proximamente',
      desc: 'Proximamente.',
      price: '$Proximamente USD'
    },
    {
      img: 'img/producto3.jpg',
      name: 'Proximamente',
      desc: 'Proximamente.',
      price: '$Proximamente USD'
    },
    {
      img: 'img/producto4.jpg',
      name: 'Proximamente',
      desc: 'Proximamente.',
      price: '$Proximamente USD'
    },
    {
      img: 'img/producto5.jpg',
      name: 'Proximamente',
      desc: 'Proximamente.',
      price: '$Proximamente USD'
    },
    // Si deseas agregar más productos, añade más objetos aquí:
    // {
    //   img: 'img/producto4.jpg',
    //   name: 'Nombre Producto 4',
    //   desc: 'Descripción Producto 4',
    //   price: '$20 USD'
    // }
  ];

  /**
   * Crea y anexa una tarjeta de producto al contenedor indicado.
   * @param {Object} product    { img, name, desc, price }
   * @param {HTMLElement} parent Contenedor donde se insertará la tarjeta
   * @param {number} index      Índice dentro de PRODUCTS (para scroll-delay si aplica)
   */
  function renderProductCard(product, parent, index) {
    const card = document.createElement('div');
    // Asignamos las clases: 'product-card' y 'fade-in'. Además, scroll-delay según índice.
    const delayClass = index < 9 ? `scroll-delay-${index + 1}` : '';
    card.className = `product-card fade-in ${delayClass}`;

    card.innerHTML = `
      <img src="${product.img}" alt="${product.name}" />
      <h3>${product.name}</h3>
      <p>${product.desc}</p>
      <span class="price">${product.price}</span>
      <button class="buy-btn">Buy Now</button>
    `;

    parent.appendChild(card);
  }

  // 1) Inyecta los primeros 2 productos en productsContainer
  PRODUCTS.slice(0, 2).forEach((product, idx) => {
    renderProductCard(product, productsContainer, idx);
  });

  // 2) Inyecta el resto en moreProductsContainer (oculto por defecto)
  PRODUCTS.slice(2).forEach((product, idx) => {
    renderProductCard(product, moreProductsContainer, idx + 2);
  });
  // moreProductsContainer arranca con class="more-content" (oculto por CSS).
  // Cuando se añada la clase "visible-content", se mostrará.

  // —————————————————————————————
  // 3) Alternar “+” / “−” para mostrar u ocultar extraProducts
  // —————————————————————————————
  loadMoreBtn.addEventListener('click', () => {
    console.log('Botón + fue clickeado');
    if (moreProductsContainer.classList.contains('visible-content')) {
      moreProductsContainer.classList.remove('visible-content');
      loadMoreBtn.textContent = '+';
    } else {
      moreProductsContainer.classList.add('visible-content');
      loadMoreBtn.textContent = '−';
    }
  });
});
