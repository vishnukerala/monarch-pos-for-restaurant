import{A as e,C as t,D as n,T as r,f as i,h as a,p as o,t as s,w as ee}from"./jsx-runtime-Bi5Q5u0f.js";import{a as te,i as c,o as l}from"./index-GheG0Wim.js";import{S as ne,_ as re,a as ie,b as ae,f as oe,m as se,o as ce,s as le,t as ue,x as de}from"./AppSidebarLayout-Cx5a5-z7.js";import{n as fe}from"./receiptSettings-e7jaEQ_M.js";import{i as pe,r as me,t as he}from"./saleDrafts-BvjYVUHA.js";var u=e(n(),1),d=s();function f(e){return Number(e||0).toFixed(2)}function ge(e){let t=new Set,n=[];for(let r of e||[]){let e=String(r?.category_name||``).trim();!e||t.has(e)||(t.add(e),n.push(e))}return n}function p(e){return String(e??``).replaceAll(`&`,`&amp;`).replaceAll(`<`,`&lt;`).replaceAll(`>`,`&gt;`).replaceAll(`"`,`&quot;`).replaceAll(`'`,`&#39;`)}function _e(e){let t=e instanceof Date?e:new Date(e||Date.now());return Number.isNaN(t.getTime())?String(e||``):t.toLocaleString(`en-US`,{month:`short`,day:`numeric`,year:`numeric`,hour:`numeric`,minute:`2-digit`,second:`2-digit`,hour12:!0})}function ve(e){return String(e||`DINE IN`).trim().toUpperCase()}function ye(e){let t=String(e||`CENTER`).trim().toUpperCase();return t===`LEFT`?`align-left`:t===`RIGHT`?`align-right`:`align-center`}function be(e){let t=Number(e),n=Number.isFinite(t)?Math.min(Math.max(Math.round(t),80),300):200;return`max-width:${n}px;max-height:${Math.max(Math.round(n*.38),40)}px;`}function m(e,t=13){if(typeof e==`string`){let t=e.trim().toUpperCase();if(t===`SMALL`)return 11;if(t===`MEDIUM`)return 13;if(t===`LARGE`)return 18}let n=Number(e);return Number.isFinite(n)?Math.min(Math.max(Math.round(n),9),56):t}function h(e,t=13){let n=m(e,t);return`font-size:${n}px;line-height:${Math.max(Math.round(n*1.35),n+2)}px;`}function g(e){let t=String(e||``).split(/\r?\n/).map(e=>e.trim()).filter(Boolean);return t.length===0?``:t.map(e=>p(e)).join(`<br />`)}function xe(e){let t=String(e?.header_text||``).split(/\r?\n/).map(e=>e.trim()).filter(Boolean);if(t.length===0)return``;let[n,...r]=t;return`
    <div class="receipt-header ${ye(e?.header_alignment)}" style="${h(e?.header_font_size,18)}">
      <div class="receipt-header-primary">${p(n)}</div>
      ${r.length>0?`<div class="receipt-header-secondary">${r.map(e=>p(e)).join(`<br />`)}</div>`:``}
    </div>
  `}function Se(e){if(!e?.footer_enabled)return``;let t=g(e.footer_text);return t?`
    <div class="divider"></div>
    <div class="receipt-footer-text ${ye(e.footer_alignment)}" style="${h(e.footer_font_size,12)}">${t}</div>
  `:``}function Ce(e){let t=Number(e);return Number.isFinite(t)&&t>0?String(Math.trunc(t)).padStart(5,`0`):String(e||`-`).trim()||`-`}function we(e,t){let n=e?.response?.data;return typeof n==`string`&&n.trim()?n.trim():n?.error?String(n.error):n?.detail?String(n.detail):e?.message?String(e.message):t}function _(e){let t=e.created_by_user_id?`-owner-${e.created_by_user_id}`:e.created_by_username?`-owner-${String(e.created_by_username).trim().toLowerCase()}`:``;return e.id?`line-${e.id}`:e.product_id?`product-${e.product_id}${t}`:`name-${e.item_name||e.name}${t}`}function Te(e){return e===`RUNNING_ORDER`?`Running Order`:e===`OCCUPIED`?`Occupied`:`Vacant`}function Ee(e){return e===`RUNNING_ORDER`?`bg-amber-100 text-amber-700`:e===`OCCUPIED`?`bg-rose-100 text-rose-700`:`bg-emerald-100 text-emerald-700`}function De(e,t,n){let r=[];return Number(e||0)>0&&r.push(`CASH`),Number(t||0)>0&&r.push(`CARD`),Number(n||0)>0&&r.push(`UPI`),r.length>1?`MIXED`:r[0]||`CASH`}function Oe(e,t,n){let r=[];return Number(n||0)>0&&r.push(`UPI ${f(n)}`),Number(e||0)>0&&r.push(`Cash ${f(e)}`),Number(t||0)>0&&r.push(`Card ${f(t)}`),r}function ke(e,t){let n=Number(t||0);if(!Number.isFinite(n)||n<=0)return{items:[],allocatedTotal:0};let r=n,i=[];return e.forEach(e=>{if(r<=0)return;let t=Number(e.sale_price||0);if(t<=0)return;let n=Math.min(e.qty,Math.floor((r+1e-4)/t));n<=0||(i.push({...e,qty:n}),r=Number((r-t*n).toFixed(2)))}),{items:i,allocatedTotal:i.reduce((e,t)=>e+Number(t.sale_price||0)*t.qty,0)}}function v(e){return!!String(e?.printer_target||``).trim()}function Ae(e,t){let n=v(e);return{cartKey:_({product_id:e.id,item_name:e.name,created_by_user_id:t?.id??null,created_by_username:t?.username||null}),product_id:e.id,name:e.name,sale_price:Number(e.sale_price||0),qty:1,tax_mode:e.tax_mode||`NO_TAX`,printer_name:e.printer_name||null,printer_target:e.printer_target||null,sale_item_id:null,kot_printed_qty:0,pending_qty:n?1:0,created_by_user_id:t?.id??null,created_by_username:t?.username||null}}function je(e){let t=v(e),n=Number(e.qty||0),r=Number(e.kot_printed_qty||0);return{cartKey:_(e),sale_item_id:e.id||null,product_id:e.product_id||null,name:e.item_name,sale_price:Number(e.unit_price||0),qty:n,tax_mode:e.tax_mode||`NO_TAX`,printer_name:e.printer_name||null,printer_target:e.printer_target||null,kot_printed_qty:r,pending_qty:e.pending_qty==null?t?Math.max(n-r,0):0:Number(e.pending_qty||0),created_by_user_id:e.created_by_user_id??null,created_by_username:e.created_by_username||null}}function Me(e,t,n=`receipt`){let r=window.open(``,`_blank`,`width=960,height=720`);if(!r){alert(`Allow popups to print`);return}r.document.write(`
    <html>
      <head>
        <title>${p(e)}</title>
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
      <body class="${p(n)}">${t}</body>
    </html>
  `),r.document.close();let i=!1,a=()=>{i||(i=!0,r.focus(),r.print())},o=Array.from(r.document.images||[]),s=0;if(o.forEach(e=>{if(e.complete)return;s+=1;let t=()=>{--s,s<=0&&setTimeout(a,150)};e.addEventListener(`load`,t,{once:!0}),e.addEventListener(`error`,t,{once:!0})}),s===0){setTimeout(a,250);return}setTimeout(a,1600)}function Ne({tableLabel:e,orderNumber:t,updatedAt:n,senderLabel:r,items:i}){return`
    <section class="ticket token">
      <div class="token-table-name">${p(e)}</div>
      <div class="meta-row"><span>Order No:</span><span>${p(t)}</span></div>
      <div class="meta-row"><span>Date:</span><span>${p(_e(n))}</span></div>
      <div class="meta-row"><span>Sender:</span><span>${p(r)}</span></div>
      <div class="divider"></div>
      <div class="token-line-head">
        <div class="token-qty">QTY</div>
        <div class="token-name">ITEM</div>
      </div>
      <div class="divider"></div>
      ${i.map(e=>`
            <div class="token-line">
              <div class="token-qty">${p(e.qty)}X</div>
              <div class="token-name">${p(e.item_name)}</div>
            </div>
          `).join(``)}
    </section>
  `}function Pe({label:e,onClick:t,disabled:n=!1,accent:r=`sky`,children:i}){let a=r===`amber`?`bg-amber-50 text-amber-600`:r===`slate`?`bg-slate-100 text-slate-700`:`bg-sky-50 text-sky-600`;return(0,d.jsx)(`button`,{type:`button`,title:e,"aria-label":e,onClick:t,disabled:n,className:`flex h-12 w-12 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 shadow-sm transition hover:border-sky-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400`,children:(0,d.jsx)(`span`,{className:`flex h-9 w-9 items-center justify-center rounded-md ${a}`,children:i})})}function Fe(){let e=ee(),n=o(),s=n.role,m=i(s),g=t(),{tableId:_}=r(),Fe=(0,u.useRef)(null),Ie=(0,u.useRef)(()=>{}),[y,Le]=(0,u.useState)(g.state?.table||null),[Re,ze]=(0,u.useState)([]),[Be,Ve]=(0,u.useState)([]),[He,Ue]=(0,u.useState)(``),[b,We]=(0,u.useState)(`ALL`),[x,Ge]=(0,u.useState)([]),[Ke,qe]=(0,u.useState)(null),[S,C]=(0,u.useState)(``),[Je,w]=(0,u.useState)(``),[Ye,T]=(0,u.useState)(``),[Xe,Ze]=(0,u.useState)(``),[E,Qe]=(0,u.useState)({id:null,order_number:null,updated_at:null,created_at:null,status:`VACANT`,pending_units:0}),[D,$e]=(0,u.useState)(!0),[O,k]=(0,u.useState)(``),[A,j]=(0,u.useState)(`idle`),[M,et]=(0,u.useState)(()=>localStorage.getItem(`auto_kot_enabled`)===`1`),[N,tt]=(0,u.useState)(!1),[nt,rt]=(0,u.useState)(!0),[it,at]=(0,u.useState)(!1),[ot,st]=(0,u.useState)(0),[ct,lt]=(0,u.useState)(`clear`),[ut,dt]=(0,u.useState)(!1),[P,ft]=(0,u.useState)(``),[F,pt]=(0,u.useState)(!1),[mt,ht]=(0,u.useState)(!1),[gt,_t]=(0,u.useState)(``),[vt,yt]=(0,u.useState)(``),[bt,xt]=(0,u.useState)(!1),[St,Ct]=(0,u.useState)(!1),[I,wt]=(0,u.useState)(`item`),[Tt,Et]=(0,u.useState)(``),[Dt,Ot]=(0,u.useState)([]),[kt,At]=(0,u.useState)(0),L=(0,u.useRef)(!1),jt=(0,u.useRef)(!1),R=(0,u.useRef)(``),Mt=()=>{window.requestAnimationFrame(()=>{Fe.current?.focus()})},z=e=>{if(e==null||String(e).trim()===``)return null;let t=Number(e);return Number.isNaN(t)?null:Math.max(t,0)},B=(e,t)=>({items:e.map(e=>({sale_item_id:e.sale_item_id,product_id:e.product_id,item_name:e.name,unit_price:Number(e.sale_price||0),qty:e.qty,tax_mode:e.tax_mode||`NO_TAX`,printer_name:e.printer_name||null,printer_target:e.printer_target||null,created_by_user_id:e.created_by_user_id??null,created_by_username:e.created_by_username||null})),customer_paid:t==null||Number.isNaN(t)?null:t}),V=(e,t)=>JSON.stringify(B(e,t)),Nt=e=>{let t=Array.isArray(e?.items)?e.items.map(e=>({id:e.sale_item_id??null,product_id:e.product_id??null,item_name:e.item_name,unit_price:Number(e.unit_price||0),qty:Number(e.qty||0),tax_mode:e.tax_mode||`NO_TAX`,printer_name:e.printer_name||null,printer_target:e.printer_target||null,created_by_user_id:e.created_by_user_id??null,created_by_username:e.created_by_username||null,line_total:Number(e.unit_price||0)*Number(e.qty||0),kot_printed_qty:0,pending_qty:v(e)?Number(e.qty||0):0})):[],n=t.reduce((e,t)=>e+Number(t.qty||0),0),r=t.reduce((e,t)=>e+Number(t.pending_qty||0),0),i=t.reduce((e,t)=>e+Number(t.line_total||0),0);return{id:null,order_number:e?.order_number||null,table_id:Number(_),table_name:e?.table_name||null,floor_name:e?.floor_name||null,customer_paid:e?.customer_paid??null,lines:t.length,units:n,pending_units:r,status:t.length>0?`OCCUPIED`:`VACANT`,subtotal:i,total:i,balance:null,items:t,created_at:e?.updated_at||null,updated_at:e?.updated_at||null}},H=(e,t,n,r={})=>{let i=B(e,t);if(!(i.items.length>0||i.customer_paid!=null)){he(_);return}pe(_,{...i,order_number:r.orderNumber??E.order_number??null,table_name:n?.name||`Table ${_}`,floor_name:n?.floor||null,updated_at:r.updatedAt||new Date().toISOString(),server_updated_at:r.serverUpdatedAt??E.updated_at??null,pending_sync:!!r.pendingSync,payload_signature:V(e,t)})},Pt=(e=_)=>{he(e)},Ft=e=>{Qe({id:e.id||null,order_number:e.order_number||null,updated_at:e.updated_at||null,created_at:e.created_at||null,status:e.status||`VACANT`,pending_units:Number(e.pending_units||0)}),(e.table_name||e.floor_name)&&Le(t=>({id:t?.id||Number(_),name:t?.name||e.table_name||`Table ${_}`,floor:t?.floor||e.floor_name||null}))},U=e=>{let t=(e.items||[]).map(je),n=z(e.customer_paid);jt.current=!0,L.current=!0,R.current=V(t,n),(0,u.startTransition)(()=>{Ge(t),qe(e=>t.some(t=>t.cartKey===e)?e:t[0]?.cartKey||null),C(e.customer_paid==null?``:String(e.customer_paid)),Ft(e)}),H(t,n,{id:Number(_),name:e.table_name||Q?.name||g.state?.table?.name||y?.name||`Table ${_}`,floor:e.floor_name||Q?.floor||g.state?.table?.floor||y?.floor||null},{orderNumber:e.order_number||null,updatedAt:e.updated_at||e.created_at||new Date().toISOString(),serverUpdatedAt:e.updated_at||e.created_at||null,pendingSync:!1})},It=async(e={})=>{let{silent:t=!1,fallbackToLocal:n=!0}=e,r=me(_);try{let e=await l.get(`${c}/sales/table/${_}`),t=Date.parse(e.data.updated_at||0),n=Date.parse(r?.updated_at||0);return U(r?.pending_sync&&n>t?Nt(r):e.data),e.data}catch(e){return console.warn(`Saved sale endpoint unavailable`,e),n&&r?(U(Nt(r)),Nt(r)):(t||alert(we(e,`Failed to load billing`)),null)}},Lt=(e,t)=>Nt({...B(e,t),table_name:Q?.name||g.state?.table?.name||y?.name||`Table ${_}`,floor_name:Q?.floor||g.state?.table?.floor||y?.floor||null,updated_at:new Date().toISOString()}),Rt=()=>({selectedFloorId:Q?.floor_id?String(Q.floor_id):void 0,selectedTableId:Q?.id?String(Q.id):String(_)}),zt=async()=>{try{$e(!0),L.current=!1;let[e,t]=await Promise.all([l.get(`${c}/stock/products`),l.get(`${c}/tables`)]),n=t.data.find(e=>String(e.id)===String(_))||null;(0,u.startTransition)(()=>{Ve(e.data||[]),ze(t.data||[]),n?Le(n):g.state?.table&&Le(g.state.table)}),!await It({silent:!0,fallbackToLocal:!0})&&!me(_)&&U({id:null,order_number:null,items:[],customer_paid:null,updated_at:null,created_at:null})}catch(e){console.error(e),alert(`Failed to load billing`)}finally{$e(!1)}};(0,u.useEffect)(()=>{C(``),w(``),T(``),Ze(``),We(`ALL`),zt()},[_]),(0,u.useEffect)(()=>{let e=ge(Be);if(e.length===0){b!==`ALL`&&We(`ALL`);return}(b===`ALL`||!e.includes(b))&&We(e[0])},[Be,b]),(0,u.useEffect)(()=>{if(x.length===0){Ke!==null&&qe(null);return}x.some(e=>e.cartKey===Ke)||qe(x[0].cartKey)},[x,Ke]);let Bt=(0,u.useDeferredValue)(He).trim().toLowerCase(),Vt=ge(Be),Ht=Be.filter(e=>{let t=Bt.length===0||e.name.toLowerCase().includes(Bt),n=b===`ALL`||e.category_name===b;return t&&n}),W=x.find(e=>e.cartKey===Ke)||null,Ut=e=>Number(e?.kot_printed_qty||0),Wt=e=>Ut(e)>0,Gt=e=>`${e?.name||`This item`} already sent to token. You can add more quantity, but you cannot reduce or delete the printed quantity. Finalize the bill instead.`,Kt=e=>!e||!m.addItems?!1:s===`WAITER`?a(e,n):!0,qt=Kt(W),Jt=qt&&Number(W?.qty||0)>Ut(W),Yt=qt&&!Wt(W),Xt=m.receivePayment,Zt=m.addItems;(0,u.useEffect)(()=>{localStorage.setItem(`auto_kot_enabled`,M?`1`:`0`)},[M]);let Qt=e=>{if(!m.addItems){alert(`You do not have permission to add items`);return}let t=sn(),r=Ae(e,n);qe(r.cartKey),Ge(e=>e.find(e=>e.cartKey===r.cartKey)?e.map(e=>e.cartKey===r.cartKey?{...e,qty:e.qty+t,pending_qty:v(e)?Math.max(e.qty+t-Number(e.kot_printed_qty||0),0):0}:e):[...e,{...r,qty:t,pending_qty:v(r)?t:0}]),M&&v(r)&&At(e=>e+1),on(),Mt()},$t=(e,t)=>{Ge(n=>n.flatMap(n=>{if(n.cartKey!==e)return[n];let r=Number(n.kot_printed_qty||0),i=Math.max(Number(t||0),r);return i<=0?[]:[{...n,qty:i,kot_printed_qty:Math.min(r,i),pending_qty:v(n)?Math.max(i-Math.min(r,i),0):0}]}))},en=(e,t)=>{let n=x.find(t=>t.cartKey===e);if(n){if(!Kt(n)){alert(s===`WAITER`?`Waiter can edit only own line items`:`You do not have permission to change line items`);return}if(t<0&&Number(n.qty||0)<=Ut(n)){alert(Gt(n));return}$t(e,n.qty+t),t>0&&M&&v(n)&&At(e=>e+1)}},tn=()=>{if(W){if(!Kt(W)){alert(s===`WAITER`?`Waiter can delete only own line items`:`You do not have permission to delete this line`);return}if(Wt(W)){alert(Gt(W));return}Ge(e=>e.filter(e=>e.cartKey!==W.cartKey))}},nn=async(t=!1)=>{if(!m.clearOpenOrder)return alert(`Only admin can clear an open order`),!1;if(x.length>0&&!window.confirm(`Do you want to clear this table order?`))return!1;try{k(`clear-table`);let n=await l.post(`${c}/sales/table/${_}`,{items:[],customer_paid:null});return n.data.error?(alert(n.data.error),!1):(U({id:null,order_number:null,items:[],customer_paid:null,updated_at:null,created_at:null,status:`VACANT`,pending_units:0}),Pt(),t&&e(`/billing`),!0)}catch(e){return console.error(e),alert(`Failed to clear table`),!1}finally{k(``)}},rn=async(e={})=>{try{k(`checkout`);let t=Array.isArray(e.items)&&e.items.length>0?e.items:x,n=e.paymentBreakdown||{},r=await l.post(`${c}/sales/table/${_}/checkout`,{items:B(t,G).items,customer_paid:e.customerPaid==null?G:e.customerPaid,payment_method:e.paymentMethod||`CASH`,print_enabled:e.printEnabled!==!1,cash_paid:n.cashPaid==null?null:n.cashPaid,card_paid:n.cardPaid==null?null:n.cardPaid,upi_paid:n.upiPaid==null?null:n.upiPaid});return r.data.error?(alert(r.data.error),null):(Pt(),U({id:null,order_number:null,items:[],customer_paid:null,updated_at:null,created_at:null,status:`VACANT`,pending_units:0}),r.data)}catch(e){return console.error(e),alert(`Failed to finalize bill`),null}finally{k(``)}},an=e=>{C(t=>e===`.`&&t.includes(`.`)?t:t===`0`&&e!==`.`?e:`${t}${e}`),Mt()},on=()=>{C(``)},sn=()=>{let e=Math.floor(Number(S||0));return Number.isFinite(e)&&e>0?e:1},cn=e=>{W&&(en(W.cartKey,sn()*e),on())},G=z(S),ln=S===``?`0`:S,K=z(Je)??0,q=z(Ye)??0,J=z(Xe)??0,Y=x.reduce((e,t)=>e+Number(t.sale_price||0)*t.qty,0),X=Number((K+q+J).toFixed(2)),un=Number((X-Y).toFixed(2)),dn=De(K,q,J),fn=Oe(K,q,J),pn=x.reduce((e,t)=>e+t.qty,0),mn=G==null||Number.isNaN(G)?null:Number((G-Y).toFixed(2)),hn=mn==null?Y:Math.abs(mn),Z=y?.name||`Table ${_}`,gn=Re.filter(e=>String(e.id)!==String(_)),Q=Re.find(e=>String(e.id)===String(_))||y,_n=x.reduce((e,t)=>e+Number(t.pending_qty||0),0),vn=x.some(e=>e.tax_mode===`GST_INCLUDED`)?`Included`:`No Tax`,yn=x.length===0?`VACANT`:`OCCUPIED`,bn=x.filter(e=>Dt.includes(e.cartKey)),xn=ke(x,Tt),Sn=I===`item`?bn:xn.items,Cn=I===`item`?bn.reduce((e,t)=>e+Number(t.sale_price||0)*t.qty,0):xn.allocatedTotal,wn=x.reduce((e,t)=>(t.product_id&&(e[t.product_id]=(e[t.product_id]||0)+Number(t.qty||0)),e),{});(0,u.useEffect)(()=>{if(D||N||it||ut||mt||St)return;let e=e=>{if(e.ctrlKey||e.metaKey||e.altKey)return;let t=e.target,n=t?.tagName;if(!(t?.isContentEditable||n===`INPUT`||n===`TEXTAREA`||n===`SELECT`)){if(/^\d$/.test(e.key)){e.preventDefault(),an(e.key);return}if(e.key===`.`){e.preventDefault(),an(`.`);return}if(e.key===`Backspace`){e.preventDefault(),C(e=>e.slice(0,-1));return}if(e.key===`Delete`||e.key===`Escape`){e.preventDefault(),on();return}if(e.key===`+`){e.preventDefault(),cn(1);return}if(e.key===`-`){e.preventDefault(),cn(-1);return}(e.key===`=`||e.key===`Enter`)&&(e.preventDefault(),kn())}};return window.addEventListener(`keydown`,e),()=>{window.removeEventListener(`keydown`,e)}},[D,N,it,ut,mt,St,S,W?.cartKey,W?.qty,qt,Jt,O,Y]),(0,u.useEffect)(()=>{L.current&&(jt.current||H(x,G,Q||g.state?.table||y,{pendingSync:!0}))},[x,G,_,Q?.id,Q?.name,Q?.floor,y?.name,y?.floor]);let Tn=()=>L.current?S.trim()&&G==null?!0:V(x,G)!==R.current:!1;Ie.current=()=>{typeof document<`u`&&document.visibilityState===`hidden`||O||F||N||ut||mt||St||Tn()||It({silent:!0,fallbackToLocal:!1})};let En=async(e,t={})=>{let n=Object.prototype.hasOwnProperty.call(t,`rawCustomerPaidOverride`)?t.rawCustomerPaidOverride:G,r=B(x,n),i=JSON.stringify(r);try{k(e);let n=await l.post(`${c}/sales/table/${_}`,r);return n.data.error?(alert(n.data.error),null):n.data.message===`Sale cleared`?(R.current=i,j(`saved`),Pt(),U({id:null,order_number:null,items:[],customer_paid:null,updated_at:null,created_at:null}),t.showMessage&&alert(`Sale cleared`),n.data):(R.current=i,j(`saved`),U(n.data),t.showMessage&&alert(`Sale saved`),n.data)}catch(e){return console.error(e),j(`error`),H(x,n,Q||g.state?.table||y,{pendingSync:!0}),t.allowLocalFallback?{...Lt(x,n),local_only:!0}:(t.suppressErrorAlert||alert(we(e,`Failed to save sale`)),null)}finally{k(``)}};(0,u.useEffect)(()=>{if(!L.current||D||O||F||S.trim()&&G==null)return;let e=V(x,G);if(jt.current){jt.current=!1,R.current=e;return}if(e===R.current)return;let t=setTimeout(async()=>{try{j(`saving`);let t=await l.post(`${c}/sales/table/${_}`,B(x,G));if(t.data.error){j(`error`);return}R.current=e,t.data.message===`Sale cleared`?(Pt(),Qe({id:null,order_number:null,updated_at:null,created_at:null,status:`VACANT`,pending_units:0})):(Ft(t.data),H(x,G,Q||g.state?.table||y,{orderNumber:t.data.order_number||E.order_number||null,updatedAt:t.data.updated_at||new Date().toISOString(),serverUpdatedAt:t.data.updated_at||null,pendingSync:!1})),j(`saved`)}catch(e){console.error(e),j(`error`)}},450);return()=>clearTimeout(t)},[x,S,G,D,O,F,_]),(0,u.useEffect)(()=>{if(A!==`saved`)return;let e=setTimeout(()=>{j(`idle`)},1500);return()=>clearTimeout(e)},[A]),(0,u.useEffect)(()=>{if(D)return;let e=()=>Ie.current(),t=window.setInterval(e,4e3);return window.addEventListener(`focus`,e),document.addEventListener(`visibilitychange`,e),()=>{window.clearInterval(t),window.removeEventListener(`focus`,e),document.removeEventListener(`visibilitychange`,e)}},[D,_]),(0,u.useEffect)(()=>{if(D||typeof window>`u`)return;let e=new EventSource(te(`/sales/table/${_}/events`));return e.onmessage=()=>{Ie.current()},()=>{e.close()}},[D,_]),(0,u.useEffect)(()=>{D||N||Mt()},[D,N,_]);let Dn=(e,t,n={})=>{let r=t.reduce((e,t)=>e+Number(t.sale_price||0)*t.qty,0),i=fe(),a=e===`Final Bill`?`Receipt`:e===`Split Bill`?`Split Bill`:e||`Receipt`,o=n.billNumber||`-`,s=n.tableName||Z,ee=i.title_enabled?`<div class="ticket-title" style="${h(i.title_font_size,18)}">${p(a)}</div>`:``,te=i.logo_enabled&&i.logo_image?`
            <div class="${ye(i.logo_alignment)}">
              <img
                src="${p(i.logo_image)}"
                alt="Logo"
                class="receipt-logo"
                style="${be(i.logo_width)}"
              />
            </div>
          `:``,c=xe(i),l=Se(i);Me(e,`
      <section class="ticket receipt">
        ${te}
        ${c}
        ${ee}
        ${i.details_enabled?`
          <div style="${h(i.details_font_size,12)}">
            <div class="meta-row"><span>Receipt:</span><span>${p(o)}</span></div>
            <div class="meta-row"><span>Date:</span><span>${p(_e(n.updatedAt||new Date))}</span></div>
            <div class="meta-row"><span>Table:</span><span>${p(s)}</span></div>
          </div>
        `:``}
        <div class="divider"></div>
        ${i.item_layout===`DETAILED`?`
            <table class="receipt-table" style="${h(i.item_font_size,13)}">
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
                        <td class="item-name">${p(e.name)}</td>
                        <td class="item-qty right">${p(e.qty)}</td>
                        <td class="item-price right">${p(f(Number(e.sale_price||0)*Number(e.qty||0)))}</td>
                      </tr>
                    `).join(``)}
              </tbody>
            </table>
          `:`
            <div class="receipt-compact-items" style="${h(i.item_font_size,13)}">
              <div class="receipt-compact-head">
                <span>ITEM</span>
                <span>QTY</span>
                <span>PRICE</span>
              </div>
              ${t.map(e=>`
                    <div class="receipt-compact-row">
                      <span>${p(e.name)}</span>
                      <span>${p(e.qty)}</span>
                      <span>${p(f(Number(e.sale_price||0)*Number(e.qty||0)))}</span>
                    </div>
                  `).join(``)}
            </div>
          `}
        <div class="divider"></div>
        ${`
      <div class="receipt-summary" style="${h(i.summary_font_size,14)}">
        <div class="summary-row total"><span>Total</span><span>${p(f(r))}</span></div>
      </div>
    `}
        ${l}
      </section>
    `,`receipt`)},On=async(e=!0)=>{if(!m.printKitchenTicket){e&&alert(`You do not have permission to print kitchen tickets`);return}if(x.length===0){e&&alert(`Add items before printing KOT`);return}let t=await En(`kitchen`,{showMessage:!1});if(!(!t||t.error))try{let r=String(n?.username||n?.role||`STAFF`).trim().toUpperCase(),i=await l.post(`${c}/sales/table/${_}/kot`,null,{params:{sender_name:r}});if(i.data.error){e&&alert(i.data.error);return}Ge(e=>e.map(e=>({...e,kot_printed_qty:e.qty,pending_qty:0}))),Qe(e=>({...e,updated_at:i.data.updated_at||e.updated_at,status:i.data.status||`OCCUPIED`,pending_units:0}));let a=ve(i.data.table_name||Z),o=Ce(t?.order_number||i.data.order_number||E.order_number||t?.id||E.id||i.data.table_id||_);if(i.data.system_printed)return;Me(`Kitchen Order Ticket`,(Array.isArray(i.data.printer_groups)&&i.data.printer_groups.length>0?i.data.printer_groups:[{printer_name:``,items:i.data.items||[]}]).map(e=>Ne({tableLabel:a,orderNumber:o,updatedAt:i.data.updated_at||new Date,senderLabel:r,items:e.items||[]})).join(``),`token`)}catch(t){console.error(t),e&&alert(we(t,`Failed to print KOT`))}};(0,u.useEffect)(()=>{if(!m.printKitchenTicket||!m.toggleAutoKot||!M||kt===0||D||O||F||bt)return;let e=setTimeout(()=>{At(0),On(!1)},900);return()=>clearTimeout(e)},[M,kt,D,O,F,bt,m.printKitchenTicket,m.toggleAutoKot]);let kn=()=>{if(!m.receivePayment){alert(`You do not have permission to open the payment screen`);return}if(x.length===0){alert(`Add items before printing bill`);return}w(``),T(``),Ze(``),rt(!0),tt(!0)},$=e=>{let t=f(Y);w(e===`CASH`?t:``),T(e===`CARD`?t:``),Ze(e===`UPI`?t:``)},An=async e=>{try{let t=await l.post(`${c}/sales/bills/${e}/print`);return t.data?.error?{ok:!1,message:t.data.error}:{ok:!!t.data?.system_printed,message:``}}catch(e){return console.error(e),{ok:!1,message:we(e,`Failed to send bill to main printer`)}}},jn=async(e={})=>{let t=Object.prototype.hasOwnProperty.call(e,`rawCustomerPaidOverride`)?e.rawCustomerPaidOverride:G,n=e.paymentBreakdown||{};if(x.length===0)return alert(`Add items before printing bill`),null;let r=x.map(e=>({...e})),i=Z,a=y?.floor||`-`,o=await rn({items:r,customerPaid:t,paymentMethod:e.paymentMethod,paymentBreakdown:n,printEnabled:e.printEnabled});if(!o||o.error)return null;if(e.printEnabled!==!1){let n=await An(o.id);n.ok||(n.message&&alert(`${n.message}. Opening browser print preview instead.`),Dn(`Final Bill`,r,{updatedAt:o.created_at,customerPaid:o.customer_paid??t,paymentMethod:o.payment_method||e.paymentMethod,cashPaid:o.cash_paid,cardPaid:o.card_paid,upiPaid:o.upi_paid,billNumber:o.bill_number,tableName:i,floorName:a}))}return o},Mn=async()=>{if(!m.receivePayment){alert(`You do not have permission to receive payment`);return}if(X<=0&&Y>0){alert(`Enter payment amount before saving bill`);return}if(X<Y){alert(`Total payment is less than bill total`);return}if(!await jn({rawCustomerPaidOverride:X,paymentMethod:dn,paymentBreakdown:{cashPaid:K,cardPaid:q,upiPaid:J},printEnabled:nt,skipClosePrompt:!0}))return;C(``),w(``),T(``),Ze(``),tt(!1);let t=Number((X-Y).toFixed(2));if(lt(`return`),t>0){st(t),at(!0);return}e(`/billing`,{state:Rt()})},Nn=async()=>{if(at(!1),ct===`return`){e(`/billing`,{state:Rt()});return}await nn(!0)},Pn=()=>{let t=V(x,G),n=Rt();if(H(x,G,Q||g.state?.table||y,{pendingSync:!0}),t===R.current){e(`/billing`,{state:n});return}l.post(`${c}/sales/table/${_}`,B(x,G)).then(e=>{if(e.data?.error){console.warn(`Background sale save returned an error`,e.data.error);return}R.current=t,e.data?.message===`Sale cleared`&&Pt()}).catch(e=>{console.error(`Background sale save failed`,e)}),e(`/billing`,{state:n})},Fn=()=>{if(!m.moveTable){alert(`You do not have permission to move tables`);return}if(x.length===0){alert(`Add items before moving order`);return}ft(``),dt(!0)},In=async()=>{if(!m.transferItems){alert(`Only admin can transfer items between tables`);return}if(!W){alert(`Select a line item first`);return}if(!gt){alert(`Select another table`);return}let e=Number(vt);if(!Number.isFinite(e)||e<=0){alert(`Enter valid quantity`);return}try{xt(!0);let t=await En(`transfer-item`,{showMessage:!1});if(!t||t.error)return;let n=await l.post(`${c}/sales/table/${_}/transfer`,{target_table_id:Number(gt),product_id:W.product_id,item_name:W.name,qty:Math.min(e,W.qty),created_by_user_id:W.created_by_user_id??null,created_by_username:W.created_by_username||null});if(n.data.error){alert(n.data.error);return}U(n.data.source_sale),ht(!1),alert(`Selected items transferred`)}catch(e){console.error(e),alert(`Failed to transfer items`)}finally{xt(!1)}},Ln=()=>{if(!m.splitBill){alert(`You do not have permission to split bills`);return}if(x.length===0){alert(`Add items before splitting bill`);return}wt(`item`),Et(``),Ot(W?[W.cartKey]:x.map(e=>e.cartKey)),Ct(!0)},Rn=e=>{Ot(t=>t.includes(e)?t.filter(t=>t!==e):[...t,e])};return(0,d.jsxs)(ue,{role:s,currentPage:`sale-billing`,onRefresh:zt,children:[(0,d.jsxs)(`div`,{className:`flex flex-col gap-1.5 xl:min-h-[calc(100dvh-7.9rem)]`,children:[(0,d.jsxs)(`div`,{className:`shrink-0 overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm`,children:[(0,d.jsxs)(`div`,{className:`flex flex-wrap items-center justify-between gap-3 px-4 py-2`,children:[(0,d.jsxs)(`div`,{className:`min-w-0`,children:[(0,d.jsx)(`div`,{className:`text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-600`,children:`Register`}),(0,d.jsxs)(`div`,{className:`mt-1 flex flex-wrap items-center gap-2.5`,children:[(0,d.jsx)(`h1`,{className:`text-base font-bold text-slate-900`,children:Z}),(0,d.jsx)(`span`,{className:`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${Ee(yn)}`,children:Te(yn)})]}),(0,d.jsxs)(`div`,{className:`mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500`,children:[(0,d.jsx)(`span`,{children:y?.floor?`Floor ${y.floor}`:`No Floor`}),(0,d.jsxs)(`span`,{children:[`Sale ID: `,E.id||`New`]}),(0,d.jsxs)(`span`,{children:[`Updated: `,E.updated_at||`Not saved yet`]}),(0,d.jsxs)(`span`,{children:[`Auto Save: `,A===`saving`?`Saving...`:A===`saved`?`Saved`:A===`error`?`Error`:`Ready`]})]})]}),(0,d.jsxs)(`div`,{className:`grid grid-cols-2 gap-2 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-600 sm:grid-cols-4`,children:[(0,d.jsxs)(`div`,{className:`rounded-lg border border-slate-300 bg-slate-100 px-3 py-1.5`,children:[`Lines`,(0,d.jsx)(`div`,{className:`mt-1 text-sm font-bold text-slate-900`,children:x.length})]}),(0,d.jsxs)(`div`,{className:`rounded-lg border border-slate-300 bg-slate-100 px-3 py-1.5`,children:[`Units`,(0,d.jsx)(`div`,{className:`mt-1 text-sm font-bold text-slate-900`,children:pn})]}),(0,d.jsxs)(`div`,{className:`rounded-lg border border-slate-300 bg-slate-100 px-3 py-1.5`,children:[`Pending`,(0,d.jsx)(`div`,{className:`mt-1 text-sm font-bold text-slate-900`,children:_n})]}),(0,d.jsxs)(`div`,{className:`rounded-lg border border-slate-300 bg-slate-100 px-3 py-1.5`,children:[`Paid`,(0,d.jsx)(`div`,{className:`mt-1 text-sm font-bold text-slate-900`,children:G==null?`-`:f(G)})]})]})]}),(0,d.jsx)(`div`,{className:`border-t border-slate-200 px-3 py-2`,children:(0,d.jsxs)(`div`,{className:`flex flex-wrap items-center justify-between gap-2`,children:[(0,d.jsxs)(`div`,{className:`flex flex-wrap items-center gap-1.5 sm:gap-2`,children:[(0,d.jsx)(Pe,{label:O===`go-floor`?`Opening`:`Table Plan`,onClick:Pn,disabled:O!==``,children:(0,d.jsx)(le,{className:`h-5 w-5`})}),m.printKitchenTicket&&(0,d.jsx)(Pe,{label:O===`kitchen`?`Saving`:`Token Print`,onClick:()=>On(!0),disabled:O!==``,accent:`amber`,children:(0,d.jsx)(se,{className:`h-5 w-5`})}),m.moveTable&&(0,d.jsx)(Pe,{label:`Move Table`,onClick:Fn,disabled:O!==``||F,accent:`slate`,children:(0,d.jsx)(oe,{className:`h-5 w-5`})}),m.splitBill&&(0,d.jsx)(Pe,{label:`Split Bill`,onClick:Ln,disabled:O!==``,accent:`amber`,children:(0,d.jsx)(re,{className:`h-5 w-5`})}),Zt&&(0,d.jsx)(`button`,{onClick:tn,disabled:!Yt,className:`rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400`,children:`Delete Line`}),m.receivePayment&&(0,d.jsx)(`button`,{onClick:kn,disabled:O!==``,className:`rounded-lg border border-sky-500 bg-gradient-to-r from-sky-500 to-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:brightness-105 disabled:cursor-not-allowed disabled:bg-sky-300`,children:O===`bill`?`Printing...`:`Payment`}),(0,d.jsx)(`button`,{onClick:()=>nn(!1),disabled:O!==``||!m.clearOpenOrder,className:`rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400`,children:O===`clear-table`?`Clearing...`:`Clear Table`})]}),m.toggleAutoKot&&(0,d.jsxs)(`button`,{onClick:()=>et(e=>!e),className:`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold shadow-sm ${M?`border-amber-300 bg-amber-50 text-amber-800`:`border-slate-300 bg-white text-slate-800`}`,children:[M?(0,d.jsx)(ne,{className:`h-5 w-5`}):(0,d.jsx)(de,{className:`h-5 w-5`}),`Auto KOT `,M?`On`:`Off`]})]})})]}),(0,d.jsxs)(`div`,{className:`grid gap-2 xl:flex-1 xl:grid-rows-[430px_minmax(280px,1fr)] 2xl:grid-rows-[460px_minmax(320px,1fr)]`,children:[(0,d.jsxs)(`div`,{className:`grid gap-3 xl:h-[430px] xl:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] 2xl:h-[460px] 2xl:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]`,children:[(0,d.jsxs)(`div`,{className:`flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm xl:h-full`,children:[(0,d.jsxs)(`div`,{className:`grid w-full gap-2 border-b border-slate-300 bg-slate-100 px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-700 xl:[grid-template-columns:minmax(0,1fr)_72px_62px_68px_90px_52px] 2xl:[grid-template-columns:minmax(0,1fr)_78px_68px_72px_98px_60px]`,children:[(0,d.jsx)(`div`,{children:`Item`}),(0,d.jsx)(`div`,{className:`text-right`,children:`Price`}),(0,d.jsx)(`div`,{className:`text-right`,children:`Units`}),(0,d.jsx)(`div`,{className:`text-right`,children:`Taxes`}),(0,d.jsx)(`div`,{className:`text-right`,children:`Value`}),(0,d.jsx)(`div`,{className:`text-center`,children:`Printer`})]}),(0,d.jsx)(`div`,{className:`min-h-0 flex-1 overflow-y-auto`,children:x.length>0?x.map(e=>(0,d.jsxs)(`button`,{onClick:()=>qe(e.cartKey),className:`grid w-full gap-2 border-b border-slate-200 px-4 py-2 text-left text-[13px] xl:[grid-template-columns:minmax(0,1fr)_72px_62px_68px_90px_52px] 2xl:[grid-template-columns:minmax(0,1fr)_78px_68px_72px_98px_60px] ${e.cartKey===Ke?`bg-slate-100`:`bg-white hover:bg-slate-50`}`,children:[(0,d.jsxs)(`div`,{className:`min-w-0`,children:[(0,d.jsx)(`div`,{className:`truncate font-medium text-slate-900`,children:e.name}),e.created_by_username&&(0,d.jsxs)(`div`,{className:`truncate text-[11px] text-slate-500`,children:[`Added by `,e.created_by_username]})]}),(0,d.jsx)(`div`,{className:`text-right text-slate-700`,children:f(e.sale_price)}),(0,d.jsxs)(`div`,{className:`text-right text-slate-700`,children:[`x`,e.qty]}),(0,d.jsx)(`div`,{className:`text-right text-slate-700`,children:e.tax_mode===`GST_INCLUDED`?`GST`:`-`}),(0,d.jsx)(`div`,{className:`text-right font-semibold text-slate-900`,children:f(e.sale_price*e.qty)}),(0,d.jsx)(`div`,{className:`truncate text-center text-slate-700`,children:e.printer_name?e.printer_name:`-`})]},e.cartKey)):(0,d.jsx)(`div`,{className:`flex h-full min-h-[140px] items-center justify-center px-6 text-center text-sm text-slate-500`,children:`Click an item below to start the order.`})}),(0,d.jsx)(`div`,{className:`shrink-0 border-t border-slate-300 bg-slate-50 px-3 py-2`,children:(0,d.jsx)(`div`,{className:`ml-auto w-full max-w-[27rem] rounded-lg border border-slate-300 bg-white px-4 py-3 shadow-sm 2xl:max-w-[32rem]`,children:(0,d.jsxs)(`div`,{className:`grid grid-cols-2 gap-x-2 gap-y-1 text-center sm:grid-cols-4 sm:gap-x-3`,children:[(0,d.jsx)(`div`,{className:`text-sm font-semibold uppercase tracking-wide text-slate-600`,children:`Subtotal`}),(0,d.jsx)(`div`,{className:`text-sm font-semibold uppercase tracking-wide text-slate-600`,children:`Due`}),(0,d.jsx)(`div`,{className:`text-sm font-semibold uppercase tracking-wide text-slate-600`,children:`Tax`}),(0,d.jsx)(`div`,{className:`text-sm font-semibold uppercase tracking-wide text-slate-600`,children:`Total`}),(0,d.jsx)(`div`,{className:`rounded-md border border-slate-300 bg-slate-50 px-3 py-3 text-xl font-bold text-slate-900`,children:f(Y)}),(0,d.jsx)(`div`,{className:`rounded-md border border-slate-300 bg-slate-50 px-3 py-3 text-xl font-bold text-slate-900`,children:f(hn)}),(0,d.jsx)(`div`,{className:`rounded-md border border-slate-300 bg-slate-50 px-3 py-3 text-xl font-bold text-slate-900`,children:vn}),(0,d.jsx)(`div`,{className:`rounded-md border border-slate-900 bg-slate-900 px-3 py-3 text-xl font-bold text-white`,children:f(Y)})]})})})]}),(0,d.jsx)(`div`,{className:`xl:min-h-0 xl:overflow-hidden xl:h-full`,children:Xt?(0,d.jsxs)(`div`,{className:`overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm xl:flex xl:h-full xl:flex-col`,children:[(0,d.jsx)(`div`,{className:`border-b border-slate-300 bg-slate-100 px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-700`,children:`Calculator`}),(0,d.jsx)(`div`,{className:`p-2 xl:h-full`,children:(0,d.jsxs)(`div`,{className:`flex h-full min-h-0 w-full flex-col gap-2`,children:[(0,d.jsx)(`div`,{className:`shrink-0 rounded-xl bg-slate-900 px-4 py-2.5 text-right text-[1.2rem] font-bold text-white xl:text-[1.35rem] 2xl:text-[1.55rem]`,children:ln}),(0,d.jsx)(`div`,{className:`grid min-h-0 flex-1 grid-cols-4 grid-rows-5 gap-1.5`,children:[{key:`CE`,className:`col-span-2`},{key:`*`,className:``},{key:`-`,className:``},{key:`1`,className:``},{key:`2`,className:``},{key:`3`,className:``},{key:`+`,className:`row-span-2`},{key:`4`,className:``},{key:`5`,className:``},{key:`6`,className:``},{key:`7`,className:``},{key:`8`,className:``},{key:`9`,className:``},{key:`=`,className:`row-span-2`},{key:`0`,className:`col-span-2`},{key:`.`,className:``}].map(({key:e,className:t})=>(0,d.jsx)(`button`,{onClick:()=>{if(e===`CE`){on();return}if(e===`*`){C(e=>e.slice(0,-1));return}if(e===`+`){cn(1);return}if(e===`-`){cn(-1);return}if(e===`=`){kn();return}an(e)},disabled:e===`+`&&!qt||e===`-`&&!Jt,className:`${t} h-full w-full rounded-lg border px-2 py-1 text-[12px] font-semibold shadow-sm xl:text-[13px] 2xl:text-sm ${e===`=`?`border-slate-400 bg-slate-100 text-slate-700`:e===`+`?`border-sky-400 bg-sky-50 text-sky-700`:e===`-`?`border-rose-200 bg-rose-50 text-rose-600`:e===`CE`||e===`*`?`border-slate-300 bg-slate-100 text-slate-700`:`border-slate-300 bg-white text-slate-700 hover:bg-slate-50`} disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400`,children:e},e))})]})})]}):(0,d.jsxs)(`div`,{className:`rounded-xl border border-slate-300 bg-white shadow-sm xl:flex xl:h-full xl:flex-col`,children:[(0,d.jsx)(`div`,{className:`border-b border-slate-300 bg-slate-100 px-4 py-3 text-sm font-bold text-slate-700`,children:`Order Summary`}),(0,d.jsxs)(`div`,{className:`space-y-3 p-4 xl:min-h-0 xl:flex-1 xl:overflow-y-auto`,children:[(0,d.jsx)(`div`,{className:`rounded-xl bg-slate-900 px-4 py-4 text-right text-[2rem] font-bold text-white`,children:f(Y)}),(0,d.jsxs)(`div`,{className:`rounded-xl border border-slate-300 bg-slate-50 px-4 py-4 text-center`,children:[(0,d.jsx)(`div`,{className:`text-xs font-semibold uppercase tracking-wide text-slate-500`,children:`Pending Units`}),(0,d.jsx)(`div`,{className:`mt-2 text-3xl font-bold text-slate-900`,children:_n})]}),(0,d.jsx)(`div`,{className:`rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800`,children:`Payment is turned off for this role in Access Control.`})]})]})})]}),Zt?(0,d.jsxs)(`div`,{className:`grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm`,children:[(0,d.jsx)(`div`,{className:`border-b border-slate-300 bg-slate-100 px-3 py-1.5`,children:(0,d.jsxs)(`div`,{className:`flex flex-wrap items-center gap-2 lg:flex-nowrap`,children:[(0,d.jsxs)(`div`,{className:`shrink-0 text-xs font-bold uppercase tracking-wide text-slate-700`,children:[`Items`,(0,d.jsx)(`span`,{className:`ml-2 text-[11px] font-medium normal-case tracking-normal text-slate-500`,children:b===`ALL`?`${Ht.length} visible`:`${b} · ${Ht.length} visible`})]}),(0,d.jsx)(`div`,{className:`min-w-0 flex-1 overflow-x-auto`,children:(0,d.jsx)(`div`,{className:`flex min-w-max gap-1.5 pr-1`,children:Vt.map(e=>(0,d.jsx)(`button`,{onClick:()=>We(e),className:`rounded-md px-2.5 py-1.5 text-sm font-medium whitespace-nowrap transition ${b===e?`bg-slate-800 text-white`:`bg-white text-slate-700 hover:bg-slate-200`}`,children:e},e))})}),(0,d.jsx)(`input`,{value:He,onChange:e=>Ue(e.target.value),placeholder:`Search item`,className:`w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-sky-500 lg:w-52 lg:shrink-0 xl:w-56`})]})}),(0,d.jsx)(`div`,{className:`grid grid-cols-3 content-start gap-1 p-1 sm:grid-cols-4 lg:grid-cols-6 xl:min-h-0 xl:[grid-template-columns:repeat(13,minmax(0,1fr))] xl:overflow-y-auto 2xl:[grid-template-columns:repeat(13,minmax(0,1fr))]`,children:D?(0,d.jsx)(`div`,{className:`rounded-lg bg-slate-100 p-4 text-sm text-slate-500`,children:`Loading items...`}):Ht.length>0?Ht.map(e=>{let t=wn[e.id]||0;return(0,d.jsxs)(`button`,{onClick:()=>Qt(e),className:`relative aspect-[1/0.62] overflow-hidden rounded-md border px-1 py-1 text-center shadow-sm transition ${t>0?`border-sky-500 bg-sky-50 hover:border-sky-600`:`border-slate-300 bg-white hover:border-sky-400 hover:bg-slate-50`}`,children:[t>0?(0,d.jsx)(`span`,{className:`absolute right-1 top-1 rounded-full bg-sky-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white`,children:t}):null,(0,d.jsxs)(`div`,{className:`flex h-full min-w-0 flex-col items-center justify-center pb-0.5 ${t>0?`pt-2.5`:`pt-0.5`}`,children:[(0,d.jsx)(`div`,{className:`w-full truncate text-xs font-medium leading-tight text-slate-900`,children:e.name}),(0,d.jsx)(`div`,{className:`mt-1 text-xs font-bold leading-none text-slate-900`,children:f(e.sale_price)})]})]},e.id)}):(0,d.jsx)(`div`,{className:`rounded-lg bg-slate-100 p-4 text-sm text-slate-500`,children:`No items found.`})})]}):(0,d.jsxs)(`div`,{className:`rounded-xl border border-slate-300 bg-white p-6 shadow-sm`,children:[(0,d.jsx)(`div`,{className:`text-lg font-bold text-slate-900`,children:`Catalog Locked`}),(0,d.jsx)(`p`,{className:`mt-2 text-sm text-slate-500`,children:`This role can open bills and view the current order, but adding items is turned off in Access Control.`})]})]})]}),N&&(0,d.jsx)(`div`,{className:`fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm`,children:(0,d.jsxs)(`div`,{className:`w-full max-w-2xl rounded-[30px] border border-slate-200 bg-white p-6 shadow-2xl`,children:[(0,d.jsxs)(`div`,{className:`flex items-start justify-between gap-4`,children:[(0,d.jsxs)(`div`,{children:[(0,d.jsx)(`div`,{className:`text-xs font-semibold uppercase tracking-[0.22em] text-sky-600`,children:`Payment`}),(0,d.jsx)(`h2`,{className:`mt-2 text-2xl font-bold text-slate-900`,children:Z}),(0,d.jsx)(`p`,{className:`mt-2 text-sm text-slate-500`,children:`Choose UPI, Cash, or Card to place the full total in that payment type. You can still edit the amounts manually for mixed payment.`})]}),(0,d.jsx)(`button`,{onClick:()=>tt(!1),className:`rounded-2xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200`,children:`Close`})]}),(0,d.jsxs)(`div`,{className:`mt-5 grid gap-3 md:grid-cols-3`,children:[(0,d.jsxs)(`div`,{className:`rounded-[24px] bg-slate-100 px-4 py-4`,children:[(0,d.jsx)(`div`,{className:`text-xs font-semibold uppercase tracking-wide text-slate-500`,children:`Total`}),(0,d.jsx)(`div`,{className:`mt-2 text-2xl font-bold text-slate-900`,children:f(Y)})]}),(0,d.jsxs)(`div`,{className:`rounded-[24px] bg-slate-100 px-4 py-4`,children:[(0,d.jsx)(`div`,{className:`text-xs font-semibold uppercase tracking-wide text-slate-500`,children:`Paid`}),(0,d.jsx)(`div`,{className:`mt-2 text-2xl font-bold text-slate-900`,children:f(X)})]}),(0,d.jsxs)(`div`,{className:`rounded-[24px] bg-slate-100 px-4 py-4`,children:[(0,d.jsx)(`div`,{className:`text-xs font-semibold uppercase tracking-wide text-slate-500`,children:un>=0?`Change`:`Due`}),(0,d.jsx)(`div`,{className:`mt-2 text-2xl font-bold text-slate-900`,children:f(Math.abs(un))})]})]}),(0,d.jsxs)(`div`,{className:`mt-5`,children:[(0,d.jsxs)(`div`,{className:`flex flex-wrap items-center justify-between gap-3`,children:[(0,d.jsx)(`div`,{className:`text-xs font-semibold uppercase tracking-wide text-slate-500`,children:`Payment Split`}),(0,d.jsx)(`div`,{className:`rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700`,children:fn.length>0?dn:`SELECT METHOD`})]}),(0,d.jsxs)(`div`,{className:`mt-3 grid gap-3 md:grid-cols-3`,children:[(0,d.jsxs)(`div`,{role:`button`,tabIndex:0,onClick:()=>$(`UPI`),onKeyDown:e=>{(e.key===`Enter`||e.key===` `)&&(e.preventDefault(),$(`UPI`))},className:`rounded-[24px] border p-4 text-left transition ${J>0?`border-emerald-300 bg-emerald-50`:`border-slate-200 bg-slate-50/80 hover:border-sky-300 hover:bg-sky-50/50`}`,children:[(0,d.jsxs)(`div`,{className:`flex items-center gap-3 text-sm font-semibold text-slate-900`,children:[(0,d.jsx)(ae,{className:`h-4 w-4`}),(0,d.jsx)(`span`,{children:`UPI`})]}),(0,d.jsx)(`input`,{value:Xe,onChange:e=>Ze(e.target.value),onClick:e=>e.stopPropagation(),placeholder:`0.00`,className:`mt-3 w-full rounded-2xl border bg-white px-4 py-3 text-right text-2xl font-bold text-slate-900 outline-none focus:border-sky-500 ${J>0?`border-emerald-300`:`border-slate-200`}`})]}),(0,d.jsxs)(`div`,{role:`button`,tabIndex:0,onClick:()=>$(`CASH`),onKeyDown:e=>{(e.key===`Enter`||e.key===` `)&&(e.preventDefault(),$(`CASH`))},className:`rounded-[24px] border p-4 text-left transition ${K>0?`border-emerald-300 bg-emerald-50`:`border-slate-200 bg-slate-50/80 hover:border-sky-300 hover:bg-sky-50/50`}`,children:[(0,d.jsxs)(`div`,{className:`flex items-center gap-3 text-sm font-semibold text-slate-900`,children:[(0,d.jsx)(ce,{className:`h-4 w-4`}),(0,d.jsx)(`span`,{children:`Cash`})]}),(0,d.jsx)(`input`,{value:Je,onChange:e=>w(e.target.value),onClick:e=>e.stopPropagation(),placeholder:`0.00`,className:`mt-3 w-full rounded-2xl border bg-white px-4 py-3 text-right text-2xl font-bold text-slate-900 outline-none focus:border-sky-500 ${K>0?`border-emerald-300`:`border-slate-200`}`})]}),(0,d.jsxs)(`div`,{role:`button`,tabIndex:0,onClick:()=>$(`CARD`),onKeyDown:e=>{(e.key===`Enter`||e.key===` `)&&(e.preventDefault(),$(`CARD`))},className:`rounded-[24px] border p-4 text-left transition ${q>0?`border-emerald-300 bg-emerald-50`:`border-slate-200 bg-slate-50/80 hover:border-sky-300 hover:bg-sky-50/50`}`,children:[(0,d.jsxs)(`div`,{className:`flex items-center gap-3 text-sm font-semibold text-slate-900`,children:[(0,d.jsx)(ie,{className:`h-4 w-4`}),(0,d.jsx)(`span`,{children:`Card`})]}),(0,d.jsx)(`input`,{value:Ye,onChange:e=>T(e.target.value),onClick:e=>e.stopPropagation(),placeholder:`0.00`,className:`mt-3 w-full rounded-2xl border bg-white px-4 py-3 text-right text-2xl font-bold text-slate-900 outline-none focus:border-sky-500 ${q>0?`border-emerald-300`:`border-slate-200`}`})]})]}),(0,d.jsx)(`div`,{className:`mt-2 text-xs text-slate-500`,children:`Start with UPI, Cash, or Card full amount above, then edit the values here if the customer pays by mixed payment.`}),fn.length>0?(0,d.jsx)(`div`,{className:`mt-3 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-medium text-slate-700`,children:fn.join(` | `)}):(0,d.jsx)(`div`,{className:`mt-3 rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-500`,children:`No payment amount entered yet.`})]}),(0,d.jsxs)(`div`,{className:`mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]`,children:[(0,d.jsxs)(`div`,{className:`rounded-[24px] border border-slate-200 bg-slate-50/80 p-4`,children:[(0,d.jsx)(`div`,{className:`text-xs font-semibold uppercase tracking-wide text-slate-500`,children:`Payment Summary`}),(0,d.jsxs)(`div`,{className:`mt-3 grid gap-3 sm:grid-cols-3`,children:[(0,d.jsxs)(`div`,{className:`rounded-2xl bg-white px-4 py-3 shadow-sm`,children:[(0,d.jsx)(`div`,{className:`text-xs font-semibold uppercase tracking-wide text-slate-500`,children:`UPI`}),(0,d.jsx)(`div`,{className:`mt-1 text-lg font-bold text-slate-900`,children:f(J)})]}),(0,d.jsxs)(`div`,{className:`rounded-2xl bg-white px-4 py-3 shadow-sm`,children:[(0,d.jsx)(`div`,{className:`text-xs font-semibold uppercase tracking-wide text-slate-500`,children:`Cash`}),(0,d.jsx)(`div`,{className:`mt-1 text-lg font-bold text-slate-900`,children:f(K)})]}),(0,d.jsxs)(`div`,{className:`rounded-2xl bg-white px-4 py-3 shadow-sm`,children:[(0,d.jsx)(`div`,{className:`text-xs font-semibold uppercase tracking-wide text-slate-500`,children:`Card`}),(0,d.jsx)(`div`,{className:`mt-1 text-lg font-bold text-slate-900`,children:f(q)})]})]})]}),(0,d.jsxs)(`div`,{className:`rounded-[24px] border border-slate-200 bg-slate-50/80 p-4`,children:[(0,d.jsx)(`div`,{className:`text-xs font-semibold uppercase tracking-wide text-slate-500`,children:`Print Bill`}),(0,d.jsxs)(`div`,{className:`mt-3 grid grid-cols-2 gap-2`,children:[(0,d.jsx)(`button`,{onClick:()=>rt(!0),className:`rounded-2xl px-3 py-3 text-sm font-semibold ${nt?`bg-slate-900 text-white`:`bg-white text-slate-600`}`,children:`On`}),(0,d.jsx)(`button`,{onClick:()=>rt(!1),className:`rounded-2xl px-3 py-3 text-sm font-semibold ${nt?`bg-white text-slate-600`:`bg-slate-900 text-white`}`,children:`Off`})]})]})]}),(0,d.jsxs)(`div`,{className:`mt-6 grid grid-cols-2 gap-3`,children:[(0,d.jsx)(`button`,{onClick:()=>tt(!1),className:`rounded-[22px] bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-200`,children:`Cancel`}),(0,d.jsx)(`button`,{onClick:Mn,disabled:O!==``,className:`rounded-[22px] bg-gradient-to-br from-sky-500 via-cyan-500 to-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-200/80 hover:brightness-105 disabled:cursor-not-allowed disabled:bg-sky-300`,children:O===`checkout`?`Saving...`:nt?`Save & Print`:`Save Bill`})]})]})}),it&&(0,d.jsx)(`div`,{className:`fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm`,children:(0,d.jsxs)(`div`,{className:`w-full max-w-lg rounded-[30px] border border-slate-200 bg-white p-6 shadow-2xl text-center`,children:[(0,d.jsx)(`div`,{className:`text-xs font-semibold uppercase tracking-[0.22em] text-sky-600`,children:`Cash Payment`}),(0,d.jsxs)(`div`,{className:`mt-4 text-4xl font-bold text-slate-900`,children:[`Change: `,f(ot)]}),(0,d.jsx)(`button`,{onClick:Nn,className:`mt-6 rounded-[22px] bg-gradient-to-br from-sky-500 via-cyan-500 to-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-200/80 hover:brightness-105`,children:`OK`})]})}),ut&&(0,d.jsx)(`div`,{className:`fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4`,children:(0,d.jsxs)(`div`,{className:`w-full max-w-lg rounded-[28px] bg-white p-6 shadow-2xl`,children:[(0,d.jsxs)(`div`,{className:`flex items-start justify-between gap-4`,children:[(0,d.jsxs)(`div`,{children:[(0,d.jsx)(`div`,{className:`text-xs font-semibold uppercase tracking-[0.2em] text-sky-600`,children:`Move Order`}),(0,d.jsx)(`h2`,{className:`mt-2 text-2xl font-bold text-slate-900`,children:Z}),(0,d.jsx)(`p`,{className:`mt-2 text-sm text-slate-500`,children:`Select another table and confirm the move.`})]}),(0,d.jsx)(`button`,{onClick:()=>dt(!1),className:`rounded-xl bg-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-300`,children:`Close`})]}),(0,d.jsxs)(`div`,{className:`mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4`,children:[(0,d.jsx)(`div`,{className:`text-sm font-semibold text-slate-900`,children:`Do you want to move order to another table?`}),(0,d.jsxs)(`select`,{value:P,onChange:e=>ft(e.target.value),className:`mt-4 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-sky-500`,children:[(0,d.jsx)(`option`,{value:``,children:`Select another table`}),gn.map(e=>(0,d.jsxs)(`option`,{value:e.id,children:[e.floor?`${e.floor} - `:``,e.name]},e.id))]})]}),(0,d.jsxs)(`div`,{className:`mt-5 grid grid-cols-2 gap-3`,children:[(0,d.jsx)(`button`,{onClick:()=>dt(!1),className:`rounded-2xl bg-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-300`,children:`Cancel`}),(0,d.jsx)(`button`,{onClick:async()=>{if(!m.moveTable){alert(`You do not have permission to move tables`);return}if(!P){alert(`Select another table`);return}let t=gn.find(e=>String(e.id)===String(P))||null,n=t?.name||`Table ${P}`;if(window.confirm(`Do you want to move order to another table: ${n}?`))try{pt(!0);let r=await En(`move-order`,{showMessage:!1});if(!r||r.error)return;let i=await l.post(`${c}/sales/table/${_}/move`,{target_table_id:Number(P)});if(i.data.error){alert(i.data.error);return}alert(`Order moved to ${n}`),dt(!1),e(`/billing/table/${P}`,{state:{table:t}})}catch(e){console.error(e),alert(`Failed to move order`)}finally{pt(!1)}},disabled:F,className:`rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-sky-300`,children:F?`Moving...`:`Move Order`})]})]})}),mt&&(0,d.jsx)(`div`,{className:`fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4`,children:(0,d.jsxs)(`div`,{className:`w-full max-w-lg rounded-[28px] bg-white p-6 shadow-2xl`,children:[(0,d.jsxs)(`div`,{className:`flex items-start justify-between gap-4`,children:[(0,d.jsxs)(`div`,{children:[(0,d.jsx)(`div`,{className:`text-xs font-semibold uppercase tracking-[0.2em] text-violet-600`,children:`Transfer Items`}),(0,d.jsx)(`h2`,{className:`mt-2 text-2xl font-bold text-slate-900`,children:W?.name||`Selected Item`}),(0,d.jsx)(`p`,{className:`mt-2 text-sm text-slate-500`,children:`Move selected quantity to another table without moving the full order.`})]}),(0,d.jsx)(`button`,{onClick:()=>ht(!1),className:`rounded-xl bg-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-300`,children:`Close`})]}),(0,d.jsxs)(`div`,{className:`mt-5 grid gap-4`,children:[(0,d.jsxs)(`select`,{value:gt,onChange:e=>_t(e.target.value),className:`w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-violet-500`,children:[(0,d.jsx)(`option`,{value:``,children:`Select target table`}),gn.map(e=>(0,d.jsxs)(`option`,{value:e.id,children:[e.floor?`${e.floor} - `:``,e.name]},e.id))]}),(0,d.jsx)(`input`,{type:`number`,min:`1`,max:W?.qty||1,value:vt,onChange:e=>yt(e.target.value),placeholder:`Quantity to transfer`,className:`w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-violet-500`})]}),(0,d.jsxs)(`div`,{className:`mt-5 grid grid-cols-2 gap-3`,children:[(0,d.jsx)(`button`,{onClick:()=>ht(!1),className:`rounded-2xl bg-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-300`,children:`Cancel`}),(0,d.jsx)(`button`,{onClick:In,disabled:bt,className:`rounded-2xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-violet-300`,children:bt?`Transferring...`:`Transfer Items`})]})]})}),St&&(0,d.jsx)(`div`,{className:`fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4`,children:(0,d.jsxs)(`div`,{className:`w-full max-w-3xl rounded-[28px] bg-white p-6 shadow-2xl`,children:[(0,d.jsxs)(`div`,{className:`flex items-start justify-between gap-4`,children:[(0,d.jsxs)(`div`,{children:[(0,d.jsx)(`div`,{className:`text-xs font-semibold uppercase tracking-[0.2em] text-teal-600`,children:`Split Bill`}),(0,d.jsx)(`h2`,{className:`mt-2 text-2xl font-bold text-slate-900`,children:Z}),(0,d.jsx)(`p`,{className:`mt-2 text-sm text-slate-500`,children:`Split by selected items or by target amount. This prints a split bill preview without changing the live order.`})]}),(0,d.jsx)(`button`,{onClick:()=>Ct(!1),className:`rounded-xl bg-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-300`,children:`Close`})]}),(0,d.jsxs)(`div`,{className:`mt-5 flex flex-wrap gap-3`,children:[(0,d.jsx)(`button`,{onClick:()=>wt(`item`),className:`rounded-full px-4 py-2 text-sm font-semibold ${I===`item`?`bg-teal-600 text-white`:`bg-slate-200 text-slate-700`}`,children:`Split By Item`}),(0,d.jsx)(`button`,{onClick:()=>wt(`amount`),className:`rounded-full px-4 py-2 text-sm font-semibold ${I===`amount`?`bg-teal-600 text-white`:`bg-slate-200 text-slate-700`}`,children:`Split By Amount`})]}),I===`item`?(0,d.jsx)(`div`,{className:`mt-5 grid gap-3`,children:x.map(e=>(0,d.jsxs)(`label`,{className:`flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3`,children:[(0,d.jsxs)(`div`,{children:[(0,d.jsx)(`div`,{className:`font-semibold text-slate-900`,children:e.name}),(0,d.jsxs)(`div`,{className:`text-sm text-slate-500`,children:[e.qty,` x `,f(e.sale_price)]})]}),(0,d.jsx)(`input`,{type:`checkbox`,checked:Dt.includes(e.cartKey),onChange:()=>Rn(e.cartKey),className:`h-5 w-5`})]},e.cartKey))}):(0,d.jsxs)(`div`,{className:`mt-5`,children:[(0,d.jsx)(`input`,{value:Tt,onChange:e=>Et(e.target.value),placeholder:`Enter split amount`,className:`w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-teal-500`}),(0,d.jsx)(`p`,{className:`mt-2 text-xs text-slate-500`,children:`Amount split uses whole item quantities in billing order.`})]}),(0,d.jsxs)(`div`,{className:`mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4`,children:[(0,d.jsx)(`div`,{className:`text-sm font-semibold uppercase tracking-wide text-slate-500`,children:`Split Preview`}),Sn.length>0?(0,d.jsx)(`div`,{className:`mt-4 space-y-2`,children:Sn.map(e=>(0,d.jsxs)(`div`,{className:`flex items-center justify-between rounded-xl bg-white px-4 py-3`,children:[(0,d.jsxs)(`div`,{children:[(0,d.jsx)(`div`,{className:`font-semibold text-slate-900`,children:e.name}),(0,d.jsxs)(`div`,{className:`text-sm text-slate-500`,children:[`Qty `,e.qty]})]}),(0,d.jsx)(`div`,{className:`font-semibold text-slate-900`,children:f(e.sale_price*e.qty)})]},`${e.cartKey}-${e.qty}`))}):(0,d.jsx)(`div`,{className:`mt-4 text-sm text-slate-500`,children:`No split preview yet.`}),(0,d.jsxs)(`div`,{className:`mt-4 flex items-center justify-between rounded-xl bg-white px-4 py-3`,children:[(0,d.jsx)(`div`,{className:`text-sm font-semibold text-slate-500`,children:`Split Total`}),(0,d.jsx)(`div`,{className:`text-xl font-bold text-slate-900`,children:f(Cn)})]})]}),(0,d.jsxs)(`div`,{className:`mt-5 grid grid-cols-2 gap-3`,children:[(0,d.jsx)(`button`,{onClick:()=>Ct(!1),className:`rounded-2xl bg-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-300`,children:`Cancel`}),(0,d.jsx)(`button`,{onClick:()=>{if(!m.splitBill){alert(`You do not have permission to split bills`);return}if(Sn.length===0){alert(`Select items or enter amount for split bill`);return}Dn(`Split Bill`,Sn,{showPayment:!1})},className:`rounded-2xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white hover:bg-teal-700`,children:`Print Split Bill`})]})]})})]})}export{Fe as default};