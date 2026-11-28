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
 let upstream;
 try {
  upstream=await fetch(target,init);
 } catch(error) {
  const requestId=crypto.randomUUID();
  console.error("[Joynexa] Accounts API unavailable:",target.pathname,requestId,error?.stack||error);
  return json({error:"El backend de cuentas no está disponible. Comprueba que Node.js esté desplegado y que ACCOUNTS_API_URL sea correcto.",requestId},503);
 }
 const responseHeaders=new Headers(upstream.headers);
 responseHeaders.set("cache-control","no-store");
 return new Response(upstream.body,{status:upstream.status,statusText:upstream.statusText,headers:responseHeaders});
}

async function githubEncryptionKey(env) {
 const secret=String(env.GITHUB_TOKEN_ENCRYPTION_KEY||"");
 if(secret.length<32) throw new Error("Configura GITHUB_TOKEN_ENCRYPTION_KEY (mínimo 32 caracteres).");
 const raw=await crypto.subtle.digest("SHA-256",encoder.encode(secret));
 return crypto.subtle.importKey("raw",raw,{name:"AES-GCM"},false,["encrypt","decrypt"]);
}
async function encryptGithubToken(token,env) {
 const key=await githubEncryptionKey(env),iv=crypto.getRandomValues(new Uint8Array(12));
 const encrypted=await crypto.subtle.encrypt({name:"AES-GCM",iv},key,encoder.encode(token));
 return {iv:Array.from(iv,b=>b.toString(16).padStart(2,"0")).join(""),cipher:Array.from(new Uint8Array(encrypted),b=>b.toString(16).padStart(2,"0")).join("")};
}
async function decryptGithubToken(row,env) {
 const key=await githubEncryptionKey(env);
 const hex=value=>Uint8Array.from(value.match(/.{2}/g)||[],part=>parseInt(part,16));
 const plain=await crypto.subtle.decrypt({name:"AES-GCM",iv:hex(row.token_iv)},key,hex(row.token_cipher));
 return new TextDecoder().decode(plain);
}
async function githubConnection(user,env) {
 const row=await env.DB.prepare("SELECT token_iv,token_cipher,github_login FROM joynexa_github_connections WHERE user_id=?").bind(user.id).first();
 if(!row) return null;
 return {...row,token:await decryptGithubToken(row,env)};
}
async function githubApi(token,path,init={}) {
 const response=await fetch("https://api.github.com"+path,{...init,headers:{
  accept:"application/vnd.github+json",authorization:"Bearer "+token,
  "x-github-api-version":"2022-11-28","user-agent":"Joynexa-DevGit",
  ...(init.headers||{})
 }});
 const data=await response.json().catch(()=>({message:"GitHub devolvió una respuesta no válida."}));
 if(!response.ok) return {ok:false,status:response.status,data};
 return {ok:true,status:response.status,data};
}
function validRepoPart(value){return /^[A-Za-z0-9_.-]{1,100}$/.test(value)&&value!=="."&&value!==".."}
function validGitPath(value){return typeof value==="string"&&value.length>0&&value.length<=500&&!value.startsWith("/")&&!value.split("/").some(part=>!part||part==="."||part==="..")&&!/[\\\\\u0000-\u001f]/.test(value)}
async function handleDevGit(request,env,url,user,headers) {
 const path=url.pathname,method=request.method;
 if(path==="/api/devgit/github/connect"&&method==="GET") {
  if(!user)return json({error:"Inicia sesión en Joynexa para conectar GitHub."},401,headers);
  if(!env.GITHUB_OAUTH_CLIENT_ID||!env.GITHUB_OAUTH_CLIENT_SECRET)return json({error:"DevGit aún necesita configurar GITHUB_OAUTH_CLIENT_ID y GITHUB_OAUTH_CLIENT_SECRET."},503,headers);
  const state=randomId(32),stateHash=await digest(state),expires=Math.floor(Date.now()/1000)+600;
  await env.DB.prepare("INSERT INTO joynexa_github_oauth_states (state_hash,user_id,expires_at) VALUES (?,?,?)").bind(stateHash,user.id,expires).run();
  const redirect=url.origin+"/api/devgit/github/callback";
  const authorize=new URL("https://github.com/login/oauth/authorize");
  authorize.searchParams.set("client_id",env.GITHUB_OAUTH_CLIENT_ID);
  authorize.searchParams.set("redirect_uri",redirect);
  authorize.searchParams.set("scope","public_repo read:user");
  authorize.searchParams.set("state",state);
  return Response.redirect(authorize.toString(),302);
 }
 if(path==="/api/devgit/github/callback"&&method==="GET") {
  const code=url.searchParams.get("code"),state=url.searchParams.get("state");
  if(!code||!state)return Response.redirect(url.origin+"/devgit.html?github_error=missing_code",302);
  const stateHash=await digest(state),row=await env.DB.prepare("SELECT user_id FROM joynexa_github_oauth_states WHERE state_hash=? AND expires_at>?").bind(stateHash,Math.floor(Date.now()/1000)).first();
  await env.DB.prepare("DELETE FROM joynexa_github_oauth_states WHERE state_hash=?").bind(stateHash).run();
  if(!row)return Response.redirect(url.origin+"/devgit.html?github_error=invalid_state",302);
  if(!env.GITHUB_OAUTH_CLIENT_ID||!env.GITHUB_OAUTH_CLIENT_SECRET)return Response.redirect(url.origin+"/devgit.html?github_error=not_configured",302);
  const exchange=await fetch("https://github.com/login/oauth/access_token",{method:"POST",headers:{accept:"application/json","content-type":"application/json"},body:JSON.stringify({client_id:env.GITHUB_OAUTH_CLIENT_ID,client_secret:env.GITHUB_OAUTH_CLIENT_SECRET,code})});
  const auth=await exchange.json().catch(()=>({}));
  if(!exchange.ok||!auth.access_token)return Response.redirect(url.origin+"/devgit.html?github_error=oauth_failed",302);
  const profile=await githubApi(auth.access_token,"/user");
  if(!profile.ok)return Response.redirect(url.origin+"/devgit.html?github_error=profile_failed",302);
  try {
   const encrypted=await encryptGithubToken(auth.access_token,env);
   await env.DB.prepare("INSERT INTO joynexa_github_connections (user_id,github_login,token_iv,token_cipher,created_at,updated_at) VALUES (?,?,?,?,datetime('now'),datetime('now')) ON CONFLICT(user_id) DO UPDATE SET github_login=excluded.github_login,token_iv=excluded.token_iv,token_cipher=excluded.token_cipher,updated_at=datetime('now')").bind(row.user_id,profile.data.login,encrypted.iv,encrypted.cipher).run();
  } catch { return Response.redirect(url.origin+"/devgit.html?github_error=encryption_config",302); }
  return Response.redirect(url.origin+"/devgit.html?github_connected=1",302);
 }
 if(!path.startsWith("/api/devgit/"))return null;
 if(!user)return json({error:"Inicia sesión en Joynexa para usar DevGit."},401,headers);
 if(path==="/api/devgit/github/status"&&method==="GET") {
  const row=await env.DB.prepare("SELECT github_login,created_at,updated_at FROM joynexa_github_connections WHERE user_id=?").bind(user.id).first();
  return json({connected:!!row,account:row?.github_login||null,connectedAt:row?.created_at||null},200,headers);
 }
 if(path==="/api/devgit/github/disconnect"&&method==="POST") {
  if(request.headers.get("origin")!==url.origin)return json({error:"Origen no permitido."},403,headers);
  await env.DB.prepare("DELETE FROM joynexa_github_connections WHERE user_id=?").bind(user.id).run();
  return json({ok:true},200,headers);
 }
 const connection=await githubConnection(user,env).catch(()=>null);
 if(!connection)return json({error:"Conecta tu cuenta GitHub primero."},409,headers);
 if(path==="/api/devgit/repos"&&method==="GET") {
  const result=await githubApi(connection.token,"/user/repos?visibility=public&affiliation=owner,collaborator,organization_member&sort=updated&per_page=100");
  return json(result.ok?{repositories:result.data.map(item=>({full_name:item.full_name,description:item.description,default_branch:item.default_branch,private:item.private,html_url:item.html_url,updated_at:item.updated_at}))}:{error:result.data.message||"No se pudieron cargar los repositorios."},result.ok?200:result.status,headers);
 }
 const prefix="/api/devgit/repos/";
 if(!path.startsWith(prefix))return json({error:"Ruta DevGit no encontrada."},404,headers);
 const rest=path.slice(prefix.length).split("/");
 const owner=decodeURIComponent(rest[0]||""),repo=decodeURIComponent(rest[1]||"");
 if(!validRepoPart(owner)||!validRepoPart(repo))return json({error:"Repositorio no válido."},400,headers);
 const base="/repos/"+encodeURIComponent(owner)+"/"+encodeURIComponent(repo);
 if(method==="GET"&&rest[2]==="branches") {
  const result=await githubApi(connection.token,base+"/branches?per_page=100");
  return json(result.ok?{branches:result.data.map(item=>({name:item.name,sha:item.commit.sha}))}:{error:result.data.message||"No se pudieron cargar las ramas."},result.ok?200:result.status,headers);
 }
 if(method==="GET"&&rest[2]==="commits") {
  const ref=url.searchParams.get("ref")||"main";
  const result=await githubApi(connection.token,base+"/commits?sha="+encodeURIComponent(ref)+"&per_page=30");
  return json(result.ok?{commits:result.data.map(item=>({sha:item.sha,message:item.commit.message,author:item.commit.author?.name,date:item.commit.author?.date,url:item.html_url}))}:{error:result.data.message||"No se pudo cargar el historial."},result.ok?200:result.status,headers);
 }
 if(method==="GET"&&rest[2]==="tree") {
  const ref=url.searchParams.get("ref")||"HEAD";
  const result=await githubApi(connection.token,base+"/git/trees/"+encodeURIComponent(ref)+"?recursive=1");
  return json(result.ok?{tree:result.data.tree||[],sha:result.data.sha,truncated:!!result.data.truncated}:{error:result.data.message||"No se pudo leer el árbol."},result.ok?200:result.status,headers);
 }
 if(method==="GET"&&rest[2]==="file") {
  const filePath=url.searchParams.get("path")||"",ref=url.searchParams.get("ref")||"HEAD";
  if(!validGitPath(filePath))return json({error:"Ruta de archivo no válida."},400,headers);
  const result=await githubApi(connection.token,base+"/contents/"+filePath.split("/").map(encodeURIComponent).join("/")+"?ref="+encodeURIComponent(ref));
  if(!result.ok)return json({error:result.data.message||"No se pudo leer el archivo."},result.status,headers);
  if(result.data.type!=="file"||!result.data.content)return json({error:"El recurso no es un archivo de texto compatible."},415,headers);
  let content="";
  try{content=new TextDecoder().decode(Uint8Array.from(atob(result.data.content.replace(/\s/g,"")),c=>c.charCodeAt(0)))}catch{return json({error:"No se pudo decodificar el archivo."},415,headers)}
  if(content.length>500000)return json({error:"Archivo demasiado grande para el editor web (máximo 500 KB)."},413,headers);
  return json({path:filePath,content,sha:result.data.sha,size:result.data.size},200,headers);
 }
 if(method==="POST"&&request.headers.get("origin")!==url.origin)return json({error:"Origen no permitido."},403,headers);
 if(method==="POST"&&rest[2]==="branches") {
  const body=await request.json().catch(()=>null),name=String(body?.name||"").trim(),from=String(body?.from||"");
  if(!/^[A-Za-z0-9._/-]{1,120}$/.test(name)||name.startsWith("/")||name.endsWith("/")||name.includes(".."))return json({error:"Nombre de rama no válido."},400,headers);
  const source=await githubApi(connection.token,base+"/git/ref/heads/"+encodeURIComponent(from||"main"));
  if(!source.ok)return json({error:source.data.message||"No se encontró la rama base."},source.status,headers);
  const created=await githubApi(connection.token,base+"/git/refs",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({ref:"refs/heads/"+name,sha:source.data.object.sha})});
  return json(created.ok?{ok:true,ref:created.data.ref}:{error:created.data.message||"No se pudo crear la rama."},created.ok?201:created.status,headers);
 }
 if(method==="POST"&&rest[2]==="commit") {
  const body=await request.json().catch(()=>null),branch=String(body?.branch||"main"),message=String(body?.message||"").trim(),files=Array.isArray(body?.files)?body.files:[];
  if(!/^[A-Za-z0-9._/-]{1,120}$/.test(branch)||branch.includes("..")||!message||message.length>200||files.length<1||files.length>20)return json({error:"Commit inválido: indica rama, mensaje y entre 1 y 20 archivos."},400,headers);
  if(files.some(file=>!validGitPath(file.path)||typeof file.content!=="string"||file.content.length>500000))return json({error:"Hay rutas o contenidos inválidos (máximo 500 KB por archivo)."},400,headers);
  const ref=await githubApi(connection.token,base+"/git/ref/heads/"+encodeURIComponent(branch));
  if(!ref.ok)return json({error:ref.data.message||"No se encontró la rama."},ref.status,headers);
  const parent=ref.data.object.sha,commitData=await githubApi(connection.token,base+"/git/commits/"+parent);
  if(!commitData.ok)return json({error:commitData.data.message||"No se pudo leer el commit base."},commitData.status,headers);
  const entries=[];
  for(const file of files) {
   const blob=await githubApi(connection.token,base+"/git/blobs",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({content:file.content,encoding:"utf-8"})});
   if(!blob.ok)return json({error:blob.data.message||"No se pudo crear un blob."},blob.status,headers);
   entries.push({path:file.path,mode:"100644",type:"blob",sha:blob.data.sha});
  }
  const tree=await githubApi(connection.token,base+"/git/trees",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({base_tree:commitData.data.tree.sha,tree:entries})});
  if(!tree.ok)return json({error:tree.data.message||"No se pudo crear el árbol."},tree.status,headers);
  const commit=await githubApi(connection.token,base+"/git/commits",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({message,tree:tree.data.sha,parents:[parent]})});
  if(!commit.ok)return json({error:commit.data.message||"No se pudo crear el commit."},commit.status,headers);
  const updated=await githubApi(connection.token,base+"/git/refs/heads/"+encodeURIComponent(branch),{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({sha:commit.data.sha,force:false})});
  if(!updated.ok)return json({error:updated.data.message||"El commit se creó, pero la rama no se pudo actualizar. Revisa el historial antes de reintentar."},updated.status,headers);
  return json({ok:true,sha:commit.data.sha,url:commit.data.html_url},201,headers);
 }
 if(method==="POST"&&rest[2]==="pulls") {
  const body=await request.json().catch(()=>null),title=String(body?.title||"").trim(),head=String(body?.head||""),baseBranch=String(body?.base||"main"),description=String(body?.body||"");
  if(!title||title.length>200||!head||!baseBranch||description.length>10000)return json({error:"Datos de Pull Request no válidos."},400,headers);
  const result=await githubApi(connection.token,base+"/pulls",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({title,head,base:baseBranch,body:description})});
  return json(result.ok?{ok:true,number:result.data.number,url:result.data.html_url}:{error:result.data.message||"No se pudo abrir el Pull Request."},result.ok?201:result.status,headers);
 }
 return json({error:"Operación DevGit no disponible."},404,headers);
}

async function handle(request,env) {
 const url=new URL(request.url),path=url.pathname,origin=request.headers.get("origin"),headers=corsHeaders(origin,env.APP_ORIGIN);
 if(request.method==="OPTIONS") return new Response(null,{status:204,headers:{...headers,"access-control-allow-methods":"GET,POST,PUT,DELETE,OPTIONS","access-control-allow-headers":"content-type,x-admin-setup-key"}});
 const devgitUser=path.startsWith("/api/devgit/")?await currentUser(request,env):null;
 if(path.startsWith("/api/devgit/")) { const response=await handleDevGit(request,env,url,devgitUser,headers); if(response)return response; }
 const accountProxyPaths=new Set(["/api/register","/api/login","/api/logout","/api/me","/api/admin/setup-status","/api/admin/bootstrap","/api/sessions","/api/profile/me"]);
 if(accountProxyPaths.has(path)||/^\/api\/sessions\/[0-9a-f-]{36}$/i.test(path)||/^\/api\/users\/[a-zA-Z0-9_]{3,20}\/profile$/i.test(path)) {
  const proxied=await proxyAccounts(request,env);
  if(proxied) return proxied;
 }
 if(path==="/api/health"&&request.method==="GET") {
  let accounts="legacy-d1";
  if(env.ACCOUNTS_API_URL) {
   try {
    const response=await fetch(new URL("/health",env.ACCOUNTS_API_URL),{signal:AbortSignal.timeout(4000)});
    accounts=response.ok?"connected":"unhealthy";
   } catch { accounts="unreachable"; }
  }
  return json({ok:true,service:"joynexa-api",version:"0.3.0-alpha",accountsBackend:accounts},200,headers);
 }
 if(path==="/api/games"&&request.method==="GET") {
  const result=await env.DB.prepare("SELECT id,slug,title,description,category,launch_url,thumbnail_url,developer_name,catalog_tier,embed_url,embed_enabled FROM games WHERE status='approved' AND lower(category) NOT IN ('shooter','fighting') AND NOT (lower(title || ' ' || description) LIKE '%weapon%' OR lower(title || ' ' || description) LIKE '%firearm%' OR lower(title || ' ' || description) LIKE '%sniper%' OR lower(title || ' ' || description) LIKE '%rifle%' OR lower(title || ' ' || description) LIKE '%pistol%' OR lower(title || ' ' || description) LIKE '%knife%' OR lower(title || ' ' || description) LIKE '%mafia%' OR lower(title || ' ' || description) LIKE '%combat%' OR lower(title || ' ' || description) LIKE '%shoot%') ORDER BY CASE catalog_tier WHEN 'featured' THEN 0 ELSE 1 END,created_at DESC LIMIT 3000").all();
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


 if(request.method==="GET"&&/^\/api\/users\/[a-zA-Z0-9_]{3,20}\/games$/i.test(path)) {
  const username=path.split("/")[3];
  if(!env.ACCOUNTS_API_URL) return json({error:"Los perfiles públicos no están disponibles."},503,headers);
  let profileResponse;
  try {
   profileResponse=await fetch(new URL("/api/users/"+encodeURIComponent(username)+"/profile",env.ACCOUNTS_API_URL),{headers:{accept:"application/json"}});
  } catch {
   return json({error:"No se pudo comprobar la privacidad del perfil."},503,headers);
  }
  if(profileResponse.status===404) return json({error:"Este perfil no existe o es privado."},404,headers);
  if(!profileResponse.ok) return json({error:"No se pudo comprobar la privacidad del perfil."},503,headers);
  const result=await env.DB.prepare(
   "SELECT slug,title,description,category,launch_url,thumbnail_url FROM games WHERE developer_name=? AND status='approved' ORDER BY created_at DESC LIMIT 50"
  ).bind(username).all();
  return json({games:result.results||[]},200,headers);
 }



 // Joynexa Play: signed-in play sessions and capped playtime XP.
 if(/^\/api\/play\/[a-z0-9-]{1,80}\/(start|heartbeat|end)$/i.test(path)&&request.method==="POST") {
  const user=await currentUser(request,env);
  if(!user) return json({error:"Inicia sesión para guardar XP y progreso."},401,headers);
  const parts=path.split("/"),slug=parts[3],action=parts[4];
  const game=await env.DB.prepare("SELECT id,slug,title,embed_url,embed_enabled FROM games WHERE slug=? AND status='approved'").bind(slug).first();
  if(!game) return json({error:"Juego no disponible."},404,headers);
  if(action==="start") {
   const sessionId=randomId(16),now=Math.floor(Date.now()/1000);
   await env.DB.prepare("INSERT INTO joynexa_play_sessions (id,user_id,game_id,started_at,last_ping_at) VALUES (?,?,?,?,?)").bind(sessionId,user.id,game.id,now,now).run();
   return json({ok:true,sessionId,game:{slug:game.slug,title:game.title,embedUrl:game.embed_enabled?game.embed_url:null}},201,headers);
  }
  const body=await request.json().catch(()=>null),sessionId=String(body?.sessionId||"");
  if(!/^[a-f0-9]{32}$/.test(sessionId)) return json({error:"Sesión de juego no válida."},400,headers);
  const session=await env.DB.prepare("SELECT id,last_ping_at,ended_at FROM joynexa_play_sessions WHERE id=? AND user_id=? AND game_id=?").bind(sessionId,user.id,game.id).first();
  if(!session||session.ended_at) return json({error:"La sesión de juego terminó o no existe."},404,headers);
  const now=Math.floor(Date.now()/1000);
  if(action==="end") {
   await env.DB.prepare("UPDATE joynexa_play_sessions SET ended_at=? WHERE id=? AND user_id=? AND ended_at IS NULL").bind(now,sessionId,user.id).run();
   return json({ok:true},200,headers);
  }
  const elapsed=now-Number(session.last_ping_at);
  if(elapsed<55) return json({ok:true,earnedXp:0,totalXp:null,nextHeartbeatIn:Math.max(1,55-elapsed)},200,headers);
  if(elapsed>100) {
   await env.DB.prepare("UPDATE joynexa_play_sessions SET last_ping_at=? WHERE id=? AND user_id=? AND last_ping_at=? AND ended_at IS NULL").bind(now,sessionId,user.id,session.last_ping_at).run();
   return json({ok:true,earnedXp:0,reason:"heartbeat_late"},200,headers);
  }
  const today=Math.floor(now/86400);
  const daily=await env.DB.prepare("SELECT COALESCE(SUM(xp),0) AS total FROM joynexa_xp_ledger WHERE user_id=? AND day_key=?").bind(user.id,today).first();
  const remaining=Math.max(0,120-Number(daily?.total||0));
  const earnedXp=Math.min(1,remaining);
  const updated=await env.DB.prepare("UPDATE joynexa_play_sessions SET last_ping_at=?,earned_xp=earned_xp+? WHERE id=? AND user_id=? AND last_ping_at=? AND ended_at IS NULL").bind(now,earnedXp,sessionId,user.id,session.last_ping_at).run();
  if(!updated.meta?.changes) return json({error:"La sesión ya recibió esta actualización."},409,headers);
  if(earnedXp) await env.DB.prepare("INSERT INTO joynexa_xp_ledger (id,user_id,game_id,session_id,xp,reason,day_key) VALUES (?,?,?,?,?,'playtime',?)").bind(randomId(16),user.id,game.id,sessionId,earnedXp,today).run();
  const ledgerTotal=await env.DB.prepare("SELECT COALESCE(SUM(xp),0) AS total FROM joynexa_xp_ledger WHERE user_id=?").bind(user.id).first();
  const achievementTotal=await env.DB.prepare("SELECT COALESCE(SUM(a.points),0) AS total FROM joynexa_user_achievements ua JOIN joynexa_achievement_defs a ON a.id=ua.achievement_id WHERE ua.user_id=?").bind(user.id).first();
  return json({ok:true,earnedXp,totalXp:Number(ledgerTotal?.total||0)+Number(achievementTotal?.total||0),dailyXp:Number(daily?.total||0)+earnedXp,dailyCap:120},200,headers);
 }
 if(path==="/api/xp/me"&&request.method==="GET") {
  const user=await currentUser(request,env);
  if(!user) return json({error:"Inicia sesión para consultar tu XP."},401,headers);
  const total=await env.DB.prepare("SELECT COALESCE(SUM(xp),0) AS total FROM joynexa_xp_ledger WHERE user_id=?").bind(user.id).first();
  const achievementTotal=await env.DB.prepare("SELECT COALESCE(SUM(a.points),0) AS total FROM joynexa_user_achievements ua JOIN joynexa_achievement_defs a ON a.id=ua.achievement_id WHERE ua.user_id=?").bind(user.id).first();
  const today=Math.floor(Date.now()/86400000);
  const daily=await env.DB.prepare("SELECT COALESCE(SUM(xp),0) AS total FROM joynexa_xp_ledger WHERE user_id=? AND day_key=?").bind(user.id,today).first();
  return json({xp:Number(total?.total||0)+Number(achievementTotal?.total||0),dailyXp:Number(daily?.total||0),dailyCap:120},200,headers);
 }

 // Joynexa Achievements: universal IDs are stored as text (not FK to legacy D1 users).
 if(path==="/api/achievements/me"&&request.method==="GET") {
  const user=await currentUser(request,env);
  if(!user) return json({error:"Inicia sesión para consultar tus logros."},401,headers);
  const result=await env.DB.prepare(
   "SELECT a.code,a.title,a.description,a.points,ua.earned_at,g.slug AS game_slug,g.title AS game_title FROM joynexa_user_achievements ua JOIN joynexa_achievement_defs a ON a.id=ua.achievement_id JOIN games g ON g.id=ua.game_id WHERE ua.user_id=? AND g.status='approved' ORDER BY ua.earned_at DESC LIMIT 200"
  ).bind(user.id).all();
  const total=(result.results||[]).reduce((sum,item)=>sum+Number(item.points||0),0);
  return json({achievements:result.results||[],totalPoints:total},200,headers);
 }
 if(/^\/api\/developer\/games\/[a-z0-9-]{1,80}\/achievements$/i.test(path)&&request.method==="POST") {
  const user=await currentUser(request,env);
  if(!user) return json({error:"Inicia sesión como desarrollador."},401,headers);
  const slug=path.split("/")[4];
  const game=await env.DB.prepare("SELECT id FROM games WHERE slug=? AND developer_name=? AND status='approved' LIMIT 1").bind(slug,user.username).first();
  if(!game) return json({error:"Solo puedes configurar logros de tus juegos aprobados."},404,headers);
  const body=await request.json().catch(()=>null);
  const code=String(body?.code||"").trim().toLowerCase();
  const title=String(body?.title||"").trim();
  const description=String(body?.description||"").trim();
  const points=Number(body?.points??10);
  if(!/^[a-z0-9_-]{2,40}$/.test(code)||title.length<2||title.length>60||description.length>180||!Number.isInteger(points)||points<0||points>1000)
   return json({error:"Datos inválidos. Usa un código de 2-40 caracteres y puntos entre 0 y 1000."},400,headers);
  const id=randomId(16);
  await env.DB.prepare("INSERT INTO joynexa_achievement_defs (id,game_id,code,title,description,points) VALUES (?,?,?,?,?,?) ON CONFLICT(game_id,code) DO UPDATE SET title=excluded.title,description=excluded.description,points=excluded.points")
   .bind(id,game.id,code,title,description,points).run();
  return json({ok:true,code},201,headers);
 }
 if(/^\/api\/developer\/games\/[a-z0-9-]{1,80}\/sdk-key$/i.test(path)&&request.method==="POST") {
  const user=await currentUser(request,env);
  if(!user) return json({error:"Inicia sesión como desarrollador."},401,headers);
  const slug=path.split("/")[4];
  const game=await env.DB.prepare("SELECT id FROM games WHERE slug=? AND developer_name=? AND status='approved' LIMIT 1").bind(slug,user.username).first();
  if(!game) return json({error:"Solo puedes generar claves para tus juegos aprobados."},404,headers);
  const token="jn_game_"+randomId(32);
  await env.DB.prepare("UPDATE joynexa_game_keys SET revoked_at=datetime('now') WHERE game_id=? AND revoked_at IS NULL").bind(game.id).run();
  await env.DB.prepare("INSERT INTO joynexa_game_keys (id,game_id,owner_id,token_hash) VALUES (?,?,?,?)").bind(randomId(16),game.id,user.id,await digest(token)).run();
  return json({ok:true,token,warning:"Esta clave se muestra una sola vez. Guárdala en el backend privado de tu juego; nunca la incluyas en HTML, JavaScript del navegador o repositorios públicos."},201,headers);
 }
 if(/^\/api\/sdk\/games\/[a-z0-9-]{1,80}\/achievements\/[a-z0-9_-]{2,40}$/i.test(path)&&request.method==="POST") {
  const slug=path.split("/")[4],code=path.split("/")[6];
  const auth=request.headers.get("authorization")||"";
  const token=auth.startsWith("Bearer ")?auth.slice(7):"";
  if(!token.startsWith("jn_game_")||token.length>100) return json({error:"Credencial de juego no válida."},401,headers);
  const key=await env.DB.prepare("SELECT k.game_id FROM joynexa_game_keys k JOIN games g ON g.id=k.game_id WHERE k.token_hash=? AND k.revoked_at IS NULL AND g.slug=? AND g.status='approved' LIMIT 1").bind(await digest(token),slug).first();
  if(!key) return json({error:"Credencial revocada o juego no disponible."},401,headers);
  const body=await request.json().catch(()=>null),userId=String(body?.userId||"");
  if(!/^[a-f0-9]{32}$/i.test(userId)) return json({error:"Se requiere un Joynexa ID válido."},400,headers);
  const definition=await env.DB.prepare("SELECT id FROM joynexa_achievement_defs WHERE game_id=? AND code=?").bind(key.game_id,code).first();
  if(!definition) return json({error:"Ese logro no está registrado para el juego."},404,headers);
  const inserted=await env.DB.prepare("INSERT OR IGNORE INTO joynexa_user_achievements (user_id,game_id,achievement_id) VALUES (?,?,?)").bind(userId,key.game_id,definition.id).run();
  return json({ok:true,awarded:Number(inserted.meta?.changes||0)>0,duplicate:Number(inserted.meta?.changes||0)===0},200,headers);
 }

 if(path==="/api/favorites"&&request.method==="GET") {
  const user=await currentUser(request,env);
  if(!user) return json({error:"Inicia sesión para consultar tus favoritos."},401,headers);
  const result=await env.DB.prepare(
   "SELECT g.slug,g.title,g.category,g.launch_url FROM joynexa_favorites f JOIN games g ON g.id=f.game_id WHERE f.user_id=? AND g.status='approved' ORDER BY f.created_at DESC LIMIT 100"
  ).bind(user.id).all();
  return json({games:result.results||[]},200,headers);
 }
 if(/^\/api\/favorites\/[a-z0-9-]{1,80}$/i.test(path)&&(request.method==="POST"||request.method==="DELETE")) {
  const user=await currentUser(request,env);
  if(!user) return json({error:"Inicia sesión para gestionar tus favoritos."},401,headers);
  const slug=path.split("/")[3];
  const game=await env.DB.prepare("SELECT id FROM games WHERE slug=? AND status='approved' LIMIT 1").bind(slug).first();
  if(!game) return json({error:"No se encontró ese juego publicado."},404,headers);
  if(request.method==="POST") {
   await env.DB.prepare("INSERT OR IGNORE INTO joynexa_favorites (user_id,game_id) VALUES (?,?)").bind(user.id,game.id).run();
   return json({ok:true,favorite:true},200,headers);
  }
  await env.DB.prepare("DELETE FROM joynexa_favorites WHERE user_id=? AND game_id=?").bind(user.id,game.id).run();
  return json({ok:true,favorite:false},200,headers);
 }
 if(path==="/api/my-games"&&request.method==="GET") {
  const user=await currentUser(request,env);
  if(!user) return json({error:"Inicia sesión para consultar tus envíos."},401,headers);
  const result=await env.DB.prepare(
   "SELECT id,title,description,category,status,created_at FROM games WHERE developer_name=? ORDER BY created_at DESC LIMIT 50"
  ).bind(user.username).all();
  return json({games:result.results||[]},200,headers);
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
