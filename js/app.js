import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './config.js';

const $=(s,p=document)=>p.querySelector(s), $$=(s,p=document)=>[...p.querySelectorAll(s)];
const esc=(v='')=>String(v).replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));
const money=(n,c='BDT')=>c==='BDT'?`৳${Number(n||0).toLocaleString('en-BD')}`:`${c} ${Number(n||0).toLocaleString()}`;
const slug=s=>String(s||'').toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const toast=m=>{const t=$('#toast');t.textContent=m;t.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove('show'),2200)};
const deepMerge=(base,extra)=>{if(extra===undefined||extra===null)return base;if(Array.isArray(extra))return extra;if(typeof extra!=='object')return extra;const out={...(base||{})};for(const [k,v] of Object.entries(extra))out[k]=(v&&typeof v==='object'&&!Array.isArray(v))?deepMerge(out[k],v):v;return out};

const defaults={
  brand:{store_name:'ALI FASHION',logo_url:'',favicon_url:'',announcement:'FREE DELIVERY ON SELECTED ORDERS · CASH ON DELIVERY AVAILABLE'},
  homepage:{
    version:2,
    nav:[
      {label:'MEN',type:'tag',value:'men'},{label:'WOMEN',type:'tag',value:'women'},{label:'KIDS',type:'tag',value:'kids'},
      {label:'FORMAL',type:'tag',value:'formal'},{label:'CASUAL',type:'tag',value:'casual'},{label:'NEW ARRIVAL',type:'new',value:''},
      {label:'LOAFER',type:'category',value:'loafer'},{label:'OXFORD',type:'category',value:'oxford'},{label:'SNEAKERS',type:'category',value:'sneakers'},
      {label:'FOOTBALL BOOT',type:'category',value:'football-boot'},{label:'CRICKET BOOT',type:'category',value:'cricket-boot'}
    ],
    hero:{eyebrow:'THE NEW FOOTWEAR EDIT',title:'Move better.|Look sharper.',text:'Everyday sneakers, polished formals and performance boots — selected for the way you actually live.',primary:'SHOP NEW ARRIVALS',secondary:'EXPLORE ALL',image_url:'',float_top:'NEW SEASON',float_title:'Designed for every step.',float_button:'View collection →',proof:[['COD','AVAILABLE'],['FAST','DELIVERY'],['EASY','SIZE SUPPORT']]},
    ticker:['MEN','WOMEN','KIDS','LOAFERS','OXFORDS','SNEAKERS','FOOTBALL BOOTS','CRICKET BOOTS'],
    categories_section:{eyebrow:'SHOP YOUR WAY',title:'Built around your day.',text:'From office-ready classics to match-day performance.'},
    products:{eyebrow:'FRESH PAIRS',title:'New arrivals'},
    editorial:{eyebrow:'ALI FASHION SELECTS',title:'One store.|Every occasion.',text:'Loafers for the office, sneakers for everyday, and boots built for the pitch. Find the right pair without the guesswork.',button:'DISCOVER THE COLLECTION',image_url:''},
    benefits:[['FAST DELIVERY','Quick dispatch on confirmed orders.'],['CASH ON DELIVERY','Pay when your order reaches you.'],['SIZE SUPPORT','Need help? We help you choose.'],['FRESH COLLECTION','New footwear added regularly.']],
    final:{eyebrow:'YOUR NEXT PAIR IS HERE',title:'Good shoes change the whole fit.',text:'Explore the latest ALI FASHION collection and order in a few taps.',button:'SHOP NOW'},
    footer:{text:'Footwear for work, weekends and game day.',links:[['New Arrival','new'],['Sneakers','category:sneakers'],['Loafers','category:loafer'],['Football Boots','category:football-boot']],copyright:'© 2026 ALI FASHION. ALL RIGHTS RESERVED.'}
  },
  ui:{cart_empty:'Your bag is empty. Add a pair you love.',order_success:'Order placed! Check your email for confirmation.',shipping_note:'Shipping is calculated at checkout.',add_to_cart:'ADD TO CART',sold_out:'SOLD OUT'},
  settings:{store_name:'ALI FASHION',currency:'BDT',shipping_fee:80,free_shipping_over:3000,phone:'',address:''}
};

let supabase=null,products=[],categories=[],content=structuredClone(defaults),activeFilter={type:'all',value:''},searchTerm='',sortMode='featured';
let cart=JSON.parse(localStorage.getItem('ali-fashion-cart-v2')||localStorage.getItem('ali-fashion-cart')||'[]');

async function loadSupabase(){for(const src of ['https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm','https://esm.sh/@supabase/supabase-js@2']){try{const m=await import(src);if(m.createClient){supabase=m.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);return}}catch(e){console.warn('Supabase CDN failed',src,e)}}}

async function loadStore(){
  await loadSupabase();
  if(supabase){
    try{
      const [ct,cats,prods]=await Promise.all([
        supabase.from('site_content').select('key,value'),
        supabase.from('categories').select('*').eq('is_active',true).order('sort_order'),
        supabase.from('products').select('*,categories(name,slug)').eq('is_active',true).order('sort_order').order('created_at',{ascending:false})
      ]);
      const rows=Object.fromEntries((ct.data||[]).map(x=>[x.key,x.value]));
      content.brand=deepMerge(defaults.brand,rows.brand||{});
      content.settings=deepMerge(defaults.settings,rows.settings||{});
      content.ui=deepMerge(defaults.ui,rows.ui||{});
      // Old v1 homepage content is intentionally ignored so this redesign appears immediately.
      content.homepage=Number(rows.homepage?.version)===2?deepMerge(defaults.homepage,rows.homepage):structuredClone(defaults.homepage);
      categories=(cats.data||[]).filter(c=>c.slug!=='gen-z');
      products=prods.data||[];
    }catch(e){console.warn('Using storefront fallback:',e.message)}
  }
  applyContent();renderMenu();renderCategories();renderFilters();renderProducts();renderCart();setupObservers();requestAnimationFrame(()=>$('#pageLoader').classList.add('hide'));
}

function applyContent(){
  const b=content.brand,h=content.homepage,s=content.settings;
  document.title=`${b.store_name||s.store_name||'ALI FASHION'} — Find Your Next Pair`;
  $('#announcement').textContent=b.announcement||defaults.brand.announcement;
  const logo=b.logo_url||'assets/logo.png';$('#brandLogo').src=logo;$('#footerLogo').src=logo;if(b.favicon_url)$('#dynamicFavicon').href=b.favicon_url;
  const hero=h.hero;
  $('#heroEyebrow').textContent=hero.eyebrow;setRichTitle($('#heroTitle'),hero.title);$('#heroText').textContent=hero.text;$('#heroPrimary').textContent=hero.primary;$('#heroSecondary').childNodes[0].textContent=hero.secondary+' ';
  $('#heroFloatTop').textContent=hero.float_top;$('#heroFloatTitle').textContent=hero.float_title;$('#heroFloatButton').textContent=hero.float_button;
  $('#heroProof').innerHTML=(hero.proof||[]).map(x=>`<div><strong>${esc(x[0])}</strong><span>${esc(x[1])}</span></div>`).join('');
  const heroFallback=(products.find(p=>p.featured&&p.images?.[0])||products.find(p=>p.images?.[0]))?.images?.[0]||'';setSectionImage($('#heroImage'),$('#heroPlaceholder'),hero.image_url||heroFallback);
  const ticker=(h.ticker||[]);const loop=[...ticker,...ticker];$('#tickerTrack').innerHTML=loop.map(x=>`<span>${esc(x)}</span>`).join('');
  $('#categoryEyebrow').textContent=h.categories_section.eyebrow;$('#categoryTitle').textContent=h.categories_section.title;$('#categoryText').textContent=h.categories_section.text;
  $('#productsEyebrow').textContent=h.products.eyebrow;$('#productsTitle').textContent=h.products.title;
  $('#editorialEyebrow').textContent=h.editorial.eyebrow;setRichTitle($('#editorialTitle'),h.editorial.title);$('#editorialText').textContent=h.editorial.text;$('#editorialButton').textContent=h.editorial.button;
  const editFallback=(products.filter(p=>p.images?.[0])[1]||products.find(p=>p.images?.[0]))?.images?.[0]||'';setImage($('#editorialImage'),h.editorial.image_url||editFallback);
  $('#benefits').innerHTML=(h.benefits||[]).map((x,i)=>`<div class="benefit scroll-fade"><i>${['↗','✓','?','＋'][i%4]}</i><b>${esc(x[0])}</b><span>${esc(x[1])}</span></div>`).join('');
  $('#finalEyebrow').textContent=h.final.eyebrow;$('#finalTitle').textContent=h.final.title;$('#finalText').textContent=h.final.text;$('#finalButton').textContent=h.final.button;
  $('#footerText').textContent=h.footer.text;$('#copyright').textContent=h.footer.copyright;$('#footerContact').textContent=[s.phone,s.address].filter(Boolean).join(' · ');
  $('#footerLinks').innerHTML=(h.footer.links||[]).map(x=>`<button data-footer-filter="${esc(x[1])}">${esc(x[0])}</button>`).join('');
  $('#shippingNote').textContent=content.ui.shipping_note||defaults.ui.shipping_note;
}
function setRichTitle(el,text=''){const parts=String(text).split('|');el.innerHTML=parts.map((p,i)=>i?`<em>${esc(p)}</em>`:esc(p)).join('<br>')}
function setSectionImage(img,placeholder,url){if(!url){img.removeAttribute('src');img.classList.remove('loaded');placeholder.classList.remove('hide');return}img.onload=()=>{img.classList.add('loaded');placeholder.classList.add('hide')};img.onerror=()=>{img.classList.remove('loaded');placeholder.classList.remove('hide')};img.src=url}
function setImage(img,url){if(!url){img.removeAttribute('src');return}img.onload=()=>img.classList.add('loaded');img.src=url}

function renderMenu(){
  const nav=content.homepage.nav||[];
  const desktop=nav.slice(0,7);const extra=nav.slice(7);
  $('#desktopMenu').innerHTML=desktop.map((n,i)=>menuButton(n,i)).join('')+(extra.length?`<div class="more-menu"><button class="more-trigger">MORE⌄</button><div class="more-pop">${extra.map((n,i)=>menuButton(n,i+7)).join('')}</div></div>`:'');
  $('#mobileMenuLinks').innerHTML=nav.map((n,i)=>menuButton(n,i)).join('');
  $$('[data-menu-index]').forEach(btn=>btn.onclick=()=>{const n=nav[Number(btn.dataset.menuIndex)];activateMenuItem(n);closeMobileMenu()});
}
function menuButton(n,i){return `<button data-menu-index="${i}">${esc(n.label||'Menu')}</button>`}
function activateMenuItem(n){
  if(n.type==='link'){if(String(n.value||'').startsWith('#'))document.querySelector(n.value)?.scrollIntoView({behavior:'smooth'});else if(n.value)location.href=n.value;return}
  activeFilter={type:n.type||'all',value:n.value||''};renderFilters();renderProducts();$('#shop').scrollIntoView({behavior:'smooth',block:'start'});
}
function openMobileMenu(){$('#mobileMenu').classList.add('open');$('#menuScrim').classList.add('show');document.body.style.overflow='hidden'}
function closeMobileMenu(){$('#mobileMenu').classList.remove('open');$('#menuScrim').classList.remove('show');document.body.style.overflow=''}

function desiredVirtualCategories(){return [
  {name:'LOAFER',slug:'loafer',description:'Smart, easy, everyday.'},{name:'OXFORD',slug:'oxford',description:'Polished formal classics.'},{name:'SNEAKERS',slug:'sneakers',description:'Daily comfort, clean style.'},{name:'FOOTBALL BOOT',slug:'football-boot',description:'Built for match day.'},{name:'CRICKET BOOT',slug:'cricket-boot',description:'Grip, balance, performance.'},{name:'KIDS',slug:'kids',description:'Comfort for little feet.'}
]}
function displayCategories(){
  const wanted=desiredVirtualCategories();
  return wanted.map(v=>categories.find(c=>c.slug===v.slug)||v).concat(categories.filter(c=>!wanted.some(v=>v.slug===c.slug)&&!['sale','new-arrival'].includes(c.slug))).slice(0,8);
}
function renderCategories(){
  $('#categoryStrip').innerHTML=displayCategories().map((c,i)=>`<button class="category-card scroll-fade" data-cat="${esc(c.slug)}"><div class="cat-bg" ${c.image_url?`style="background-image:url('${esc(c.image_url)}')"`:''}></div><span class="cat-arrow">↗</span><div class="cat-copy"><span>0${i+1} / COLLECTION</span><h3>${esc(c.name)}</h3></div></button>`).join('');
  $$('.category-card').forEach(b=>b.onclick=()=>{activeFilter={type:'category',value:b.dataset.cat};renderFilters();renderProducts();$('#shop').scrollIntoView({behavior:'smooth'})});
}
function renderFilters(){
  const base=[{label:'ALL',type:'all',value:''},{label:'NEW ARRIVAL',type:'new',value:''},{label:'MEN',type:'tag',value:'men'},{label:'WOMEN',type:'tag',value:'women'},{label:'KIDS',type:'tag',value:'kids'}];
  const cats=displayCategories().slice(0,6).map(c=>({label:c.name,type:'category',value:c.slug}));
  const list=[...base,...cats].filter((x,i,a)=>a.findIndex(y=>y.label===x.label)===i);
  $('#filterPills').innerHTML=list.map((x,i)=>`<button data-filter="${i}" class="${sameFilter(x,activeFilter)?'active':''}">${esc(x.label)}</button>`).join('');
  $$('#filterPills button').forEach(b=>b.onclick=()=>{const x=list[Number(b.dataset.filter)];activeFilter={type:x.type,value:x.value};renderFilters();renderProducts()});
}
function sameFilter(a,b){return a.type===b.type&&String(a.value||'')===String(b.value||'')}
function productHitsFilter(p){
  const type=activeFilter.type,value=slug(activeFilter.value),tags=(p.tags||[]).map(slug),cat=slug(p.categories?.slug||'');
  if(type==='all')return true;if(type==='new')return !!p.is_new;if(type==='category')return cat===value||tags.includes(value);if(type==='tag')return tags.includes(value)||cat===value;return true;
}
function filteredProducts(){
  const q=searchTerm.trim().toLowerCase();let arr=products.filter(p=>productHitsFilter(p)&&(!q||`${p.name} ${p.sku||''} ${p.short_description||''} ${(p.tags||[]).join(' ')} ${p.categories?.name||''}`.toLowerCase().includes(q)));
  if(sortMode==='newest')arr.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
  else if(sortMode==='low')arr.sort((a,b)=>Number(a.price)-Number(b.price));else if(sortMode==='high')arr.sort((a,b)=>Number(b.price)-Number(a.price));
  else arr.sort((a,b)=>(Number(b.featured)-Number(a.featured))||(Number(a.sort_order||0)-Number(b.sort_order||0)));
  return arr;
}
function imageMarkup(p){const url=p.images?.[0];return url?`<img src="${esc(url)}" alt="${esc(p.name)}" loading="lazy">`:'<div class="product-placeholder"></div>'}
function renderProducts(){
  const arr=filteredProducts();$('#emptyProducts').classList.toggle('hidden',arr.length>0);
  $('#productGrid').innerHTML=arr.map(p=>`<article class="product-card scroll-fade" data-id="${p.id}"><div class="product-media">${imageMarkup(p)}${p.badge||p.is_new?`<span class="product-badge">${esc(p.badge||'NEW')}</span>`:''}<button class="quick-button" data-quick="${p.id}" aria-label="Quick add">＋</button></div><div class="product-info"><div class="product-info-row"><div><h3>${esc(p.name)}</h3><div class="product-category">${esc(p.categories?.name||p.short_description||'ALI FASHION')}</div></div><div class="product-price">${money(p.price,content.settings.currency)}${p.compare_at_price?`<span class="old-price">${money(p.compare_at_price,content.settings.currency)}</span>`:''}</div></div></div></article>`).join('');
  $$('.product-card').forEach(card=>card.onclick=e=>{if(e.target.closest('[data-quick]'))return;card.classList.add('pressed');setTimeout(()=>{card.classList.remove('pressed');openProduct(card.dataset.id)},155)});
  $$('[data-quick]').forEach(b=>b.onclick=e=>{e.stopPropagation();quickAdd(b.dataset.quick)});observeNew();
}
function getProduct(id){return products.find(p=>String(p.id)===String(id))}
function quickAdd(id){const p=getProduct(id);if(!p)return;addToCart(p,p.sizes?.[0]||'',p.colors?.[0]||'')}
function openProduct(id){
  const p=getProduct(id);if(!p)return;const sizes=p.sizes||[],colors=p.colors||[];
  $('#productModalBody').innerHTML=`<div class="product-modal-layout"><div class="modal-media">${imageMarkup(p)}</div><div class="modal-details"><p class="kicker">${esc(p.badge||p.categories?.name||'ALI FASHION')}</p><h3>${esc(p.name)}</h3><div class="modal-price">${money(p.price,content.settings.currency)} ${p.compare_at_price?`<span class="old-price">${money(p.compare_at_price,content.settings.currency)}</span>`:''}</div><p class="modal-desc">${esc(p.description||p.short_description||'')}</p><div class="variant-grid">${sizes.length?`<label>Size<select id="modalSize">${sizes.map(x=>`<option>${esc(x)}</option>`).join('')}</select></label>`:''}${colors.length?`<label>Color<select id="modalColor">${colors.map(x=>`<option>${esc(x)}</option>`).join('')}</select></label>`:''}</div><button class="button button-red full" id="modalAdd" ${Number(p.stock)===0?'disabled':''}>${Number(p.stock)===0?esc(content.ui.sold_out):esc(content.ui.add_to_cart)}</button><div class="stock-note">${Number(p.stock)>0?`${Number(p.stock)} in stock · Cash on delivery available`:'Currently out of stock'}</div></div></div>`;
  $('#productModal').classList.add('show');document.body.style.overflow='hidden';$('#modalAdd').onclick=()=>{addToCart(p,$('#modalSize')?.value||'',$('#modalColor')?.value||'');closeProductModal()};
}
function closeProductModal(){$('#productModal').classList.remove('show');document.body.style.overflow=''}

function cartKey(x){return `${x.product_id}|${x.size||''}|${x.color||''}`}
function addToCart(p,size,color){const item={product_id:p.id,name:p.name,price:Number(p.price),image:p.images?.[0]||'',size,color,qty:1};const f=cart.find(x=>cartKey(x)===cartKey(item));if(f)f.qty++;else cart.push(item);saveCart();toast(`${p.name} added to cart`);openCart()}
function saveCart(){localStorage.setItem('ali-fashion-cart-v2',JSON.stringify(cart));renderCart()}
function renderCart(){
  const count=cart.reduce((s,x)=>s+x.qty,0),sub=cart.reduce((s,x)=>s+x.price*x.qty,0);$('#cartCount').textContent=count;$('#cartCountDrawer').textContent=count;$('#cartSubtotal').textContent=money(sub,content.settings.currency);
  $('#cartItems').innerHTML=cart.length?cart.map((x,i)=>`<div class="cart-item"><div class="cart-thumb">${x.image?`<img src="${esc(x.image)}" alt="">`:'👟'}</div><div><h4>${esc(x.name)}</h4><p>${esc([x.size&&`Size ${x.size}`,x.color&&x.color].filter(Boolean).join(' · '))}</p><strong>${money(x.price,content.settings.currency)}</strong><div class="qty"><button data-qty="${i}" data-d="-1">−</button><span>${x.qty}</span><button data-qty="${i}" data-d="1">＋</button></div></div><button class="cart-remove" data-remove="${i}">×</button></div>`).join(''):`<div class="empty-state">${esc(content.ui.cart_empty)}</div>`;
  $$('[data-qty]').forEach(b=>b.onclick=()=>{const i=+b.dataset.qty;cart[i].qty+=+b.dataset.d;if(cart[i].qty<1)cart.splice(i,1);saveCart()});$$('[data-remove]').forEach(b=>b.onclick=()=>{cart.splice(+b.dataset.remove,1);saveCart()});updateCheckoutTotal();
}
function openCart(){$('#cartDrawer').classList.add('open');$('#cartScrim').classList.add('show');document.body.style.overflow='hidden'}
function closeCart(){$('#cartDrawer').classList.remove('open');$('#cartScrim').classList.remove('show');document.body.style.overflow=''}
function shippingFor(sub){const s=content.settings;return Number(s.free_shipping_over)>0&&sub>=Number(s.free_shipping_over)?0:Number(s.shipping_fee||0)}
function updateCheckoutTotal(){const sub=cart.reduce((s,x)=>s+x.price*x.qty,0);$('#checkoutTotal').textContent=money(sub+shippingFor(sub),content.settings.currency)}

function setFilterString(v){if(v==='new')activeFilter={type:'new',value:''};else if(v?.includes(':')){const [type,value]=v.split(':');activeFilter={type,value}}else activeFilter={type:'all',value:''};renderFilters();renderProducts();$('#shop').scrollIntoView({behavior:'smooth'})}

function setupEvents(){
  $('#mobileMenuButton').onclick=openMobileMenu;$('#mobileMenuClose').onclick=closeMobileMenu;$('#menuScrim').onclick=closeMobileMenu;
  $('#searchButton').onclick=()=>{$('#searchOverlay').classList.add('show');setTimeout(()=>$('#searchInput').focus(),150)};$('#searchClose').onclick=()=>$('#searchOverlay').classList.remove('show');$('#searchOverlay').onclick=e=>{if(e.target.id==='searchOverlay')$('#searchOverlay').classList.remove('show')};
  $('#searchInput').oninput=e=>{searchTerm=e.target.value;renderProducts();if(searchTerm)$('#shop').scrollIntoView({behavior:'smooth'})};
  $('#cartButton').onclick=openCart;$('#cartClose').onclick=closeCart;$('#cartScrim').onclick=closeCart;
  $('#productModalClose').onclick=closeProductModal;$('#productModal').onclick=e=>{if(e.target.id==='productModal')closeProductModal()};
  $('#checkoutClose').onclick=()=>{$('#checkoutModal').classList.remove('show');document.body.style.overflow=''};
  $('#checkoutButton').onclick=()=>{if(!cart.length)return toast('Your bag is empty');closeCart();updateCheckoutTotal();$('#checkoutModal').classList.add('show');document.body.style.overflow='hidden'};
  $('#checkoutModal').onclick=e=>{if(e.target.id==='checkoutModal'){$('#checkoutModal').classList.remove('show');document.body.style.overflow=''}};
  $('#heroPrimary').onclick=()=>{activeFilter={type:'new',value:''};renderFilters();renderProducts();$('#shop').scrollIntoView({behavior:'smooth'})};$('#heroSecondary').onclick=()=>{activeFilter={type:'all',value:''};renderFilters();renderProducts();$('#shop').scrollIntoView({behavior:'smooth'})};$('#heroFloatButton').onclick=$('#heroSecondary').onclick;$('#editorialButton').onclick=$('#heroSecondary').onclick;$('#finalButton').onclick=$('#heroPrimary').onclick;
  $('#filterToggle').onclick=()=>{$('#filterBar').classList.toggle('open');$('#filterToggle span').textContent=$('#filterBar').classList.contains('open')?'−':'＋'};$('#sortSelect').onchange=e=>{sortMode=e.target.value;renderProducts()};
  $('#checkoutForm').onsubmit=placeOrder;
  window.addEventListener('scroll',()=>{$('#siteHeader').classList.toggle('compact',scrollY>45);if(innerWidth>860){const img=$('#heroImage');if(img.classList.contains('loaded'))img.style.transform=`scale(1.03) translateY(${Math.min(scrollY*.035,18)}px)`}},{passive:true});
  document.addEventListener('click',e=>{const b=e.target.closest('[data-footer-filter]');if(b)setFilterString(b.dataset.footerFilter)});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeMobileMenu();closeCart();closeProductModal();$('#searchOverlay').classList.remove('show')}});
}

async function placeOrder(e){
  e.preventDefault();if(!cart.length)return;const fd=new FormData(e.currentTarget);if(fd.get('website'))return;const btn=$('#placeOrderButton'),status=$('#formStatus');btn.disabled=true;btn.textContent='PLACING ORDER…';status.textContent='';
  try{
    if(!supabase)throw new Error('Store connection is not ready.');
    const customer={name:fd.get('name'),email:fd.get('email'),phone:fd.get('phone'),city:fd.get('city'),address:fd.get('address'),note:fd.get('note')};const items=cart.map(x=>({product_id:x.product_id,qty:x.qty,size:x.size,color:x.color}));
    const {data,error}=await supabase.functions.invoke('place-order',{body:{customer,items}});if(error)throw error;if(!data?.ok)throw new Error(data?.error||'Could not place order');
    cart=[];saveCart();e.currentTarget.reset();$('#checkoutModal').classList.remove('show');document.body.style.overflow='';toast(`${content.ui.order_success} #${data.order_no}`);
  }catch(err){console.error(err);status.textContent='Order could not be submitted. Please try again or contact the store.'}finally{btn.disabled=false;btn.textContent='PLACE ORDER'}
}

let observer;
function setupObservers(){observer=new IntersectionObserver(entries=>entries.forEach(x=>{if(x.isIntersecting){x.target.classList.add('in');observer.unobserve(x.target)}}),{threshold:.08,rootMargin:'0px 0px -25px 0px'});observeNew()}
function observeNew(){$$('.reveal-up:not(.in),.reveal-scale:not(.in),.scroll-fade:not(.in)').forEach(x=>observer?.observe(x))}

setupEvents();loadStore();
