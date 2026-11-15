const SESSION_SECONDS = 1209600;
const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
const ID_RE = /^[a-f0-9]{32}$/;
const encoder = new TextEncoder();

function json(data, status = 200, extra = {}) {
 return new Response(JSON.stringify(data), {status, headers: {"content-type":"application/json; charset=utf-8","cache-control":"no-store",...extra}});
}
function corsHeaders(origin, allowed) {
 if (!origin || !allowed || origin !== allowed) return {};
 return {"access-control-allow-origin":allowed,"access-control-allow-credentials":"true","vary":"Origin"};
}
function cookieValue(request,name) {
 const item=(request.headers.get("cookie")||"").split(";").map(v=>v.trim()).find(v=>v.startsWith(name+"="));
 return item ? item.slice(name.length+1) : null;
}
function randomId(bytes=24) {
 const value=new Uint8Array(bytes); crypto.getRandomValues(value);
 return Array.from(value,b=>b.toString(16).padStart(2,"0")).join("");
}
async function digest(value) {
 const result=await crypto.subtle.digest("SHA-256",encoder.encode(value));
 return Array.from(new Uint8Array(result),b=>b.toString(16).padStart(2,"0")).join("");
}
async function sameSecret(provided, expected) {
 if(typeof provided!=="string"||typeof expected!=="string"||!expected||expected.length<32) return false;
 const a=await crypto.subtle.digest("SHA-256",encoder.encode(provided));
 const b=await crypto.subtle.digest("SHA-256",encoder.encode(expected));
 const left=new Uint8Array(a),right=new Uint8Array(b); let diff=0;
 for(let i=0;i<left.length;i++) diff|=left[i]^right[i];
 return diff===0;
}
async function derivePassword(password,saltHex) {
 const salt=Uint8Array.from(saltHex.match(/.{2}/g),x=>parseInt(x,16));
 const key=await crypto.subtle.importKey("raw",encoder.encode(password),"PBKDF2",false,["deriveBits"]);
 const bits=await crypto.subtle.deriveBits({name:"PBKDF2",salt,iterations:210000,hash:"SHA-256"},key,256);
 return Array.from(new Uint8Array(bits),b=>b.toString(16).padStart(2,"0")).join("");
}
function sessionCookie(token,maxAge=SESSION_SECONDS) {
 return "jn_session="+token+"; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age="+maxAge;
}
async function currentUser(request,env) {
 const token=cookieValue(request,"jn_session"); if(!token) return null;
 if(env.ACCOUNTS_API_URL) {
  const sessionHeaders=new Headers({cookie:request.headers.get("cookie")||""});
  const clientIp=request.headers.get("cf-connecting-ip");
  if(clientIp) sessionHeaders.set("x-forwarded-for",clientIp);
  const response=await fetch(new URL("/api/me",env.ACCOUNTS_API_URL),{headers:sessionHeaders});
  if(!response.ok) throw new Error("Accounts API session lookup failed");
  const data=await response.json();
  return data.user||null;
 }
 const row=await env.DB.prepare("SELECT users.id, users.username, users.role FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token_hash=? AND sessions.expires_at>? AND users.status='active'")
 .bind(await digest(token),Math.floor(Date.now()/1000)).first();
 return row||null;
}
async function proxyAccounts(request,env) {
 if(!env.ACCOUNTS_API_URL) return null;
 const url=new URL(request.url);
 const target=new URL(url.pathname+url.search,env.ACCOUNTS_API_URL);
 const headers=new Headers(request.headers);
 const clientIp=request.headers.get("cf-connecting-ip");
 ["host","content-length","connection","cf-connecting-ip","cf-ray","cf-visitor","cf-worker","x-forwarded-for","x-real-ip"].forEach(name=>headers.delete(name));
 if(clientIp) headers.set("x-forwarded-for",clientIp);
 const init={method:request.method,headers,redirect:"manual"};
 if(request.method!=="GET"&&request.method!=="HEAD") init.body=request.body;
 const upstream=await fetch(target,init);
 const responseHeaders=new Headers(upstream.headers);
 responseHeaders.set("cache-control","no-store");
 return new Response(upstream.body,{status:upstream.status,statusText:upstream.statusText,headers:responseHeaders});
}
async function handle(request,env) {
 const url=new URL(request.url),path=url.pathname,origin=request.headers.get("origin"),headers=corsHeaders(origin,env.APP_ORIGIN);
 if(request.method==="OPTIONS") return new Response(null,{status:204,headers:{...headers,"access-control-allow-methods":"GET,POST,DELETE,OPTIONS","access-control-allow-headers":"content-type,x-admin-setup-key"}});
 const accountProxyPaths=new Set(["/api/register","/api/login","/api/logout","/api/me","/api/admin/setup-status","/api/admin/bootstrap"]);
 if(accountProxyPaths.has(path)) {
  const proxied=await proxyAccounts(request,env);
  if(proxied) return proxied;
 }
 if(path==="/api/health"&&request.method==="GET") return json({ok:true,service:"joynexa-api",version:"0.2.0-alpha"},200,headers);
 if(path==="/api/games"&&request.method==="GET") {
  const result=await env.DB.prepare("SELECT id,slug,title,description,category,launch_url,thumbnail_url,developer_name FROM games WHERE status='approved' ORDER BY created_at DESC LIMIT 100").all();
  return json({games:result.results||[]},200,headers);
 }
 if(path==="/api/register"&&request.method==="POST") {
  const body=await request.json().catch(()=>null),username=String(body?.username||"").trim(),password=String(body?.password||"");
  if(!USERNAME_RE.test(username)) return json({error:"El usuario debe tener 3-20 caracteres: letras, números o _."},400,headers);
  if(password.length<10||password.length>128) return json({error:"La contraseña debe tener entre 10 y 128 caracteres."},400,headers);
  const exists=await env.DB.prepare("SELECT id FROM users WHERE username=? COLLATE NOCASE").bind(username).first();
  if(exists) return json({error:"Ese nombre de usuario ya está ocupado."},409,headers);
  const id=randomId(16),salt=randomId(16),passwordHash=await derivePassword(password,salt);
  try { await env.DB.prepare("INSERT INTO users (id,username,password_hash,password_salt) VALUES (?,?,?,?)").bind(id,username,passwordHash,salt).run(); }
  catch { return json({error:"No se pudo crear la cuenta. Inténtalo de nuevo."},409,headers); }
  const token=randomId(32);
  await env.DB.prepare("INSERT INTO sessions (token_hash,user_id,expires_at) VALUES (?,?,?)").bind(await digest(token),id,Math.floor(Date.now()/1000)+SESSION_SECONDS).run();
  return json({user:{id,username,role:"player"}},201,{...headers,"set-cookie":sessionCookie(token)});
 }
 if(path==="/api/login"&&request.method==="POST") {
  const body=await request.json().catch(()=>null),username=String(body?.username||"").trim(),password=String(body?.password||"");
  const user=await env.DB.prepare("SELECT id,username,role,password_hash,password_salt FROM users WHERE username=? COLLATE NOCASE AND status='active'").bind(username).first();
  if(!user) return json({error:"Usuario o contraseña incorrectos."},401,headers);
  const candidate=await derivePassword(password,user.password_salt);
  if(candidate!==user.password_hash) return json({error:"Usuario o contraseña incorrectos."},401,headers);
  const token=randomId(32);
  await env.DB.prepare("INSERT INTO sessions (token_hash,user_id,expires_at) VALUES (?,?,?)").bind(await digest(token),user.id,Math.floor(Date.now()/1000)+SESSION_SECONDS).run();
  return json({user:{id:user.id,username:user.username,role:user.role}},200,{...headers,"set-cookie":sessionCookie(token)});
 }
 if(path==="/api/logout"&&request.method==="POST") {
  const token=cookieValue(request,"jn_session");
  if(token) await env.DB.prepare("DELETE FROM sessions WHERE token_hash=?").bind(await digest(token)).run();
  return json({ok:true},200,{...headers,"set-cookie":sessionCookie("",0)});
 }
 if(path==="/api/me"&&request.method==="GET") {
  const user=await currentUser(request,env); return json({user:user||null},200,headers);
 }
 if(path==="/api/submit-game"&&request.method==="POST") {
  const user=await currentUser(request,env); if(!user) return json({error:"Inicia sesión para enviar un juego."},401,headers);
  const body=await request.json().catch(()=>null),title=String(body?.title||"").trim(),description=String(body?.description||"").trim(),category=String(body?.category||"other").trim().toLowerCase(),launchUrl=String(body?.launchUrl||"").trim();
  if(title.length<2||title.length>60||description.length>500) return json({error:"Revisa el título y la descripción."},400,headers);
  if(!/^https:\/\//i.test(launchUrl)||launchUrl.length>500) return json({error:"El enlace debe comenzar con https://."},400,headers);
  if(!["adventure","arcade","puzzle","strategy","other"].includes(category)) return json({error:"Categoría no válida."},400,headers);
  const id=randomId(16),slug=title.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,45)+"-"+id.slice(0,6);
  await env.DB.prepare("INSERT INTO games (id,slug,title,description,category,launch_url,developer_name,status) VALUES (?,?,?,?,?,?,?,'pending')").bind(id,slug,title,description,category,launchUrl,user.username).run();
  await env.DB.prepare("INSERT INTO moderation_events (id,game_id,action) VALUES (?,?,'submitted')").bind(randomId(16),id).run();
  return json({ok:true,message:"Juego recibido. Quedó pendiente de revisión."},201,headers);
 }
 if(path==="/api/admin/setup-status"&&request.method==="GET") {
  const admins=await env.DB.prepare("SELECT COUNT(*) AS total FROM users WHERE role='admin' AND status='active'").first();
  return json({setupAvailable:Number(admins?.total||0)===0&&typeof env.ADMIN_SETUP_KEY==="string"&&env.ADMIN_SETUP_KEY.length>=32},200,headers);
 }
 if(path==="/api/admin/bootstrap"&&request.method==="POST") {
  const user=await currentUser(request,env); if(!user) return json({error:"Inicia sesión primero."},401,headers);
  const configured=typeof env.ADMIN_SETUP_KEY==="string"&&env.ADMIN_SETUP_KEY.length>=32;
  if(!configured) return json({error:"La clave de configuración no está configurada en Cloudflare."},503,headers);
  const admins=await env.DB.prepare("SELECT COUNT(*) AS total FROM users WHERE role='admin' AND status='active'").first();
  if(Number(admins?.total||0)>0) return json({error:"La configuración inicial ya fue utilizada."},409,headers);
  const supplied=request.headers.get("x-admin-setup-key")||"";
  if(!await sameSecret(supplied,env.ADMIN_SETUP_KEY)) return json({error:"Clave de configuración incorrecta."},403,headers);
  const result=await env.DB.prepare("UPDATE users SET role='admin' WHERE id=? AND role='player' AND status='active' AND NOT EXISTS (SELECT 1 FROM users AS admins WHERE admins.role='admin' AND admins.status='active')").bind(user.id).run();
  if(!result.meta?.changes) return json({error:"No se pudo asignar el rol de administrador."},409,headers);
  return json({ok:true,message:"Administrador inicial configurado. Guarda la clave fuera del repositorio."},200,headers);
 }
 if(path==="/api/admin/submissions"&&request.method==="GET") {
  const user=await currentUser(request,env); if(!user||user.role!=="admin") return json({error:"Acceso exclusivo para administradores."},403,headers);
  const result=await env.DB.prepare("SELECT id,slug,title,description,category,launch_url,developer_name,created_at FROM games WHERE status='pending' ORDER BY created_at ASC LIMIT 100").all();
  return json({submissions:result.results||[]},200,headers);
 }
 if(path==="/api/admin/review"&&request.method==="POST") {
  const user=await currentUser(request,env); if(!user||user.role!=="admin") return json({error:"Acceso exclusivo para administradores."},403,headers);
  const body=await request.json().catch(()=>null),gameId=String(body?.gameId||""),decision=String(body?.decision||""),note=String(body?.note||"").trim();
  if(!ID_RE.test(gameId)||!["approved","rejected"].includes(decision)||note.length>300) return json({error:"Datos de revisión no válidos."},400,headers);
  const updated=await env.DB.prepare("UPDATE games SET status=? WHERE id=? AND status='pending'").bind(decision,gameId).run();
  if(!updated.meta?.changes) return json({error:"El envío ya fue revisado o no existe."},409,headers);
  await env.DB.prepare("INSERT INTO moderation_events (id,game_id,action,note) VALUES (?,?,?,?)").bind(randomId(16),gameId,decision,note).run();
  return json({ok:true,message:decision==="approved"?"Juego aprobado y publicado en el catálogo.":"Juego rechazado."},200,headers);
 }
 return env.ASSETS.fetch(request);
}
export default {async fetch(request,env) { try { return await handle(request,env); } catch (error) { console.error("[Joynexa] Request failed:", new URL(request.url).pathname, error?.stack || error); return json({error:"Error interno del servicio.",requestId:crypto.randomUUID()},500); } }};
