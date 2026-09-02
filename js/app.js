import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './config.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const $ = (s, p=document) => p.querySelector(s);
const $$ = (s, p=document) => [...p.querySelectorAll(s)];
const esc = (v='') => String(v).replace(/[&<>'"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));
const deepMerge=(base,extra)=>{if(!extra||typeof extra!=='object'||Array.isArray(extra))return extra??base;const out={...(base||{})};for(const [k,v] of Object.entries(extra)){out[k]=(v&&typeof v==='object'&&!Array.isArray(v))?deepMerge(out[k],v):v;}return out;};
const money = (n, currency='BDT') => currency === 'BDT' ? `৳${Number(n||0).toLocaleString('en-BD')}` : `${currency} ${Number(n||0).toLocaleString()}`;
const toast = (msg) => { const t=$('#toast'); t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),2200); };

const defaults = {
  brand:{store_name:'ALI FASHION',logo_url:'',favicon_url:'',announcement:'FREE DELIVERY ON SELECTED DROPS · CASH ON DELIVERY AVAILABLE'},
  homepage:{
    nav:[{label:'NEW ARRIVAL',href:'#shop'},{label:'GEN-Z',href:'#genz'},{label:'SNEAKERS',href:'#shop'},{label:'KIDS',href:'#shop'}],
    hero:{eyebrow:'NEW DROP / 26',title:'STEP INTO|YOUR ERA.',text:'Street-ready sneakers and everyday pairs built for the main character in you.',primary:'SHOP THE DROP',secondary:'EXPLORE GEN-Z',stage_tag:'ALI / 001',stage_price:'DROP CULTURE',pill1:'3D ENERGY',pill2:'GEN-Z FIT',stats:[['100%','AUTHENTIC VIBE'],['24/7','ORDER ANYTIME'],['FAST','DHAKA DELIVERY']]},
    categories_section:{eyebrow:'PICK YOUR MOOD',title:'Shop by vibe.',text:'Fresh rotation. Zero boring pairs.'},
    products:{eyebrow:'LATEST HEAT',title:'New arrivals.'},
    genz:{eyebrow:'GEN-Z EDIT',title:'Not made to blend in.',text:'Chunky proportions, sharp details, fearless colors. Curated for people who dress like the algorithm is watching.',button:'FIND YOUR PAIR'},
    trust:[['FAST DELIVERY','Quick dispatch on confirmed orders.'],['CASH ON DELIVERY','Pay when your order reaches you.'],['SIZE SUPPORT','Message us if you need help choosing.'],['FRESH DROPS','New footwear added regularly.']],
    newsletter:{eyebrow:"DON'T MISS THE DROP",title:'Your inbox deserves better shoes.',text:'Follow our latest arrivals and limited drops.',button:'SHOP NOW'},
    footer:{text:'Footwear for your next era.',links:[['New Arrival','#shop'],['GEN-Z','#genz'],['Cart','#cart'],['Contact','#contact']],copyright:'© 2026 ALI FASHION. ALL RIGHTS RESERVED.'}
  },
  ui:{add_to_cart:'ADD TO CART',select_size:'Size',select_color:'Color',sold_out:'SOLD OUT',cart_empty:'Your cart is waiting for a first pair.',empty_products:'No products in this drop yet. Come back soon.',order_success:'Order placed! Check your email for confirmation.',search_placeholder:'Search your next pair…',cart_eyebrow:'YOUR ROTATION',cart_title:'Cart',subtotal:'Subtotal',shipping_note:'Shipping is calculated at checkout.',checkout_button:'CHECKOUT',checkout_eyebrow:'SECURE CHECKOUT',checkout_title:'Complete your order',name_label:'Full name',email_label:'Email',phone_label:'Phone',city_label:'City',address_label:'Delivery address',note_label:'Order note',optional_label:'(optional)',estimated_total:'Estimated total',place_order:'PLACE ORDER',placing_order:'PLACING ORDER…'},
  settings:{store_name:'ALI FASHION',currency:'BDT',shipping_fee:80,free_shipping_over:3000,owner_email:'',phone:'',address:''}
};

let content = structuredClone(defaults);
let categories = [];
let products = [];
let activeFilter = 'all';
let cart = JSON.parse(localStorage.getItem('ali-fashion-cart') || '[]');
let searchTerm = '';

async function loadStore(){
  try{
    const [{data:contentRows,error:contentErr},{data:catRows,error:catErr},{data:prodRows,error:prodErr}] = await Promise.all([
      supabase.from('site_content').select('key,value'),
      supabase.from('categories').select('*').eq('is_active',true).order('sort_order'),
      supabase.from('products').select('*,categories(name,slug)').eq('is_active',true).order('created_at',{ascending:false})
    ]);
    if(contentErr) throw contentErr;
    (contentRows||[]).forEach(r => { if(r.key in content) content[r.key] = deepMerge(content[r.key], r.value); else content[r.key]=r.value; });
    if(!catErr) categories = catRows || [];
    if(!prodErr) products = prodRows || [];
  } catch(err){ console.warn('Store loaded with fallback content:', err.message); }
  applyContent(); renderCategories(); renderFilters(); renderProducts(); renderCart(); setupReveal();
}

function applyContent(){
  const b=content.brand||defaults.brand,h=content.homepage||defaults.homepage,s=content.settings||defaults.settings;
  document.title=`${b.store_name||s.store_name||'ALI FASHION'} — Step Into Your Era`;
  $('#announcement').textContent=b.announcement||defaults.brand.announcement;
  const logo=b.logo_url||'assets/logo.png'; $('#brandLogo').src=logo; $('#footerLogo').src=logo;
  if(b.favicon_url) $('#dynamic-favicon').href=b.favicon_url;
  $('#navLinks').innerHTML=(h.nav||[]).map(n=>`<a href="${esc(n.href||'#shop')}">${esc(n.label)}</a>`).join('');
  const hero=h.hero||{}; $('#heroEyebrow').textContent=hero.eyebrow||''; $('#heroTitle').innerHTML=esc(hero.title||'').replace('|','<br><em>')+(String(hero.title||'').includes('|')?'</em>':''); $('#heroText').textContent=hero.text||''; $('#heroPrimary').textContent=hero.primary||'SHOP'; $('#heroSecondary').textContent=hero.secondary||'EXPLORE'; $('#stagePrice').textContent=hero.stage_price||'';
  $('#heroStats').innerHTML=(hero.stats||[]).map(x=>`<div><strong>${esc(x[0])}</strong><span>${esc(x[1])}</span></div>`).join('');
  $('#stageTag').textContent=hero.stage_tag||''; $('#heroPill1').textContent=hero.pill1||''; $('#heroPill2').textContent=hero.pill2||''; const cs=h.categories_section||{}; $('#categoryEyebrow').textContent=cs.eyebrow||''; $('#categoryTitle').textContent=cs.title||''; $('#categoryText').textContent=cs.text||''; $('#productsEyebrow').textContent=h.products?.eyebrow||''; $('#productsTitle').textContent=h.products?.title||'';
  $('#genzEyebrow').textContent=h.genz?.eyebrow||''; $('#genzTitle').textContent=h.genz?.title||''; $('#genzText').textContent=h.genz?.text||''; $('#genzButton').textContent=h.genz?.button||'';
  $('#trustRow').innerHTML=(h.trust||[]).map(t=>`<div class="trust-card reveal"><strong>${esc(t[0])}</strong><span>${esc(t[1])}</span></div>`).join('');
  $('#newsletterEyebrow').textContent=h.newsletter?.eyebrow||''; $('#newsletterTitle').textContent=h.newsletter?.title||''; $('#newsletterText').textContent=h.newsletter?.text||''; $('#newsletterButton').textContent=h.newsletter?.button||'';
  $('#footerText').textContent=h.footer?.text||''; $('#footerLinks').innerHTML=(h.footer?.links||[]).map(l=>`<a href="${esc(l[1])}">${esc(l[0])}</a>`).join(''); $('#copyright').textContent=h.footer?.copyright||'';
  const ui=content.ui||defaults.ui; $('#emptyProducts').textContent=ui.empty_products||defaults.ui.empty_products; $('#searchInput').placeholder=ui.search_placeholder||defaults.ui.search_placeholder; $('#cartEyebrow').textContent=ui.cart_eyebrow||''; $('#cartTitle').textContent=ui.cart_title||''; $('#subtotalLabel').textContent=ui.subtotal||''; $('#shippingNote').textContent=ui.shipping_note||''; $('#checkoutBtn').textContent=ui.checkout_button||''; $('#checkoutEyebrow').textContent=ui.checkout_eyebrow||''; $('#checkoutTitle').textContent=ui.checkout_title||''; $('#nameLabel').textContent=ui.name_label||''; $('#emailLabel').textContent=ui.email_label||''; $('#phoneLabel').textContent=ui.phone_label||''; $('#cityLabel').textContent=ui.city_label||''; $('#addressLabel').textContent=ui.address_label||''; $('#noteLabel').textContent=ui.note_label||''; $('#optionalLabel').textContent=ui.optional_label||''; $('#estimatedTotalLabel').textContent=ui.estimated_total||''; $('#placeOrderBtn').textContent=ui.place_order||'PLACE ORDER'; const marq=`${b.store_name||'ALI FASHION'} ✦ NEW ARRIVAL ✦ OWN THE STREET ✦ GEN-Z DROP ✦ `; $('#marqueeText').textContent=marq.repeat(5);
}

function renderCategories(){
  const el=$('#categoryGrid');
  const cats = categories.length ? categories.slice(0,8) : [
    {name:'NEW ARRIVAL',slug:'new-arrival',description:'Fresh out the box.'},{name:'GEN-Z',slug:'gen-z',description:'Loud. Clean. Current.'},{name:'SNEAKERS',slug:'sneakers',description:'Daily rotation.'},{name:'KIDS',slug:'kids',description:'Little feet, big energy.'}
  ];
  el.innerHTML=cats.map(c=>`<article class="category-card reveal" data-category="${esc(c.slug)}"><div class="cat-img" ${c.image_url?`style="background-image:url('${esc(c.image_url)}')"`:''}></div><h3>${esc(c.name)}</h3><p>${esc(c.description||'Explore the drop →')}</p></article>`).join('');
  $$('.category-card',el).forEach(card=>card.onclick=()=>{activeFilter=card.dataset.category; renderFilters();renderProducts();$('#shop').scrollIntoView();});
}

function renderFilters(){
  const common=[{name:'ALL',slug:'all'},...categories.slice(0,5).map(c=>({name:c.name,slug:c.slug}))];
  $('#filterPills').innerHTML=common.map(c=>`<button class="${activeFilter===c.slug?'active':''}" data-filter="${esc(c.slug)}">${esc(c.name)}</button>`).join('');
  $$('#filterPills button').forEach(b=>b.onclick=()=>{activeFilter=b.dataset.filter;renderFilters();renderProducts();});
}
function filteredProducts(){return products.filter(p=>{
  const hitCat=activeFilter==='all'||p.categories?.slug===activeFilter||(activeFilter==='new-arrival'&&p.is_new)||(activeFilter==='gen-z'&&String(p.tags||'').toLowerCase().includes('gen-z'));
  const q=searchTerm.toLowerCase(); const hitSearch=!q||`${p.name} ${p.sku||''} ${p.short_description||''}`.toLowerCase().includes(q); return hitCat&&hitSearch;
});}
function imageMarkup(p, cls=''){const url=(p.images||[])[0];return url?`<img class="${cls}" src="${esc(url)}" alt="${esc(p.name)}" loading="lazy">`:`<div class="placeholder-shoe"></div>`;}
function renderProducts(){
  const arr=filteredProducts(); $('#emptyProducts').classList.toggle('hidden',arr.length>0);
  $('#productGrid').innerHTML=arr.map(p=>`<article class="product-card reveal" data-id="${p.id}"><div class="product-media">${imageMarkup(p)}${p.badge?`<span class="badge">${esc(p.badge)}</span>`:(p.is_new?'<span class="badge">NEW</span>':'')}</div><div class="product-info"><h3>${esc(p.name)}</h3><div class="meta">${esc(p.categories?.name||p.short_description||'ALI FASHION')}</div><div class="price-row"><div><span class="price">${money(p.price,content.settings?.currency)}</span>${p.compare_at_price?`<span class="old-price">${money(p.compare_at_price,content.settings?.currency)}</span>`:''}</div><button class="quick-add" data-quick="${p.id}" aria-label="Add to cart">+</button></div></div></article>`).join('');
  $$('.product-card').forEach(card=>card.onclick=(e)=>{if(e.target.closest('[data-quick]'))return;openProduct(card.dataset.id)});
  $$('[data-quick]').forEach(b=>b.onclick=(e)=>{e.stopPropagation();quickAdd(b.dataset.quick)}); setupReveal();
}
function getProduct(id){return products.find(p=>String(p.id)===String(id));}
function quickAdd(id){const p=getProduct(id);if(!p)return; const size=(p.sizes||[])[0]||'',color=(p.colors||[])[0]||'';addToCart(p,size,color);}
function openProduct(id){const p=getProduct(id);if(!p)return; const sizes=p.sizes||[],colors=p.colors||[]; $('#productModalBody').innerHTML=`<div class="product-modal-layout"><div class="modal-product-image">${imageMarkup(p)}</div><div><p class="eyebrow">${esc(p.badge||p.categories?.name||'ALI FASHION')}</p><h3>${esc(p.name)}</h3><div class="price">${money(p.price,content.settings?.currency)} ${p.compare_at_price?`<span class="old-price">${money(p.compare_at_price,content.settings?.currency)}</span>`:''}</div><p class="desc">${esc(p.description||p.short_description||'')}</p><div class="select-row">${sizes.length?`<label>${esc(content.ui?.select_size||'Size')}<select id="modalSize">${sizes.map(x=>`<option>${esc(x)}</option>`).join('')}</select></label>`:''}${colors.length?`<label>${esc(content.ui?.select_color||'Color')}<select id="modalColor">${colors.map(x=>`<option>${esc(x)}</option>`).join('')}</select></label>`:''}</div><button class="btn primary full" id="modalAdd" ${Number(p.stock)===0?'disabled':''}>${Number(p.stock)===0?esc(content.ui?.sold_out||'SOLD OUT'):esc(content.ui?.add_to_cart||'ADD TO CART')}</button></div></div>`;
  $('#productModal').classList.add('show'); $('#modalAdd').onclick=()=>{addToCart(p,$('#modalSize')?.value||'',$('#modalColor')?.value||'');$('#productModal').classList.remove('show');};
}
function cartKey(x){return `${x.product_id}|${x.size||''}|${x.color||''}`;}
function addToCart(p,size,color){const next={product_id:p.id,name:p.name,price:Number(p.price),image:(p.images||[])[0]||'',size,color,qty:1};const found=cart.find(x=>cartKey(x)===cartKey(next));if(found)found.qty++;else cart.push(next);saveCart();toast(`${p.name} added to cart`);}
function saveCart(){localStorage.setItem('ali-fashion-cart',JSON.stringify(cart));renderCart();}
function renderCart(){
  $('#cartCount').textContent=cart.reduce((s,x)=>s+x.qty,0); const sub=cart.reduce((s,x)=>s+x.price*x.qty,0); $('#cartSubtotal').textContent=money(sub,content.settings?.currency);
  $('#cartItems').innerHTML=cart.length?cart.map((x,i)=>`<div class="cart-item"><div class="cart-thumb">${x.image?`<img class="cart-thumb" src="${esc(x.image)}" alt="">`:'👟'}</div><div><h4>${esc(x.name)}</h4><p>${esc([x.size&&`Size: ${x.size}`,x.color&&`Color: ${x.color}`].filter(Boolean).join(' · '))}</p><strong>${money(x.price,content.settings?.currency)}</strong><div class="qty"><button data-qty="${i}" data-delta="-1">−</button><span>${x.qty}</span><button data-qty="${i}" data-delta="1">+</button></div></div><button class="remove-item" data-remove="${i}">✕</button></div>`).join(''):`<div class="empty-state">${esc(content.ui?.cart_empty||'Your cart is empty.')}</div>`;
  $$('[data-qty]').forEach(b=>b.onclick=()=>{const i=+b.dataset.qty,delta=+b.dataset.delta;cart[i].qty+=delta;if(cart[i].qty<=0)cart.splice(i,1);saveCart();}); $$('[data-remove]').forEach(b=>b.onclick=()=>{cart.splice(+b.dataset.remove,1);saveCart();}); updateCheckoutTotal();
}
function shippingFor(sub){const s=content.settings||{}; return Number(s.free_shipping_over)>0&&sub>=Number(s.free_shipping_over)?0:Number(s.shipping_fee||0);}
function updateCheckoutTotal(){const sub=cart.reduce((s,x)=>s+x.price*x.qty,0),ship=shippingFor(sub);$('#checkoutTotal').textContent=money(sub+ship,content.settings?.currency);}
function openCart(){ $('#cartDrawer').classList.add('show');$('#drawerOverlay').classList.add('show'); }
function closeCart(){ $('#cartDrawer').classList.remove('show');$('#drawerOverlay').classList.remove('show'); }

$('#openCart').onclick=openCart; $('#closeCart').onclick=closeCart; $('#drawerOverlay').onclick=closeCart;
$('#checkoutBtn').onclick=()=>{if(!cart.length)return toast('Your cart is empty');closeCart();updateCheckoutTotal();$('#checkoutModal').classList.add('show');};
$$('[data-close-modal]').forEach(b=>b.onclick=()=>b.closest('.modal').classList.remove('show')); $$('.modal').forEach(m=>m.onclick=e=>{if(e.target===m)m.classList.remove('show')});
$('#searchBtn').onclick=()=>{$('#searchPanel').classList.add('show');setTimeout(()=>$('#searchInput').focus(),200)};$('#closeSearch').onclick=()=>$('#searchPanel').classList.remove('show');$('#searchInput').oninput=e=>{searchTerm=e.target.value;renderProducts();};
$('#menuBtn').onclick=()=>{const n=$('#navLinks');n.style.display=n.style.display==='flex'?'none':'flex';n.style.position='absolute';n.style.top='70px';n.style.left='0';n.style.right='0';n.style.padding='20px';n.style.background='#111115';n.style.flexDirection='column';};

$('#checkoutForm').onsubmit=async(e)=>{
  e.preventDefault(); if(!cart.length)return; const fd=new FormData(e.currentTarget); if(fd.get('website'))return;
  const btn=$('#placeOrderBtn'), status=$('#formStatus'); btn.disabled=true; btn.textContent=content.ui?.placing_order||'PLACING ORDER…'; status.textContent='';
  const customer={name:fd.get('name'),email:fd.get('email'),phone:fd.get('phone'),city:fd.get('city'),address:fd.get('address'),note:fd.get('note')};
  const items=cart.map(x=>({product_id:x.product_id,qty:x.qty,size:x.size,color:x.color}));
  try{
    const {data,error}=await supabase.functions.invoke('place-order',{body:{customer,items}}); if(error)throw error; if(!data?.ok)throw new Error(data?.error||'Could not place order');
    cart=[];saveCart();e.currentTarget.reset();$('#checkoutModal').classList.remove('show');toast(`${content.ui?.order_success||'Order placed!'} #${data.order_no}`);
  }catch(err){console.error(err);status.textContent='Order could not be submitted. Please try again or contact the store.';}
  finally{btn.disabled=false;btn.textContent=content.ui?.place_order||'PLACE ORDER';}
};

function setupTilt(){document.querySelectorAll('.product-card,.category-card').forEach(card=>{if(card.dataset.tiltBound)return;card.dataset.tiltBound='1';card.addEventListener('pointermove',e=>{const r=card.getBoundingClientRect();const x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;card.style.transform=`translateY(-7px) rotateX(${-y*5}deg) rotateY(${x*6}deg)`});card.addEventListener('pointerleave',()=>card.style.transform='')});}
function setupReveal(){const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}}),{threshold:.08});$$('.reveal:not(.in)').forEach(x=>io.observe(x));setupTilt();}
document.addEventListener('mousemove',e=>{const g=$('#cursorGlow');g.style.left=e.clientX+'px';g.style.top=e.clientY+'px'});document.addEventListener('click',e=>{const a=e.target.closest('a[href="#cart"]');if(a){e.preventDefault();openCart();}});
loadStore();
