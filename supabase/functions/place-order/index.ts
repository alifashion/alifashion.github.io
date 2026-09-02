import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status=200) => new Response(JSON.stringify(body), {status, headers:{...cors,"Content-Type":"application/json"}});
const clean = (v: unknown, max=500) => String(v ?? "").trim().slice(0,max);
const b64url = (s: string) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");

async function gmailAccessToken(){
  const client_id=Deno.env.get("GMAIL_CLIENT_ID"),client_secret=Deno.env.get("GMAIL_CLIENT_SECRET"),refresh_token=Deno.env.get("GMAIL_REFRESH_TOKEN");
  if(!client_id||!client_secret||!refresh_token) return null;
  const r=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id,client_secret,refresh_token,grant_type:"refresh_token"})});
  if(!r.ok) throw new Error(`Gmail token error ${r.status}`);return (await r.json()).access_token as string;
}
async function sendGmail(token:string,to:string,subject:string,text:string){
  const from=Deno.env.get("GMAIL_FROM_EMAIL")||"";
  const raw=[`From: ALI FASHION <${from}>`,`To: ${to}`,`Subject: ${subject}`,"MIME-Version: 1.0","Content-Type: text/plain; charset=UTF-8","",text].join("\r\n");
  const r=await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send",{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify({raw:b64url(raw)})});
  if(!r.ok) throw new Error(`Gmail send error ${r.status}`);
}

Deno.serve(async (req:Request)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
  if(req.method!=="POST") return json({ok:false,error:"Method not allowed"},405);
  try{
    const body=await req.json();
    const customer=body?.customer||{}, rawItems=Array.isArray(body?.items)?body.items:[];
    const name=clean(customer.name,120),email=clean(customer.email,180).toLowerCase(),phone=clean(customer.phone,50),city=clean(customer.city,100),address=clean(customer.address,400),note=clean(customer.note,500);
    if(!name||!email||!phone||!city||!address||!/^\S+@\S+\.\S+$/.test(email)||rawItems.length<1||rawItems.length>30) return json({ok:false,error:"Invalid order information"},400);

    const url=Deno.env.get("SUPABASE_URL")!, service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const db=createClient(url,service,{auth:{persistSession:false}});
    const ids=[...new Set(rawItems.map((x:any)=>clean(x.product_id,80)).filter(Boolean))];
    const {data:products,error:pe}=await db.from("products").select("id,name,price,stock,is_active").in("id",ids);
    if(pe) throw pe;
    const map=new Map((products||[]).map((p:any)=>[String(p.id),p]));
    const items:any[]=[];let subtotal=0;
    for(const x of rawItems){const id=clean(x.product_id,80),p:any=map.get(id),qty=Math.max(1,Math.min(10,Number(x.qty)||1));if(!p||!p.is_active||Number(p.stock)<qty) return json({ok:false,error:"A product is unavailable or out of stock"},409);const row={product_id:p.id,name:p.name,price:Number(p.price),qty,size:clean(x.size,40),color:clean(x.color,80)};subtotal+=row.price*qty;items.push(row)}
    const {data:settingsRows}=await db.from("site_content").select("value").eq("key","settings").maybeSingle();
    const settings:any=settingsRows?.value||{};const shippingFee=Number(settings.free_shipping_over)>0&&subtotal>=Number(settings.free_shipping_over)?0:Number(settings.shipping_fee||0);const total=subtotal+shippingFee;
    const orderNo=`AF-${new Date().toISOString().slice(2,10).replaceAll("-","")}-${crypto.randomUUID().slice(0,6).toUpperCase()}`;
    const {data:order,error:oe}=await db.from("orders").insert({order_no:orderNo,customer_name:name,email,phone,city,address,note:note||null,items,subtotal,shipping_fee:shippingFee,total,status:"new",email_status:"pending"}).select("id,order_no").single();if(oe) throw oe;

    let emailStatus="skipped",emailError:string|null=null;
    try{
      const token=await gmailAccessToken();
      if(token){
        const {data:ownerRow}=await db.from("private_settings").select("value").eq("key","owner_email").maybeSingle();const owner=clean(ownerRow?.value||Deno.env.get("GMAIL_FROM_EMAIL"),180);
        const lines=items.map(x=>`- ${x.name} × ${x.qty}${x.size?` | Size ${x.size}`:""}${x.color?` | ${x.color}`:""} = BDT ${(x.price*x.qty).toLocaleString()}`).join("\n");
        const customerText=`Thanks for ordering from ALI FASHION.\n\nOrder: ${orderNo}\n${lines}\n\nSubtotal: BDT ${subtotal.toLocaleString()}\nShipping: BDT ${shippingFee.toLocaleString()}\nTotal: BDT ${total.toLocaleString()}\n\nDelivery address: ${address}, ${city}\nPhone: ${phone}\n\nWe will contact you if confirmation is needed.`;
        const ownerText=`New ALI FASHION order\n\nOrder: ${orderNo}\nCustomer: ${name}\nEmail: ${email}\nPhone: ${phone}\nAddress: ${address}, ${city}\n\n${lines}\n\nTotal: BDT ${total.toLocaleString()}\nNote: ${note||"—"}`;
        await sendGmail(token,email,`ALI FASHION order confirmation — ${orderNo}`,customerText);if(owner)await sendGmail(token,owner,`New ALI FASHION order — ${orderNo}`,ownerText);emailStatus="sent";
      }
    }catch(e){emailStatus="failed";emailError=e instanceof Error?e.message:String(e)}
    await db.from("orders").update({email_status:emailStatus,email_error:emailError,notified_at:emailStatus==="sent"?new Date().toISOString():null}).eq("id",order.id);
    return json({ok:true,order_no:orderNo});
  }catch(e){console.error(e);return json({ok:false,error:"Could not place order"},500)}
});
