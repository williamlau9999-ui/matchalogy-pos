import { initializeApp }
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";

import {
  getFirestore,
  collection,
  addDoc,
  doc,
  onSnapshot,
  serverTimestamp
}
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import {
  getAuth,
  signInAnonymously
}
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
  apiKey:"AIzaSyD1ggANpmGObfPNaD0aFK9ZdM_hvyEFh2A",
  authDomain:"matchalogy--pos.firebaseapp.com",
  projectId:"matchalogy--pos",
  storageBucket:"matchalogy--pos.firebasestorage.app",
  messagingSenderId:"409490156449",
  appId:"1:409490156449:web:b7583414b5c16dca9f39e0"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const DEFAULT_OPTIONS = {
  milk:[
    {value:"",label:"None"},
    {value:"Full Cream Milk",label:"Full Cream Milk"},
    {value:"Oat Milk",label:"Oat Milk"},
    {value:"Coconut Milk",label:"Coconut Milk"}
  ],
  ice:[
    {value:"",label:"None"},
    {value:"Hot",label:"Hot"},
    {value:"Recommend Ice",label:"Recommend Ice"},
    {value:"Less Ice",label:"Less Ice"},
    {value:"Half Ice",label:"Half Ice"},
    {value:"Slight Ice",label:"Slight Ice"},
    {value:"No Ice",label:"No Ice"}
  ],
  sweet:[
    {value:"",label:"None"},
    {value:"Normal Sweet",label:"Normal Sweet"},
    {value:"Less Sweet",label:"Less Sweet"},
    {value:"Half Sweet",label:"Half Sweet"},
    {value:"Slightly Sweet",label:"Slightly Sweet"},
    {value:"No Additional Sugar",label:"No Additional Sugar"}
  ],
  addon:[
    {value:"0",label:"None",price:0},
    {value:"3",label:"Extra Shot +RM3",price:3},
    {value:"6",label:"Extra Double Shot +RM6",price:6}
  ]
};

let products = [];
let productMap = new Map();
let cart = loadSavedCart();
let selectedProduct = null;
let selectedConfig = null;
let currentCategory = "all";
let searchKeyword = "";
let currentUser = null;
let submitting = false;
let storeOpen = true;
let orderStatusUnsubscribe = null;

function $(id){ return document.getElementById(id); }

function escapeHTML(value){
  return String(value ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function money(value){ return (Number(value) || 0).toFixed(2); }

function safeText(value,max=200){
  return String(value ?? "").trim().slice(0,max);
}

function booleanValue(value,fallback=false){
  if(typeof value === "boolean") return value;
  if(value === "yes" || value === 1 || value === "1") return true;
  if(value === "no" || value === 0 || value === "0") return false;
  return fallback;
}

function normalizeTextOptions(options,fallback){
  const source = Array.isArray(options) && options.length ? options : fallback;
  return source.map(option=>{
    if(typeof option === "string") return {value:option,label:option || "None"};
    return {
      value:String(option?.value ?? option?.label ?? ""),
      label:String(option?.label ?? option?.value ?? "None")
    };
  });
}

function normalizeAddonOptions(options){
  const source = Array.isArray(options) && options.length ? options : DEFAULT_OPTIONS.addon;
  const normalized = source.map(option=>{
    if(typeof option === "string"){
      const match = option.match(/RM\s*(\d+(?:\.\d+)?)/i);
      const price = match ? Number(match[1]) : 0;
      return {value:String(price),label:option,price};
    }
    const price = Number(option?.price ?? option?.value) || 0;
    return {
      value:String(option?.value ?? price),
      label:String(option?.label ?? option?.name ?? (price ? `Add-on +RM${price}` : "None")),
      price
    };
  });
  if(!normalized.some(option=>Number(option.price) === 0)){
    normalized.unshift({value:"0",label:"None",price:0});
  }
  return normalized;
}

function getProductConfig(product={}){
  const enabled = booleanValue(product.modifierEnabled,false);
  return {
    enabled,
    showMilk:enabled && booleanValue(product.showMilk,true),
    showIce:enabled && booleanValue(product.showIce,true),
    showSweet:enabled && booleanValue(product.showSweet,true),
    showAddon:enabled && booleanValue(product.showAddon,true),
    showNote:enabled && booleanValue(product.showNote,true),
    milkOptions:normalizeTextOptions(product.milkOptions,DEFAULT_OPTIONS.milk),
    iceOptions:normalizeTextOptions(product.iceOptions,DEFAULT_OPTIONS.ice),
    sweetOptions:normalizeTextOptions(product.sweetOptions,DEFAULT_OPTIONS.sweet),
    addonOptions:normalizeAddonOptions(product.addonOptions)
  };
}

function showModal(id){ if($(id)) $(id).style.display = "flex"; }
function hideModal(id){ if($(id)) $(id).style.display = "none"; }

function loadSavedCart(){
  try{
    const value = JSON.parse(localStorage.getItem("matchalogyCustomerCart") || "[]");
    return Array.isArray(value) ? value : [];
  }catch{
    return [];
  }
}

function saveCart(){
  localStorage.setItem("matchalogyCustomerCart",JSON.stringify(cart));
}

function setFieldVisible(id,visible){
  const element = $(id);
  if(element) element.hidden = !visible;
}

function populateSelect(id,options,selectedValue=""){
  const select = $(id);
  if(!select) return;
  const selected = String(selectedValue ?? "");
  let list = [...options];
  if(selected && !list.some(option=>String(option.value) === selected)){
    list.push({value:selected,label:selected,price:0});
  }
  select.innerHTML = list.map(option=>`
    <option value="${escapeHTML(option.value)}" data-price="${Number(option.price) || 0}">
      ${escapeHTML(option.label)}
    </option>
  `).join("");
  select.value = list.some(option=>String(option.value) === selected)
    ? selected
    : String(list[0]?.value ?? "");
}

function optionAllowed(value,options){
  return options.some(option=>String(option.value) === String(value ?? ""));
}

function getModifierText(item){
  const firstLine = [item.milk,item.ice,item.sweet]
    .filter(Boolean)
    .map(escapeHTML)
    .join(" · ");
  const lines = [];
  if(firstLine) lines.push(firstLine);
  if(item.addon && item.addon !== "None") lines.push(escapeHTML(item.addon));
  if(item.note) lines.push(`Note: ${escapeHTML(item.note)}`);
  return lines.join("<br>");
}

async function authenticateCustomer(){
  if(auth.currentUser){
    currentUser = auth.currentUser;
    return;
  }
  const credential = await signInAnonymously(auth);
  currentUser = credential.user;
}

function listenStoreStatus(){
  onSnapshot(
    doc(db,"settings","store"),
    snapshot=>{
      storeOpen = !snapshot.exists() || snapshot.data().open !== false;
      updateStoreStatus();
      renderCustomerProducts();
    },
    error=>{
      console.error(error);
      storeOpen = false;
      updateStoreStatus();
    }
  );
}

function updateStoreStatus(){
  const banner = $("storeStatusBanner");
  if(!banner) return;
  banner.classList.remove("open","closed");
  banner.classList.add(storeOpen ? "open" : "closed");
  banner.innerText = storeOpen
    ? "Open · Orders available"
    : "Currently closed · Ordering unavailable";
}

function listenCustomerProducts(){
  onSnapshot(
    collection(db,"products"),
    snapshot=>{
      products = [];
      snapshot.forEach(docSnap=>products.push({id:docSnap.id,...docSnap.data()}));
      products.sort((a,b)=>
        Number(a.sort ?? 9999999999999) - Number(b.sort ?? 9999999999999)
      );
      productMap = new Map(products.map(product=>[product.id,product]));
      refreshCartFromProducts();
      renderCustomerProducts();
      renderCustomerCart();
    },
    error=>{
      console.error(error);
      $("customerProducts").innerHTML = '<div class="empty-state">Unable to load menu.</div>';
    }
  );
}

function refreshCartFromProducts(){
  cart = cart.flatMap(item=>{
    const product = productMap.get(item.productId);
    if(!product || product.available === false) return [];

    const config = getProductConfig(product);
    const addonCode = config.showAddon ? String(item.addonCode || "0") : "0";
    const addon = config.addonOptions.find(option=>String(option.value) === addonCode)
      || config.addonOptions.find(option=>Number(option.price) === 0)
      || {value:"0",label:"None",price:0};

    return [{
      ...item,
      name:product.name || item.name,
      basePrice:Number(product.price) || 0,
      price:(Number(product.price) || 0) + (Number(addon.price) || 0),
      milk:config.showMilk && optionAllowed(item.milk,config.milkOptions) ? item.milk : "",
      ice:config.showIce && optionAllowed(item.ice,config.iceOptions) ? item.ice : "",
      sweet:config.showSweet && optionAllowed(item.sweet,config.sweetOptions) ? item.sweet : "",
      addonCode:String(addon.value),
      addon:addon.label,
      note:config.showNote ? safeText(item.note,200) : ""
    }];
  });
  saveCart();
}

function renderCustomerProducts(){
  const keyword = searchKeyword.toLowerCase();
  const visible = products.filter(product=>{
    const category = String(product.category || "").toLowerCase();
    const categoryMatch = currentCategory === "all" || category === currentCategory;
    const text = `${product.name || ""} ${product.category || ""}`.toLowerCase();
    return categoryMatch && (!keyword || text.includes(keyword));
  });

  if(!visible.length){
    $("customerProducts").innerHTML = '<div class="empty-state">No products found.</div>';
    return;
  }

  $("customerProducts").innerHTML = visible.map(product=>{
    const available = product.available !== false;
    const canOrder = storeOpen && available;
    const image = product.image || product.imageUrl || product.photo || "./logo.png";
    return `
      <article class="customer-product ${available ? "" : "sold-out"}">
        ${available ? "" : '<div class="customer-sold-out-badge">Sold Out</div>'}
        <img
          src="${escapeHTML(image)}"
          alt="${escapeHTML(product.name || "")}" 
          loading="lazy"
          decoding="async"
          onerror="this.onerror=null;this.src='./logo.png';"
        >
        <div class="customer-product-body">
          <div class="customer-product-name">${escapeHTML(product.name || "")}</div>
          <div class="customer-product-category">${escapeHTML(product.category || "Menu")}</div>
          <div class="customer-product-price">RM ${money(product.price)}</div>
          <button
            class="customer-add-product"
            data-product-id="${escapeHTML(product.id)}"
            ${canOrder ? "" : "disabled"}
          >${!storeOpen ? "Closed" : available ? "Add" : "Sold Out"}</button>
        </div>
      </article>
    `;
  }).join("");

  document.querySelectorAll(".customer-add-product").forEach(button=>{
    button.addEventListener("click",()=>{
      if(button.disabled) return;
      const product = productMap.get(button.dataset.productId);
      if(product) selectCustomerProduct(product);
    });
  });
}

function selectCustomerProduct(product){
  if(!storeOpen || product.available === false) return;

  const config = getProductConfig(product);
  const hasFields = config.showMilk || config.showIce || config.showSweet || config.showAddon || config.showNote;

  if(!config.enabled || !hasFields){
    addPlainItem(product);
    return;
  }

  selectedProduct = product;
  selectedConfig = config;
  $("customerModifierTitle").innerText = product.name || "Product";

  setFieldVisible("customerMilkGroup",config.showMilk);
  setFieldVisible("customerIceGroup",config.showIce);
  setFieldVisible("customerSweetGroup",config.showSweet);
  setFieldVisible("customerAddonGroup",config.showAddon);
  setFieldVisible("customerNoteGroup",config.showNote);

  populateSelect("customerMilk",config.milkOptions,product.defaultMilk || "");
  populateSelect("customerIce",config.iceOptions,product.defaultIce || "");
  populateSelect("customerSweet",config.sweetOptions,product.defaultSweet || "");
  populateSelect("customerAddon",config.addonOptions,product.defaultAddon || "0");
  $("customerItemNote").value = config.showNote ? safeText(product.defaultNote,200) : "";

  showModal("customerModifierModal");
}

function addPlainItem(product){
  const existing = cart.find(item=>
    item.productId === product.id &&
    !item.milk && !item.ice && !item.sweet &&
    String(item.addonCode || "0") === "0" && !item.note
  );

  if(existing){
    if(existing.qty < 20) existing.qty += 1;
  }else{
    cart.push({
      productId:product.id,
      name:product.name,
      basePrice:Number(product.price) || 0,
      price:Number(product.price) || 0,
      qty:1,
      milk:"",
      ice:"",
      sweet:"",
      addonCode:"0",
      addon:"None",
      note:""
    });
  }

  saveCart();
  renderCustomerCart();
}

function renderCustomerCart(){
  const quantity = cart.reduce((sum,item)=>sum + (Number(item.qty) || 0),0);
  const total = cart.reduce((sum,item)=>sum + (Number(item.price) || 0) * (Number(item.qty) || 0),0);

  $("cartCount").innerText = quantity;
  $("floatingTotal").innerText = money(total);
  $("customerTotal").innerText = money(total);

  if(!cart.length){
    $("customerCartList").innerHTML = '<div class="empty-state">Your cart is empty.</div>';
    return;
  }

  $("customerCartList").innerHTML = cart.map((item,index)=>{
    const modifier = getModifierText(item);
    return `
      <div class="customer-cart-item">
        <div class="customer-cart-top">
          <div>
            <div class="customer-cart-name">${escapeHTML(item.name)}</div>
            ${modifier ? `<div class="customer-cart-modifier">${modifier}</div>` : ""}
          </div>
          <strong>RM ${money(item.price * item.qty)}</strong>
        </div>
        <div class="customer-cart-bottom">
          <span>RM ${money(item.price)} each</span>
          <div class="customer-cart-controls">
            <button class="customer-minus" data-index="${index}">−</button>
            <strong>${item.qty}</strong>
            <button class="customer-plus" data-index="${index}">+</button>
            <button class="remove-customer-item" data-index="${index}">×</button>
          </div>
        </div>
      </div>
    `;
  }).join("");

  bindCartControls();
}

function bindCartControls(){
  document.querySelectorAll(".customer-minus").forEach(button=>{
    button.addEventListener("click",()=>{
      const index = Number(button.dataset.index);
      if(!cart[index]) return;
      cart[index].qty -= 1;
      if(cart[index].qty <= 0) cart.splice(index,1);
      saveCart();
      renderCustomerCart();
    });
  });

  document.querySelectorAll(".customer-plus").forEach(button=>{
    button.addEventListener("click",()=>{
      const index = Number(button.dataset.index);
      if(cart[index] && cart[index].qty < 20) cart[index].qty += 1;
      saveCart();
      renderCustomerCart();
    });
  });

  document.querySelectorAll(".remove-customer-item").forEach(button=>{
    button.addEventListener("click",()=>{
      cart.splice(Number(button.dataset.index),1);
      saveCart();
      renderCustomerCart();
    });
  });
}

$("customerAddModifierBtn").addEventListener("click",()=>{
  if(!selectedProduct || !selectedConfig) return;

  const config = selectedConfig;
  const milk = config.showMilk ? safeText($("customerMilk").value,40) : "";
  const ice = config.showIce ? safeText($("customerIce").value,40) : "";
  const sweet = config.showSweet ? safeText($("customerSweet").value,40) : "";
  const note = config.showNote ? safeText($("customerItemNote").value,200) : "";

  const addonOption = config.showAddon
    ? $("customerAddon").selectedOptions[0]
    : null;
  const addonCode = addonOption ? addonOption.value : "0";
  const addonPrice = addonOption ? Number(addonOption.dataset.price) || 0 : 0;
  const addonName = addonOption ? addonOption.text.trim() : "None";
  const basePrice = Number(selectedProduct.price) || 0;
  const finalPrice = basePrice + addonPrice;

  const existing = cart.find(item=>
    item.productId === selectedProduct.id &&
    item.milk === milk &&
    item.ice === ice &&
    item.sweet === sweet &&
    item.addonCode === addonCode &&
    item.note === note
  );

  if(existing){
    if(existing.qty < 20) existing.qty += 1;
  }else{
    cart.push({
      productId:selectedProduct.id,
      name:selectedProduct.name,
      basePrice,
      price:finalPrice,
      qty:1,
      milk,
      ice,
      sweet,
      addonCode,
      addon:addonName,
      note
    });
  }

  selectedProduct = null;
  selectedConfig = null;
  hideModal("customerModifierModal");
  saveCart();
  renderCustomerCart();
});

function listenToSubmittedOrder(orderRef){
  if(orderStatusUnsubscribe) orderStatusUnsubscribe();

  orderStatusUnsubscribe = onSnapshot(orderRef,snapshot=>{
    if(!snapshot.exists()) return;
    const order = snapshot.data();
    const status = order.status || "pending";
    const statusElement = $("customerOrderStatus");
    const detailElement = $("customerOrderStatusDetail");

    statusElement.classList.remove("pending","accepted","rejected");
    statusElement.classList.add(status);

    if(status === "pending"){
      statusElement.innerText = "Waiting for shop confirmation";
      detailElement.innerText = "Please keep this order number and pay at the counter after confirmation.";
    }else if(status === "accepted"){
      statusElement.innerText = "Order accepted";
      const finalTotal = Number(order.finalTotal);
      const totalText = Number.isFinite(finalTotal) ? ` · RM ${money(finalTotal)}` : "";
      detailElement.innerText = order.officialOrderNo
        ? `Official order #${order.officialOrderNo}${totalText}`
        : `Please proceed to payment at the counter${totalText}.`;
    }else if(status === "rejected"){
      statusElement.innerText = "Order unavailable";
      detailElement.innerText = order.rejectReason || "Please speak to our staff.";
    }
  });
}

async function submitCustomerOrder(){
  if(submitting) return;
  if(!currentUser){
    alert("Connecting to ordering system. Please try again.");
    return;
  }
  if(!storeOpen){
    alert("The store is currently closed.");
    return;
  }
  if(!cart.length){
    alert("Your cart is empty.");
    return;
  }
  if(cart.length > 30){
    alert("Too many different items in one order.");
    return;
  }

  const customerName = safeText($("customerName").value,50);
  if(!customerName){
    alert("Please enter your pickup name.");
    $("customerName").focus();
    return;
  }

  refreshCartFromProducts();
  if(!cart.length){
    alert("The selected products are no longer available.");
    renderCustomerCart();
    return;
  }

  const customerPhone = safeText($("customerPhone").value,30);
  const orderNote = safeText($("customerOrderNote").value,300);
  const orderItems = cart.map(item=>({
    productId:String(item.productId),
    nameSnapshot:safeText(item.name,100),
    qty:Math.min(20,Math.max(1,Number(item.qty) || 1)),
    milk:safeText(item.milk,40),
    ice:safeText(item.ice,40),
    sweet:safeText(item.sweet,40),
    addonCode:String(item.addonCode || "0"),
    addonName:safeText(item.addon,80),
    note:safeText(item.note,200),
    estimatedUnitPrice:Number(item.price) || 0
  }));

  const estimatedTotal = orderItems.reduce(
    (sum,item)=>sum + item.estimatedUnitPrice * item.qty,
    0
  );
  const customerOrderNo = `QR${Date.now().toString().slice(-6)}`;
  const button = $("submitCustomerOrderBtn");

  submitting = true;
  button.disabled = true;
  button.innerText = "Submitting...";

  try{
    const orderRef = await addDoc(collection(db,"pendingOrders"),{

customerName:
  document.getElementById(
    "customerName"
  ).value.trim(),

      creatorUid:currentUser.uid,
      customerOrderNo,
      customerName,
      customerPhone,
      note:orderNote,
      items:orderItems,
      estimatedTotal,
      source:"QR",
      status:"pending",
      createdAt:serverTimestamp()
    });

    hideModal("customerCartModal");
    $("customerOrderNumber").innerText = customerOrderNo;
    $("customerOrderStatus").className = "customer-order-status pending";
    $("customerOrderStatus").innerText = "Waiting for shop confirmation";
    $("customerOrderStatusDetail").innerText = "Please pay at the counter after the order is accepted.";
    showModal("orderSuccessModal");
    listenToSubmittedOrder(orderRef);

    cart = [];
    saveCart();
    $("customerName").value = "";
    $("customerPhone").value = "";
    $("customerOrderNote").value = "";
    renderCustomerCart();
  }catch(error){
    console.error(error);
    alert(error.message || "Unable to submit order. Please try again.");
  }finally{
    submitting = false;
    button.disabled = false;
    button.innerText = "Submit Order";
  }
}

document.querySelectorAll(".category-tab").forEach(tab=>{
  tab.addEventListener("click",()=>{
    document.querySelectorAll(".category-tab").forEach(item=>item.classList.remove("active"));
    tab.classList.add("active");
    currentCategory = tab.dataset.category;
    renderCustomerProducts();
  });
});

$("customerSearch").addEventListener("input",event=>{
  searchKeyword = event.target.value.trim();
  renderCustomerProducts();
});

$("openCartBtn").addEventListener("click",()=>showModal("customerCartModal"));
$("closeCartBtn").addEventListener("click",()=>hideModal("customerCartModal"));
$("closeModifierBtn").addEventListener("click",()=>hideModal("customerModifierModal"));
$("closeSuccessBtn").addEventListener("click",()=>hideModal("orderSuccessModal"));
$("submitCustomerOrderBtn").addEventListener("click",submitCustomerOrder);

["customerModifierModal","customerCartModal"].forEach(id=>{
  $(id).addEventListener("click",event=>{
    if(event.target === $(id)) hideModal(id);
  });
});

async function startCustomerApp(){
  try{
    await authenticateCustomer();
    renderCustomerCart();
    listenStoreStatus();
    listenCustomerProducts();
  }catch(error){
    console.error(error);
    $("customerProducts").innerHTML = '<div class="empty-state">Unable to connect to the ordering system.</div>';
  }
}

startCustomerApp();
