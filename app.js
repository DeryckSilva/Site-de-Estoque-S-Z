const inventory = [
  { name: 'Kit Sensor S-200', sku: 'SKU-20481', category: 'Sensores', available: 348, reorder: 100, status: 'ok', label: 'Em estoque' },
  { name: 'Central C-450', sku: 'SKU-10932', category: 'Centrais', available: 62, reorder: 80, status: 'low', label: 'Estoque baixo' },
  { name: 'Modulo M-10', sku: 'SKU-77320', category: 'Modulos', available: 214, reorder: 50, status: 'ok', label: 'Em estoque' },
  { name: 'Placa P-80', sku: 'SKU-55018', category: 'Componentes', available: 0, reorder: 35, status: 'out', label: 'Sem estoque' },
  { name: 'Carcaca ABS 4U', sku: 'SKU-44872', category: 'Estruturas', available: 41, reorder: 30, status: 'ok', label: 'Em estoque' },
  { name: 'Cabo blindado 2m', sku: 'SKU-91104', category: 'Componentes', available: 18, reorder: 40, status: 'low', label: 'Estoque baixo' }
];

let orders = [
  { id: '#OP-1023', product: 'Central C-450', quantity: 20, date: 'Amanha, 10:30', status: 'waiting' },
  { id: '#OP-1024', product: 'Kit Sensor S-200', quantity: 45, date: 'Hoje, 16:00', status: 'progress' },
  { id: '#OP-1022', product: 'Modulo M-10', quantity: 30, date: '21 set, 09:00', status: 'done' },
  { id: '#OP-1021', product: 'Placa P-80', quantity: 12, date: '22 set, 14:00', status: 'waiting' }
];

const views = { overview: 'Visao geral', inventory: 'Estoque', orders: 'Ordens de producao' };
const pageTitle = document.querySelector('#page-title');
const heroTitle = document.querySelector('#hero-title');
const toast = document.querySelector('#toast');

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  window.setTimeout(() => toast.classList.remove('show'), 2600);
}

function switchView(view) {
  document.querySelectorAll('.view').forEach((element) => element.classList.remove('active-view'));
  document.querySelector(`#${view}-view`)?.classList.add('active-view');
  document.querySelectorAll('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.view === view));
  pageTitle.textContent = views[view] || views.overview;
  if (view === 'overview') {
    heroTitle.innerHTML = 'Bom dia, Déryck <span>✦</span>';
  } else {
    heroTitle.textContent = views[view];
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.querySelectorAll('.nav-item[data-view], [data-view-target]').forEach((button) => {
  button.addEventListener('click', () => switchView(button.dataset.view || button.dataset.viewTarget));
});

function renderInventory() {
  const query = document.querySelector('#inventory-search').value.toLowerCase();
  const filter = document.querySelector('#stock-filter').value;
  const rows = inventory.filter((item) => {
    const matchesQuery = `${item.name} ${item.sku} ${item.category}`.toLowerCase().includes(query);
    return matchesQuery && (filter === 'all' || item.status === filter);
  });
  document.querySelector('#inventory-rows').innerHTML = rows.map((item) => `<div class="table-row"><span class="item-title">${item.name}<small class="sku">${item.sku}</small></span><span>${item.category}</span><span class="stock-number">${item.available}</span><span>${item.reorder} un.</span><span class="status-pill status-${item.status}">${item.label}</span></div>`).join('') || '<div class="empty-row">Nenhum item encontrado.</div>';
}

document.querySelector('#inventory-search').addEventListener('input', renderInventory);
document.querySelector('#stock-filter').addEventListener('change', renderInventory);

function orderCard(order) {
  return `<article class="kanban-card"><h3>${order.product}</h3><p>${order.id} · ${order.quantity} unidades</p><div class="card-meta"><span>Entrega</span><strong>${order.date}</strong></div></article>`;
}

function renderOrders() {
  const columns = { waiting: 'waiting-orders', progress: 'progress-orders', done: 'done-orders' };
  Object.entries(columns).forEach(([status, id]) => {
    const matching = orders.filter((order) => order.status === status);
    document.querySelector(`#${id}`).innerHTML = matching.map(orderCard).join('');
    document.querySelector(`#${status}-count`).textContent = matching.length;
  });
}

const modal = document.querySelector('#order-modal');
function openModal() { modal.classList.add('open'); document.querySelector('#new-date').value = new Date().toISOString().slice(0, 10); }
function closeModal() { modal.classList.remove('open'); }
document.querySelectorAll('#new-order-button, #new-order-button-2').forEach((button) => button.addEventListener('click', openModal));
document.querySelector('#modal-close').addEventListener('click', closeModal);
modal.addEventListener('click', (event) => { if (event.target === modal) closeModal(); });

document.querySelector('#order-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const product = document.querySelector('#new-product').value;
  const quantity = document.querySelector('#new-quantity').value;
  orders.unshift({ id: `#OP-${1025 + orders.length}`, product, quantity, date: 'A definir', status: 'waiting' });
  renderOrders();
  closeModal();
  switchView('orders');
  showToast('Ordem criada e adicionada à fila.');
});

document.querySelector('.icon-button').addEventListener('click', () => showToast('Você não tem novas notificações.'));
document.querySelector('.help-link').addEventListener('click', () => showToast('Central de ajuda em breve.'));
renderInventory();
renderOrders();
