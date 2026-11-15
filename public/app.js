const API_BASE=window.JOYNEXA_API_URL||"";
const api=async(path,options={})=>{const response=await fetch(API_BASE+"/api"+path,{credentials:"include",headers:{"content-type":"application/json",...(options.headers||{})},...options});const data=await response.json().catch(()=>({error:"Respuesta no válida del servidor."}));if(!response.ok){const error=new Error(data.error||"No se pudo completar la solicitud.");error.requestId=data.requestId||null;throw error}return data};
const search=document.getElementById("search"),cards=[],filters=[...document.querySelectorAll("[data-filter]")],tierFilters=[...document.querySelectorAll("[data-tier-filter]")],empty=document.getElementById("empty");
let category="all",catalogTier="featured",catalogGames=[],currentPage=1,toastTimer,authMode="login",currentUser=null;
const PAGE_SIZE=36;
const favoriteSlugs=new Set();
function applyFilters(){
 const q=search.value.trim().toLocaleLowerCase("es");
 const filtered=catalogGames.filter(g=>{
  const haystack=[g.title,g.description,g.category,g.developer_name].join(" ").toLocaleLowerCase("es");
  return (catalogTier==="all"||g.catalog_tier==="featured")&&(category==="all"||g.category===category)&&(!q||haystack.includes(q));
 });
 const pages=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE));
 currentPage=Math.min(currentPage,pages);
 const visible=filtered.slice((currentPage-1)*PAGE_SIZE,currentPage*PAGE_SIZE);
 const labels={adventure:"Aventura",arcade:"Arcade",puzzle:"Puzzle",strategy:"Estrategia",simulation:"Simulación",racing:"Carreras",sandbox:"Sandbox",other:"Otros"};
 const icons={adventure:"🧭",arcade:"🕹️",puzzle:"🧩",strategy:"♟️",simulation:"🏙️",racing:"🏎️",sandbox:"🧱",other:"🎮"};
 const covers={adventure:"cover-adventure",arcade:"cover-arcade",puzzle:"cover-puzzle",strategy:"cover-strategy",simulation:"cover-simulation",racing:"cover-racing",sandbox:"cover-sandbox",other:"cover-other"};
 const grid=document.getElementById("games-grid");
 grid.innerHTML=visible.map(g=>{
  const label=labels[g.category]||"Otros",icon=icons[g.category]||"🎮",cover=covers[g.category]||"cover-other";
  return '<article class="game live-game '+(g.catalog_tier==="featured"?"featured-game":"")+'" data-kind="'+escapeHtml(g.category)+'" data-name="'+escapeHtml(g.title)+'">'+
   '<div class="cover '+cover+'"><span>'+icon+'</span><strong>'+escapeHtml(g.title)+'</strong></div>'+
   '<div class="game-meta"><div><b>'+escapeHtml(g.title)+'</b><small>'+label+' · '+escapeHtml(g.developer_name||"Comunidad")+'</small></div>'+
   (g.embed_enabled&&g.embed_url?'<button class="play-link play-inside" type="button" data-play-slug="'+escapeHtml(g.slug)+'">Jugar aquí ▶</button>':'<a class="play-link" href="'+safeUrl(g.launch_url)+'" target="_blank" rel="noopener noreferrer">Jugar ↗</a>')+
   '<button class="favorite-toggle" type="button" data-favorite-slug="'+escapeHtml(g.slug)+'" aria-pressed="false" title="Guardar en favoritos">♡</button></div>'+
   '<p class="game-description">'+escapeHtml(g.description||"Juego para navegador.")+'</p></article>';
 }).join("");
 cards.splice(0,cards.length,...grid.querySelectorAll(".game"));
 grid.hidden=visible.length===0;
 empty.hidden=filtered.length!==0;
 empty.textContent=catalogGames.length?"No encontramos experiencias con esos filtros.":"Todavía no hay juegos publicados.";
 const countLabel=document.getElementById("catalog-count");
 if(countLabel)countLabel.textContent=filtered.length+" experiencias · "+catalogGames.length+" juegos en total";
 const pagination=document.getElementById("catalog-pagination");
 pagination.innerHTML=pages>1?'<button type="button" data-page="prev" '+(currentPage===1?'disabled':'')+'>← Anterior</button><span>Página '+currentPage+' de '+pages+'</span><button type="button" data-page="next" '+(currentPage===pages?'disabled':'')+'>Siguiente →</button>':"";
 pagination.querySelectorAll("[data-page]").forEach(button=>button.addEventListener("click",()=>{currentPage+=button.dataset.page==="next"?1:-1;applyFilters();document.getElementById("games").scrollIntoView({behavior:"smooth"})}));
 updateFavoriteButtons();
}
search.addEventListener("input",()=>{currentPage=1;applyFilters()});
filters.forEach(btn=>btn.addEventListener("click",()=>{category=btn.dataset.filter;currentPage=1;filters.forEach(b=>b.classList.toggle("chosen",b===btn));applyFilters()}));
tierFilters.forEach(btn=>btn.addEventListener("click",()=>{catalogTier=btn.dataset.tierFilter;currentPage=1;tierFilters.forEach(b=>b.classList.toggle("chosen",b===btn));applyFilters()}));
document.querySelectorAll("[data-jump]").forEach(btn=>btn.addEventListener("click",()=>{category=btn.dataset.jump;currentPage=1;filters.forEach(b=>b.classList.toggle("chosen",b.dataset.filter===category));search.value="";applyFilters();document.getElementById("games").scrollIntoView({behavior:"smooth"})}));
const nav=document.getElementById("nav"),menu=document.getElementById("menu");menu.addEventListener("click",()=>nav.classList.toggle("open"));nav.querySelectorAll("a").forEach(a=>a.addEventListener("click",()=>nav.classList.remove("open")));
const dialog=document.getElementById("account"),authForm=document.getElementById("auth-form"),authMessage=document.getElementById("auth-message"),authTitle=document.getElementById("account-title"),authNote=document.getElementById("account-note"),authSubmit=document.getElementById("auth-submit"),switchAuth=document.getElementById("switch-auth"),logout=document.getElementById("logout"),userChip=document.getElementById("user-chip");
const accountProfile=document.getElementById("account-profile"),profileUsername=document.getElementById("profile-username"),profileRole=document.getElementById("profile-role"),accountId=document.getElementById("account-id");
function setAuthMode(mode){authMode=mode;authTitle.innerHTML=mode==="register"?'Crea tu <span>Joynexa ID.</span>':'Tu cuenta <span>gaming.</span>';authNote.textContent=mode==="register"?"Elige un nombre de usuario y una contraseña. No uses tu contraseña de otros servicios.":"Inicia sesión para acceder a las funciones de tu cuenta.";authSubmit.textContent=mode==="register"?"Crear cuenta":"Iniciar sesión";switchAuth.textContent=mode==="register"?"¿Ya tienes cuenta? Inicia sesión":"¿No tienes cuenta? Crear una";document.getElementById("auth-password").autocomplete=mode==="register"?"new-password":"current-password";authMessage.textContent=""}
function openAccount(mode="login"){setAuthMode(mode);authForm.hidden=!!currentUser;logout.hidden=!currentUser;switchAuth.hidden=!!currentUser;accountProfile.hidden=!currentUser;if(currentUser){profileUsername.textContent=currentUser.username;profileRole.textContent=({player:"Jugador",developer:"Desarrollador",moderator:"Moderador",admin:"Administrador"}[currentUser.role]||"Cuenta Joynexa");accountId.textContent=currentUser.id;authNote.textContent="Sesión iniciada. Tu identidad está lista para Joynexa."}else{authNote.textContent="Inicia sesión para acceder a las funciones de tu cuenta."}authMessage.textContent="";dialog.showModal();if(currentUser){loadSessions();loadProfile();loadMyGames();loadFavorites();loadAchievements()}}
document.querySelectorAll("[data-account]").forEach(b=>b.addEventListener("click",()=>openAccount(b.dataset.account)));userChip.addEventListener("click",()=>openAccount("login"));
document.getElementById("close").addEventListener("click",()=>dialog.close());dialog.addEventListener("click",e=>{if(e.target===dialog)dialog.close()});
switchAuth.addEventListener("click",()=>setAuthMode(authMode==="login"?"register":"login"));
document.getElementById("copy-account-id").addEventListener("click",async()=>{if(!currentUser)return;try{await navigator.clipboard.writeText(currentUser.id);notify("Joynexa ID copiado.")}catch{authMessage.textContent="No se pudo copiar automáticamente. Selecciona y copia tu ID."}});

const myGamesList=document.getElementById("my-games-list");
const myGamesMessage=document.getElementById("my-games-message");
document.getElementById("refresh-my-games").addEventListener("click",loadMyGames);
function submissionStatus(status){
 return ({pending:"En revisión",approved:"Aprobado",rejected:"No aprobado"})[status]||"Estado desconocido";
}
async function loadMyGames(){
 if(!currentUser){myGamesList.innerHTML='<p class="session-empty">Inicia sesión para consultar tus envíos.</p>';return}
 myGamesMessage.textContent="";
 myGamesList.innerHTML='<p class="session-empty">Cargando envíos…</p>';
 try{
  const data=await api("/my-games");
  if(!data.games?.length){myGamesList.innerHTML='<p class="session-empty">Todavía no has enviado juegos.</p>';return}
  myGamesList.innerHTML=data.games.map(game=>'<article class="my-game-item"><div class="my-game-info"><b>'+escapeHtml(game.title)+'</b><small>'+escapeHtml(game.category)+' · '+escapeHtml(dateLabel(game.created_at))+'</small></div><span class="submission-status status-'+escapeHtml(game.status)+'">'+escapeHtml(submissionStatus(game.status))+'</span></article>').join("");
 }catch(error){myGamesList.innerHTML='<p class="session-empty">No se pudieron cargar tus envíos.</p>';myGamesMessage.textContent=error.message}
}

const achievementsList=document.getElementById("achievements-list");
const achievementsMessage=document.getElementById("achievements-message");
const achievementTotal=document.getElementById("achievement-total");
document.getElementById("refresh-achievements").addEventListener("click",loadAchievements);
async function loadAchievements(){
 if(!currentUser){achievementsList.innerHTML='<p class="session-empty">Inicia sesión para consultar tus logros.</p>';achievementTotal.textContent="0 puntos";return}
 achievementsMessage.textContent="";
 achievementsList.innerHTML='<p class="session-empty">Cargando logros…</p>';
 try{
  const data=await api("/achievements/me");
  achievementTotal.textContent=String(Number(data.totalPoints||0))+" puntos";
  if(!data.achievements?.length){achievementsList.innerHTML='<p class="session-empty">Todavía no has conseguido logros. ¡Explora los juegos compatibles!</p>';return}
  achievementsList.innerHTML=data.achievements.map(item=>'<article class="favorite-item achievement-item"><div><b>✦ '+escapeHtml(item.title)+'</b><small>'+escapeHtml(item.game_title)+' · '+escapeHtml(item.description||"Logro conseguido")+'</small></div><span class="achievement-points">+'+Number(item.points||0)+' XP</span></article>').join("");
 }catch(error){achievementsList.innerHTML='<p class="session-empty">No se pudieron cargar tus logros.</p>';achievementsMessage.textContent=error.message}
}

const sessionsList=document.getElementById("sessions-list"),sessionsMessage=document.getElementById("sessions-message");
document.getElementById("refresh-sessions").addEventListener("click",loadSessions);
function deviceName(ua){const value=String(ua||"");if(/Android/i.test(value))return /Mobile/i.test(value)?"Android · móvil":"Android · dispositivo";if(/iPhone|iPad/i.test(value))return "Apple · iOS";if(/Windows/i.test(value))return "Windows · navegador";if(/Macintosh|Mac OS/i.test(value))return "Mac · navegador";if(/Linux/i.test(value))return "Linux · navegador";return "Navegador o dispositivo";}
function dateLabel(value){const date=new Date(value);return Number.isNaN(date.getTime())?"Fecha no disponible":new Intl.DateTimeFormat("es-CL",{dateStyle:"medium",timeStyle:"short"}).format(date);}
async function loadSessions(){if(!currentUser)return;sessionsMessage.textContent="";sessionsList.innerHTML='<p class="session-empty">Cargando sesiones…</p>';try{const data=await api("/sessions");if(!data.sessions?.length){sessionsList.innerHTML='<p class="session-empty">No hay sesiones activas.</p>';return}sessionsList.innerHTML=data.sessions.map(session=>'<article class="session-item"><div class="session-icon">⌁</div><div class="session-info"><b>'+escapeHtml(deviceName(session.user_agent))+(session.is_current?' <span class="current-session">ESTE DISPOSITIVO</span>':'')+'</b><small>Inicio: '+escapeHtml(dateLabel(session.created_at))+'</small><small>Expira: '+escapeHtml(dateLabel(session.expires_at))+'</small></div><button class="outline revoke-session" type="button" data-session-id="'+escapeHtml(session.id)+'">'+(session.is_current?"Cerrar esta sesión":"Revocar")+'</button></article>').join("");sessionsList.querySelectorAll("[data-session-id]").forEach(button=>button.addEventListener("click",()=>revokeSession(button.dataset.sessionId,button)))}catch(error){sessionsList.innerHTML='<p class="session-empty">No se pudieron cargar las sesiones.</p>';sessionsMessage.textContent=error.message}}
async function revokeSession(id,button){if(!id)return;button.disabled=true;try{const result=await api("/sessions/"+encodeURIComponent(id),{method:"DELETE"});if(result.revokedCurrent){currentUser=null;updateUserUI();dialog.close();notify("Sesión cerrada correctamente.");return}notify("Sesión revocada.");await loadSessions()}catch(error){sessionsMessage.textContent=error.message;button.disabled=false}}
authForm.addEventListener("submit",async e=>{e.preventDefault();const form=new FormData(authForm),payload={username:form.get("username"),password:form.get("password")};authSubmit.disabled=true;authMessage.textContent="Conectando…";try{const result=await api(authMode==="register"?"/register":"/login",{method:"POST",body:JSON.stringify(payload)});currentUser=result.user;updateUserUI();authForm.reset();openAccount("login");authMessage.textContent="¡Hola, "+currentUser.username+"! Tu sesión está activa."}catch(err){authMessage.textContent=err.message+(err.requestId?" (ID: "+err.requestId+")":"")}finally{authSubmit.disabled=false}});
function updateUserUI(){userChip.hidden=!currentUser;if(currentUser){userChip.textContent="✦ "+currentUser.username;userChip.title="Sesión iniciada";}const adminLink=document.getElementById("admin-link");if(adminLink)adminLink.hidden=!currentUser||currentUser.role!=="admin";if(!currentUser){favoriteSlugs.clear();updateFavoriteButtons()}document.querySelectorAll("[data-account]").forEach(b=>b.hidden=!!currentUser)}
logout.addEventListener("click",async()=>{try{await api("/logout",{method:"POST",body:"{}"})}catch{}currentUser=null;updateUserUI();dialog.close();notify("Sesión cerrada.")});
const submitDialog=document.getElementById("submit-dialog"),submitForm=document.getElementById("submit-form"),submitMessage=document.getElementById("submit-message");
document.getElementById("show-submit").addEventListener("click",()=>{if(!currentUser){openAccount("login");authMessage.textContent="Inicia sesión para enviar un juego.";return}submitMessage.textContent="";submitDialog.showModal()});
document.getElementById("submit-close").addEventListener("click",()=>submitDialog.close());submitDialog.addEventListener("click",e=>{if(e.target===submitDialog)submitDialog.close()});
submitForm.addEventListener("submit",async e=>{e.preventDefault();const f=new FormData(submitForm),payload=Object.fromEntries(f.entries());try{const result=await api("/submit-game",{method:"POST",body:JSON.stringify(payload)});submitMessage.textContent=result.message;submitForm.reset();loadMyGames()}catch(err){submitMessage.textContent=err.message}});

const favoritesList=document.getElementById("favorites-list");
const favoritesMessage=document.getElementById("favorites-message");
document.getElementById("refresh-favorites").addEventListener("click",loadFavorites);
async function loadFavorites(){
 if(!currentUser){favoritesList.innerHTML='<p class="session-empty">Inicia sesión para ver tus favoritos.</p>';return}
 favoritesMessage.textContent="";
 try{
  const data=await api("/favorites");
  favoriteSlugs.clear();
  for(const game of data.games||[])favoriteSlugs.add(game.slug);
  updateFavoriteButtons();
  if(!data.games?.length){favoritesList.innerHTML='<p class="session-empty">Todavía no has guardado juegos.</p>';return}
  favoritesList.innerHTML=data.games.map(game=>'<article class="favorite-item"><div><b>'+escapeHtml(game.title)+'</b><small>'+escapeHtml(game.category)+'</small></div><a href="'+safeUrl(game.launch_url)+'" target="_blank" rel="noopener noreferrer">Jugar ↗</a></article>').join("");
 }catch(error){favoritesMessage.textContent=error.message}
}
function updateFavoriteButtons(){
 document.querySelectorAll("[data-favorite-slug]").forEach(button=>{
  const active=favoriteSlugs.has(button.dataset.favoriteSlug);
  button.setAttribute("aria-pressed",String(active));
  button.textContent=active?"★":"♡";
  button.title=active?"Quitar de favoritos":"Guardar en favoritos";
 });
}

const playDialog=document.getElementById("play-dialog"),playFrame=document.getElementById("play-frame"),playTitle=document.getElementById("play-title"),playStatus=document.getElementById("play-status"),playXp=document.getElementById("play-xp"),playOpenExternal=document.getElementById("play-open-external");
let activePlaySession=null,playHeartbeat=null,playGame=null;
async function stopPlaySession(){
 if(playHeartbeat){clearInterval(playHeartbeat);playHeartbeat=null}
 if(activePlaySession&&currentUser){
  try{await api("/play/"+encodeURIComponent(playGame.slug)+"/end",{method:"POST",body:JSON.stringify({sessionId:activePlaySession})})}catch{}
 }
 activePlaySession=null;playGame=null;
 playFrame.src="about:blank";
}
async function openEmbeddedGame(slug){
 const game=catalogGames.find(item=>item.slug===slug);
 if(!game||!game.embed_enabled||!game.embed_url)return;
 let embed;
 try{embed=new URL(game.embed_url);if(embed.protocol!=="https:")throw new Error()}catch{notify("Este juego no tiene un enlace integrado válido.");return}
 playGame=game;playTitle.textContent=game.title;playStatus.textContent=currentUser?"Preparando sesión Joynexa…":"Puedes jugar, pero inicia sesión para guardar XP.";
 playXp.textContent="XP: —";playOpenExternal.href=safeUrl(game.launch_url);
 try{
  if(currentUser){
   const session=await api("/play/"+encodeURIComponent(slug)+"/start",{method:"POST",body:"{}"});
   activePlaySession=session.sessionId;playStatus.textContent="Sesión Joynexa activa · 1 XP por minuto jugado · límite diario 120 XP.";
   playHeartbeat=setInterval(async()=>{
    if(!activePlaySession)return;
    try{const result=await api("/play/"+encodeURIComponent(slug)+"/heartbeat",{method:"POST",body:JSON.stringify({sessionId:activePlaySession})});if(result.earnedXp)playXp.textContent="XP: +"+result.earnedXp+" · Total "+result.totalXp;if(result.dailyXp>=120)playStatus.textContent="Has alcanzado el límite diario de XP."; }catch{}
   },60000);
  }
 }catch(error){playStatus.textContent="Modo invitado: "+error.message}
 playFrame.src=embed.href;
 if(!playDialog.open)playDialog.showModal();
}
document.getElementById("games-grid").addEventListener("click",event=>{
 const button=event.target.closest("[data-play-slug]");
 if(button){event.preventDefault();openEmbeddedGame(button.dataset.playSlug)}
});
document.getElementById("play-close").addEventListener("click",async()=>{await stopPlaySession();if(playDialog.open)playDialog.close()});
playDialog.addEventListener("cancel",()=>{stopPlaySession()});
playDialog.addEventListener("close",()=>{stopPlaySession()});
document.getElementById("play-fullscreen").addEventListener("click",()=>{if(playFrame.requestFullscreen)playFrame.requestFullscreen().catch(()=>notify("El navegador no permitió pantalla completa."))});

document.getElementById("games-grid").addEventListener("click",async event=>{
 const button=event.target.closest("[data-favorite-slug]");
 if(!button)return;
 event.preventDefault();event.stopPropagation();
 if(!currentUser){openAccount("login");authMessage.textContent="Inicia sesión para guardar favoritos.";return}
 const slug=button.dataset.favoriteSlug;
 button.disabled=true;
 try{
  const active=favoriteSlugs.has(slug);
  await api("/favorites/"+encodeURIComponent(slug),{method:active?"DELETE":"POST"});
  if(active)favoriteSlugs.delete(slug);else favoriteSlugs.add(slug);
  updateFavoriteButtons();
  await loadFavorites();
 }catch(error){favoritesMessage.textContent=error.message}
 finally{button.disabled=false}
});

const toast=document.getElementById("toast");function notify(message){toast.textContent=message;toast.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove("show"),2500)}

document.getElementById("year").textContent=new Date().getFullYear();document.addEventListener("keydown",e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"){e.preventDefault();search.focus()}});filters.forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.filter==="all")));
async function initialize(){
 try{
  const data=await api("/games");
  catalogGames=Array.isArray(data.games)?data.games:[];
  catalogGames.sort((a,b)=>(a.catalog_tier==="featured"?0:1)-(b.catalog_tier==="featured"?0:1)||String(a.title).localeCompare(String(b.title),"es"));
  applyFilters();
 }catch(error){
  document.getElementById("games-grid").innerHTML="";
  cards.splice(0,cards.length);
  empty.hidden=false;
  empty.textContent="No se pudo cargar el catálogo. Inténtalo de nuevo más tarde.";
  const countLabel=document.getElementById("catalog-count");
  if(countLabel)countLabel.textContent="Catálogo no disponible";
 }
 try{
  const me=await api("/me");
  currentUser=me.user;
  updateUserUI();
  if(currentUser){loadProfile();loadFavorites();loadAchievements()}
 }catch{}
 const publicUsername=new URLSearchParams(location.search).get("profile");
 if(publicUsername)openPublicProfile(publicUsername);
}
function escapeHtml(value){return String(value||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function safeUrl(value){try{const u=new URL(value);return u.protocol==="https:"?u.href:"#"}catch{return "#"}}

const profileForm=document.getElementById("profile-form");
const profileMessage=document.getElementById("profile-message");
const shareProfileButton=document.getElementById("share-profile");
const avatarSymbols={star:"✦",planet:"🪐",comet:"☄",controller:"🎮",pixel:"▦",fox:"🦊",robot:"🤖",gem:"💎"};
async function loadProfile(){
 if(!currentUser)return;
 profileMessage.textContent="Cargando perfil…";
 try{
  const data=await api("/profile/me");
  const p=data.profile;
  document.getElementById("profile-display-name").value=p.displayName||currentUser.username;
  document.getElementById("profile-bio").value=p.bio||"";
  document.getElementById("profile-avatar").value=p.avatarKey||"star";
  document.querySelector("#account-profile .profile-avatar").textContent=avatarSymbols[p.avatarKey]||"✦";
  document.getElementById("profile-public").checked=!!p.isPublic;
  shareProfileButton.disabled=!p.isPublic;
  profileMessage.textContent=p.isPublic?"Tu perfil está publicado.":"Tu perfil es privado.";
 }catch(error){profileMessage.textContent=error.message}
}
profileForm.addEventListener("submit",async event=>{
 event.preventDefault();
 if(!currentUser)return;
 const button=document.getElementById("save-profile");
 const payload={
  displayName:document.getElementById("profile-display-name").value,
  bio:document.getElementById("profile-bio").value,
  avatarKey:document.getElementById("profile-avatar").value,
  isPublic:document.getElementById("profile-public").checked
 };
 button.disabled=true;profileMessage.textContent="Guardando…";
 try{
  const result=await api("/profile/me",{method:"PUT",body:JSON.stringify(payload)});
  shareProfileButton.disabled=!result.profile.isPublic;
  document.querySelector("#account-profile .profile-avatar").textContent=avatarSymbols[result.profile.avatarKey]||"✦";
  profileMessage.textContent=result.profile.isPublic?"Perfil guardado y publicado.":"Perfil guardado como privado.";
  notify("Perfil Joynexa actualizado.");
 }catch(error){profileMessage.textContent=error.message}
 finally{button.disabled=false}
});
shareProfileButton.addEventListener("click",async()=>{
 if(!currentUser||shareProfileButton.disabled)return;
 const url=new URL(location.href);url.searchParams.set("profile",currentUser.username);url.hash="";
 try{await navigator.clipboard.writeText(url.toString());notify("Enlace del perfil copiado.");}
 catch{profileMessage.textContent=url.toString();}
});
const publicProfileDialog=document.getElementById("public-profile-dialog");
document.getElementById("public-profile-close").addEventListener("click",()=>publicProfileDialog.close());
async function openPublicProfile(username){
 const message=document.getElementById("public-profile-message");
 message.textContent="Cargando perfil…";
 publicProfileDialog.showModal();
 try{
  const data=await api("/users/"+encodeURIComponent(username)+"/profile");
  const p=data.profile;
  document.getElementById("public-avatar").textContent=avatarSymbols[p.avatarKey]||"✦";
  document.getElementById("public-display-name").textContent=p.displayName;
  document.getElementById("public-username").textContent="@"+p.username;
  document.getElementById("public-bio").textContent=p.bio||"Este jugador aún no ha escrito una biografía.";
  const gamesBox=document.getElementById("public-games");
  gamesBox.innerHTML='<p>Buscando juegos…</p>';
  try{
   const gamesData=await api("/users/"+encodeURIComponent(username)+"/games");
   if(!gamesData.games?.length){gamesBox.innerHTML='<p>Este creador aún no tiene juegos publicados.</p>';}
   else gamesBox.innerHTML=gamesData.games.map(game=>'<article class="public-game"><div><b>'+escapeHtml(game.title)+'</b><small>'+escapeHtml(game.category)+'</small></div><a href="'+safeUrl(game.launch_url)+'" target="_blank" rel="noopener noreferrer">Jugar ↗</a></article>').join("");
  }catch{gamesBox.innerHTML='<p>No se pudieron cargar los juegos publicados.</p>';}
  message.textContent="";
 }catch(error){
  document.getElementById("public-display-name").textContent="Perfil no disponible";
  document.getElementById("public-username").textContent="";
  document.getElementById("public-bio").textContent="";
  message.textContent=error.message;
 }
}

initialize();
