let editions = [];
const $ = id => document.getElementById(id);
function element(tag, value, className) { const item = document.createElement(tag); item.textContent = value; if (className) item.className = className; return item; }
function render() {
  const query = $('search').value.trim().toLocaleLowerCase('id');
  const selected = editions.filter(book => `${book.title} ${book.id}`.toLocaleLowerCase('id').includes(query) && (!$('status').value || book.status === $('status').value) && (!$('locale').value || book.locale === $('locale').value));
  $('count').textContent = `${selected.length} edisi`;
  $('books').replaceChildren();
  for (const book of selected) {
    const row = element('button', '', 'book');
    if (book.cover) { const image = document.createElement('img'); image.src = book.cover; image.alt = ''; image.className = 'cover'; row.append(image); }
    const copy = element('div', '', 'copy');
    copy.append(element('strong', book.title), element('span', `${book.locale.toUpperCase()} · revisi ${book.revision} · ${book.nodes.length} bagian`));
    row.append(copy, element('span', book.status === 'published' ? 'Terbit' : book.status === 'bundled' ? 'Bawaan Android' : 'Draf', 'badge'), element('span', book.offline ? 'Offline' : 'Online', 'badge'));
    row.addEventListener('click', () => showBook(book));
    $('books').append(row);
  }
  if (!selected.length) $('books').append(element('p', 'Tidak ada buku yang cocok.'));
}
function showBook(book) {
  $('detail-title').textContent = book.title;
  $('metadata').textContent = `${book.locale.toUpperCase()} · revisi ${book.revision} · ${book.rights}`;
  $('description').textContent = book.description;
  $('source').textContent = book.file;
  $('toc').replaceChildren(); $('chapter-title').textContent = ''; $('preview').textContent = '';
  const showNode = node => { $('chapter-title').textContent = node.title; $('preview').textContent = node.error || node.preview; };
  for (const node of book.nodes) {
    const button = element('button', `${node.title}${node.readingDate ? ` · ${node.readingDate}` : ''}`);
    button.addEventListener('click', () => { $('toc').querySelectorAll('button').forEach(item => item.removeAttribute('aria-current')); button.setAttribute('aria-current', 'true'); showNode(node); });
    $('toc').append(button);
  }
  $('toc').firstElementChild?.click();
  $('detail').showModal();
}
async function refresh() {
  $('refresh').disabled = true; $('health').textContent = 'Memeriksa katalog…';
  try {
    const response = await fetch('/api/books'); const data = await response.json();
    if (!response.ok) throw Error(data.error || 'Katalog tidak dapat dimuat.');
    editions = data.editions; render();
    $('health').className = data.validation.ok ? 'healthy' : 'problem';
    $('health').textContent = data.validation.ok ? `Valid · ${data.validation.published} edisi siap distribusi` : data.validation.message;
  } catch (error) { $('health').className = 'problem'; $('health').textContent = error.message; }
  finally { $('refresh').disabled = false; }
}
['search', 'status', 'locale'].forEach(id => $(id).addEventListener('input', render));
$('refresh').addEventListener('click', refresh);
$('close').addEventListener('click', () => $('detail').close());
refresh();
