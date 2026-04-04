import{A as e,C as t,D as n,T as r,f as i,h as a,p as o,t as s,w as ee}from"./jsx-runtime-Bi5Q5u0f.js";import{a as te,i as c,o as l}from"./index-vB9uh_Qg.js";import{a as ne,b as re,d as ie,f as ae,g as oe,i as se,o as ce,p as le,s as ue,t as de,u as fe,v as pe,x as me,y as he}from"./AppSidebarLayout-C7zPEQNU.js";import{n as ge}from"./receiptSettings-e7jaEQ_M.js";import{i as _e,r as ve,t as ye}from"./saleDrafts-BvjYVUHA.js";var u=e(n(),1),d=s();function be(e){return e.printer_name?e.printer_target?`${e.printer_name} (${e.printer_target})`:e.printer_name:`No Printer`}function f(e){return Number(e||0).toFixed(2)}function p(e){let t=Number(e?.display_position);return Number.isFinite(t)&&t>=1?t:9999}function xe(e){return[...e||[]].sort((e,t)=>{let n=String(e.category_name||``).localeCompare(String(t.category_name||``));if(n!==0)return n;let r=p(e)-p(t);return r===0?String(e.name||``).localeCompare(String(t.name||``)):r})}function m(e){return String(e??``).replaceAll(`&`,`&amp;`).replaceAll(`<`,`&lt;`).replaceAll(`>`,`&gt;`).replaceAll(`"`,`&quot;`).replaceAll(`'`,`&#39;`)}function Se(e){let t=e instanceof Date?e:new Date(e||Date.now());return Number.isNaN(t.getTime())?String(e||``):t.toLocaleString(`en-US`,{month:`short`,day:`numeric`,year:`numeric`,hour:`numeric`,minute:`2-digit`,second:`2-digit`,hour12:!0})}function Ce(e){return String(e||`DINE IN`).trim().toUpperCase()}function we(e){let t=String(e||`CENTER`).trim().toUpperCase();return t===`LEFT`?`align-left`:t===`RIGHT`?`align-right`:`align-center`}function Te(e){let t=Number(e),n=Number.isFinite(t)?Math.min(Math.max(Math.round(t),80),300):200;return`max-width:${n}px;max-height:${Math.max(Math.round(n*.38),40)}px;`}function h(e,t=13){if(typeof e==`string`){let t=e.trim().toUpperCase();if(t===`SMALL`)return 11;if(t===`MEDIUM`)return 13;if(t===`LARGE`)return 18}let n=Number(e);return Number.isFinite(n)?Math.min(Math.max(Math.round(n),9),56):t}function g(e,t=13){let n=h(e,t);return`font-size:${n}px;line-height:${Math.max(Math.round(n*1.35),n+2)}px;`}function _(e){let t=String(e||``).split(/\r?\n/).map(e=>e.trim()).filter(Boolean);return t.length===0?``:t.map(e=>m(e)).join(`<br />`)}function Ee(e){let t=String(e?.header_text||``).split(/\r?\n/).map(e=>e.trim()).filter(Boolean);if(t.length===0)return``;let[n,...r]=t;return`
    <div class="receipt-header ${we(e?.header_alignment)}" style="${g(e?.header_font_size,18)}">
      <div class="receipt-header-primary">${m(n)}</div>
      ${r.length>0?`<div class="receipt-header-secondary">${r.map(e=>m(e)).join(`<br />`)}</div>`:``}
    </div>
  `}function De(e){if(!e?.footer_enabled)return``;let t=_(e.footer_text);return t?`
    <div class="divider"></div>
    <div class="receipt-footer-text ${we(e.footer_alignment)}" style="${g(e.footer_font_size,12)}">${t}</div>
  `:``}function Oe(e){let t=Number(e);return Number.isFinite(t)&&t>0?String(Math.trunc(t)).padStart(5,`0`):String(e||`-`).trim()||`-`}function ke(e,t){let n=e?.response?.data;return typeof n==`string`&&n.trim()?n.trim():n?.error?String(n.error):n?.detail?String(n.detail):e?.message?String(e.message):t}function v(e){let t=e.created_by_user_id?`-owner-${e.created_by_user_id}`:e.created_by_username?`-owner-${String(e.created_by_username).trim().toLowerCase()}`:``;return e.id?`line-${e.id}`:e.product_id?`product-${e.product_id}${t}`:`name-${e.item_name||e.name}${t}`}function Ae(e){return e===`RUNNING_ORDER`?`Running Order`:e===`OCCUPIED`?`Occupied`:`Vacant`}function je(e){return e===`RUNNING_ORDER`?`bg-amber-100 text-amber-700`:e===`OCCUPIED`?`bg-rose-100 text-rose-700`:`bg-emerald-100 text-emerald-700`}function Me(e,t,n){let r=[];return Number(e||0)>0&&r.push(`CASH`),Number(t||0)>0&&r.push(`CARD`),Number(n||0)>0&&r.push(`UPI`),r.length>1?`MIXED`:r[0]||`CASH`}function Ne(e,t,n){let r=[];return Number(n||0)>0&&r.push(`UPI ${f(n)}`),Number(e||0)>0&&r.push(`Cash ${f(e)}`),Number(t||0)>0&&r.push(`Card ${f(t)}`),r}function Pe(e,t){let n=Number(t||0);if(!Number.isFinite(n)||n<=0)return{items:[],allocatedTotal:0};let r=n,i=[];return e.forEach(e=>{if(r<=0)return;let t=Number(e.sale_price||0);if(t<=0)return;let n=Math.min(e.qty,Math.floor((r+1e-4)/t));n<=0||(i.push({...e,qty:n}),r=Number((r-t*n).toFixed(2)))}),{items:i,allocatedTotal:i.reduce((e,t)=>e+Number(t.sale_price||0)*t.qty,0)}}function y(e){return!!String(e?.printer_target||``).trim()}function Fe(e,t){let n=y(e);return{cartKey:v({product_id:e.id,item_name:e.name,created_by_user_id:t?.id??null,created_by_username:t?.username||null}),product_id:e.id,name:e.name,sale_price:Number(e.sale_price||0),qty:1,tax_mode:e.tax_mode||`NO_TAX`,printer_name:e.printer_name||null,printer_target:e.printer_target||null,sale_item_id:null,kot_printed_qty:0,pending_qty:n?1:0,created_by_user_id:t?.id??null,created_by_username:t?.username||null}}function Ie(e){let t=y(e),n=Number(e.qty||0),r=Number(e.kot_printed_qty||0);return{cartKey:v(e),sale_item_id:e.id||null,product_id:e.product_id||null,name:e.item_name,sale_price:Number(e.unit_price||0),qty:n,tax_mode:e.tax_mode||`NO_TAX`,printer_name:e.printer_name||null,printer_target:e.printer_target||null,kot_printed_qty:r,pending_qty:e.pending_qty==null?t?Math.max(n-r,0):0:Number(e.pending_qty||0),created_by_user_id:e.created_by_user_id??null,created_by_username:e.created_by_username||null}}function Le(e,t,n=`receipt`){let r=window.open(``,`_blank`,`width=960,height=720`);if(!r){alert(`Allow popups to print`);return}r.document.write(`
    <html>
      <head>
        <title>${m(e)}</title>
        <style>
          @page {
            size: 80mm auto;
            margin: 4mm 3mm;
          }
          html {
            background: #ffffff;
          }
          body {
            width: 72mm;
            margin: 0 auto;
            font-family: "Courier New", Courier, monospace;
            color: #111111;
            font-size: 12px;
            line-height: 1.3;
            background: #ffffff;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .ticket {
            width: 100%;
          }
          .receipt,
          .receipt * {
            font-weight: 700;
          }
          .ticket + .ticket {
            margin-top: 14px;
            padding-top: 10px;
            border-top: 1px dashed #111111;
          }
          .center {
            text-align: center;
          }
          .align-left {
            text-align: left;
          }
          .align-center {
            text-align: center;
          }
          .align-right {
            text-align: right;
          }
          .brand {
            font-size: 20px;
            font-weight: 700;
            text-align: center;
            text-transform: uppercase;
            letter-spacing: 0.04em;
          }
          .brand-sub {
            margin-top: 2px;
            text-align: center;
            font-size: 11px;
          }
          .receipt-logo {
            display: inline-block;
            margin: 0 0 6px;
            object-fit: contain;
          }
          .receipt-header {
            margin-bottom: 6px;
          }
          .receipt-header-primary {
            font-size: 1.15em;
            line-height: 1.25;
          }
          .receipt-header-secondary {
            margin-top: 2px;
            font-size: 0.8em;
            line-height: 1.45;
            white-space: pre-line;
          }
          .ticket-title {
            margin: 4px 0 6px;
            text-align: center;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }
          .token-order {
            margin: 4px 0 6px;
            font-size: 18px;
            font-weight: 700;
            text-transform: uppercase;
          }
          .meta-row,
          .summary-row {
            display: flex;
            justify-content: space-between;
            gap: 8px;
            margin: 2px 0;
            align-items: flex-start;
          }
          .meta-row span:first-child,
          .summary-row span:first-child {
            font-weight: 700;
          }
          .meta-row span:last-child,
          .summary-row span:last-child {
            text-align: right;
          }
          .divider {
            margin: 8px 0;
            border-top: 1px dashed #111111;
          }
          table {
            width: 100%;
            border-collapse: collapse;
          }
          .receipt-table {
            table-layout: fixed;
          }
          .receipt-table th,
          .receipt-table td {
            padding: 3px 0;
            text-align: left;
            vertical-align: top;
          }
          .receipt-table th {
            text-transform: uppercase;
            border-bottom: 2px dashed #111111;
            padding-bottom: 5px;
          }
          .receipt-table.receipt-font--small th,
          .receipt-table.receipt-font--small td {
            font-size: 10px;
          }
          .receipt-table.receipt-font--medium th,
          .receipt-table.receipt-font--medium td {
            font-size: 12px;
          }
          .receipt-table.receipt-font--large th,
          .receipt-table.receipt-font--large td {
            font-size: 14px;
          }
          .receipt-compact-items {
            display: grid;
            gap: 3px;
          }
          .receipt-compact-head,
          .receipt-compact-row {
            display: grid;
            grid-template-columns: minmax(0, 1fr) 12mm 18mm;
            gap: 8px;
            align-items: flex-start;
          }
          .receipt-compact-head {
            text-transform: uppercase;
            border-bottom: 2px dashed #111111;
            padding-bottom: 4px;
            margin-bottom: 2px;
          }
          .receipt-compact-head span:first-child,
          .receipt-compact-row span:first-child,
          .receipt-table .item-name {
            overflow: hidden;
            word-break: break-word;
          }
          .receipt-compact-head span:nth-child(2),
          .receipt-compact-row span:nth-child(2),
          .receipt-compact-head span:last-child,
          .receipt-compact-row span:last-child {
            text-align: right;
          }
          .right {
            text-align: right;
          }
          .summary-row.total {
            font-size: 1.08em;
          }
          .summary-row.total span:first-child,
          .summary-row.total span:last-child {
            font-weight: 700;
          }
          .token-item-head {
            text-transform: uppercase;
            margin-bottom: 4px;
          }
          .token,
          .token * {
            font-weight: 700;
          }
          .token-table-name {
            text-align: center;
            font-size: 24px;
            text-transform: uppercase;
            margin: 4px 0 10px;
            letter-spacing: 0.03em;
          }
          .token-line-head,
          .token-line {
            display: grid;
            grid-template-columns: 16mm minmax(0, 1fr);
            column-gap: 4px;
            align-items: start;
          }
          .token-line-head {
            margin-bottom: 2px;
            text-transform: uppercase;
          }
          .token-line {
            padding: 3px 0;
            font-size: 14px;
            text-transform: uppercase;
          }
          .token-qty {
            white-space: nowrap;
          }
          .token-name {
            word-break: break-word;
          }
          .receipt-footer-text {
            margin-top: 10px;
            font-weight: 700;
            white-space: pre-line;
            line-height: 1.45;
          }
          .small-note {
            margin-top: 6px;
            text-align: center;
            font-size: 11px;
            text-transform: uppercase;
          }
          .receipt-table .item-name {
            width: 58%;
          }
          .receipt-table .item-price {
            width: 26%;
          }
          .receipt-table .item-qty {
            width: 16%;
          }
          .token .ticket-title {
            margin-top: 0;
          }
        </style>
      </head>
      <body class="${m(n)}">${t}</body>
    </html>
  `),r.document.close();let i=!1,a=()=>{i||(i=!0,r.focus(),r.print())},o=Array.from(r.document.images||[]),s=0;if(o.forEach(e=>{if(e.complete)return;s+=1;let t=()=>{--s,s<=0&&setTimeout(a,150)};e.addEventListener(`load`,t,{once:!0}),e.addEventListener(`error`,t,{once:!0})}),s===0){setTimeout(a,250);return}setTimeout(a,1600)}function Re({tableLabel:e,orderNumber:t,updatedAt:n,senderLabel:r,items:i}){return`
    <section class="ticket token">
      <div class="token-table-name">${m(e)}</div>
      <div class="meta-row"><span>Order No:</span><span>${m(t)}</span></div>
      <div class="meta-row"><span>Date:</span><span>${m(Se(n))}</span></div>
      <div class="meta-row"><span>Sender:</span><span>${m(r)}</span></div>
      <div class="divider"></div>
      <div class="token-line-head">
        <div class="token-qty">QTY</div>
        <div class="token-name">ITEM</div>
      </div>
      <div class="divider"></div>
      ${i.map(e=>`
            <div class="token-line">
              <div class="token-qty">${m(e.qty)}X</div>
              <div class="token-name">${m(e.item_name)}</div>
            </div>
          `).join(``)}
    </section>
  `}function ze({label:e,onClick:t,disabled:n=!1,accent:r=`sky`,children:i}){let a=r===`amber`?`bg-gradient-to-br from-amber-400 via-orange-400 to-rose-500 text-white shadow-lg shadow-amber-200/80`:r===`slate`?`bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 text-white shadow-lg shadow-slate-300/70`:`bg-gradient-to-br from-sky-500 via-cyan-500 to-blue-600 text-white shadow-lg shadow-sky-200/80`;return(0,d.jsx)(`button`,{type:`button`,title:e,"aria-label":e,onClick:t,disabled:n,className:`flex h-16 w-16 items-center justify-center rounded-[20px] border border-white/70 bg-white/90 text-slate-600 shadow-[0_18px_40px_-24px_rgba(15,23,42,0.65)] transition duration-200 hover:-translate-y-0.5 hover:bg-white disabled:cursor-not-allowed disabled:bg-slate-100`,children:(0,d.jsx)(`span`,{className:`flex h-11 w-11 items-center justify-center rounded-2xl ${a}`,children:i})})}function Be(){let e=ee(),n=o(),s=n.role,p=i(s),h=t(),{tableId:_}=r(),v=(0,u.useRef)(null),Be=(0,u.useRef)(()=>{}),[b,Ve]=(0,u.useState)(h.state?.table||null),[He,Ue]=(0,u.useState)([]),[We,Ge]=(0,u.useState)([]),[Ke,qe]=(0,u.useState)(``),[Je,Ye]=(0,u.useState)(`ALL`),[x,S]=(0,u.useState)([]),[C,Xe]=(0,u.useState)(null),[w,T]=(0,u.useState)(``),[Ze,Qe]=(0,u.useState)(``),[$e,et]=(0,u.useState)(``),[tt,nt]=(0,u.useState)(``),[E,rt]=(0,u.useState)({id:null,order_number:null,updated_at:null,created_at:null,status:`VACANT`,pending_units:0}),[D,it]=(0,u.useState)(!0),[O,k]=(0,u.useState)(``),[A,j]=(0,u.useState)(`idle`),[M,at]=(0,u.useState)(()=>localStorage.getItem(`auto_kot_enabled`)===`1`),[ot,st]=(0,u.useState)(!1),[ct,lt]=(0,u.useState)(!0),[ut,dt]=(0,u.useState)(!1),[ft,pt]=(0,u.useState)(0),[mt,ht]=(0,u.useState)(`clear`),[gt,_t]=(0,u.useState)(!1),[N,vt]=(0,u.useState)(``),[P,yt]=(0,u.useState)(!1),[bt,xt]=(0,u.useState)(!1),[St,Ct]=(0,u.useState)(``),[wt,Tt]=(0,u.useState)(``),[Et,Dt]=(0,u.useState)(!1),[Ot,kt]=(0,u.useState)(!1),[F,At]=(0,u.useState)(`item`),[jt,Mt]=(0,u.useState)(``),[Nt,Pt]=(0,u.useState)([]),[Ft,It]=(0,u.useState)(0),Lt=(0,u.useRef)(!1),Rt=(0,u.useRef)(!1),I=(0,u.useRef)(``),L=()=>{window.requestAnimationFrame(()=>{v.current?.focus()})},zt=e=>{let t=e.target.value;if(t===``||t===`0`){T(``);return}T(t)},Bt=()=>{w||v.current?.select()},Vt=e=>{e.key===`Enter`&&(e.preventDefault(),jn())},R=e=>{if(e==null||String(e).trim()===``)return null;let t=Number(e);return Number.isNaN(t)?null:Math.max(t,0)},z=(e,t)=>({items:e.map(e=>({sale_item_id:e.sale_item_id,product_id:e.product_id,item_name:e.name,unit_price:Number(e.sale_price||0),qty:e.qty,tax_mode:e.tax_mode||`NO_TAX`,printer_name:e.printer_name||null,printer_target:e.printer_target||null,created_by_user_id:e.created_by_user_id??null,created_by_username:e.created_by_username||null})),customer_paid:t==null||Number.isNaN(t)?null:t}),B=(e,t)=>JSON.stringify(z(e,t)),Ht=e=>{let t=Array.isArray(e?.items)?e.items.map(e=>({id:e.sale_item_id??null,product_id:e.product_id??null,item_name:e.item_name,unit_price:Number(e.unit_price||0),qty:Number(e.qty||0),tax_mode:e.tax_mode||`NO_TAX`,printer_name:e.printer_name||null,printer_target:e.printer_target||null,created_by_user_id:e.created_by_user_id??null,created_by_username:e.created_by_username||null,line_total:Number(e.unit_price||0)*Number(e.qty||0),kot_printed_qty:0,pending_qty:y(e)?Number(e.qty||0):0})):[],n=t.reduce((e,t)=>e+Number(t.qty||0),0),r=t.reduce((e,t)=>e+Number(t.pending_qty||0),0),i=t.reduce((e,t)=>e+Number(t.line_total||0),0);return{id:null,order_number:e?.order_number||null,table_id:Number(_),table_name:e?.table_name||null,floor_name:e?.floor_name||null,customer_paid:e?.customer_paid??null,lines:t.length,units:n,pending_units:r,status:t.length>0?`OCCUPIED`:`VACANT`,subtotal:i,total:i,balance:null,items:t,created_at:e?.updated_at||null,updated_at:e?.updated_at||null}},V=(e,t,n,r={})=>{let i=z(e,t);if(!(i.items.length>0||i.customer_paid!=null)){ye(_);return}_e(_,{...i,order_number:r.orderNumber??E.order_number??null,table_name:n?.name||`Table ${_}`,floor_name:n?.floor||null,updated_at:r.updatedAt||new Date().toISOString(),server_updated_at:r.serverUpdatedAt??E.updated_at??null,pending_sync:!!r.pendingSync,payload_signature:B(e,t)})},H=(e=_)=>{ye(e)},Ut=e=>{rt({id:e.id||null,order_number:e.order_number||null,updated_at:e.updated_at||null,created_at:e.created_at||null,status:e.status||`VACANT`,pending_units:Number(e.pending_units||0)}),(e.table_name||e.floor_name)&&Ve(t=>({id:t?.id||Number(_),name:t?.name||e.table_name||`Table ${_}`,floor:t?.floor||e.floor_name||null}))},U=e=>{let t=(e.items||[]).map(Ie),n=R(e.customer_paid);Rt.current=!0,Lt.current=!0,I.current=B(t,n),S(t),Xe(e=>t.some(t=>t.cartKey===e)?e:t[0]?.cartKey||null),T(e.customer_paid==null?``:String(e.customer_paid)),Ut(e),V(t,n,{id:Number(_),name:e.table_name||$?.name||h.state?.table?.name||b?.name||`Table ${_}`,floor:e.floor_name||$?.floor||h.state?.table?.floor||b?.floor||null},{orderNumber:e.order_number||null,updatedAt:e.updated_at||e.created_at||new Date().toISOString(),serverUpdatedAt:e.updated_at||e.created_at||null,pendingSync:!1})},Wt=async(e={})=>{let{silent:t=!1,fallbackToLocal:n=!0}=e,r=ve(_);try{let e=await l.get(`${c}/sales/table/${_}`),t=Date.parse(e.data.updated_at||0),n=Date.parse(r?.updated_at||0);return U(r?.pending_sync&&n>t?Ht(r):e.data),e.data}catch(e){return console.warn(`Saved sale endpoint unavailable`,e),n&&r?(U(Ht(r)),Ht(r)):(t||alert(ke(e,`Failed to load billing`)),null)}},Gt=(e,t)=>Ht({...z(e,t),table_name:$?.name||h.state?.table?.name||b?.name||`Table ${_}`,floor_name:$?.floor||h.state?.table?.floor||b?.floor||null,updated_at:new Date().toISOString()}),Kt=()=>({selectedFloorId:$?.floor_id?String($.floor_id):void 0,selectedTableId:$?.id?String($.id):String(_)}),qt=async()=>{try{it(!0),Lt.current=!1;let[e,t]=await Promise.all([l.get(`${c}/stock/products`),l.get(`${c}/tables`)]);Ge(xe(e.data)),Ue(t.data);let n=t.data.find(e=>String(e.id)===String(_))||null;n?Ve(n):h.state?.table&&Ve(h.state.table),!await Wt({silent:!0,fallbackToLocal:!0})&&!ve(_)&&U({id:null,order_number:null,items:[],customer_paid:null,updated_at:null,created_at:null})}catch(e){console.error(e),alert(`Failed to load billing`)}finally{it(!1)}};(0,u.useEffect)(()=>{qt()},[_]),(0,u.useEffect)(()=>{if(x.length===0){C!==null&&Xe(null);return}x.some(e=>e.cartKey===C)||Xe(x[0].cartKey)},[x,C]);let Jt=[`ALL`,...new Set(We.map(e=>e.category_name))],Yt=We.filter(e=>{let t=e.name.toLowerCase().includes(Ke.toLowerCase()),n=Je===`ALL`||e.category_name===Je;return t&&n}),W=x.find(e=>e.cartKey===C)||null,Xt=e=>Number(e?.kot_printed_qty||0),Zt=e=>Xt(e)>0,Qt=e=>`${e?.name||`This item`} already sent to token. You can add more quantity, but you cannot reduce or delete the printed quantity. Finalize the bill instead.`,$t=e=>!e||!p.addItems?!1:s===`WAITER`?a(e,n):!0,G=$t(W),en=G&&Number(W?.qty||0)>Xt(W),tn=G&&!Zt(W),nn=p.receivePayment,rn=p.addItems;(0,u.useEffect)(()=>{localStorage.setItem(`auto_kot_enabled`,M?`1`:`0`)},[M]);let an=e=>{if(!p.addItems){alert(`You do not have permission to add items`);return}let t=Fe(e,n);Xe(t.cartKey),S(e=>e.find(e=>e.cartKey===t.cartKey)?e.map(e=>e.cartKey===t.cartKey?{...e,qty:e.qty+1,pending_qty:y(e)?Math.max(e.qty+1-Number(e.kot_printed_qty||0),0):0}:e):[...e,t]),M&&y(t)&&It(e=>e+1),L()},on=(e,t)=>{S(n=>n.flatMap(n=>{if(n.cartKey!==e)return[n];let r=Number(n.kot_printed_qty||0),i=Math.max(Number(t||0),r);return i<=0?[]:[{...n,qty:i,kot_printed_qty:Math.min(r,i),pending_qty:y(n)?Math.max(i-Math.min(r,i),0):0}]}))},sn=(e,t)=>{let n=x.find(t=>t.cartKey===e);if(n){if(!$t(n)){alert(s===`WAITER`?`Waiter can edit only own line items`:`You do not have permission to change line items`);return}if(t<0&&Number(n.qty||0)<=Xt(n)){alert(Qt(n));return}on(e,n.qty+t),t>0&&M&&y(n)&&It(e=>e+1)}},cn=()=>{if(W){if(!$t(W)){alert(s===`WAITER`?`Waiter can delete only own line items`:`You do not have permission to delete this line`);return}if(Zt(W)){alert(Qt(W));return}S(e=>e.filter(e=>e.cartKey!==W.cartKey))}},ln=async(t=!1)=>{if(!p.clearOpenOrder)return alert(`Only admin can clear an open order`),!1;if(x.length>0&&!window.confirm(`Do you want to clear this table order?`))return!1;try{k(`clear-table`);let n=await l.post(`${c}/sales/table/${_}`,{items:[],customer_paid:null});return n.data.error?(alert(n.data.error),!1):(U({id:null,order_number:null,items:[],customer_paid:null,updated_at:null,created_at:null,status:`VACANT`,pending_units:0}),H(),t&&e(`/billing`),!0)}catch(e){return console.error(e),alert(`Failed to clear table`),!1}finally{k(``)}},un=async(e={})=>{try{k(`checkout`);let t=Array.isArray(e.items)&&e.items.length>0?e.items:x,n=e.paymentBreakdown||{},r=await l.post(`${c}/sales/table/${_}/checkout`,{items:z(t,K).items,customer_paid:e.customerPaid==null?K:e.customerPaid,payment_method:e.paymentMethod||`CASH`,print_enabled:e.printEnabled!==!1,cash_paid:n.cashPaid==null?null:n.cashPaid,card_paid:n.cardPaid==null?null:n.cardPaid,upi_paid:n.upiPaid==null?null:n.upiPaid});return r.data.error?(alert(r.data.error),null):(H(),U({id:null,order_number:null,items:[],customer_paid:null,updated_at:null,created_at:null,status:`VACANT`,pending_units:0}),r.data)}catch(e){return console.error(e),alert(`Failed to finalize bill`),null}finally{k(``)}},dn=e=>{T(t=>e===`.`&&t.includes(`.`)?t:t===`0`&&e!==`.`?e:`${t}${e}`),L()},K=R(w),fn=w===``?`0`:w,q=R(Ze)??0,J=R($e)??0,Y=R(tt)??0,X=x.reduce((e,t)=>e+Number(t.sale_price||0)*t.qty,0),Z=Number((q+J+Y).toFixed(2)),pn=Number((Z-X).toFixed(2)),mn=Me(q,J,Y),hn=Ne(q,J,Y),gn=x.reduce((e,t)=>e+t.qty,0),_n=K==null||Number.isNaN(K)?null:Number((K-X).toFixed(2)),vn=_n==null?`Due`:_n>=0?`Balance`:`Due`,yn=_n==null?X:Math.abs(_n),Q=b?.name||`Table ${_}`,bn=He.filter(e=>String(e.id)!==String(_)),$=He.find(e=>String(e.id)===String(_))||b,xn=x.reduce((e,t)=>e+Number(t.pending_qty||0),0),Sn=x.length===0?`VACANT`:`OCCUPIED`,Cn=x.filter(e=>Nt.includes(e.cartKey)),wn=Pe(x,jt),Tn=F===`item`?Cn:wn.items,En=F===`item`?Cn.reduce((e,t)=>e+Number(t.sale_price||0)*t.qty,0):wn.allocatedTotal;(0,u.useEffect)(()=>{Lt.current&&(Rt.current||V(x,K,$||h.state?.table||b,{pendingSync:!0}))},[x,K,_,$?.id,$?.name,$?.floor,b?.name,b?.floor]);let Dn=()=>Lt.current?w.trim()&&K==null?!0:B(x,K)!==I.current:!1;Be.current=()=>{typeof document<`u`&&document.visibilityState===`hidden`||O||P||ot||gt||bt||Ot||Dn()||Wt({silent:!0,fallbackToLocal:!1})};let On=async(e,t={})=>{let n=Object.prototype.hasOwnProperty.call(t,`rawCustomerPaidOverride`)?t.rawCustomerPaidOverride:K,r=z(x,n),i=JSON.stringify(r);try{k(e);let n=await l.post(`${c}/sales/table/${_}`,r);return n.data.error?(alert(n.data.error),null):n.data.message===`Sale cleared`?(I.current=i,j(`saved`),H(),U({id:null,order_number:null,items:[],customer_paid:null,updated_at:null,created_at:null}),t.showMessage&&alert(`Sale cleared`),n.data):(I.current=i,j(`saved`),U(n.data),t.showMessage&&alert(`Sale saved`),n.data)}catch(e){return console.error(e),j(`error`),V(x,n,$||h.state?.table||b,{pendingSync:!0}),t.allowLocalFallback?{...Gt(x,n),local_only:!0}:(t.suppressErrorAlert||alert(ke(e,`Failed to save sale`)),null)}finally{k(``)}};(0,u.useEffect)(()=>{if(!Lt.current||D||O||P||w.trim()&&K==null)return;let e=B(x,K);if(Rt.current){Rt.current=!1,I.current=e;return}if(e===I.current)return;let t=setTimeout(async()=>{try{j(`saving`);let t=await l.post(`${c}/sales/table/${_}`,z(x,K));if(t.data.error){j(`error`);return}I.current=e,t.data.message===`Sale cleared`?(H(),rt({id:null,order_number:null,updated_at:null,created_at:null,status:`VACANT`,pending_units:0})):(Ut(t.data),V(x,K,$||h.state?.table||b,{orderNumber:t.data.order_number||E.order_number||null,updatedAt:t.data.updated_at||new Date().toISOString(),serverUpdatedAt:t.data.updated_at||null,pendingSync:!1})),j(`saved`)}catch(e){console.error(e),j(`error`)}},450);return()=>clearTimeout(t)},[x,w,K,D,O,P,_]),(0,u.useEffect)(()=>{if(A!==`saved`)return;let e=setTimeout(()=>{j(`idle`)},1500);return()=>clearTimeout(e)},[A]),(0,u.useEffect)(()=>{if(D)return;let e=()=>Be.current(),t=window.setInterval(e,4e3);return window.addEventListener(`focus`,e),document.addEventListener(`visibilitychange`,e),()=>{window.clearInterval(t),window.removeEventListener(`focus`,e),document.removeEventListener(`visibilitychange`,e)}},[D,_]),(0,u.useEffect)(()=>{if(D||typeof window>`u`)return;let e=new EventSource(te(`/sales/table/${_}/events`));return e.onmessage=()=>{Be.current()},()=>{e.close()}},[D,_]),(0,u.useEffect)(()=>{D||ot||L()},[D,ot,_]);let kn=(e,t,n={})=>{let r=t.reduce((e,t)=>e+Number(t.sale_price||0)*t.qty,0),i=ge(),a=e===`Final Bill`?`Receipt`:e===`Split Bill`?`Split Bill`:e||`Receipt`,o=n.billNumber||`-`,s=n.tableName||Q,ee=i.title_enabled?`<div class="ticket-title" style="${g(i.title_font_size,18)}">${m(a)}</div>`:``,te=i.logo_enabled&&i.logo_image?`
            <div class="${we(i.logo_alignment)}">
              <img
                src="${m(i.logo_image)}"
                alt="Logo"
                class="receipt-logo"
                style="${Te(i.logo_width)}"
              />
            </div>
          `:``,c=Ee(i),l=De(i);Le(e,`
      <section class="ticket receipt">
        ${te}
        ${c}
        ${ee}
        ${i.details_enabled?`
          <div style="${g(i.details_font_size,12)}">
            <div class="meta-row"><span>Receipt:</span><span>${m(o)}</span></div>
            <div class="meta-row"><span>Date:</span><span>${m(Se(n.updatedAt||new Date))}</span></div>
            <div class="meta-row"><span>Table:</span><span>${m(s)}</span></div>
          </div>
        `:``}
        <div class="divider"></div>
        ${i.item_layout===`DETAILED`?`
            <table class="receipt-table" style="${g(i.item_font_size,13)}">
              <colgroup>
                <col style="width:58%" />
                <col style="width:16%" />
                <col style="width:26%" />
              </colgroup>
              <thead>
                <tr>
                  <th class="item-name">ITEM</th>
                  <th class="item-qty right">QTY</th>
                  <th class="item-price right">PRICE</th>
                </tr>
              </thead>
              <tbody>
                ${t.map(e=>`
                      <tr>
                        <td class="item-name">${m(e.name)}</td>
                        <td class="item-qty right">${m(e.qty)}</td>
                        <td class="item-price right">${m(f(e.sale_price))}</td>
                      </tr>
                    `).join(``)}
              </tbody>
            </table>
          `:`
            <div class="receipt-compact-items" style="${g(i.item_font_size,13)}">
              <div class="receipt-compact-head">
                <span>ITEM</span>
                <span>QTY</span>
                <span>PRICE</span>
              </div>
              ${t.map(e=>`
                    <div class="receipt-compact-row">
                      <span>${m(e.name)}</span>
                      <span>${m(e.qty)}</span>
                      <span>${m(f(e.sale_price))}</span>
                    </div>
                  `).join(``)}
            </div>
          `}
        <div class="divider"></div>
        ${`
      <div class="receipt-summary" style="${g(i.summary_font_size,14)}">
        <div class="summary-row total"><span>Total</span><span>${m(f(r))}</span></div>
      </div>
    `}
        ${l}
      </section>
    `,`receipt`)},An=async(e=!0)=>{if(!p.printKitchenTicket){e&&alert(`You do not have permission to print kitchen tickets`);return}if(x.length===0){e&&alert(`Add items before printing KOT`);return}let t=await On(`kitchen`,{showMessage:!1});if(!(!t||t.error))try{let r=String(n?.username||n?.role||`STAFF`).trim().toUpperCase(),i=await l.post(`${c}/sales/table/${_}/kot`,null,{params:{sender_name:r}});if(i.data.error){e&&alert(i.data.error);return}S(e=>e.map(e=>({...e,kot_printed_qty:e.qty,pending_qty:0}))),rt(e=>({...e,updated_at:i.data.updated_at||e.updated_at,status:i.data.status||`OCCUPIED`,pending_units:0}));let a=Ce(i.data.table_name||Q),o=Oe(t?.order_number||i.data.order_number||E.order_number||t?.id||E.id||i.data.table_id||_);if(i.data.system_printed)return;Le(`Kitchen Order Ticket`,(Array.isArray(i.data.printer_groups)&&i.data.printer_groups.length>0?i.data.printer_groups:[{printer_name:``,items:i.data.items||[]}]).map(e=>Re({tableLabel:a,orderNumber:o,updatedAt:i.data.updated_at||new Date,senderLabel:r,items:e.items||[]})).join(``),`token`)}catch(t){console.error(t),e&&alert(ke(t,`Failed to print KOT`))}};(0,u.useEffect)(()=>{if(!p.printKitchenTicket||!p.toggleAutoKot||!M||Ft===0||D||O||P||Et)return;let e=setTimeout(()=>{It(0),An(!1)},900);return()=>clearTimeout(e)},[M,Ft,D,O,P,Et,p.printKitchenTicket,p.toggleAutoKot]);let jn=()=>{if(!p.receivePayment){alert(`You do not have permission to open the payment screen`);return}if(x.length===0){alert(`Add items before printing bill`);return}let e=R(w)??0,t=Math.max(X-e,0);Qe(e>0?String(e):``),et(``),nt(e>0?t>0?f(t):``:f(X)),lt(!0),st(!0)},Mn=async e=>{try{let t=await l.post(`${c}/sales/bills/${e}/print`);return t.data?.error?{ok:!1,message:t.data.error}:{ok:!!t.data?.system_printed,message:``}}catch(e){return console.error(e),{ok:!1,message:ke(e,`Failed to send bill to main printer`)}}},Nn=async(e={})=>{let t=Object.prototype.hasOwnProperty.call(e,`rawCustomerPaidOverride`)?e.rawCustomerPaidOverride:K,n=e.paymentBreakdown||{};if(x.length===0)return alert(`Add items before printing bill`),null;let r=x.map(e=>({...e})),i=Q,a=b?.floor||`-`,o=await un({items:r,customerPaid:t,paymentMethod:e.paymentMethod,paymentBreakdown:n,printEnabled:e.printEnabled});if(!o||o.error)return null;if(e.printEnabled!==!1){let n=await Mn(o.id);n.ok||(n.message&&alert(`${n.message}. Opening browser print preview instead.`),kn(`Final Bill`,r,{updatedAt:o.created_at,customerPaid:o.customer_paid??t,paymentMethod:o.payment_method||e.paymentMethod,cashPaid:o.cash_paid,cardPaid:o.card_paid,upiPaid:o.upi_paid,billNumber:o.bill_number,tableName:i,floorName:a}))}return o},Pn=async()=>{if(!p.receivePayment){alert(`You do not have permission to receive payment`);return}if(Z<=0&&X>0){alert(`Enter payment amount before saving bill`);return}if(Z<X){alert(`Total payment is less than bill total`);return}if(!await Nn({rawCustomerPaidOverride:Z,paymentMethod:mn,paymentBreakdown:{cashPaid:q,cardPaid:J,upiPaid:Y},printEnabled:ct,skipClosePrompt:!0}))return;T(q>0?String(q):``),Qe(``),et(``),nt(``),st(!1);let t=Number((Z-X).toFixed(2));if(ht(`return`),t>0){pt(t),dt(!0);return}e(`/billing`,{state:Kt()})},Fn=async()=>{if(dt(!1),mt===`return`){e(`/billing`,{state:Kt()});return}await ln(!0)},In=()=>{let t=B(x,K),n=Kt();if(V(x,K,$||h.state?.table||b,{pendingSync:!0}),t===I.current){e(`/billing`,{state:n});return}l.post(`${c}/sales/table/${_}`,z(x,K)).then(e=>{if(e.data?.error){console.warn(`Background sale save returned an error`,e.data.error);return}I.current=t,e.data?.message===`Sale cleared`&&H()}).catch(e=>{console.error(`Background sale save failed`,e)}),e(`/billing`,{state:n})},Ln=()=>{if(!p.moveTable){alert(`You do not have permission to move tables`);return}if(x.length===0){alert(`Add items before moving order`);return}vt(``),_t(!0)},Rn=async()=>{if(!p.transferItems){alert(`Only admin can transfer items between tables`);return}if(!W){alert(`Select a line item first`);return}if(!St){alert(`Select another table`);return}let e=Number(wt);if(!Number.isFinite(e)||e<=0){alert(`Enter valid quantity`);return}try{Dt(!0);let t=await On(`transfer-item`,{showMessage:!1});if(!t||t.error)return;let n=await l.post(`${c}/sales/table/${_}/transfer`,{target_table_id:Number(St),product_id:W.product_id,item_name:W.name,qty:Math.min(e,W.qty),created_by_user_id:W.created_by_user_id??null,created_by_username:W.created_by_username||null});if(n.data.error){alert(n.data.error);return}U(n.data.source_sale),xt(!1),alert(`Selected items transferred`)}catch(e){console.error(e),alert(`Failed to transfer items`)}finally{Dt(!1)}},zn=()=>{if(!p.splitBill){alert(`You do not have permission to split bills`);return}if(x.length===0){alert(`Add items before splitting bill`);return}At(`item`),Mt(``),Pt(W?[W.cartKey]:x.map(e=>e.cartKey)),kt(!0)},Bn=e=>{Pt(t=>t.includes(e)?t.filter(t=>t!==e):[...t,e])},Vn=()=>{if(!p.splitBill){alert(`You do not have permission to split bills`);return}if(Tn.length===0){alert(`Select items or enter amount for split bill`);return}kn(`Split Bill`,Tn,{showPayment:!1})},Hn=async()=>{if(!p.moveTable){alert(`You do not have permission to move tables`);return}if(!N){alert(`Select another table`);return}let t=bn.find(e=>String(e.id)===String(N))||null,n=t?.name||`Table ${N}`;if(window.confirm(`Do you want to move order to another table: ${n}?`))try{yt(!0);let r=await On(`move-order`,{showMessage:!1});if(!r||r.error)return;let i=await l.post(`${c}/sales/table/${_}/move`,{target_table_id:Number(N)});if(i.data.error){alert(i.data.error);return}alert(`Order moved to ${n}`),_t(!1),e(`/billing/table/${N}`,{state:{table:t}})}catch(e){console.error(e),alert(`Failed to move order`)}finally{yt(!1)}};return(0,d.jsxs)(de,{role:s,currentPage:`sale-billing`,onRefresh:qt,children:[(0,d.jsxs)(`div`,{className:`flex flex-col gap-4 xl:min-h-[calc(100vh-7rem)]`,children:[(0,d.jsx)(`div`,{className:`rounded-2xl border border-slate-300 bg-white px-4 py-3 shadow-sm`,children:(0,d.jsxs)(`div`,{className:`flex flex-wrap items-center justify-between gap-3`,children:[(0,d.jsxs)(`div`,{className:`min-w-0`,children:[(0,d.jsx)(`div`,{className:`text-xs font-semibold uppercase tracking-[0.18em] text-sky-600`,children:`Register`}),(0,d.jsxs)(`div`,{className:`mt-1 flex flex-wrap items-center gap-3`,children:[(0,d.jsx)(`h1`,{className:`text-2xl font-bold text-slate-900`,children:Q}),(0,d.jsx)(`span`,{className:`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${je(Sn)}`,children:Ae(Sn)})]}),(0,d.jsxs)(`div`,{className:`mt-1 flex flex-wrap gap-3 text-xs text-slate-500`,children:[(0,d.jsx)(`span`,{children:b?.floor?`Floor ${b.floor}`:`No Floor`}),(0,d.jsxs)(`span`,{children:[`Sale ID: `,E.id||`New`]}),(0,d.jsxs)(`span`,{children:[`Updated: `,E.updated_at||`Not saved yet`]}),(0,d.jsxs)(`span`,{children:[`Auto Save: `,A===`saving`?`Saving...`:A===`saved`?`Saved`:A===`error`?`Error`:`Ready`]})]})]}),(0,d.jsxs)(`div`,{className:`grid grid-cols-3 gap-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-600 sm:grid-cols-5`,children:[(0,d.jsxs)(`div`,{className:`rounded-lg border border-slate-300 bg-slate-100 px-3 py-2`,children:[`Lines`,(0,d.jsx)(`div`,{className:`mt-1 text-base font-bold text-slate-900`,children:x.length})]}),(0,d.jsxs)(`div`,{className:`rounded-lg border border-slate-300 bg-slate-100 px-3 py-2`,children:[`Units`,(0,d.jsx)(`div`,{className:`mt-1 text-base font-bold text-slate-900`,children:gn})]}),(0,d.jsxs)(`div`,{className:`rounded-lg border border-slate-300 bg-slate-100 px-3 py-2`,children:[`Pending`,(0,d.jsx)(`div`,{className:`mt-1 text-base font-bold text-slate-900`,children:xn})]}),(0,d.jsxs)(`div`,{className:`rounded-lg border border-slate-300 bg-slate-100 px-3 py-2`,children:[`Paid`,(0,d.jsx)(`div`,{className:`mt-1 text-base font-bold text-slate-900`,children:K==null?`-`:f(K)})]}),(0,d.jsxs)(`div`,{className:`rounded-lg border border-slate-900 bg-slate-900 px-3 py-2 text-white`,children:[`Total`,(0,d.jsx)(`div`,{className:`mt-1 text-base font-bold`,children:f(X)})]})]})]})}),(0,d.jsx)(`div`,{className:`rounded-[28px] border border-slate-200/80 bg-[linear-gradient(135deg,#ffffff_0%,#f8fbff_55%,#eef6ff_100%)] px-4 py-4 shadow-[0_20px_45px_-28px_rgba(15,23,42,0.55)]`,children:(0,d.jsxs)(`div`,{className:`flex flex-wrap items-center gap-3`,children:[(0,d.jsx)(ze,{label:O===`go-floor`?`Opening`:`Table Plan`,onClick:In,disabled:O!==``,children:(0,d.jsx)(ce,{className:`h-5 w-5`})}),p.printKitchenTicket&&(0,d.jsx)(ze,{label:O===`kitchen`?`Saving`:`Token Print`,onClick:()=>An(!0),disabled:O!==``,accent:`amber`,children:(0,d.jsx)(le,{className:`h-5 w-5`})}),p.moveTable&&(0,d.jsx)(ze,{label:`Move Table`,onClick:Ln,disabled:O!==``||P,accent:`slate`,children:(0,d.jsx)(ie,{className:`h-5 w-5`})}),p.splitBill&&(0,d.jsx)(ze,{label:`Split Bill`,onClick:zn,disabled:O!==``,accent:`amber`,children:(0,d.jsx)(oe,{className:`h-5 w-5`})}),p.toggleAutoKot&&(0,d.jsxs)(`button`,{onClick:()=>at(e=>!e),className:`ml-auto inline-flex items-center gap-2 rounded-2xl border border-white/70 px-4 py-3 text-sm font-semibold shadow-[0_16px_32px_-24px_rgba(15,23,42,0.55)] ${M?`bg-gradient-to-r from-amber-100 via-orange-50 to-rose-50 text-amber-800`:`bg-white text-slate-800`}`,children:[M?(0,d.jsx)(re,{className:`h-5 w-5`}):(0,d.jsx)(he,{className:`h-5 w-5`}),`Auto KOT `,M?`On`:`Off`]})]})}),(0,d.jsxs)(`div`,{className:`grid gap-4 xl:min-h-0 xl:flex-1 xl:grid-cols-[minmax(0,1fr)_190px_260px]`,children:[(0,d.jsxs)(`div`,{className:`flex min-h-0 flex-col gap-4`,children:[(0,d.jsxs)(`div`,{className:`flex min-h-0 flex-col rounded-2xl border border-slate-300 bg-white shadow-sm`,children:[(0,d.jsxs)(`div`,{className:`grid grid-cols-[2fr_0.8fr_0.7fr_0.9fr_0.9fr_1.1fr] gap-3 border-b border-slate-300 bg-slate-100 px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-600`,children:[(0,d.jsx)(`div`,{children:`Item`}),(0,d.jsx)(`div`,{children:`Price`}),(0,d.jsx)(`div`,{children:`Units`}),(0,d.jsx)(`div`,{children:`Taxes`}),(0,d.jsx)(`div`,{children:`Value`}),(0,d.jsx)(`div`,{children:`Printer`})]}),(0,d.jsx)(`div`,{className:`max-h-[450px] overflow-y-auto xl:min-h-0 xl:flex-1 xl:max-h-none`,children:x.length>0?x.map(e=>(0,d.jsxs)(`button`,{onClick:()=>Xe(e.cartKey),className:`grid w-full grid-cols-[2fr_0.8fr_0.7fr_0.9fr_0.9fr_1.1fr] gap-3 border-b border-slate-200 px-4 py-2 text-left text-sm ${e.cartKey===C?`bg-slate-200`:`bg-white hover:bg-slate-50`}`,children:[(0,d.jsxs)(`div`,{children:[(0,d.jsx)(`div`,{className:`font-medium text-slate-900`,children:e.name}),e.created_by_username&&(0,d.jsxs)(`div`,{className:`text-[11px] text-slate-500`,children:[`Added by `,e.created_by_username]})]}),(0,d.jsx)(`div`,{className:`text-slate-700`,children:f(e.sale_price)}),(0,d.jsxs)(`div`,{className:`text-slate-700`,children:[`x`,e.qty]}),(0,d.jsx)(`div`,{className:`text-slate-700`,children:e.tax_mode===`GST_INCLUDED`?`GST Inc`:`No Tax`}),(0,d.jsx)(`div`,{className:`font-semibold text-slate-900`,children:f(e.sale_price*e.qty)}),(0,d.jsx)(`div`,{className:`truncate text-slate-700`,children:be(e)})]},e.cartKey)):(0,d.jsx)(`div`,{className:`px-6 py-20 text-center text-sm text-slate-500`,children:`Click a table item button below to start this order.`})}),(0,d.jsxs)(`div`,{className:`grid grid-cols-3 gap-3 border-t border-slate-300 px-4 py-3`,children:[(0,d.jsxs)(`div`,{className:`rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-center`,children:[(0,d.jsx)(`div`,{className:`text-xs font-semibold uppercase tracking-wide text-slate-500`,children:`Subtotal`}),(0,d.jsx)(`div`,{className:`mt-1 text-lg font-bold text-slate-900`,children:f(X)})]}),(0,d.jsxs)(`div`,{className:`rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-center`,children:[(0,d.jsx)(`div`,{className:`text-xs font-semibold uppercase tracking-wide text-slate-500`,children:`Tax`}),(0,d.jsx)(`div`,{className:`mt-1 text-lg font-bold text-slate-900`,children:x.some(e=>e.tax_mode===`GST_INCLUDED`)?`GST`:`No Tax`})]}),(0,d.jsxs)(`div`,{className:`rounded-lg border border-slate-900 bg-slate-900 px-3 py-2 text-center text-white`,children:[(0,d.jsx)(`div`,{className:`text-xs font-semibold uppercase tracking-wide text-slate-300`,children:`Total`}),(0,d.jsx)(`div`,{className:`mt-1 text-lg font-bold`,children:f(X)})]})]})]}),(0,d.jsx)(`div`,{className:`grid gap-4 xl:min-h-0 xl:flex-1 xl:grid-cols-[210px_minmax(0,1fr)]`,children:rn?(0,d.jsxs)(d.Fragment,{children:[(0,d.jsxs)(`div`,{className:`flex min-h-0 flex-col rounded-2xl border border-slate-300 bg-white shadow-sm`,children:[(0,d.jsx)(`div`,{className:`border-b border-slate-300 bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700`,children:`Categories`}),(0,d.jsx)(`div`,{className:`space-y-1 p-2 xl:min-h-0 xl:flex-1 xl:overflow-y-auto`,children:Jt.map(e=>(0,d.jsx)(`button`,{onClick:()=>Ye(e),className:`block w-full rounded-lg px-3 py-2 text-left text-sm font-medium ${Je===e?`bg-slate-800 text-white`:`bg-slate-50 text-slate-700 hover:bg-slate-100`}`,children:e===`ALL`?`All Items`:e},e))})]}),(0,d.jsxs)(`div`,{className:`flex min-h-0 flex-col rounded-2xl border border-slate-300 bg-white shadow-sm`,children:[(0,d.jsxs)(`div`,{className:`flex flex-wrap items-center justify-between gap-3 border-b border-slate-300 bg-slate-100 px-4 py-2`,children:[(0,d.jsx)(`div`,{className:`text-sm font-bold text-slate-700`,children:`Items`}),(0,d.jsx)(`input`,{value:Ke,onChange:e=>qe(e.target.value),placeholder:`Search item`,className:`w-full max-w-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500`})]}),(0,d.jsx)(`div`,{className:`grid gap-2 p-3 sm:grid-cols-2 xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:grid-cols-3 2xl:grid-cols-4`,children:D?(0,d.jsx)(`div`,{className:`rounded-lg bg-slate-100 p-4 text-sm text-slate-500`,children:`Loading items...`}):Yt.length>0?Yt.map(e=>(0,d.jsx)(`button`,{onClick:()=>an(e),className:`rounded-lg border border-slate-300 bg-slate-50 p-2 text-left hover:border-sky-400 hover:bg-sky-50`,children:(0,d.jsxs)(`div`,{className:`flex gap-2`,children:[e.image_url?(0,d.jsx)(`img`,{src:`${c}${e.image_url}`,alt:e.name,className:`h-12 w-12 rounded-lg object-cover`}):(0,d.jsx)(`div`,{className:`flex h-12 w-12 items-center justify-center rounded-lg bg-slate-200 text-slate-500`,children:(0,d.jsx)(ue,{className:`h-5 w-5`})}),(0,d.jsxs)(`div`,{className:`min-w-0 flex-1`,children:[(0,d.jsx)(`div`,{className:`truncate text-sm font-semibold text-slate-900`,children:e.name}),(0,d.jsx)(`div`,{className:`truncate text-[11px] text-slate-500`,children:e.category_name}),(0,d.jsx)(`div`,{className:`mt-1 text-sm font-bold text-slate-900`,children:f(e.sale_price)}),(0,d.jsx)(`div`,{className:`truncate text-[11px] text-slate-500`,children:be(e)})]})]})},e.id)):(0,d.jsx)(`div`,{className:`rounded-lg bg-slate-100 p-4 text-sm text-slate-500`,children:`No items found.`})})]})]}):(0,d.jsxs)(`div`,{className:`rounded-2xl border border-slate-300 bg-white p-6 shadow-sm xl:col-span-2`,children:[(0,d.jsx)(`div`,{className:`text-lg font-bold text-slate-900`,children:`Catalog Locked`}),(0,d.jsx)(`p`,{className:`mt-2 text-sm text-slate-500`,children:`This role can open bills and view the current order, but adding items is turned off in Access Control.`})]})})]}),(0,d.jsx)(`div`,{className:`space-y-4 xl:min-h-0`,children:(0,d.jsx)(`div`,{className:`rounded-2xl border border-slate-300 bg-white shadow-sm`,children:W&&rn?(0,d.jsxs)(`div`,{className:`grid gap-2 p-3`,children:[(0,d.jsx)(`button`,{onClick:()=>sn(W.cartKey,1),title:`Qty+`,"aria-label":`Qty+`,disabled:!G,className:`flex h-12 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 via-cyan-500 to-blue-600 text-white shadow-md shadow-sky-200/80 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50`,children:(0,d.jsx)(ae,{className:`h-5 w-5`})}),(0,d.jsx)(`button`,{onClick:()=>sn(W.cartKey,-1),title:`Qty-`,"aria-label":`Qty-`,disabled:!en,className:`flex h-12 items-center justify-center rounded-xl bg-slate-900 text-white shadow-md shadow-slate-300/70 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50`,children:(0,d.jsx)(fe,{className:`h-5 w-5`})}),(0,d.jsx)(`button`,{onClick:cn,title:`Delete`,"aria-label":`Delete`,disabled:!tn,className:`flex h-12 items-center justify-center rounded-xl bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-md shadow-rose-200/80 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50`,children:(0,d.jsx)(me,{className:`h-5 w-5`})}),!G&&s===`WAITER`&&(0,d.jsx)(`div`,{className:`rounded-xl bg-amber-50 px-3 py-3 text-xs font-medium text-amber-700`,children:`Waiter can edit only own line items.`}),G&&Zt(W)&&(0,d.jsx)(`div`,{className:`rounded-xl bg-amber-50 px-3 py-3 text-xs font-medium text-amber-700`,children:`Printed token quantity is locked. You can add more, but you cannot reduce or delete the printed quantity.`})]}):rn?(0,d.jsx)(`div`,{className:`p-4 text-sm text-slate-500`,children:`Select a line from the bill.`}):(0,d.jsx)(`div`,{className:`p-4 text-sm text-slate-500`,children:`This role cannot edit line items.`})})}),(0,d.jsx)(`div`,{className:`space-y-4 xl:min-h-0`,children:nn?(0,d.jsxs)(`div`,{className:`rounded-[22px] border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] shadow-[0_18px_38px_-30px_rgba(15,23,42,0.55)] xl:flex xl:h-full xl:flex-col`,children:[(0,d.jsx)(`div`,{className:`border-b border-slate-200 bg-white/80 px-4 py-2.5 text-sm font-bold text-slate-700`,children:`Payment`}),(0,d.jsxs)(`div`,{className:`p-3 xl:min-h-0 xl:flex-1 xl:overflow-y-auto`,children:[(0,d.jsx)(`div`,{className:`rounded-[18px] bg-gradient-to-br from-slate-900 via-slate-800 to-sky-900 px-4 py-3.5 text-right text-[1.6rem] font-bold text-white shadow-[0_18px_28px_-24px_rgba(2,132,199,0.85)]`,children:f(X)}),(0,d.jsxs)(`div`,{className:`mt-3 rounded-[18px] border border-slate-200 bg-white px-3 py-2.5 shadow-sm`,children:[(0,d.jsx)(`div`,{className:`text-xs font-semibold uppercase tracking-wide text-slate-500`,children:`Cash Given`}),(0,d.jsx)(`input`,{ref:v,value:fn,onChange:zt,onFocus:Bt,onKeyDown:Vt,placeholder:`Enter cash`,className:`mt-2 w-full bg-transparent text-right text-lg font-bold text-slate-900 outline-none`})]}),(0,d.jsxs)(`div`,{className:`mt-3 rounded-[18px] border border-slate-200 bg-slate-50/90 px-4 py-3 text-center`,children:[(0,d.jsx)(`div`,{className:`text-xs font-semibold uppercase tracking-wide text-slate-500`,children:vn}),(0,d.jsx)(`div`,{className:`mt-1.5 text-2xl font-bold text-slate-900`,children:f(yn)})]}),(0,d.jsx)(`div`,{className:`mt-3 grid grid-cols-3 gap-2`,children:[`7`,`8`,`9`,`4`,`5`,`6`,`1`,`2`,`3`,`0`,`.`,`Exact`].map(e=>(0,d.jsx)(`button`,{onClick:()=>{if(e===`Exact`){T(f(X)),L();return}dn(e)},className:`rounded-[16px] border px-3 py-2.5 text-lg font-semibold shadow-sm ${e===`Exact`?`border-emerald-500 bg-gradient-to-br from-emerald-500 to-teal-500 text-white`:`border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}`,children:e},e))}),(0,d.jsxs)(`div`,{className:`mt-3 grid grid-cols-2 gap-2`,children:[(0,d.jsx)(`button`,{onClick:()=>{T(``),L()},className:`rounded-[16px] border border-slate-200 bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200`,children:`Clear`}),(0,d.jsx)(`button`,{onClick:()=>{T(e=>e.slice(0,-1)),L()},className:`rounded-[16px] border border-slate-200 bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200`,children:`Back`})]}),(0,d.jsxs)(`div`,{className:`mt-3 grid grid-cols-2 gap-2`,children:[(0,d.jsx)(`button`,{onClick:jn,disabled:O!==``,className:`rounded-[16px] border border-sky-500 bg-gradient-to-br from-sky-500 via-cyan-500 to-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-lg shadow-sky-200/80 hover:brightness-105 disabled:cursor-not-allowed disabled:bg-sky-300`,children:O===`bill`?`Printing...`:`Payment`}),(0,d.jsx)(`button`,{onClick:()=>ln(!1),disabled:O!==``||!p.clearOpenOrder,className:`rounded-[16px] border border-slate-200 bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 disabled:cursor-not-allowed disabled:bg-slate-100`,children:O===`clear-table`?`Clearing...`:`Clear Table`})]})]})]}):(0,d.jsxs)(`div`,{className:`rounded-[28px] border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] shadow-[0_22px_50px_-30px_rgba(15,23,42,0.6)] xl:flex xl:h-full xl:flex-col`,children:[(0,d.jsx)(`div`,{className:`border-b border-slate-200 bg-white/80 px-4 py-3 text-sm font-bold text-slate-700`,children:`Order Summary`}),(0,d.jsxs)(`div`,{className:`space-y-3 p-4 xl:min-h-0 xl:flex-1 xl:overflow-y-auto`,children:[(0,d.jsx)(`div`,{className:`rounded-[22px] bg-gradient-to-br from-slate-900 via-slate-800 to-sky-900 px-4 py-4 text-right text-[2rem] font-bold text-white shadow-[0_20px_35px_-24px_rgba(2,132,199,0.85)]`,children:f(X)}),(0,d.jsxs)(`div`,{className:`rounded-[20px] border border-slate-200 bg-slate-50/90 px-4 py-4 text-center`,children:[(0,d.jsx)(`div`,{className:`text-xs font-semibold uppercase tracking-wide text-slate-500`,children:`Pending Units`}),(0,d.jsx)(`div`,{className:`mt-2 text-3xl font-bold text-slate-900`,children:xn})]}),(0,d.jsx)(`div`,{className:`rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800`,children:`Payment is turned off for this role in Access Control.`})]})]})})]})]}),ot&&(0,d.jsx)(`div`,{className:`fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm`,children:(0,d.jsxs)(`div`,{className:`w-full max-w-2xl rounded-[30px] border border-slate-200 bg-white p-6 shadow-2xl`,children:[(0,d.jsxs)(`div`,{className:`flex items-start justify-between gap-4`,children:[(0,d.jsxs)(`div`,{children:[(0,d.jsx)(`div`,{className:`text-xs font-semibold uppercase tracking-[0.22em] text-sky-600`,children:`Payment`}),(0,d.jsx)(`h2`,{className:`mt-2 text-2xl font-bold text-slate-900`,children:Q}),(0,d.jsx)(`p`,{className:`mt-2 text-sm text-slate-500`,children:`UPI fills automatically with the full total. Change to cash or card only when needed.`})]}),(0,d.jsx)(`button`,{onClick:()=>st(!1),className:`rounded-2xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200`,children:`Close`})]}),(0,d.jsxs)(`div`,{className:`mt-5 grid gap-3 md:grid-cols-3`,children:[(0,d.jsxs)(`div`,{className:`rounded-[24px] bg-slate-100 px-4 py-4`,children:[(0,d.jsx)(`div`,{className:`text-xs font-semibold uppercase tracking-wide text-slate-500`,children:`Total`}),(0,d.jsx)(`div`,{className:`mt-2 text-2xl font-bold text-slate-900`,children:f(X)})]}),(0,d.jsxs)(`div`,{className:`rounded-[24px] bg-slate-100 px-4 py-4`,children:[(0,d.jsx)(`div`,{className:`text-xs font-semibold uppercase tracking-wide text-slate-500`,children:`Paid`}),(0,d.jsx)(`div`,{className:`mt-2 text-2xl font-bold text-slate-900`,children:f(Z)})]}),(0,d.jsxs)(`div`,{className:`rounded-[24px] bg-slate-100 px-4 py-4`,children:[(0,d.jsx)(`div`,{className:`text-xs font-semibold uppercase tracking-wide text-slate-500`,children:pn>=0?`Change`:`Due`}),(0,d.jsx)(`div`,{className:`mt-2 text-2xl font-bold text-slate-900`,children:f(Math.abs(pn))})]})]}),(0,d.jsxs)(`div`,{className:`mt-5`,children:[(0,d.jsxs)(`div`,{className:`flex flex-wrap items-center justify-between gap-3`,children:[(0,d.jsx)(`div`,{className:`text-xs font-semibold uppercase tracking-wide text-slate-500`,children:`Payment Split`}),(0,d.jsx)(`div`,{className:`rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700`,children:mn})]}),(0,d.jsxs)(`div`,{className:`mt-3 grid gap-3 md:grid-cols-3`,children:[(0,d.jsxs)(`div`,{className:`rounded-[24px] border border-slate-200 bg-slate-50/80 p-4`,children:[(0,d.jsxs)(`div`,{className:`flex items-center gap-3 text-sm font-semibold text-slate-900`,children:[(0,d.jsx)(pe,{className:`h-4 w-4`}),(0,d.jsx)(`span`,{children:`UPI`})]}),(0,d.jsx)(`input`,{value:tt,onChange:e=>nt(e.target.value),placeholder:`0.00`,className:`mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-right text-2xl font-bold text-slate-900 outline-none focus:border-sky-500`})]}),(0,d.jsxs)(`div`,{className:`rounded-[24px] border border-slate-200 bg-slate-50/80 p-4`,children:[(0,d.jsxs)(`div`,{className:`flex items-center gap-3 text-sm font-semibold text-slate-900`,children:[(0,d.jsx)(ne,{className:`h-4 w-4`}),(0,d.jsx)(`span`,{children:`Cash`})]}),(0,d.jsx)(`input`,{value:Ze,onChange:e=>Qe(e.target.value),placeholder:`0.00`,className:`mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-right text-2xl font-bold text-slate-900 outline-none focus:border-sky-500`})]}),(0,d.jsxs)(`div`,{className:`rounded-[24px] border border-slate-200 bg-slate-50/80 p-4`,children:[(0,d.jsxs)(`div`,{className:`flex items-center gap-3 text-sm font-semibold text-slate-900`,children:[(0,d.jsx)(se,{className:`h-4 w-4`}),(0,d.jsx)(`span`,{children:`Card`})]}),(0,d.jsx)(`input`,{value:$e,onChange:e=>et(e.target.value),placeholder:`0.00`,className:`mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-right text-2xl font-bold text-slate-900 outline-none focus:border-sky-500`})]})]}),(0,d.jsx)(`div`,{className:`mt-2 text-xs text-slate-500`,children:`Default payment is UPI. If the customer gives cash or card, edit the values here and keep the balance in the needed payment type.`}),hn.length>0?(0,d.jsx)(`div`,{className:`mt-3 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-medium text-slate-700`,children:hn.join(` | `)}):(0,d.jsx)(`div`,{className:`mt-3 rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-500`,children:`No payment amount entered yet.`})]}),(0,d.jsxs)(`div`,{className:`mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]`,children:[(0,d.jsxs)(`div`,{className:`rounded-[24px] border border-slate-200 bg-slate-50/80 p-4`,children:[(0,d.jsx)(`div`,{className:`text-xs font-semibold uppercase tracking-wide text-slate-500`,children:`Payment Summary`}),(0,d.jsxs)(`div`,{className:`mt-3 grid gap-3 sm:grid-cols-3`,children:[(0,d.jsxs)(`div`,{className:`rounded-2xl bg-white px-4 py-3 shadow-sm`,children:[(0,d.jsx)(`div`,{className:`text-xs font-semibold uppercase tracking-wide text-slate-500`,children:`UPI`}),(0,d.jsx)(`div`,{className:`mt-1 text-lg font-bold text-slate-900`,children:f(Y)})]}),(0,d.jsxs)(`div`,{className:`rounded-2xl bg-white px-4 py-3 shadow-sm`,children:[(0,d.jsx)(`div`,{className:`text-xs font-semibold uppercase tracking-wide text-slate-500`,children:`Cash`}),(0,d.jsx)(`div`,{className:`mt-1 text-lg font-bold text-slate-900`,children:f(q)})]}),(0,d.jsxs)(`div`,{className:`rounded-2xl bg-white px-4 py-3 shadow-sm`,children:[(0,d.jsx)(`div`,{className:`text-xs font-semibold uppercase tracking-wide text-slate-500`,children:`Card`}),(0,d.jsx)(`div`,{className:`mt-1 text-lg font-bold text-slate-900`,children:f(J)})]})]})]}),(0,d.jsxs)(`div`,{className:`rounded-[24px] border border-slate-200 bg-slate-50/80 p-4`,children:[(0,d.jsx)(`div`,{className:`text-xs font-semibold uppercase tracking-wide text-slate-500`,children:`Print Bill`}),(0,d.jsxs)(`div`,{className:`mt-3 grid grid-cols-2 gap-2`,children:[(0,d.jsx)(`button`,{onClick:()=>lt(!0),className:`rounded-2xl px-3 py-3 text-sm font-semibold ${ct?`bg-slate-900 text-white`:`bg-white text-slate-600`}`,children:`On`}),(0,d.jsx)(`button`,{onClick:()=>lt(!1),className:`rounded-2xl px-3 py-3 text-sm font-semibold ${ct?`bg-white text-slate-600`:`bg-slate-900 text-white`}`,children:`Off`})]})]})]}),(0,d.jsxs)(`div`,{className:`mt-6 grid grid-cols-2 gap-3`,children:[(0,d.jsx)(`button`,{onClick:()=>st(!1),className:`rounded-[22px] bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-200`,children:`Cancel`}),(0,d.jsx)(`button`,{onClick:Pn,disabled:O!==``,className:`rounded-[22px] bg-gradient-to-br from-sky-500 via-cyan-500 to-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-200/80 hover:brightness-105 disabled:cursor-not-allowed disabled:bg-sky-300`,children:O===`checkout`?`Saving...`:ct?`Save & Print`:`Save Bill`})]})]})}),ut&&(0,d.jsx)(`div`,{className:`fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm`,children:(0,d.jsxs)(`div`,{className:`w-full max-w-lg rounded-[30px] border border-slate-200 bg-white p-6 shadow-2xl text-center`,children:[(0,d.jsx)(`div`,{className:`text-xs font-semibold uppercase tracking-[0.22em] text-sky-600`,children:`Cash Payment`}),(0,d.jsxs)(`div`,{className:`mt-4 text-4xl font-bold text-slate-900`,children:[`Change: `,f(ft)]}),(0,d.jsx)(`button`,{onClick:Fn,className:`mt-6 rounded-[22px] bg-gradient-to-br from-sky-500 via-cyan-500 to-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-200/80 hover:brightness-105`,children:`OK`})]})}),gt&&(0,d.jsx)(`div`,{className:`fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4`,children:(0,d.jsxs)(`div`,{className:`w-full max-w-lg rounded-[28px] bg-white p-6 shadow-2xl`,children:[(0,d.jsxs)(`div`,{className:`flex items-start justify-between gap-4`,children:[(0,d.jsxs)(`div`,{children:[(0,d.jsx)(`div`,{className:`text-xs font-semibold uppercase tracking-[0.2em] text-sky-600`,children:`Move Order`}),(0,d.jsx)(`h2`,{className:`mt-2 text-2xl font-bold text-slate-900`,children:Q}),(0,d.jsx)(`p`,{className:`mt-2 text-sm text-slate-500`,children:`Select another table and confirm the move.`})]}),(0,d.jsx)(`button`,{onClick:()=>_t(!1),className:`rounded-xl bg-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-300`,children:`Close`})]}),(0,d.jsxs)(`div`,{className:`mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4`,children:[(0,d.jsx)(`div`,{className:`text-sm font-semibold text-slate-900`,children:`Do you want to move order to another table?`}),(0,d.jsxs)(`select`,{value:N,onChange:e=>vt(e.target.value),className:`mt-4 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-sky-500`,children:[(0,d.jsx)(`option`,{value:``,children:`Select another table`}),bn.map(e=>(0,d.jsxs)(`option`,{value:e.id,children:[e.floor?`${e.floor} - `:``,e.name]},e.id))]})]}),(0,d.jsxs)(`div`,{className:`mt-5 grid grid-cols-2 gap-3`,children:[(0,d.jsx)(`button`,{onClick:()=>_t(!1),className:`rounded-2xl bg-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-300`,children:`Cancel`}),(0,d.jsx)(`button`,{onClick:Hn,disabled:P,className:`rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-sky-300`,children:P?`Moving...`:`Move Order`})]})]})}),bt&&(0,d.jsx)(`div`,{className:`fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4`,children:(0,d.jsxs)(`div`,{className:`w-full max-w-lg rounded-[28px] bg-white p-6 shadow-2xl`,children:[(0,d.jsxs)(`div`,{className:`flex items-start justify-between gap-4`,children:[(0,d.jsxs)(`div`,{children:[(0,d.jsx)(`div`,{className:`text-xs font-semibold uppercase tracking-[0.2em] text-violet-600`,children:`Transfer Items`}),(0,d.jsx)(`h2`,{className:`mt-2 text-2xl font-bold text-slate-900`,children:W?.name||`Selected Item`}),(0,d.jsx)(`p`,{className:`mt-2 text-sm text-slate-500`,children:`Move selected quantity to another table without moving the full order.`})]}),(0,d.jsx)(`button`,{onClick:()=>xt(!1),className:`rounded-xl bg-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-300`,children:`Close`})]}),(0,d.jsxs)(`div`,{className:`mt-5 grid gap-4`,children:[(0,d.jsxs)(`select`,{value:St,onChange:e=>Ct(e.target.value),className:`w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-violet-500`,children:[(0,d.jsx)(`option`,{value:``,children:`Select target table`}),bn.map(e=>(0,d.jsxs)(`option`,{value:e.id,children:[e.floor?`${e.floor} - `:``,e.name]},e.id))]}),(0,d.jsx)(`input`,{type:`number`,min:`1`,max:W?.qty||1,value:wt,onChange:e=>Tt(e.target.value),placeholder:`Quantity to transfer`,className:`w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-violet-500`})]}),(0,d.jsxs)(`div`,{className:`mt-5 grid grid-cols-2 gap-3`,children:[(0,d.jsx)(`button`,{onClick:()=>xt(!1),className:`rounded-2xl bg-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-300`,children:`Cancel`}),(0,d.jsx)(`button`,{onClick:Rn,disabled:Et,className:`rounded-2xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-violet-300`,children:Et?`Transferring...`:`Transfer Items`})]})]})}),Ot&&(0,d.jsx)(`div`,{className:`fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4`,children:(0,d.jsxs)(`div`,{className:`w-full max-w-3xl rounded-[28px] bg-white p-6 shadow-2xl`,children:[(0,d.jsxs)(`div`,{className:`flex items-start justify-between gap-4`,children:[(0,d.jsxs)(`div`,{children:[(0,d.jsx)(`div`,{className:`text-xs font-semibold uppercase tracking-[0.2em] text-teal-600`,children:`Split Bill`}),(0,d.jsx)(`h2`,{className:`mt-2 text-2xl font-bold text-slate-900`,children:Q}),(0,d.jsx)(`p`,{className:`mt-2 text-sm text-slate-500`,children:`Split by selected items or by target amount. This prints a split bill preview without changing the live order.`})]}),(0,d.jsx)(`button`,{onClick:()=>kt(!1),className:`rounded-xl bg-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-300`,children:`Close`})]}),(0,d.jsxs)(`div`,{className:`mt-5 flex flex-wrap gap-3`,children:[(0,d.jsx)(`button`,{onClick:()=>At(`item`),className:`rounded-full px-4 py-2 text-sm font-semibold ${F===`item`?`bg-teal-600 text-white`:`bg-slate-200 text-slate-700`}`,children:`Split By Item`}),(0,d.jsx)(`button`,{onClick:()=>At(`amount`),className:`rounded-full px-4 py-2 text-sm font-semibold ${F===`amount`?`bg-teal-600 text-white`:`bg-slate-200 text-slate-700`}`,children:`Split By Amount`})]}),F===`item`?(0,d.jsx)(`div`,{className:`mt-5 grid gap-3`,children:x.map(e=>(0,d.jsxs)(`label`,{className:`flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3`,children:[(0,d.jsxs)(`div`,{children:[(0,d.jsx)(`div`,{className:`font-semibold text-slate-900`,children:e.name}),(0,d.jsxs)(`div`,{className:`text-sm text-slate-500`,children:[e.qty,` x `,f(e.sale_price)]})]}),(0,d.jsx)(`input`,{type:`checkbox`,checked:Nt.includes(e.cartKey),onChange:()=>Bn(e.cartKey),className:`h-5 w-5`})]},e.cartKey))}):(0,d.jsxs)(`div`,{className:`mt-5`,children:[(0,d.jsx)(`input`,{value:jt,onChange:e=>Mt(e.target.value),placeholder:`Enter split amount`,className:`w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-teal-500`}),(0,d.jsx)(`p`,{className:`mt-2 text-xs text-slate-500`,children:`Amount split uses whole item quantities in billing order.`})]}),(0,d.jsxs)(`div`,{className:`mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4`,children:[(0,d.jsx)(`div`,{className:`text-sm font-semibold uppercase tracking-wide text-slate-500`,children:`Split Preview`}),Tn.length>0?(0,d.jsx)(`div`,{className:`mt-4 space-y-2`,children:Tn.map(e=>(0,d.jsxs)(`div`,{className:`flex items-center justify-between rounded-xl bg-white px-4 py-3`,children:[(0,d.jsxs)(`div`,{children:[(0,d.jsx)(`div`,{className:`font-semibold text-slate-900`,children:e.name}),(0,d.jsxs)(`div`,{className:`text-sm text-slate-500`,children:[`Qty `,e.qty]})]}),(0,d.jsx)(`div`,{className:`font-semibold text-slate-900`,children:f(e.sale_price*e.qty)})]},`${e.cartKey}-${e.qty}`))}):(0,d.jsx)(`div`,{className:`mt-4 text-sm text-slate-500`,children:`No split preview yet.`}),(0,d.jsxs)(`div`,{className:`mt-4 flex items-center justify-between rounded-xl bg-white px-4 py-3`,children:[(0,d.jsx)(`div`,{className:`text-sm font-semibold text-slate-500`,children:`Split Total`}),(0,d.jsx)(`div`,{className:`text-xl font-bold text-slate-900`,children:f(En)})]})]}),(0,d.jsxs)(`div`,{className:`mt-5 grid grid-cols-2 gap-3`,children:[(0,d.jsx)(`button`,{onClick:()=>kt(!1),className:`rounded-2xl bg-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-300`,children:`Cancel`}),(0,d.jsx)(`button`,{onClick:Vn,className:`rounded-2xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white hover:bg-teal-700`,children:`Print Split Bill`})]})]})})]})}export{Be as default};