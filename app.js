import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, getDoc, setDoc, deleteDoc, doc, updateDoc, query, orderBy, onSnapshot, runTransaction, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// 🔥 FIREBASE CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyD1ggANpmGObfPNaD0aFK9ZdM_hvyEFh2A",
  authDomain: "matchalogy--pos.firebaseapp.com",
  projectId: "matchalogy--pos",
  storageBucket: "matchalogy--pos.firebasestorage.app",
  messagingSenderId: "409490156449",
  appId: "1:409490156449:web:b7583414b5c16dca9f39e0",
  measurementId: "G-M6CY1YCQCT"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const CLOUDINARY_CLOUD_NAME = "ddtusynwx";
const CLOUDINARY_UPLOAD_PRESET = "matchalogy_products";
const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

let appStarted = false;
let currentStaffRole = "";
let pendingUnsubscribe = null;

let cart = [];
let editingId = null;
let currentCategory = "all";
let selectedProduct = null;
let sortableInstance = null;
let allClosings = [];
let fullMonthSales = {};
let fullAllTimeSales = {};
let currentSalesView = "month";
let productCache = new Map();
let pendingImageFile = null;
let editingImageUrl = "";
let editingImagePath = "";
let removeCurrentImage = false;

// ---------- HELPERS ----------
function $(id){ return document.getElementById(id); }
function getValue(id){ return $(id) ? $(id).value : ""; }
function setValue(id,value){ if($(id)){ $(id).value = value ?? ""; } }
function setText(id,value){ if($(id)){ $(id).innerText = value; } }
function setHTML(id,value){ if($(id)){ $(id).innerHTML = value; } }
function show(id){ if($(id)){ $(id).style.display = "flex"; } }
function hide(id){ if($(id)){ $(id).style.display = "none"; } }

function escapeHTML(value){
  return String(value ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function toDate(value){
  if(!value){ return new Date(); }
  if(value.seconds){ return new Date(value.seconds * 1000); }
  if(value.toDate){ return value.toDate(); }
  return new Date(value);
}

function money(value){ return (Number(value) || 0).toFixed(2); }

function getModifierHTML(item){
  const main = [item.milk, item.ice, item.sweet].filter(Boolean).join(" · ");
  let html = "";
  if(main){ html += main; }
  if(item.addon && item.addon !== "None"){ html += `${html ? "<br>" : ""}${escapeHTML(item.addon)}`; }
  if(item.note){ html += `${html ? "<br>" : ""}Note: ${escapeHTML(item.note)}`; }
  return html;
}

const DEFAULT_MODIFIER_OPTIONS = {
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

function booleanValue(value,fallback=false){
  if(typeof value === "boolean") return value;
  if(value === "yes" || value === 1 || value === "1") return true;
  if(value === "no" || value === 0 || value === "0") return false;
  return fallback;
}

function normalizeTextOptions(options,fallback){
  const source = Array.isArray(options) && options.length ? options : fallback;
  return source.map(option=>{
    if(typeof option === "string"){ return {value:option,label:option || "None"}; }
    return { value:String(option?.value ?? option?.label ?? ""), label:String(option?.label ?? option?.value ?? "None") };
  });
}

function normalizeAddonOptions(options){
  const source = Array.isArray(options) && options.length ? options : DEFAULT_MODIFIER_OPTIONS.addon;
  const normalized = source.map(option=>{
    if(typeof option === "string"){
      const priceMatch = option.match(/RM\s*(\d+(?:\.\d+)?)/i);
      const price = priceMatch ? Number(priceMatch[1]) : 0;
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

function getProductModifierConfig(product={}){
  const enabled = booleanValue(product.modifierEnabled,false);
  return {
    enabled,
    showMilk:enabled && booleanValue(product.showMilk,true),
    showIce:enabled && booleanValue(product.showIce,true),
    showSweet:enabled && booleanValue(product.showSweet,true),
    showAddon:enabled && booleanValue(product.showAddon,true),
    showNote:enabled && booleanValue(product.showNote,true),
    milkOptions:normalizeTextOptions(product.milkOptions,DEFAULT_MODIFIER_OPTIONS.milk),
    iceOptions:normalizeTextOptions(product.iceOptions,DEFAULT_MODIFIER_OPTIONS.ice),
    sweetOptions:normalizeTextOptions(product.sweetOptions,DEFAULT_MODIFIER_OPTIONS.sweet),
    addonOptions:normalizeAddonOptions(product.addonOptions)
  };
}

function populateSelect(id,options,selectedValue=""){
  const select = $(id);
  if(!select) return;
  const normalizedSelected = String(selectedValue ?? "");
  let list = [...options];
  if(normalizedSelected && !list.some(option=>String(option.value) === normalizedSelected)){
    list.push({value:normalizedSelected,label:normalizedSelected,price:0});
  }
  select.innerHTML = list.map(option=>`
    <option value="${escapeHTML(option.value)}" data-price="${Number(option.price) || 0}">
      ${escapeHTML(option.label)}
    </option>
  `).join("");
  select.value = list.some(option=>String(option.value) === normalizedSelected) ? normalizedSelected : String(list[0]?.value ?? "");
}

function setVisible(id,visible){
  const element = $(id);
  if(element) element.style.display = visible ? "" : "none";
}

function syncProductSettingsVisibility(){
  const enabled = getValue("modifierEnabled") === "yes";
  setVisible("productModifierSettings",enabled);
  setVisible("productMilkSettings",enabled && getValue("showMilk") === "yes");
  setVisible("productIceSettings",enabled && getValue("showIce") === "yes");
  setVisible("productSweetSettings",enabled && getValue("showSweet") === "yes");
  setVisible("productAddonSettings",enabled && getValue("showAddon") === "yes");
  setVisible("productNoteSettings",enabled && getValue("showNote") === "yes");
}

function showProductPhotoPreview(url){
  const preview = $("productImagePreview");
  if(!preview) return;
  preview.onerror = ()=>{ preview.onerror = null; preview.src = "./logo.png"; };
  preview.src = url || "./logo.png";
}

function resetProductImageEditor(product={}){
  pendingImageFile = null;
  removeCurrentImage = false;
  editingImageUrl = String(product.image || product.imageUrl || "");
  editingImagePath = String(product.imagePath || "");
  setValue("image",editingImageUrl);
  setValue("imagePath",editingImagePath);
  if($("productImageFile")) $("productImageFile").value = "";
  setText("imageUploadStatus",editingImageUrl ? "Current photo will be kept unless you choose a new one or remove it." : "Choose a photo. It will be compressed and uploaded to Cloudinary when you save.");
  showProductPhotoPreview(editingImageUrl || "./logo.png");
}

function safeFileName(value){ return String(value || "product").toLowerCase().replace(/[^a-z0-9._-]+/g,"-").replace(/-+/g,"-").slice(0,80); }

async function compressProductImage(file){
  if(!file.type.startsWith("image/")){ throw new Error("Please choose an image file."); }
  if(file.size > 12 * 1024 * 1024){ throw new Error("Photo is too large. Maximum size is 12MB."); }
  const objectUrl = URL.createObjectURL(file);
  try{
    const image = await new Promise((resolve,reject)=>{
      const img = new Image();
      img.onload = ()=>resolve(img);
      img.onerror = ()=>reject(new Error("Unable to read this photo."));
      img.src = objectUrl;
    });
    const maxSide = 1600;
    const scale = Math.min(1,maxSide / Math.max(image.naturalWidth,image.naturalHeight));
    const width = Math.max(1,Math.round(image.naturalWidth * scale));
    const height = Math.max(1,Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    context.drawImage(image,0,0,width,height);
    const blob = await new Promise(resolve=> canvas.toBlob(resolve,"image/jpeg",0.84) );
    if(!blob) throw new Error("Unable to prepare this photo.");
    return blob;
  }finally{
    URL.revokeObjectURL(objectUrl);
  }
}

async function uploadProductPhoto(file,productId){
  const blob = await compressProductImage(file);
  const formData = new FormData();
  const fileName = `${safeFileName(file.name.replace(/\.[^.]+$/,"")) || "product"}.jpg`;
  formData.append("file",blob,fileName);
  formData.append("upload_preset",CLOUDINARY_UPLOAD_PRESET);
  formData.append("folder","matchalogy/products");
  formData.append("context",`product_id=${productId}`);
  const response = await fetch(CLOUDINARY_UPLOAD_URL, { method:"POST", body:formData });
  let result = {};
  try{ result = await response.json(); }catch(error){ throw new Error("Cloudinary returned an invalid response."); }
  if(!response.ok || !result.secure_url){ throw new Error(result?.error?.message || "Unable to upload this photo to Cloudinary."); }
  return { image:result.secure_url, imagePath:result.public_id || "" };
}

// ---------- PRODUCTS ----------
async function loadProducts(){
  const snapshot = await getDocs(collection(db,"products"));
  const productList = [];
  snapshot.forEach(docSnap=>{ productList.push({id:docSnap.id,...docSnap.data()}); });
  productList.sort((a,b)=> Number(a.sort ?? 9999999999999) - Number(b.sort ?? 9999999999999) );
  productCache = new Map(productList.map(product=>[product.id,product]));

  const visibleProducts = productList.filter(product=>{
    const category = String(product.category || "").toLowerCase();
    return currentCategory === "all" || category === currentCategory;
  });

  const html = visibleProducts.map(product=>{
    const price = Number(product.price) || 0;
    const available = product.available !== false;
    const image = product.image || product.imageUrl || product.photo || "./logo.png";
    return `
      <div class="card ${available ? "" : "sold-out"}" data-id="${escapeHTML(product.id)}">
        ${available ? "" : '<div class="sold-out-badge">Sold Out</div>'}
        <img src="${escapeHTML(image)}" alt="${escapeHTML(product.name || "")}" loading="lazy" onerror="this.onerror=null;this.src='./logo.png';">
        <div class="card-body">
          <div class="drag-handle">☰</div>
          <div class="name">${escapeHTML(product.name || "")}</div>
          <div class="price">${escapeHTML(product.category || "Menu")} · RM ${money(price)}</div>
          <div class="actions">
            <button class="small-btn edit" data-id="${escapeHTML(product.id)}">Edit</button>
            <button class="small-btn delete" data-delete="${escapeHTML(product.id)}">Delete</button>
          </div>
        </div>
      </div>
    `;
  }).join("");

  setHTML("products",html || '<div class="card-box">No products found.</div>');
  bindProductClicks();
  bindProductActions();
  initSortable();
}

function openStaffModifier(product){
  const config = getProductModifierConfig(product);
  if(!config.enabled){
    addPlainCartItem(product.name,Number(product.price) || 0);
    return;
  }
  selectedProduct = product;
  setText("modifierTitle",product.name || "Product");
  setVisible("staffMilkGroup",config.showMilk);
  setVisible("staffIceGroup",config.showIce);
  setVisible("staffSweetGroup",config.showSweet);
  setVisible("staffAddonGroup",config.showAddon);
  setVisible("staffNoteGroup",config.showNote);

  populateSelect("milkSelect",config.milkOptions,config.showMilk ? product.defaultMilk || "" : "");
  populateSelect("iceSelect",config.iceOptions,config.showIce ? product.defaultIce || "" : "");
  populateSelect("sweetSelect",config.sweetOptions,config.showSweet ? product.defaultSweet || "" : "");
  populateSelect("addonSelect",config.addonOptions,config.showAddon ? product.defaultAddon || "0" : "0");
  setValue("noteInput",config.showNote ? product.defaultNote || "" : "");

  const hasVisibleFields = config.showMilk || config.showIce || config.showSweet || config.showAddon || config.showNote;
  if(!hasVisibleFields){
    addPlainCartItem(product.name,Number(product.price) || 0);
    selectedProduct = null;
    return;
  }
  show("modifierModal");
}

function bindProductClicks(){
  document.querySelectorAll(".card").forEach(card=>{
    card.addEventListener("click",event=>{
      if( event.target.classList.contains("edit") || event.target.classList.contains("delete") || event.target.classList.contains("drag-handle") ) return;
      const product = productCache.get(card.dataset.id);
      if(!product) return;
      if(product.available === false){ alert("This product is marked Sold Out."); return; }
      openStaffModifier(product);
    });
  });
}

function bindProductActions(){
  document.querySelectorAll("[data-delete]").forEach(button=>{
    button.addEventListener("click",async()=>{
      const product = productCache.get(button.dataset.delete);
      if(!product || !confirm("Delete this product?")) return;
      await deleteDoc(doc(db,"products",button.dataset.delete));
      loadProducts();
    });
  });

  document.querySelectorAll(".edit").forEach(button=>{
    button.addEventListener("click",()=>{
      const product = productCache.get(button.dataset.id);
      if(!product) return;
      editingId = product.id;
      const config = getProductModifierConfig(product);
      setText("productModalTitle","Edit Product");
      setValue("name",product.name || "");
      setValue("price",Number(product.price) || 0);
      const productCategory = String(product.category || "other").toLowerCase();
      setValue("category", ["matcha","espresso","basque","mousse","other"].includes(productCategory) ? productCategory : "other");
      setValue("productAvailable",product.available === false ? "no" : "yes");
      setValue("modifierEnabled",config.enabled ? "yes" : "no");
      setValue("showMilk",config.showMilk ? "yes" : "no");
      setValue("showIce",config.showIce ? "yes" : "no");
      setValue("showSweet",config.showSweet ? "yes" : "no");
      setValue("showAddon",config.showAddon ? "yes" : "no");
      setValue("showNote",config.showNote ? "yes" : "no");

      populateSelect("defaultMilk",config.milkOptions,product.defaultMilk || "");
      populateSelect("defaultIce",config.iceOptions,product.defaultIce || "");
      populateSelect("defaultSweet",config.sweetOptions,product.defaultSweet || "");
      populateSelect("defaultAddon",config.addonOptions,product.defaultAddon || "0");
      setValue("defaultNote",product.defaultNote || "");

      resetProductImageEditor(product);
      syncProductSettingsVisibility();
      show("productModal");
    });
  });
}

function initSortable(){
  const productsEl = $("products");
  if(!productsEl || typeof Sortable === "undefined"){ return; }
  if(sortableInstance){ sortableInstance.destroy(); }
  sortableInstance = new Sortable(productsEl, {
    handle:".drag-handle", animation:150, ghostClass:"dragging",
    onEnd: async ()=>{
      const cards = document.querySelectorAll(".card");
      for(let i=0;i<cards.length;i++){
        const id = cards[i].dataset.id;
        await updateDoc(doc(db,"products",id), { sort:i });
      }
    }
  });
}

// ---------- CART ----------
function addPlainCartItem(name,price){
  const existing = cart.find(i=> i.name === name && !i.milk && !i.ice && !i.sweet && !i.addon && !i.note );
  if(existing){ existing.qty += 1; }else{ cart.push({ name, price, qty:1 }); }
  renderCart();
}

// ---------- RENDER CART ----------
function renderCart(){
  let html = "";
  let subtotal = 0;
  cart.forEach((item,index)=>{
    const lineTotal = (Number(item.price) || 0) * (Number(item.qty) || 0);
    subtotal += lineTotal;
    const modifierHTML = getModifierHTML(item);
    html += `
      <li>
        <strong>${escapeHTML(item.name)}</strong>
        ${modifierHTML ? `<br><small>${modifierHTML}</small>` : ""}
        <br><br>
        x${item.qty} - RM${money(lineTotal)}
        <button class="remove-btn minus-btn" data-index="${index}">-</button>
        <button class="remove-btn plus-btn" data-index="${index}">+</button>
        <button class="remove-btn delete-cart-btn" data-index="${index}">❌</button>
      </li>
    `;
  });

  setHTML("cart",html);
  const discount = Number(getValue("discount")) || 0;
  const total = Math.max(0, subtotal - discount);
  setText("total", money(total));

  document.querySelectorAll(".minus-btn").forEach(btn=>{
    btn.addEventListener("click",()=>{
      const index = Number(btn.dataset.index);
      cart[index].qty -= 1;
      if(cart[index].qty <= 0){ cart.splice(index,1); }
      renderCart();
    });
  });

  document.querySelectorAll(".plus-btn").forEach(btn=>{
    btn.addEventListener("click",()=>{
      const index = Number(btn.dataset.index);
      cart[index].qty += 1;
      renderCart();
    });
  });

  document.querySelectorAll(".delete-cart-btn").forEach(btn=>{
    btn.addEventListener("click",()=>{
      cart.splice(Number(btn.dataset.index), 1);
      renderCart();
    });
  });
}

// ---------- MODIFIER ----------
if($("addModifierBtn")){
  $("addModifierBtn").addEventListener("click",()=>{
    if(!selectedProduct) return;
    const config = getProductModifierConfig(selectedProduct);
    const milk = config.showMilk ? getValue("milkSelect") : "";
    const ice = config.showIce ? getValue("iceSelect") : "";
    const sweet = config.showSweet ? getValue("sweetSelect") : "";
    const note = config.showNote ? getValue("noteInput").trim().slice(0,200) : "";
    const addonSelect = $("addonSelect");
    const selectedAddonOption = config.showAddon && addonSelect ? addonSelect.selectedOptions[0] : null;
    const addonCode = selectedAddonOption ? selectedAddonOption.value : "0";
    const addonPrice = selectedAddonOption ? Number(selectedAddonOption.dataset.price) || 0 : 0;
    const addonName = selectedAddonOption ? selectedAddonOption.text.trim() : "None";
    const finalPrice = (Number(selectedProduct.price) || 0) + addonPrice;

    const existing = cart.find(item=>
      item.productId === selectedProduct.id && item.milk === milk && item.ice === ice &&
      item.sweet === sweet && item.addonCode === addonCode && item.note === note && Number(item.price) === Number(finalPrice)
    );

    if(existing){ existing.qty += 1; }else{
      cart.push({ productId:selectedProduct.id, name:selectedProduct.name, price:finalPrice, qty:1, milk, ice, sweet, addon:addonName, addonCode, note });
    }
    selectedProduct = null;
    renderCart();
    hide("modifierModal");
  });
}

// ---------- PRODUCT MODAL + SAVE PRODUCT ----------
function prepareNewProductForm(){
  editingId = null;
  setText("productModalTitle","Add Product");
  setValue("name",""); setValue("price",""); setValue("category","matcha"); setValue("productAvailable","yes");
  setValue("modifierEnabled","no"); setValue("showMilk","yes"); setValue("showIce","yes"); setValue("showSweet","yes");
  setValue("showAddon","yes"); setValue("showNote","yes");
  populateSelect("defaultMilk",DEFAULT_MODIFIER_OPTIONS.milk,"");
  populateSelect("defaultIce",DEFAULT_MODIFIER_OPTIONS.ice,"");
  populateSelect("defaultSweet",DEFAULT_MODIFIER_OPTIONS.sweet,"");
  populateSelect("defaultAddon",DEFAULT_MODIFIER_OPTIONS.addon,"0");
  setValue("defaultNote","");
  resetProductImageEditor({});
  syncProductSettingsVisibility();
}

if($("openProductBtn")){ $("openProductBtn").addEventListener("click",()=>{ prepareNewProductForm(); show("productModal"); }); }
if($("closeProductBtn")){ $("closeProductBtn").addEventListener("click",()=>hide("productModal")); }

["modifierEnabled","showMilk","showIce","showSweet","showAddon","showNote"].forEach(id=>{
  if($(id)) $(id).addEventListener("change",syncProductSettingsVisibility);
});

if($("productImageFile")){
  $("productImageFile").addEventListener("change",event=>{
    const file = event.target.files?.[0] || null;
    pendingImageFile = file; removeCurrentImage = false;
    if(!file){ showProductPhotoPreview(editingImageUrl || "./logo.png"); return; }
    if(!file.type.startsWith("image/")){ alert("Please choose an image file."); event.target.value = ""; pendingImageFile = null; return; }
    const previewUrl = URL.createObjectURL(file);
    showProductPhotoPreview(previewUrl);
    setText("imageUploadStatus",`${file.name} selected. Photo will upload to Cloudinary when you save.`);
    setTimeout(()=>URL.revokeObjectURL(previewUrl),10000);
  });
}

if($("removeProductImageBtn")){
  $("removeProductImageBtn").addEventListener("click",()=>{
    pendingImageFile = null; removeCurrentImage = true;
    if($("productImageFile")) $("productImageFile").value = "";
    setValue("image",""); setValue("imagePath","");
    showProductPhotoPreview("./logo.png");
    setText("imageUploadStatus","Photo will be removed when you save.");
  });
}

if($("saveBtn")){
  $("saveBtn").addEventListener("click",async()=>{
    const name = getValue("name").trim();
    const price = Number(getValue("price"));
    const category = getValue("category").trim().toLowerCase();
    if(!name || !Number.isFinite(price) || price < 0){ alert("请填写正确的商品名称和价格"); return; }

    const button = $("saveBtn");
    button.disabled = true; button.innerText = pendingImageFile ? "Uploading Photo..." : "Saving...";

    const productRef = editingId ? doc(db,"products",editingId) : doc(collection(db,"products"));
    let nextImage = removeCurrentImage ? "" : editingImageUrl;
    let nextImagePath = removeCurrentImage ? "" : editingImagePath;

    try{
      if(pendingImageFile){
        const uploaded = await uploadProductPhoto(pendingImageFile,productRef.id);
        nextImage = uploaded.image; nextImagePath = uploaded.imagePath;
      }
      const modifierEnabled = getValue("modifierEnabled") === "yes";
      const showMilk = modifierEnabled && getValue("showMilk") === "yes";
      const showIce = modifierEnabled && getValue("showIce") === "yes";
      const showSweet = modifierEnabled && getValue("showSweet") === "yes";
      const showAddon = modifierEnabled && getValue("showAddon") === "yes";
      const showNote = modifierEnabled && getValue("showNote") === "yes";

      const productData = {
        name, price, category, image:nextImage, imagePath:nextImagePath,
        available:getValue("productAvailable") !== "no", modifierEnabled, showMilk, showIce, showSweet, showAddon, showNote,
        defaultMilk:showMilk ? getValue("defaultMilk") : "", defaultIce:showIce ? getValue("defaultIce") : "",
        defaultSweet:showSweet ? getValue("defaultSweet") : "", defaultAddon:showAddon ? getValue("defaultAddon") || "0" : "0",
        defaultNote:showNote ? getValue("defaultNote").trim().slice(0,200) : "",
        milkOptions:DEFAULT_MODIFIER_OPTIONS.milk, iceOptions:DEFAULT_MODIFIER_OPTIONS.ice, sweetOptions:DEFAULT_MODIFIER_OPTIONS.sweet,
        addonOptions:DEFAULT_MODIFIER_OPTIONS.addon, updatedAt:serverTimestamp()
      };
      if(!editingId){ productData.sort = Date.now(); productData.createdAt = serverTimestamp(); }
      await setDoc(productRef,productData,{merge:true});
      alert(editingId ? "Updated ✅" : "Added ✅");
      editingId = null; hide("productModal"); await loadProducts();
    }catch(error){
      console.error(error); alert(error.message || "Unable to save this product.");
    }finally{
      button.disabled = false; button.innerText = "Save Product";
    }
  });
}

// ---------- CHECKOUT ----------
if($("clearCartBtn")){ $("clearCartBtn").addEventListener("click",()=>{ cart = []; renderCart(); }); }

async function checkout(method){
  if(cart.length === 0){ alert("Cart empty"); return; }
  const orderNo = Date.now().toString().slice(-6);
  const orderNote = getValue("orderNote");
  const subtotal = cart.reduce((s,i)=> s + ((Number(i.price) || 0) * (Number(i.qty) || 0)), 0);
  const discount = Number(getValue("discount")) || 0;
  const total = Math.max(0, subtotal - discount);

  const orderData = { orderNo, items:cart, subtotal, discount, total, payment:method, note:orderNote, time:new Date() };
  await addDoc(collection(db,"orders"), orderData);
  showReceipt(orderData);
  cart = []; setValue("discount",""); setValue("orderNote","");
  renderCart(); loadDashboard();
}

if($("cashBtn")){ $("cashBtn").addEventListener("click",()=>{ checkout("Cash"); }); }
if($("tngBtn")){ $("tngBtn").addEventListener("click",()=>{ checkout("TNG"); }); }
if($("ShopeeBtn")){ $("ShopeeBtn").addEventListener("click",()=>{ checkout("Shopee"); }); }
if($("discount")){ $("discount").addEventListener("input",()=>{ renderCart(); }); }

// ---------- CATEGORY TABS ----------
document.querySelectorAll(".tab").forEach(tab=>{
  tab.addEventListener("click",()=>{
    document.querySelectorAll(".tab").forEach(t=>{ t.classList.remove("active"); });
    tab.classList.add("active");
    currentCategory = tab.dataset.category;
    loadProducts();
  });
});

// ---------- DASHBOARD ----------
function renderTopSelling(data){
  const sorted = Object.entries(data).sort((a,b)=>b[1]-a[1]).slice(0,3);
  if(sorted.length === 0){ return "-"; }
  return sorted.map((item,index)=>`<div>${index + 1}. ${escapeHTML(item[0])} x${item[1]}</div>`).join("");
}

function renderFullSales(data){
  const sorted = Object.entries(data).sort((a,b)=>b[1]-a[1]);
  if(sorted.length === 0){ return "<div>No sales data</div>"; }
  return sorted.map((item,index)=>`
    <div class="full-sales-row">
      <span>${index + 1}. ${escapeHTML(item[0])}</span><strong>x${item[1]}</strong>
    </div>
  `).join("");
}

async function loadDashboard(){
  const q = query(collection(db,"orders"), orderBy("time","desc"));
  const snapshot = await getDocs(q);
  let revenue = 0; let count = 0; let discountTotal = 0;
  let topToday = {}; let topMonth = {}; let topAllTime = {};
  let hourlySales = {}; let ordersHTML = "";
  const today = new Date().toDateString();
  const now = new Date();

  snapshot.forEach((docSnap)=>{
    const order = docSnap.data();
    const orderDate = toDate(order.time);
    const hour = orderDate.getHours();
    const slot = Math.floor(hour / 2) * 2;
    hourlySales[slot] = (hourlySales[slot] || 0) + (Number(order.total) || 0);

    order.items.forEach(item=>{ topAllTime[item.name] = (topAllTime[item.name] || 0) + (Number(item.qty) || 0); });

    if(orderDate.getMonth() === now.getMonth() && orderDate.getFullYear() === now.getFullYear()){
      order.items.forEach(item=>{ topMonth[item.name] = (topMonth[item.name] || 0) + (Number(item.qty) || 0); });
    }

    if(orderDate.toDateString() === today){
      revenue += Number(order.total) || 0; count += 1; discountTotal += Number(order.discount) || 0;
      let itemsHTML = "";
      order.items.forEach(item=>{
        const modifierHTML = getModifierHTML(item);
        itemsHTML += `<div>${escapeHTML(item.name)} x${item.qty} ${modifierHTML ? `<small><br>${modifierHTML}</small>` : ""}</div>`;
        topToday[item.name] = (topToday[item.name] || 0) + (Number(item.qty) || 0);
      });

      ordersHTML += `
        <div class="order-card">
          <div class="order-header" onclick="toggleOrder('${docSnap.id}')">
            <div><span class="order-no">${order.orderNo ? "#" + order.orderNo : ""}</span> <span class="order-clock">${orderDate.toLocaleTimeString()}</span></div>
            <div>RM ${money(order.total)}</div>
          </div>
          <div class="order-details" id="order-${docSnap.id}">
            ${itemsHTML}
            <div class="order-payment">
              ${escapeHTML(order.payment || "")}
              ${order.discount > 0 ? `<br>Discount: RM ${money(order.discount)}` : ""}
              ${order.note ? `<br>Note: ${escapeHTML(order.note)}` : ""}
            </div>
            <div class="order-actions">
              <button onclick="deleteOrder('${docSnap.id}')">Delete</button>
              <button onclick="editOrder('${docSnap.id}')">Edit Order</button>
            </div>
          </div>
        </div>
      `;
    }
  });

  setText("todayRevenue",money(revenue)); setText("todayOrders",count); setText("todayDiscount",money(discountTotal));
  setHTML("ordersList",ordersHTML);
  setHTML("topSellingToday", renderTopSelling(topToday));
  setHTML("topSellingMonth", renderTopSelling(topMonth));
  setHTML("topSellingAllTime", renderTopSelling(topAllTime));

  fullMonthSales = topMonth; fullAllTimeSales = topAllTime;
  const peak = Object.entries(hourlySales).sort((a,b)=>b[1]-a[1])[0];
  if(peak && $("peakHour")){
    const startHour = Number(peak[0]);
    const endHour = startHour + 2;
    const timeRangeString = `${startHour.toString().padStart(2, '0')}:00 - ${endHour.toString().padStart(2, '0')}:00`;
    setText("peakHour", timeRangeString);
  }
}

window.toggleOrder = function(id){
  const el = $(`order-${id}`);
  if(!el) return;
  el.style.display = el.style.display === "block" ? "none" : "block";
}

window.deleteOrder = async function(id){
  const ok = confirm("Delete order?");
  if(!ok) return;
  await deleteDoc(doc(db,"orders",id));
  loadDashboard();
}

window.editOrder = async function(id){
  const orderRef = doc(db,"orders",id);
  const orderSnap = await getDoc(orderRef);
  const order = orderSnap.data();
  let text = "";
  order.items.forEach(item=>{ text += `${item.name},${item.qty},${item.price}\n`; });

  const result = prompt(`Edit Items\nFormat: name,qty,price\nExample:\nShiro Matcha,2,9.9\nBasque,1,14.9\n`, text);
  if(result === null) return;
  const lines = result.split("\n").filter(line=>line.trim());
  let items = []; let subtotal = 0;
  lines.forEach(line=>{
    const parts = line.split(","); const name = parts[0]; const qty = Number(parts[1]); const price = Number(parts[2]);
    if(name && !isNaN(qty) && !isNaN(price)){
      items.push({name,qty,price}); subtotal += qty * price;
    }
  });

  const discount = Number(prompt("Discount RM", order.discount || 0)) || 0;
  const total = Math.max(0, subtotal - discount);
  const payment = prompt("Payment Method", order.payment);
  if(payment === null) return;
  const note = prompt("Order Note", order.note || "");
  if(note === null) return;

  await updateDoc(orderRef, { items, subtotal, discount, total, payment, note });
  loadDashboard();
}

// ---------- RECEIPT ----------
function showReceipt(order){
  const now = new Date();
  let html = `
    <div class="receipt">
      <div class="receipt-logo"><img src="./logo.png" alt="logo"></div>
      <h2>Matchalogy</h2>
      <p class="receipt-sub">Order #${order.orderNo || ""}</p>
      <p class="receipt-time">${now.toLocaleString()}</p>
      <hr>
  `;
  order.items.forEach(item=>{
    const modifierHTML = getModifierHTML(item);
    html += `
      <div class="receipt-item">
        <div><strong>${escapeHTML(item.name)}</strong>${modifierHTML ? `<small>${modifierHTML}</small>` : ""}</div>
        <div>x${item.qty}<br>RM ${money((Number(item.price) || 0) * (Number(item.qty) || 0))}</div>
      </div>
    `;
  });
  html += `
      <hr>
      ${order.discount > 0 ? `<div class="receipt-total"><span>Discount</span><strong>- RM ${money(order.discount)}</strong></div>` : ""}
      <div class="receipt-total"><span>Total</span><strong>RM ${money(order.total)}</strong></div>
      <p class="receipt-payment">Payment: ${escapeHTML(order.payment || "")}</p>
      ${order.note ? `<p>Note: ${escapeHTML(order.note)}</p>` : ""}
      <p class="receipt-thanks">Thank you for visiting 💚</p>
    </div>
  `;
  setHTML("receiptContent",html);
  show("receiptModal");
}

if($("closeReceiptBtn")){ $("closeReceiptBtn").addEventListener("click",()=>{ hide("receiptModal"); }); }
if($("printReceiptBtn")){ $("printReceiptBtn").addEventListener("click",()=>{ window.print(); }); }

// ---------- CLOSING & MONTHLY REVENUE & REPORT ----------

if($("closeDayBtn")){
  $("closeDayBtn").addEventListener("click", async()=>{
    const ok = confirm("确定要对今天进行结账关闭吗？");
    if(!ok) return;

    const today = new Date().toDateString();
    const snapshot = await getDocs(collection(db, "orders"));

    let revenue = 0; let discount = 0; let orders = 0;
    let cash = 0; let tng = 0; let shopee = 0;

    snapshot.forEach((docSnap)=>{
      const order = docSnap.data();
      const orderDate = toDate(order.time).toDateString();

      if(orderDate === today){
        const total = Number(order.total) || 0;
        revenue += total; 
        discount += Number(order.discount) || 0; 
        orders += 1;
        if(order.payment === "Cash") cash += total;
        if(order.payment === "TNG") tng += total;
        if(order.payment === "Shopee") shopee += total;
      }
    });

    await addDoc(collection(db, "closings"), { 
      date: today, revenue, discount, orders, cash, tng, shopee, time: new Date() 
    });
    alert("Day Closed ✅");
    loadClosingHistory(); 
    loadDashboard();
  });
}

// 定义全局变量，用于搜索功能
window.allClosings = []; 

function renderClosingCards(list){
  let html = "";
  list.forEach(c=>{
    html += `
      <div class="closing-card">
        <strong>${escapeHTML(c.date)}</strong><br>
        Revenue: RM ${money(c.revenue)}<br>
        Discount: RM ${money(c.discount)}<br>
        Orders: ${c.orders}<br>
        Cash: RM ${money(c.cash)}<br>
        TNG: RM ${money(c.tng)}<br>
        Shopee: RM ${money(c.shopee)}
        <button onclick="deleteClosing('${c.id}')">Delete</button>
      </div>
    `;
  });
  return html;
}

async function loadClosingHistory(){
  const snapshot = await getDocs(collection(db, "closings"));
  let closings = [];
  snapshot.forEach((docSnap)=>{ 
    closings.push({ id: docSnap.id, ...docSnap.data() }); 
  });
  closings.sort((a, b)=> toDate(b.time) - toDate(a.time));
  allClosings = closings;

  // 1. 统计每个月的数据
  let monthData = {};
  closings.forEach(c=>{
    const date = toDate(c.time);
    const monthLabel = `${date.toLocaleString("default", { month: "long" })} ${date.getFullYear()}`;
    const inputFormat = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    
    if(!monthData[monthLabel]){ 
      monthData[monthLabel] = { total: 0, inputVal: inputFormat }; 
    }
    monthData[monthLabel].total += Number(c.revenue) || 0;
  });

  // 2. 渲染 Daily Closing
  setHTML("closingHistory", renderClosingCards(closings));

  // 3. 渲染月份列表卡片
  let monthHTML = "";
  Object.entries(monthData).forEach(([monthLabel, data])=>{
    monthHTML += `
      <div class="closing-card" style="cursor:pointer; background:#f0f4f8; border-left: 4px solid #1976d2; padding: 10px; margin-bottom: 5px;" onclick="openMonthlyReport('${data.inputVal}', '${monthLabel}')">
        <strong>${escapeHTML(monthLabel)}</strong><br>
        Revenue: RM ${money(data.total)}<br>
        <small style="color:#1976d2; font-weight:bold;">👉 Click to view & download report</small>
      </div>
    `;
  });
  setHTML("monthlyRevenueList", monthHTML);
}
  // 渲染月份列表卡片
  let monthHTML = "";
  Object.entries(monthData).forEach(([monthLabel, data])=>{
    monthHTML += `
      <div class="closing-card" style="cursor:pointer; background:#f0f4f8; border-left: 4px solid #1976d2; padding: 10px;" onclick="openMonthlyReport('${data.inputVal}', '${monthLabel}')">
        <strong>${escapeHTML(monthLabel)}</strong><br>
        Revenue: RM ${money(data.total)}<br>
        <small style="color:#1976d2; font-weight:bold;">👉 Click to view & download report</small>
      </div>
    `;
  });
  setHTML("monthlyRevenueList", monthHTML);
}

// 恢复搜索栏逻辑
if($("closingSearch")){
  $("closingSearch").addEventListener("input", (e)=>{
    const val = e.target.value.toLowerCase();
    const filtered = allClosings.filter(c => c.date.toLowerCase().includes(val));
    setHTML("closingHistory", renderClosingCards(filtered));
  });
}

window.deleteClosing = async function(id){
  const ok = confirm("Delete this closing record?");
  if(!ok) return;
  await deleteDoc(doc(db, "closings", id));
  loadClosingHistory();
};

if($("openMonthlyBtn")){ $("openMonthlyBtn").addEventListener("click", () => show("monthlyModal")); }
if($("closeMonthlyBtn")){ $("closeMonthlyBtn").addEventListener("click", () => hide("monthlyModal")); }

// --- 点击月份后打开报表弹窗的逻辑 ---
window.openMonthlyReport = async function(monthValue, monthLabel) {
  $("reportMonth").value = monthValue;
  setText("reportMonthTitle", monthLabel + " Report");
  await generateMonthlyReport();
  show("monthlyReportModal");
};

// --- 生成单个月份的报表内容 ---
async function generateMonthlyReport(){
  const monthValue = $("reportMonth").value;
  if(!monthValue) return;

  const [year, month] = monthValue.split("-").map(Number);
  const snapshot = await getDocs(collection(db, "orders"));

  let revenue = 0; let orders = 0; let discount = 0;
  let top = {};

  snapshot.forEach(docSnap=>{
    const order = docSnap.data();
    const d = toDate(order.time);
    if(d.getFullYear() === year && (d.getMonth() + 1) === month){
      revenue += Number(order.total) || 0;
      discount += Number(order.discount) || 0;
      orders++;
      order.items.forEach(item=>{ 
        top[item.name] = (top[item.name] || 0) + (Number(item.qty) || 0); 
      });
    }
  });

  const top3 = Object.entries(top).sort((a,b)=>b[1]-a[1]).slice(0,3);

  // 保证排版干净、整洁
  $("monthlyReportContent").innerHTML = `
    <h3>Revenue</h3>
    <p>RM ${money(revenue)}</p>
    <h3>Orders</h3>
    <p>${orders}</p>
    <h3>Discount</h3>
    <p>RM ${money(discount)}</p>
    <hr>
    <h3>Top Selling</h3>
    ${top3.map((item,index)=>`<div>${index+1}. ${item[0]} x${item[1]}</div>`).join("") || '<div>-</div>'}
  `;
}

// 报表弹窗的退出按钮逻辑
if($("closeReportBtn")){ 
  $("closeReportBtn").addEventListener("click", () => hide("monthlyReportModal")); 
}

// --- 下载 PDF / 打印功能 ---
if($("downloadReportBtn")){
  $("downloadReportBtn").addEventListener("click", () => {
    const reportContent = $("monthlyReportContent").innerHTML;
    const monthTitle = $("reportMonthTitle").innerText;
    
    const printWindow = window.open("", "_blank");
    printWindow.document.write(`
      <html>
      <head>
        <title>${monthTitle}</title>
        <style>
          body { font-family: sans-serif; padding: 20px; color: #333; }
          hr { border: 0; border-top: 1px solid #ccc; }
          h3 { margin-bottom: 5px; color: #555; }
          p, div { font-size: 16px; margin-bottom: 15px; }
        </style>
      </head>
      <body>
        <h2>${monthTitle}</h2>
        ${reportContent}
        <script>
          window.onload = function() { 
            window.print(); 
            setTimeout(() => { window.close(); }, 500); 
          };
        <\/script>
      </body>
      </html>
    `);
    printWindow.document.close();
  });
} 

// ---------- SECURE QR PENDING ORDERS ----------
function startPendingOrdersListener(){
  if(pendingUnsubscribe){ pendingUnsubscribe(); }
  pendingUnsubscribe = onSnapshot(collection(db,"pendingOrders"), snapshot=>{
    const pendingList = [];
    snapshot.forEach(docSnap=>{ const order = docSnap.data(); if(order.status === "pending"){ pendingList.push({ id:docSnap.id, ...order }); } });
    pendingList.sort((a,b)=> toDate(b.createdAt) - toDate(a.createdAt));
    renderPendingOrders(pendingList);
  }, error=>{ console.error(error); setHTML("pendingOrdersList", "<p>Unable to load QR orders.</p>"); });
}

function renderPendingOrders(list){
  setText("pendingOrderCount", list.length);
  let html = "";
  list.forEach(order=>{
    const itemsHTML = (order.items || []).map(item=>`
        <div><strong>${escapeHTML(item.nameSnapshot || "Product")} x${Number(item.qty) || 1}</strong>
          ${item.milk || item.ice || item.sweet ? `<small><br>${[item.milk, item.ice, item.sweet].filter(Boolean).map(escapeHTML).join(" · ")}</small>` : ""}
          ${item.addonName && item.addonName !== "None" ? `<small><br>${escapeHTML(item.addonName)}</small>` : ""}
          ${item.note ? `<small><br>Note: ${escapeHTML(item.note)}</small>` : ""}
        </div>
      `).join("");
    html += `
      <div class="pending-order-card">
        <div class="pending-order-header"><span>${escapeHTML(order.customerOrderNo || "QR")}</span><span>Est. RM ${money(order.estimatedTotal)}</span></div>
        <div class="pending-customer">Pickup: <strong>${escapeHTML(order.customerName || "")}</strong>${order.customerPhone ? `<br>Phone: ${escapeHTML(order.customerPhone)}` : ""}</div>
        <div class="pending-items">${itemsHTML}</div>
        ${order.note ? `<div class="pending-customer">Order Note: ${escapeHTML(order.note)}</div>` : ""}
        <div class="pending-actions">
          <button onclick="acceptPendingOrder('${order.id}')">Accept & Pay</button>
          <button class="reject-pending-btn" onclick="rejectPendingOrder('${order.id}')">Reject</button>
        </div>
      </div>
    `;
  });
  setHTML("pendingOrdersList", html || "<p>No pending QR orders.</p>");
}

window.acceptPendingOrder = async function(id){
  const payment = prompt("Payment Method: Cash / TNG / Shopee", "TNG");
  if(payment === null){ return; }
  const allowedPayments = ["Cash", "TNG", "Shopee"];
  if(!allowedPayments.includes(payment)){ alert("Please enter Cash, TNG or Shopee."); return; }

  const pendingRef = doc(db,"pendingOrders",id);
  const officialOrderRef = doc(collection(db,"orders"));
  const orderNo = Date.now().toString().slice(-6);

  try{
    await runTransaction(db, async transaction=>{
        const pendingSnap = await transaction.get(pendingRef);
        if(!pendingSnap.exists()){ throw new Error("QR order no longer exists."); }
        const pending = pendingSnap.data();
        if(pending.status !== "pending"){ throw new Error("This order has already been handled."); }
        const pendingItems = pending.items || [];
        if(pendingItems.length === 0 || pendingItems.length > 30){ throw new Error("Invalid QR order."); }

        const officialItems = []; let subtotal = 0;
        for(const item of pendingItems){
          const productRef = doc(db, "products", String(item.productId));
          const productSnap = await transaction.get(productRef);
          if(!productSnap.exists()){ throw new Error("A product is no longer available."); }
          const product = productSnap.data();
          if(product.available === false){ throw new Error(`${product.name} is sold out.`); }

          const quantity = Math.min(20, Math.max(1, Number(item.qty) || 1));
          const config = getProductModifierConfig(product);
          const requestedAddonCode = String(item.addonCode || "0");
          const addon = config.showAddon ? config.addonOptions.find(option=>String(option.value) === requestedAddonCode) || config.addonOptions.find(option=>Number(option.price) === 0) || {value:"0",label:"None",price:0} : {value:"0",label:"None",price:0};
          const allowedValue = (value,options,enabled)=>{ if(!enabled) return ""; const text = String(value || "").slice(0,40); return options.some(option=>String(option.value) === text) ? text : ""; };
          const unitPrice = (Number(product.price) || 0) + (Number(addon.price) || 0);

          officialItems.push({
            productId:productSnap.id, name:product.name || "Product", price:unitPrice, qty:quantity,
            milk:allowedValue(item.milk,config.milkOptions,config.showMilk), ice:allowedValue(item.ice,config.iceOptions,config.showIce),
            sweet:allowedValue(item.sweet,config.sweetOptions,config.showSweet), addon:addon.label, addonCode:String(addon.value),
            note:config.showNote ? String(item.note || "").slice(0,200) : ""
          });
          subtotal += unitPrice * quantity;
        }

        transaction.set(officialOrderRef, {
            orderNo, items:officialItems, subtotal, discount:0, total:subtotal, payment, note: String(pending.note || "").slice(0,300),
            source:"QR", customerName: String(pending.customerName || "").slice(0,50), customerPhone: String(pending.customerPhone || "").slice(0,30),
            customerOrderNo: pending.customerOrderNo || "", time: serverTimestamp()
        });
        transaction.update(pendingRef, {
            status:"accepted", payment, acceptedAt: serverTimestamp(), officialOrderNo: orderNo, officialOrderId: officialOrderRef.id, finalTotal: subtotal
        });
    });
    alert(`QR order accepted ✅\nOrder #${orderNo}`);
    loadDashboard();
  }catch(error){
    console.error(error); alert(error.message || "Unable to accept this order.");
  }
}

window.rejectPendingOrder = async function(id){
  const reason = prompt("Reason for rejection", "Item unavailable");
  if(reason === null){ return; }
  await updateDoc(doc(db,"pendingOrders",id), { status:"rejected", rejectReason: String(reason).slice(0,200), rejectedAt: serverTimestamp() });
}

// ---------- STORE OPEN / CLOSED ----------
let storeOpenState = true;
function renderStoreStatusButton(){
  const button = $("storeStatusBtn");
  if(!button){ return; }
  button.classList.remove("store-open", "store-closed");
  if(storeOpenState){ button.classList.add("store-open"); button.innerText = "Store: Open"; }
  else{ button.classList.add("store-closed"); button.innerText = "Store: Closed"; }
}

async function loadStoreStatus(){
  try{
    const snapshot = await getDoc(doc(db,"settings","store"));
    if(snapshot.exists()){ storeOpenState = snapshot.data().open !== false; }else{ storeOpenState = true; }
    renderStoreStatusButton();
  }catch(error){
    console.error(error); const button = $("storeStatusBtn"); if(button){ button.innerText = "Status Error"; }
  }
}

if($("storeStatusBtn")){
  $("storeStatusBtn").addEventListener("click",async()=>{
    if(!["owner","manager"].includes(currentStaffRole)){ alert("Only owner or manager can change store status."); return; }
    const button = $("storeStatusBtn"); const newStatus = !storeOpenState;
    button.disabled = true; button.innerText = "Updating...";
    try{
      await setDoc(doc(db,"settings","store"), { open:newStatus, updatedAt: serverTimestamp(), updatedBy: auth.currentUser ? auth.currentUser.uid : "" }, { merge:true });
      storeOpenState = newStatus; renderStoreStatusButton();
      alert(newStatus ? "Customer ordering is now OPEN." : "Customer ordering is now CLOSED.");
    }catch(error){
      console.error(error); alert("Unable to change store status."); renderStoreStatusButton();
    }finally{ button.disabled = false; }
  });
}

// ---------- STAFF AUTH ----------
async function startPOSForStaff(user){
  const staffSnap = await getDoc(doc(db,"users",user.uid));
  if(!staffSnap.exists()){ await signOut(auth); alert("This account is not registered as staff."); return; }
  const staff = staffSnap.data();
  const allowedRoles = ["owner", "manager", "cashier"];
  if(staff.active !== true || !allowedRoles.includes(staff.role)){ await signOut(auth); alert("This staff account is inactive."); return; }
  currentStaffRole = staff.role;
  hide("staffLoginModal");

  if(appStarted){ return; }
  appStarted = true;

  loadProducts();
  loadDashboard();
  loadClosingHistory();
  startPendingOrdersListener();
  await loadStoreStatus();
}

if($("staffLoginBtn")){
  $("staffLoginBtn").addEventListener("click",async()=>{
    const email = getValue("staffEmail").trim();
    const password = getValue("staffPassword");
    setText("staffLoginError","");
    if(!email || !password){ setText("staffLoginError", "Please enter email and password."); return; }

    $("staffLoginBtn").disabled = true;
    $("staffLoginBtn").innerText = "Logging in...";
    try{
      await signInWithEmailAndPassword(auth, email, password);
    }catch(error){
      console.error(error); setText("staffLoginError", "Login failed. Check your email and password.");
    }finally{
      $("staffLoginBtn").disabled = false; $("staffLoginBtn").innerText = "Log In";
    }
  });
}

if($("logoutBtn")){
  $("logoutBtn").addEventListener("click",async()=>{
    if(pendingUnsubscribe){ pendingUnsubscribe(); pendingUnsubscribe = null; }
    appStarted = false; currentStaffRole = "";
    await signOut(auth);
  });
}

onAuthStateChanged(auth, async user=>{
  if(user){
    try{ await startPOSForStaff(user); }
    catch(error){ console.error(error); await signOut(auth); show("staffLoginModal"); }
  }else{
    show("staffLoginModal");
  }
});

// ---------- START (SALES MODAL VIEW) ----------
if($("openSalesBtn")){
  $("openSalesBtn").addEventListener("click",()=>{
    setHTML("allSalesList", renderFullSales(fullMonthSales));
    if($("showMonthSalesBtn")) $("showMonthSalesBtn").classList.add("active");
    if($("showAllSalesBtn")) $("showAllSalesBtn").classList.remove("active");
    show("salesModal");
  });
}

if($("salesSearch")){
  $("salesSearch").addEventListener("input",()=>{
    const keyword = getValue("salesSearch").trim().toLowerCase();
    const source = currentSalesView === "all" ? fullAllTimeSales : fullMonthSales;
    const filtered = {};
    Object.entries(source).forEach(([name,qty])=>{
      if(name.toLowerCase().includes(keyword)){ filtered[name] = qty; }
    });
    setHTML("allSalesList", renderFullSales(filtered));
  });
}

if($("showMonthSalesBtn")){
  $("showMonthSalesBtn").addEventListener("click",()=>{
    currentSalesView = "month";
    setHTML("allSalesList", renderFullSales(fullMonthSales));
    $("showMonthSalesBtn").classList.add("active");
    $("showAllSalesBtn").classList.remove("active");
  });
}

if($("showAllSalesBtn")){
  $("showAllSalesBtn").addEventListener("click",()=>{
    currentSalesView = "all";
    setHTML("allSalesList", renderFullSales(fullAllTimeSales));
    $("showAllSalesBtn").classList.add("active");
    $("showMonthSalesBtn").classList.remove("active");
  });
}

if($("closeSalesBtn")){ $("closeSalesBtn").addEventListener("click",()=>{ hide("salesModal"); }); 