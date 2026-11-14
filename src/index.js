const SESSION_SECONDS = 1209600;
const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
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
 const row=await env.DB.prepare("SELECT users.id, users.username FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token_hash=? AND sessions.expires_at>? AND users.status='active'")
 .bind(await digest(token),Math.floor(Date.now()/1000)).first();
 return row||null;
}
async function handle(request,env) {
 const url=new URL(request.url),path=url.pathname,origin=request.headers.get("origin"),headers=corsHeaders(origin,env.APP_ORIGIN);
 if(request.method==="OPTIONS") return new Response(null,{status:204,headers:{...headers,"access-control-allow-methods":"GET,POST,DELETE,OPTIONS","access-control-allow-headers":"content-type"}});
 if(path==="/api/health"&&request.method==="GET") return json({ok:true,service:"joynexa-api",version:"0.1.0-alpha"},200,headers);
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
  return json({user:{id,username}},201,{...headers,"set-cookie":sessionCookie(token)});
 }
 if(path==="/api/login"&&request.method==="POST") {
  const body=await request.json().catch(()=>null),username=String(body?.username||"").trim(),password=String(body?.password||"");
  const user=await env.DB.prepare("SELECT id,username,password_hash,password_salt FROM users WHERE username=? COLLATE NOCASE AND status='active'").bind(username).first();
  if(!user) return json({error:"Usuario o contraseña incorrectos."},401,headers);
  const candidate=await derivePassword(password,user.password_salt);
  if(candidate!==user.password_hash) return json({error:"Usuario o contraseña incorrectos."},401,headers);
  const token=randomId(32);
  await env.DB.prepare("INSERT INTO sessions (token_hash,user_id,expires_at) VALUES (?,?,?)").bind(await digest(token),user.id,Math.floor(Date.now()/1000)+SESSION_SECONDS).run();
  return json({user:{id:user.id,username:user.username}},200,{...headers,"set-cookie":sessionCookie(token)});
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
 return env.ASSETS.fetch(request);
}
export default {async fetch(request,env) { try { return await handle(request,env); } catch { return json({error:"Error interno del servicio."},500); } }};
