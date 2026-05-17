export const T = {
  bg: "#050607",
  bg1: "rgba(12, 14, 15, .84)",
  bg2: "rgba(20, 23, 23, .62)",
  bg3: "rgba(255, 255, 255, .07)",
  bg4: "rgba(31, 35, 34, .78)",
  line: "rgba(255, 255, 255, .10)",
  line2: "rgba(255, 255, 255, .16)",
  gold: "#D8B661",
  gold2: "#F2D88D",
  text: "#F6F1E7",
  text2: "#B9C0BC",
  text3: "#7B8681",
  red: "#F06F6F",
  green: "#6FD69A",
  blue: "#72B7D8",
  mint: "#79D9C5",
  rose: "#E991AE",
  shadow: "0 20px 70px rgba(0,0,0,.36)",
  shadowSoft: "0 12px 36px rgba(0,0,0,.24)",
  blur: "blur(22px) saturate(148%)",
};

export const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@400;500;600;700&display=swap');
:root{
  --rw-bg:${T.bg};
  --rw-bg-1:${T.bg1};
  --rw-bg-2:${T.bg2};
  --rw-bg-3:${T.bg3};
  --rw-bg-4:${T.bg4};
  --rw-line:${T.line};
  --rw-line-2:${T.line2};
  --rw-gold:${T.gold};
  --rw-gold-2:${T.gold2};
  --rw-text:${T.text};
  --rw-text-2:${T.text2};
  --rw-text-3:${T.text3};
  --rw-red:${T.red};
  --rw-green:${T.green};
  --rw-blue:${T.blue};
  --rw-mint:${T.mint};
  --rw-rose:${T.rose};
  --rw-shadow:${T.shadow};
  --rw-shadow-soft:${T.shadowSoft};
  --rw-blur:${T.blur};
  --rw-radius:18px;
  --rw-radius-sm:12px;
}
*{box-sizing:border-box}
html,body{margin:0;padding:0;height:100%;background:var(--rw-bg);color:var(--rw-text);font-family:'DM Sans',sans-serif}
body{overflow:hidden;background:
  linear-gradient(180deg,#050607 0%,#0b0d0d 48%,#050607 100%),
  linear-gradient(135deg,rgba(216,182,97,.08),rgba(121,217,197,.06));
}
button,input,textarea,select{font:inherit}
button{outline:none}
button:focus-visible,input:focus-visible,textarea:focus-visible,select:focus-visible{box-shadow:0 0 0 3px rgba(216,182,97,.22)}
::selection{background:rgba(216,182,97,.28);color:var(--rw-text)}
.app-frame{position:relative;isolation:isolate}
.app-frame:before{content:"";position:absolute;inset:0;pointer-events:none;background:
  linear-gradient(120deg,rgba(216,182,97,.08),transparent 34%),
  linear-gradient(240deg,rgba(121,217,197,.08),transparent 42%);
  mask-image:linear-gradient(to bottom,black,transparent 72%);
}
.scroll{overflow-y:auto;-webkit-overflow-scrolling:touch;scrollbar-color:rgba(255,255,255,.16) transparent}
.scroll::-webkit-scrollbar{width:8px;height:8px}
.scroll::-webkit-scrollbar-thumb{background:rgba(255,255,255,.14);border-radius:999px}
.glass,.card,.panel{
  background:linear-gradient(180deg,rgba(255,255,255,.095),rgba(255,255,255,.045));
  border:1px solid var(--rw-line);
  box-shadow:var(--rw-shadow-soft);
  backdrop-filter:var(--rw-blur);
  -webkit-backdrop-filter:var(--rw-blur);
}
.card{border-radius:var(--rw-radius)}
.panel{border-radius:var(--rw-radius-sm)}
.card,.panel{transition:transform .18s ease,border-color .18s ease,background .18s ease,box-shadow .18s ease}
button.card:hover,button.panel:hover,.offer-card:hover{transform:translateY(-2px);border-color:rgba(216,182,97,.28);box-shadow:0 18px 48px rgba(0,0,0,.34)}
.inp{
  width:100%;
  background:rgba(255,255,255,.07);
  border:1px solid var(--rw-line);
  border-radius:14px;
  padding:12px 14px;
  color:var(--rw-text);
  outline:none;
  transition:border-color .16s ease,background .16s ease,box-shadow .16s ease;
}
.inp::placeholder{color:rgba(185,192,188,.52)}
.inp:focus{border-color:rgba(216,182,97,.62);background:rgba(255,255,255,.095)}
.btn-primary,.btn-ghost{
  display:inline-flex;align-items:center;justify-content:center;gap:8px;
  min-height:42px;border-radius:14px;padding:11px 15px;font-weight:800;cursor:pointer;
  transition:transform .16s ease,box-shadow .16s ease,border-color .16s ease,background .16s ease,opacity .16s ease;
}
.btn-primary{
  border:1px solid rgba(242,216,141,.45);
  background:linear-gradient(135deg,var(--rw-gold),var(--rw-gold-2));
  color:#171004;
  box-shadow:0 12px 28px rgba(216,182,97,.22);
}
.btn-primary:hover{transform:translateY(-1px);box-shadow:0 16px 34px rgba(216,182,97,.28)}
.btn-primary:active,.btn-ghost:active{transform:translateY(1px) scale(.99)}
.btn-primary:disabled,.btn-ghost:disabled{opacity:.45;cursor:not-allowed;transform:none;box-shadow:none}
.btn-ghost{
  border:1px solid var(--rw-line-2);
  background:rgba(255,255,255,.055);
  color:var(--rw-text);
  backdrop-filter:var(--rw-blur);
  -webkit-backdrop-filter:var(--rw-blur);
}
.btn-ghost:hover{border-color:rgba(216,182,97,.26);background:rgba(255,255,255,.085)}
.pill{
  display:inline-flex;align-items:center;gap:6px;padding:8px 12px;border-radius:999px;
  border:1px solid var(--rw-line);background:rgba(255,255,255,.055);color:var(--rw-text-2);
  cursor:pointer;white-space:nowrap;transition:background .16s ease,border-color .16s ease,color .16s ease,transform .16s ease;
}
.pill:hover{transform:translateY(-1px);border-color:rgba(216,182,97,.22);color:var(--rw-text)}
.pill.active{border-color:rgba(216,182,97,.48);color:var(--rw-gold-2);background:rgba(216,182,97,.12)}
.gold-badge,.blue-badge,.red-badge,.green-badge{
  display:inline-flex;align-items:center;gap:6px;padding:4px 9px;border-radius:999px;font-size:11px;font-weight:800;
  backdrop-filter:var(--rw-blur);-webkit-backdrop-filter:var(--rw-blur);
}
.gold-badge{background:rgba(216,182,97,.13);border:1px solid rgba(216,182,97,.32);color:var(--rw-gold-2)}
.blue-badge{background:rgba(114,183,216,.13);border:1px solid rgba(114,183,216,.28);color:var(--rw-blue)}
.red-badge{background:rgba(240,111,111,.13);border:1px solid rgba(240,111,111,.28);color:var(--rw-red)}
.green-badge{background:rgba(111,214,154,.13);border:1px solid rgba(111,214,154,.28);color:var(--rw-green)}
.title{font-family:'Syne',sans-serif;font-weight:800;letter-spacing:0}
.muted{color:var(--rw-text-2)}
.subtle{color:var(--rw-text-3)}
.hide-scrollbar::-webkit-scrollbar{display:none}
.hide-scrollbar{scrollbar-width:none}
.sheet-shell{background:linear-gradient(180deg,rgba(18,21,21,.92),rgba(10,12,12,.94));box-shadow:0 -18px 70px rgba(0,0,0,.45)}
.toast{animation:toastIn .22s ease both}
.offer-card{position:relative}
.offer-card:after{content:"";position:absolute;inset:0;pointer-events:none;border-radius:inherit;background:linear-gradient(135deg,rgba(255,255,255,.10),transparent 42%);opacity:.55}
.balance-chip{background:rgba(255,255,255,.075);border:1px solid rgba(216,182,97,.24);box-shadow:var(--rw-shadow-soft);backdrop-filter:var(--rw-blur);-webkit-backdrop-filter:var(--rw-blur)}
.empty-state{padding:28px 18px;text-align:center;color:var(--rw-text-2)}
.empty-state-title{font-weight:800;color:var(--rw-text);margin-bottom:6px}
.inline-error{padding:12px 14px;border-radius:14px;border:1px solid rgba(240,111,111,.24);background:rgba(240,111,111,.09);color:var(--rw-red);font-size:13px;line-height:1.55}
.field-help{color:var(--rw-text-3);font-size:12px;line-height:1.45;margin-top:7px}
.hint-panel{padding:14px;border-radius:var(--rw-radius-sm);border:1px solid rgba(216,182,97,.18);background:linear-gradient(135deg,rgba(216,182,97,.105),rgba(121,217,197,.075));color:var(--rw-text-2);line-height:1.55}
.action-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.responsive-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.stat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(104px,1fr));gap:10px}
.form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.list-stack{display:flex;flex-direction:column;gap:10px}
.danger-button{border-color:rgba(240,111,111,.26)!important;color:var(--rw-red)!important;background:rgba(240,111,111,.075)!important}
.danger-button:hover{border-color:rgba(240,111,111,.38)!important;background:rgba(240,111,111,.12)!important}
.icon-danger{
  width:32px;height:32px;border-radius:999px;border:1px solid rgba(240,111,111,.28);
  background:rgba(5,6,7,.74);color:var(--rw-red);font-weight:900;cursor:pointer;
  display:grid;place-items:center;backdrop-filter:var(--rw-blur);-webkit-backdrop-filter:var(--rw-blur);
  transition:transform .16s ease,border-color .16s ease,background .16s ease,opacity .16s ease;
}
.icon-danger:hover{transform:translateY(-1px);border-color:rgba(240,111,111,.46);background:rgba(240,111,111,.14)}
.icon-danger:disabled{opacity:.45;cursor:not-allowed;transform:none}
.floating-chip{
  border:1px solid rgba(216,182,97,.30);border-radius:999px;background:rgba(5,6,7,.74);
  color:var(--rw-gold-2);font-size:11px;font-weight:800;padding:8px 10px;cursor:pointer;
  box-shadow:0 10px 26px rgba(0,0,0,.28);backdrop-filter:var(--rw-blur);-webkit-backdrop-filter:var(--rw-blur);
  transition:transform .16s ease,border-color .16s ease,background .16s ease,opacity .16s ease;
}
.floating-chip:hover{transform:translateY(-1px);border-color:rgba(216,182,97,.52);background:rgba(216,182,97,.14)}
.floating-chip:disabled{opacity:.48;cursor:not-allowed;transform:none}
.skeleton{position:relative;overflow:hidden;background:rgba(255,255,255,.07)}
.skeleton:after{content:"";position:absolute;inset:0;transform:translateX(-100%);background:linear-gradient(90deg,transparent,rgba(255,255,255,.12),transparent);animation:shimmer 1.4s infinite}
.skeleton-list{display:flex;flex-direction:column;gap:10px}
.skeleton-row{height:74px;border-radius:var(--rw-radius-sm)}
.skeleton-card{height:226px;border-radius:18px}
.chat-bubble{max-width:78%;padding:12px 14px;border:1px solid var(--rw-line);background:rgba(255,255,255,.06);line-height:1.6}
.chat-bubble.mine{border-color:rgba(216,182,97,.28);background:rgba(216,182,97,.14)}
.review-star{background:transparent;border:none;font-size:28px;cursor:pointer;line-height:1;padding:2px 3px;border-radius:10px;transition:transform .14s ease,color .14s ease}
.review-star:hover{transform:translateY(-1px)}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes toastIn{from{opacity:0;transform:translate(-50%,8px)}to{opacity:1;transform:translate(-50%,0)}}
@keyframes shimmer{100%{transform:translateX(100%)}}
@media (min-width:720px){
  .app-frame{border-left:1px solid rgba(255,255,255,.06);border-right:1px solid rgba(255,255,255,.06)}
}
@media (max-width:520px){
  .responsive-grid,.form-grid{grid-template-columns:1fr}
  .action-row{align-items:stretch}
  .action-row>.btn-primary,.action-row>.btn-ghost,.action-row>button{flex:1 1 100%}
  .chat-bubble{max-width:88%}
}
`;
