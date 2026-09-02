import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};
const json = (body: unknown, status=200) => new Response(JSON.stringify(body), {status, headers:cors});
const esc = (v='') => String(v).replace(/[&<>'"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m] as string));
const b64url = (text:string) => { const bytes=new TextEncoder().encode(text); let binary=''; for(const b of bytes) binary+=String.fromCharCode(b); return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); };

async function gmailAccessToken(){
  const client_id=Deno.env.get('GMAIL_CLIENT_ID');
  const client_secret=Deno.env.get('GMAIL_CLIENT_SECRET');
  const refresh_token=Deno.env.get('GMAIL_REFRESH_TOKEN');
  if(!client_id||!client_secret||!refresh_token) throw new Error('Gmail OAuth secrets are not configured');
  const res=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id,client_secret,refresh_token,grant_type:'refresh_token'})});
  const data=await res.json(); if(!res.ok||!data.access_token) throw new Error(data.error_description||'Could not get Gmail access token'); return data.access_token as string;
}
async function sendGmail(token:string,to:string,subject:string,html:string){
  const from=Deno.env.get('GMAIL_FROM_EMAIL'); if(!from) throw new Error('GMAIL_FROM_EMAIL is not configured');
  const message=[`From: ALI FASHION <${from}>`,`To: ${to}`,`Subject: ${subject}`,'MIME-Version: 1.0','Content-Type: text/html; charset=UTF-8','',html].join('\r\n');
  const res=await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({raw:b64url(message)})});
  if(!res.ok) throw new Error(`Gmail send failed: ${await res.text()}`); return res.json();
}

Deno.serve(async req=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers:cors});
  if(req.method!=='POST') return json({ok:false,error:'Method not allowed'},405);
  try{
    const body=await req.json();
    const customer=body?.customer||{}; const inputItems=Array.isArray(body?.items)?body.items:[];
    if(!customer.name||!customer.email||!customer.phone||!customer.city||!customer.address) return json({ok:false,error:'Missing customer information'},400);
    if(!/^\S+@\S+\.\S+$/.test(customer.email)) return json({ok:false,error:'Invalid email'},400);
    if(inputItems.length<1||inputItems.length>25) return json({ok:false,error:'Invalid cart'},400);
    const cleanItems=inputItems.map((x:any)=>({product_id:String(x.product_id||''),qty:Math.max(1,Math.min(10,Number(x.qty)||1)),size:String(x.size||'').slice(0,50),color:String(x.color||'').slice(0,50)}));
    if(cleanItems.some((x:any)=>!x.product_id)) return json({ok:false,error:'Invalid product'},400);

    const supabase=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const ids=[...new Set(cleanItems.map((x:any)=>x.product_id))];
    const {data:prods,error:pErr}=await supabase.from('products').select('id,name,sku,price,stock,images,is_active').in('id',ids).eq('is_active',true);
    if(pErr) throw pErr; if(!prods||prods.length!==ids.length) return json({ok:false,error:'One or more products are unavailable'},409);
    const map=new Map(prods.map((p:any)=>[p.id,p]));
    const items=cleanItems.map((x:any)=>{const p:any=map.get(x.product_id);if(!p)throw new Error('Product missing');if(Number(p.stock)<x.qty)throw new Error(`${p.name} has only ${p.stock} left`);return {product_id:p.id,sku:p.sku,name:p.name,price:Number(p.price),qty:x.qty,size:x.size,color:x.color,image:p.images?.[0]||''};});
    const subtotal=items.reduce((s:number,x:any)=>s+x.price*x.qty,0);
    const {data:settingsRow}=await supabase.from('site_content').select('value').eq('key','settings').maybeSingle();
    const settings=settingsRow?.value||{}; const shipping=(Number(settings.free_shipping_over)>0&&subtotal>=Number(settings.free_shipping_over))?0:Number(settings.shipping_fee||0); const total=subtotal+shipping;
    const orderNo=`AF-${new Date().toISOString().slice(2,10).replaceAll('-','')}-${crypto.randomUUID().slice(0,6).toUpperCase()}`;
    const {data:order,error:oErr}=await supabase.from('orders').insert({order_no:orderNo,customer_name:String(customer.name).slice(0,120),email:String(customer.email).slice(0,200),phone:String(customer.phone).slice(0,80),city:String(customer.city).slice(0,100),address:String(customer.address).slice(0,500),note:String(customer.note||'').slice(0,1000)||null,items,subtotal,shipping_fee:shipping,total,status:'new'}).select('id,order_no').single();
    if(oErr) throw oErr;

    // Best-effort stock update. For a small shop this is sufficient; admin can correct stock from Studio.
    for(const item of items){const p:any=map.get(item.product_id);await supabase.from('products').update({stock:Math.max(0,Number(p.stock)-item.qty)}).eq('id',item.product_id);}

    let emailSent=false; let emailError='';
    try{
      const [{data:ownerRow},token]=await Promise.all([supabase.from('private_settings').select('value').eq('key','owner_email').maybeSingle(),gmailAccessToken()]);
      const ownerEmail=ownerRow?.value||Deno.env.get('GMAIL_FROM_EMAIL');
      const itemRows=items.map((i:any)=>`<tr><td style="padding:8px 0;border-bottom:1px solid #eee"><b>${esc(i.name)}</b><br><small>${esc([i.size&&`Size ${i.size}`,i.color&&i.color].filter(Boolean).join(' · '))}</small></td><td style="text-align:center;border-bottom:1px solid #eee">× ${i.qty}</td><td style="text-align:right;border-bottom:1px solid #eee">৳${(i.price*i.qty).toLocaleString()}</td></tr>`).join('');
      const frame=(title:string,lead:string,extra:string)=>`<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#151515"><div style="background:#111;color:#fff;padding:24px;border-radius:18px 18px 0 0"><div style="color:#ff3434;font-size:12px;font-weight:bold;letter-spacing:2px">ALI FASHION</div><h1 style="margin:10px 0 0">${title}</h1></div><div style="padding:24px;border:1px solid #eee;border-top:0;border-radius:0 0 18px 18px"><p>${lead}</p><p><b>Order:</b> ${orderNo}</p><table style="width:100%;border-collapse:collapse">${itemRows}</table><div style="margin-top:18px;text-align:right"><div>Subtotal: ৳${subtotal.toLocaleString()}</div><div>Shipping: ৳${shipping.toLocaleString()}</div><div style="font-size:20px;font-weight:bold;margin-top:6px">Total: ৳${total.toLocaleString()}</div></div>${extra}<p style="margin-top:28px;color:#777;font-size:12px">ALI FASHION · Step Into Your Era.</p></div></div>`;
      const ownerHtml=frame('New order received',`A new order was placed by <b>${esc(customer.name)}</b>.`,`<div style="margin-top:20px;background:#f7f7f7;padding:14px;border-radius:12px"><b>Phone:</b> ${esc(customer.phone)}<br><b>Email:</b> ${esc(customer.email)}<br><b>Address:</b> ${esc(customer.address)}, ${esc(customer.city)}${customer.note?`<br><b>Note:</b> ${esc(customer.note)}`:''}</div>`);
      const customerHtml=frame('Order confirmed',`Hi ${esc(customer.name)}, thanks for shopping with ALI FASHION. We received your order and will contact you for delivery confirmation.`,`<p style="margin-top:20px">Keep this order number for reference: <b>${orderNo}</b></p>`);
      const results=await Promise.allSettled([sendGmail(token,ownerEmail,`New ALI FASHION order ${orderNo}`,ownerHtml),sendGmail(token,customer.email,`ALI FASHION order confirmed — ${orderNo}`,customerHtml)]);
      emailSent=results.every(x=>x.status==='fulfilled'); if(!emailSent) emailError=results.filter(x=>x.status==='rejected').map((x:any)=>x.reason?.message||String(x.reason)).join(' | ');
    }catch(e){emailError=e instanceof Error?e.message:String(e);}
    await supabase.from('orders').update({email_status:emailSent?'sent':'failed',email_error:emailError||null,notified_at:emailSent?new Date().toISOString():null}).eq('id',order.id);
    return json({ok:true,order_no:orderNo,total,email_sent:emailSent});
  }catch(e){console.error(e);return json({ok:false,error:e instanceof Error?e.message:'Order failed'},500);}
});
