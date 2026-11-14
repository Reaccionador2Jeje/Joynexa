const search=document.getElementById("search");
const cards=[...document.querySelectorAll(".game")];
const filters=[...document.querySelectorAll("[data-filter]")];
const empty=document.getElementById("empty");
let category="all",toastTimer;
function applyFilters(){const q=search.value.trim().toLocaleLowerCase("es");let count=0;cards.forEach(card=>{const ok=(category==="all"||card.dataset.kind===category)&&card.dataset.name.toLocaleLowerCase("es").includes(q);card.hidden=!ok;if(ok)count++});empty.hidden=count!==0;document.getElementById("games-grid").hidden=count===0}
search.addEventListener("input",applyFilters);
filters.forEach(btn=>btn.addEventListener("click",()=>{category=btn.dataset.filter;filters.forEach(b=>b.classList.toggle("chosen",b===btn));applyFilters()}));
document.querySelectorAll("[data-jump]").forEach(btn=>btn.addEventListener("click",()=>{category=btn.dataset.jump;filters.forEach(b=>b.classList.toggle("chosen",b.dataset.filter===category));search.value="";applyFilters();document.getElementById("games").scrollIntoView({behavior:"smooth"})}));
const nav=document.getElementById("nav"),menu=document.getElementById("menu");
menu.addEventListener("click",()=>nav.classList.toggle("open"));
nav.querySelectorAll("a").forEach(a=>a.addEventListener("click",()=>nav.classList.remove("open")));
const dialog=document.getElementById("account");
document.querySelectorAll("[data-account]").forEach(b=>b.addEventListener("click",()=>dialog.showModal()));
document.getElementById("close").addEventListener("click",()=>dialog.close());
document.getElementById("ok").addEventListener("click",()=>dialog.close());
dialog.addEventListener("click",e=>{if(e.target===dialog)dialog.close()});
const toast=document.getElementById("toast");
function notify(message){toast.textContent=message;toast.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove("show"),2500)}
cards.forEach(card=>{card.addEventListener("click",()=>notify(card.dataset.name+" todavía no está publicado."));card.setAttribute("tabindex","0");card.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();notify(card.dataset.name+" todavía no está publicado.")}})});
document.getElementById("year").textContent=new Date().getFullYear();
document.addEventListener("keydown",e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"){e.preventDefault();search.focus()}});
filters.forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.filter==="all")));